# Phase 5: Export & Sharing - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Codebase analysis + project requirements

<domain>
## Phase Boundary

This phase delivers real PDF and DOCX export with Android share sheet integration. It replaces the placeholder exporter that returns hardcoded paths. The input is a MeetingRecord from SQLite; the output is a downloadable file that can be shared via Android's share sheet.

**What this phase delivers:**
- PDF export using react-native-html-to-pdf for formatted HTML-to-PDF conversion
- DOCX export using the `docx` npm library for structured document generation
- Files saved to device storage with sanitized filenames (meeting title + date)
- Android share sheet integration via react-native-share
- Export buttons on MeetingDetailScreen

**What this phase does NOT deliver:**
- Database persistence (Phase 4)
- Cloud storage upload
- Email integration
- Custom report templates

</domain>

<decisions>
## Implementation Decisions

### PDF Export (Locked)
- D-01: Use `react-native-html-to-pdf` for PDF generation — converts styled HTML to native PDF on device
- D-02: PDF content is formatted HTML: title (h1), date, summary section (h2 + text), report section (h2 + paragraphs)
- D-03: PDF styling: Arial font, dark headings, proper margins (40px padding)
- D-04: Language parameter selects EN or FR content for export

### DOCX Export (Locked)
- D-05: Use `docx` npm library (already in package.json) — creates DOCX in-memory, writes to filesystem
- D-06: DOCX structure: Heading1 (title), date paragraph, Heading2 (Summary), summary text, Heading2 (Report), report paragraphs
- D-07: Convert docx blob to base64, write via react-native-fs

### File Naming (Locked)
- D-08: Filename format: `{title}_{date}.pdf` or `{title}_{date}.docx`
- D-09: `sanitizeFilename`: replace spaces with underscores, remove /\:*?"<>|, truncate to 50 chars
- D-10: Files saved to `RNFS.DocumentDirectoryPath`

### Sharing (Locked)
- D-11: Use `react-native-share` for Android share sheet
- D-12: Share.open with url (file:// + path), type (MIME type), title
- D-13: Share cancellation ("User did not share" error) is silently handled — no alert shown
- D-14: Other export errors show Alert with error message

### UI (Locked)
- D-15: Export section on MeetingDetailScreen: two buttons (Export PDF, Export DOCX)
- D-16: ActivityIndicator shown while exporting
- D-17: Export triggers share sheet immediately after file generation

### the agent's Discretion
- Exact HTML styling for PDF
- Paragraph spacing in DOCX
- Button layout (side by side vs stacked)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Architecture
- `src/services/exporter.ts` — Current placeholder exporter
- `src/db/database.ts` — MeetingRecord type (consumed by exporter)
- `src/screens/MeetingDetailScreen.tsx` — Meeting detail view (export buttons added here)
- `src/components/PrimaryButton.tsx` — Button component

### Dependencies
- `docx` — Already in package.json
- `react-native-fs` — Already in package.json (installed in Phase 1)
- `react-native-html-to-pdf` — New install needed
- `react-native-share` — New install needed

</canonical_refs>

<specifics>
## Specific Ideas

- The exporter currently returns `{ path: '/path/to/file.pdf', content: 'dummy' }` — replace with real file generation
- exportPDF and exportDOCX signatures change: accept MeetingRecord + language instead of content string + filename
- MeetingDetailScreen (created in Phase 4) gets export buttons added
- Share sheet lets user choose: email, WhatsApp, Google Drive, etc.

</specifics>

<deferred>
## Deferred Ideas

- Custom report templates for export
- Direct email integration
- Cloud storage upload (Google Drive, Dropbox)
- Batch export of multiple meetings
- Export with embedded audio recording

</deferred>

---
*Phase: 05-export-sharing*
*Context gathered: 2026-06-03 via codebase analysis*
