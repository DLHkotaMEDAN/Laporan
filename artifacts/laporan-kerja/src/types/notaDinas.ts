export type NotaDinasItem = {
  jenis: string;
  jumlah: string;
  satuan?: string;
  bkKendaraan?: string;
  keterangan: string;
  /** Nilai kolom custom — key = id kolom dari KolomTabel */
  [key: string]: string | undefined;
};

/**
 * Konfigurasi satu kolom tabel perbaikan.
 * rowspan: true  = nilai kolom sama untuk semua baris (pakai rowSpan di HTML)
 * rowspan: false = nilai per baris (kolom perbaikan biasanya)
 */
export type KolomTabel = {
  id: string;       // identifier unik kolom, misal "plat", "jenis", "perbaikan"
  judul: string;    // judul header kolom
  lebar: number;    // lebar dalam persen (1–100), total semua kolom = 100
  rowspan: boolean; // true = pakai rowspan (nilai sama semua baris)
};

/** Kolom default tabel perbaikan jika belum dikustomisasi */
export const DEFAULT_KOLOM_PERBAIKAN: KolomTabel[] = [
  { id: "plat",      judul: "Plat Kendaraan",  lebar: 16, rowspan: true  },
  { id: "jenis",     judul: "Jenis Kendaraan",  lebar: 15, rowspan: true  },
  { id: "perbaikan", judul: "Perbaikan",         lebar: 69, rowspan: false },
];

export type NotaDinasKind = "permintaan" | "lanjutan" | "perbaikan" | "";
export type NotaDinasCategory = "permintaan_alat" | "permintaan_bunga_bahan" | "perbaikan" | "";

/**
 * Template isi surat Nota Dinas per wilayah dan kategori.
 * region_id null  = template default global (dibuat super admin).
 * region_id diisi = template override untuk wilayah tertentu.
 *
 * Placeholder yang bisa dipakai di setiap paragraf:
 *   {wilayah}           → nama wilayah operasional
 *   {jumlahKecamatan}   → jumlah kecamatan
 *   {kecamatan}         → daftar nama kecamatan
 *   {penerima}          → Bapak/Ibu
 *   {kepada}            → nama/jabatan penerima (dari field Yth/Kepada)
 *   {koordinatorRujukan}, {nomorRujukan}, {tanggalRujukan}, {halRujukan}
 *   {jenisKendaraan}, {platKendaraan}
 *   {uraianPemeriksaan}, {lokasiKejadian}, {kegiatanKejadian}
 */
export type NotaDinasTemplate = {
  id: string;
  /** Label/nama template untuk ditampilkan di daftar template */
  nama: string;
  regionId: string | null;
  kategori: NotaDinasCategory;
  /** Apakah template ini yang aktif/default untuk wilayah+kategori ini */
  isDefault: boolean;
  paragrafPembuka: string;
  paragrafSubJudul: string;
  paragrafPenutup: string;
  paragrafPerbaikanPermintaan: string;
  paragrafPerbaikanLanjutan: string;
  paragrafLanjutanAlat: string;
  /** Kalimat penutup surat (sebelum tanda tangan) — auto-fill ke form.penutup */
  paragrafKalimatPenutup: string;
  /** Konfigurasi kolom tabel perbaikan — null berarti pakai DEFAULT_KOLOM_PERBAIKAN */
  kolomPerbaikan: KolomTabel[] | null;
  createdAt: string;
  updatedAt: string;
};

/** Nilai default template (fallback jika belum ada di DB) */
export const DEFAULT_NOTA_TEMPLATES: Record<NotaDinasCategory, Omit<NotaDinasTemplate, 'id' | 'regionId' | 'kategori' | 'createdAt' | 'updatedAt'>> = {
  permintaan_alat: {
    nama: 'Template Permintaan Alat',
    isDefault: true,
    paragrafPembuka: 'Sehubungan telah habisnya persediaan alat kerja di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan alat kerja untuk kelancaran operasional di {wilayah}.',
    paragrafSubJudul: 'Adapun Permintaan Barang yang dibutuhkan sebagai berikut :',
    paragrafPenutup: 'Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan Alat kerja tersebut.',
    paragrafPerbaikanPermintaan: '',
    paragrafPerbaikanLanjutan: '',
    paragrafLanjutanAlat: 'Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya Alat Kerja tersebut.',
    paragrafKalimatPenutup: 'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.',
    kolomPerbaikan: null,
  },
  permintaan_bunga_bahan: {
    nama: 'Template Permintaan Bunga dan Bahan',
    isDefault: true,
    paragrafPembuka: 'Sehubungan telah habisnya persediaan bunga dan bahan di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan bunga dan bahan untuk kelancaran operasional di {wilayah}.',
    paragrafSubJudul: 'Adapun Permintaan Barang yang dibutuhkan sebagai berikut :',
    paragrafPenutup: 'Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan barang tersebut.',
    paragrafPerbaikanPermintaan: '',
    paragrafPerbaikanLanjutan: '',
    paragrafLanjutanAlat: 'Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya persediaan bunga dan bahan tersebut.',
    paragrafKalimatPenutup: 'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.',
    kolomPerbaikan: null,
  },
  perbaikan: {
    nama: 'Template Perbaikan',
    isDefault: true,
    paragrafPembuka: '',
    paragrafSubJudul: '',
    paragrafPenutup: 'Demikian disampaikan untuk urusan selanjutnya.',
    paragrafPerbaikanPermintaan: 'Sehubungan untuk kelancaran pekerjaan operasional di {wilayah}, dengan ini kami melaporkan kerusakan kendaraan/Peralatan Mesin Kerja Nota Dinas Permintaan Perbaikan Kendaraan {jenisKendaraan} {platKendaraan} antara lain :',
    paragrafPerbaikanLanjutan: 'Menindaklanjuti surat dari {koordinatorRujukan} dengan Nomor : {nomorRujukan} Tanggal {tanggalRujukan}, Perihal {halRujukan}. Setelah dilakukan penelaahan dan pemeriksaan bahwa {uraianPemeriksaan}, pada saat kerja di {lokasiKejadian} ({kegiatanKejadian}).',
    paragrafLanjutanAlat: '',
    paragrafKalimatPenutup: 'Demikian kami sampaikan kepada {penerima}, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.',
    kolomPerbaikan: null,
  },
  '': {
    nama: '',
    isDefault: false,
    paragrafPembuka: '',
    paragrafSubJudul: '',
    paragrafPenutup: '',
    paragrafPerbaikanPermintaan: '',
    paragrafPerbaikanLanjutan: '',
    paragrafLanjutanAlat: '',
    paragrafKalimatPenutup: '',
    kolomPerbaikan: null,
  },
};

export type NotaDinasForm = {
  jenisDokumen: NotaDinasKind;
  jenisNotaDinas: NotaDinasCategory;
  kepada: string;
  dari: string;
  nomorUrut: string;
  nomorLanjutanUrut: string;
  kodeSurat: string;
  kodeWilayah: string;
  gunakanNomorOtomatis: boolean;
  nomorManual: string;
  gunakanNomorOtomatisPertama: boolean;
  nomorManualPertama: string;
  gunakanNomorOtomatisLanjutan: boolean;
  nomorManualLanjutan: string;
  tanggal: string;
  tanggalLanjutan: string;
  hal: string;
  wilayah: string;
  jumlahKecamatan: string;
  kecamatan: string;
  penerima: string;
  lanjutanKepada: string;
  lanjutanDari: string;
  lanjutanHal: string;
  lanjutanPenutup: string;
  lanjutanJabatanPenandatangan: string;
  lanjutanKantorPenandatangan: string;
  lanjutanNamaPenandatangan: string;
  lanjutanNipPenandatangan: string;
  koordinatorRujukan: string;
  gunakanRujukanOtomatis: boolean;
  nomorRujukan: string;
  tanggalRujukan: string;
  halRujukan: string;
  perbaikanPlatKendaraan: string;
  perbaikanJenisKendaraan: string;
  perbaikanSupir: string;
  perbaikanNoHp: string;
  perbaikanUraianPemeriksaan: string;
  perbaikanLokasi: string;
  perbaikanKegiatan: string;
  penutup: string;
  jabatanPenandatangan: string;
  kantorPenandatangan: string;
  namaPenandatangan: string;
  nipPenandatangan: string;
  items: NotaDinasItem[];
};

export type NotaDinasRecord = {
  id: string;
  form: NotaDinasForm;
  regionId: string | null;
  createdAt: string;
  updatedAt: string;
};
