# Meeting App — Implementation Plan

## Overview

Go from skeleton to a fully functioning React Native Android app: real audio recording, Groq transcription, Gemini report generation, SQLite persistence, History with audio playback, DOCX+PDF export, Settings, and API key management.

---

## Architecture Decisions (62 Resolved)

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Plan scope | Skeleton → functioning app |
| 2 | Recording vs upload priority | Recording first, upload second |
| 3 | Recording library | `react-native-audio-recorder-player` |
| 4 | Recording strategy | Record-to-file then chunk |
| 5 | Audio format | AAC/M4A |
| 6 | Permission timing | On app launch |
| 7 | Keep raw audio | Yes, for playback in History |
| 8 | Audio storage location | Internal files directory, `meeting-audio/{meetingId}.m4a` |
| 9 | Chunking strategy | As-is if <20MB, FFmpeg split if over |
| 10 | Database | `op-sqlite` |
| 11 | Schema — reports column | JSON `reports` column (`{"EN": {"report": "...", "summary": "..."}, "FR": {...}}`) |
| 12 | Report generation timing | Default language immediately, others on-demand only |
| 13 | Settings persistence | SQLite `settings` table (key TEXT, value TEXT) |
| 14 | Processing flow | Auto-advance to RESULTS on completion |
| 15 | Error handling | Step-level retry with partial save |
| 16 | History tap behavior | MeetingDetail screen with tabbed sections |
| 17 | Tab structure | Report \| Transcript \| Audio (3 tabs) |
| 18 | Audio player capabilities | Play/pause + seek bar + speed control (1x, 1.5x, 2x) |
| 19 | Delete meetings | From MeetingDetail with confirmation dialog |
| 20 | Export formats | DOCX + PDF |
| 21 | PDF library | `react-native-html-to-pdf` |
| 22 | Export trigger | Share icon in MeetingDetail header → bottom sheet |
| 23 | Export destination | Save to device Downloads (ignore Android < 10) |
| 24 | Passcode hashing | Keep as-is (Keychain is sufficient) |
| 25 | Passcode lockout | No real enforcement |
| 26 | Groq transcription model | `whisper-large-v3-turbo`, language hint, `verbose_json` |
| 27 | Gemini model | `gemini-2.0-flash`, fallback `gemini-1.5-flash` |
| 28 | Report structure | LLM-inferred structured sections, omit if not mentioned |
| 29 | Gemini response format | JSON schema |
| 30 | Processing progress | Simple spinner with step labels |
| 31 | Background kill during processing | Accept loss, clean orphaned files on app open |
| 32 | Settings contents | Language + passcode + clear data + storage info + API keys + about |
| 33 | API key input | Masked inputs, Keychain storage, test connection button |
| 34 | API key source | User-provided only, remove `react-native-config` |
| 35 | CI updates | Remove `.env` step, update README, remove `react-native-config` from package.json |
| 36 | No API keys state | Mandatory setup on first launch, no skip until both keys provided |
| 37 | Setup screen position | Between Passcode and Main (dedicated `ApiKeySetupScreen`) |
| 38 | Clearing keys | Allow clearing, block recording until re-entered |
| 39 | Upload in v1 | Yes |
| 40 | Document picker | `react-native-document-picker` |
| 41 | Upload validation | Format + size, warn at 500MB+ |
| 42 | History search | Title only |
| 43 | History pagination | None, load all |
| 44 | Audio tab content | Player only, no transcript |
| 45 | Transcript display | Cleaned by default, raw toggle |
| 46 | Report rendering | Formatted sections from JSON |
| 47 | Language switcher | In Report tab header, segmented control |
| 48 | On-demand generation failure | Inline error + retry |
| 49 | Summary placement | Merged into Report tab (3 tabs total) |
| 50 | Edit meeting title | Yes, from MeetingDetail header |
| 51 | Edit transcript/report | No, read-only in v1 |
| 52 | Android SDK | minSdk 24, targetSdk 34 |
| 53 | RN architecture | Old architecture |
| 54 | TypeScript strict | Yes |
| 55 | Linting | Add ESLint + @typescript-eslint/eslint-plugin |
| 56 | Testing | Unit tests for services + store (~20-30 test cases) |
| 57 | index.js | Leave as standard RN bootstrap |
| 58 | Orientation | Portrait only |
| 59 | Screen awake | Yes, during recording (`react-native-keep-awake`) |
| 60 | Post-results actions | View in History, Export, New Meeting |
| 61 | Dependencies | Add 6, remove 1 (see below) |
| 62 | Navigation | Passcode → ApiKeySetup → Tabs (Meeting, History+Detail, Settings) |

---

## Navigation Structure

```
Stack Navigator
├── PasscodeScreen (setup or entry)
├── ApiKeySetupScreen (mandatory on first launch, no skip)
└── MainTabs (Bottom Tab Navigator)
    ├── Meeting (MeetingScreen)
    ├── History (HistoryScreen → MeetingDetailScreen)
    └── Settings (SettingsScreen)
```

---

## Database Schema

### `meetings` table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| title | TEXT NOT NULL | Meeting title |
| date | TEXT NOT NULL | Display date string |
| rawTranscript | TEXT | Raw Whisper output |
| cleanedTranscript | TEXT | LLM-cleaned transcript |
| reports | TEXT | JSON: `{"EN": {"report": {...}, "summary": [...]}, "FR": {...}}` |
| audioPath | TEXT | Path to `meeting-audio/{id}.m4a` |
| createdAt | TEXT | ISO timestamp for sorting/grouping |

### `settings` table

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | e.g. "defaultLanguage", "groqApiKey", "geminiApiKey" |
| value | TEXT NOT NULL | Stored value |

---

## Dependencies

### Add

| Package | Purpose |
|---------|---------|
| `react-native-audio-recorder-player` | Recording + playback |
| `op-sqlite` | SQLite database |
| `react-native-document-picker` | File upload picker |
| `react-native-ffmpeg` | Chunking long audio files |
| `react-native-html-to-pdf` | PDF export |
| `react-native-keep-awake` | Prevent sleep during recording |

### Remove

| Package | Reason |
|---------|--------|
| `react-native-config` | API keys now user-provided at runtime, no build-time .env |

### Keep (existing)

`@react-navigation/bottom-tabs`, `@react-navigation/native`, `@react-navigation/native-stack`, `docx`, `react-native-gesture-handler`, `react-native-keychain`, `react-native-modal`, `react-native-safe-area-context`, `react-native-screens`, `zustand`

---

## Feature Breakdown

### 1. Audio Recording (MeetingScreen)

- Request `RECORD_AUDIO` permission on app launch
- Tap MIC button → start recording via `react-native-audio-recorder-player` in AAC/M4A format
- Save to internal files directory: `meeting-audio/{meetingId}.m4a`
- Keep screen awake during recording via `react-native-keep-awake`
- "End Meeting" → stop recording → transition to PROCESSING state
- Lock orientation to portrait

### 2. Audio Upload (MeetingScreen)

- "Upload Audio" button → `react-native-document-picker` filtered to audio MIME types
- Validate file extension against `SUPPORTED_AUDIO_FORMATS`
- Validate file size — warn if >500MB
- Selected file enters the same transcription pipeline as recorded audio

### 3. Audio Chunking

- If audio file < 20MB (`CHUNK_SIZE_BYTES`): send as-is to Groq
- If > 20MB: split into valid M4A segments using `react-native-ffmpeg`
- Cannot byte-split M4A (container format — would corrupt)

### 4. Transcription (transcriber.ts)

- Call Groq Whisper API (`whisper-large-v3-turbo`) with:
  - Language hint = user's default language
  - Response format = `verbose_json` (timestamped segments)
  - Multipart form-data POST with audio file
- Progress: "Transcribing audio..." (show chunk count if >1)
- On failure: error state with retry button (keep audio file)

### 5. Report Generation (generator.ts)

- After transcription completes, call Gemini (`gemini-2.0-flash`, fallback `gemini-1.5-flash`)
- Generate **default language** report immediately
- JSON schema output:
  ```json
  {
    "report": {
      "overview": "...",
      "keyDiscussionPoints": ["..."],
      "actionItems": ["..."],
      "decisionsMade": ["..."],
      "openQuestions": ["..."]
    },
    "summary": ["bullet 1", "bullet 2", "bullet 3"]
  }
  ```
- Omit sections not mentioned in transcript (don't fabricate)
- On failure: save transcript, show error with retry. User can also "Keep transcript only"
- Other languages generated on-demand when user switches in Report tab

### 6. Persistence (database.ts)

- Replace in-memory Map with `op-sqlite`
- `meetings` table (schema above)
- `settings` table (key-value)
- Queries: create, update, get by id, get all (sorted by createdAt desc), delete
- On app open: clean orphaned audio files (file exists with no DB record → delete)

### 7. Settings Screen (new tab)

- **Default language**: EN/FR picker → persists to `settings` table
- **API keys**: Groq + Gemini, masked inputs, stored in Keychain
  - "Test connection" button (trivial API call to verify key)
  - Can clear keys → blocks recording until re-entered
- **Change passcode**: current PIN → new PIN → confirm
- **Clear all data**: deletes all meetings, audio files, resets DB. Confirmation dialog.
- **Storage info**: calculate total audio file size, display "X.X GB used by N meetings"
- **About**: app version, build info

### 8. API Key Setup (ApiKeySetupScreen)

- Mandatory screen between Passcode and Main on first launch
- No skip button — both keys required to proceed
- Masked inputs for Groq API key and Gemini API key
- "Test connection" buttons for each
- Once both verified → save to Keychain → navigate to Main
- On subsequent launches: if keys exist in Keychain, skip this screen

### 9. History Screen

- Grouped by date: Today, Yesterday, This Week, Earlier
- Search bar: filter by title only
- Tapping a meeting → navigate to MeetingDetailScreen
- FlatList, no pagination

### 10. Meeting Detail Screen (new)

- **Header**: meeting title (tappable to edit), share/export icon
- **Report tab**:
  - Executive summary bullets at top
  - Structured sections below (overview, key points, action items, decisions, open questions)
  - Language switcher in header (segmented: EN | FR)
  - Switching to ungenerated language → spinner + on-demand Gemini call → cache to DB
  - On-demand failure → inline error + retry
- **Transcript tab**:
  - Cleaned transcript by default
  - Toggle to view raw transcript
- **Audio tab**:
  - Audio player: play/pause, seek bar, speed control (1x, 1.5x, 2x)
  - Uses `react-native-audio-recorder-player` playback API
- **Delete**: button in header area → confirmation dialog → deletes DB record + audio file
- **Export**: share icon → bottom sheet: "Export as PDF | Export as DOCX | Share text"
  - PDF: generate HTML → `react-native-html-to-pdf`
  - DOCX: generate via `docx` library
  - Both save to device Downloads directory (Android 10+)
  - Share text: React Native `Share` API

### 11. Processing Flow

- RECORDING → user taps "End Meeting" → PROCESSING
- Processing steps (auto-advance, no user action needed):
  1. "Transcribing audio..." (with chunk progress if >1 chunk)
  2. "Generating report..." (default language)
  3. "Saving meeting..."
- On completion: auto-navigate to RESULTS
- RESULTS screen: "View in History" | "Export" | "New Meeting"
- On failure at any step: error state with step-level retry + "Keep partial" option

### 12. CI / Build Updates

- Remove `.env` creation step from `.github/workflows/build.yml`
- Remove `GROQ_API_KEY` and `GEMINI_API_KEY` from required GitHub secrets in README
- Keep keystore signing secrets and steps intact
- Remove `react-native-config` from `package.json`

---

## Implementation Order

1. **Database + Settings persistence** — `op-sqlite`, schema, settings table, replace in-memory Map
2. **API key management** — Keychain storage, ApiKeySetupScreen, Settings API key inputs
3. **Audio recording** — permissions, `react-native-audio-recorder-player`, M4A recording, keep-awake
4. **Transcription pipeline** — real Groq API calls, chunking (FFmpeg for large files), error handling
5. **Report generation pipeline** — real Gemini API calls, JSON schema, on-demand language generation
6. **Processing flow** — auto-advance, step labels, error states with retry
7. **History + MeetingDetail** — grouped list, search, detail screen with 3 tabs, audio player, language switcher
8. **Export** — DOCX via `docx`, PDF via `react-native-html-to-pdf`, Downloads save, share sheet
9. **Audio upload** — document picker, validation, merge into transcription pipeline
10. **Settings screen** — language, passcode change, clear data, storage info, about
11. **CI cleanup** — remove `.env` step, update README, remove `react-native-config`
12. **Lint + Tests** — ESLint config, unit tests for services and store

---

## Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| No API keys | Block recording, show banner to configure in Settings |
| Transcription fails | Error state: "Transcription failed — [reason]. [Retry] [Keep transcript only]" (no transcript to keep if this is first step — retry only) |
| Report generation fails | Save transcript, error state: "Generation failed — [reason]. [Retry] [Keep transcript only]" |
| On-demand language gen fails | Inline error in Report tab: "Failed to generate [LANG] report. [Retry]" |
| App killed during processing | Accept loss. Clean orphaned audio files on next app open. |
| Permission denied | Show Alert with explanation + "Open Settings" button |
| File upload format invalid | Alert: "Unsupported format. Supported: mp3, mp4, wav, m4a, webm" |
| File upload >500MB | Warning: "This file is large and may take several minutes. Continue?" |

---

## Key Files to Create/Modify

### New files
- `src/screens/ApiKeySetupScreen.tsx`
- `src/screens/MeetingDetailScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/AudioPlayer.tsx`
- `src/components/ExportSheet.tsx`
- `src/components/ProcessingView.tsx`
- `src/components/ReportView.tsx`
- `src/components/TranscriptView.tsx`
- `src/components/LanguageSwitcher.tsx`

### Modify existing
- `src/db/database.ts` — replace Map with `op-sqlite`
- `src/services/transcriber.ts` — real Groq API calls
- `src/services/generator.ts` — real Gemini API calls with JSON schema
- `src/services/exporter.ts` — real DOCX + PDF generation
- `src/services/passcode.ts` — keep as-is
- `src/store/appStore.ts` — add API key state, error state, processing step tracking
- `src/screens/MeetingScreen.tsx` — real recording flow, upload flow, processing flow
- `src/screens/HistoryScreen.tsx` — grouped list, search, navigation to detail
- `src/screens/PasscodeScreen.tsx` — navigate to ApiKeySetupScreen after auth
- `src/config.ts` — remove `react-native-config` imports, keep constants
- `App.tsx` — add ApiKeySetupScreen to stack, Settings tab
- `.github/workflows/build.yml` — remove `.env` step
- `README.md` — remove API key secret references
- `package.json` — add new deps, remove `react-native-config`

---

## Testing Plan

- Unit tests for `transcriber.ts` (mock Groq API)
- Unit tests for `generator.ts` (mock Gemini API)
- Unit tests for `exporter.ts` (mock file system)
- Unit tests for `passcode.ts` (mock Keychain)
- Unit tests for `appStore.ts` (state transitions, reset, chunk management)
- Unit tests for `database.ts` (CRUD operations, in-memory op-sqlite mock)
- ~20-30 test cases total
- No component tests in v1 — manual UI verification

---

*Generated from 62-question grilling session on 2026-06-03*
