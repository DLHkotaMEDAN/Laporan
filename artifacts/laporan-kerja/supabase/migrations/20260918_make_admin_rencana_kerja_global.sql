-- Admin Rencana Kerja is global for work plans only.
-- The combined work-plan/fuel role remains scoped to its assigned region.

update public.profiles
set region_id = null,
    team_id = null,
    updated_at = now()
where role = 'admin_rencana_kerja'
  and (region_id is not null or team_id is not null);

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
    when public.current_access_role() in ('laporan', 'admin_harian') then
      resource = 'reports' and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_wilayah_bbm' then
      resource in ('reports', 'work_plans') and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_rencana_kerja' then
      resource = 'work_plans'
    when public.current_access_role() = 'admin_rencana_kerja_bbm' then
      resource = 'work_plans' and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_laporan_harian_rencana_kerja' then
      resource in ('reports', 'work_plans') and target_region = public.current_access_region()
    when public.current_access_role() in (
      'admin_laporan_mingguan_rencana_kerja',
      'admin_laporan_bulanan_rencana_kerja'
    ) then
      target_region = public.current_access_region()
      and (resource = 'work_plans' or (resource = 'reports' and action = 'select'))
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
    ) then resource = 'reports' and action = 'select'
    else false
  end
$$;

-- Keep region assignment for regional roles, but allow the global work-plan
-- administrator to choose the target region on each new work plan.
create or replace function public.assign_region_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_access_role() in (
    'admin_wilayah',
    'admin_wilayah_bbm',
    'laporan',
    'admin_harian',
    'admin_laporan_harian_rencana_kerja',
    'admin_laporan_mingguan_rencana_kerja',
    'admin_laporan_bulanan_rencana_kerja',
    'admin_rencana_kerja_bbm',
    'admin_rekap_lembur',
    'admin_nota_dinas',
    'user'
  ) then
    new.region_id := public.current_access_region();
  end if;
  return new;
end;
$$;
