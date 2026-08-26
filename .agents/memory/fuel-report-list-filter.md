---
name: FuelReportList filter pattern
description: FuelReportList uses pending/applied filter state with an explicit "Cari Data" button to avoid race conditions when selecting month+year filters.
---

FuelReportList had a race condition: selecting Month then Year triggered two simultaneous Supabase queries; the slower one (getAllReports) could overwrite the correct filtered result.

**Fix applied:** Separate "selected" state (dropdown values) from "applied" state (what triggers the query). The useEffect depends on `[isAllowed, appliedMonth, appliedYear]`. Data only loads when user clicks "Cari Data" button, which calls `setAppliedMonth` + `setAppliedYear` atomically.

**Why:** Automatic query-on-change creates race conditions when two dropdowns change in sequence. Explicit apply button guarantees both filters are set before the single query fires.

**How to apply:** FuelSpjReportList needs the same treatment. Any list page with multiple filter dropdowns that each trigger a server-side query should use the pending/applied pattern.

**stale-request guard:** `reqIdRef` (useRef counter) is still present to protect against async ordering issues even with the button approach.
