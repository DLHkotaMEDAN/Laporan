-- Tambah kolom paragraf_kalimat_penutup ke tabel nota_dinas_templates.
-- Kolom ini menyimpan kalimat penutup surat (sebelum tanda tangan),
-- contoh: "Demikian kami sampaikan kepada Ibu, atas arahan dan petunjuk
-- selanjutnya diucapkan terimakasih."
-- Berbeda dari paragraf_penutup yang berisi kalimat "Berkenaan dengan hal
-- tersebut dimohon kepada..."

ALTER TABLE nota_dinas_templates
  ADD COLUMN IF NOT EXISTS paragraf_kalimat_penutup text NOT NULL DEFAULT '';

-- Isi nilai default untuk template yang sudah ada
UPDATE nota_dinas_templates
SET paragraf_kalimat_penutup = 'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.'
WHERE paragraf_kalimat_penutup = '';
