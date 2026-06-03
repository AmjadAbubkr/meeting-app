# Phase 1: Audio Recording - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Codebase analysis + project requirements

<domain>
## Phase Boundary

This phase delivers real audio recording with chunking and upload functionality. It replaces the placeholder recording UI with a working audio pipeline. The output of this phase is a set of audio chunk URIs stored in Zustand state, ready for transcription in Phase 2.

**What this phase delivers:**
- Real microphone recording with start/stop/cancel
- Real-time audio chunking at 20 MB boundaries
- File upload with chunking for existing audio files
- Recording state display (idle, recording, paused)
- Audio chunks stored in app state for downstream transcription

**What this phase does NOT deliver:**
- Transcription (Phase 2)
- Report generation (Phase 3)
- Database persistence (Phase 4)
- Export functionality (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Audio Recording (Locked)
- D-01: Use `react-native-audio-recorder-player` for microphone recording — most popular, well-maintained RN audio library with recording + playback support
- D-02: Audio recorded as WAV format for maximum Whisper API compatibility
- D-03: Real-time chunking: write audio to temp file, when file reaches 20 MB, start new chunk
- D-04: Recording state machine: FORM → READY → RECORDING → PROCESSING (existing Zustand flow preserved)
- D-05: Cancel recording discards all chunks and resets to FORM state

### Audio Upload (Locked)
- D-06: Use `react-native-document-picker` for file selection
- D-07: Uploaded files are validated against SUPPORTED_AUDIO_FORMATS (mp3, mp4, wav, m4a, webm)
- D-08: Uploaded files are chunked at 20 MB using `react-native-fs` to read file segments
- D-09: Invalid file format shows Alert with list of supported formats

### State Management (Locked)
- D-10: Audio chunks stored as file URIs in `audioChunks` array (existing Zustand field)
- D-11: `chunkCount` and `currentChunkIndex` updated as chunks are created
- D-12: Processing step text updated during chunking ("Chunking audio 2/5...")

### the agent's Discretion
- Exact recording UI layout details (colors, spacing, icon choices)
- Timer display format during recording
- Animation/feedback for recording state
- Error message wording (beyond what's specified)

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
- The "Show Results" button in PROCESSING state should be removed/modified since this phase only records audio (transcription is Phase 2)

</specifics>

<deferred>
## Deferred Ideas

- Pause/resume recording (not in v1 requirements)
- Audio playback before processing
- Recording timer display (the agent's discretion)
- Waveform visualization during recording
- Background recording

</deferred>

---
*Phase: 01-audio-recording*
*Context gathered: 2026-06-03 via codebase analysis*
