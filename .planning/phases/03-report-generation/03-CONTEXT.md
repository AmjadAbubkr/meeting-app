# Phase 3: Report Generation - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Codebase analysis + project requirements

<domain>
## Phase Boundary

This phase delivers Gemini API integration to transform raw transcripts into structured bilingual reports. It replaces the placeholder generator that returns "{language} report placeholder". The input is the raw transcript from Phase 2; the output is a cleaned transcript plus EN and FR reports and summaries stored in Zustand state.

**What this phase delivers:**
- Real Gemini API integration for report generation
- Structured JSON output: cleanedTranscript, reportEN, summaryEN, reportFR, summaryFR
- Language selection UI (EN or FR) for report viewing
- Results display showing summary and full report

**What this phase does NOT deliver:**
- Transcription (Phase 2)
- Database persistence (Phase 4)
- Export functionality (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Gemini API (Locked)
- D-01: Use Gemini `gemini-2.0-flash` model — fast, cost-effective, supports structured JSON output
- D-02: API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- D-03: Use `responseMimeType: 'application/json'` with a response_schema to force structured JSON output
- D-04: Single API call returns all 5 fields: cleanedTranscript, reportEN, summaryEN, reportFR, summaryFR
- D-05: Prompt instructs Gemini to: clean up transcript (fillers, disfluencies), generate EN report, generate EN summary, generate FR report, generate FR summary

### State & UI (Locked)
- D-06: New store fields: cleanedTranscript, reportEN, reportFR, summaryEN, summaryFR (added by Plan 02)
- D-07: Language toggle on results screen switches between EN and FR display
- D-08: `setAllResults` action in store receives all 5 fields and sets them atomically
- D-09: Report display shows: summary (compact), full report (scrollable), with language toggle

### Error Handling (Locked)
- D-10: Missing `GEMINI_API_KEY` throws error with message "Gemini API key not configured"
- D-11: Empty rawTranscript is rejected before API call
- D-12: JSON parse failures from Gemini are caught and surfaced

### the agent's Discretion
- Exact prompt wording (as long as it requests all 5 outputs)
- Report format/structure within the text
- Summary length guidelines
- UI layout details for results screen

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Architecture
- `src/services/generator.ts` — Current placeholder generator
- `src/config.ts` — GEMINI_API_KEY
- `src/store/appStore.ts` — Zustand store with rawTranscript, processingStep
- `src/screens/MeetingScreen.tsx` — RESULTS state UI section

### API Documentation
- Gemini API: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API_KEY
- Request body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: {...} } }

</canonical_refs>

<specifics>
## Specific Ideas

- The generator currently returns placeholder text — replace with real Gemini API call
- The RESULTS state currently shows placeholder text — replace with real report display
- Language toggle should default to EN but allow switching to FR
- The "New Meeting" button in RESULTS state should reset all fields and go back to FORM

</specifics>

<deferred>
## Deferred Ideas

- Re-generate reports with different parameters
- Report editing after generation
- Custom report templates
- Streaming report generation
- Multiple report styles (executive, detailed, action items)

</deferred>

---
*Phase: 03-report-generation*
*Context gathered: 2026-06-03 via codebase analysis*
