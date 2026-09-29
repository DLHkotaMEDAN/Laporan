-- Refactor tabel nota_dinas_templates untuk mendukung multi-template per wilayah/kategori.
-- Sebelumnya: UNIQUE (region_id, kategori) → hanya 1 template per wilayah+kategori.
-- Sekarang: banyak template per wilayah+kategori, dengan flag is_default untuk template aktif.

-- 1. Hapus constraint unique lama
ALTER TABLE nota_dinas_templates
  DROP CONSTRAINT IF EXISTS nota_dinas_templates_region_id_kategori_key;

-- 2. Tambah kolom nama (label template) dan is_default
ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS nama text NOT NULL DEFAULT 'Template Baru';

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 3. Set semua template yang sudah ada sebagai default (karena sebelumnya 1 per kategori)
UPDATE nota_dinas_templates SET is_default = true;

-- 4. Update nama template default berdasarkan kategori
UPDATE nota_dinas_templates SET nama = 'Template Permintaan Alat' WHERE kategori = 'permintaan_alat';
UPDATE nota_dinas_templates SET nama = 'Template Permintaan Bunga dan Bahan' WHERE kategori = 'permintaan_bunga_bahan';
UPDATE nota_dinas_templates SET nama = 'Template Perbaikan' WHERE kategori = 'perbaikan';

-- 5. Pastikan hanya satu template yang is_default per region+kategori
-- (fungsi helper untuk enforce satu default per kombinasi region+kategori)
CREATE OR REPLACE FUNCTION enforce_single_default_nota_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE nota_dinas_templates
    SET is_default = false
    WHERE kategori = NEW.kategori
      AND id != NEW.id
      AND (
        (NEW.region_id IS NULL AND region_id IS NULL)
        OR (NEW.region_id IS NOT NULL AND region_id = NEW.region_id)
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_default_nota_template ON nota_dinas_templates;
CREATE TRIGGER trg_single_default_nota_template
  AFTER INSERT OR UPDATE OF is_default ON nota_dinas_templates
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_nota_template();
