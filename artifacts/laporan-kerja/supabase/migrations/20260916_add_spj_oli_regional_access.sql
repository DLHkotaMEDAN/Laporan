-- Admin SPJ Oli dapat dikelola Super Admin untuk semua wilayah (region_id NULL)
-- atau dibatasi ke satu wilayah tertentu. Pembatasan ini diterapkan di database.
create or replace function public.has_spj_oli_record_access(target_region uuid, action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and case
    when public.current_access_role() = 'admin' then true
    when public.current_access_role() = 'admin_spj_bbm' then action in ('select', 'insert', 'update', 'delete')
    when public.current_access_role() = 'admin_spj_oli' then
      public.current_access_region() is null
      or target_region = public.current_access_region()
    when public.current_access_role() = 'pimpinan' then action in ('select', 'update')
    else false
  end
$$;

drop policy if exists "spj_oli_select_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_insert_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_update_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_delete_authenticated" on public.spj_oli_records;

create policy "spj_oli_select_authenticated" on public.spj_oli_records
  for select to authenticated
  using (public.has_spj_oli_record_access(region_id, 'select'));

create policy "spj_oli_insert_authenticated" on public.spj_oli_records
  for insert to authenticated
  with check (public.has_spj_oli_record_access(region_id, 'insert'));

create policy "spj_oli_update_authenticated" on public.spj_oli_records
  for update to authenticated
  using (public.has_spj_oli_record_access(region_id, 'update'))
  with check (public.has_spj_oli_record_access(region_id, 'update'));

create policy "spj_oli_delete_authenticated" on public.spj_oli_records
  for delete to authenticated
  using (public.has_spj_oli_record_access(region_id, 'delete'));
