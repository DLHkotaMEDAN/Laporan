import type { NotaDinasForm, NotaDinasRecord } from "@/types/notaDinas";
import { SAMPLE_FORM } from "@/components/nota-dinas/notaDinasDefaults";

export const DRAFT_KEY = "laporan-kerja:nota-dinas-draft";
export const RECORDS_KEY = "laporan-kerja:nota-dinas-records";
export const ITEM_CATALOG_KEY = "laporan-kerja:nota-dinas-item-catalog";

export const readDraft = (): NotaDinasForm => {
  if (typeof window === "undefined") return SAMPLE_FORM;
  try {
    const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    if (draft && Array.isArray(draft.items)) {
      return {
        ...SAMPLE_FORM,
        ...draft,
        jenisDokumen: draft.jenisDokumen === "perbaikan" ? "permintaan" : draft.jenisDokumen ?? "permintaan",
        jenisNotaDinas: draft.jenisDokumen === "perbaikan" || draft.jenisNotaDinas === "perbaikan" ? "perbaikan" : draft.jenisNotaDinas ?? SAMPLE_FORM.jenisNotaDinas,
        kodeSurat: draft.jenisDokumen === "perbaikan" || draft.jenisNotaDinas === "perbaikan" ? "SPm-PM" : draft.jenisNotaDinas ? "SPB" : "",
        nomorLanjutanUrut: draft.nomorLanjutanUrut === "....." ? "" : draft.nomorLanjutanUrut ?? "",
        gunakanNomorOtomatis: draft.gunakanNomorOtomatis ?? true,
        nomorManual: draft.nomorManual ?? "",
        gunakanNomorOtomatisPertama: draft.gunakanNomorOtomatisPertama ?? true,
        nomorManualPertama: draft.nomorManualPertama ?? "",
        gunakanNomorOtomatisLanjutan: draft.gunakanNomorOtomatisLanjutan ?? true,
        nomorManualLanjutan: draft.nomorManualLanjutan ?? "",
        tanggalLanjutan: draft.tanggalLanjutan ?? draft.tanggal ?? SAMPLE_FORM.tanggalLanjutan,
        lanjutanKepada: draft.lanjutanKepada ?? SAMPLE_FORM.lanjutanKepada,
        lanjutanDari: draft.lanjutanDari ?? SAMPLE_FORM.lanjutanDari,
        lanjutanHal:
          draft.lanjutanHal === "Permintaan Alat Kerja di Wilayah 4 DLH Medan Kota"
            ? SAMPLE_FORM.lanjutanHal
            : draft.lanjutanHal ?? SAMPLE_FORM.lanjutanHal,
        lanjutanPenutup: draft.lanjutanPenutup ?? SAMPLE_FORM.lanjutanPenutup,
        lanjutanJabatanPenandatangan: draft.lanjutanJabatanPenandatangan ?? SAMPLE_FORM.lanjutanJabatanPenandatangan,
        lanjutanKantorPenandatangan: draft.lanjutanKantorPenandatangan ?? SAMPLE_FORM.lanjutanKantorPenandatangan,
        lanjutanNamaPenandatangan: draft.lanjutanNamaPenandatangan ?? SAMPLE_FORM.lanjutanNamaPenandatangan,
        lanjutanNipPenandatangan: draft.lanjutanNipPenandatangan ?? SAMPLE_FORM.lanjutanNipPenandatangan,
        koordinatorRujukan: draft.koordinatorRujukan ?? SAMPLE_FORM.koordinatorRujukan,
        gunakanRujukanOtomatis: draft.gunakanRujukanOtomatis ?? true,
        nomorRujukan: draft.nomorRujukan ?? "",
        tanggalRujukan: draft.tanggalRujukan ?? draft.tanggal ?? SAMPLE_FORM.tanggalRujukan,
        halRujukan: draft.halRujukan ?? draft.hal ?? SAMPLE_FORM.halRujukan,
        perbaikanPlatKendaraan: draft.perbaikanPlatKendaraan ?? "",
        perbaikanJenisKendaraan: draft.perbaikanJenisKendaraan ?? "",
        perbaikanSupir: draft.perbaikanSupir ?? "",
        perbaikanNoHp: draft.perbaikanNoHp ?? "",
        perbaikanUraianPemeriksaan: draft.perbaikanUraianPemeriksaan ?? "",
        perbaikanLokasi: draft.perbaikanLokasi ?? "",
        perbaikanKegiatan: draft.perbaikanKegiatan ?? "",
      };
    }
  } catch {
    // Use the sample when an older or malformed draft is present.
  }
  return SAMPLE_FORM;
};

export const readItemCatalog = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const values = JSON.parse(window.localStorage.getItem(ITEM_CATALOG_KEY) || "[]");
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  } catch {
    return [];
  }
};

export const readRecords = (): NotaDinasRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const records = JSON.parse(window.localStorage.getItem(RECORDS_KEY) || "[]");
    return Array.isArray(records)
      ? records.filter((record): record is NotaDinasRecord => Boolean(record?.id && record?.form && record?.updatedAt))
      : [];
  } catch {
    return [];
  }
};

export const getFirstSequence = (record: NotaDinasRecord) => {
  const candidates = [record.form.nomorUrut, record.form.nomorManualPertama, record.form.nomorManual];
  for (const candidate of candidates) {
    const match = String(candidate || "").trim().match(/^(\d+)/);
    if (match) return Number(match[1]);
  }
  return 0;
};

export const getNextRequestSequence = (records: NotaDinasRecord[]) => {
  const lastSequence = records.reduce((highest, record) => Math.max(highest, getFirstSequence(record)), 0);
  return String(lastSequence + 1).padStart(3, "0");
};

export const removeSyncedLocalRecords = (recordIds: Set<string>) => {
  if (typeof window === "undefined" || recordIds.size === 0) return;

  const pendingRecords = readRecords().filter((record) => !recordIds.has(record.id));
  if (pendingRecords.length > 0) {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(pendingRecords));
  } else {
    window.localStorage.removeItem(RECORDS_KEY);
  }
};

export const isNewerRecord = (candidate: NotaDinasRecord, current: NotaDinasRecord) => {
  const candidateTime = Date.parse(candidate.updatedAt);
  const currentTime = Date.parse(current.updatedAt);
  return Number.isFinite(candidateTime) && (!Number.isFinite(currentTime) || candidateTime > currentTime);
};
