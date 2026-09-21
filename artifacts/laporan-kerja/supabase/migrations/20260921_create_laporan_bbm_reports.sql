-- Laporan BBM disimpan di tabel terpisah agar tabel fuel_reports Admin BBM
-- yang sudah ada tidak berubah dan tidak tercampur.
create table if not exists public.laporan_bbm_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  region text not null,
  team text not null,
  region_id uuid references public.regions(id) on delete restrict,
  team_id uuid references public.teams(id) on delete restrict,
  no_spj text,
  items jsonb not null default '[]'::jsonb,
  remarks text not null default '',
  price_pertamax numeric not null default 0,
  price_dexlite numeric not null default 0,
  pimpinan_note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists laporan_bbm_reports_region_date_idx
  on public.laporan_bbm_reports (region_id, date desc);

alter table public.laporan_bbm_reports enable row level security;

drop policy if exists "laporan_bbm_reports_select" on public.laporan_bbm_reports;
create policy "laporan_bbm_reports_select"
on public.laporan_bbm_reports for select to authenticated
using (
  public.current_access_role() = 'admin'
  or (
    public.current_access_role() = 'admin_laporan_bbm'
    and region_id = public.current_access_region()
  )
);

drop policy if exists "laporan_bbm_reports_insert" on public.laporan_bbm_reports;
create policy "laporan_bbm_reports_insert"
on public.laporan_bbm_reports for insert to authenticated
with check (
  public.current_access_role() = 'admin'
  or (
    public.current_access_role() = 'admin_laporan_bbm'
    and region_id = public.current_access_region()
  )
);

drop policy if exists "laporan_bbm_reports_update" on public.laporan_bbm_reports;
create policy "laporan_bbm_reports_update"
on public.laporan_bbm_reports for update to authenticated
using (
  public.current_access_role() = 'admin'
  or (
    public.current_access_role() = 'admin_laporan_bbm'
    and region_id = public.current_access_region()
  )
)
with check (
  public.current_access_role() = 'admin'
  or (
    public.current_access_role() = 'admin_laporan_bbm'
    and region_id = public.current_access_region()
  )
);

drop policy if exists "laporan_bbm_reports_delete" on public.laporan_bbm_reports;
create policy "laporan_bbm_reports_delete"
on public.laporan_bbm_reports for delete to authenticated
using (
  public.current_access_role() = 'admin'
  or (
    public.current_access_role() = 'admin_laporan_bbm'
    and region_id = public.current_access_region()
  )
);
