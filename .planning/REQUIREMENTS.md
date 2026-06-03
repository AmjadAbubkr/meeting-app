# Requirements: Meeting App

**Defined:** 2026-06-03
**Core Value:** Record a meeting, get a structured bilingual report — from audio to actionable document in one tap

## v1 Requirements

### Audio Recording

- [ ] **AUDIO-01**: User can record meeting audio with start/stop controls
- [ ] **AUDIO-02**: Audio is chunked in real-time at 20 MB boundaries during recording
- [ ] **AUDIO-03**: User can upload existing audio files (mp3, mp4, wav, m4a, webm)
- [ ] **AUDIO-04**: Uploaded files are chunked at 20 MB boundaries
- [ ] **AUDIO-05**: Recording state (idle, recording, paused) is clearly displayed
- [ ] **AUDIO-06**: User can cancel a recording and discard audio

### Transcription

- [ ] **TRANS-01**: Each audio chunk is sent to Groq Whisper API for transcription
- [ ] **TRANS-02**: Chunk-by-chunk progress is displayed during transcription
- [ ] **TRANS-03**: Partial transcripts are concatenated into a full raw transcript
- [ ] **TRANS-04**: Missing or invalid Groq API key shows clear error message
- [ ] **TRANS-05**: Empty audio chunks are skipped gracefully

### Report Generation

- [ ] **RPT-01**: Raw transcript is sent to Gemini API for processing
- [ ] **RPT-02**: Gemini returns cleaned transcript, EN report, EN summary, FR report, FR summary
- [ ] **RPT-03**: User can select output language (EN or FR) before generation
- [ ] **RPT-04**: Missing or invalid Gemini API key shows clear error message
- [ ] **RPT-05**: Empty transcript is rejected with clear error message

### Data Persistence

- [ ] **DATA-01**: Meeting records persist in SQLite across app restarts
- [ ] **DATA-02**: User can view list of all saved meetings sorted by date
- [ ] **DATA-03**: User can tap a meeting to view its full details (transcript, reports, summaries)
- [ ] **DATA-04**: Meeting record includes title, date, transcript, EN/FR reports and summaries
- [ ] **DATA-05**: Database is initialized on app launch

### Export & Sharing

- [ ] **EXPT-01**: User can export a meeting report as PDF
- [ ] **EXPT-02**: User can export a meeting report as DOCX
- [ ] **EXPT-03**: Exported files are saved to device storage with meaningful filenames
- [ ] **EXPT-04**: User can share exported files via Android share sheet

### Authentication

- [ ] **AUTH-01**: App requires 6-digit passcode on launch
- [ ] **AUTH-02**: User can set up passcode on first launch
- [ ] **AUTH-03**: Too many failed attempts trigger a cooldown

## v2 Requirements

### Enhancements

- **ENH-01**: User can edit meeting title after creation
- **ENH-02**: User can delete meeting records
- **ENH-03**: User can search meetings by title
- **ENH-04**: User can re-generate reports with different language selection

## Out of Scope

| Feature | Reason |
|---------|--------|
| iOS build | Requires Mac + Xcode, not in v1 scope |
| Cloud sync | Local-only for v1, no backend |
| Real-time streaming transcription | Groq API is batch-only |
| Calendar integration | Deferred, not core value |
| Multi-user support | Single-user app |
| Audio playback | Not core to report generation workflow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | Phase 1 | Pending |
| AUDIO-02 | Phase 1 | Pending |
| AUDIO-03 | Phase 1 | Pending |
| AUDIO-04 | Phase 1 | Pending |
| AUDIO-05 | Phase 1 | Pending |
| AUDIO-06 | Phase 1 | Pending |
| TRANS-01 | Phase 2 | Pending |
| TRANS-02 | Phase 2 | Pending |
| TRANS-03 | Phase 2 | Pending |
| TRANS-04 | Phase 2 | Pending |
| TRANS-05 | Phase 2 | Pending |
| RPT-01 | Phase 3 | Pending |
| RPT-02 | Phase 3 | Pending |
| RPT-03 | Phase 3 | Pending |
| RPT-04 | Phase 3 | Pending |
| RPT-05 | Phase 3 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |
| DATA-05 | Phase 4 | Pending |
| EXPT-01 | Phase 5 | Pending |
| EXPT-02 | Phase 5 | Pending |
| EXPT-03 | Phase 5 | Pending |
| EXPT-04 | Phase 5 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after initial definition*
