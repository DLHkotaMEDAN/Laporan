import type { Dispatch, SetStateAction } from "react";
import { showError, showSuccess } from "@/utils/toast";
import { notaDinasService } from "@/services/notaDinasService";
import type { NotaDinasForm, NotaDinasRecord } from "@/types/notaDinas";
import { EMPTY_FORM, getCurrentDate, SAMPLE_FORM } from "@/components/nota-dinas/notaDinasDefaults";
import { getLetterTypeForCategory, getNotaDinasCategory, getRenderedHal } from "@/components/nota-dinas/notaDinasUtils";

type UseNotaDinasRecordActionsOptions = {
  form: NotaDinasForm;
  setForm: Dispatch<SetStateAction<NotaDinasForm>>;
  records: NotaDinasRecord[];
  setRecords: Dispatch<SetStateAction<NotaDinasRecord[]>>;
  activeRecordId: string | null;
  setActiveRecordId: Dispatch<SetStateAction<string | null>>;
  accountRegionId?: string;
  nextRequestSequence: string;
  penutupFromTemplate?: string;
  applyAccountRegion: (form: NotaDinasForm) => NotaDinasForm;
  setView: (view: "list" | "form") => void;
  setViewMode: Dispatch<SetStateAction<"view" | "edit">>;
  clearDraft: () => Promise<void>;
  setSaving: Dispatch<SetStateAction<boolean>>;
};

export const useNotaDinasRecordActions = ({
  form,
  setForm,
  records,
  setRecords,
  activeRecordId,
  setActiveRecordId,
  accountRegionId,
  nextRequestSequence,
  penutupFromTemplate = "",
  applyAccountRegion,
  setView,
  setViewMode,
  clearDraft,
  setSaving,
}: UseNotaDinasRecordActionsOptions) => {
  const createNew = () => {
    const lastRecord = records[0];
    const previousSender = lastRecord?.form.dari || "";
    setForm(applyAccountRegion({
      ...EMPTY_FORM,
      kepada: lastRecord?.form.kepada || "",
      dari: previousSender,
      lanjutanKepada: lastRecord?.form.lanjutanKepada || "",
      lanjutanDari: lastRecord?.form.lanjutanDari || "",
      jabatanPenandatangan: lastRecord?.form.jabatanPenandatangan || previousSender,
      kantorPenandatangan: lastRecord?.form.kantorPenandatangan || "",
      namaPenandatangan: lastRecord?.form.namaPenandatangan || "",
      nipPenandatangan: lastRecord?.form.nipPenandatangan || "",
      lanjutanJabatanPenandatangan: lastRecord?.form.lanjutanJabatanPenandatangan || lastRecord?.form.lanjutanDari || "",
      lanjutanKantorPenandatangan: lastRecord?.form.lanjutanKantorPenandatangan || "",
      lanjutanNamaPenandatangan: lastRecord?.form.lanjutanNamaPenandatangan || "",
      lanjutanNipPenandatangan: lastRecord?.form.lanjutanNipPenandatangan || "",
      nomorUrut: nextRequestSequence,
      tanggal: getCurrentDate(),
      tanggalLanjutan: getCurrentDate(),
      tanggalRujukan: getCurrentDate(),
      penutup: penutupFromTemplate,
      lanjutanPenutup: penutupFromTemplate,
    }));
    setActiveRecordId(null);
    setView("form");
  };

  const openRecord = (record: NotaDinasRecord, mode: "view" | "edit" = "edit") => {
    const category = getNotaDinasCategory(record);
    setForm(applyAccountRegion({
      ...SAMPLE_FORM,
      ...record.form,
      jenisDokumen: record.form.jenisDokumen === "perbaikan" ? "permintaan" : record.form.jenisDokumen,
      jenisNotaDinas: category,
      kodeSurat: getLetterTypeForCategory(category),
      tanggalLanjutan: record.form.tanggalLanjutan || record.form.tanggal,
      tanggalRujukan: record.form.tanggal,
      halRujukan: record.form.halRujukan || record.form.hal,
    }));
    setActiveRecordId(record.id);
    setViewMode(mode);
    setView("form");
  };

  const duplicateRecord = () => {
    setForm((current) => applyAccountRegion({
      ...current,
      nomorUrut: nextRequestSequence,
      nomorLanjutanUrut: "",
      tanggal: getCurrentDate(),
      tanggalLanjutan: getCurrentDate(),
      tanggalRujukan: getCurrentDate(),
      gunakanNomorOtomatisPertama: true,
      nomorManualPertama: "",
      gunakanNomorOtomatisLanjutan: true,
      nomorManualLanjutan: "",
      gunakanRujukanOtomatis: true,
      nomorRujukan: "",
    }));
    setActiveRecordId(null);
    void clearDraft();
    showSuccess("Form diduplikat sebagai Nota Dinas baru. Data asli tidak berubah.");
  };

  const saveRecord = async () => {
    setSaving(true);
    try {
      const existingRecord = records.find((record) => record.id === activeRecordId);
      const formToSave = applyAccountRegion({ ...form, tanggalRujukan: form.tanggal });
      const savedRecord = await notaDinasService.save(
        formToSave,
        activeRecordId || undefined,
        existingRecord?.createdAt,
        accountRegionId,
      );
      setForm(formToSave);
      setRecords((currentRecords) => activeRecordId
        ? currentRecords.map((record) => record.id === savedRecord.id ? savedRecord : record)
        : [savedRecord, ...currentRecords]);
      setActiveRecordId(savedRecord.id);
      setView("list");
      await clearDraft();
      showSuccess(activeRecordId ? "Nota Dinas diperbarui" : "Nota Dinas disimpan ke Supabase");
    } catch (error) {
      console.error("Gagal menyimpan Nota Dinas ke Supabase:", error);
      showError("Nota Dinas gagal disimpan ke Supabase. Periksa koneksi dan sesi login.");
    } finally {
      setSaving(false);
    }
  };

  return { createNew, openRecord, duplicateRecord, saveRecord };
};
