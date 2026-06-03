# Meeting App

## What This Is

React Native CLI Android app for recording meetings, transcribing audio via Groq, generating bilingual (EN/FR) reports via Gemini, and exporting results. Target users are professionals who need quick, accurate meeting summaries in multiple languages.

## Core Value

Record a meeting, get a structured bilingual report — from audio to actionable document in one tap.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can record meeting audio with real-time chunking
- [ ] User can upload existing audio files for processing
- [ ] Audio is transcribed accurately via Groq Whisper API
- [ ] Transcription generates cleaned transcript, EN report, EN summary, FR report, FR summary via Gemini
- [ ] Meeting records persist across app restarts (SQLite)
- [ ] User can view meeting history and detail
- [ ] User can export reports as PDF and DOCX
- [ ] App is protected by 6-digit passcode

### Out of Scope

- iOS build — Android-only for v1, iOS requires separate native tooling
- Real-time transcription (streaming) — Groq API is batch-only
- Cloud sync / backup — local-only for v1
- Multi-user collaboration — single-user app
- Calendar integration — deferred to v2

## Context

- React Native 0.80 CLI project with Android build working (GitHub Actions CI)
- Current codebase has all screens and navigation wired but core services are stubs
- Database layer uses in-memory Map (no persistence)
- Transcriber and generator return placeholder strings
- Exporter returns placeholder paths
- Passcode auth is implemented via react-native-keychain
- Uses Zustand for state management, React Navigation for routing

## Constraints

- **Tech stack**: React Native 0.80 CLI, TypeScript, Zustand, React Navigation — already scaffolded
- **Platform**: Android only (v1) — iOS build not set up
- **APIs**: Groq Whisper for transcription, Gemini for report generation — keys via react-native-config
- **Storage**: SQLite via react-native-sqlite-storage — must replace in-memory Map
- **Audio chunking**: 20 MB max per Groq API call (config already defined)
- **Audio formats**: mp3, mp4, wav, m4a, webm (config already defined)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zustand for state | Lightweight, already in project, good for RN | ✓ Good |
| Groq Whisper API | Fast transcription, good accuracy, simple API | — Pending |
| Gemini for reports | Multilingual generation capability | — Pending |
| react-native-keychain | Secure passcode storage | ✓ Good |
| In-memory Map as DB | Quick scaffolding, not production | ⚠️ Revisit |

---
*Last updated: 2026-06-03 after project initialization*
