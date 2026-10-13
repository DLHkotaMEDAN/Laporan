import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FilePlus2, FileText, Loader2, Pencil, Printer, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { notaDinasService } from "@/services/notaDinasService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAccess } from "@/constants/access-control";
import { useValueDraft } from "@/hooks/useFormDraft";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { NotaDinasCategory, NotaDinasForm, NotaDinasItem, NotaDinasKind, NotaDinasRecord } from "@/types/notaDinas";
import { DEFAULT_KOLOM_PERBAIKAN, DEFAULT_KOLOM_PERMINTAAN } from "@/types/notaDinas";
import type { NotaDinasSort, NotaDinasSortKey } from "@/components/nota-dinas/NotaDinasRecordTable";
import { NotaDinasListView } from "@/components/nota-dinas/NotaDinasListView";
import { NotaDinasRequestFields } from "@/components/nota-dinas/NotaDinasRequestFields";
import { useNotaDinasTemplates } from "@/hooks/useNotaDinasTemplates";
import { useNotaDinasRecords } from "@/hooks/useNotaDinasRecords";
import { NotaDinasItemsEditor } from "@/components/nota-dinas/NotaDinasItemsEditor";
import { NotaDinasPreview } from "@/components/nota-dinas/NotaDinasPreview";
import { EMPTY_FORM, getCurrentDate, REPAIR_SAMPLE_FORM, REPAIR_SAMPLE_ITEMS, SAMPLE_FORM } from "@/components/nota-dinas/notaDinasDefaults";
import {
  DRAFT_KEY,
  ITEM_CATALOG_KEY,
  RECORDS_KEY,
  getNextRequestSequence,
  readDraft,
  readItemCatalog,
  readRecords,
} from "@/components/nota-dinas/notaDinasStorage";
import {
  formatLongDate,
  getLetterMonth,
  getLetterTypeForCategory,
  getLetterYear,
  getNotaDinasCategory,
  getRenderedHal,
  getUniqueOptions,
  HAL_OPTIONS,
  NOTA_CODE_BY_REGION_CODE,
  REGION_CODES,
} from "@/components/nota-dinas/notaDinasUtils";

const compareSortValues = (left: string | number, right: string | number) => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
};

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </label>
);

const NotaDinasTab = ({ recordCount, isActive }: { recordCount?: number | null; isActive?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, session } = useAuth();
  const viewStorageKey = session?.user?.id ? `nota-dinas:view:${session.user.id}` : undefined;
  const [form, setForm] = useState<NotaDinasForm>(readDraft);
  const [itemCatalog, setItemCatalog] = useState<string[]>(readItemCatalog);
  const [deleteNotaConfirm, setDeleteNotaConfirm] = useState<{ open: boolean; record: NotaDinasRecord | null }>({ open: false, record: null });
  const [saving, setSaving] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [view, setViewState] = useState<"list" | "form">("list");
  const [viewMode, setViewMode] = useState<"view" | "edit">("edit");
  const [sort, setSort] = useState<NotaDinasSort>(null);
  const [categoryFilter, setCategoryFilter] = useState<NotaDinasCategory | "semua">("semua");
  const [accountRegion, setAccountRegion] = useState<{ id: string; name: string; notaCode: string } | null>(null);
  const [accountRegionReady, setAccountRegionReady] = useState(false);
  const {
    sheetTemplate,
    availableTemplates,
    selectedTemplateId,
    handleTemplateSelect,
  } = useNotaDinasTemplates(form.jenisNotaDinas || "permintaan_alat", accountRegion, isActive, location.pathname);
  const isLanjutan = form.jenisDokumen === "lanjutan";
  const isRepair = form.jenisNotaDinas === "perbaikan";
  const isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email);
  const isRegionalNotaAdmin = !isSuperAdmin && Boolean(profile?.region_id);
  const applyAccountRegion = useCallback((value: NotaDinasForm): NotaDinasForm => accountRegion
    ? { ...value, kodeWilayah: accountRegion.notaCode, wilayah: accountRegion.name, lanjutanHal: getRenderedHal(value.hal, accountRegion.name) }
    : value, [accountRegion]);
  const { records, setRecords, recordsLoading, recordsError } = useNotaDinasRecords({
    accountRegion,
    accountRegionReady,
    isRegionalNotaAdmin,
    applyAccountRegion,
  });
  const nextRequestSequence = useMemo(() => getNextRequestSequence(records), [records]);
  const savedChoices = useMemo(() => {
    const savedForms = records.map((record) => record.form);
    return {
      kepada: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.kepada, savedForm.lanjutanKepada])),
      dari: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.dari, savedForm.lanjutanDari, savedForm.koordinatorRujukan])),
      hal: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.hal, savedForm.lanjutanHal, savedForm.halRujukan])),
      penerima: getUniqueOptions(savedForms.map((savedForm) => savedForm.penerima)),
      kendaraan: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanPlatKendaraan)),
      jenisKendaraan: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanJenisKendaraan)),
      supir: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanSupir)),
      noHp: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanNoHp)),
      uraianPemeriksaan: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanUraianPemeriksaan)),
      lokasi: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanLokasi)),
      kegiatan: getUniqueOptions(savedForms.map((savedForm) => savedForm.perbaikanKegiatan)),
      jabatan: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.jabatanPenandatangan, savedForm.lanjutanJabatanPenandatangan])),
      kantor: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.kantorPenandatangan, savedForm.lanjutanKantorPenandatangan])),
      nama: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.namaPenandatangan, savedForm.lanjutanNamaPenandatangan])),
      nip: getUniqueOptions(savedForms.flatMap((savedForm) => [savedForm.nipPenandatangan, savedForm.lanjutanNipPenandatangan])),
      items: getUniqueOptions(savedForms.flatMap((savedForm) => savedForm.items.map((item) => item.jenis))),
    };
  }, [records]);

  const setView = (nextView: "list" | "form") => {
    setViewState(nextView);
    if (viewStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(viewStorageKey, nextView);
    }
  };

  const draftKey = session?.user?.id
    ? `nota-dinas:${session.user.id}:${activeRecordId ?? "new"}`
    : undefined;
  const { clearDraft, lastSavedAt, restoredAt } = useValueDraft(
    form,
    (values) => {
      setForm(applyAccountRegion(values));
    },
    draftKey,
  );

  useEffect(() => {
    if (!isActive || !viewStorageKey || typeof window === "undefined") return;
    const savedView = window.localStorage.getItem(viewStorageKey);
    setViewState(savedView === "form" ? "form" : "list");
  }, [isActive, viewStorageKey]);

  useEffect(() => {
    if (restoredAt) showSuccess("Draft Nota Dinas sebelumnya dipulihkan.");
  }, [restoredAt]);

  useEffect(() => {
    let active = true;

    if (!isRegionalNotaAdmin || !profile?.region_id) {
      setAccountRegion(null);
      setAccountRegionReady(true);
      return () => { active = false; };
    }

    setAccountRegionReady(false);
    void supabase
      .from("regions")
      .select("id, code, name")
      .eq("id", profile.region_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || !NOTA_CODE_BY_REGION_CODE[data.code]) {
          console.error("Wilayah akun Admin Nota Dinas tidak dapat dimuat:", error);
          setAccountRegion(null);
        } else {
          setAccountRegion({ id: data.id, name: data.name, notaCode: NOTA_CODE_BY_REGION_CODE[data.code] });
        }
        setAccountRegionReady(true);
      });

    return () => { active = false; };
  }, [isRegionalNotaAdmin, profile?.region_id]);

  useEffect(() => {
    if (!accountRegion) return;
    setForm((current) => current.kodeWilayah === accountRegion.notaCode && current.wilayah === accountRegion.name
      ? current
      : applyAccountRegion(current));
  }, [accountRegion]);

  useEffect(() => {
    const nextItems = Array.from(new Set([
      ...itemCatalog,
      ...form.items.map((item) => item.jenis.trim()).filter(Boolean),
    ])).sort((left, right) => left.localeCompare(right, "id-ID"));
    if (nextItems.join("\u0000") !== itemCatalog.join("\u0000")) {
      setItemCatalog(nextItems);
      window.localStorage.setItem(ITEM_CATALOG_KEY, JSON.stringify(nextItems));
    }
  }, [form.items, itemCatalog]);

  const activeDateValue = isLanjutan ? (form.tanggalLanjutan || form.tanggal) : form.tanggal;
  const firstLetterMonth = useMemo(() => getLetterMonth(form.tanggal), [form.tanggal]);
  const firstLetterYear = useMemo(() => getLetterYear(form.tanggal), [form.tanggal]);
  const continuationLetterMonth = useMemo(() => getLetterMonth(form.tanggalLanjutan || form.tanggal), [form.tanggal, form.tanggalLanjutan]);
  const continuationLetterYear = useMemo(() => getLetterYear(form.tanggalLanjutan || form.tanggal), [form.tanggal, form.tanggalLanjutan]);
  const generatedFirstNumber = `${form.nomorUrut.trim() ? form.nomorUrut.trim().padStart(3, "0") : "....."}/${form.kodeSurat || "....."}/ Dinas-LH/ ${form.kodeWilayah || "....."}/ ${firstLetterMonth}/ ${firstLetterYear}`;
  const lanjutanNomorUrut = form.nomorLanjutanUrut.trim() || "\u00a0\u00a0\u00a0\u00a0\u00a0";
  const generatedNumber = isLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${continuationLetterMonth}/ ${continuationLetterYear}`
    : generatedFirstNumber;
  const activeAutoNumber = isLanjutan ? form.gunakanNomorOtomatisLanjutan : form.gunakanNomorOtomatisPertama;
  const activeManualNumber = isLanjutan ? form.nomorManualLanjutan : form.nomorManualPertama;
  const firstNumber = form.gunakanNomorOtomatisPertama ? generatedFirstNumber : form.nomorManualPertama;
  const lanjutanNumber = form.gunakanNomorOtomatisLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${continuationLetterMonth}/ ${continuationLetterYear}`
    : form.nomorManualLanjutan;
  const referenceNumber = form.gunakanRujukanOtomatis ? firstNumber : (form.nomorRujukan || ".....");
  const activeKepada = isLanjutan ? form.lanjutanKepada : form.kepada;
  const activeDari = isLanjutan ? form.lanjutanDari : form.dari;
  const activeHal = isLanjutan ? form.lanjutanHal : form.hal;
  const displayHal = getRenderedHal(form.hal, form.wilayah);
  const halOptions = useMemo(() => getUniqueOptions([...HAL_OPTIONS, ...savedChoices.hal]), [savedChoices.hal]);
  const itemOptions = useMemo(() => getUniqueOptions([...itemCatalog, ...savedChoices.items]), [itemCatalog, savedChoices.items]);
  const activeHalOption = halOptions.includes(activeHal) ? activeHal : "manual";
  const activePenutup = isLanjutan ? form.lanjutanPenutup : form.penutup;
  const activeJabatanPenandatangan = isLanjutan ? form.lanjutanJabatanPenandatangan : form.jabatanPenandatangan;
  const activeKantorPenandatangan = isLanjutan ? form.lanjutanKantorPenandatangan : form.kantorPenandatangan;
  const activeNamaPenandatangan = isLanjutan ? form.lanjutanNamaPenandatangan : form.namaPenandatangan;
  const activeNipPenandatangan = isLanjutan ? form.lanjutanNipPenandatangan : form.nipPenandatangan;

  const setActiveField = (field: "kepada" | "dari" | "hal" | "penutup" | "jabatanPenandatangan" | "kantorPenandatangan" | "namaPenandatangan" | "nipPenandatangan", value: string) => {
    const targetField = isLanjutan ? `lanjutan${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;
    setForm((current) => {
      if (!isLanjutan && field === "hal") {
        return { ...current, hal: value, lanjutanHal: getRenderedHal(value, current.wilayah), halRujukan: value };
      }
      // Saat field "dari" diubah, jabatan penandatangan otomatis ikut nilai "dari"
      // Jika sedang di mode lanjutan, pengirim surat rujukan juga ikut
      if (field === "dari") {
        return isLanjutan
          ? { ...current, lanjutanDari: value, lanjutanJabatanPenandatangan: value }
          : { ...current, dari: value, jabatanPenandatangan: value, koordinatorRujukan: value };
      }
      return { ...current, [targetField]: value };
    });
  };

  const setActiveDate = (value: string) => setForm((current) => isLanjutan
    ? { ...current, tanggalLanjutan: value }
    : { ...current, tanggal: value });

  const handleHalOptionChange = (value: string) => setActiveField("hal", value === "manual" ? "" : value);

  const handleDocumentTypeChange = (value: NotaDinasKind) => {
    setForm((current) => ({
      ...current,
      jenisDokumen: value,
      kodeSurat: getLetterTypeForCategory(current.jenisNotaDinas),
      ...(value === "lanjutan" ? {
        lanjutanHal: getRenderedHal(current.hal, current.wilayah),
        // Pengirim surat rujukan otomatis dari field "Dari" surat pertama
        koordinatorRujukan: current.dari || current.koordinatorRujukan,
      } : {}),
    }));
  };
  const handleNotaCategoryChange = (value: NotaDinasCategory) => {
    setForm((current) => ({
      ...current,
      ...(value === "perbaikan" && current.jenisNotaDinas !== "perbaikan"
        ? { ...REPAIR_SAMPLE_FORM, nomorUrut: current.nomorUrut, kodeWilayah: current.kodeWilayah, wilayah: current.wilayah, tanggal: current.tanggal, tanggalLanjutan: current.tanggalLanjutan || current.tanggal, tanggalRujukan: current.tanggal }
        : {}),
      ...(value === "perbaikan" && current.jenisNotaDinas !== "perbaikan" ? { items: REPAIR_SAMPLE_ITEMS } : {}),
      ...(value !== "perbaikan" && current.jenisNotaDinas === "perbaikan" ? { items: SAMPLE_FORM.items } : {}),
      jenisNotaDinas: value,
      kodeSurat: getLetterTypeForCategory(value),
    }));
  };
  const handleRegionChange = (value: string) => {
    const selectedRegion = REGION_CODES.find((region) => region.code === value);
    setForm((current) => ({
      ...current,
      kodeWilayah: value,
      wilayah: selectedRegion?.label || current.wilayah,
      lanjutanHal: getRenderedHal(current.hal, selectedRegion?.label || current.wilayah),
    }));
  };
  const setField = <K extends keyof NotaDinasForm>(key: K, value: NotaDinasForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateItem = (index: number, key: keyof NotaDinasItem, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  };
  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, { jenis: "", jumlah: "", satuan: "", bkKendaraan: "", keterangan: "" }] }));
  };
  const removeItem = (index: number) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  };
  const createNew = () => {
    const penutupFromTemplate = sheetTemplate.paragrafKalimatPenutup || "";
    // Ambil data header dan tanda tangan dari record terakhir yang tersimpan
    const lastRecord = records[0]; // records diurutkan desc by updatedAt
    const prevKepada = lastRecord?.form.kepada || "";
    const prevDari = lastRecord?.form.dari || "";
    const prevJabatan = lastRecord?.form.jabatanPenandatangan || prevDari;
    const prevKantor = lastRecord?.form.kantorPenandatangan || "";
    const prevNama = lastRecord?.form.namaPenandatangan || "";
    const prevNip = lastRecord?.form.nipPenandatangan || "";
    const prevLanjutanKepada = lastRecord?.form.lanjutanKepada || "";
    const prevLanjutanDari = lastRecord?.form.lanjutanDari || "";
    const prevLanjutanJabatan = lastRecord?.form.lanjutanJabatanPenandatangan || prevLanjutanDari;
    const prevLanjutanKantor = lastRecord?.form.lanjutanKantorPenandatangan || "";
    const prevLanjutanNama = lastRecord?.form.lanjutanNamaPenandatangan || "";
    const prevLanjutanNip = lastRecord?.form.lanjutanNipPenandatangan || "";

    setForm(applyAccountRegion({
      ...EMPTY_FORM,
      // Header nota dinas — ambil dari record terakhir
      kepada: prevKepada,
      dari: prevDari,
      lanjutanKepada: prevLanjutanKepada,
      lanjutanDari: prevLanjutanDari,
      // Tanda tangan — ambil dari record terakhir
      jabatanPenandatangan: prevJabatan,
      kantorPenandatangan: prevKantor,
      namaPenandatangan: prevNama,
      nipPenandatangan: prevNip,
      lanjutanJabatanPenandatangan: prevLanjutanJabatan,
      lanjutanKantorPenandatangan: prevLanjutanKantor,
      lanjutanNamaPenandatangan: prevLanjutanNama,
      lanjutanNipPenandatangan: prevLanjutanNip,
      // Nomor urut otomatis lanjutan dari terakhir, bisa diedit
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
    setForm(applyAccountRegion({
      ...SAMPLE_FORM,
      ...record.form,
      jenisDokumen: record.form.jenisDokumen === "perbaikan" ? "permintaan" : record.form.jenisDokumen,
      jenisNotaDinas: getNotaDinasCategory(record),
      kodeSurat: getLetterTypeForCategory(getNotaDinasCategory(record)),
      tanggalLanjutan: record.form.tanggalLanjutan || record.form.tanggal,
      tanggalRujukan: record.form.tanggal,
      halRujukan: record.form.halRujukan || record.form.hal,
    }));
    setActiveRecordId(record.id);
    setViewMode(mode);
    setView("form");
  };

  const duplicateRecord = () => {
    // Salin isi form yang sedang terbuka, tapi perlakukan sebagai dokumen BARU:
    // - activeRecordId di-reset ke null → simpan akan buat record baru
    // - nomorUrut dilanjutkan dari nomor terakhir agar tidak bentrok
    // - tanggal diperbarui ke hari ini
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

  const deleteRecord = (record: NotaDinasRecord) => {
    setDeleteNotaConfirm({ open: true, record });
  };

  const getNumberLabel = (record: NotaDinasRecord, continuation = false) => {
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

  const sortedRecords = useMemo(() => records
    .filter((record) => categoryFilter === "semua" || getNotaDinasCategory(record) === categoryFilter)
    .sort((left, right) => {
    if (!sort) return right.updatedAt.localeCompare(left.updatedAt);
    const getValue = (record: NotaDinasRecord): string | number => {
      switch (sort.key) {
        case "requestNumber": return getNumberLabel(record);
        case "continuationNumber": return getNumberLabel(record, true);
        case "date": return new Date(record.form.tanggal).getTime();
        case "subject": return record.form.hal || "";
        case "region": return record.form.wilayah || "";
        case "items": return record.form.items.length;
      }
    };
    const comparison = compareSortValues(getValue(left), getValue(right));
    return sort.direction === "asc" ? comparison : -comparison;
    }), [categoryFilter, records, sort]);

  const toggleSort = (key: NotaDinasSortKey) => setSort((current) => ({
    key,
    direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
  }));

  const saveRecord = async () => {
    setSaving(true);
    try {
      const existingRecord = records.find((item) => item.id === activeRecordId);
      const formToSave = applyAccountRegion({ ...form, tanggalRujukan: form.tanggal });
      const savedRecord = await notaDinasService.save(formToSave, activeRecordId || undefined, existingRecord?.createdAt, accountRegion?.id);
      setForm(formToSave);
      setRecords((currentRecords) => activeRecordId
        ? currentRecords.map((item) => item.id === savedRecord.id ? savedRecord : item)
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

  if (view === "list") {
    return (
      <>
        <NotaDinasListView
          recordCount={recordCount}
          records={records}
          sortedRecords={sortedRecords}
          recordsError={recordsError}
          recordsLoading={recordsLoading}
          categoryFilter={categoryFilter}
          sort={sort}
          onCategoryChange={setCategoryFilter}
          onSort={toggleSort}
          onOpen={openRecord}
          onDelete={deleteRecord}
          getNumberLabel={getNumberLabel}
          onAdd={createNew}
          onOpenTemplates={() => navigate("/nota-dinas/template")}
        />
        <ConfirmDialog
          open={deleteNotaConfirm.open}
          onOpenChange={(open) => setDeleteNotaConfirm(prev => ({ ...prev, open }))}
          title="Hapus Nota Dinas"
          description={`${deleteNotaConfirm.record ? (getNumberLabel(deleteNotaConfirm.record) || deleteNotaConfirm.record.form.hal || 'Nota Dinas ini') : 'Nota Dinas ini'} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          variant="danger"
          confirmLabel="Ya, Hapus"
          onConfirm={async () => {
            if (!deleteNotaConfirm.record) return;
            const record = deleteNotaConfirm.record;
            try {
              await notaDinasService.delete(record.id);
              setRecords((currentRecords) => currentRecords.filter((item) => item.id !== record.id));
              if (typeof window !== "undefined") {
                const localRecords = readRecords().filter((item) => item.id !== record.id);
                if (localRecords.length > 0) window.localStorage.setItem(RECORDS_KEY, JSON.stringify(localRecords));
                else window.localStorage.removeItem(RECORDS_KEY);
              }
              if (activeRecordId === record.id) {
                setActiveRecordId(null);
                setView("list");
              }
              showSuccess("Nota Dinas berhasil dihapus.");
              setDeleteNotaConfirm({ open: false, record: null });
            } catch (error) {
              console.error("Gagal menghapus Nota Dinas:", error);
              showError("Nota Dinas gagal dihapus. Periksa koneksi dan hak akses akun.");
            }
          }}
        />
      </>
    );
  }

  return (
    <section className="nota-dinas-page space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="font-black">{isRegionalNotaAdmin ? `Nota Dinas ${accountRegion?.name || "Wilayah Akun"}` : "Nota Dinas untuk Super Admin"}</p>
            <p className="mt-0.5 text-sm text-indigo-800/80">Pratinjau dan tombol cetak selalu menghasilkan satu PDF berisi Nota pertama dan Nota lanjutan (2 halaman). Pilih jenis dokumen untuk mengedit halaman terkait.</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => setView("list")} className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
            Kembali ke Data
          </Button>
          {activeRecordId && viewMode === "view" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMode("edit")}
              className="h-10 rounded-xl border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Nota Dinas
            </Button>
          )}
          {activeRecordId && viewMode === "edit" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const record = records.find((r) => r.id === activeRecordId);
                if (record) void deleteRecord(record);
              }}
              className="h-10 rounded-xl border-red-200 bg-white text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Hapus
            </Button>
          )}
          {activeRecordId && viewMode === "edit" && (
            <Button
              type="button"
              variant="outline"
              onClick={duplicateRecord}
              className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <FilePlus2 className="mr-2 h-4 w-4" /> Duplikat
            </Button>
          )}
          {viewMode === "edit" && <Button type="button" onClick={saveRecord} disabled={saving} className="h-10 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan Nota Dinas"}
          </Button>}
          <Button type="button" onClick={() => window.print()} className="h-10 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
            <Printer className="mr-2 h-4 w-4" /> Cetak / Simpan PDF
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {viewMode === "edit" && <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <div>
            <h3 className="text-lg font-black text-slate-950">Input Nota Dinas</h3>
            <p className="mt-1 text-sm text-slate-500">Isi atau ubah data yang dicetak tebal pada pratinjau. <span className="text-xs text-slate-400">{lastSavedAt ? "Draft tersimpan" : "Draft akan tersimpan otomatis"}</span></p>
          </div>

          <NotaDinasRequestFields
            form={form}
            setForm={setForm}
            isLanjutan={isLanjutan}
            isRepair={isRepair}
            isSuperAdmin={isSuperAdmin}
            templates={availableTemplates}
            selectedTemplateId={selectedTemplateId}
            activeRecordId={activeRecordId}
            nextRequestSequence={nextRequestSequence}
            activeAutoNumber={activeAutoNumber}
            generatedNumber={generatedNumber}
            activeManualNumber={activeManualNumber}
            activeDateValue={activeDateValue}
            halOptions={halOptions}
            activeHalOption={activeHalOption}
            activeHal={activeHal}
            referenceNumber={referenceNumber}
            activeKepada={activeKepada}
            activeDari={activeDari}
            onNotaCategoryChange={handleNotaCategoryChange}
            onTemplateSelect={handleTemplateSelect}
            onDocumentTypeChange={handleDocumentTypeChange}
            onSetActiveField={setActiveField}
            onSetField={setField}
            onActiveDateChange={setActiveDate}
            onHalOptionChange={handleHalOptionChange}
            onRegionChange={handleRegionChange}
          />

          {!isLanjutan && (
            <NotaDinasItemsEditor
              items={form.items}
              isRepair={isRepair}
              repairColumns={sheetTemplate.kolomPerbaikan ?? DEFAULT_KOLOM_PERBAIKAN}
              requestColumns={sheetTemplate.kolomPermintaan ?? DEFAULT_KOLOM_PERMINTAAN}
              itemOptions={itemOptions}
              onUpdate={updateItem}
              onRemove={removeItem}
              onAdd={addItem}
            />
          )}

          <div className="grid gap-4 border-t border-slate-100 pt-5">
            <Field label="Jabatan Penandatangan">
              <Input value={activeJabatanPenandatangan} readOnly disabled className="bg-slate-50 text-slate-500" />
              <span className="block text-[11px] text-slate-400">Otomatis diambil dari field "Dari".</span>
            </Field>
            <Field label="Kantor / Wilayah Penandatangan"><Input list="nota-dinas-kantor-options" value={activeKantorPenandatangan} onChange={(event) => setActiveField("kantorPenandatangan", event.target.value)} /></Field>
            <Field label="Nama Penandatangan"><Input list="nota-dinas-nama-options" value={activeNamaPenandatangan} onChange={(event) => setActiveField("namaPenandatangan", event.target.value)} /></Field>
            <Field label="NIP"><Input list="nota-dinas-nip-options" value={activeNipPenandatangan} onChange={(event) => setActiveField("nipPenandatangan", event.target.value)} /></Field>
          </div>
          <datalist id="nota-dinas-kepada-options">{savedChoices.kepada.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-dari-options">{savedChoices.dari.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-kendaraan-options">{savedChoices.kendaraan.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-jenis-kendaraan-options">{savedChoices.jenisKendaraan.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-supir-options">{savedChoices.supir.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-no-hp-options">{savedChoices.noHp.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-lokasi-options">{savedChoices.lokasi.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-kegiatan-options">{savedChoices.kegiatan.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-jabatan-options">{savedChoices.jabatan.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-kantor-options">{savedChoices.kantor.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-nama-options">{savedChoices.nama.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="nota-dinas-nip-options">{savedChoices.nip.map((value) => <option key={value} value={value} />)}</datalist>
        </div>}

        <NotaDinasPreview
          form={form}
          sheetTemplate={sheetTemplate}
          firstNumber={firstNumber}
          continuationNumber={lanjutanNumber}
          displayHal={displayHal}
          referenceNumber={referenceNumber}
          requestDate={formatLongDate(form.tanggal)}
          continuationDate={formatLongDate(form.tanggalLanjutan || form.tanggal)}
          isRepair={isRepair}
          isReadOnly={viewMode === "view"}
        />
      </div>

      <ConfirmDialog
        open={deleteNotaConfirm.open}
        onOpenChange={(open) => setDeleteNotaConfirm(prev => ({ ...prev, open }))}
        title="Hapus Nota Dinas"
        description={`${deleteNotaConfirm.record ? (getNumberLabel(deleteNotaConfirm.record) || deleteNotaConfirm.record.form.hal || 'Nota Dinas ini') : 'Nota Dinas ini'} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        variant="danger"
        confirmLabel="Ya, Hapus"
        onConfirm={async () => {
          if (!deleteNotaConfirm.record) return;
          const record = deleteNotaConfirm.record;
          try {
            await notaDinasService.delete(record.id);
            setRecords((currentRecords) => currentRecords.filter((item) => item.id !== record.id));
            if (typeof window !== "undefined") {
              const localRecords = readRecords().filter((item) => item.id !== record.id);
              if (localRecords.length > 0) window.localStorage.setItem(RECORDS_KEY, JSON.stringify(localRecords));
              else window.localStorage.removeItem(RECORDS_KEY);
            }
            if (activeRecordId === record.id) {
              setActiveRecordId(null);
              setView("list");
            }
            showSuccess("Nota Dinas berhasil dihapus.");
            setDeleteNotaConfirm({ open: false, record: null });
          } catch (error) {
            console.error("Gagal menghapus Nota Dinas:", error);
            showError("Nota Dinas gagal dihapus. Periksa koneksi dan hak akses akun.");
          }
        }}
      />
    </section>
  );
};

export default NotaDinasTab;
