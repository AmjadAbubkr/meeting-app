---
phase: "04"
plan: "data-persistence-settings"
subsystem: "data, settings, navigation"
tags: ["op-sqlite", "database", "settings", "api-keys", "navigation", "keychain"]
dependency_graph:
  requires: ["03-report-generation"]
  provides: ["sqlite-database", "settings-screen", "api-key-setup", "navigation-gates"]
  affects: ["database.ts", "processingPipeline.ts", "MeetingDetailScreen.tsx", "App.tsx", "MeetingScreen.tsx", "PasscodeScreen.tsx"]
tech_stack:
  added: ["@op-engineering/op-sqlite"]
  patterns: ["sqlite-repository", "json-column-reports", "keychain-api-keys", "settings-kv-table"]
key_files:
  created:
    - "src/screens/ApiKeySetupScreen.tsx"
    - "src/screens/SettingsScreen.tsx"
  modified:
    - "src/db/database.ts"
    - "src/services/processingPipeline.ts"
    - "src/screens/MeetingDetailScreen.tsx"
    - "App.tsx"
    - "src/screens/MeetingScreen.tsx"
    - "src/screens/PasscodeScreen.tsx"
    - "package.json"
decisions:
  - "D-10: op-sqlite for SQLite persistence"
  - "D-11: JSON reports column + settings key-value table"
  - "D-33: API keys in Keychain (already implemented)"
  - "D-36/D-37: Mandatory ApiKeySetupScreen between Passcode and Main"
  - "D-31: No passcode hashing"
  - "D-32: Settings: language + API keys + passcode change + clear data + storage info + about"
metrics:
  duration: "4833s"
  completed_date: "2026-06-03"
  tasks_total: 8
  tasks_completed: 8
---

# Phase 4 Plan: Data Persistence & Settings Summary

SQLite database with op-sqlite replacing in-memory Map, API key setup gate, Settings screen, and navigation flow enforcement.

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ----------- | ------ | ---------------------------- |
| 1 | Install op-sqlite, remove react-native-config | deb4dda | package.json, package-lock.json |
| 2 | Rewrite database.ts with op-sqlite | 753c649 | src/db/database.ts, src/services/processingPipeline.ts, src/screens/MeetingDetailScreen.tsx |
| 3 | Create ApiKeySetupScreen | 363e685 | src/screens/ApiKeySetupScreen.tsx |
| 4 | Create SettingsScreen | 5571ca1 | src/screens/SettingsScreen.tsx |
| 5 | Update App.tsx navigation | c154592 | App.tsx, src/screens/PasscodeScreen.tsx |
| 6 | Block recording when API keys missing | c718217 | src/screens/MeetingScreen.tsx |
| 7 | Clean orphaned audio files on app open | (included in 753c649) | src/db/database.ts |
| 8 | Remove react-native-config references | (confirmed clean in Task 1) | N/A |

## Key Changes

### Database (op-sqlite)
- Replaced in-memory `Map` with real SQLite via `@op-engineering/op-sqlite`
- **meetings** table: `id`, `title`, `date`, `rawTranscript`, `cleanedTranscript`, `reports` (JSON), `audioPath`, `createdAt`
- **settings** table: `key` (PRIMARY KEY), `value`
- `reports` column stores JSON: `{"EN": {"report": {...}, "summary": [...]}, "FR": {...}}`
- Replaces the old separate `reportEN`/`reportFR`/`summaryEN`/`summaryFR` fields

### Processing Pipeline
- Updated `saveMeeting()` calls to use new `reports` JSON column format
- Added `moveAudioToPermanentStorage()` after save — moves chunk files to `meeting-audio/{meetingId}/`
- Updates meeting record with `audioPath` after moving files

### API Key Setup Screen
- Mandatory gate between Passcode and Main on first launch
- Groq test: `GET https://api.groq.com/openai/v1/models` with Bearer token
- Gemini test: `GET https://generativelanguage.googleapis.com/v1beta/models?key={key}`
- Visual status: ✓ green / ✗ red / spinner during test
- Continue button only works when both keys saved to Keychain

### Settings Screen
- Default Language: EN/FR chip selection saved to `settings` table
- API Keys: view/set/test/clear for both Groq and Gemini with inline editing
- Change Passcode: verify old → enter new → confirm new flow
- Clear All Data: confirmation alert → `deleteAllData()` (DB + audio files)
- Storage Info: meeting count + audio size in MB
- About: "Meeting App v0.1.0"

### Navigation
- App launch flow: initDB → check passcode → check API keys → route accordingly
- Initial route determined dynamically: Passcode → ApiKeySetup → Main
- Settings added as 3rd tab with ⚙ icon
- PasscodeScreen updated to check API keys after auth and route to ApiKeySetup or Main

### Recording Gate
- MeetingScreen READY state checks `hasApiKey('groq')` and `hasApiKey('gemini')`
- If either missing: red banner "API keys required. Go to Settings to add them." with link
- MIC button and Upload button disabled when keys missing

### Orphaned Audio Cleanup
- `initDB()` calls `cleanOrphanedAudioFiles()` on every app open
- Scans `meeting-audio/` directory, compares subdirectory names against meeting IDs
- Deletes directories not matching any meeting record
- Also cleans stale temp files from `CachesDirectoryPath`

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Reports JSON column format** — `{[lang]: {report, summary}}` instead of separate per-language columns, as specified in D-11
2. **Audio storage path** — `DocumentDirectoryPath/meeting-audio/{meetingId}/` for persistent storage
3. **Orphaned cleanup strategy** — Directory-based cleanup (compare subdirectory names vs meeting IDs) since each meeting gets its own subdirectory

## Verification

- `npx tsc --noEmit` — 0 TypeScript errors
- All database functions export the same API signatures as the in-memory stub
- Processing pipeline correctly builds JSON reports column and moves audio files
- MeetingDetailScreen correctly parses reports from JSON column

## Self-Check: PASSED

- All 7 key files verified present: database.ts, ApiKeySetupScreen.tsx, SettingsScreen.tsx, processingPipeline.ts, App.tsx, MeetingScreen.tsx, PasscodeScreen.tsx
- All 6 commits verified in git log: deb4dda, 753c649, 363e685, 5571ca1, c154592, c718217
- TypeScript compilation: 0 errors
