# SISTEM LAPORAN - CLOUD DLH

A work reporting and management system for Dinas Lingkungan Hidup (Environmental Agency). Staff can log daily work reports, manage work plans, and track fuel usage — with role-based access control backed by Supabase.

## Run & Operate

- `pnpm --filter @workspace/laporan-kerja run dev` — run the frontend (workflow: `artifacts/laporan-kerja: web`)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: none (Supabase URL/key are hardcoded in `src/integrations/supabase/client.ts`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind v4, shadcn/ui, react-router-dom v6)
- Auth + DB: Supabase (auth, real-time, storage)
- Charts: Recharts
- Export: ExcelJS, jsPDF, html2canvas

## Where things live

- `artifacts/laporan-kerja/src/` — all frontend source
- `artifacts/laporan-kerja/src/pages/` — 34 route pages
- `artifacts/laporan-kerja/src/context/AuthContext.tsx` — Supabase auth context
- `artifacts/laporan-kerja/src/integrations/supabase/client.ts` — Supabase client (URL + anon key)
- `artifacts/laporan-kerja/src/index.css` — Tailwind v4 theme (CSS variables)
- `artifacts/laporan-kerja/src/App.tsx` — router with all routes + auth guards

## Architecture decisions

- Uses Supabase for auth and database — no Replit DB or Express API server needed.
- Role-based routing: `admin_bbm` redirects to `/fuel-reports`, legacy `admin_spj_bbm` to the SPJ Oli workspace, others to `/`.
- ProtectedRoute requires login; AdminRoute also checks role allowlist.
- Tailwind v4 with `@tailwindcss/vite` — no postcss.config.js (conflicts with v4).
- Blue theme: primary `221.2 83.2% 53.3%`, background `210 40% 98%`, radius `1rem`.

## Product

- **Laporan Harian** — staff submit and view daily work activity reports by team/category
- **Rencana Kerja** — work plan management (create, edit, print)
- **Laporan BBM** — fuel usage reports with daily/weekly/monthly/yearly recaps
- **Rekap & Cetak** — exportable recap reports (PDF/Excel)
- **Maintenance** — admin-only user and settings management

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Supabase URL and anon key are hardcoded in `src/integrations/supabase/client.ts` — not environment variables.
- Do not add postcss.config.js — it conflicts with `@tailwindcss/vite` (Tailwind v4).
- App uses react-router-dom (BrowserRouter), NOT wouter — do not mix them.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
