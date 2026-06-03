---
phase: 1
plan: 2
subsystem: audio-upload
tags: [upload, document-picker, ffmpeg, chunking, validation]
dependency_graph:
  requires: [01-01]
  provides: [uploader-service, useUploadController, handleUploadChunk]
  affects: [src/services/uploader.ts, src/store/appStore.ts, package.json]
tech_stack:
  added: [react-native-document-picker@9.3.1]
  patterns: [file-picker-validation, ffmpeg-segment-splitting, zustand-controller-hook]
key_files:
  created: [src/services/uploader.ts]
  modified: [src/store/appStore.ts, package.json, package-lock.json]
decisions:
  - DocumentPicker imported as default export (v9 API, not named export)
  - Format validation uses file extension from DocumentPickerResponse.name, not URI
  - Size warning uses Alert.alert with Cancel/Continue (Promise-based gate)
  - Chunking preserves input file extension in output segments (not hardcoded to .m4a)
  - handleUploadChunk sets chunkCount=totalChunks (not incremental like handleRecordingChunk)
  - Fixed missing setError/clearError implementations in appStore (pre-existing type mismatch)
metrics:
  duration: 8m
  completed: 2026-06-03
  tasks: 3
  files: 3
---

# Phase 1 Plan 2: Audio File Upload with Chunking Summary

Audio file upload via react-native-document-picker with format/size validation and ffmpeg-based chunking at 20MB boundaries

## Tasks Completed

| # | Task | Status | Commit | Key Files |
|---|------|--------|--------|-----------|
| 1 | Install react-native-document-picker | ✅ | `b0f5209` | package.json, package-lock.json |
| 2 | Create src/services/uploader.ts | ✅ | `98b9a5d` | src/services/uploader.ts |
| 3 | Update src/store/appStore.ts with handleUploadChunk | ✅ | `98b9a5d` | src/store/appStore.ts |

## What Was Built

### src/services/uploader.ts (new file — 239 lines)
- **pickAndChunkAudio()**: Opens DocumentPicker filtered to audio MIME types, validates file extension against SUPPORTED_AUDIO_FORMATS (mp3, mp4, wav, m4a, webm), checks file size via RNFS.stat, shows Alert.alert warning for files >500MB (returns null if cancelled), delegates to chunkExistingFile
- **chunkExistingFile()**: If file ≤20MB, returns as single chunk; if >20MB, uses ffprobe to get duration then ffmpeg segment splitting (same pattern as recorder.ts). Calls onChunkComplete callback for each chunk. Preserves original file extension in output segments
- **cleanUploadChunks()**: Deletes upload-chunks-* directories from CachesDirectoryPath
- **useUploadController()**: Hook connecting upload flow to Zustand store — sets PROCESSING state, calls pickAndChunkAudio with callbacks that update audioChunks, chunkState, and processingStep

### src/store/appStore.ts (updated)
- **handleUploadChunk(uri, chunkIndex, totalChunks)**: Added to State type and implementation — adds audio chunk, sets chunkCount to totalChunks, updates currentChunkIndex, sets processing step message
- **setError(error)**: Added missing implementation — sets error string in state
- **clearError()**: Added missing implementation — clears error to null

### Error Handling
- DocumentPicker cancel → `isCancel()` check → returns null (no crash)
- Invalid format → throws Error with supported formats list
- RNFS.stat failure → throws Error('Selected file not found')
- ffmpeg split failure → cleanup of partial output dir, throws Error('Failed to split audio file')

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DocumentPicker named import doesn't exist**
- **Found during:** Task 2 — TypeScript check after creating uploader.ts
- **Issue:** `import { DocumentPicker, isCancel }` fails because DocumentPicker is a default export in v9.3.1, not a named export
- **Fix:** Changed to `import DocumentPicker, { isCancel } from 'react-native-document-picker'`
- **Files modified:** src/services/uploader.ts
- **Commit:** 98b9a5d

**2. [Rule 1 - Bug] Missing setError/clearError implementations in appStore**
- **Found during:** Task 3 — TypeScript check showed `State` type declared setError/clearError but create() implementation was missing them
- **Issue:** Pre-existing type mismatch — State type had setError and clearError but the store object didn't implement them, causing TS2739 error
- **Fix:** Added `setError: (error: string) => set({ error })` and `clearError: () => set({ error: null })`
- **Files modified:** src/store/appStore.ts
- **Commit:** 98b9a5d

**3. [Rule 3 - Blocking] handleUploadChunk missing from State type**
- **Found during:** Task 3 — handleUploadChunk was implemented but not declared in the State type
- **Issue:** Type definition didn't include handleUploadChunk signature
- **Fix:** Added `handleUploadChunk: (uri: string, chunkIndex: number, totalChunks: number) => void` to State type
- **Files modified:** src/store/appStore.ts
- **Commit:** 98b9a5d

## Verification

- `npx tsc --noEmit`: 0 new errors (2 pre-existing errors in apiKeys.ts are out of scope)
- All exports verified: pickAndChunkAudio, chunkExistingFile, cleanUploadChunks, useUploadController
- Store action handleUploadChunk verified in both type and implementation

## Requirements Satisfied

- **AUDIO-03**: User can upload existing audio files via react-native-document-picker ✅
- **AUDIO-04**: Uploaded files validated (format + size, warn at 500MB+) ✅

## Known Stubs

None — all data flows are wired through to the Zustand store.

## Self-Check: PASSED

- FOUND: src/services/uploader.ts
- FOUND: src/store/appStore.ts
- FOUND: .planning/phases/01-audio-recording/01-02-SUMMARY.md
- FOUND: b0f5209 (chore: install react-native-document-picker)
- FOUND: 98b9a5d (feat: uploader service and store update)
