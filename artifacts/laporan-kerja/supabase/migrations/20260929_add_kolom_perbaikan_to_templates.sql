-- Tambah kolom kolom_perbaikan (JSONB) ke tabel nota_dinas_templates.
-- Kolom ini menyimpan konfigurasi kolom tabel perbaikan per template.
-- NULL berarti pakai kolom default (Plat Kendaraan, Jenis Kendaraan, Perbaikan).
-- Format: [{ "id": "plat", "judul": "Plat Kendaraan", "lebar": 16, "rowspan": true }, ...]

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS kolom_perbaikan jsonb DEFAULT NULL;
