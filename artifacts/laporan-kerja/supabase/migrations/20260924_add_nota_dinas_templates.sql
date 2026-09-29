-- ============================================================
-- Tabel nota_dinas_templates
-- Menyimpan template isi surat Nota Dinas per wilayah.
-- region_id NULL  = template default global (dibuat super admin).
-- region_id IS NOT NULL = template override per wilayah.
-- Saat membuat Nota Dinas baru, sistem cari template dengan
-- region_id cocok dulu; fallback ke template default jika belum ada.
-- ============================================================

CREATE TABLE IF NOT EXISTS nota_dinas_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    uuid REFERENCES regions(id) ON DELETE CASCADE,
  -- Jenis nota yang template ini berlaku: permintaan_alat | permintaan_bunga_bahan | perbaikan
  kategori     text NOT NULL DEFAULT 'permintaan_alat',
  -- Paragraf isi surat (pakai placeholder {wilayah}, {jumlahKecamatan}, {kecamatan}, {penerima}, {kepada})
  paragraf_pembuka        text NOT NULL DEFAULT '',
  paragraf_sub_judul      text NOT NULL DEFAULT '',
  paragraf_penutup        text NOT NULL DEFAULT '',
  -- Paragraf untuk nota perbaikan
  paragraf_perbaikan_permintaan  text NOT NULL DEFAULT '',
  paragraf_perbaikan_lanjutan    text NOT NULL DEFAULT '',
  -- Paragraf untuk nota lanjutan (alat)
  paragraf_lanjutan_alat         text NOT NULL DEFAULT '',
  -- Kalimat penutup surat (sebelum tanda tangan)
  paragraf_kalimat_penutup       text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id),
  -- Satu template per wilayah per kategori (NULL region = global default)
  UNIQUE NULLS NOT DISTINCT (region_id, kategori)
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_nota_dinas_templates_region ON nota_dinas_templates(region_id);
CREATE INDEX IF NOT EXISTS idx_nota_dinas_templates_kategori ON nota_dinas_templates(kategori);

-- Trigger update updated_at otomatis
CREATE OR REPLACE FUNCTION update_nota_dinas_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nota_dinas_templates_updated_at
  BEFORE UPDATE ON nota_dinas_templates
  FOR EACH ROW EXECUTE FUNCTION update_nota_dinas_templates_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE nota_dinas_templates ENABLE ROW LEVEL SECURITY;

-- Semua user terautentikasi bisa READ (untuk load template saat buat nota)
CREATE POLICY "nota_dinas_templates_read"
  ON nota_dinas_templates FOR SELECT
  TO authenticated
  USING (true);

-- Super admin bisa INSERT/UPDATE/DELETE semua template
CREATE POLICY "nota_dinas_templates_superadmin_write"
  ON nota_dinas_templates FOR ALL
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

-- Admin nota dinas wilayah hanya bisa INSERT/UPDATE template wilayahnya sendiri
CREATE POLICY "nota_dinas_templates_regional_write"
  ON nota_dinas_templates FOR ALL
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

-- ============================================================
-- Data default global (template awal sebelum admin ubah)
-- ============================================================
INSERT INTO nota_dinas_templates
  (region_id, kategori, paragraf_pembuka, paragraf_sub_judul, paragraf_penutup,
   paragraf_perbaikan_permintaan, paragraf_perbaikan_lanjutan, paragraf_lanjutan_alat,
   paragraf_kalimat_penutup)
VALUES
  -- Permintaan Alat
  (NULL, 'permintaan_alat',
   'Sehubungan telah habisnya persediaan alat kerja di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan alat kerja untuk kelancaran operasional di {wilayah}.',
   'Adapun Permintaan Barang yang dibutuhkan sebagai berikut :',
   'Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan Alat kerja tersebut.',
   '', '',
   'Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya Alat Kerja tersebut.',
   'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.'
  ),
  -- Permintaan Bunga dan Bahan
  (NULL, 'permintaan_bunga_bahan',
   'Sehubungan telah habisnya persediaan bunga dan bahan di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan bunga dan bahan untuk kelancaran operasional di {wilayah}.',
   'Adapun Permintaan Barang yang dibutuhkan sebagai berikut :',
   'Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan barang tersebut.',
   '', '',
   'Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya persediaan bunga dan bahan tersebut.',
   'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.'
  ),
  -- Perbaikan
  (NULL, 'perbaikan',
   '', '',
   'Demikian disampaikan untuk urusan selanjutnya.',
   'Sehubungan untuk kelancaran pekerjaan operasional di {wilayah}, dengan ini kami melaporkan kerusakan kendaraan/Peralatan Mesin Kerja Nota Dinas Permintaan Perbaikan Kendaraan {jenisKendaraan} {platKendaraan} antara lain :',
   'Menindaklanjuti surat dari {koordinatorRujukan} dengan Nomor : {nomorRujukan} Tanggal {tanggalRujukan}, Perihal {halRujukan}. Setelah dilakukan penelaahan dan pemeriksaan bahwa {uraianPemeriksaan}, pada saat kerja di {lokasiKejadian} ({kegiatanKejadian}).',
   '',
   'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.'
  )
ON CONFLICT (region_id, kategori) DO NOTHING;
