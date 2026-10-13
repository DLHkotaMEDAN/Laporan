import type { NotaDinasForm, NotaDinasRecord } from "@/types/notaDinas";
import { getLetterMonth, getLetterYear, getUniqueOptions } from "@/components/nota-dinas/notaDinasUtils";

export const compareNotaDinasSortValues = (left: string | number, right: string | number) => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
};

export const getNotaDinasNumberLabel = (record: NotaDinasRecord, continuation = false) => {
  const recordMonth = getLetterMonth(record.form.tanggal);
  const recordYear = getLetterYear(record.form.tanggal);
  if (continuation) {
    const continuationDate = record.form.tanggalLanjutan || record.form.tanggal;
    return record.form.gunakanNomorOtomatisLanjutan
      ? `${record.form.nomorLanjutanUrut.trim()}/ Katim/ PL/ ${getLetterMonth(continuationDate)}/ ${getLetterYear(continuationDate)}`
      : record.form.nomorManualLanjutan;
  }
  return record.form.gunakanNomorOtomatisPertama
    ? `${record.form.nomorUrut.trim() ? record.form.nomorUrut.trim().padStart(3, "0") : ""}/${record.form.kodeSurat}/ Dinas-LH/ ${record.form.kodeWilayah}/ ${recordMonth}/ ${recordYear}`
    : record.form.nomorManualPertama;
};

export const getNotaDinasSavedChoices = (savedForms: NotaDinasForm[]) => ({
  kepada: getUniqueOptions(savedForms.flatMap((form) => [form.kepada, form.lanjutanKepada])),
  dari: getUniqueOptions(savedForms.flatMap((form) => [form.dari, form.lanjutanDari, form.koordinatorRujukan])),
  hal: getUniqueOptions(savedForms.flatMap((form) => [form.hal, form.lanjutanHal, form.halRujukan])),
  penerima: getUniqueOptions(savedForms.map((form) => form.penerima)),
  kendaraan: getUniqueOptions(savedForms.map((form) => form.perbaikanPlatKendaraan)),
  jenisKendaraan: getUniqueOptions(savedForms.map((form) => form.perbaikanJenisKendaraan)),
  supir: getUniqueOptions(savedForms.map((form) => form.perbaikanSupir)),
  noHp: getUniqueOptions(savedForms.map((form) => form.perbaikanNoHp)),
  uraianPemeriksaan: getUniqueOptions(savedForms.map((form) => form.perbaikanUraianPemeriksaan)),
  lokasi: getUniqueOptions(savedForms.map((form) => form.perbaikanLokasi)),
  kegiatan: getUniqueOptions(savedForms.map((form) => form.perbaikanKegiatan)),
  jabatan: getUniqueOptions(savedForms.flatMap((form) => [form.jabatanPenandatangan, form.lanjutanJabatanPenandatangan])),
  kantor: getUniqueOptions(savedForms.flatMap((form) => [form.kantorPenandatangan, form.lanjutanKantorPenandatangan])),
  nama: getUniqueOptions(savedForms.flatMap((form) => [form.namaPenandatangan, form.lanjutanNamaPenandatangan])),
  nip: getUniqueOptions(savedForms.flatMap((form) => [form.nipPenandatangan, form.lanjutanNipPenandatangan])),
  items: getUniqueOptions(savedForms.flatMap((form) => form.items.map((item) => item.jenis))),
});
