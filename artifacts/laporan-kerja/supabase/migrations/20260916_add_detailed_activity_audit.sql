-- Audit trail terperinci untuk pemantauan aktivitas pengguna oleh Super Admin.
-- Aman dijalankan pada instalasi baru maupun database yang sudah memiliki audit_logs.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  user_email text,
  role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists user_email text;
alter table public.audit_logs add column if not exists role text;
alter table public.audit_logs add column if not exists entity_id text;
alter table public.audit_logs add column if not exists details jsonb;
alter table public.audit_logs add column if not exists created_at timestamptz default now();

update public.audit_logs
set details = '{}'::jsonb
where details is null;

alter table public.audit_logs alter column details set default '{}'::jsonb;
alter table public.audit_logs alter column details set not null;

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_delete_admin" on public.audit_logs;

create policy "audit_logs_select_admin"
on public.audit_logs for select to authenticated
using (public.has_admin_access());

create policy "audit_logs_insert_authenticated"
on public.audit_logs for insert to authenticated
with check (auth.uid() = user_id);

create policy "audit_logs_delete_admin"
on public.audit_logs for delete to authenticated
using (public.has_admin_access());
