alter table public.overtime_records
  add column if not exists team_id uuid references public.teams(id) on delete restrict;

create index if not exists overtime_records_team_id_idx on public.overtime_records(team_id);
create index if not exists overtime_records_nip_idx on public.overtime_records(nip);
