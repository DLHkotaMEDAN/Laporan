-- Role Admin BBM Pusat: akses global ke tabel BBM Pusat yang terpisah.
-- Jalankan setelah 20260924_clone_admin_bbm_to_pusat_table.sql.

alter table public.fuel_reports_pusat enable row level security;
alter table public.fuel_prices_pusat enable row level security;

-- Data laporan Pusat hanya dapat dikelola oleh Super Admin dan Admin BBM Pusat.
-- Pimpinan hanya dapat membaca seluruh wilayah.
drop policy if exists "fuel_reports_pusat_select_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_select_authenticated"
on public.fuel_reports_pusat for select to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm_pusat', 'pimpinan')
);

drop policy if exists "fuel_reports_pusat_insert_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_insert_authenticated"
on public.fuel_reports_pusat for insert to authenticated
with check (
  public.current_access_role() in ('admin', 'admin_bbm_pusat')
);

drop policy if exists "fuel_reports_pusat_update_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_update_authenticated"
on public.fuel_reports_pusat for update to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm_pusat', 'pimpinan')
)
with check (
  public.current_access_role() in ('admin', 'admin_bbm_pusat')
);

drop policy if exists "fuel_reports_pusat_delete_authenticated" on public.fuel_reports_pusat;
create policy "fuel_reports_pusat_delete_authenticated"
on public.fuel_reports_pusat for delete to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm_pusat')
);

-- Master harga Pusat tetap dapat dibaca oleh pengguna terautentikasi,
-- tetapi hanya Super Admin dan Admin BBM Pusat yang boleh mengubahnya.
drop policy if exists "fuel_prices_pusat_write_admin_bbm" on public.fuel_prices_pusat;
create policy "fuel_prices_pusat_write_admin_bbm"
on public.fuel_prices_pusat for all to authenticated
using (
  public.current_access_role() in ('admin', 'admin_bbm_pusat')
)
with check (
  public.current_access_role() in ('admin', 'admin_bbm_pusat')
);
