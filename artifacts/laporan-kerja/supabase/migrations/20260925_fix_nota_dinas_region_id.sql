-- ============================================================
-- Perbaikan region_id NULL pada nota_dinas_records yang dibuat
-- oleh super admin. Sebelumnya super admin tidak mengisi region_id
-- karena trigger hanya berjalan untuk role admin_nota_dinas.
-- ============================================================

-- 1. Isi region_id yang masih NULL berdasarkan nama wilayah di JSON form
UPDATE public.nota_dinas_records AS r
SET region_id = reg.id
FROM public.regions AS reg
WHERE r.region_id IS NULL
  AND lower(trim(r.form ->> 'wilayah')) = lower(trim(reg.name));

-- 2. Perbarui fungsi has_nota_dinas_region_access agar super admin
--    selalu bisa akses semua data (sudah benar), dan admin nota dinas
--    bisa lihat data dengan region_id sesuai wilayahnya.
--    Sebelumnya ada bug: jika target_region IS NULL, admin wilayah
--    tidak bisa melihat data tersebut.
CREATE OR REPLACE FUNCTION public.has_nota_dinas_region_access(target_region uuid, action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      -- Super admin selalu bisa akses semua
      public.current_access_role() = 'admin'
      OR (
        -- Admin nota dinas hanya bisa akses wilayahnya
        public.current_access_role() = 'admin_nota_dinas'
        AND target_region IS NOT NULL
        AND target_region = public.current_access_region()
        AND action IN ('select', 'insert', 'update', 'delete')
      )
    )
$$;
