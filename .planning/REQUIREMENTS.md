# Requirements: Meeting App
**Defined:** 2026-06-03
**Core Value:** Record a meeting, get a structured bilingual report — from audio to actionable document in one tap

## v1 Requirements

### Audio Recording

- [x] **AUDIO-01**: User can record meeting audio (AAC/M4A) with start/stop controls via `react-native-audio-recorder-player`
- [x] **AUDIO-02**: Audio files under 20MB sent as-is; over 20MB split via `react-native-ffmpeg` into valid M4A segments
- [x] **AUDIO-03**: User can upload existing audio files (mp3, mp4, wav, m4a, webm) via `react-native-document-picker`
- [x] **AUDIO-04**: Uploaded files validated (format + size, warn at 500MB+)
- [x] **AUDIO-05**: Recording state clearly displayed; screen kept awake during recording; portrait-only
- [x] **AUDIO-06**: User can cancel a recording and discard audio
- [ ] **AUDIO-07**: Microphone permission requested on app launch
- [ ] **AUDIO-08**: Audio saved to internal files directory as `meeting-audio/{meetingId}.m4a`

### Transcription

- [x] **TRANS-01**: Each audio chunk sent to Groq Whisper API (`whisper-large-v3-turbo`) with language hint
- [x] **TRANS-02**: Response format is `verbose_json` (timestamped segments); chunk progress displayed
- [x] **TRANS-03**: Partial transcripts concatenated into a complete raw transcript
- [x] **TRANS-04**: Missing or invalid Groq API key shows clear error message
- [x] **TRANS-05**: Empty audio chunks skipped gracefully

### Report Generation

- [x] **RPT-01**: Raw transcript sent to Gemini API (`gemini-2.0-flash`, fallback `gemini-1.5-flash`)
- [x] **RPT-02**: Gemini returns JSON schema: {report: {overview, keyDiscussionPoints, actionItems, decisionsMade, openQuestions}, summary: [bullets]}; sections omitted if not mentioned
- [x] **RPT-03**: Default language report generated immediately after transcription; other languages on-demand only
- [x] **RPT-04**: Missing or invalid Gemini API key shows clear error message
- [x] **RPT-05**: Empty transcript rejected with clear error message
- [x] **RPT-06**: Processing auto-advances to RESULTS on completion; error state provides step-level retry with partial save

### Data Persistence & Settings

- [x] **DATA-01**: Meeting records persist in SQLite (`op-sqlite`) across app restarts
- [x] **DATA-02**: Schema: `meetings` table (id, title, date, rawTranscript, cleanedTranscript, reports JSON, audioPath, createdAt) and `settings` table (key, value)
- [x] **DATA-03**: API keys stored in Keychain with masked inputs and test connection buttons
- [x] **DATA-04**: `react-native-config` removed; API keys user-provided only
- [x] **DATA-05**: Database initialized on app launch; orphaned audio files cleaned
- [x] **DATA-06**: History screen shows all meetings sorted by date

### Settings & API Key Setup

- [x] **SETT-01**: Mandatory `ApiKeySetupScreen` between Passcode and Main on first launch; no skip until both keys provided
- [x] **SETT-02**: Settings screen: default language (EN/FR) picker, persisted to `settings` table
- [x] **SETT-03**: API key management in Settings: masked inputs, Keychain storage, test connection, clearable (blocks recording if cleared)
- [x] **SETT-04**: Change passcode; clear all data (with confirmation); storage info (audio size + count); about/version
- [x] **SETT-05**: Recording blocked if API keys missing; banner directs to Settings
- [x] **SETT-06**: Passcode hashing kept as-is (Keychain sufficient); no real lockout enforcement

### History & Meeting Detail

- [x] **HIST-01**: History grouped by date (Today, Yesterday, This Week, Earlier)
- [x] **HIST-02**: Search by title only; no pagination
- [x] **HIST-03**: MeetingDetail screen with 3 tabs: Report | Transcript | Audio
- [x] **HIST-04**: Report tab: executive summary + structured sections; language switcher (EN|FR) in header; on-demand generation with spinner + retry on failure
- [x] **HIST-05**: Transcript tab: cleaned by default, raw toggle
- [x] **HIST-06**: Audio tab: play/pause, seek bar, speed control (1x, 1.5x, 2x) via `react-native-audio-recorder-player`
- [x] **HIST-07**: Meeting title editable from detail header; transcript/report read-only
- [x] **HIST-08**: Delete from detail with confirmation dialog (deletes DB record + audio file)

### Export & Sharing

- [x] **EXPT-01**: User can export a meeting report as PDF via `react-native-html-to-pdf`
- [x] **EXPT-02**: User can export a meeting report as DOCX via `docx` library
- [x] **EXPT-03**: Files saved to device Downloads directory (Android 10+ only); meaningful filenames
- [x] **EXPT-04**: Share icon in MeetingDetail header → bottom sheet: Export as PDF | Export as DOCX | Share text
- [x] **EXPT-05**: Post-results screen: View in History, Export, New Meeting

### Authentication

- [ ] **AUTH-01**: App requires 6-digit passcode on launch (stored in Keychain, no hashing)
- [ ] **AUTH-02**: User can set up passcode on first launch
- [ ] **AUTH-03**: No real lockout enforcement (visual warning only, resets on reload)

## v2 Requirements

### Enhancements

- **ENH-01**: Waveform visualization in audio player
- **ENH-02**: Skip back/forward 15s in audio player
- **ENH-03**: Full-text search on transcript content
- **ENH-04**: Rich text editing for reports
- **ENH-05**: iOS build

## Out of Scope

| Feature | Reason |
|---------|--------|
| iOS build | Requires Mac + Xcode, not in v1 scope |
| Cloud sync | Local-only for v1, no backend |
| Real-time streaming transcription | Groq API is batch-only |
| Calendar integration | Deferred, not core value |
| Multi-user support | Single-user app |
| New RN architecture (Fabric/TurboModules) | Old arch, compatibility with native modules |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | Phase 1 | Done (01-01) |
| AUDIO-02 | Phase 1 | Done (01-01) |
| AUDIO-03 | Phase 1 | Done (01-02) |
| AUDIO-04 | Phase 1 | Done (01-02) |
| AUDIO-05 | Phase 1 | Done (01-01, 01-03) |
| AUDIO-06 | Phase 1 | Done (01-01, 01-03) |
| AUDIO-07 | Phase 1 | Pending |
| AUDIO-08 | Phase 1 | Pending |
| TRANS-01 | Phase 2 | Done (02-01) |
| TRANS-02 | Phase 2 | Done (02-01) |
| TRANS-03 | Phase 2 | Done (02-01) |
| TRANS-04 | Phase 2 | Done (02-01) |
| TRANS-05 | Phase 2 | Done (02-01) |
| RPT-01 | Phase 3 | Done (03-01) |
| RPT-02 | Phase 3 | Done (03-01) |
| RPT-03 | Phase 3 | Done (03-02) |
| RPT-04 | Phase 3 | Done (03-01) |
| RPT-05 | Phase 3 | Done (03-01) |
| RPT-06 | Phase 3 | Done (03-02) |
| DATA-01 | Phase 4 | Done (04-01) |
| DATA-02 | Phase 4 | Done (04-01) |
| DATA-03 | Phase 4 | Done (04-02) |
| DATA-04 | Phase 4 | Done (04-01) |
| DATA-05 | Phase 4 | Done (04-01) |
| DATA-06 | Phase 4 | Done (04-01) |
| SETT-01 | Phase 4 | Done (04-02) |
| SETT-02 | Phase 4 | Done (04-03) |
| SETT-03 | Phase 4 | Done (04-03) |
| SETT-04 | Phase 4 | Done (04-03) |
| SETT-05 | Phase 4 | Done (04-06) |
| SETT-06 | Phase 4 | Done (04-03) |
| HIST-01 | Phase 5 | Done (05-01) |
| HIST-02 | Phase 5 | Done (05-01) |
| HIST-03 | Phase 5 | Done (05-01) |
| HIST-04 | Phase 5 | Done (05-01) |
| HIST-05 | Phase 5 | Done (05-01) |
| HIST-06 | Phase 5 | Done (05-01) |
| HIST-07 | Phase 5 | Done (05-01) |
| HIST-08 | Phase 5 | Done (05-01) |
| EXPT-01 | Phase 6 | Done (06-01) |
| EXPT-02 | Phase 6 | Done (06-01) |
| EXPT-03 | Phase 6 | Done (06-01) |
| EXPT-04 | Phase 6 | Done (06-01) |
| EXPT-05 | Phase 6 | Done (06-01) |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-03 after grilling session (62 decisions)*
