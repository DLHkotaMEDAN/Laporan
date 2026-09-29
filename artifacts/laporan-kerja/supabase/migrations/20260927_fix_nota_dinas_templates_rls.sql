-- Perbaiki RLS policy nota_dinas_templates.
-- Masalah sebelumnya: policy INSERT mensyaratkan created_by = auth.uid()
-- yang menyebabkan UPDATE gagal saat field created_by tidak disertakan.
-- Solusi: pisahkan policy INSERT dan UPDATE, hapus syarat created_by dari UPDATE.

-- Hapus policy lama
DROP POLICY IF EXISTS "nota_dinas_templates_superadmin_write" ON nota_dinas_templates;
DROP POLICY IF EXISTS "nota_dinas_templates_regional_write" ON nota_dinas_templates;

-- Super admin: INSERT
CREATE POLICY "nota_dinas_templates_superadmin_insert"
  ON nota_dinas_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Super admin: UPDATE
CREATE POLICY "nota_dinas_templates_superadmin_update"
  ON nota_dinas_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Super admin: DELETE
CREATE POLICY "nota_dinas_templates_superadmin_delete"
  ON nota_dinas_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Admin nota dinas wilayah: INSERT wilayahnya sendiri
CREATE POLICY "nota_dinas_templates_regional_insert"
  ON nota_dinas_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    region_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_nota_dinas'
        AND profiles.region_id = nota_dinas_templates.region_id
    )
  );

-- Admin nota dinas wilayah: UPDATE wilayahnya sendiri
CREATE POLICY "nota_dinas_templates_regional_update"
  ON nota_dinas_templates FOR UPDATE
  TO authenticated
  USING (
    region_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_nota_dinas'
        AND profiles.region_id = nota_dinas_templates.region_id
    )
  )
  WITH CHECK (
    region_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_nota_dinas'
        AND profiles.region_id = nota_dinas_templates.region_id
    )
  );

-- Admin nota dinas wilayah: DELETE wilayahnya sendiri
CREATE POLICY "nota_dinas_templates_regional_delete"
  ON nota_dinas_templates FOR DELETE
  TO authenticated
  USING (
    region_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_nota_dinas'
        AND profiles.region_id = nota_dinas_templates.region_id
    )
  );
