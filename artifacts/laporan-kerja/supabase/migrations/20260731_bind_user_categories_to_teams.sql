-- Tim adalah master kategori per wilayah. Kolom category lama dipertahankan
-- sebagai label kompatibilitas untuk laporan, rencana kerja, dan tampilan lama.

create or replace function public.sync_profile_team_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  selected_team public.teams;
begin
  if new.role = 'user' then
    if new.team_id is null then
      raise exception 'Pengguna tim wajib memiliki tim.';
    end if;

    select * into selected_team
    from public.teams
    where id = new.team_id and is_active;

    if not found then
      raise exception 'Tim tidak valid atau tidak aktif.';
    end if;

    new.region_id := selected_team.region_id;
    new.category := selected_team.name;
  else
    new.team_id := null;
    new.category := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_team_category on public.profiles;
create trigger profiles_sync_team_category
before insert or update of role, category, region_id, team_id on public.profiles
for each row execute function public.sync_profile_team_category();

create or replace function public.validate_record_team()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  selected_team public.teams;
begin
  if new.team_id is null then
    raise exception 'Tim wajib dipilih.';
  end if;

  select * into selected_team
  from public.teams
  where id = new.team_id and is_active;

  if not found then
    raise exception 'Tim tidak valid atau tidak aktif.';
  end if;
  if new.region_id is distinct from selected_team.region_id then
    raise exception 'Tim tidak sesuai dengan wilayah.';
  end if;

  new.category := selected_team.name;
  return new;
end;
$$;

drop trigger if exists reports_validate_team on public.reports;
create trigger reports_validate_team
before insert or update of region_id, team_id on public.reports
for each row execute function public.validate_record_team();

drop trigger if exists work_plans_validate_team on public.work_plans;
create trigger work_plans_validate_team
before insert or update of region_id, team_id on public.work_plans
for each row execute function public.validate_record_team();

-- Data lama Wilayah 4 tetap dipetakan ke master tim yang sudah ada.
update public.profiles profile
set team_id = team.id
from public.teams team
where profile.role = 'user'
  and profile.team_id is null
  and team.region_id = profile.region_id
  and team.name = profile.category;

update public.reports report
set team_id = team.id
from public.teams team
where report.team_id is null
  and team.region_id = report.region_id
  and team.name = report.category;

update public.work_plans plan
set team_id = team.id
from public.teams team
where plan.team_id is null
  and team.region_id = plan.region_id
  and team.name = plan.category;
