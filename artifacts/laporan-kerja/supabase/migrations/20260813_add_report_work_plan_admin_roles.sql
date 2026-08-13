-- Add combined report and work-plan administrator roles to row-level access.
-- These roles must be assigned a region when their account is created.

create or replace function public.has_record_access(
  target_region uuid,
  target_team uuid,
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
    when public.current_access_role() = 'admin_wilayah' then target_region = public.current_access_region()
    when public.current_access_role() = 'admin_harian' then
      resource = 'reports'
      and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_rencana_kerja' then
      resource = 'work_plans'
      and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_laporan_harian_rencana_kerja' then
      resource in ('reports', 'work_plans')
      and target_region = public.current_access_region()
    when public.current_access_role() in (
      'admin_laporan_mingguan_rencana_kerja',
      'admin_laporan_bulanan_rencana_kerja'
    ) then
      target_region = public.current_access_region()
      and (
        resource = 'work_plans'
        or (resource = 'reports' and action = 'select')
      )
    when public.current_access_role() = 'user' then
      resource in ('reports', 'work_plans')
      and target_region = public.current_access_region()
      and target_team = public.current_access_team()
    when public.current_access_role() in (
      'admin_laporan_mingguan',
      'admin_laporan_bulanan',
      'admin_laporan_mingguan_bulanan',
      'admin_laporan_harian_mingguan',
      'admin_laporan_harian_bulanan'
    ) then
      resource = 'reports'
      and action = 'select'
    else false
  end
$$;
