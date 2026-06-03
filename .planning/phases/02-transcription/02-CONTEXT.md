# Phase 2: Transcription - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Codebase analysis + project requirements

<domain>
## Phase Boundary

This phase delivers real Groq Whisper API transcription of audio chunks. It replaces the placeholder transcriber that returns "Transcript part N" strings. The input is audio chunk URIs from Phase 1; the output is a concatenated raw transcript stored in Zustand state, ready for report generation in Phase 3.

**What this phase delivers:**
- Real Groq Whisper API integration for audio-to-text
- Chunk-by-chunk transcription with progress display
- Concatenation of partial transcripts into full raw transcript
- Clear error handling for missing API keys and empty chunks

**What this phase does NOT deliver:**
- Audio recording (Phase 1)
- Report generation (Phase 3)
- Database persistence (Phase 4)
- Export functionality (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Groq Whisper API (Locked)
- D-01: Use Groq Whisper `whisper-large-v3` model for transcription — best accuracy, supported by Groq API
- D-02: Each audio chunk sent as multipart/form-data to `https://api.groq.com/openai/v1/audio/transcriptions`
- D-03: Transcription language set to `en` (English) — meeting audio is expected in English; French reports are generated from the English transcript
- D-04: Response format: `response_format=json` returns `{ text: string }`
- D-05: Sequential chunk processing (not parallel) to avoid rate limits on free Groq tier

### State & Progress (Locked)
- D-06: `processingStep` updated per chunk: "Transcribing chunk 1/5...", "Transcribing chunk 2/5...", etc.
- D-07: Concatenated transcript stored in `rawTranscript` field of Zustand store
- D-08: On completion, app state transitions to PROCESSING step for report generation (Phase 3 handles the rest)

### Error Handling (Locked)
- D-09: Missing `GROQ_API_KEY` (empty or undefined in config.ts) throws error with message "Groq API key not configured"
- D-10: HTTP errors from Groq API are caught and surfaced with status code and message
- D-11: Empty chunks (0 bytes or missing file) are skipped with a warning logged

### the agent's Discretion
- Exact error message wording (beyond what's specified)
- Progress display format details
- Retry logic for transient API errors

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Architecture
- `src/services/transcriber.ts` — Current placeholder transcriber
- `src/config.ts` — GROQ_API_KEY, CHUNK_SIZE_BYTES, SUPPORTED_AUDIO_FORMATS
- `src/store/appStore.ts` — Zustand store with audioChunks, chunkCount, processingStep, rawTranscript

### API Documentation
- Groq Whisper API: POST https://api.groq.com/openai/v1/audio/transcriptions
- Multipart form: file (audio), model ("whisper-large-v3"), language ("en"), response_format ("json")

</canonical_refs>

<specifics>
## Specific Ideas

- The transcriber currently returns "Transcript part 1" etc. — replace with real API calls
- The PROCESSING state currently shows "Processing audio..." — update to show chunk-by-chunk progress
- Each chunk is a file URI (from react-native-fs or audio recorder) — must be sent as file upload
- The rawTranscript field is already in the store but never populated with real data

</specifics>

<deferred>
## Deferred Ideas

- Parallel chunk transcription (rate limit concern on free tier)
- Streaming/real-time transcription (Groq is batch-only)
- Language auto-detection (explicit English for v1)
- Retry with exponential backoff (simple error display for v1)
- Word-level timestamps

</deferred>

---
*Phase: 02-transcription*
*Context gathered: 2026-06-03 via codebase analysis*
