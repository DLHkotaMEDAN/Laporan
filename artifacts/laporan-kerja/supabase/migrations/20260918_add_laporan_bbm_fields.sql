-- Laporan BBM memakai penyimpanan yang sama dengan Admin BBM, tetapi dipisahkan
-- melalui report_type agar data dan rekap masing-masing tidak bercampur.
alter table public.fuel_reports
  add column if not exists report_type text not null default 'admin_bbm',
  add column if not exists no_spj text;

alter table public.fuel_reports
  drop constraint if exists fuel_reports_report_type_check;

alter table public.fuel_reports
  add constraint fuel_reports_report_type_check
  check (report_type in ('admin_bbm', 'laporan_bbm'));

create index if not exists fuel_reports_report_type_region_date_idx
  on public.fuel_reports (report_type, region_id, date desc);
