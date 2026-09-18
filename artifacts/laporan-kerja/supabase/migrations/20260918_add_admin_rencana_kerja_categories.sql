-- Limit each global work-plan administrator to the selected work-plan categories.
alter table public.profiles
  add column if not exists work_plan_categories text[] not null default '{}';

-- Preserve access for existing global work-plan administrators until their
-- category list is adjusted in User Management.
update public.profiles
set work_plan_categories = array(
  select distinct team.name
  from public.teams team
  where team.is_active
  order by team.name
)
where role = 'admin_rencana_kerja'
  and cardinality(work_plan_categories) = 0;

alter table public.profiles
  drop constraint if exists profiles_admin_rencana_kerja_categories_check;

alter table public.profiles
  add constraint profiles_admin_rencana_kerja_categories_check
  check (
    role <> 'admin_rencana_kerja'
    or cardinality(work_plan_categories) > 0
  );

create or replace function public.current_work_plan_categories()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select work_plan_categories from public.profiles where id = auth.uid()
$$;

create or replace function public.has_work_plan_access(
  target_region uuid,
  target_team uuid,
  target_category text,
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
    when public.current_access_role() = 'admin_rencana_kerja' then
      target_category = any(coalesce(public.current_work_plan_categories(), '{}'::text[]))
    else public.has_record_access(target_region, target_team, 'work_plans', action)
  end
$$;

drop policy if exists "work_plans_select_authenticated" on public.work_plans;
drop policy if exists "work_plans_insert_authenticated" on public.work_plans;
drop policy if exists "work_plans_update_authenticated" on public.work_plans;
drop policy if exists "work_plans_delete_authenticated" on public.work_plans;

create policy "work_plans_select_authenticated"
on public.work_plans for select to authenticated
using (public.has_work_plan_access(region_id, team_id, category, 'select'));

create policy "work_plans_insert_authenticated"
on public.work_plans for insert to authenticated
with check (public.has_work_plan_access(region_id, team_id, category, 'insert'));

create policy "work_plans_update_authenticated"
on public.work_plans for update to authenticated
using (public.has_work_plan_access(region_id, team_id, category, 'update'))
with check (public.has_work_plan_access(region_id, team_id, category, 'update'));

create policy "work_plans_delete_authenticated"
on public.work_plans for delete to authenticated
using (public.has_work_plan_access(region_id, team_id, category, 'delete'));
