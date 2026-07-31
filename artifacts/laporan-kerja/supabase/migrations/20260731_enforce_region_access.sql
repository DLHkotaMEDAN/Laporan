create or replace function public.current_access_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_access_region()
returns uuid language sql stable security definer set search_path = public as $$
  select region_id from public.profiles where id = auth.uid()
$$;

create or replace function public.has_region_access(target_region uuid, resource text, action text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.current_access_role() in ('admin', 'pimpinan') then true
    when public.current_access_role() = 'admin_wilayah' then target_region = public.current_access_region()
    when public.current_access_role() = 'admin_harian' then resource = 'reports' and target_region = public.current_access_region()
    when public.current_access_role() = 'admin_rencana_kerja' then resource = 'work_plans' and target_region = public.current_access_region()
    else true
  end
$$;

create or replace function public.assign_region_from_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_access_role() in ('admin_wilayah', 'admin_harian', 'admin_rencana_kerja') then
    new.region_id := public.current_access_region();
  end if;
  return new;
end;
$$;

drop trigger if exists reports_assign_region on public.reports;
create trigger reports_assign_region before insert on public.reports for each row execute function public.assign_region_from_profile();
drop trigger if exists work_plans_assign_region on public.work_plans;
create trigger work_plans_assign_region before insert on public.work_plans for each row execute function public.assign_region_from_profile();

drop policy if exists "Laporan dapat dilihat publik" on public.reports;
drop policy if exists "Hanya user login yang bisa menambah" on public.reports;
drop policy if exists "Hanya user login yang bisa mengubah" on public.reports;
drop policy if exists "Hanya user login yang bisa menghapus" on public.reports;
create policy "reports_region_select" on public.reports for select using (public.has_region_access(region_id, 'reports', 'select'));
create policy "reports_region_insert" on public.reports for insert with check (public.has_region_access(region_id, 'reports', 'insert'));
create policy "reports_region_update" on public.reports for update using (public.has_region_access(region_id, 'reports', 'update')) with check (public.has_region_access(region_id, 'reports', 'update'));
create policy "reports_region_delete" on public.reports for delete using (public.has_region_access(region_id, 'reports', 'delete'));

drop policy if exists "work_plans_select_policy" on public.work_plans;
drop policy if exists "work_plans_insert_policy" on public.work_plans;
drop policy if exists "work_plans_update_policy" on public.work_plans;
drop policy if exists "work_plans_delete_policy" on public.work_plans;
create policy "work_plans_region_select" on public.work_plans for select using (public.has_region_access(region_id, 'work_plans', 'select'));
create policy "work_plans_region_insert" on public.work_plans for insert with check (public.has_region_access(region_id, 'work_plans', 'insert'));
create policy "work_plans_region_update" on public.work_plans for update using (public.has_region_access(region_id, 'work_plans', 'update')) with check (public.has_region_access(region_id, 'work_plans', 'update'));
create policy "work_plans_region_delete" on public.work_plans for delete using (public.has_region_access(region_id, 'work_plans', 'delete'));
