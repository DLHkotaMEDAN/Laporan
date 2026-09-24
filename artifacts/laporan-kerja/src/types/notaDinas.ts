export type NotaDinasItem = {
  jenis: string;
  jumlah: string;
  satuan?: string;
  bkKendaraan?: string;
  keterangan: string;
};

export type NotaDinasKind = "permintaan" | "lanjutan" | "perbaikan" | "";
export type NotaDinasCategory = "permintaan_alat" | "permintaan_bunga_bahan" | "perbaikan" | "";

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
