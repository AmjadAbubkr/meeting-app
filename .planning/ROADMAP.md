# Roadmap: Meeting App

## Overview

Transform the Meeting App from a scaffolded skeleton into a fully functional meeting recording, transcription, and report generation tool. The journey starts with real audio recording, progresses through API integration for transcription and report generation, adds persistent storage, and finishes with export capabilities.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Audio Recording** - Real audio recording and upload with chunking
- [ ] **Phase 2: Transcription** - Groq Whisper API integration for audio-to-text
- [ ] **Phase 3: Report Generation** - Gemini API integration for bilingual reports
- [ ] **Phase 4: Data Persistence** - SQLite storage replacing in-memory Map
- [ ] **Phase 5: Export & Sharing** - PDF/DOCX export and Android share sheet

## Phase Details

### Phase 1: Audio Recording
**Goal**: User can record meeting audio with real-time chunking, or upload existing audio files, with all recording states properly handled in the UI
**Depends on**: Nothing (first phase)
**Requirements**: [AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06]
**Success Criteria** (what must be TRUE):
1. User can tap to start recording, see recording state, and tap to stop
2. Audio is chunked at 20 MB boundaries during recording
3. User can upload an audio file and it gets chunked
4. Recording state is clearly displayed in the UI
5. User can cancel a recording and discard audio
**Plans**: 3 plans

**Wave 1** *(no dependencies)*
- [ ] 01-01-PLAN.md — Audio recording service and chunking logic

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — Upload flow with file picker and chunking

**Wave 3** *(blocked on Wave 1 + Wave 2 completion)*
- [ ] 01-03-PLAN.md — Recording UI with state display and cancel

**Cross-cutting constraints:**
- src/store/appStore.ts is modified in all 3 plans (sequential store augmentation)
- All plans reference CHUNK_SIZE_BYTES from src/config.ts

### Phase 2: Transcription
**Goal**: Audio chunks are sent to Groq Whisper API and concatenated into a full transcript with progress display
**Depends on**: Phase 1
**Requirements**: [TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05]
**Success Criteria** (what must be TRUE):
1. Each audio chunk is sent to Groq Whisper and returns text
2. User sees chunk-by-chunk progress during transcription
3. Partial transcripts are concatenated into a complete raw transcript
4. Missing API key shows a clear error, not a crash
5. Empty or invalid audio chunks are handled gracefully
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Groq Whisper API client with chunked transcription
- [ ] 02-02-PLAN.md — Transcription progress UI and error handling

### Phase 3: Report Generation
**Goal**: Raw transcript is processed by Gemini into a cleaned transcript, bilingual reports, and bilingual summaries
**Depends on**: Phase 2
**Requirements**: [RPT-01, RPT-02, RPT-03, RPT-04, RPT-05]
**Success Criteria** (what must be TRUE):
1. Gemini receives raw transcript and returns cleaned transcript + 4 report variants
2. User can select output language (EN or FR) before generation
3. Reports and summaries are stored in the app state
4. Missing API key shows a clear error, not a crash
5. Empty transcript is rejected with clear error message
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Gemini API client with report generation
- [ ] 03-02-PLAN.md — Language selection UI and results display

### Phase 4: Data Persistence
**Goal**: Meeting records are stored in SQLite and persist across app restarts, with full meeting detail view
**Depends on**: Phase 3
**Requirements**: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05]
**Success Criteria** (what must be TRUE):
1. Meeting records survive app kill and restart
2. History screen shows all meetings sorted by date
3. User can tap a meeting to see full transcript and reports
4. Database initializes on app launch
5. All meeting fields (title, date, transcript, EN/FR reports/summaries) are persisted
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — SQLite database layer replacing in-memory Map
- [ ] 04-02-PLAN.md — Meeting detail screen and history enhancements

### Phase 5: Export & Sharing
**Goal**: User can export reports as PDF or DOCX and share via Android share sheet
**Depends on**: Phase 4
**Requirements**: [EXPT-01, EXPT-02, EXPT-03, EXPT-04]
**Success Criteria** (what must be TRUE):
1. User can generate a PDF file from a meeting report
2. User can generate a DOCX file from a meeting report
3. Exported files are saved to device with meaningful filenames (meeting title + date)
4. User can share files via Android's share sheet
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — PDF and DOCX export implementation
- [ ] 05-02-PLAN.md — Share sheet integration and export UI

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Recording | 0/3 | Planned | - |
| 2. Transcription | 0/2 | Not started | - |
| 3. Report Generation | 0/2 | Not started | - |
| 4. Data Persistence | 0/2 | Not started | - |
| 5. Export & Sharing | 0/2 | Not started | - |
