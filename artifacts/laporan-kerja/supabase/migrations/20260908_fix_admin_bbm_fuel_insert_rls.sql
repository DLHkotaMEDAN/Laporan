-- admin_bbm manages fuel reports across all regions. The combined roles remain
-- restricted to the region assigned to their profile.
create or replace function public.has_fuel_record_access(
  target_region uuid,
  resource text,
  action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role() = 'admin' then true
    when public.current_access_role() = 'pimpinan' then action in ('select', 'update')
    when public.current_access_role() = 'admin_bbm' then
      resource = 'fuel_reports'
    when public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm') then
      resource = 'fuel_reports' and target_region = public.current_access_region()
    else false
  end
$$;

-- Recreate the policies as well. This is intentional: an already deployed
-- database may still have the policy created by the previous migration.
-- admin_bbm is global; the two combined regional roles are scoped to profile
-- region_id.
alter table public.fuel_reports enable row level security;

drop policy if exists "Allow all for authenticated users" on public.fuel_reports;
drop policy if exists "fuel_reports_select_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_insert_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_update_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_delete_authenticated" on public.fuel_reports;

create policy "fuel_reports_select_authenticated"
on public.fuel_reports for select to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
  or (public.current_access_role() = 'pimpinan')
);

create policy "fuel_reports_insert_authenticated"
on public.fuel_reports for insert to authenticated
with check (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);

create policy "fuel_reports_update_authenticated"
on public.fuel_reports for update to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
  or (public.current_access_role() = 'pimpinan')
)
with check (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);

create policy "fuel_reports_delete_authenticated"
on public.fuel_reports for delete to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);
