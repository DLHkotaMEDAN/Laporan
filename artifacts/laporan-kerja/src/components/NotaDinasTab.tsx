import { useEffect, useMemo, useState } from "react";
import { FilePlus2, FileText, Loader2, Pencil, Plus, Printer, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { notaDinasService } from "@/services/notaDinasService";
import { supabase } from "@/lib/supabase";
import type { NotaDinasForm, NotaDinasItem, NotaDinasKind, NotaDinasRecord } from "@/types/notaDinas";

const SAMPLE_FORM: NotaDinasForm = {
  jenisDokumen: "permintaan",
  kepada: "Ketua Tim Pemeliharaan Lingkungan",
  dari: "Koordinator Taman Wilayah 4 Medan Kota",
  nomorUrut: "018",
  nomorLanjutanUrut: "",
  kodeSurat: "SPB",
  kodeWilayah: "MK",
  gunakanNomorOtomatis: true,
  nomorManual: "",
  gunakanNomorOtomatisPertama: true,
  nomorManualPertama: "",
  gunakanNomorOtomatisLanjutan: true,
  nomorManualLanjutan: "",
  tanggal: "2026-09-18",
  hal: "Permintaan Alat Kerja di Wilayah 4 Medan Kota",
  wilayah: "Wilayah 4 Medan Kota",
  jumlahKecamatan: "4",
  kecamatan: "Medan Amplas, Medan Kota, Medan Area dan Medan Denai",
  penerima: "Ibu Ketua Tim Pemeliharaan lingkungan Hidup",
  lanjutanKepada: "Kepala Bidang Tata Lingkungan Kota Medan",
  lanjutanDari: "Ketua Tim Pemeliharaan Lingkungan",
  lanjutanHal: "Permintaan Alat Kerja di Wilayah 4 Medan Kota",
  lanjutanPenutup: "Demikian di sampaikan ,selanjutnya kami mohon petunjuk.",
  lanjutanJabatanPenandatangan: "Ketua Tim Pemeliharaan Lingkungan,",
  lanjutanKantorPenandatangan: "",
  lanjutanNamaPenandatangan: "Anitha Florida Ginting, ST, M.Si",
  lanjutanNipPenandatangan: "198111282010012011",
  koordinatorRujukan: "Kepala Koordinator Taman Wilayah 4 Medan Kota",
  gunakanRujukanOtomatis: true,
  nomorRujukan: "",
  penutup: "Demikian disampaikan untuk urusan selanjutnya.",
  jabatanPenandatangan: "Kepala Koordinator Wilayah 4",
  kantorPenandatangan: "Medan Kota",
  namaPenandatangan: "Tiurmaida Silitonga, SE",
  nipPenandatangan: "196905072007012042",
  items: [
    { jenis: "Tali Babat", jumlah: "2 Gulung", keterangan: "2 Mesin" },
    { jenis: "Sarung Tangan", jumlah: "10 Pasang", keterangan: "3 Kecamatan" },
    { jenis: "Plastik Sampah", jumlah: "20 Buah", keterangan: "3 Kecamatan" },
  ],
};

const DRAFT_KEY = "laporan-kerja:nota-dinas-draft";
const RECORDS_KEY = "laporan-kerja:nota-dinas-records";
const ITEM_CATALOG_KEY = "laporan-kerja:nota-dinas-item-catalog";
const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const REGION_CODES = [
  { code: "MK", label: "Wilayah 4 Medan Kota" },
  { code: "MU", label: "Wilayah 1 Medan Utara" },
  { code: "MB", label: "Wilayah 2 Medan Barat" },
  { code: "MT", label: "Wilayah 3 Medan Timur" },
  { code: "MS", label: "Wilayah 5 Medan Selatan" },
] as const;
const LETTER_TYPES = [
  { code: "SPB", label: "Surat Permintaan Barang" },
  { code: "SPm-PM", label: "Nota Perbaikan" },
] as const;
const DOCUMENT_TYPES = [
  { value: "permintaan" as const, label: "Nota Dinas Permintaan (SPB / SPm-PM)" },
  { value: "lanjutan" as const, label: "Nota Dinas Lanjutan / Tindak Lanjut" },
];

const readDraft = (): NotaDinasForm => {
  if (typeof window === "undefined") return SAMPLE_FORM;
  try {
    const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    if (draft && Array.isArray(draft.items)) {
      return {
        ...SAMPLE_FORM,
        ...draft,
        jenisDokumen: draft.jenisDokumen ?? "permintaan",
        nomorLanjutanUrut: draft.nomorLanjutanUrut === "....." ? "" : draft.nomorLanjutanUrut ?? "",
        gunakanNomorOtomatis: draft.gunakanNomorOtomatis ?? true,
        nomorManual: draft.nomorManual ?? "",
        gunakanNomorOtomatisPertama: draft.gunakanNomorOtomatisPertama ?? true,
        nomorManualPertama: draft.nomorManualPertama ?? "",
        gunakanNomorOtomatisLanjutan: draft.gunakanNomorOtomatisLanjutan ?? true,
        nomorManualLanjutan: draft.nomorManualLanjutan ?? "",
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
      };
    }
  } catch {
    // Use the sample when an older or malformed draft is present.
  }
  return SAMPLE_FORM;
};

const readItemCatalog = () => {
  if (typeof window === "undefined") return [];
  try {
    const values = JSON.parse(window.localStorage.getItem(ITEM_CATALOG_KEY) || "[]");
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  } catch {
    return [];
  }
};

const readRecords = (): NotaDinasRecord[] => {
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

const removeSyncedLocalRecords = (recordIds: Set<string>) => {
  if (typeof window === "undefined" || recordIds.size === 0) return;

  const pendingRecords = readRecords().filter((record) => !recordIds.has(record.id));
  if (pendingRecords.length > 0) {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(pendingRecords));
  } else {
    window.localStorage.removeItem(RECORDS_KEY);
  }
};

const isNewerRecord = (candidate: NotaDinasRecord, current: NotaDinasRecord) => {
  const candidateTime = Date.parse(candidate.updatedAt);
  const currentTime = Date.parse(current.updatedAt);
  return Number.isFinite(candidateTime) && (!Number.isFinite(currentTime) || candidateTime > currentTime);
};

const formatRecordDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

const formatLongDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const getLetterMonth = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : ROMAN_MONTHS[date.getMonth()];
};

const getLetterYear = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : String(date.getFullYear());
};

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </label>
);

type NotaDinasSheetProps = {
  kepada: string;
  dari: string;
  nomor: string;
  tanggal: string;
  hal: string;
  wilayah: string;
  jumlahKecamatan: string;
  kecamatan: string;
  penerima: string;
  koordinatorRujukan: string;
  referenceNumber: string;
  penutup: string;
  jabatanPenandatangan: string;
  kantorPenandatangan: string;
  namaPenandatangan: string;
  nipPenandatangan: string;
  items: NotaDinasItem[];
  isLanjutan: boolean;
};

const NotaDinasSheet = ({
  kepada, dari, nomor, tanggal, hal, wilayah, jumlahKecamatan, kecamatan, penerima,
  koordinatorRujukan, referenceNumber, penutup, jabatanPenandatangan,
  kantorPenandatangan, namaPenandatangan, nipPenandatangan, items, isLanjutan,
}: NotaDinasSheetProps) => (
  <article className="nota-dinas-sheet mx-auto bg-white text-black shadow-xl">
    <h1 className="nota-dinas-title">NOTA DINAS</h1>

    <div className="nota-dinas-meta">
      <div><span>Yth</span><b>:</b><span>{kepada}</span></div>
      <div><span>Dari</span><b>:</b><span>{dari}</span></div>
      <div><span>Nomor</span><b>:</b><span>{nomor}</span></div>
      <div><span>Tanggal</span><b>:</b><span>{tanggal}</span></div>
      <div><span>Hal</span><b>:</b><span>{hal}</span></div>
    </div>

    <div className="nota-dinas-rule" />

    {isLanjutan ? <>
      <p className="nota-dinas-body">Menindaklanjuti Surat dari <span>{koordinatorRujukan}</span> Nomor : <span>{referenceNumber}</span> Tanggal <span>{tanggal}</span> Perihal <span>{hal}</span>. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya Alat Kerja tersebut.</p>
      <p className="nota-dinas-request">Adapun Permintaan Barang yang dibutuhkan sebagai berikut :</p>
    </> : <>
      <p className="nota-dinas-body">Sehubungan telah habisnya persediaan alat kerja di <span>{wilayah}</span>, Untuk <span>{jumlahKecamatan} Kecamatan ({kecamatan})</span>. Maka dibutuhkan penambahan alat kerja untuk kelancaran operasional di <span>{wilayah}</span>.</p>
      <p className="nota-dinas-request">Adapun Permintaan Barang yang dibutuhkan sebagai berikut :</p>
    </>}

    <table className="nota-dinas-table">
      <thead><tr><th>No.</th><th>Jenis</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={index}><td>{index + 1}.</td><td>{item.jenis}</td><td>{item.jumlah}</td><td>{item.keterangan}</td></tr>)}</tbody>
    </table>

    {!isLanjutan && <p className="nota-dinas-body nota-dinas-closing">Berkenaan dengan hal tersebut dimohon kepada <span>{penerima}</span>, Agar kiranya memberikan Alat kerja tersebut.</p>}
    <p className={`nota-dinas-final${isLanjutan ? " nota-dinas-final-lanjutan" : ""}`}>{penutup}</p>

    <div className="nota-dinas-signature">
      <span>{jabatanPenandatangan}</span>
      <span>{kantorPenandatangan}</span>
      <div className="nota-dinas-signature-space" />
      <span className="nota-dinas-underlined">{namaPenandatangan}</span>
      <span>NIP {nipPenandatangan}</span>
    </div>
  </article>
);

const NotaDinasTab = () => {
  const [form, setForm] = useState<NotaDinasForm>(readDraft);
  const [itemCatalog, setItemCatalog] = useState<string[]>(readItemCatalog);
  const [records, setRecords] = useState<NotaDinasRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "form">("list");
  const isLanjutan = form.jenisDokumen === "lanjutan";

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

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

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      setRecordsLoading(true);
      setRecordsError(null);

      try {
        const remoteRecords = await notaDinasService.getAll();
        const recordsById = new Map(remoteRecords.map((record) => [record.id, record]));
        const syncedLocalRecordIds = new Set<string>();
        let hasPendingLocalRecords = false;

        // Reconcile every legacy local record, even when Supabase already has
        // documents. This is important when each device still has its own old
        // localStorage data. The newest saved version wins on an id conflict.
        for (const localRecord of readRecords()) {
          const remoteRecord = recordsById.get(localRecord.id);
          try {
            if (!remoteRecord) {
              const createdRecord = await notaDinasService.create(
                localRecord.form,
                localRecord.id,
                localRecord.createdAt,
                localRecord.updatedAt,
              );
              recordsById.set(createdRecord.id, createdRecord);
            } else if (isNewerRecord(localRecord, remoteRecord)) {
              const updatedRecord = await notaDinasService.update(
                remoteRecord.id,
                localRecord.form,
                localRecord.updatedAt,
              );
              recordsById.set(updatedRecord.id, updatedRecord);
            }
            syncedLocalRecordIds.add(localRecord.id);
          } catch (migrationError) {
            hasPendingLocalRecords = true;
            console.error("Gagal menyinkronkan Nota Dinas lokal:", migrationError);
          }
        }

        removeSyncedLocalRecords(syncedLocalRecordIds);
        if (!cancelled) {
          setRecords([...recordsById.values()]);
          if (hasPendingLocalRecords) {
            setRecordsError("Sebagian data lokal belum tersinkron. Periksa koneksi dan coba muat ulang.");
          }
        }
      } catch (error) {
        console.error("Gagal memuat Nota Dinas dari Supabase:", error);
        if (!cancelled) {
          setRecords(readRecords());
          setRecordsError("Data Supabase belum dapat dimuat. Data lokal ditampilkan sementara.");
        }
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    };

    void loadRecords();
    const channel = supabase
      .channel("nota-dinas-records-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nota_dinas_records" },
        () => void loadRecords(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  const displayDate = useMemo(() => formatLongDate(form.tanggal), [form.tanggal]);
  const letterMonth = useMemo(() => getLetterMonth(form.tanggal), [form.tanggal]);
  const letterYear = useMemo(() => getLetterYear(form.tanggal), [form.tanggal]);
  const generatedFirstNumber = `${form.nomorUrut.trim() ? form.nomorUrut.trim().padStart(3, "0") : "....."}/${form.kodeSurat || "....."}/ Dinas-LH/ ${form.kodeWilayah || "....."}/ ${letterMonth}/ ${letterYear}`;
  const lanjutanNomorUrut = form.nomorLanjutanUrut.trim() || "\u00a0\u00a0\u00a0\u00a0\u00a0";
  const generatedNumber = isLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${letterMonth}/ ${letterYear}`
    : generatedFirstNumber;
  const activeAutoNumber = isLanjutan ? form.gunakanNomorOtomatisLanjutan : form.gunakanNomorOtomatisPertama;
  const activeManualNumber = isLanjutan ? form.nomorManualLanjutan : form.nomorManualPertama;
  const firstNumber = form.gunakanNomorOtomatisPertama ? generatedFirstNumber : form.nomorManualPertama;
  const lanjutanNumber = form.gunakanNomorOtomatisLanjutan
    ? `${lanjutanNomorUrut}/ Katim/ PL/ ${letterMonth}/ ${letterYear}`
    : form.nomorManualLanjutan;
  const referenceNumber = form.gunakanRujukanOtomatis ? firstNumber : (form.nomorRujukan || ".....");
  const activeKepada = isLanjutan ? form.lanjutanKepada : form.kepada;
  const activeDari = isLanjutan ? form.lanjutanDari : form.dari;
  const activeHal = isLanjutan ? form.lanjutanHal : form.hal;
  const activePenutup = isLanjutan ? form.lanjutanPenutup : form.penutup;
  const activeJabatanPenandatangan = isLanjutan ? form.lanjutanJabatanPenandatangan : form.jabatanPenandatangan;
  const activeKantorPenandatangan = isLanjutan ? form.lanjutanKantorPenandatangan : form.kantorPenandatangan;
  const activeNamaPenandatangan = isLanjutan ? form.lanjutanNamaPenandatangan : form.namaPenandatangan;
  const activeNipPenandatangan = isLanjutan ? form.lanjutanNipPenandatangan : form.nipPenandatangan;

  const setActiveField = (field: "kepada" | "dari" | "hal" | "penutup" | "jabatanPenandatangan" | "kantorPenandatangan" | "namaPenandatangan" | "nipPenandatangan", value: string) => {
    const targetField = isLanjutan ? `lanjutan${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;
    setForm((current) => ({ ...current, [targetField]: value }));
  };

  const handleDocumentTypeChange = (value: NotaDinasKind) => {
    setForm((current) => ({ ...current, jenisDokumen: value }));
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
    setForm((current) => ({ ...current, items: [...current.items, { jenis: "", jumlah: "", keterangan: "" }] }));
  };
  const removeItem = (index: number) => {
    setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  };
  const resetForm = () => {
    setForm(SAMPLE_FORM);
    setActiveRecordId(null);
    showSuccess("Form Nota Dinas dikembalikan ke contoh");
  };

  const createNew = () => {
    setForm(SAMPLE_FORM);
    setActiveRecordId(null);
    setView("form");
  };

  const openRecord = (record: NotaDinasRecord) => {
    setForm(record.form);
    setActiveRecordId(record.id);
    setView("form");
  };

  const saveRecord = async () => {
    setSaving(true);
    try {
      const existingRecord = records.find((item) => item.id === activeRecordId);
      const savedRecord = await notaDinasService.save(form, activeRecordId || undefined, existingRecord?.createdAt);
      setRecords((currentRecords) => activeRecordId
        ? currentRecords.map((item) => item.id === savedRecord.id ? savedRecord : item)
        : [savedRecord, ...currentRecords]);
      setActiveRecordId(savedRecord.id);
      setView("list");
      showSuccess(activeRecordId ? "Nota Dinas diperbarui" : "Nota Dinas disimpan ke Supabase");
    } catch (error) {
      console.error("Gagal menyimpan Nota Dinas ke Supabase:", error);
      showError("Nota Dinas gagal disimpan ke Supabase. Periksa koneksi dan sesi login.");
    } finally {
      setSaving(false);
    }
  };

  if (view === "list") {
    const sortedRecords = [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <h2 className="font-black">Nota Dinas</h2>
              <p className="mt-0.5 text-sm text-indigo-800/80">Kelola Nota Dinas Permintaan dan Nota Dinas Lanjutan dalam satu dokumen PDF dua halaman.</p>
            </div>
          </div>
          <Button type="button" onClick={createNew} className="h-10 shrink-0 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
            <FilePlus2 className="mr-2 h-4 w-4" /> Tambah Nota Dinas
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-950">Data Nota Dinas</h3>
              <p className="text-sm text-slate-500">Daftar Nota Dinas yang telah disimpan.</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{sortedRecords.length} dokumen</span>
          </div>

          {recordsError && <p className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">{recordsError}</p>}

          {recordsLoading ? (
            <div className="flex flex-col items-center px-6 py-16 text-center text-slate-500">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm font-semibold">Memuat data dari Supabase...</p>
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <FileText className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-bold text-slate-700">Belum ada Nota Dinas tersimpan</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">Klik “Tambah Nota Dinas” untuk membuat dan menyimpan dokumen pertama.</p>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-3 sm:px-5">No.</th>
                    <th className="px-3 py-3 sm:px-5">Nota Permintaan</th>
                    <th className="hidden px-3 py-3 md:table-cell sm:px-5">Nota Lanjutan</th>
                    <th className="hidden px-3 py-3 sm:table-cell sm:px-5">Tanggal</th>
                    <th className="px-3 py-3 sm:px-5">Perihal</th>
                    <th className="hidden px-3 py-3 lg:table-cell sm:px-5">Wilayah</th>
                    <th className="hidden px-3 py-3 text-center md:table-cell sm:px-5">Barang</th>
                    <th className="w-20 px-3 py-3 text-right sm:w-28 sm:px-5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRecords.map((record, index) => {
                    const recordMonth = getLetterMonth(record.form.tanggal);
                    const recordYear = getLetterYear(record.form.tanggal);
                    const firstNumber = record.form.gunakanNomorOtomatisPertama
                      ? `${record.form.nomorUrut.trim() ? record.form.nomorUrut.trim().padStart(3, "0") : ""}/${record.form.kodeSurat}/ Dinas-LH/ ${record.form.kodeWilayah}/ ${recordMonth}/ ${recordYear}`
                      : record.form.nomorManualPertama;
                    const continuationNumber = record.form.gunakanNomorOtomatisLanjutan
                      ? `${record.form.nomorLanjutanUrut.trim()}/ Katim/ PL/ ${recordMonth}/ ${recordYear}`
                      : record.form.nomorManualLanjutan;
                    return <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-4 font-semibold text-slate-500 sm:px-5">{index + 1}</td>
                      <td className="break-words px-3 py-4 font-semibold text-slate-800 sm:px-5">{firstNumber}</td>
                      <td className="hidden break-words px-3 py-4 text-slate-700 md:table-cell sm:px-5">{continuationNumber}</td>
                      <td className="hidden px-3 py-4 whitespace-nowrap text-slate-600 sm:table-cell sm:px-5">{formatLongDate(record.form.tanggal)}</td>
                      <td className="px-3 py-4 text-slate-700 sm:px-5"><span className="line-clamp-2">{record.form.hal || "-"}</span><span className="mt-1 block text-[10px] text-slate-400 sm:hidden">{formatLongDate(record.form.tanggal)}</span></td>
                      <td className="hidden px-3 py-4 text-slate-700 lg:table-cell sm:px-5">{record.form.wilayah || "-"}</td>
                      <td className="hidden px-3 py-4 text-center font-semibold text-slate-700 md:table-cell sm:px-5">{record.form.items.length}</td>
                      <td className="px-3 py-4 text-right sm:px-5"><Button type="button" variant="outline" size="sm" onClick={() => openRecord(record)} className="border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 sm:px-3"><Pencil className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Buka</span></Button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
          {sortedRecords.length > 0 && <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Data terakhir diperbarui: {formatRecordDate(sortedRecords[0].updatedAt)}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="nota-dinas-page space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="font-black">Nota Dinas untuk Super Admin</p>
            <p className="mt-0.5 text-sm text-indigo-800/80">Pratinjau dan tombol cetak selalu menghasilkan satu PDF berisi Nota pertama dan Nota lanjutan (2 halaman). Pilih jenis dokumen untuk mengedit halaman terkait.</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => setView("list")} className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
            Kembali ke Data
          </Button>
          <Button type="button" variant="outline" onClick={resetForm} className="h-10 rounded-xl border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Contoh
          </Button>
          <Button type="button" onClick={saveRecord} disabled={saving} className="h-10 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} {saving ? "Menyimpan..." : "Simpan Nota Dinas"}
          </Button>
          <Button type="button" onClick={() => window.print()} className="h-10 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
            <Printer className="mr-2 h-4 w-4" /> Cetak / Simpan PDF
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <div>
            <h3 className="text-lg font-black text-slate-950">Input Nota Dinas</h3>
            <p className="mt-1 text-sm text-slate-500">Isi atau ubah data yang dicetak tebal pada pratinjau.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Jenis Dokumen" className="sm:col-span-2 xl:col-span-1">
              <Select value={form.jenisDokumen} onValueChange={(value) => handleDocumentTypeChange(value as NotaDinasKind)}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis dokumen" /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map((documentType) => <SelectItem key={documentType.value} value={documentType.value}>{documentType.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Yth / Kepada"><Input value={activeKepada} onChange={(event) => setActiveField("kepada", event.target.value)} /></Field>
            <Field label="Dari"><Input value={activeDari} onChange={(event) => setActiveField("dari", event.target.value)} /></Field>
            {!isLanjutan && <Field label="Nomor Urut"><Input value={form.nomorUrut} onChange={(event) => setField("nomorUrut", event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" maxLength={3} placeholder="018" /></Field>}
            {isLanjutan && <Field label="Nomor Urut Nota Lanjutan"><Input value={form.nomorLanjutanUrut} onChange={(event) => setField("nomorLanjutanUrut", event.target.value)} placeholder="Isi nomor urut" /></Field>}
            {!isLanjutan && <Field label="Jenis Nota">
              <Select value={form.kodeSurat} onValueChange={(value) => setField("kodeSurat", value)}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis nota" /></SelectTrigger>
                <SelectContent>{LETTER_TYPES.map((letterType) => <SelectItem key={letterType.code} value={letterType.code}>{letterType.code} - {letterType.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>}
            {!isLanjutan && <Field label="Kode Wilayah">
              <Select value={form.kodeWilayah} onValueChange={(value) => setField("kodeWilayah", value)}>
                <SelectTrigger><SelectValue placeholder="Pilih kode wilayah" /></SelectTrigger>
                <SelectContent>{REGION_CODES.map((region) => <SelectItem key={region.code} value={region.code}>{region.code} - {region.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>}
            <Field label="Tanggal Surat"><Input type="date" value={form.tanggal} onChange={(event) => setField("tanggal", event.target.value)} /><span className="block text-[11px] text-slate-400">Kode bulan dan tahun nomor dibuat otomatis: {letterMonth} / {letterYear}</span></Field>
            {isLanjutan && <>
              <Field label="Koordinator pada Surat Rujukan"><Input value={form.koordinatorRujukan} onChange={(event) => setField("koordinatorRujukan", event.target.value)} /></Field>
              <Field label="Nomor Surat yang Diterima" className="sm:col-span-2 xl:col-span-1">
                <div className="flex gap-2">
                  <Input className="min-w-0 flex-1" value={referenceNumber} readOnly={form.gunakanRujukanOtomatis} onChange={(event) => setForm((current) => ({ ...current, gunakanRujukanOtomatis: false, nomorRujukan: event.target.value }))} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, gunakanRujukanOtomatis: !current.gunakanRujukanOtomatis, nomorRujukan: current.gunakanRujukanOtomatis ? referenceNumber : "" }))} className="shrink-0 rounded-lg border-indigo-200 bg-white px-2.5 text-indigo-700 hover:bg-indigo-100">
                    {form.gunakanRujukanOtomatis ? "Edit" : "Auto"}
                  </Button>
                </div>
                <span className="block text-[11px] text-slate-400">Otomatis mengikuti nomor Nota Permintaan atau dapat diedit manual.</span>
              </Field>
            </>}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:col-span-2 xl:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[11px] font-black uppercase tracking-wider text-indigo-700">Nomor Surat</p><p className="mt-1 text-xs text-indigo-900/70">{activeAutoNumber ? "Format otomatis aktif" : "Mode edit manual aktif"}</p></div>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => isLanjutan
                  ? { ...current, gunakanNomorOtomatisLanjutan: !current.gunakanNomorOtomatisLanjutan, nomorManualLanjutan: current.gunakanNomorOtomatisLanjutan ? generatedNumber : "" }
                  : { ...current, gunakanNomorOtomatisPertama: !current.gunakanNomorOtomatisPertama, nomorManualPertama: current.gunakanNomorOtomatisPertama ? generatedNumber : "" }
                )} className="shrink-0 rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100">
                  {activeAutoNumber ? "Edit Manual" : "Otomatis"}
                </Button>
              </div>
              {!activeAutoNumber && <Input className="mt-3 bg-white" value={activeManualNumber} onChange={(event) => setForm((current) => isLanjutan ? { ...current, nomorManualLanjutan: event.target.value } : { ...current, nomorManualPertama: event.target.value })} placeholder={isLanjutan ? "Contoh: 018/ Katim/ PL/ IX/ 2026" : "Contoh: 018/SPB/ Dinas-LH/ MK/ IX/ 2026"} aria-label="Nomor surat manual" />}
              {activeAutoNumber && <p className="mt-2 break-words rounded-lg bg-white/80 px-2.5 py-2 text-xs font-semibold text-slate-700">{generatedNumber}</p>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2 xl:col-span-1">
              {!isLanjutan ? <>
                <p><span className="font-bold text-slate-800">SPB</span> = Surat Permintaan Barang</p>
                <p><span className="font-bold text-slate-800">SPm-PM</span> = Nota Perbaikan</p>
                <p><span className="font-bold text-slate-800">Dinas-LH</span> = nilai tetap</p>
              </> : <p><span className="font-bold text-slate-800">Katim / PL</span> = nilai tetap pada Nota Dinas Lanjutan</p>}
            </div>
            <Field label="Hal" className="sm:col-span-2 xl:col-span-1"><Textarea rows={2} value={activeHal} onChange={(event) => setActiveField("hal", event.target.value)} /></Field>
            <Field label="Wilayah"><Input value={form.wilayah} onChange={(event) => setField("wilayah", event.target.value)} /></Field>
            <Field label="Jumlah Kecamatan"><Input value={form.jumlahKecamatan} onChange={(event) => setField("jumlahKecamatan", event.target.value)} /></Field>
            <Field label="Nama Kecamatan" className="sm:col-span-2 xl:col-span-1"><Textarea rows={2} value={form.kecamatan} onChange={(event) => setField("kecamatan", event.target.value)} /></Field>
            {!isLanjutan && <Field label="Penerima Permintaan" className="sm:col-span-2 xl:col-span-1"><Input value={form.penerima} onChange={(event) => setField("penerima", event.target.value)} /></Field>}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div><h4 className="font-black text-slate-900">Daftar Barang</h4><p className="text-xs text-slate-500">Tambah baris sesuai kebutuhan.</p></div>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Barang {index + 1}</span>{form.items.length > 1 && <button type="button" onClick={() => removeItem(index)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus barang ${index + 1}`}><Trash2 className="h-4 w-4" /></button>}</div>
                  <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    <Input list="nota-dinas-item-catalog" aria-label={`Jenis barang ${index + 1}`} placeholder="Jenis / pilih riwayat" value={item.jenis} onChange={(event) => updateItem(index, "jenis", event.target.value)} />
                    <Input aria-label={`Jumlah barang ${index + 1}`} placeholder="Jumlah" value={item.jumlah} onChange={(event) => updateItem(index, "jumlah", event.target.value)} />
                    <Input aria-label={`Keterangan barang ${index + 1}`} placeholder="Keterangan" value={item.keterangan} onChange={(event) => updateItem(index, "keterangan", event.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <datalist id="nota-dinas-item-catalog">{itemCatalog.map((item) => <option key={item} value={item} />)}</datalist>
            <Button type="button" variant="outline" onClick={addItem} className="mt-3 h-10 w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"><Plus className="mr-2 h-4 w-4" /> Tambah Barang</Button>
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-5">
            <Field label="Kalimat Penutup"><Textarea rows={2} value={activePenutup} onChange={(event) => setActiveField("penutup", event.target.value)} /></Field>
            <Field label="Jabatan Penandatangan"><Input value={activeJabatanPenandatangan} onChange={(event) => setActiveField("jabatanPenandatangan", event.target.value)} /></Field>
            <Field label="Kantor / Wilayah Penandatangan"><Input value={activeKantorPenandatangan} onChange={(event) => setActiveField("kantorPenandatangan", event.target.value)} /></Field>
            <Field label="Nama Penandatangan"><Input value={activeNamaPenandatangan} onChange={(event) => setActiveField("namaPenandatangan", event.target.value)} /></Field>
            <Field label="NIP"><Input value={activeNipPenandatangan} onChange={(event) => setActiveField("nipPenandatangan", event.target.value)} /></Field>
          </div>
        </div>

        <div className="nota-dinas-preview-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-6">
          <NotaDinasSheet
            kepada={form.kepada}
            dari={form.dari}
            nomor={firstNumber}
            tanggal={displayDate}
            hal={form.hal}
            wilayah={form.wilayah}
            jumlahKecamatan={form.jumlahKecamatan}
            kecamatan={form.kecamatan}
            penerima={form.penerima}
            koordinatorRujukan={form.koordinatorRujukan}
            referenceNumber={referenceNumber}
            penutup={form.penutup}
            jabatanPenandatangan={form.jabatanPenandatangan}
            kantorPenandatangan={form.kantorPenandatangan}
            namaPenandatangan={form.namaPenandatangan}
            nipPenandatangan={form.nipPenandatangan}
            items={form.items}
            isLanjutan={false}
          />
          <NotaDinasSheet
            kepada={form.lanjutanKepada}
            dari={form.lanjutanDari}
            nomor={lanjutanNumber}
            tanggal={displayDate}
            hal={form.lanjutanHal}
            wilayah={form.wilayah}
            jumlahKecamatan={form.jumlahKecamatan}
            kecamatan={form.kecamatan}
            penerima={form.penerima}
            koordinatorRujukan={form.koordinatorRujukan}
            referenceNumber={referenceNumber}
            penutup={form.lanjutanPenutup}
            jabatanPenandatangan={form.lanjutanJabatanPenandatangan}
            kantorPenandatangan={form.lanjutanKantorPenandatangan}
            namaPenandatangan={form.lanjutanNamaPenandatangan}
            nipPenandatangan={form.lanjutanNipPenandatangan}
            items={form.items}
            isLanjutan
          />
        </div>
      </div>

      <style>{`
        .nota-dinas-sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 20mm; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.16; }
        .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 24px; }
        .nota-dinas-title { margin: 0 0 42px; text-align: center; font-size: 15pt; font-weight: 400; text-decoration: underline; }
        .nota-dinas-meta { display: grid; gap: 5px; margin-bottom: 29px; }
        .nota-dinas-meta > div { display: grid; grid-template-columns: 23mm 4mm minmax(0, 1fr); align-items: start; column-gap: 0; }
        .nota-dinas-meta b { font-weight: 400; }
        .nota-dinas-meta > div > span:last-child { font-weight: 400; }
        .nota-dinas-rule { height: 6px; margin: 0 -0.5mm 27px; border-top: 4px double #111; }
        .nota-dinas-body { margin: 0 0 23px; text-align: justify; }
        .nota-dinas-request { margin: 0 0 14px 10mm; }
        .nota-dinas-table { width: 100%; border-collapse: collapse; margin-bottom: 23px; table-layout: fixed; }
        .nota-dinas-table th, .nota-dinas-table td { border: 1px solid #111; padding: 4px 7px; vertical-align: middle; }
        .nota-dinas-table th { height: 29px; font-size: 14pt; font-weight: 400; text-align: center; }
        .nota-dinas-table td { height: 22px; font-size: 11pt; }
        .nota-dinas-table th:nth-child(1), .nota-dinas-table td:nth-child(1) { width: 10%; text-align: center; }
        .nota-dinas-table th:nth-child(2), .nota-dinas-table td:nth-child(2) { width: 39%; }
        .nota-dinas-table th:nth-child(3), .nota-dinas-table td:nth-child(3) { width: 28%; }
        .nota-dinas-table th:nth-child(4), .nota-dinas-table td:nth-child(4) { width: 23%; }
        .nota-dinas-closing { margin-bottom: 24px; }
        .nota-dinas-final { margin: 0 0 0 14mm; }
        .nota-dinas-final-lanjutan { margin-left: 0; }
        .nota-dinas-signature { width: 68mm; margin: 79px 0 0 auto; display: flex; flex-direction: column; font-size: 12pt; line-height: 1.15; }
        .nota-dinas-signature-space { height: 132px; }
        .nota-dinas-underlined { text-decoration: underline; }
        @media screen and (max-width: 1279px) {
          .nota-dinas-preview-wrap { display: flex; flex-direction: column; align-items: center; }
          .nota-dinas-sheet { zoom: 0.72; }
          .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 18px; }
        }
        @media screen and (max-width: 767px) {
          .nota-dinas-preview-wrap { padding: 8px; border-radius: 14px; }
          .nota-dinas-sheet { zoom: 0.43; box-shadow: 0 4px 14px rgb(15 23 42 / 0.18); }
          .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 12px; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: 210mm !important; min-width: 210mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body { overflow: visible !important; }
          header, .nota-dinas-main > :not(.nota-dinas-tabs) { display: none !important; }
          .nota-dinas-main { width: 210mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .nota-dinas-tabs > div:first-child { display: none !important; }
          .nota-dinas-preview-wrap { position: absolute !important; inset: 0 auto auto 0 !important; display: block !important; width: 210mm !important; overflow: visible !important; padding: 0 !important; border: 0 !important; background: white !important; box-shadow: none !important; }
          .nota-dinas-sheet { zoom: 1 !important; width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 20mm !important; box-shadow: none !important; }
          .nota-dinas-sheet + .nota-dinas-sheet { break-before: page !important; page-break-before: always !important; }
        }
      `}</style>
    </section>
  );
};

export default NotaDinasTab;
