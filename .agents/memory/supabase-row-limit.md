---
name: Supabase 1000-row cap
description: Supabase/PostgREST enforces a server-side max-rows limit that overrides client .limit() calls; fix is server-side date filtering.
---

The Supabase hosted service enforces a max-rows cap (default 1000) at the PostgREST level. Even with `.limit(10000)` in JS client code, queries return at most 1000 rows. This causes older records to silently disappear when fetching all data ordered by date DESC.

**Fix:** Use server-side date range filtering (`getReportsByDateRange(startDate, endDate)`) instead of fetching all records and filtering client-side.

**Why:** The client `.limit()` is capped by the server config — it takes `MIN(client_limit, server_max_rows)`. For all list pages in this app, use explicit date range queries when a month/year filter is active.

**How to apply:** All `getAllReports()` calls on list/recap pages should be paired with a `getReportsByDateRange` path for when specific month/year filters are selected. The "semua" (all) case falls back to `getAllReports()` but only shows the 1000 most recent records.
