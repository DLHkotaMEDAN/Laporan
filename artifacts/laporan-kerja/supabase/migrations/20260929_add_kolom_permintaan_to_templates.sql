-- Tambah kolom kolom_permintaan (JSONB) ke tabel nota_dinas_templates.
--
-- Kolom ini menyimpan konfigurasi kolom tabel permintaan alat / bunga & bahan per template.
-- NULL berarti pakai kolom default (No., Jenis, Jumlah, Keterangan).
-- Format: [{ "id": "nomor", "judul": "No.", "lebar": 8, "rowspan": false }, ...]

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS kolom_permintaan jsonb DEFAULT NULL;
