-- Cleanup RLS dead code — 8 Oktober 2026
-- ============================================================
-- Tujuan:
--   1. Hapus role-role lama dari has_record_access() yang sudah tidak ada
--      di aplikasi (access-control.ts) sejak refactor role besar.
--   2. Bersihkan assign_region_from_profile() trigger dari role lama.
--   3. Drop has_fuel_access() yang sudah digantikan oleh inline RLS policy
--      sejak migration 20260908_fix_admin_bbm_fuel_insert_rls.sql.
--
-- Tidak ada perubahan logika untuk role aktif — hanya membuang dead code.
-- Role aktif yang dicakup migrasi ini (tidak berubah perilakunya):
--   admin, pimpinan, admin_wilayah, laporan, admin_wilayah_bbm,
--   admin_rencana_kerja, admin_rencana_kerja_bbm, user
-- ============================================================

-- ── 1. has_record_access() — hapus semua role lama ───────────────────────
create or replace function public.has_record_access(
  target_region uuid,
  target_team   uuid,
  resource      text,
  action        text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Tidak terautentikasi → tolak
    when auth.uid() is null then false

    -- Super Admin → akses penuh
    when public.current_access_role() = 'admin' then true

    -- Pimpinan → baca & update saja
    when public.current_access_role() = 'pimpinan'
      then action in ('select', 'update')

    -- Admin Wilayah → semua operasi dalam wilayahnya
    when public.current_access_role() = 'admin_wilayah'
      then target_region = public.current_access_region()

    -- Admin Wilayah + BBM → laporan & rencana kerja dalam wilayahnya
    -- (akses fuel_reports diatur lewat inline policy di fuel_reports)
    when public.current_access_role() = 'admin_wilayah_bbm'
      then resource in ('reports', 'work_plans')
       and target_region = public.current_access_region()

    -- Laporan → hanya laporan harian dalam wilayahnya
    when public.current_access_role() = 'laporan'
      then resource = 'reports'
       and target_region = public.current_access_region()

    -- Admin Rencana Kerja → semua wilayah, work_plans saja
    when public.current_access_role() = 'admin_rencana_kerja'
      then resource = 'work_plans'

    -- Admin Rencana Kerja + BBM → work_plans dalam wilayahnya
    -- (akses fuel_reports diatur lewat inline policy di fuel_reports)
    when public.current_access_role() = 'admin_rencana_kerja_bbm'
      then resource = 'work_plans'
       and target_region = public.current_access_region()

    -- Pengguna Tim → laporan & rencana kerja dalam tim & wilayahnya
    when public.current_access_role() = 'user'
      then resource in ('reports', 'work_plans')
       and target_region = public.current_access_region()
       and target_team   = public.current_access_team()

    -- Semua role lain (termasuk role lama yang sudah tidak ada) → tolak
    else false
  end
$$;

-- ── 2. assign_region_from_profile() trigger — hapus role lama ────────────
create or replace function public.assign_region_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Role-role yang wajib mewarisi region_id dari profil saat INSERT.
  -- admin dan admin_rencana_kerja bersifat global (tidak punya region_id).
  if public.current_access_role() in (
    'admin_wilayah',
    'admin_wilayah_bbm',
    'laporan',
    'admin_rencana_kerja_bbm',
    'admin_rekap_lembur',
    'admin_nota_dinas',
    'user'
  ) then
    new.region_id := public.current_access_region();
  end if;
  return new;
end;
$$;

-- ── 3. Drop has_fuel_access() yang sudah tidak dipakai ───────────────────
-- Fungsi ini digantikan sepenuhnya oleh inline RLS policy di:
--   20260908_fix_admin_bbm_fuel_insert_rls.sql
-- dan tabel terpisah fuel_reports_pusat di:
--   20260925_add_admin_bbm_pusat_role.sql
-- Pastikan tidak ada policy yang masih merujuk fungsi ini sebelum drop.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where qual::text ilike '%has_fuel_access%'
       or with_check::text ilike '%has_fuel_access%'
  ) then
    drop function if exists public.has_fuel_access(text, text);
  else
    raise notice 'has_fuel_access() masih dirujuk oleh satu atau lebih policy — tidak di-drop. Periksa manual.';
  end if;
end $$;
