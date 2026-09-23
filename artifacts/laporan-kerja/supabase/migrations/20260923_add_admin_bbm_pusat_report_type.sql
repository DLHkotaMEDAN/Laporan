-- Menjamin kolom tipe tersedia pada tabel lama Admin BBM.
-- Data Admin BBM Pusat sendiri dipindahkan ke tabel fisik terpisah oleh
-- migration 20260924_clone_admin_bbm_to_pusat_table.sql.
alter table public.fuel_reports
  add column if not exists report_type text not null default 'admin_bbm';

-- Data lama tetap dianggap sebagai data Admin BBM biasa.
update public.fuel_reports
set report_type = 'admin_bbm'
where report_type is null;

create index if not exists fuel_reports_report_type_date_idx
  on public.fuel_reports (report_type, date desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.fuel_reports'::regclass
      and conname = 'fuel_reports_report_type_check'
  ) then
    alter table public.fuel_reports
      add constraint fuel_reports_report_type_check
      check (report_type in ('admin_bbm', 'admin_bbm_pusat'));
  end if;
end $$;
