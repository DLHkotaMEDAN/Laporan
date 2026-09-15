create table if not exists public.spj_oli_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  region_id uuid not null references public.regions(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  spj_number text not null,
  oil_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'Liter',
  location text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spj_oli_records_date_idx on public.spj_oli_records(date);
create index if not exists spj_oli_records_region_team_idx on public.spj_oli_records(region_id, team_id);

alter table public.spj_oli_records enable row level security;

create or replace function public.has_spj_oli_access(action text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.current_access_role() = 'admin'
    or (public.current_access_role() = 'admin_spj_bbm' and action in ('select', 'insert', 'update', 'delete'))
    or (public.current_access_role() = 'pimpinan' and action in ('select', 'update'))
  )
$$;

create policy "spj_oli_select_authenticated" on public.spj_oli_records for select to authenticated using (public.has_spj_oli_access('select'));
create policy "spj_oli_insert_authenticated" on public.spj_oli_records for insert to authenticated with check (public.has_spj_oli_access('insert'));
create policy "spj_oli_update_authenticated" on public.spj_oli_records for update to authenticated using (public.has_spj_oli_access('update')) with check (public.has_spj_oli_access('update'));
create policy "spj_oli_delete_authenticated" on public.spj_oli_records for delete to authenticated using (public.has_spj_oli_access('delete'));
