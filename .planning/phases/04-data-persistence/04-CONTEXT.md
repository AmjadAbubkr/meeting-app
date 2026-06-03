# Phase 4: Data Persistence - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** Codebase analysis + project requirements

<domain>
## Phase Boundary

This phase replaces the in-memory Map database with SQLite persistence and adds a full meeting detail screen. Meeting records survive app restart. The History screen becomes functional with tap-to-detail navigation. The input is meeting data from the store (set by Phase 3); the output is a persistent SQLite database and a meeting detail view.

**What this phase delivers:**
- SQLite database replacing in-memory Map
- All meeting fields persisted (title, date, transcript, EN/FR reports and summaries)
- Database initialization on app launch
- Meeting detail screen with full transcript and reports
- Language toggle on detail screen

**What this phase does NOT deliver:**
- Report generation (Phase 3)
- Export functionality (Phase 5)
- Meeting editing (v2)
- Meeting deletion (v2)

</domain>

<decisions>
## Implementation Decisions

### SQLite Database (Locked)
- D-01: Use `react-native-sqlite-storage` for SQLite — most established RN SQLite library
- D-02: Database name: `meeting_app.db`, location: `default`
- D-03: Single `meetings` table with columns: id (INTEGER PRIMARY KEY AUTOINCREMENT), title, date, rawTranscript, cleanedTranscript, reportEN, reportFR, summaryEN, summaryFR, createdAt
- D-04: All text fields default to empty string (''), not NULL — simplifies insert logic
- D-05: Existing function signatures preserved: initDB, saveMeeting, updateMeeting, getAllMeetings, getMeeting

### Persistence Flow (Locked)
- D-06: `initDB()` called in App.tsx useEffect on mount
- D-07: `persistMeeting` action in store: calls saveMeeting for new, updateMeeting for existing
- D-08: `setAllResults` (from Phase 3) triggers `persistMeeting` automatically after report generation
- D-09: `resetMeeting` only clears in-memory state — persisted records stay in SQLite
- D-10: `getAllMeetings` returns records ordered by createdAt DESC (newest first)

### Meeting Detail (Locked)
- D-11: New `MeetingDetailScreen` receives meetingId via route params
- D-12: Loads meeting from SQLite via `getMeeting(meetingId)`
- D-13: Language toggle switches between EN and FR report/summary display
- D-14: Transcript section is collapsible (starts collapsed)

### Navigation (Locked)
- D-15: MeetingDetail added as Stack.Screen in App.tsx (not a tab)
- D-16: HistoryScreen items become Pressable, navigating to MeetingDetail on tap

### the agent's Discretion
- Exact UI layout of meeting detail screen
- Collapsible transcript animation/interaction
- Empty state text for missing fields

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Architecture
- `src/db/database.ts` — Current in-memory Map implementation (to be replaced)
- `src/store/appStore.ts` — Zustand store with meeting state
- `src/screens/HistoryScreen.tsx` — Current history list
- `App.tsx` — Navigation structure (Stack + Tab navigators)

### Database Schema
- Table: meetings
- Columns: id, title, date, rawTranscript, cleanedTranscript, reportEN, reportFR, summaryEN, summaryFR, createdAt

</canonical_refs>

<specifics>
## Specific Ideas

- The database currently uses a Map with auto-incrementing ID — replace with SQLite AUTOINCREMENT
- getAllMeetings currently returns from Map.values() — replace with SELECT query
- HistoryScreen currently calls getAllMeetings but data is lost on restart
- MeetingDetailScreen is a new screen — no existing file to modify

</specifics>

<deferred>
## Deferred Ideas

- Meeting editing (v2: ENH-01)
- Meeting deletion (v2: ENH-02)
- Search by title (v2: ENH-03)
- Database migration system
- Encrypted database

</deferred>

---
*Phase: 04-data-persistence*
*Context gathered: 2026-06-03 via codebase analysis*
