# Phase 1: Audio Recording - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning (updated with grilling session decisions)
**Source:** Codebase analysis + project requirements + 62 grilling decisions

<domain>
## Phase Boundary

This phase delivers real audio recording with chunking and upload functionality. It replaces the placeholder recording UI with a working audio pipeline. The output of this phase is a set of audio chunk URIs stored in Zustand state, ready for transcription in Phase 2.

**What this phase delivers:**
- Real microphone recording (AAC/M4A format) with start/stop/cancel
- Audio saved to internal files directory: `meeting-audio/{meetingId}.m4a`
- Files under 20MB sent as-is; over 20MB split via `react-native-ffmpeg` into valid M4A segments
- File upload with format validation and size warning (>500MB) via `react-native-document-picker`
- Recording state display with dynamic chunk progress
- Screen kept awake during recording via `react-native-keep-awake`
- Portrait-only orientation lock
- Microphone permission requested on app launch
- Audio chunks stored in app state for downstream transcription

**What this phase does NOT deliver:**
- Transcription (Phase 2)
- Report generation (Phase 3)
- Database persistence (Phase 4)
- Export functionality (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Audio Recording (Locked from grilling session)
- D-01: Use `react-native-audio-recorder-player` for microphone recording — most popular, well-maintained RN audio library with recording + playback support
- D-02: Audio recorded as **AAC/M4A** format (NOT WAV — M4A is 10x smaller, Groq supports it)
- D-03: Record-to-file then chunk — record entire meeting, then chunk after user taps "End Meeting"
- D-04: Recording state machine: FORM → READY → RECORDING → PROCESSING (existing Zustand flow preserved)
- D-05: Cancel recording discards all chunks and resets to FORM state
- D-06: Audio saved to internal files directory as `meeting-audio/{meetingId}.m4a` (kept for playback in History — Phase 5)
- D-07: Files under 20MB sent as-is; over 20MB split via `react-native-ffmpeg` into valid M4A segments (CANNOT byte-split M4A — would corrupt)
- D-08: Screen kept awake during recording via `react-native-keep-awake`
- D-09: Portrait-only orientation lock
- D-10: Microphone permission requested on app launch

### Audio Upload (Locked from grilling session)
- D-11: Use `react-native-document-picker` for file selection
- D-12: Uploaded files validated against SUPPORTED_AUDIO_FORMATS (mp3, mp4, wav, m4a, webm)
- D-13: File size validation — warn if >500MB ("This file is large and may take several minutes. Continue?")
- D-14: Uploaded files under 20MB sent as-is; over 20MB split via `react-native-ffmpeg`
- D-15: Invalid file format shows Alert with list of supported formats

### State Management (Locked)
- D-16: Audio chunks stored as file URIs in `audioChunks` array (existing Zustand field)
- D-17: `chunkCount` and `currentChunkIndex` updated as chunks are created
- D-18: Processing step text updated during chunking ("Chunking audio 2/5...")

### Agent's Discretion
- Exact recording UI layout details (colors, spacing, icon choices)
- Timer display format during recording
- Animation/feedback for recording state

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Architecture
- `src/config.ts` — API keys, chunk size, supported formats
- `src/store/appStore.ts` — Zustand store with AppState, audioChunks, chunkCount
- `src/screens/MeetingScreen.tsx` — Current recording UI skeleton
- `src/components/PrimaryButton.tsx` — Button component with variants
- `src/components/ScreenShell.tsx` — Screen wrapper component

### Project Configuration
- `package.json` — Current dependencies
- `tsconfig.json` — TypeScript configuration

</canonical_refs>

<specifics>
## Specific Ideas

- The recording button currently shows "MIC" text in a circle — replace with proper recording indicator
- The "Upload Audio" button currently opens a placeholder modal — replace with real file picker
- The chunk progress display currently shows "Chunk 1 / 1" — make dynamic
- The "End Meeting" button in RECORDING state should stop recording and transition to PROCESSING
- The "Show Results" button in PROCESSING state should be removed (auto-advance in Phase 3)

</specifics>

<deferred>
## Deferred Ideas

- Pause/resume recording (not in v1 requirements)
- Audio playback before processing
- Recording timer display (agent's discretion)
- Waveform visualization during recording
- Background recording

</deferred>

---
*Phase: 01-audio-recording*
*Context gathered: 2026-06-03 via codebase analysis + grilling session decisions*
