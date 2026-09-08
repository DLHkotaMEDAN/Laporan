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
