create table if not exists public.overtime_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  nip text not null,
  position text not null,
  work_location text not null,
  photo_url text not null default '',
  start_time text not null,
  end_time text not null,
  attendance_count integer not null default 0 check (attendance_count >= 0),
  region_id uuid references public.regions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overtime_records enable row level security;

create or replace function public.has_overtime_access(target_region uuid, action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role() in ('admin', 'pimpinan') then action in ('select', 'update') or public.current_access_role() = 'admin'
    when public.current_access_role() in ('admin_wilayah', 'admin_wilayah_bbm', 'admin_rencana_kerja', 'admin_rencana_kerja_bbm') then
      target_region = public.current_access_region()
    else false
  end
$$;

drop policy if exists "overtime_select_authenticated" on public.overtime_records;
drop policy if exists "overtime_insert_authenticated" on public.overtime_records;
drop policy if exists "overtime_update_authenticated" on public.overtime_records;
drop policy if exists "overtime_delete_authenticated" on public.overtime_records;

create policy "overtime_select_authenticated" on public.overtime_records for select to authenticated using (public.has_overtime_access(region_id, 'select'));
create policy "overtime_insert_authenticated" on public.overtime_records for insert to authenticated with check (public.has_overtime_access(region_id, 'insert'));
create policy "overtime_update_authenticated" on public.overtime_records for update to authenticated using (public.has_overtime_access(region_id, 'update')) with check (public.has_overtime_access(region_id, 'update'));
create policy "overtime_delete_authenticated" on public.overtime_records for delete to authenticated using (public.has_overtime_access(region_id, 'delete'));
