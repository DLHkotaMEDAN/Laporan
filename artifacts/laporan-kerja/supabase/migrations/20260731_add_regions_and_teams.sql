-- Migrasi aditif: mempertahankan kolom category, region, dan team lama.
-- Jalankan sekali melalui Supabase SQL Editor.

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (region_id, name)
);

insert into public.regions (code, name, sort_order) values
  ('pusat', 'Pusat', 1),
  ('wilayah-1', 'Wilayah 1 Medan Utara', 2),
  ('wilayah-2', 'Wilayah 2 Medan Barat', 3),
  ('wilayah-3', 'Wilayah 3 Medan Timur', 4),
  ('wilayah-4', 'Wilayah 4 Medan Kota', 5),
  ('wilayah-5', 'Wilayah 5 Medan Selatan', 6)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.teams (region_id, name)
select regions.id, seeded_teams.name
from public.regions regions
cross join (values
  ('Tim Pohon'),
  ('Tim Babat'),
  ('Tim Siram'),
  ('Taman Kota'),
  ('Taman Area'),
  ('Taman Amplas')
) as seeded_teams(name)
where regions.code = 'wilayah-4'
on conflict (region_id, name) do update set is_active = true;

alter table public.reports add column if not exists region_id uuid references public.regions(id) on delete restrict;
alter table public.reports add column if not exists team_id uuid references public.teams(id) on delete restrict;
alter table public.work_plans add column if not exists region_id uuid references public.regions(id) on delete restrict;
alter table public.work_plans add column if not exists team_id uuid references public.teams(id) on delete restrict;
alter table public.fuel_reports add column if not exists region_id uuid references public.regions(id) on delete restrict;
alter table public.fuel_reports add column if not exists team_id uuid references public.teams(id) on delete restrict;
alter table public.fuel_spj_reports add column if not exists region_id uuid references public.regions(id) on delete restrict;
alter table public.fuel_spj_reports add column if not exists team_id uuid references public.teams(id) on delete restrict;

update public.reports report
set region_id = region.id,
    team_id = (
      select team.id
      from public.teams team
      where team.region_id = region.id and team.name = report.category
    )
from public.regions region
where region.code = 'wilayah-4'
  and report.region_id is null;

update public.work_plans plan
set region_id = region.id,
    team_id = (
      select team.id
      from public.teams team
      where team.region_id = region.id and team.name = plan.category
    )
from public.regions region
where region.code = 'wilayah-4'
  and plan.region_id is null;

update public.fuel_reports fuel
set region_id = region.id,
    team_id = (
      select team.id
      from public.teams team
      where team.region_id = region.id and team.name = fuel.team
    )
from public.regions region
where region.code = case fuel.region
  when 'Pusat' then 'pusat'
  when 'Wilayah 1 Utara' then 'wilayah-1'
  when 'Wilayah 2 Barat' then 'wilayah-2'
  when 'Wilayah 3 Timur' then 'wilayah-3'
  when 'Wilayah 4 Kota' then 'wilayah-4'
  when 'Wilayah 5 Selatan' then 'wilayah-5'
  else null
end
and fuel.region_id is null;

update public.fuel_spj_reports fuel
set region_id = region.id,
    team_id = (
      select team.id
      from public.teams team
      where team.region_id = region.id and team.name = fuel.team
    )
from public.regions region
where region.code = case fuel.region
  when 'Pusat' then 'pusat'
  when 'Wilayah 1 Utara' then 'wilayah-1'
  when 'Wilayah 2 Barat' then 'wilayah-2'
  when 'Wilayah 3 Timur' then 'wilayah-3'
  when 'Wilayah 4 Kota' then 'wilayah-4'
  when 'Wilayah 5 Selatan' then 'wilayah-5'
  else null
end
and fuel.region_id is null;

alter table public.regions enable row level security;
alter table public.teams enable row level security;

drop policy if exists "Regions are readable" on public.regions;
drop policy if exists "Teams are readable" on public.teams;
create policy "Regions are readable" on public.regions for select using (true);
create policy "Teams are readable" on public.teams for select using (true);

create index if not exists reports_region_id_idx on public.reports(region_id);
create index if not exists work_plans_region_id_idx on public.work_plans(region_id);
create index if not exists fuel_reports_region_id_idx on public.fuel_reports(region_id);
create index if not exists fuel_spj_reports_region_id_idx on public.fuel_spj_reports(region_id);
