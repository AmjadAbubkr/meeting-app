---
phase: 06-export-sharing
plan: 01
subsystem: export
tags: [pdf, docx, share, export, html-to-pdf]
dependency_graph:
  requires: [MeetingRecord, ReportData, docx, react-native-html-to-pdf, react-native-fs]
  provides: [exportPDF, exportDOCX, shareText, ExportBottomSheet]
  affects: [MeetingScreen, MeetingDetailScreen, PrimaryButton]
tech_stack:
  added: [react-native-html-to-pdf]
  patterns: [HTML→PDF conversion, DOCX generation, RNFS file write, Share API]
key_files:
  created:
    - src/services/exporter.ts
    - src/components/ExportBottomSheet.tsx
    - src/types/react-native-html-to-pdf.d.ts
  modified:
    - src/screens/MeetingScreen.tsx
    - src/screens/MeetingDetailScreen.tsx
    - src/components/PrimaryButton.tsx
    - package.json
decisions:
  - D-20: PDF via react-native-html-to-pdf (HTML template → native PDF)
  - D-21: DOCX via docx library (structured paragraphs with TextRun)
  - D-22: Files saved to RNFS.DownloadDirectoryPath (Android 10+ scoped storage)
  - D-23: Share icon (↗) in MeetingDetail header → bottom sheet with export options
  - Used RN Share API instead of react-native-share (simpler, no extra dependency)
  - Reports parsed from JSON column format {EN: {report, summary}, FR: {...}}
  - Language fallback: requested lang → EN → FR → any available
metrics:
  duration: 45m
  completed: 2026-06-03
  tasks: 6
  files: 6
---

# Phase 6 Plan 01: Export & Sharing Summary

PDF and DOCX export with share text, integrated into MeetingDetailScreen header and MeetingScreen RESULTS section.

## What Was Built

1. **Full PDF export** (`exportPDF`) — Builds styled HTML with meeting report content (title, date, summary, overview, key discussion points, action items, decisions, open questions), converts via `react-native-html-to-pdf`, saves to Downloads directory
2. **Full DOCX export** (`exportDOCX`) — Builds Word document with `docx` library (heading paragraphs, bullet points, styled runs), packs to buffer, writes base64 to Downloads via RNFS
3. **Text sharing** (`shareText`) — Formats plain text report and opens RN Share sheet
4. **ExportBottomSheet component** — Modal bottom sheet with PDF/DOCX/text share options, ActivityIndicator during export, cancel button
5. **MeetingDetailScreen integration** — Share/export icon (↗) in header row, passes meeting + language to ExportBottomSheet
6. **MeetingScreen RESULTS integration** — Export as PDF/DOCX ghost buttons, View in History navigation, ActivityIndicator during export

## Key Implementation Details

- **Reports JSON parsing**: Extracts language-specific report data from the `reports` JSON column with fallback chain (requested language → EN → FR → any available)
- **Filename sanitization**: Removes path traversal characters, collapses dashes, truncates to 50 chars — prevents T-05-01 (path traversal)
- **HTML escaping**: All user-generated content escaped via `escapeHtml()` to prevent injection in generated documents
- **File paths**: PDF uses `react-native-html-to-pdf` with `directory: 'Downloads'`; DOCX uses `RNFS.DownloadDirectoryPath`
- **Error handling**: Three distinct error types — "No report data to export" (missing reports), "Failed to generate PDF" (conversion error), "Failed to save file" (write error)

## Commits

| Hash | Message |
|------|---------|
| 4f71487 | chore(06-export): install react-native-html-to-pdf for PDF generation |
| e17f287 | feat(06-export): implement PDF, DOCX, and text share exports |
| 4531e03 | feat(06-export): create ExportBottomSheet component |
| a6cf319 | feat(06-export): integrate export bottom sheet into MeetingDetailScreen |
| 086fa2d | feat(06-export): add export buttons to MeetingScreen RESULTS section |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate dead code in MeetingDetailScreen**
- **Found during:** Task 4 — integrating export into MeetingDetailScreen
- **Issue:** Lines 169-182 were duplicate orphaned code (leftover from partial edit) with a reference to non-existent `serializeReports` function
- **Fix:** Removed the duplicate block, kept the properly implemented `handleGenerateReport` function
- **Files modified:** src/screens/MeetingDetailScreen.tsx
- **Commit:** a6cf319

**2. [Rule 2 - Security] Added HTML escaping to prevent injection in PDF/DOCX**
- **Found during:** Task 2 — implementing exporter.ts
- **Issue:** Meeting titles and report content could contain HTML special characters that would be injected into the generated HTML document
- **Fix:** Added `escapeHtml()` function that escapes &, <, >, ", ' characters before embedding in HTML
- **Files modified:** src/services/exporter.ts
- **Commit:** e17f287

**3. [Rule 2 - Security] Added filename sanitization to prevent path traversal**
- **Found during:** Task 2 — implementing exporter.ts
- **Issue:** Meeting titles could contain path traversal characters (../) that would write files outside the intended directory
- **Fix:** Added `sanitizeFilename()` that strips non-alphanumeric chars, collapses dashes, truncates to 50 chars — mitigates T-05-01 from the threat model
- **Files modified:** src/services/exporter.ts
- **Commit:** e17f287

**4. [Rule 2 - Critical] Added disabled prop to PrimaryButton**
- **Found during:** Task 3 — creating ExportBottomSheet
- **Issue:** PrimaryButton had no disabled prop, making it impossible to prevent double-tap during export operations
- **Fix:** Added `disabled?: boolean` prop with opacity and color styling for visual feedback
- **Files modified:** src/components/PrimaryButton.tsx
- **Commit:** 4531e03 (note: a prior Phase 4 commit c0d534a also added disabled prop — this was a duplicate that merged cleanly)

**5. [Adaptation] Used RN Share API instead of react-native-share**
- **Found during:** Task 2 — implementing shareText
- **Issue:** The plan's 05-02 reference suggested `react-native-share`, but React Native's built-in `Share` API is sufficient for text sharing and avoids an extra native dependency
- **Fix:** Used `Share.share()` from `react-native` for plain text sharing
- **Files modified:** src/services/exporter.ts
- **Commit:** e17f287

## Threat Flags

No additional threat surface beyond what was in the plan's threat model. The filename sanitization (T-05-01) and HTML escaping were implemented as mitigations.

## Known Stubs

None — all export functions are fully implemented with real file generation.

## Self-Check: PASSED

- All 4 created files exist: exporter.ts, react-native-html-to-pdf.d.ts, ExportBottomSheet.tsx, 06-SUMMARY.md
- All 5 commits found in git log: 4f71487, e17f287, 4531e03, a6cf319, 086fa2d
- TypeScript compilation: 0 errors
