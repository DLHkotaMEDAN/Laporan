alter table public.profiles
  add column if not exists region_id uuid references public.regions(id) on delete restrict,
  add column if not exists team_id uuid references public.teams(id) on delete restrict;

create index if not exists profiles_region_id_idx on public.profiles(region_id);
create index if not exists profiles_team_id_idx on public.profiles(team_id);
