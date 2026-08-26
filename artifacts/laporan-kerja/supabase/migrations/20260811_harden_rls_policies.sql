-- Harden RLS policies after the regional-access migration.
-- This migration intentionally replaces permissive `USING (true)` policies
-- with explicit role/resource checks.

create or replace function public.current_access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_access_region()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select region_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_access_team()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid()
$$;

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

-- Keep the old function signature for any existing policy or ad-hoc SQL that
-- still calls it, but make the fallback deny-by-default.
create or replace function public.has_region_access(
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
  select public.has_record_access(target_region, null, resource, action)
$$;

create or replace function public.has_fuel_access(resource text, action text)
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
      or action = 'select'
    when public.current_access_role() = 'admin_spj_bbm' then
      resource = 'fuel_spj_reports'
      or action = 'select'
    else false
  end
$$;

create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.current_access_role() = 'admin'
$$;

create or replace function public.has_fuel_price_write_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_access_role() in ('admin', 'admin_bbm', 'admin_spj_bbm')
$$;

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.work_plans enable row level security;
alter table public.fuel_reports enable row level security;
alter table public.fuel_spj_reports enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.regions enable row level security;
alter table public.teams enable row level security;

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self_user_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.has_admin_access());

create policy "profiles_insert_self_user_or_admin"
on public.profiles
for insert
to authenticated
with check (
  public.has_admin_access()
  or (id = auth.uid() and role = 'user')
);

create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.has_admin_access())
with check (public.has_admin_access());

create policy "profiles_delete_admin"
on public.profiles
for delete
to authenticated
using (public.has_admin_access());

-- Region/team master data is readable by logged-in users only.
drop policy if exists "Regions are readable" on public.regions;
drop policy if exists "Teams are readable" on public.teams;
drop policy if exists "regions_select_authenticated" on public.regions;
drop policy if exists "teams_select_authenticated" on public.teams;
drop policy if exists "regions_manage_admin" on public.regions;
drop policy if exists "teams_manage_admin" on public.teams;

create policy "regions_select_authenticated"
on public.regions
for select
to authenticated
using (true);

create policy "teams_select_authenticated"
on public.teams
for select
to authenticated
using (true);

create policy "regions_manage_admin"
on public.regions
for all
to authenticated
using (public.has_admin_access())
with check (public.has_admin_access());

create policy "teams_manage_admin"
on public.teams
for all
to authenticated
using (public.has_admin_access())
with check (public.has_admin_access());

-- Daily reports
drop policy if exists "Laporan dapat dilihat publik" on public.reports;
drop policy if exists "Hanya user login yang bisa menambah" on public.reports;
drop policy if exists "Hanya user login yang bisa mengubah" on public.reports;
drop policy if exists "Hanya user login yang bisa menghapus" on public.reports;
drop policy if exists "reports_region_select" on public.reports;
drop policy if exists "reports_region_insert" on public.reports;
drop policy if exists "reports_region_update" on public.reports;
drop policy if exists "reports_region_delete" on public.reports;
drop policy if exists "reports_select_authenticated" on public.reports;
drop policy if exists "reports_insert_authenticated" on public.reports;
drop policy if exists "reports_update_authenticated" on public.reports;
drop policy if exists "reports_delete_authenticated" on public.reports;

create policy "reports_select_authenticated"
on public.reports
for select
to authenticated
using (public.has_record_access(region_id, team_id, 'reports', 'select'));

create policy "reports_insert_authenticated"
on public.reports
for insert
to authenticated
with check (public.has_record_access(region_id, team_id, 'reports', 'insert'));

create policy "reports_update_authenticated"
on public.reports
for update
to authenticated
using (public.has_record_access(region_id, team_id, 'reports', 'update'))
with check (public.has_record_access(region_id, team_id, 'reports', 'update'));

create policy "reports_delete_authenticated"
on public.reports
for delete
to authenticated
using (public.has_record_access(region_id, team_id, 'reports', 'delete'));

-- Work plans
drop policy if exists "work_plans_select_policy" on public.work_plans;
drop policy if exists "work_plans_insert_policy" on public.work_plans;
drop policy if exists "work_plans_update_policy" on public.work_plans;
drop policy if exists "work_plans_delete_policy" on public.work_plans;
drop policy if exists "work_plans_region_select" on public.work_plans;
drop policy if exists "work_plans_region_insert" on public.work_plans;
drop policy if exists "work_plans_region_update" on public.work_plans;
drop policy if exists "work_plans_region_delete" on public.work_plans;
drop policy if exists "work_plans_select_authenticated" on public.work_plans;
drop policy if exists "work_plans_insert_authenticated" on public.work_plans;
drop policy if exists "work_plans_update_authenticated" on public.work_plans;
drop policy if exists "work_plans_delete_authenticated" on public.work_plans;

create policy "work_plans_select_authenticated"
on public.work_plans
for select
to authenticated
using (public.has_record_access(region_id, team_id, 'work_plans', 'select'));

create policy "work_plans_insert_authenticated"
on public.work_plans
for insert
to authenticated
with check (public.has_record_access(region_id, team_id, 'work_plans', 'insert'));

create policy "work_plans_update_authenticated"
on public.work_plans
for update
to authenticated
using (public.has_record_access(region_id, team_id, 'work_plans', 'update'))
with check (public.has_record_access(region_id, team_id, 'work_plans', 'update'));

create policy "work_plans_delete_authenticated"
on public.work_plans
for delete
to authenticated
using (public.has_record_access(region_id, team_id, 'work_plans', 'delete'));

-- Fuel reports
drop policy if exists "Allow all for authenticated users" on public.fuel_reports;
drop policy if exists "fuel_reports_select_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_insert_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_update_authenticated" on public.fuel_reports;
drop policy if exists "fuel_reports_delete_authenticated" on public.fuel_reports;

create policy "fuel_reports_select_authenticated"
on public.fuel_reports
for select
to authenticated
using (public.has_fuel_access('fuel_reports', 'select'));

create policy "fuel_reports_insert_authenticated"
on public.fuel_reports
for insert
to authenticated
with check (public.has_fuel_access('fuel_reports', 'insert'));

create policy "fuel_reports_update_authenticated"
on public.fuel_reports
for update
to authenticated
using (public.has_fuel_access('fuel_reports', 'update'))
with check (public.has_fuel_access('fuel_reports', 'update'));

create policy "fuel_reports_delete_authenticated"
on public.fuel_reports
for delete
to authenticated
using (public.has_fuel_access('fuel_reports', 'delete'));

-- Fuel SPJ reports
drop policy if exists "Allow read for all authenticated" on public.fuel_spj_reports;
drop policy if exists "Allow all for admin" on public.fuel_spj_reports;
drop policy if exists "fuel_spj_reports_select_authenticated" on public.fuel_spj_reports;
drop policy if exists "fuel_spj_reports_insert_authenticated" on public.fuel_spj_reports;
drop policy if exists "fuel_spj_reports_update_authenticated" on public.fuel_spj_reports;
drop policy if exists "fuel_spj_reports_delete_authenticated" on public.fuel_spj_reports;

create policy "fuel_spj_reports_select_authenticated"
on public.fuel_spj_reports
for select
to authenticated
using (public.has_fuel_access('fuel_spj_reports', 'select'));

create policy "fuel_spj_reports_insert_authenticated"
on public.fuel_spj_reports
for insert
to authenticated
with check (public.has_fuel_access('fuel_spj_reports', 'insert'));

create policy "fuel_spj_reports_update_authenticated"
on public.fuel_spj_reports
for update
to authenticated
using (public.has_fuel_access('fuel_spj_reports', 'update'))
with check (public.has_fuel_access('fuel_spj_reports', 'update'));

create policy "fuel_spj_reports_delete_authenticated"
on public.fuel_spj_reports
for delete
to authenticated
using (public.has_fuel_access('fuel_spj_reports', 'delete'));

-- Fuel prices
drop policy if exists "Allow read for all authenticated_prices" on public.fuel_prices;
drop policy if exists "Allow all for admin_prices" on public.fuel_prices;
drop policy if exists "fuel_prices_select_authenticated" on public.fuel_prices;
drop policy if exists "fuel_prices_write_admin_bbm" on public.fuel_prices;

create policy "fuel_prices_select_authenticated"
on public.fuel_prices
for select
to authenticated
using (true);

create policy "fuel_prices_write_admin_bbm"
on public.fuel_prices
for all
to authenticated
using (public.has_fuel_price_write_access())
with check (public.has_fuel_price_write_access());

-- Audit logs
drop policy if exists "Admins can view audit logs" on public.audit_logs;
drop policy if exists "Users can insert audit logs" on public.audit_logs;
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_delete_admin" on public.audit_logs;

create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.has_admin_access());

create policy "audit_logs_insert_authenticated"
on public.audit_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "audit_logs_delete_admin"
on public.audit_logs
for delete
to authenticated
using (public.has_admin_access());

-- Storage policies. report-photos remains public-read for compatibility with
-- existing public URLs. Management is tightened.
drop policy if exists "Public Read Report Photos" on storage.objects;
drop policy if exists "Auth Insert Report Photos" on storage.objects;
drop policy if exists "Auth Update Report Photos" on storage.objects;
drop policy if exists "Auth Delete Report Photos" on storage.objects;
drop policy if exists "Public Read Assets" on storage.objects;
drop policy if exists "Auth Manage Assets" on storage.objects;
drop policy if exists "report_photos_public_read" on storage.objects;
drop policy if exists "report_photos_insert_authenticated" on storage.objects;
drop policy if exists "report_photos_update_owner_or_admin" on storage.objects;
drop policy if exists "report_photos_delete_owner_or_admin" on storage.objects;
drop policy if exists "assets_public_read" on storage.objects;
drop policy if exists "assets_manage_admin" on storage.objects;

create policy "report_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'report-photos');

create policy "report_photos_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'report-photos');

create policy "report_photos_update_owner_or_admin"
on storage.objects
for update
to authenticated
using (bucket_id = 'report-photos' and (owner = auth.uid() or public.has_admin_access()))
with check (bucket_id = 'report-photos' and (owner = auth.uid() or public.has_admin_access()));

create policy "report_photos_delete_owner_or_admin"
on storage.objects
for delete
to authenticated
using (bucket_id = 'report-photos' and (owner = auth.uid() or public.has_admin_access()));

create policy "assets_public_read"
on storage.objects
for select
to public
using (bucket_id = 'assets');

create policy "assets_manage_admin"
on storage.objects
for all
to authenticated
using (bucket_id = 'assets' and public.has_admin_access())
with check (bucket_id = 'assets' and public.has_admin_access());
