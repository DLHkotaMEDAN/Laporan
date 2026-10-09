-- DEPENDENCY: This migration MUST run AFTER 20261008_cleanup_rls_dead_code.sql.
-- The 'zzz' prefix guarantees alphabetical ordering keeps it last among all
-- 20261008_* migrations. Do NOT rename this file to an earlier suffix.
-- Migrasi ini menambahkan kolom roles[] dan menimpa fungsi has_record_access()
-- yang didefinisikan ulang di 20261008_cleanup_rls_dead_code.sql.

-- Tambah kolom roles (array) ke tabel profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}';

-- Migrasi data: simple role mapping
UPDATE profiles SET roles = ARRAY['administrator'] WHERE role = 'admin' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['pimpinan'] WHERE role = 'pimpinan' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['laporan_kerja'] WHERE role = 'laporan' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['laporan_kerja','rencana_kerja'] WHERE role = 'admin_wilayah' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['rencana_kerja'] WHERE role = 'admin_rencana_kerja' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['rekap_lembur'] WHERE role = 'admin_rekap_lembur' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['bbm'] WHERE role = 'admin_bbm' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['bbm_pusat'] WHERE role = 'admin_bbm_pusat' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['laporan_bbm'] WHERE role = 'admin_laporan_bbm' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['spj_oli'] WHERE role IN ('admin_spj_bbm','admin_spj_oli') AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['nota_dinas'] WHERE role = 'admin_nota_dinas' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['pengguna_tim'] WHERE role = 'user' AND (roles IS NULL OR roles = '{}');
-- Combined roles: pisah menjadi array
UPDATE profiles SET roles = ARRAY['laporan_kerja','rencana_kerja','bbm'] WHERE role = 'admin_wilayah_bbm' AND (roles IS NULL OR roles = '{}');
UPDATE profiles SET roles = ARRAY['rencana_kerja','bbm'] WHERE role = 'admin_rencana_kerja_bbm' AND (roles IS NULL OR roles = '{}');

-- Fungsi current_access_roles() mengembalikan text[]
CREATE OR REPLACE FUNCTION public.current_access_roles()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT roles FROM profiles WHERE id = auth.uid()),
    '{}'::text[]
  );
$$;

-- Fungsi has_role(role_name text) returns boolean
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role_name = ANY(public.current_access_roles());
$$;

-- Tulis ulang has_record_access() pakai has_role() dengan OR semantics
CREATE OR REPLACE FUNCTION public.has_record_access(record_region_id uuid, record_category text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  user_roles text[];
  user_region_id uuid;
BEGIN
  SELECT roles, region_id INTO user_roles, user_region_id
  FROM profiles WHERE id = auth.uid();

  -- administrator dan pimpinan: akses semua
  IF 'administrator' = ANY(user_roles) OR 'pimpinan' = ANY(user_roles) THEN
    RETURN TRUE;
  END IF;

  -- Cek akses per-wilayah untuk laporan_kerja dan rencana_kerja
  IF ('laporan_kerja' = ANY(user_roles) OR 'rencana_kerja' = ANY(user_roles)) THEN
    IF user_region_id = record_region_id THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- rekap_lembur: akses berdasarkan region
  IF 'rekap_lembur' = ANY(user_roles) AND user_region_id = record_region_id THEN
    RETURN TRUE;
  END IF;

  -- bbm, bbm_pusat, laporan_bbm, spj_oli: akses fuel berdasarkan region
  IF ('bbm' = ANY(user_roles) OR 'bbm_pusat' = ANY(user_roles) OR
      'laporan_bbm' = ANY(user_roles) OR 'spj_oli' = ANY(user_roles)) THEN
    IF user_region_id = record_region_id OR 'bbm_pusat' = ANY(user_roles) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- nota_dinas: akses berdasarkan kategori/region
  IF 'nota_dinas' = ANY(user_roles) AND user_region_id = record_region_id THEN
    RETURN TRUE;
  END IF;

  -- pengguna_tim: akses berdasarkan region
  IF 'pengguna_tim' = ANY(user_roles) AND user_region_id = record_region_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Update trigger assign_region_from_profile() pakai has_role()
CREATE OR REPLACE FUNCTION public.assign_region_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  user_roles text[];
  user_region_id uuid;
BEGIN
  SELECT roles, region_id INTO user_roles, user_region_id
  FROM profiles WHERE id = auth.uid();

  -- Jika role memerlukan region assignment otomatis
  IF ('laporan_kerja' = ANY(user_roles) OR 'rencana_kerja' = ANY(user_roles)
      OR 'rekap_lembur' = ANY(user_roles) OR 'bbm' = ANY(user_roles)
      OR 'laporan_bbm' = ANY(user_roles) OR 'spj_oli' = ANY(user_roles)
      OR 'nota_dinas' = ANY(user_roles) OR 'pengguna_tim' = ANY(user_roles)) THEN
    NEW.region_id = COALESCE(NEW.region_id, user_region_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ── Update fungsi-fungsi RLS yang masih pakai current_access_role() lama ─

-- 1. SPJ Oli — has_spj_oli_record_access()
CREATE OR REPLACE FUNCTION public.has_spj_oli_record_access(target_region uuid, action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    -- administrator: akses penuh
    'administrator' = ANY(public.current_access_roles())
    -- pimpinan: baca & update
    OR ('pimpinan' = ANY(public.current_access_roles()) AND action IN ('select', 'update'))
    -- spj_oli: akses semua wilayah jika tidak ada region, atau wilayah sendiri
    OR (
      'spj_oli' = ANY(public.current_access_roles())
      AND action IN ('select', 'insert', 'update', 'delete')
      AND (
        public.current_access_region() IS NULL
        OR target_region = public.current_access_region()
      )
    )
  );
$$;

-- 2. Nota Dinas — has_nota_dinas_region_access()
CREATE OR REPLACE FUNCTION public.has_nota_dinas_region_access(target_region uuid, action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      'administrator' = ANY(public.current_access_roles())
      OR (
        'nota_dinas' = ANY(public.current_access_roles())
        AND target_region IS NOT NULL
        AND target_region = public.current_access_region()
        AND action IN ('select', 'insert', 'update')
      )
    );
$$;

-- 3. Nota Dinas — assign_nota_dinas_region_from_profile() trigger
CREATE OR REPLACE FUNCTION public.assign_nota_dinas_region_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF 'nota_dinas' = ANY(public.current_access_roles()) THEN
    IF public.current_access_region() IS NULL THEN
      RAISE EXCEPTION 'Akun Nota Dinas belum memiliki wilayah.';
    END IF;
    NEW.region_id := public.current_access_region();
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Laporan BBM — update inline policies pakai current_access_roles()
DROP POLICY IF EXISTS "laporan_bbm_reports_select" ON public.laporan_bbm_reports;
CREATE POLICY "laporan_bbm_reports_select"
ON public.laporan_bbm_reports FOR SELECT TO authenticated
USING (
  'administrator' = ANY(public.current_access_roles())
  OR (
    'laporan_bbm' = ANY(public.current_access_roles())
    AND region_id = public.current_access_region()
  )
);

DROP POLICY IF EXISTS "laporan_bbm_reports_insert" ON public.laporan_bbm_reports;
CREATE POLICY "laporan_bbm_reports_insert"
ON public.laporan_bbm_reports FOR INSERT TO authenticated
WITH CHECK (
  'administrator' = ANY(public.current_access_roles())
  OR (
    'laporan_bbm' = ANY(public.current_access_roles())
    AND region_id = public.current_access_region()
  )
);

DROP POLICY IF EXISTS "laporan_bbm_reports_update" ON public.laporan_bbm_reports;
CREATE POLICY "laporan_bbm_reports_update"
ON public.laporan_bbm_reports FOR UPDATE TO authenticated
USING (
  'administrator' = ANY(public.current_access_roles())
  OR (
    'laporan_bbm' = ANY(public.current_access_roles())
    AND region_id = public.current_access_region()
  )
)
WITH CHECK (
  'administrator' = ANY(public.current_access_roles())
  OR (
    'laporan_bbm' = ANY(public.current_access_roles())
    AND region_id = public.current_access_region()
  )
);

DROP POLICY IF EXISTS "laporan_bbm_reports_delete" ON public.laporan_bbm_reports;
CREATE POLICY "laporan_bbm_reports_delete"
ON public.laporan_bbm_reports FOR DELETE TO authenticated
USING (
  'administrator' = ANY(public.current_access_roles())
  OR (
    'laporan_bbm' = ANY(public.current_access_roles())
    AND region_id = public.current_access_region()
  )
);
