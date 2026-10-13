# AI_RULES.md

## Tech stack

- Frontend: React, TypeScript, Vite, and Tailwind CSS.
- Data, authentication, and file storage: Supabase (PostgreSQL, Supabase Auth, and Storage).
- Backend: Express with TypeScript for server-side endpoints such as PDF generation.
- API contracts and shared packages: workspace libraries under `lib/`.
- Package manager: pnpm workspaces.
- Deployment configuration: Vercel and the configured Dyad/Replit runtime; check the target before changing deployment behavior.

## Project structure

- `artifacts/laporan-kerja/src/pages` contains page-level screens.
- `artifacts/laporan-kerja/src/components` contains reusable interface components.
- `artifacts/laporan-kerja/src/services` contains Supabase data-access logic.
- `artifacts/laporan-kerja/supabase/migrations` contains database changes for the Supabase project.
- `artifacts/api-server/src` contains Express endpoints and server-only logic.
- `lib/` contains shared API and tooling packages.
- Keep UI, data access, and business logic in appropriately separated modules.

## Frontend rules

- Use functional React components and hooks.
- Use Tailwind CSS classes for styling and keep components reusable.
- Keep components focused; aim for no more than 300 lines. When existing components exceed this, split them incrementally without changing behavior.
- Use the shared Supabase client and existing service modules for database access.
- Preserve route, role, and region access behavior when changing UI or data loading.

## Backend and API rules

- Use Express for server-side endpoints and keep server-only credentials on the server.
- Validate request input and return appropriate status codes and JSON errors.
- Use async/await consistently and handle expected failures explicitly.
- Do not add a second database access path without an explicit architecture decision.

## Database rules

- Supabase is the application database source of truth.
- Make schema and policy changes through reviewed SQL migrations in `artifacts/laporan-kerja/supabase/migrations`.
- Preserve PostgreSQL naming, primary keys, foreign keys, and row-level security policies.
- Do not run Drizzle `push` against the application database. `lib/db` is an unused scaffold until its adoption is explicitly planned; its schema is not authoritative.
- Never use a direct schema push as a substitute for the Supabase migration history.

## Authentication and security

- Use Supabase Auth; protect private routes and preserve existing role checks.
- Treat Row Level Security as a required server-side boundary for client-accessible tables.
- Keep secrets in ignored environment files and never commit real credentials.
- Validate and sanitize user input; do not expose service-role keys or other server secrets to the browser.

## Code quality and delivery

- Use meaningful names, avoid duplicated logic, and comment complex behavior.
- Run the relevant typecheck/build after code changes when the local dependencies are available.
- Keep migrations, environment-specific configuration, and deployment behavior explicit.
- Do not commit sensitive data; keep changes focused and reviewable.
