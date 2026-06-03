# Meeting App

## What This Is

React Native CLI Android app for recording meetings, transcribing audio via Groq, generating bilingual (EN/FR) reports via Gemini, and exporting results. Target users are professionals who need quick, accurate meeting summaries in multiple languages.

## Core Value

Record a meeting, get a structured bilingual report — from audio to actionable document in one tap.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can record meeting audio (AAC/M4A) with real-time chunking
- [ ] User can upload existing audio files for processing (validated format + size)
- [ ] Audio is transcribed via Groq Whisper API (`whisper-large-v3-turbo`, `verbose_json`)
- [ ] Transcription generates cleaned transcript + structured JSON report + executive summary via Gemini (`gemini-2.0-flash`, fallback `gemini-1.5-flash`)
- [ ] Default language generated immediately; other languages on-demand only
- [ ] Meeting records persist in SQLite (`op-sqlite`) across app restarts
- [ ] Mandatory API key setup on first launch (no skip)
- [ ] Settings screen: language, API keys (Keychain), passcode, clear data, storage info
- [ ] History with date grouping, search, and MeetingDetail with 3 tabs (Report/Transcript/Audio)
- [ ] Audio playback with seek + speed control (1x, 1.5x, 2x)
- [ ] User can export reports as PDF and DOCX (saved to Downloads on Android 10+)
- [ ] App protected by 6-digit passcode (Keychain, no hashing, no real lockout)

### Out of Scope

- iOS build — Android-only for v1
- Real-time streaming transcription — Groq API is batch-only
- Cloud sync / backup — local-only for v1
- Multi-user collaboration — single-user app
- Calendar integration — deferred to v2
- New RN architecture (Fabric/TurboModules) — old arch for compatibility

## Context

- React Native 0.80 CLI project with Android build working (GitHub Actions CI)
- Current codebase has all screens and navigation wired but core services are stubs
- Database layer uses in-memory Map (no persistence) — replacing with `op-sqlite`
- Transcriber and generator return placeholder strings — replacing with real API calls
- Exporter returns placeholder paths — replacing with real PDF/DOCX generation
- Passcode auth is implemented via react-native-keychain (kept as-is)
- Uses Zustand for state management, React Navigation for routing
- API keys will be user-provided at runtime (removing `react-native-config`)

## Constraints

- **Tech stack**: React Native 0.80 CLI, TypeScript (strict), Zustand, React Navigation — already scaffolded
- **Platform**: Android only (v1), minSdk 24, targetSdk 34
- **Orientation**: Portrait only
- **APIs**: Groq Whisper (`whisper-large-v3-turbo`) for transcription, Gemini (`gemini-2.0-flash`) for reports — keys user-provided via Keychain
- **Database**: `op-sqlite` with `meetings` table (JSON `reports` column) and `settings` table (key-value)
- **Audio**: AAC/M4A format, stored in `meeting-audio/{meetingId}.m4a`, chunked at 20MB via FFmpeg if needed
- **Audio formats supported for upload**: mp3, mp4, wav, m4a, webm (config already defined)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zustand for state | Lightweight, already in project, good for RN | ✓ Good |
| `op-sqlite` for database | JSI-based, fastest, RN team recommended | ✓ Selected |
| Groq Whisper `turbo` | Faster than large-v3, nearly as accurate | ✓ Selected |
| Gemini `2.0-flash` + `1.5-flash` fallback | Fast, cheap, good quality | ✓ Selected |
| JSON schema for reports | Structured, parseable, no prompt injection risk | ✓ Selected |
| Keychain for API keys | Hardware-backed, secrets don't belong in SQLite | ✓ Selected |
| User-provided API keys only | No build-time secrets, removed `react-native-config` | ✓ Selected |
| `react-native-audio-recorder-player` | Most popular, records + plays back, RN CLI compatible | ✓ Selected |
| Record-to-file then chunk | Simpler than streaming, matches UI flow | ✓ Selected |
| AAC/M4A recording format | 10x smaller than WAV, Groq supports it | ✓ Selected |
| Keep raw audio for playback | User wants to listen back in History | ✓ Selected |
| No passcode hashing | Keychain is hardware-backed, local PIN threat model | ✓ Accepted |
| No real lockout enforcement | Visual warning only, personal device | ✓ Accepted |
| `react-native-html-to-pdf` for PDF | HTML → PDF, handles multi-page, accents fine | ✓ Selected |
| `docx` library for DOCX | Already in dependencies | ✓ Kept |
| Save exports to Downloads | Direct access, Android 10+ only | ✓ Selected |
| Old RN architecture | Compatibility with native modules | ✓ Selected |

---
*Last updated: 2026-06-03 after grilling session (62 decisions)*
