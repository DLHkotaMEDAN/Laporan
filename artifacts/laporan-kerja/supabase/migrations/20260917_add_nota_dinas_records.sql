create table if not exists public.nota_dinas_records (
  id uuid primary key default gen_random_uuid(),
  form jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nota_dinas_records_updated_at_idx
  on public.nota_dinas_records(updated_at desc);

alter table public.nota_dinas_records enable row level security;

create or replace function public.has_nota_dinas_access(action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_access_role() = 'admin'
      or (
        public.current_access_role() = 'admin_nota_dinas'
        and action in ('select', 'insert', 'update')
      )
    )
$$;

drop policy if exists "nota_dinas_select_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_insert_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_update_authenticated" on public.nota_dinas_records;

create policy "nota_dinas_select_authenticated"
on public.nota_dinas_records
for select to authenticated
using (public.has_nota_dinas_access('select'));

create policy "nota_dinas_insert_authenticated"
on public.nota_dinas_records
for insert to authenticated
with check (public.has_nota_dinas_access('insert') and created_by = auth.uid());

create policy "nota_dinas_update_authenticated"
on public.nota_dinas_records
for update to authenticated
using (public.has_nota_dinas_access('update'))
with check (public.has_nota_dinas_access('update'));
