# Roadmap: Meeting App

## Overview

Transform the Meeting App from a scaffolded skeleton into a fully functional meeting recording, transcription, and report generation tool. The journey starts with data persistence and API key management, progresses through real audio recording and API integration, adds history with audio playback, and finishes with export capabilities. A Settings screen and mandatory API key setup gate are woven in.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Audio Recording** - Real audio recording and upload with chunking ✅
- [x] **Phase 2: Transcription** - Groq Whisper API integration for audio-to-text ✅
- [x] **Phase 3: Report Generation** - Gemini API integration for bilingual reports with JSON schema ✅
- [x] **Phase 4: Data Persistence & Settings** - SQLite storage, Settings screen, API key management, mandatory setup gate ✅
- [ ] **Phase 5: History & Meeting Detail** - Full history with grouped list, search, meeting detail with tabs (Report/Transcript/Audio), audio playback, language switcher
- [ ] **Phase 6: Export & Sharing** - PDF/DOCX export to Downloads, share sheet

## Phase Details

### Phase 1: Audio Recording
**Goal**: User can record meeting audio (AAC/M4A), or upload existing audio files, with chunking at 20MB boundaries. Recording uses `react-native-audio-recorder-player`. Permissions requested on app launch. Screen kept awake during recording. Portrait-only.
**Depends on**: Nothing (first phase)
**Requirements**: [AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06]
**Success Criteria** (what must be TRUE):
1. User can tap to start recording, see recording state, and tap to stop
2. Audio saved as M4A in internal files directory (`meeting-audio/{meetingId}.m4a`)
3. User can upload an audio file (via `react-native-document-picker`) and it gets validated (format + size)
4. Files under 20MB sent as-is; over 20MB split via `react-native-ffmpeg`
5. Recording state is clearly displayed in the UI with cancel option
6. Screen stays awake during recording via `react-native-keep-awake`
7. Microphone permission requested on app launch
**Plans**: 3 plans

**Wave 1** *(no dependencies)*
- [x] 01-01-PLAN.md — Audio recording service and chunking logic ✅ (2026-06-03)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Upload flow with file picker and chunking ✅ (2026-06-03)

**Wave 3** *(blocked on Wave 1 + Wave 2 completion)*
- [x] 01-03-PLAN.md — Recording UI with state display and cancel ✅ (2026-06-03)

### Phase 2: Transcription
**Goal**: Audio chunks are sent to Groq Whisper API (`whisper-large-v3-turbo`) with language hint and `verbose_json` response format. Chunk-by-chunk progress displayed. Step-level error handling with retry.
**Depends on**: Phase 1
**Requirements**: [TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05]
**Success Criteria** (what must be TRUE):
1. Each audio chunk is sent to Groq Whisper and returns verbose_json with timestamped segments
2. User sees chunk-by-chunk progress during transcription (simple spinner with step labels)
3. Partial transcripts are concatenated into a complete raw transcript
4. Missing API key shows a clear error, not a crash
5. Empty or invalid audio chunks are handled gracefully
6. Language hint is sent matching user's default language setting
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Groq Whisper API client with chunked transcription ✅ (2026-06-03)
- [x] 02-02-PLAN.md — Transcription progress UI and error handling ✅ (2026-06-03)

### Phase 3: Report Generation
**Goal**: Raw transcript is processed by Gemini (`gemini-2.0-flash`, fallback `gemini-1.5-flash`) into a cleaned transcript, structured report (JSON schema), and executive summary. Default language generated immediately; other languages on-demand only.
**Depends on**: Phase 2
**Requirements**: [RPT-01, RPT-02, RPT-03, RPT-04, RPT-05]
**Success Criteria** (what must be TRUE):
1. Gemini receives raw transcript and returns JSON: {report: {overview, keyDiscussionPoints, actionItems, decisionsMade, openQuestions}, summary: [bullets]}
2. Default language report generated immediately after transcription
3. Other languages generated on-demand when user switches in Report tab
4. Sections not mentioned in transcript are omitted (no fabrication)
5. Missing API key shows a clear error, not a crash
6. Empty transcript is rejected with clear error message
7. Processing auto-advances to RESULTS on completion
8. Error state provides step-level retry with partial save option
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Gemini API client with JSON schema report generation ✅ (2026-06-03)
- [x] 03-02-PLAN.md — Processing flow, auto-advance, error states, and on-demand language generation ✅ (2026-06-03)

### Phase 4: Data Persistence & Settings
**Goal**: Meeting records stored in SQLite via `op-sqlite` with JSON `reports` column. Settings screen with default language, API key management (masked inputs, Keychain storage, test connection), passcode change, clear all data, storage info, about. Mandatory `ApiKeySetupScreen` between Passcode and Main on first launch. `react-native-config` removed.
**Depends on**: Phase 3
**Requirements**: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06]
**Success Criteria** (what must be TRUE):
1. Meeting records persist in SQLite across app restarts
2. Database schema: `meetings` table (id, title, date, rawTranscript, cleanedTranscript, reports JSON, audioPath, createdAt) and `settings` table (key, value)
3. `ApiKeySetupScreen` — mandatory on first launch, no skip until both keys provided
4. API keys stored in Keychain (masked inputs, test connection buttons)
5. Settings screen: language picker, API key management, change passcode, clear all data, storage info, about
6. App checks Keychain for keys before allowing recording; blocks recording if missing
7. `react-native-config` removed from project
8. Orphaned audio files cleaned on app open
9. History screen shows meetings sorted by date
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — SQLite database layer with op-sqlite replacing in-memory Map ✅ (2026-06-03)
- [x] 04-02-PLAN.md — ApiKeySetupScreen and Keychain-based API key management ✅ (2026-06-03)
- [x] 04-03-PLAN.md — Settings screen (language, passcode, clear data, storage, about) ✅ (2026-06-03)

### Phase 5: History & Meeting Detail
**Goal**: Full meeting history with date grouping (Today/Yesterday/This Week/Earlier) and title search. MeetingDetail screen with 3 tabs: Report (structured sections + executive summary + language switcher), Transcript (cleaned by default, raw toggle), Audio (play/pause + seek + speed control). Delete from detail with confirmation. Editable meeting title.
**Depends on**: Phase 4
**Requirements**: [HIST-01, HIST-02, HIST-03, HIST-04, HIST-05, HIST-06, HIST-07, HIST-08]
**Success Criteria** (what must be TRUE):
1. History grouped by date with search by title
2. Tapping a meeting opens MeetingDetail with 3 tabs
3. Report tab renders structured JSON sections with language switcher (EN|FR)
4. Switching to ungenerated language triggers on-demand Gemini call with spinner + retry on failure
5. Transcript tab shows cleaned transcript by default with raw toggle
6. Audio tab has play/pause, seek bar, speed control (1x, 1.5x, 2x)
7. Meeting title is editable from detail header
8. Delete from detail with confirmation dialog (deletes DB record + audio file)
**Plans**: 1 plan (consolidated)

Plans:
- [x] 05-01-PLAN.md — History screen with date grouping, MeetingDetail with 3 tabs, AudioPlayer ✅ (2026-06-03)

### Phase 6: Export & Sharing
**Goal**: User can export reports as PDF (`react-native-html-to-pdf`) or DOCX (`docx` library). Files saved to device Downloads (Android 10+). Share icon in MeetingDetail header opens bottom sheet with export options.
**Depends on**: Phase 5
**Requirements**: [EXPT-01, EXPT-02, EXPT-03, EXPT-04]
**Success Criteria** (what must be TRUE):
1. User can generate a PDF file from a meeting report
2. User can generate a DOCX file from a meeting report
3. Exported files are saved to device Downloads directory with meaningful filenames
4. Share icon in MeetingDetail header opens bottom sheet: Export as PDF | Export as DOCX | Share text
5. Post-results screen offers View in History, Export, and New Meeting
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — PDF and DOCX export implementation ✅ (2026-06-03)
- [x] 06-02-PLAN.md — Share sheet integration, export bottom sheet, and post-results actions ✅ (2026-06-03, absorbed by 06-01)

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Recording | 3/3 | Complete | 2026-06-03 |
| 2. Transcription | 2/2 | Complete | 2026-06-03 |
| 3. Report Generation | 2/2 | Complete | 2026-06-03 |
| 4. Data Persistence & Settings | 3/3 | Complete | 2026-06-03 |
| 5. History & Meeting Detail | 1/1 | Complete | 2026-06-03 |
| 6. Export & Sharing | 2/2 | Complete | 2026-06-03 |
