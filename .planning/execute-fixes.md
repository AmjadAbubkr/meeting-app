# Execution Plan: Address Code Review Blockers

This plan deletes duplication, not just patches symptoms. Each phase is independently shippable. Run `npx tsc --noEmit` after each phase.

---

## Phase 1: Fix the compile error, collapse the pipeline save-orchestration, and go all-in on `getState()`

**Goal:** Make the workspace build, collapse four near-identical save-blocks into one helper, and delete the stale-closure store subscriptions that invited bugs #7 and #8.

**Files to modify:**
- `src/services/uploader.ts`
- `src/services/processingPipeline.ts`
- (no other files — keeps the blast radius small)

**Concrete changes:**

1. **Fix the actual compile error** (`uploader.ts:75`):
   - Replace the dead `isCancel(err)` with `isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED`.
   - No other change to `uploader.ts`.

2. **Rewrite `processingPipeline.ts` to use two helpers**:
   - `commitMeeting(input: CommitInput): Promise<number>` — single save path. Reads `currentLanguage`, `meetingTitle`, `meetingDate`, `audioChunks` from `useAppStore.getState()` inside the function. Sets `STEP_LABELS[2]`, calls `buildReportsJson`, `saveMeeting`, `moveAudioToPermanentStorage` (best-effort, wrapped in try/catch), `updateMeeting` for `audioPath`, `useAppStore.getState().setMeeting({...})`, `setAppState('RESULTS')`, `setProcessingStep('')`. Returns the meeting id.
   - `finalizeMeeting(meetingId: number): Promise<void>` — extracted audio-move + set-meeting + set-state step. `commitMeeting` calls it at the end.
   - `CommitInput` type: `{ transcript: string; cleanedTranscript?: string; report?: ReportData; summary?: string[] }`. When `report` is undefined, `commitMeeting` omits the `reports` field in `saveMeeting` (preserves `keepTranscriptOnly` behavior — no reports column written).
   - Delete the 11 subscription reads at the top of the hook. Keep only setter subscriptions: `setAppState`, `setProcessingStep`, `setProcessingStepIndex`, `setTranscriptFromApi`, `setResults`, `setError`, `clearError`.
   - `runFullPipeline` reads `audioChunks` and `currentLanguage` via `useAppStore.getState()` at the top of the function. Calls `transcribeChunks`, then `generateReport`, then `commitMeeting({...})`. Single `try/catch` sets `setError(message, currentStepIndex)`.
   - `retryFromFailedStep` reads `failedStepIndex` from `useAppStore.getState()` at the top. Branch 0 → `runFullPipeline()`. Branch 1 → call `generateReport` with existing `rawTranscript`, then `commitMeeting`. Branch 2 → `commitMeeting` with cached `report`/`summary`/`cleanedTranscript`. Single `try/catch` calls `setError(message, failedStepIndex)` — **fixes the line-233 bug** by passing the captured index.
   - `keepTranscriptOnly` calls `commitMeeting({ transcript: rawTranscript, cleanedTranscript: rawTranscript })` (no `report`). Single `try/catch` calls `setError(message, 2)`.
   - `useCallback` dep arrays become **just the setters** (which zustand returns stably). No more `currentLanguage`, `meetingTitle`, `meetingDate`, etc. in the deps.
   - Delete the unused `appState` subscription that was never read inside the hook.

**Code judo rationale:**
- The four save blocks are **literal copies with one variable changed** (which fields are available). By extracting `commitMeeting`, we make "the schema of saving a meeting" a single function. Future schema changes happen in one place.
- Going all-in on `getState()` deletes 11 subscription lines and 3 stale-closure failure modes. The whole "stale closure" problem the diff was working around disappears because there's no closure to be stale of.
- `keepTranscriptOnly` is a 5-line function instead of 30 — it just calls `commitMeeting` with no `report`.

**Verification:**
- `grep -n "useAppStore.getState()" src/services/processingPipeline.ts` — should show reads at the top of each callback (no top-of-hook subscriptions).
- `grep -n "saveMeeting\|setMeeting\|setAppState('RESULTS')" src/services/processingPipeline.ts` — each should appear **once** in `commitMeeting`/`finalizeMeeting`, not in three call sites.
- `npx tsc --noEmit` — must pass clean.
- `grep -n "isCancel" src/services/uploader.ts` — must return zero matches.
- Manual smoke: record a meeting, confirm it saves; trigger a Gemini error mid-pipeline, confirm retry is offered with the correct `failedStepIndex` (e.g., 1 for report-generation failure).

**Risk note:** The biggest risk is silently introducing a stale read of `currentLanguage` (or another field) by forgetting to call `getState()`. The `useCallback` dep arrays no longer list these fields, so the lint rule `react-hooks/exhaustive-deps` cannot catch it. Mitigation: comment at the top of each callback: `// Read fresh state — do not capture via useCallback closure.` Grep for `useAppStore((s) =>` at the top of the file — should be zero matches.

---

## Phase 2: Canonicalize `parseReports` / `ParsedReports` in `db/database.ts`

**Goal:** Delete the verbatim duplicate of `parseReports` that lives in `MeetingDetailScreen.tsx`. Make the reports JSON encoding a single source of truth.

**Files to modify:**
- `src/db/database.ts` — add the canonical types/helpers
- `src/services/exporter.ts` — import from `db/database`
- `src/screens/MeetingDetailScreen.tsx` — delete local copy, import from `db/database`

**Concrete changes:**

1. **`src/db/database.ts`** — append (above the `rowToMeetingRecord` helper is fine, or in a new section):
   ```ts
   import type { ReportData } from '../store/appStore';

   export type LangReport = {
     report: ReportData;
     summary: string[];
   };

   export type ParsedReports = {
     EN?: LangReport;
     FR?: LangReport;
   };

   export function parseReports(meeting: MeetingRecord): ParsedReports { ... }
   export function getReportForLanguage(meeting: MeetingRecord, language: 'EN' | 'FR'): LangReport | null { ... }
   ```
   The function bodies are the existing `exporter.ts` versions verbatim (which use the slightly more permissive `?? {}` / `?? []` fallbacks — those are the right behavior).

2. **`src/services/exporter.ts`** — delete the local `ParsedReports` type (lines 9-12), the local `parseReports` (lines 18-25), and the local `getReportForLanguage` (lines 30-42). Add `import { parseReports, getReportForLanguage } from '../db/database';` at the top. The two call sites at lines 232 and 281 are unchanged (they already call `getReportForLanguage`).

3. **`src/screens/MeetingDetailScreen.tsx`** — delete the local `LangReport` type (lines 23-26), the local `ParsedReports` type (lines 28-31), and the local `parseReports` (lines 33-55). Add `import { parseReports, type ParsedReports } from '../db/database';`. The single call site at line 83 (`parseReports(meeting)`) is unchanged.

**Code judo rationale:**
- The reports JSON column has a single on-disk encoding. The decoder should be in the same module that owns the column. Two copies = two places to fix when the schema evolves.
- `LangReport` and `ParsedReports` were the same type under different names. Pick one (`LangReport` is more descriptive — the report+summary tuple for a given language).

**Verification:**
- `grep -n "parseReports\|ParsedReports\|LangReport" src/services/exporter.ts src/screens/MeetingDetailScreen.tsx src/db/database.ts` — should show `parseReports` defined only in `database.ts` and imported elsewhere.
- `npx tsc --noEmit` — must pass.
- Manual smoke: open a meeting in `MeetingDetailScreen` with both EN and FR reports, switch languages, confirm both render. Export PDF and DOCX from there.

**Risk note:** The two existing `parseReports` have slightly different fallback behavior:
- `exporter.ts` version: `parsed.EN.report ?? {}` and `Array.isArray(parsed.EN.summary) ? parsed.EN.summary : []`
- `MeetingDetailScreen.tsx` version: same fallbacks

They're equivalent, so picking the `exporter.ts` body is safe. Verify by tracing a meeting whose `reports` JSON is missing one of the inner fields (e.g., `{"EN": {}}`) — both should yield `report: {}` and `summary: []`.

---

## Phase 3: Extract the `SECTIONS` model and collapse the three section enumerations

**Goal:** Add a single shared `SECTIONS` descriptor so PDF, DOCX, text, MeetingScreen RESULTS, and MeetingDetailScreen Report tab all iterate the same data. ~250 lines of near-duplicate code disappear.

**Files to modify:**
- **New file:** `src/services/reportSections.ts` (new module, no dependency changes)
- `src/services/exporter.ts`
- `src/screens/MeetingScreen.tsx`
- `src/screens/MeetingDetailScreen.tsx`

**Concrete changes:**

1. **Create `src/services/reportSections.ts`**:
   ```ts
   import type { ReportData } from '../store/appStore';

   export type SectionKind = 'bullets' | 'paragraph';

   export type SectionDescriptor = {
     key: 'summary' | 'overview' | 'keyDiscussionPoints' | 'actionItems' | 'decisionsMade' | 'openQuestions';
     title: string;
     kind: SectionKind;
     read: (report: ReportData, summary: string[]) => string | string[] | null;
   };

   export const REPORT_SECTIONS: readonly SectionDescriptor[] = [
     { key: 'summary',             title: 'Summary',              kind: 'bullets',   read: (_r, s) => s.length > 0 ? s : null },
     { key: 'overview',            title: 'Overview',             kind: 'paragraph', read: (r)    => r.overview ?? null },
     { key: 'keyDiscussionPoints', title: 'Key Discussion Points', kind: 'bullets',   read: (r)    => r.keyDiscussionPoints?.length ? r.keyDiscussionPoints : null },
     { key: 'actionItems',         title: 'Action Items',         kind: 'bullets',   read: (r)    => r.actionItems?.length ? r.actionItems : null },
     { key: 'decisionsMade',       title: 'Decisions Made',       kind: 'bullets',   read: (r)    => r.decisionsMade?.length ? r.decisionsMade : null },
     { key: 'openQuestions',       title: 'Open Questions',       kind: 'bullets',   read: (r)    => r.openQuestions?.length ? r.openQuestions : null },
   ] as const;

   export type RenderableSection = { section: SectionDescriptor; value: string | string[] };

   export function getRenderableSections(report: ReportData, summary: string[]): RenderableSection[] {
     const out: RenderableSection[] = [];
     for (const section of REPORT_SECTIONS) {
       const value = section.read(report, summary);
       if (value !== null) out.push({ section, value });
     }
     return out;
   }
   ```

2. **`src/services/exporter.ts`** — rewrite each builder as a single loop:
   - `buildReportHTML`: open `<html>...<body><h1>${title}</h1><div class="meta">${date}</div>`, then for each `getRenderableSections(report, summary)` entry: `if (kind === 'bullets')` write `<h2>${title}</h2><ul>${(value as string[]).map(escapeHtml).map(s => `<li>${s}</li>`).join('')}</ul>`; else write `<h2>${title}</h2><p>${escapeHtml(value as string)}</p>`. Close `</body></html>`. Net: ~50 lines instead of 65.
   - `buildReportText`: similar loop building `lines` array. `kind === 'bullets'` → push title, dashes, then `• ${v}` per item. `paragraph` → push title, dashes, value, blank. Net: ~25 lines instead of 60.
   - `exportDOCX`: in the `children: Paragraph[]` array, loop `getRenderableSections(...)` and push `heading: HEADING_2` + bullets-or-paragraph. The bullets template is a paragraph with `TextRun('\u2022 ', bold)` + `TextRun(text)` — extract a small `bulletParagraph(text)` helper inside the function. Net: ~60 lines instead of 145.
   - The shared `parseReports`/`getReportForLanguage` imports are now from `db/database` (from Phase 2).
   - Imports needed: add `import { getRenderableSections } from './reportSections';` and remove unused local types.

3. **`src/screens/MeetingScreen.tsx`** — replace the RESULTS report rendering (lines 278-346) with:
   ```tsx
   <ScrollView ...>
     <Text style={styles.title}>{meetingTitle}</Text>
     <Text style={styles.meta}>{meetingDate}</Text>
     {getRenderableSections(report, summary).map(({ section, value }) => (
       <View key={section.key} style={styles.section}>
         <Text style={styles.sectionTitle}>{section.title}</Text>
         {section.kind === 'bullets'
           ? (value as string[]).map((v, i) => (
               <Text key={i} style={styles.bulletText}>{'\u2022'} {v}</Text>
             ))
           : <Text style={styles.bodyText}>{value as string}</Text>}
       </View>
     ))}
     {/* unchanged: New Meeting, View in History, Export buttons */}
   </ScrollView>
   ```
   Replace the inline `{color: '#d4a574', ...}` and `{color: '#f5f0eb', ...}` style objects with named styles in the existing `StyleSheet.create({...})` block (`sectionTitle`, `sectionSubtitle`, `bulletText`, `bodyText` — mirror the ones in `MeetingDetailScreen.tsx`).

4. **`src/screens/MeetingDetailScreen.tsx`** — same pattern in `renderReportTab`. Replace the six `{sectionTitle, sectionSubtitle, bulletText, bodyText}` blocks (lines 220-280) with one `getRenderableSections` map. Existing `styles` already has these names — reuse them.

**Code judo rationale:**
- The "data model" was a hidden array of five section keys. Each format enumerated them, conditionally rendered, and chose its own bullet character. That's **four implementations of the same data, none of which is the data**. A `REPORT_SECTIONS` array is the data; the loop is the implementation. Adding a new section (e.g., `risks`) is now a one-line change in one file.
- The `kind: 'bullets' | 'paragraph'` discriminator encodes the only structural difference between sections. Each format has exactly one branch — no per-section code.

**Verification:**
- `grep -c "keyDiscussionPoints" src/services/exporter.ts src/screens/MeetingScreen.tsx src/screens/MeetingDetailScreen.tsx src/services/reportSections.ts` — exporter/MeetingScreen/MeetingDetail should each have **1** match (the property access in the renderer); `reportSections.ts` has **2** (the `REPORT_SECTIONS` entry and the type union).
- `npx tsc --noEmit` — must pass.
- Manual smoke: open the same meeting in the three sinks. They must render identically (within format constraints):
  - RESULTS screen after a fresh record
  - MeetingDetailScreen Report tab
  - Export PDF, Export DOCX, Share Text from both the RESULTS screen and the bottom sheet in MeetingDetailScreen

**Risk note:** The existing `MeetingScreen.tsx` RESULTS section uses a different visual hierarchy: `Summary` has a 18pt 700-weight title, the others have 16pt 600-weight. `MeetingDetailScreen.tsx` also has this. To preserve behavior, the renderer should accept an `isSummary: boolean` or check `section.key === 'summary'`. Simplest: in the JSX renderer, render `sectionTitle` style for `summary` and `sectionSubtitle` for everything else. The PDF/DOCX/text exports use the same heading style for all sections (HEADING_2, `<h2>`, `TITLE`); preserve that.

---

## Phase 4: Make `setError.stepIndex` required (and fix the line-233 bug for real)

**Goal:** Delete the silent `stepIndex: null` foot-gun. The compile error this introduces at line 233 points directly at the bug the review flagged.

**Files to modify:**
- `src/store/appStore.ts`
- `src/services/processingPipeline.ts` (only the two catch blocks — already consolidated in Phase 1, so this is small)

**Concrete changes:**

1. **`src/store/appStore.ts:45`** — change:
   ```ts
   setError: (error: string, stepIndex?: number) => void;
   ```
   to:
   ```ts
   setError: (error: string, stepIndex: number) => void;
   ```
   And the implementation at line 104-108 — drop the `= null` default:
   ```ts
   setError: (error, stepIndex) => set({ error, failedStepIndex: stepIndex }),
   ```

2. **`src/services/processingPipeline.ts`** — Phase 1 already passes `currentStepIndex` from `runFullPipeline` and `failedStepIndex` from `retryFromFailedStep`. Phase 4 just makes the previously-missing call at line 233 pass the captured `failedStepIndex` (which Phase 1 already changed to use `useAppStore.getState().failedStepIndex`). Verify: the three `setError` calls in the file all pass a non-null number.

**Code judo rationale:**
- The default of `null` existed to "preserve old semantics" for callers that didn't know about the param. But the old semantics (`failedStepIndex: state.processingStepIndex`) was a bug — it conflated "no step" with "the current step." Making the param required forces every caller to make a choice, which is the right call to make explicit.
- The fact that this change produces a TS error at the line 233 call site is the **point**: it surfaces a bug that a runtime test would miss.

**Verification:**
- `grep -n "setError(" src/services/processingPipeline.ts src/store/appStore.ts` — every call has two arguments.
- `npx tsc --noEmit` — must pass. If it fails at `processingPipeline.ts:233`, fix by passing `failedStepIndex`.
- Manual smoke: trigger a retry failure (e.g., turn off the network mid-retry). The error UI should show "Retry" (not "Cancel" / not "Keep transcript only" as if the transcript succeeded), with the previous `failedStepIndex` retained.

**Risk note:** The change is at the type boundary. Any external caller (none in the current code, but worth a grep) of `setError` without a `stepIndex` will fail to compile. Run `grep -rn "setError(" src/` to confirm only `processingPipeline.ts` calls it.

---

## Phase 5: Parallelize `transcribeChunks` with a concurrency cap

**Goal:** Stop making the user wait for 5 sequential network round-trips. Get the same concatenated output, faster, with the same per-chunk-failure-skip semantics.

**Files to modify:**
- `src/services/transcriber.ts` (entire file)
- No new dependencies.

**Concrete changes:**

1. **Extract a `buildChunkRequestBody(boundary, chunkPath, langCode)` helper** — returns `{ body: Uint8Array, contentType: string }`. Pure function of inputs. The body construction (lines 56-80 of the current file) moves into it unchanged. The filename extraction (`chunkPath.split('/').pop()`) and the base64 decoding stay inside.

2. **Extract a `transcribeChunk(chunkPath: string, langCode: string, apiKey: string): Promise<string>` helper** — reads the file, builds the body, calls `fetch`, returns the text. Throws on API errors, returns empty string for missing/empty files.

3. **Rewrite `transcribeChunks` as the orchestrator**:
   ```ts
   const results = await mapWithConcurrency(audioChunks, 3, async (chunkPath, index) => {
     try {
       const text = await transcribeChunk(chunkPath, langCode, apiKey);
       return { index, text };
     } catch (e) {
       if (e instanceof Error && e.message.startsWith('Groq API error')) throw e;
       console.warn(`[transcribe] chunk ${index} skipped:`, e);
       return { index, text: '' };
     } finally {
       onProgress?.(index + 1, audioChunks.length);
     }
   });
   const parts = results
     .sort((a, b) => a.index - b.index)   // preserve original order
     .map(r => r.text)
     .filter(t => t.trim().length > 0);
   const rawTranscript = parts.join(' ');
   if (!rawTranscript.trim()) throw new Error('Transcription returned empty results for all chunks.');
   return rawTranscript;
   ```

4. **Add a `mapWithConcurrency<T, R>(items, limit, fn): Promise<R[]>` helper** at the bottom of the file (or import from a new `src/utils/concurrency.ts` — your call). Implementation: chunk the array into windows of `limit` items and `Promise.all` each window in series. This caps in-flight requests at `limit` to avoid hammering the Groq API.

5. **Preserve the "API errors throw, file errors skip" semantics exactly.** The current code has the same distinction (lines 113-118). The new code must reproduce it. The `console.warn` is **new diagnostic output** (not a behavior change visible to the user); include it as a one-line safety net so production bugs in chunk 3 are no longer silent.

**Code judo rationale:**
- Sequential for-loops over network calls are a code smell. The function becomes "I have N independent requests" — that's `Promise.all` (or a concurrency-capped variant). The shape of the code matches the shape of the work.
- The "atomicity bug" the review calls out (chunk 3 silently missing) is a property of the current loop, not a separate fix. The new code is no worse: skipped chunks are still skipped, but the warning surfaces them. The output (concatenated text) is identical when no chunks fail.

**Verification:**
- `grep -n "for (" src/services/transcriber.ts` — should be zero matches (the for-loop is gone; the iteration is now in `mapWithConcurrency`).
- `npx tsc --noEmit` — must pass.
- Manual smoke: record a 30+ second meeting, watch the console — `Transcribing chunk N/M...` should appear with non-monotonic `N` values (out-of-order completion). The final transcript text should be identical to the sequential version for the same recording.

**Risk note:** The order of results is now `Promise.all`-determined. The `.sort((a, b) => a.index - b.index)` step is critical — without it, the transcript could be out of order. This is the most likely regression. Mitigation: the sort is explicit and tested by the manual smoke check.

---

## Phase 6: Stop the "cleaned transcript" theater

**Goal:** Remove the dead `cleanedTranscript` from the store, the dead toggle in `MeetingDetailScreen`, and the misleading "cleaned = raw" wiring. This is a UX simplification (the toggle did nothing useful) plus a code cleanup.

**Files to modify:**
- `src/store/appStore.ts`
- `src/services/processingPipeline.ts` (the `commitMeeting` helper from Phase 1 still writes the column — drop it)
- `src/db/database.ts` (no change — the column stays, we just stop writing to it)
- `src/screens/MeetingScreen.tsx` (the synthetic meeting in `handleExport`)
- `src/screens/MeetingDetailScreen.tsx` (the toggle in `renderTranscriptTab`)

**Concrete changes:**

1. **`src/store/appStore.ts`**:
   - Remove `cleanedTranscript: ''` from `initial` (line 21 → drop, shift `currentLanguage` etc. accordingly).
   - Remove `cleanedTranscript: string` from `State` (line 21 → drop).
   - Change `setResults: (report: ReportData, summary: string[], cleanedTranscript: string) => void` → `setResults: (report: ReportData, summary: string[]) => void`.
   - Change `setResults` impl: `set({ report, summary, processingStepIndex: 2 })` — drop the `cleanedTranscript` write.
   - Update callers: `processingPipeline.ts` (in `runFullPipeline` and `retryFromFailedStep` branch 1) calls `setResults(result.report, result.summary)` — drop the third arg.

2. **`src/services/processingPipeline.ts`** — `commitMeeting`:
   - The `CommitInput` type drops `cleanedTranscript` (or, simpler, leaves it but ignores it). The call to `saveMeeting` in `commitMeeting` should not pass `cleanedTranscript` at all — let the DB column be `null` for new meetings. Old meetings that have a value keep it (no migration needed).
   - The `keepTranscriptOnly` path no longer needs `cleanedTranscript: rawTranscript` in its `commitMeeting` call.

3. **`src/screens/MeetingScreen.tsx`** — in `handleExport` (lines 85-94), drop `cleanedTranscript` from the synthetic meeting object. (Exporter never read it; this is a no-op behaviorally.)

4. **`src/screens/MeetingDetailScreen.tsx`** — in `renderTranscriptTab` (lines 285-320):
   - Delete the `showRaw` state (line 67) and the toggle row (lines 292-309).
   - Change the transcript to always show `meeting?.rawTranscript` (drop the `showRaw ? raw : cleaned` ternary).
   - Delete the `toggleRow`, `toggleChip`, `toggleChipActive`, `toggleText`, `toggleTextActive` styles.

**Code judo rationale:**
- The "cleaned" pipeline was theater: Gemini was told to clean, but its structured output schema didn't include a cleaned field, and we just returned the raw text under the "cleaned" name. The UI showed the same text under both tabs. Either rename the field to `rawTranscript` everywhere (and kill the dead toggle) or actually clean. Renaming is the lower-risk fix.
- Removing the toggle is a minor UX simplification: the user no longer sees a control that did nothing.

**Verification:**
- `grep -rn "cleanedTranscript" src/` — should match **only** the DB row converter in `database.ts` (which reads the existing column for legacy rows) and the DB column name itself. No matches in the store, in `commitMeeting`'s `saveMeeting` call, in `setResults`, or in the screens.
- `npx tsc --noEmit` — must pass.
- Manual smoke: open an old meeting in `MeetingDetailScreen` → Transcript tab — should show the raw text with no toggle. The transcript text matches what was previously labeled "Raw" (since "Cleaned" was the same text anyway).

**Risk note:** This is the only phase that touches user-visible behavior (the toggle disappears). The text shown is identical. Old meetings with non-null `cleanedTranscript` columns in the DB are unaffected; we just don't read or write the column for new meetings.

---

## Phase 7: Delete the dead listeners in `App.tsx`

**Goal:** Remove the two `useEffect` blocks in `MainScreen` that do nothing.

**Files to modify:**
- `App.tsx` (lines 53-58 and 60-75 only)

**Concrete changes:**

1. **Delete the focus-listener effect** (lines 53-58): the body of its callback is literally a comment saying "no action needed." The unsubscribe is what `useEffect` returns, so removing the whole effect is the right move.

2. **Delete the dead `onBackPress` function** (lines 62-68 inside the second `useEffect`): it's defined and never wired up. The actual hardware back behavior is the `beforeRemove` listener right below it. The first `useEffect` (lines 53-58) is also dead.

3. **Keep the `beforeRemove` listener** (lines 69-74). Update its `useEffect` to have a dep array of `[navigation]` (it currently depends on `activeTab` for no reason — `activeTab` isn't read inside the listener).

**Code judo rationale:**
- Dead code is misleading. A reviewer (or future-you) reading the `useEffect` sees "this does something" and is reluctant to delete it. Deleting the listener and the unused function makes the back-button story a single, obvious mechanism.

**Verification:**
- `grep -n "onBackPress\|focus" App.tsx` — should match only the `NavigationContainer`/tab logic, not the dead effects.
- `npx tsc --noEmit` — must pass.
- Manual smoke: launch the app, navigate to History, press the hardware back button — should snap back to Meeting tab (existing behavior, preserved). Press back again from Meeting tab — should not pop the root (the `beforeRemove` listener prevents this).

**Risk note:** Hardware back is platform-specific. Test on both Android and iOS if possible. The `beforeRemove` listener is the React Navigation recommended pattern — its semantics are unchanged.

**Hard constraints reminder:** Do not touch the `passcodeExists` block at line 107 — it's already correct.

---

## Phase 8: Split `MeetingScreen.tsx` into per-state files

**Goal:** Bring the 428-line file down to a router + five focused ~50-80 line files. The shared colors and base styles move to a co-located `theme.ts` so each state file imports named tokens.

**Files to modify:**
- **New folder:** `src/screens/MeetingScreen/`
- **New files inside it:** `index.tsx`, `FormState.tsx`, `ReadyState.tsx`, `RecordingState.tsx`, `ProcessingState.tsx`, `ResultsState.tsx`, `theme.ts`
- **Modified:** `src/screens/MeetingScreen.tsx` → becomes a thin re-export shim, or delete and update the one import in `App.tsx`
- `App.tsx` (the import path)

**Concrete changes:**

1. **Create `src/screens/MeetingScreen/theme.ts`**:
   ```ts
   export const theme = {
     bg: '#0f0f0f',
     surface: '#141414',
     text: '#f5f0eb',
     textMuted: '#8a7e72',
     accent: '#d4a574',
     accentSoft: 'rgba(212,165,116,0.15)',
     danger: '#ff4757',
     dangerSoft: 'rgba(255,71,87,0.1)',
     dangerBorder: 'rgba(255,71,87,0.2)',
     shadow: 'rgba(212,165,116,0.25)',
   } as const;
   ```
   The values match the existing inline hex strings.

2. **Create `src/screens/MeetingScreen/FormState.tsx`** — the FORM branch: title input, date label, "Create Meeting" button. Props: `{ onCreate: (title: string) => void }`. Internal `useState` for the input. Reads/writes nothing else. ~50 lines.

3. **Create `src/screens/MeetingScreen/ReadyState.tsx`** — the READY branch: the record button circle, the api-key banner, the "Upload Audio" and "Cancel" buttons. Props: `{ apiKeysReady, onStartRecording, onUpload, onCancel, onOpenSettings, navigation }`. ~80 lines.

4. **Create `src/screens/MeetingScreen/RecordingState.tsx`** — the RECORDING branch: the recording indicator, chunk counter, "End Meeting" + "Cancel Recording" buttons. Props: `{ chunkCount, currentChunkIndex, onStop, onCancel }`. ~40 lines.

5. **Create `src/screens/MeetingScreen/ProcessingState.tsx`** — the PROCESSING branch (handles both `error` and non-error subcases). Props: `{ stepLabel, error, hasTranscript, failedStepIndex, onRetry, onKeepTranscriptOnly, onCancel }`. Renders either the spinner+label or the error UI. ~70 lines.

6. **Create `src/screens/MeetingScreen/ResultsState.tsx`** — the RESULTS branch: the title, date, `getRenderableSections` renderer (from Phase 3), New Meeting / View in History / Export buttons. Props: `{ meetingTitle, meetingDate, report, summary, currentMeetingId, onReset, onViewInHistory, onExport }`. ~70 lines.

7. **Create `src/screens/MeetingScreen/index.tsx`** — the state router:
   ```tsx
   import { useAppStore } from '../../store/appStore';
   // ... all the existing controller hooks ...
   // ... reads appState, error, etc. ...
   // Returns: <ScreenShell noSafeArea><View style={{ flex: 1, gap: 16 }}><Text style={styles.title}>Meeting</Text>{switch (appState) ... }</View></ScreenShell>
   ```
   Each case is a single line: `{appState === 'FORM' && <FormState onCreate={...} />}` etc. ~100 lines.

8. **Update `App.tsx`** — change `import { MeetingScreen } from './src/screens/MeetingScreen';` to `import { MeetingScreen } from './src/screens/MeetingScreen';` (same path — the import is the same; `MeetingScreen/index.tsx` resolves to `MeetingScreen`). No change needed.

9. **Delete the old `src/screens/MeetingScreen.tsx`** — or convert it to a re-export: `export { MeetingScreen } from './MeetingScreen';` for safety. Cleaner: delete it and verify the import resolves correctly.

**Code judo rationale:**
- The original file is one function that branches on `appState` and returns one of six UIs. Each branch has its own concerns, its own styles, and a different prop surface. As a function it has to thread every piece of state into one big component. As separate files, each one takes the props it actually needs.
- The inline `{color: '#e8d5b7', fontSize: 28, fontWeight: '700'}` pattern appears 6+ times in the file. A named style (or a `theme.ts` token) deletes the magic-string duplication and catches typos.

**Verification:**
- `grep -c "color: '#" src/screens/MeetingScreen/` — only `theme.ts` should have hex colors.
- `wc -l src/screens/MeetingScreen/*.tsx` — none above ~100.
- `npx tsc --noEmit` — must pass.
- Manual smoke: walk through FORM → READY → RECORDING → PROCESSING → RESULTS, then test the error UI (trigger a Gemini failure) and the "Keep transcript only" path.

**Hard constraints reminder:** `useAppStore` import in the new `index.tsx` is fine (not a modification to the existing `MeetingScreen.tsx` import). The form/ready/etc. states each get their own import as needed.

**Risk note:** The risk is dropping a piece of state when slicing — e.g., forgetting to pass `navigation` into `ReadyState`. The `index.tsx` parent must read **all** the store slices and pass exactly what each child needs. The child files should not call `useAppStore` directly (except where truly needed) — keep them as pure functions of props, so the router owns the data plumbing.

---

## Phase 9 (optional): "Do later" cleanup

**Goal:** Address the items the review flagged as MINOR/NIT, in a single pass. None of these enable a blocker, but each is a 5-30 minute win.

**Files to modify:**
- `src/components/AudioPlayer.tsx` (state enum for playback)
- `src/db/database.ts` (warning log for `moveAudioToPermanentStorage` fallback; extract `purgeCacheByPrefix` helper)
- `src/services/uploader.ts` (use the `purgeCacheByPrefix` helper)
- `src/screens/MeetingDetailScreen.tsx` (collapse the double `getMeeting` call)
- **New file:** `src/services/ffmpegSplit.ts` (shared ffmpeg split helper, used by `uploader.ts`; **do not touch `recorder.ts` per the constraint**)
- `src/services/uploader.ts` (use the new ffmpeg split helper)
- (Optional) New file: `src/theme.ts` for global theme tokens consumed by `screens/MeetingScreen/theme.ts` etc.

**Concrete changes (one per item):**

1. **`AudioPlayer.hasStartedRef` → `playbackState` enum**:
   - Add `type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished'`.
   - Replace the `useRef<boolean>` with `useState<PlaybackState>('idle')`.
   - In the position listener's `isFinished` branch, set `setPlaybackState('finished')` and also set it to `'paused'` for the non-finished stop cases. `handlePlayPause` becomes a state-machine switch.
   - `handleSeek`'s guard becomes `if (playbackState === 'idle') return;`.
   - Delete `hasStartedRef.current = false` lines (3 of them). ~30 lines net change, but the state machine is explicit.

2. **`moveAudioToPermanentStorage` fallback warning**:
   - In `database.ts` line 319-330 (the fallback that scans for an existing audio file), add `console.warn('[moveAudioToPermanentStorage] no files moved from chunkPaths; falling back to dir scan');` before the scan.
   - Optionally change the return type to a discriminated union `{ kind: 'moved'; path } | { kind: 'recovered'; path } | { kind: 'empty' }` and update the one caller in `commitMeeting` (from Phase 1). The caller currently ignores the difference; the union lets future callers react.

3. **`MeetingDetailScreen` double `getMeeting` call**:
   - Move the initial-language logic (currently in the second `useEffect`, lines 87-97) into the `useFocusEffect` callback (lines 71-80). The `useFocusEffect` callback now does `setMeeting(m)`, `setEditedTitle(m.title)`, **and** `setCurrentLang(parsed.EN ? 'EN' : parsed.FR ? 'FR' : currentLang)`. Delete the second `useEffect`.
   - Note: this is now possible because `parseReports` is imported from `db/database` (from Phase 2).

4. **Extract `purgeCacheByPrefix(prefixes: string[])` helper** in `database.ts`:
   - Single implementation that does `RNFS.readDir(CachesDirectoryPath)` and unlinks entries whose `name` starts with any of the prefixes.
   - `cleanCacheTempFiles` (private, called from `cleanOrphanedAudioFiles`) calls `purgeCacheByPrefix(['meeting-recording-', 'chunks-', 'upload-chunks-'])`.
   - **`recorder.ts`'s `cleanTempFiles` is left alone** per the hard constraint. It uses the same pattern but with prefix list `['meeting-recording-', 'chunks-']` — duplication remains for recorder, but the new helper is in scope for future recorder updates.

5. **Extract `splitAudioWithFfmpeg(inputPath, outputDir, outputTemplate)` helper** in **new** `src/services/ffmpegSplit.ts`:
   - Pure ffmpeg invocation: probe duration, compute `numChunks` and `segmentDuration`, run ffmpeg with the same args, read the output dir, return the sorted `string[]` of chunk paths.
   - `uploader.ts:chunkExistingFile` (lines 87-184) calls this helper. The caller still owns the `outputDir` naming (`upload-chunks-${Date.now()}`) and the extension detection — the constraint "do not change path conventions" is preserved because uploader keeps its own paths.
   - **`recorder.ts:getChunkedAudioPaths` is left alone** per the hard constraint. Future work: replace it with a call to the new helper. The helper is in place when that work is unblocked.

6. **(Optional, larger) Global theme tokens**:
   - Skip if the user wants to defer — the per-state `theme.ts` from Phase 8 is the local version. A `src/theme.ts` would unify `AudioPlayer`'s colors, `ScreenShell`'s `#0f0f0f`, `exporter.ts`'s PDF CSS hex codes, etc. This is a wide-blast-radius change; leave it for a dedicated phase if needed.

**Code judo rationale:**
- Each of these is a single, contained refactor with a clear before/after. The `hasStartedRef` → enum is the most architectural: it converts a "manual state in a ref" into an explicit state machine that the type system documents.
- The ffmpeg-split and purge-cache extractions set up the codebase for a future "fix recorder.ts" PR — the helpers exist, the duplication is reduced, but the constraint-protected file is left untouched for now.

**Verification:**
- For (1): `grep -n "hasStartedRef" src/components/AudioPlayer.tsx` → zero matches.
- For (2): `grep -n "Falling back\|fallback" src/db/database.ts` → one match (the new warning).
- For (3): `grep -c "getMeeting" src/screens/MeetingDetailScreen.tsx` → 1.
- For (4): `grep -c "RNFS.readDir(CachesDirectoryPath)" src/db/database.ts src/services/uploader.ts` → 1 in `database.ts` (the new helper), 0 in `uploader.ts`.
- For (5): `grep -c "FFprobeKit.getMediaInformation" src/services/ffmpegSplit.ts src/services/uploader.ts` → 1 in `ffmpegSplit.ts` (the helper), 0 in `uploader.ts`.
- `npx tsc --noEmit` — must pass after each.
- Manual smoke: end-to-end record → process → save → open detail → export; trigger errors at each pipeline step; trigger an audio-move fallback by passing empty `chunkPaths` to `moveAudioToPermanentStorage` directly in a debug session.

**Risk note:** This phase is the easiest to skip if time is tight. Items 1, 3, and 5 are the highest value; 2 and 4 are "set up for future work" without immediate payoff. The user can pick any subset.

---

## Summary

| Phase | Lines deleted (approx) | Behavior change | Risk |
|-------|------------------------|-----------------|------|
| 1     | ~80                    | None            | Low — single file, comprehensive verification |
| 2     | ~40                    | None            | Trivial — pure move of a helper |
| 3     | ~250                   | None            | Medium — wide blast radius; smoke test all four sinks |
| 4     | ~5                     | None            | Trivial — type-level change that fixes a real bug |
| 5     | ~10                    | Faster (same output) | Low — manual smoke confirms identical transcripts |
| 6     | ~30                    | Toggle removed  | Low — same text shown, just no longer swappable |
| 7     | ~10                    | None            | Trivial — pure deletion |
| 8     | ~200 (split across files) | None         | Medium — easy to drop state during slicing; verify by walking all six branches |
| 9     | ~50                    | None (optional) | Low per item, but many small touches — gate by item |

**Total: ~675 lines of code deleted, 1 bug fixed, 1 compile error fixed, 4 near-duplicate orchestrations collapsed, 4 enumeration sites unified.**

Run `npx tsc --noEmit` after each phase. Commit after each phase with a tight message ("Phase 1: collapse pipeline save-blocks and fix uploader isCancel"). The phases are independently shippable — if a phase proves riskier than expected, the previous phases are still in good shape.
