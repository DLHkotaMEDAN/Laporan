-- Peran khusus untuk Tab Laporan BBM. Peran ini selalu dibatasi oleh wilayah
-- akun dan hanya dapat mengelola record bertipe laporan_bbm.
drop policy if exists "laporan_bbm_select_regional" on public.fuel_reports;
create policy "laporan_bbm_select_regional"
on public.fuel_reports for select to authenticated
using (
  public.current_access_role() = 'admin_laporan_bbm'
  and report_type = 'laporan_bbm'
  and region_id = public.current_access_region()
);

drop policy if exists "laporan_bbm_insert_regional" on public.fuel_reports;
create policy "laporan_bbm_insert_regional"
on public.fuel_reports for insert to authenticated
with check (
  public.current_access_role() = 'admin_laporan_bbm'
  and report_type = 'laporan_bbm'
  and region_id = public.current_access_region()
);

drop policy if exists "laporan_bbm_update_regional" on public.fuel_reports;
create policy "laporan_bbm_update_regional"
on public.fuel_reports for update to authenticated
using (
  public.current_access_role() = 'admin_laporan_bbm'
  and report_type = 'laporan_bbm'
  and region_id = public.current_access_region()
)
with check (
  public.current_access_role() = 'admin_laporan_bbm'
  and report_type = 'laporan_bbm'
  and region_id = public.current_access_region()
);

drop policy if exists "laporan_bbm_delete_regional" on public.fuel_reports;
create policy "laporan_bbm_delete_regional"
on public.fuel_reports for delete to authenticated
using (
  public.current_access_role() = 'admin_laporan_bbm'
  and report_type = 'laporan_bbm'
  and region_id = public.current_access_region()
);
