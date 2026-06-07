# Thermo-Nuclear Code Quality Review — gsd-debug changes

**Verdict: BLOCK.** The fixes are correct but the implementation choices have multiplied the duplication and orchestration in ways that a single "code judo" move would delete. Specifically: `processingPipeline.ts` now contains three near-identical save-blocks; the export module contains three near-identical section-builders; and the meeting-detail module duplicates the report-parser that `exporter.ts` already owns. The diff increases total code mass where it should have been a chance to consolidate.

---

## 1. [BLOCKER] `processingPipeline.ts` is three pipelines pretending to be one

**File:** `src/services/processingPipeline.ts:60-301` (313 lines)

`runFullPipeline`, `retryFromFailedStep`, and `keepTranscriptOnly` each contain a near-identical "save block": build JSON, call `saveMeeting`, move audio, set the meeting in the store, advance to `RESULTS`, clear the step label. Lines 84-117, 167-194, 199-229, and 264-287 are the same orchestration repeated four times with minor variation.

The "code judo" move is to **collapse the three hooks into one state machine**:

```ts
// Conceptual — not the final API, but shows the shape
async function commitStep({ transcript, cleaned, report, summary }, stepIndex: number) {
  setStep(stepIndex);
  const json = buildReportsJson(language, report ?? {}, summary ?? []);
  const id = await saveMeeting({...});
  await safeMoveAudio(id, chunks);
  setMeeting({ id, ... });
  return id;
}

async function runPipeline() {
  try {
    setStep(0);
    const transcript = await transcribe(chunks);
    setTranscript(transcript);
  } catch (e) { return fail(0, e); }

  try {
    setStep(1);
    const result = await generateReport(transcript, lang);
    setResults(result);
  } catch (e) { return fail(1, e); }

  await commitStep({...}, 2);
  setAppState('RESULTS');
}
```

The retry path then becomes `runPipeline()` again, **minus** the steps whose `failedStepIndex` is below it — or, more simply, just re-run from the failed step using cached intermediates. Either way, the four 30-line "save" blocks collapse to one helper, and the three hooks collapse to two: `run` and `keepTranscriptOnly`. The `runFullPipeline` / `retryFromFailedStep` distinction mostly disappears.

**Why it matters now:** every time the schema of "save a meeting" changes (e.g., add a `language` column, change audio-path strategy), four blocks need updating, and at least one will be missed. This is the kind of branching-by-copy that ages badly.

**What I'd do:** extract `commitMeeting(input: MeetingCommitInput) → Promise<number>` and have all three call sites use it. Delete the two "retry" branches that are now duplicates of the main save. Estimated 100-line reduction.

---

## 2. [BLOCKER] `parseReports` and `ParsedReports` are duplicated verbatim

**Files:** `src/services/exporter.ts:9-25` and `src/screens/MeetingDetailScreen.tsx:23-55`

`exporter.ts` defines:

```ts
type ParsedReports = {
  EN?: { report: ReportData; summary: string[] };
  FR?: { report: ReportData; summary: string[] };
};
function parseReports(meeting: MeetingRecord): ParsedReports { ... }
```

`MeetingDetailScreen.tsx` defines the **exact same** type and function with one cosmetic difference: it returns `LangReport` containing the same fields. Two copies, two slightly different shapes (`report ?? {}` vs `parsed.EN.report ?? {}`), two places to fix when the schema changes.

**This is exactly the "bespoke helper where the codebase already has a canonical utility" smell.** Move `parseReports` (and the `ParsedReports` type) to a single canonical location — `db/database.ts` is the natural home since it owns the column encoding — and import from both sites. Add a thin `getReportForLanguage(meeting, lang)` helper there too (since `exporter.ts:30-42` also defines one).

---

## 3. [BLOCKER] `exporter.ts` is 493 lines because three formats share a section-builder that doesn't exist

**File:** `src/services/exporter.ts`

The PDF path (`buildReportHTML`, lines 79-142), DOCX path (lines 290-432, inline), and text path (`buildReportText`, lines 159-215) each manually enumerate the five report sections: `summary`, `overview`, `keyDiscussionPoints`, `actionItems`, `decisionsMade`, `openQuestions`. The only differences are: what wrapping tags to use, what bullet character, what heading style, what color.

The "code judo" move: a `forEachReportSection(input, (section) => null|node)` pattern where each format supplies its own `node` factory. Concretely:

```ts
const SECTIONS = [
  { key: 'summary',              title: 'Summary',                items: r => r.summary },
  { key: 'overview',             title: 'Overview',               items: r => r.overview ? [r.overview] : [] },
  { key: 'keyDiscussionPoints',  title: 'Key Discussion Points',  items: r => r.keyDiscussionPoints },
  { key: 'actionItems',          title: 'Action Items',           items: r => r.actionItems },
  { key: 'decisionsMade',        title: 'Decisions Made',         items: r => r.decisionsMade },
  { key: 'openQuestions',        title: 'Open Questions',         items: r => r.openQuestions },
] as const;
```

Then each format is a single function that takes `SECTIONS` and emits its native representation. The 200 lines of DOCX-builder code collapses to ~30. Same for PDF/HTML. This isn't speculative — it's a textbook case of a missing data model.

**Side effect:** the `MeetingScreen.tsx` RESULTS renderer (lines 278-346) is a **fourth** copy of the same five-section enumeration. There are now four places to update if a section is added. Pull `SECTIONS` into a shared module and have `MeetingScreen`, `MeetingDetailScreen`, and `exporter.ts` all consume it.

---

## 4. [BLOCKER] `MeetingScreen.tsx` is a 428-line state-routed UI

**File:** `src/screens/MeetingScreen.tsx`

The component is a single function that branches on `appState` and renders completely different UIs for FORM, READY, RECORDING, PROCESSING, PROCESSING+error, and RESULTS — six subcomponents glued together with conditional returns. Each branch has its own colors, styles, and concerns. The file is past 400 lines and still has duplicated inline styles (`{color: '#e8d5b7', fontSize: ..., fontWeight: '700'}` appears six times).

The "code judo" move: split into one file per state, co-located. `screens/MeetingScreen/` containing `index.tsx` (state router) + `FormState.tsx` + `ReadyState.tsx` + `RecordingState.tsx` + `ProcessingState.tsx` + `ResultsState.tsx`. Each becomes a 50-80 line focused component. The shared colors and base styles move to a `theme.ts` constants file, deleting the magic-string duplication.

This is **a 1k-line-pressure situation in waiting**. It's at 428 lines now; if someone adds a `PREVIEW` state or a "save to favorites" feature, this file will hit 600 in one PR.

---

## 5. [BLOCKER] `transcribeChunks` is sequential when it doesn't have to be

**File:** `src/services/transcriber.ts:32-121`

The for-loop processes chunks one at a time. For a 5-chunk recording, the user waits for 5 sequential network round-trips (~30 seconds minimum). Whichever chunks are independent — and they are, the API is stateless — can go to Groq **in parallel via `Promise.all`** with a small concurrency cap.

The current code also has a subtle **non-atomicity bug**: if chunk 3 fails its file read (the inner `catch` swallows it at line 117) but the loop completes, the user gets a transcript with chunk 3 missing. There's no way for the user to know. With parallel calls, the failure surface is also easier to reason about: a `Promise.allSettled` over all chunks, then build the transcript from successful ones, with a single warning if any failed.

**Note:** This is a *behavior* improvement, not just a code-quality one. But the cleaner code comes from the same restructuring — splitting "for each chunk: build body + send" into a per-chunk pure function and a `Promise.all` orchestrator. The body construction is identical for every chunk; pull it into a `buildChunkRequestBody(boundary, chunkPath, model, langCode)` helper.

---

## 6. [BLOCKER] `generator.ts:172-175` has dead/misleading code

**File:** `src/services/generator.ts:172-181`

```ts
// Build the cleaned transcript — we return the original transcript as cleanedTranscript
// since Gemini's structured output focuses on the report, not a separate cleaned version.
// The "cleaning" is implicit in the report generation.
const cleanedTranscript = rawTranscript;

return {
  cleanedTranscript,
  report: parsed.report,
  summary: parsed.summary,
};
```

The "cleaned transcript" is literally the raw transcript, but the contract name suggests it was cleaned. The prompt instructions *tell* Gemini to clean the transcript (line 108), and the schema doesn't even include a `cleanedTranscript` field — Gemini never returns one. So the entire "cleaned" pipeline is theater: the UI shows the same text under "Cleaned" and "Raw" tabs.

**Two issues:**

1. The contract lies. Either rename to `rawTranscript` everywhere (and remove the toggle in `MeetingDetailScreen.tsx:286-309`) or actually ask Gemini for a cleaned version.
2. The state field `cleanedTranscript` in `appStore.ts:21` is dead state, populated but never read for anything except the "Cleaned" tab that shows the same text as Raw.

This isn't from the gsd-debug session, but the recent edits did **not** catch it during the cleanup work. Worth flagging.

---

## 7. [MAJOR] `useProcessingPipeline` reads 11 store slices with 11 subscriptions

**File:** `src/services/processingPipeline.ts:36-55`

```ts
const appState = useAppStore((s) => s.appState);
const currentLanguage = useAppStore((s) => s.currentLanguage);
const meetingTitle = useAppStore((s) => s.meetingTitle);
// ... 8 more
```

This works but is noisy. The whole store is small enough that `const { audioChunks, ...} = useAppStore()` would be more legible and zustand's shallow comparison makes the perf identical. Same in `MeetingScreen.tsx:14-29` (12 slices).

**Smaller observation:** `appState` is read at line 37 but never used inside the hook. Dead.

---

## 8. [MAJOR] `appStore.setError(error, stepIndex?)` is a foot-gun by design

**File:** `src/store/appStore.ts:104-108`

```ts
setError: (error: string, stepIndex: number | null = null) =>
  set({ error, failedStepIndex: stepIndex }),
```

Defaulting `stepIndex` to `null` exists to preserve the "old" semantics for callers that don't know about the new param. But:

- Every existing call site should pass an explicit `stepIndex`. Forgetting to do so silently produces a `failedStepIndex: null` UI state.
- The "old semantics" the diff claims to preserve (`failedStepIndex: state.processingStepIndex`) was a **bug**. The default is now different from the buggy default in a way that's invisible at the call site.

Make `stepIndex` required. Find the two callers; one is in `processingPipeline.ts:120` and the other is in `keepTranscriptOnly:290` (already passes `2`). Both are inside this hook, so the API can be made strict without breaking other code.

**Adjacent issue:** `processingPipeline.ts:233` calls `setError(message)` with no stepIndex in the `retryFromFailedStep` catch. This is **a real bug** the recent edit introduced — it means if retry fails, the UI loses the failed-step context. Should be `setError(message, failedStepIndex)`.

---

## 9. [MAJOR] `MainScreen`'s "hardware back" code is misleading

**File:** `App.tsx:60-75`

```ts
useEffect(() => {
  const onBackPress = () => {
    if (activeTab !== 'Meeting') {
      setActiveTab('Meeting');
      return true;
    }
    return false;
  };
  const subscription = navigation.addListener('beforeRemove', (e: any) => {
    if (navigation.getState().index === 0) {
      e.preventDefault();
    }
  });
  return subscription;
}, [navigation, activeTab]);
```

Two problems:

1. `onBackPress` is **defined but never wired to anything**. It's dead code. The hardware back gesture is intercepted by `beforeRemove`, which is the actual implementation. Delete the dead function.
2. The `beforeRemove` listener returns the subscription correctly, but its `onBackPress` sibling makes it look like there's a two-layered back strategy. **Spaghetti signal.** Strip to one mechanism.

The first `useEffect` (lines 53-58) is similarly dead: a `focus` listener that does nothing.

---

## 10. [MAJOR] `useCallback` deps in `processingPipeline.ts` are stale by construction

**File:** `src/services/processingPipeline.ts:122-133, 235-251, 292-301`

The hook reads `useAppStore.getState().audioChunks` inside the callback to dodge the closure problem — but the dependency arrays still list `currentLanguage`, `meetingTitle`, `meetingDate`, etc. that are captured via subscription at the top. If the user changes language mid-pipeline, the callback holds the **language at hook creation time**, not the current one. The `getState()` fix solved the `audioChunks` symptom; the underlying issue — mixed subscription and getState reads — invites the same bug class for the next field someone forgets to refactor.

**Cleaner:** drop the top-of-hook subscription reads; have the callback read everything from `useAppStore.getState()` at the top of the function. The hook becomes:

```ts
export function useProcessingPipeline() {
  const setResults = useAppStore((s) => s.setResults); // setters are stable
  // ... etc
  return useCallback(async () => {
    const { audioChunks, currentLanguage, ... } = useAppStore.getState();
    // fresh reads inside the function
  }, [/* setters only */]);
}
```

This deletes 11 lines of subscription code and 3 stale-closure failure modes.

---

## 11. [MINOR] `AudioPlayer.hasStartedRef` reset is a workaround for the wrong place to hold state

**File:** `src/components/AudioPlayer.tsx:29, 46, 72-77, 98, 109`

`hasStartedRef` is a private boolean that the rest of the component has to manually keep in sync. The "real" question is: "has the native player been started on the current `audioPath`?" — which is naturally expressed as "the native player has a current source." Use a `playbackState` enum: `'idle' | 'playing' | 'paused' | 'finished'`. Set it from the listener's `isFinished` event and from the `handlePlayPause` function. The `handleSeek` guard becomes `playbackState !== 'idle'`.

This is more code, but it makes the state machine explicit instead of hiding it in a ref. The `hasStartedRef.current = false` line added in the diff is the smell — the ref is a code smell that needs a state machine to fix it properly.

---

## 12. [MINOR] `moveAudioToPermanentStorage` return-shape is a defensive workaround

**File:** `src/db/database.ts:287-334`

The new function returns `string` (a file path) instead of the old `string` (a directory). The diff added a fallback: "if no files were moved, scan the directory for any existing `.m4a` file." This works, but the fallback hides a real bug — somewhere upstream, an empty `chunkPaths` array is being passed. **At minimum, log a warning** when the fallback fires so production bugs are visible. Better: assert at the call site that `chunkPaths.length > 0` and let the bug surface immediately.

Also: the function now has two return shapes (file path from move, file path from dir-scan) and throws a third (no audio found). Three behaviors behind one signature. Consider returning a discriminated union: `Promise<{ kind: 'moved'; path: string } | { kind: 'recovered'; path: string } | { kind: 'empty' }>` so callers can react to "no audio" without try/catch.

---

## 13. [MINOR] `uploader.ts` still references `isCancel` — TypeScript error in the diff

**File:** `src/services/uploader.ts:75`

```ts
} catch (err) {
  if (isCancel(err)) {  // <- undefined at runtime
    return null;
  }
```

The edit changed the import to `isErrorWithCode` and `errorCodes` but the call site still says `isCancel(err)`. This is **left over from the diff**. Compile error in the workspace. Fix to `if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)`.

---

## 14. [MINOR] `getMeeting` is called twice in `MeetingDetailScreen` for the same ID

**File:** `src/screens/MeetingDetailScreen.tsx:73-79, 86-97`

The `useFocusEffect` loads the meeting, then a `useEffect` re-reads it to compute the initial language. Two round-trips to SQLite for the same record. Pull the initial-language logic into the focus callback:

```ts
useFocusEffect(useCallback(() => {
  getMeeting(meetingId).then((m) => {
    if (!m) return;
    setMeeting(m);
    setEditedTitle(m.title);
    if (m.reports) {
      const parsed = JSON.parse(m.reports);
      if (!parsed[m.currentLang] && (parsed.EN || parsed.FR)) {
        setCurrentLang(parsed.EN ? 'EN' : 'FR');
      }
    }
  });
}, [meetingId]));
```

---

## 15. [MINOR] Theme colors are scattered as hex strings

**File:** widespread — `App.tsx:91, 162-200, 91, 202`, `MeetingScreen.tsx:143, 187, 215, 280, ...`, `MeetingDetailScreen.tsx:450, 470, 491, ...`, `exporter.ts:122-130`, etc.

Magic colors `#d4a574`, `#0f0f0f`, `#8a7e72`, `#1a1a1a`, `#f5f0eb`, `#e8d5b7`, `#ff4757`, `#e74c3c` appear in ~80 places. A theme module (e.g., `src/theme.ts`) with named tokens `theme.accent`, `theme.bg`, `theme.textMuted`, etc. would:

- Make the upcoming web-app color sync mechanical (compare two token files)
- Catch typos (`#d4a675` instead of `#d4a574`) at the type level
- Make the dark-mode story simpler later

The web app at `C:\projects\meeting\styles.css` has a small set of CSS custom properties. Mirror those names exactly in `src/theme.ts` so the two codebases stay in sync.

---

## 16. [MINOR] `recorder.ts` and `uploader.ts` share the same ffmpeg split logic

**File:** `src/services/recorder.ts:126-200` and `src/services/uploader.ts:87-184`

`getChunkedAudioPaths` (recorder) and `chunkExistingFile`'s ffmpeg section (uploader) are **the same 70 lines of code**: probe duration, calculate segment count, run ffmpeg `-f segment`, read output dir. Only the input file path differs.

The "code judo" move: extract a `splitAudioWithFfmpeg(inputPath, outputDir, outputTemplate)` helper that returns `string[]` of chunk paths. Both callers pass their own `outputDir` and `outputTemplate`. The two error-handling paths can be standardized at the same time.

---

## 17. [MINOR] `cleanCacheTempFiles` and `cleanUploadChunks` are the same loop

**File:** `src/db/database.ts:380-400` and `src/services/uploader.ts:189-202`

Both functions scan `CachesDirectoryPath` for entries with a given prefix and unlink them. The prefix lists differ by one entry (`upload-chunks-` lives only in uploader, `meeting-recording-` and `chunks-` live only in database). This is a third copy of the same loop. Extract a `purgeCacheByPrefix(prefixes: string[])` helper.

---

## 18. [NIT] The passcode gate is correct, but the abstraction is now over-clever

**File:** `App.tsx:97-125`

The `initialRoute` state machine: `Passcode` | `ApiKeySetup` | `Main` with sequential `setInitialRoute` calls inside a single `useEffect` works, but the order of side effects (DB init → passcode check → API key check) means a slow `initDB` blocks everything. There's no recovery if `initDB` throws. The loading state (`isReady` gate) hides this from the user.

This is fine for now, but the moment someone needs a "skip passcode on dev build" or "show offline mode when DB fails" branch, this hook will grow nested conditions. Consider: an explicit `AppInitStep` enum (`DBInit` → `AuthCheck` → `Ready`) with one piece of work per step, and a top-level `if (initError)` fallback. But this is speculative; flag it but don't block on it.

---

## Summary of blockers (must fix before merge)

1. **`processingPipeline.ts` is 4× duplicated save orchestration** — extract a `commitMeeting(input)` helper.
2. **`parseReports` and `ParsedReports` are defined twice** — canonicalize in `db/database.ts`.
3. **`exporter.ts` and `MeetingScreen.tsx` enumerate the same 5 sections four times** — extract a `SECTIONS` model.
4. **`MeetingScreen.tsx` is 428 lines of state-routed UI** — split per-state.
5. **`transcribeChunks` is sequential** — `Promise.all` with concurrency cap.
6. **`generator.ts` returns raw as cleaned** — rename or actually clean.
7. **`processingPipeline` reads store via mixed subscription + `getState()`** — go all-in on `getState()`.
8. **`setError` is a foot-gun by default** — make `stepIndex` required; the catch in `retryFromFailedStep:233` is currently a bug.
9. **`MainScreen` has dead `useEffect` listeners** — delete.
10. **`uploader.ts:75` still references the removed `isCancel`** — actual compile error.

## Summary of "do later, but make a note"

- `AudioPlayer.hasStartedRef` should be a state enum.
- `moveAudioToPermanentStorage` should log a warning when its fallback fires.
- `getMeeting` is called twice in `MeetingDetailScreen`.
- Theme colors should be a `theme.ts` constants file.
- `recorder.ts` and `uploader.ts` share the ffmpeg split — extract it.
- `cleanCacheTempFiles` and `cleanUploadChunks` share the purge loop — extract it.

The recent gsd-debug diff is technically working, but it inherited and amplified the existing duplication. A 30-minute refactor in the direction of items 1, 2, 3, 4, 7, 8 would clean up roughly 200 lines of code and eliminate a whole class of future bugs. As-is, the next change to "save a meeting" will require four coordinated edits in three files.
