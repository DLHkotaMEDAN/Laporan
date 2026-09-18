export type NotaDinasItem = {
  jenis: string;
  jumlah: string;
  keterangan: string;
};

export type NotaDinasKind = "permintaan" | "lanjutan";

export type NotaDinasForm = {
  jenisDokumen: NotaDinasKind;
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
