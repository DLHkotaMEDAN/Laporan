-- Admin BBM Pusat adalah salinan fisik Admin BBM.
-- Setelah migration ini, kedua area memakai tabel berbeda dan tidak saling
-- membaca atau mengubah data. Salinan awal dilakukan satu kali di sini.

-- Pastikan skema sumber lengkap walaupun migration 20260923 belum dijalankan.
alter table public.fuel_reports
  add column if not exists report_type text;

alter table public.fuel_reports
  alter column report_type set default 'admin_bbm';

update public.fuel_reports
set report_type = 'admin_bbm'
where report_type is null;

create table if not exists public.fuel_reports_pusat
  (like public.fuel_reports including defaults including generated);

-- Aman dijalankan ulang jika tabel pusat sempat terbentuk sebelum kolom ini ada.
alter table public.fuel_reports_pusat
  add column if not exists report_type text;

alter table public.fuel_reports_pusat
  alter column report_type set default 'admin_bbm_pusat';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fuel_reports_pusat'::regclass
      and conname = 'fuel_reports_pusat_pkey'
  ) then
    alter table public.fuel_reports_pusat add primary key (id);
  end if;
end $$;

insert into public.fuel_reports_pusat
select *
from public.fuel_reports
where coalesce(report_type, 'admin_bbm') in ('admin_bbm', 'admin_bbm_pusat')
on conflict (id) do nothing;

update public.fuel_reports_pusat
set report_type = 'admin_bbm_pusat';

-- Jika versi awal tab pusat sempat menulis ke fuel_reports, pindahkan hasil
-- awalnya ke tabel pusat agar tidak ada data pusat yang tersisa di tabel lama.
delete from public.fuel_reports
where report_type = 'admin_bbm_pusat';

create index if not exists fuel_reports_pusat_region_date_idx
  on public.fuel_reports_pusat (region_id, date desc);

create index if not exists fuel_reports_pusat_report_type_date_idx
  on public.fuel_reports_pusat (report_type, date desc);

-- Master harga juga disalin agar perubahan harga Admin BBM Pusat tidak
-- memengaruhi master harga Admin BBM.
create table if not exists public.fuel_prices_pusat
  (like public.fuel_prices including defaults including generated);

insert into public.fuel_prices_pusat
select *
from public.fuel_prices source_prices
where not exists (
  select 1
  from public.fuel_prices_pusat target_prices
  where target_prices.type = source_prices.type
);

create unique index if not exists fuel_prices_pusat_type_uidx
  on public.fuel_prices_pusat (type);

alter table public.fuel_prices_pusat enable row level security;

drop policy if exists "fuel_prices_pusat_select_authenticated" on public.fuel_prices_pusat;
create policy "fuel_prices_pusat_select_authenticated"
on public.fuel_prices_pusat for select to authenticated
using (true);

drop policy if exists "fuel_prices_pusat_write_admin_bbm" on public.fuel_prices_pusat;
create policy "fuel_prices_pusat_write_admin_bbm"
on public.fuel_prices_pusat for all to authenticated
using (public.has_fuel_price_write_access())
with check (public.has_fuel_price_write_access());

alter table public.fuel_reports_pusat enable row level security;

drop policy if exists "fuel_reports_pusat_select_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_select_authenticated"
on public.fuel_reports_pusat for select to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
  or public.current_access_role() = 'pimpinan'
);

drop policy if exists "fuel_reports_pusat_insert_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_insert_authenticated"
on public.fuel_reports_pusat for insert to authenticated
with check (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);

drop policy if exists "fuel_reports_pusat_update_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_update_authenticated"
on public.fuel_reports_pusat for update to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
  or public.current_access_role() = 'pimpinan'
)
with check (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);

drop policy if exists "fuel_reports_pusat_delete_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_delete_authenticated"
on public.fuel_reports_pusat for delete to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm')
  or (
    public.current_access_role() in ('admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
    and region_id = public.current_access_region()
  )
);
