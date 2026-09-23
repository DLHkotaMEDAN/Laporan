-- Hapus permanen modul Laporan SPJ BBM beserta seluruh datanya.
-- CASCADE membersihkan policy, index, constraint, dan objek turunan tabel.
drop table if exists public.fuel_spj_reports cascade;

-- Role admin_spj_bbm tetap dipertahankan untuk kompatibilitas akun lama dan
-- akses SPJ Oli, tetapi tidak lagi memiliki akses ke modul BBM yang dihapus.
create or replace function public.has_fuel_access(resource text, action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role() = 'admin' then true
    when public.current_access_role() = 'pimpinan' then action in ('select', 'update')
    when public.current_access_role() in ('admin_bbm', 'admin_rencana_kerja_bbm', 'admin_wilayah_bbm') then
      resource = 'fuel_reports' or action = 'select'
    else false
  end
$$;

create or replace function public.has_fuel_price_write_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_access_role() in ('admin', 'admin_bbm', 'admin_rencana_kerja_bbm', 'admin_wilayah_bbm')
$$;
