import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowUpDown, ChevronDown, ChevronUp, Eye, FilePlus2, FileText, Filter, Loader2, Pencil, Plus, Printer, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { notaDinasService } from "@/services/notaDinasService";
import { notaDinasTemplateService } from "@/services/notaDinasTemplateService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAccess } from "@/constants/access-control";
import { useValueDraft } from "@/hooks/useFormDraft";
import TotalRecordLabel from "@/components/TotalRecordLabel";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { NotaDinasCategory, NotaDinasForm, NotaDinasItem, NotaDinasKind, NotaDinasRecord, NotaDinasTemplate, KolomTabel } from "@/types/notaDinas";
import { DEFAULT_KOLOM_PERBAIKAN, DEFAULT_KOLOM_PERMINTAAN } from "@/types/notaDinas";

type SortDirection = "asc" | "desc";
type NotaDinasSortKey = "requestNumber" | "continuationNumber" | "date" | "subject" | "region" | "items";

const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const compareSortValues = (left: string | number, right: string | number) => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
};

const SAMPLE_FORM: NotaDinasForm = {
  jenisDokumen: "permintaan",
  jenisNotaDinas: "permintaan_alat",
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
  tanggal: getCurrentDate(),
  tanggalLanjutan: getCurrentDate(),
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
  tanggalRujukan: getCurrentDate(),
  halRujukan: "Permintaan Alat Kerja di Wilayah 4 Medan Kota",
  perbaikanPlatKendaraan: "",
  perbaikanJenisKendaraan: "",
  perbaikanSupir: "",
  perbaikanNoHp: "",
  perbaikanUraianPemeriksaan: "",
  perbaikanLokasi: "",
  perbaikanKegiatan: "",
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

/**
 * Form kosong untuk membuat Nota Dinas baru — tidak ada nilai contoh.
 * Hanya field yang bersifat teknis (toggle otomatis, tanggal hari ini) yang diisi.
 */
const EMPTY_FORM: NotaDinasForm = {
  jenisDokumen: "permintaan",
  jenisNotaDinas: "permintaan_alat",
  kepada: "",
  dari: "",
  nomorUrut: "",
  nomorLanjutanUrut: "",
  kodeSurat: "SPB",
  kodeWilayah: "",
  gunakanNomorOtomatis: true,
  nomorManual: "",
  gunakanNomorOtomatisPertama: true,
  nomorManualPertama: "",
  gunakanNomorOtomatisLanjutan: true,
  nomorManualLanjutan: "",
  tanggal: getCurrentDate(),
  tanggalLanjutan: getCurrentDate(),
  hal: "Permintaan Alat Kerja",
  wilayah: "",
  jumlahKecamatan: "",
  kecamatan: "",
  penerima: "",
  lanjutanKepada: "",
  lanjutanDari: "",
  lanjutanHal: "",
  lanjutanPenutup: "",
  lanjutanJabatanPenandatangan: "",
  lanjutanKantorPenandatangan: "",
  lanjutanNamaPenandatangan: "",
  lanjutanNipPenandatangan: "",
  koordinatorRujukan: "",
  gunakanRujukanOtomatis: true,
  nomorRujukan: "",
  tanggalRujukan: getCurrentDate(),
  halRujukan: "",
  perbaikanPlatKendaraan: "",
  perbaikanJenisKendaraan: "",
  perbaikanSupir: "",
  perbaikanNoHp: "",
  perbaikanUraianPemeriksaan: "",
  perbaikanLokasi: "",
  perbaikanKegiatan: "",
  penutup: "",
  jabatanPenandatangan: "",
  kantorPenandatangan: "",
  namaPenandatangan: "",
  nipPenandatangan: "",
  items: [{ jenis: "", jumlah: "", keterangan: "" }],
};

const REPAIR_SAMPLE_FORM: Partial<NotaDinasForm> = {
  kepada: "Ketua Tim Pemeliharaan Lingkungan",
  dari: "Kepala Koordinator Wilayah Medan Selatan",
  nomorUrut: "013",
  tanggal: "2026-09-21",
  tanggalLanjutan: "2026-09-23",
  hal: "Permintaan Perbaikan Kendaraan Truck Sampah BK 9213 J",
  wilayah: "Wilayah 5 Medan Selatan",
  lanjutanKepada: "Kepala Bidang Tata Lingkungan Kota Medan",
  lanjutanDari: "Ketua Tim Pemeliharaan Lingkungan",
  lanjutanHal: "Permintaan Perbaikan Kendaraan Truck Sampah BK 9213 J",
  koordinatorRujukan: "Kepala Koordinator Wilayah Medan Selatan",
  tanggalRujukan: "2026-09-21",
  halRujukan: "Permintaan Perbaikan Kendaraan Truck Sampah BK 9213 J",
  perbaikanPlatKendaraan: "BK 9213 J",
  perbaikanJenisKendaraan: "Truck Sampah",
  perbaikanSupir: "",
  perbaikanNoHp: "",
  perbaikanUraianPemeriksaan: "Truck Sampah BK 9213 J tersebut telah rusak",
  perbaikanLokasi: "Jl. Asoka Pasar 1 Tanjung Sari",
  perbaikanKegiatan: "pengerjaan pohon aren",
  penutup: "Demikian kami sampaikan kepada Ibu, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.",
  jabatanPenandatangan: "Kepala Koordinator Taman",
  kantorPenandatangan: "Wilayah 4 Medan Kota",
  lanjutanPenutup: "Demikian kami sampaikan kepada Ibu, atas arahan dan petunjuk selanjutnya diucapkan terimakasih.",
  lanjutanJabatanPenandatangan: "Ketua Tim Pemeliharaan Lingkungan",
  lanjutanKantorPenandatangan: "",
  lanjutanNamaPenandatangan: "Anitha Florida Ginting, S.T., M.Si",
  lanjutanNipPenandatangan: "198111282010012011",
};

const REPAIR_SAMPLE_ITEMS: NotaDinasItem[] = [
  { jenis: "Rem blong", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Kain KLOS", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Ban botak", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Lampu LED", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Tempat minyak hydrolik bocor", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Gigih tarik tidak berfungsi.", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Mesin gigi hydrolik rusak agak panyak masuk", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Atap mobil bocor.", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Kunci kontak ya bermasalah.", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Mesin masuk angin.", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Kepala batrai rusak.", jumlah: "", satuan: "", keterangan: "" },
  { jenis: "Pasang lampu LED untuk dinas malam seperti urgent", jumlah: "", satuan: "", keterangan: "" },
];

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
const NOTA_CODE_BY_REGION_CODE: Record<string, string> = {
  pusat: "PST",
  "wilayah-1": "MU",
  "wilayah-2": "MB",
  "wilayah-3": "MT",
  "wilayah-4": "MK",
  "wilayah-5": "MS",
};
const LETTER_TYPES = [
  { code: "SPB", label: "Surat Permintaan Barang" },
  { code: "SPm-PM", label: "Nota Perbaikan" },
] as const;
const DOCUMENT_TYPES = [
  { value: "permintaan" as const, label: "Nota Dinas Permintaan (SPB / SPm-PM)" },
  { value: "lanjutan" as const, label: "Nota Dinas Lanjutan / Tindak Lanjut" },
];
const NOTA_DINAS_CATEGORIES = [
  { value: "permintaan_alat" as const, label: "Permintaan Alat" },
  { value: "permintaan_bunga_bahan" as const, label: "Permintaan Bunga dan Bahan" },
  { value: "perbaikan" as const, label: "Perbaikan" },
] as const;
const HAL_OPTIONS = ["Permintaan Alat Kerja", "Permintaan Perbaikan"] as const;

const readDraft = (): NotaDinasForm => {
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

const getFirstSequence = (record: NotaDinasRecord) => {
  const candidates = [record.form.nomorUrut, record.form.nomorManualPertama, record.form.nomorManual];
  for (const candidate of candidates) {
    const match = String(candidate || "").trim().match(/^(\d+)/);
    if (match) return Number(match[1]);
  }
  return 0;
};

const getNextRequestSequence = (records: NotaDinasRecord[]) => {
  const lastSequence = records.reduce((highest, record) => Math.max(highest, getFirstSequence(record)), 0);
  return String(lastSequence + 1).padStart(3, "0");
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

const getNotaDinasCategory = (record: NotaDinasRecord): NotaDinasCategory =>
  record.form.jenisDokumen === "perbaikan" ? "perbaikan" : record.form.jenisNotaDinas || "permintaan_alat";

const getLetterTypeForCategory = (category: NotaDinasCategory) =>
  category === "perbaikan" ? "SPm-PM" : "SPB";

const formatLongDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const getHalWithRegion = (hal: string, wilayah: string) => {
  const trimmedHal = hal.trim();
  const trimmedRegion = wilayah.trim();
  if (!trimmedHal || !trimmedRegion) return trimmedHal || trimmedRegion;

  const regionIndex = REGION_CODES.findIndex((region) => trimmedHal.toLocaleLowerCase().includes(region.label.toLocaleLowerCase()));
  const baseHal = regionIndex >= 0
    ? trimmedHal.slice(0, trimmedHal.toLocaleLowerCase().indexOf(REGION_CODES[regionIndex].label.toLocaleLowerCase())).replace(/\s+di\s*$/i, "").trim()
    : trimmedHal;
  return [baseHal, trimmedRegion].filter(Boolean).join(" ");
};

const getRenderedHal = (hal: string, wilayah: string) => hal.trim() ? getHalWithRegion(hal, wilayah) : "";

const getLetterMonth = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : ROMAN_MONTHS[date.getMonth()];
};

const getLetterYear = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : String(date.getFullYear());
};

const printValue = (value: string) => value.trim() || "......";

const getUniqueOptions = (values: Array<string | undefined>) => Array.from(new Set(
  values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
)).sort((left, right) => left.localeCompare(right, "id-ID"));

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
  referenceDate: string;
  referenceHal: string;
  isRepair: boolean;
  platKendaraan: string;
  jenisKendaraan: string;
  supir: string;
  noHp: string;
  uraianPemeriksaan: string;
  lokasiKejadian: string;
  kegiatanKejadian: string;
  penutup: string;
  jabatanPenandatangan: string;
  kantorPenandatangan: string;
  namaPenandatangan: string;
  nipPenandatangan: string;
  items: NotaDinasItem[];
  isLanjutan: boolean;
  showTitle: boolean;
  /** Teks paragraf dari template — menggantikan teks hardcoded */
  templateParagrafPembuka?: string;
  templateParagrafSubJudul?: string;
  templateParagrafPenutup?: string;
  templateParagrafPerbaikanPermintaan?: string;
  templateParagrafPerbaikanLanjutan?: string;
  templateParagrafLanjutanAlat?: string;
  templateParagrafKalimatPenutup?: string;
  /** Konfigurasi kolom tabel perbaikan dari template */
  kolomPerbaikan?: KolomTabel[] | null;
  /** Konfigurasi kolom tabel permintaan alat/bunga dari template */
  kolomPermintaan?: KolomTabel[] | null;
};

const NotaDinasSheet = ({
  kepada, dari, nomor, tanggal, hal, wilayah, jumlahKecamatan, kecamatan, penerima,
  koordinatorRujukan, referenceNumber, referenceDate, referenceHal, isRepair,
  platKendaraan, jenisKendaraan, supir, noHp, uraianPemeriksaan, lokasiKejadian, kegiatanKejadian,
  penutup, jabatanPenandatangan,
  kantorPenandatangan, namaPenandatangan, nipPenandatangan, items, isLanjutan,
  showTitle,
  templateParagrafPembuka,
  templateParagrafSubJudul,
  templateParagrafPenutup,
  templateParagrafPerbaikanPermintaan,
  templateParagrafPerbaikanLanjutan,
  templateParagrafLanjutanAlat,
  templateParagrafKalimatPenutup,
  kolomPerbaikan,
  kolomPermintaan,
}: NotaDinasSheetProps) => {
  // Kolom tabel perbaikan — pakai dari template atau default
  const activeKolom: KolomTabel[] = kolomPerbaikan && kolomPerbaikan.length > 0
    ? kolomPerbaikan
    : DEFAULT_KOLOM_PERBAIKAN;

  // Kolom tabel permintaan — pakai dari template atau default
  const activeKolomPermintaan: KolomTabel[] = kolomPermintaan && kolomPermintaan.length > 0
    ? kolomPermintaan
    : DEFAULT_KOLOM_PERMINTAAN;

  // Nilai placeholder untuk substitusi template
  const placeholders: Record<string, string> = {
    wilayah, jumlahKecamatan, kecamatan,
    penerima: penerima || "",
    kepada,
    koordinatorRujukan,
    nomorRujukan: referenceNumber,
    tanggalRujukan: referenceDate,
    halRujukan: referenceHal,
    jenisKendaraan, platKendaraan,
    uraianPemeriksaan, lokasiKejadian, kegiatanKejadian,
  };
  const ph = (text: string) => Object.entries(placeholders).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v || "......"), text
  );

  // Gunakan template jika tersedia, fallback ke teks default
  const tPembuka = templateParagrafPembuka
    ?? `Sehubungan telah habisnya persediaan alat kerja di {wilayah}, Untuk {jumlahKecamatan} Kecamatan ({kecamatan}). Maka dibutuhkan penambahan alat kerja untuk kelancaran operasional di {wilayah}.`;
  const tSubJudul = templateParagrafSubJudul
    ?? `Adapun Permintaan Barang yang dibutuhkan sebagai berikut :`;
  const tPenutupPermintaan = templateParagrafPenutup
    ?? `Berkenaan dengan hal tersebut dimohon kepada {penerima} {kepada}, Agar kiranya memberikan Alat kerja tersebut.`;
  const tPerbaikanPermintaan = templateParagrafPerbaikanPermintaan
    ?? `Sehubungan untuk kelancaran pekerjaan operasional di {wilayah}, dengan ini kami melaporkan kerusakan kendaraan/Peralatan Mesin Kerja Nota Dinas Permintaan Perbaikan Kendaraan {jenisKendaraan} {platKendaraan} antara lain :`;
  const tPerbaikanLanjutan = templateParagrafPerbaikanLanjutan
    ?? `Menindaklanjuti surat dari {koordinatorRujukan} dengan Nomor : {nomorRujukan} Tanggal {tanggalRujukan}, Perihal {halRujukan}. Setelah dilakukan penelaahan dan pemeriksaan bahwa {uraianPemeriksaan}, pada saat kerja di {lokasiKejadian} ({kegiatanKejadian}).`;
  const tLanjutanAlat = templateParagrafLanjutanAlat
    ?? `Menindaklanjuti Surat dari {koordinatorRujukan} Nomor : {nomorRujukan} Tanggal {tanggalRujukan} Perihal {halRujukan}. Untuk Keperluan dan Kelancaran Kerja di Lapangan telah dilakukan Penelaahan dan Pemeriksaan bahwa telah Habisnya Alat Kerja tersebut.`;

  // Kalimat penutup surat: pakai dari form jika sudah diisi, fallback ke template
  const tKalimatPenutup = penutup?.trim()
    ? penutup
    : (templateParagrafKalimatPenutup ?? "");

  return (
  <article className={`nota-dinas-sheet${isRepair ? " nota-dinas-repair-sheet" : ""} mx-auto bg-white text-black shadow-xl`}>
    {showTitle && <h1 className="nota-dinas-title">NOTA DINAS</h1>}

    <div className="nota-dinas-meta">
      <div><span>Yth</span><b>:</b><span>{printValue(kepada)}</span></div>
      <div><span>Dari</span><b>:</b><span>{printValue(dari)}</span></div>
      <div><span>Nomor</span><b>:</b><span>{printValue(nomor)}</span></div>
      <div><span>Tanggal</span><b>:</b><span>{printValue(tanggal)}</span></div>
      <div><span>Hal</span><b>:</b><span>{printValue(hal)}</span></div>
    </div>

    <div className="nota-dinas-rule" />

    {isRepair ? (isLanjutan ? <>
      <p className="nota-dinas-body nota-dinas-repair-paragraph">{ph(tPerbaikanLanjutan)}</p>
      <div className="nota-dinas-driver"><div className="nota-dinas-driver-row"><span>Supir</span><b>:</b><span>{printValue(supir)}</span></div><div className="nota-dinas-driver-row"><span>No. HP</span><b>:</b><span>{printValue(noHp)}</span></div></div>
    </> : <>
      <p className="nota-dinas-body nota-dinas-repair-paragraph">{ph(tPerbaikanPermintaan)}</p>
      <div className="nota-dinas-driver"><div className="nota-dinas-driver-row"><span>Supir</span><b>:</b><span>{printValue(supir)}</span></div><div className="nota-dinas-driver-row"><span>No. HP</span><b>:</b><span>{printValue(noHp)}</span></div></div>
    </>) : isLanjutan ? <>
      <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tLanjutanAlat)}</p>
      <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tSubJudul)}</p>
    </> : <>
      <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tPembuka)}</p>
      <p style={{ margin: "0 0 23px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tSubJudul)}</p>
    </>}

    {isRepair ? (() => {
      // Render tabel perbaikan dinamis berdasarkan konfigurasi kolom dari template
      const rowspanKolom = activeKolom.filter((k) => k.rowspan);
      const nonRowspanKolom = activeKolom.filter((k) => !k.rowspan);
      const displayItems = items.length > 0 ? items : [{ jenis: "", jumlah: "", satuan: "", keterangan: "" }];
      // Nilai untuk kolom rowspan — ambil dari form atau item pertama
      const rowspanValues: Record<string, string> = {};
      rowspanKolom.forEach((k) => {
        if (k.id === "plat") rowspanValues[k.id] = platKendaraan;
        else if (k.id === "jenis") rowspanValues[k.id] = jenisKendaraan;
        else rowspanValues[k.id] = displayItems[0]?.[k.id] || "";
      });
      return (
        <table className="nota-dinas-table nota-dinas-repair-table">
          <thead>
            <tr>
              {activeKolom.map((k) => (
                <th key={k.id} style={{ width: `${k.lebar}%` }}>{k.judul}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, index) => (
              <tr key={index}>
                {rowspanKolom.map((k) =>
                  index === 0 ? (
                    <td key={k.id} rowSpan={displayItems.length}>
                      {printValue(rowspanValues[k.id] || "")}
                    </td>
                  ) : null
                )}
                {nonRowspanKolom.map((k) => (
                  <td key={k.id} className="nota-dinas-repair-item">
                    {k.id === "perbaikan" ? printValue(item.jenis) : printValue(item[k.id] || "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    })() : (() => {
      // Render tabel permintaan dinamis berdasarkan konfigurasi kolom dari template
      const displayItems = items.length > 0 ? items : [{ jenis: "", jumlah: "", satuan: "", keterangan: "" }];
      return (
        <table className="nota-dinas-table">
          <thead>
            <tr>
              {activeKolomPermintaan.map((k) => (
                <th key={k.id} style={{ width: `${k.lebar}%` }}>{k.judul}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, index) => (
              <tr key={index}>
                {activeKolomPermintaan.map((k) => {
                  if (k.id === "nomor") return <td key={k.id}>{index + 1}.</td>;
                  if (k.id === "jumlah") return <td key={k.id}>{printValue(`${item.jumlah || ""}${item.satuan ? ` ${item.satuan}` : ""}`)}</td>;
                  return <td key={k.id}>{printValue((item[k.id] as string) || "")}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    })()}

    {!isLanjutan && !isRepair && <p style={{ margin: "0 0 24px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tPenutupPermintaan)}</p>}
    {isRepair
      ? <p className="nota-dinas-body nota-dinas-repair-paragraph nota-dinas-closing">{ph(tKalimatPenutup)}</p>
      : <p style={{ margin: "0 0 24px", textAlign: "justify", textIndent: "12.7mm" }}>{ph(tKalimatPenutup)}</p>
    }

    <div className="nota-dinas-signature">
      <span>{printValue(jabatanPenandatangan)}</span>
      <span>{printValue(kantorPenandatangan)}</span>
      <div className="nota-dinas-signature-space" />
      <span className="nota-dinas-underlined">{printValue(namaPenandatangan)}</span>
      <span>NIP {printValue(nipPenandatangan)}</span>
    </div>
  </article>
  );
};

const NotaDinasTab = ({ recordCount, isActive }: { recordCount?: number | null; isActive?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, session } = useAuth();
  const viewStorageKey = session?.user?.id ? `nota-dinas:view:${session.user.id}` : undefined;
  const [form, setForm] = useState<NotaDinasForm>(readDraft);
  const [itemCatalog, setItemCatalog] = useState<string[]>(readItemCatalog);
  const [records, setRecords] = useState<NotaDinasRecord[]>([]);
  const [deleteNotaConfirm, setDeleteNotaConfirm] = useState<{ open: boolean; record: NotaDinasRecord | null }>({ open: false, record: null });
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [view, setViewState] = useState<"list" | "form">("list");
  const [viewMode, setViewMode] = useState<"view" | "edit">("edit");
  const [sort, setSort] = useState<{ key: NotaDinasSortKey; direction: SortDirection } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<NotaDinasCategory | "semua">("semua");
  const [accountRegion, setAccountRegion] = useState<{ id: string; name: string; notaCode: string } | null>(null);
  const [accountRegionReady, setAccountRegionReady] = useState(false);
  const [sheetTemplate, setSheetTemplate] = useState(() => notaDinasTemplateService.buildDefaultTemplate("permintaan_alat"));
  const [availableTemplates, setAvailableTemplates] = useState<NotaDinasTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const isLanjutan = form.jenisDokumen === "lanjutan";
  const isRepair = form.jenisNotaDinas === "perbaikan";
  const isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email);
  const isRegionalNotaAdmin = !isSuperAdmin && Boolean(profile?.region_id);
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

  const applyAccountRegion = (value: NotaDinasForm): NotaDinasForm => accountRegion
    ? { ...value, kodeWilayah: accountRegion.notaCode, wilayah: accountRegion.name, lanjutanHal: getRenderedHal(value.hal, accountRegion.name) }
    : value;

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

  // Load template saat kategori nota, wilayah akun, tab aktif, atau kembali dari halaman template
  useEffect(() => {
    const kategori = form.jenisNotaDinas || "permintaan_alat";
    const regionId = accountRegion?.id ?? null;
    let active = true;
    void notaDinasTemplateService
      .getTemplatesByKategori(kategori, regionId)
      .then((tpls) => {
        if (!active) return;
        setAvailableTemplates(tpls);

        // Prioritas pemilihan template aktif:
        // 1. Template wilayah sendiri yang isDefault=true
        // 2. Template wilayah sendiri yang pertama (jika ada)
        // 3. Template global yang isDefault=true (fallback jika tidak ada template wilayah)
        // 4. Template global pertama (fallback terakhir)
        const ownTemplates = regionId ? tpls.filter((t) => t.regionId === regionId) : tpls.filter((t) => t.regionId === null);
        const globalTemplates = regionId ? tpls.filter((t) => t.regionId === null) : [];

        const defaultTpl =
          ownTemplates.find((t) => t.isDefault) ??
          ownTemplates[0] ??
          globalTemplates.find((t) => t.isDefault) ??
          globalTemplates[0];

        if (defaultTpl) {
          setSelectedTemplateId(defaultTpl.id);
          setSheetTemplate(defaultTpl);
        } else {
          setSelectedTemplateId('');
          setSheetTemplate(notaDinasTemplateService.buildDefaultTemplate(kategori));
        }
      })
      .catch(() => {
        if (!active) return;
        setAvailableTemplates([]);
        setSelectedTemplateId('');
        setSheetTemplate(notaDinasTemplateService.buildDefaultTemplate(kategori));
      });
    return () => { active = false; };
  // isActive dan location.pathname memastikan reload saat kembali dari halaman template
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.jenisNotaDinas, accountRegion, isActive, location.pathname]);

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
    if (isRegionalNotaAdmin && !accountRegionReady) return;
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
          const localForm = applyAccountRegion(localRecord.form);
          try {
            if (!remoteRecord) {
              const createdRecord = await notaDinasService.create(
                localForm,
                localRecord.id,
                localRecord.createdAt,
                localRecord.updatedAt,
                accountRegion?.id,
              );
              recordsById.set(createdRecord.id, createdRecord);
            } else if (isNewerRecord(localRecord, remoteRecord)) {
              const updatedRecord = await notaDinasService.update(
                remoteRecord.id,
                localForm,
                localRecord.updatedAt,
                accountRegion?.id,
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
  }, [accountRegion, accountRegionReady, isRegionalNotaAdmin]);

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
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = availableTemplates.find((t) => t.id === templateId);
    if (tpl) setSheetTemplate(tpl);
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

  const sortableHeader = (label: string, key: NotaDinasSortKey, className = "") => {
    const active = sort?.key === key;
    const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ChevronUp : ChevronDown;
    return <th className={`px-3 py-3 sm:px-5 ${className}`}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1.5 hover:text-indigo-700" aria-label={`Urutkan ${label}`} title={`Urutkan ${label}`}>
        {label}<Icon className="h-3.5 w-3.5" />
      </button>
    </th>;
  };

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
      <section className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <h2 className="font-black">Nota Dinas</h2>
              <p className="mt-0.5 text-sm text-indigo-800/80">Kelola Nota Dinas Permintaan dan Nota Dinas Lanjutan dalam satu dokumen PDF dua halaman.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/nota-dinas/template")} className="h-10 shrink-0 rounded-xl border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">
              <Settings2 className="mr-2 h-4 w-4" /> Pengaturan Template
            </Button>
            <Button type="button" onClick={createNew} className="h-10 shrink-0 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
              <FilePlus2 className="mr-2 h-4 w-4" /> Tambah Nota Dinas
            </Button>
          </div>
        </div>

        <TotalRecordLabel count={recordCount === undefined ? records.length : recordCount} />
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-950">Data Nota Dinas</h3>
              <p className="text-sm text-slate-500">Daftar Nota Dinas yang telah disimpan.</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{sortedRecords.length} dokumen</span>
          </div>

          <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <Filter className="h-4 w-4 text-indigo-500" />
              <span>Filter Nota Dinas</span>
            </div>
            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as NotaDinasCategory | "semua")}>
              <SelectTrigger className="w-full bg-white sm:w-[260px]"><SelectValue placeholder="Semua Nota Dinas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Nota Dinas</SelectItem>
                {NOTA_DINAS_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
              <p className="font-bold text-slate-700">{categoryFilter === "semua" ? "Belum ada Nota Dinas tersimpan" : "Tidak ada Nota Dinas dengan filter ini"}</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">{categoryFilter === "semua" ? "Klik “Tambah Nota Dinas” untuk membuat dan menyimpan dokumen pertama." : "Pilih filter lain atau tambahkan Nota Dinas baru."}</p>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-3 sm:px-5">No.</th>
                    {sortableHeader("Nota Permintaan", "requestNumber")}
                    {sortableHeader("Nota Lanjutan", "continuationNumber", "hidden md:table-cell")}
                    {sortableHeader("Tanggal", "date", "hidden sm:table-cell")}
                    {sortableHeader("Perihal", "subject")}
                    {sortableHeader("Wilayah", "region", "hidden lg:table-cell")}
                    {sortableHeader("Barang", "items", "hidden text-center md:table-cell")}
                    <th className="w-20 px-3 py-3 text-right sm:w-28 sm:px-5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRecords.map((record, index) => {
                    const firstNumber = getNumberLabel(record);
                    const continuationNumber = getNumberLabel(record, true);
                    return <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-4 font-semibold text-slate-500 sm:px-5">{index + 1}</td>
                      <td className="break-words px-3 py-4 font-semibold text-slate-800 sm:px-5">{firstNumber}</td>
                      <td className="hidden break-words px-3 py-4 text-slate-700 md:table-cell sm:px-5">{continuationNumber}</td>
                      <td className="hidden px-3 py-4 whitespace-nowrap text-slate-600 sm:table-cell sm:px-5">{formatLongDate(record.form.tanggal)}</td>
                      <td className="px-3 py-4 text-slate-700 sm:px-5"><span className="line-clamp-2">{record.form.hal || "-"}</span><span className="mt-1 block text-[10px] text-slate-400 sm:hidden">{formatLongDate(record.form.tanggal)}</span></td>
                      <td className="hidden px-3 py-4 text-slate-700 lg:table-cell sm:px-5">{record.form.wilayah || "-"}</td>
                      <td className="hidden px-3 py-4 text-center font-semibold text-slate-700 md:table-cell sm:px-5">{record.form.items.length}</td>
                      <td className="px-3 py-4 text-right sm:px-5"><div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => openRecord(record, "view")} className="border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 sm:px-3"><Eye className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Buka</span></Button><Button type="button" variant="outline" size="sm" onClick={() => openRecord(record, "edit")} className="border-emerald-200 px-2 text-emerald-700 hover:bg-emerald-50 sm:px-3"><Pencil className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Edit</span></Button><Button type="button" variant="outline" size="sm" onClick={() => void deleteRecord(record)} aria-label="Hapus Nota Dinas" title="Hapus Nota Dinas" className="border-red-200 px-2 text-red-600 hover:bg-red-50 sm:px-3"><Trash2 className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Hapus</span></Button></div></td>
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Nota Dinas" className="sm:col-span-2 xl:col-span-1">
              <Select value={form.jenisNotaDinas} onValueChange={(value) => handleNotaCategoryChange(value as NotaDinasCategory)}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis Nota Dinas" /></SelectTrigger>
                <SelectContent>{NOTA_DINAS_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {availableTemplates.length > 1 && (
              <Field label="Pilih Template" className="sm:col-span-2 xl:col-span-1">
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.nama}{tpl.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {!isLanjutan && <Field label="Jenis Nota">
              <Select value={form.kodeSurat} disabled>
                <SelectTrigger><SelectValue placeholder="Pilih jenis nota" /></SelectTrigger>
                <SelectContent>{LETTER_TYPES.map((letterType) => <SelectItem key={letterType.code} value={letterType.code}>{letterType.code} - {letterType.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>}
            <Field label="Jenis Dokumen" className="sm:col-span-2 xl:col-span-1">
              <Select value={form.jenisDokumen} onValueChange={(value) => handleDocumentTypeChange(value as NotaDinasKind)}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis dokumen" /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map((documentType) => <SelectItem key={documentType.value} value={documentType.value}>{documentType.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Yth / Kepada"><Input list="nota-dinas-kepada-options" value={activeKepada} onChange={(event) => setActiveField("kepada", event.target.value)} /></Field>
            <Field label="Dari"><Input list="nota-dinas-dari-options" value={activeDari} onChange={(event) => setActiveField("dari", event.target.value)} /></Field>
            {!isLanjutan && <Field label="Nomor Urut Surat Permintaan"><Input value={form.nomorUrut} onChange={(event) => setField("nomorUrut", event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" maxLength={3} placeholder="001" /><span className="block text-[11px] text-slate-400">{activeRecordId ? "Nomor tersimpan dapat diedit manual." : `Otomatis melanjutkan nomor terakhir: ${nextRequestSequence}. Tetap dapat diedit manual.`}</span></Field>}
            {isLanjutan && <Field label="Nomor Urut Nota Lanjutan"><Input value={form.nomorLanjutanUrut} onChange={(event) => setField("nomorLanjutanUrut", event.target.value)} placeholder="Isi nomor urut" /></Field>}
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
            <Field label={`Tanggal Surat ${isLanjutan ? "Lanjutan" : "Pertama"}`}><Input type="date" value={activeDateValue} onChange={(event) => setActiveDate(event.target.value)} /><span className="block text-[11px] text-slate-400">Kode bulan dan tahun nomor dibuat otomatis: {getLetterMonth(activeDateValue)} / {getLetterYear(activeDateValue)}</span></Field>
            {!isLanjutan && <Field label="Hal" className="sm:col-span-2 xl:col-span-1">
              <Select value={activeHalOption} onValueChange={handleHalOptionChange}>
                <SelectTrigger><SelectValue placeholder="Pilih Hal" /></SelectTrigger>
                <SelectContent>
              {halOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  <SelectItem value="manual">Isi Manual</SelectItem>
                </SelectContent>
              </Select>
              {activeHalOption === "manual" && <Textarea className="mt-2" rows={2} value={activeHal} onChange={(event) => setActiveField("hal", event.target.value)} placeholder="Tulis Hal secara manual" />}
            </Field>}
            {isSuperAdmin && !isLanjutan && <Field label="Pilihan Wilayah">
              <Select value={form.kodeWilayah} onValueChange={handleRegionChange} disabled={!isSuperAdmin}>
                <SelectTrigger><SelectValue placeholder="Pilih kode wilayah" /></SelectTrigger>
                <SelectContent>{REGION_CODES.map((region) => <SelectItem key={region.code} value={region.code}>{region.code} - {region.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className="block text-[11px] text-indigo-600">Pilih wilayah untuk Nota Dinas.</span>
            </Field>}
            {isLanjutan && <>
              <Field label="Pengirim Surat Rujukan">
                <Input list="nota-dinas-dari-options" value={form.koordinatorRujukan} onChange={(event) => setField("koordinatorRujukan", event.target.value)} />
                <span className="block text-[11px] text-slate-400">Otomatis dari field "Dari" surat permintaan. Bisa diedit manual jika berbeda.</span>
              </Field>
              <Field label="Nomor Surat Rujukan" className="sm:col-span-2 xl:col-span-1">
                <div className="flex gap-2">
                  <Input className="min-w-0 flex-1" value={referenceNumber} readOnly={form.gunakanRujukanOtomatis} onChange={(event) => setForm((current) => ({ ...current, gunakanRujukanOtomatis: false, nomorRujukan: event.target.value }))} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, gunakanRujukanOtomatis: !current.gunakanRujukanOtomatis, nomorRujukan: current.gunakanRujukanOtomatis ? referenceNumber : "" }))} className="shrink-0 rounded-lg border-indigo-200 bg-white px-2.5 text-indigo-700 hover:bg-indigo-100">
                    {form.gunakanRujukanOtomatis ? "Edit" : "Auto"}
                  </Button>
                </div>
                <span className="block text-[11px] text-slate-400">Otomatis mengikuti nomor Nota Permintaan atau dapat diedit manual.</span>
              </Field>
            </>}
            {isRepair ? <>
              {!isLanjutan && <>
                <Field label="Wilayah Operasional"><Input value={form.wilayah} readOnly disabled /></Field>
                <Field label="Plat Kendaraan"><Input list="nota-dinas-kendaraan-options" value={form.perbaikanPlatKendaraan} onChange={(event) => setField("perbaikanPlatKendaraan", event.target.value)} placeholder="Contoh: BK 9213 J" /></Field>
                <Field label="Jenis Kendaraan"><Input list="nota-dinas-jenis-kendaraan-options" value={form.perbaikanJenisKendaraan} onChange={(event) => setField("perbaikanJenisKendaraan", event.target.value)} placeholder="Contoh: Truck Sampah" /></Field>
                <Field label="Nama Supir"><Input list="nota-dinas-supir-options" value={form.perbaikanSupir} onChange={(event) => setField("perbaikanSupir", event.target.value)} /></Field>
                <Field label="Nomor HP Supir"><Input list="nota-dinas-no-hp-options" value={form.perbaikanNoHp} onChange={(event) => setField("perbaikanNoHp", event.target.value)} inputMode="tel" /></Field>
              </>}
              {isLanjutan && <>
                <Field label="Uraian / Kondisi Hasil Pemeriksaan" className="sm:col-span-2 xl:col-span-1"><Textarea rows={3} value={form.perbaikanUraianPemeriksaan} onChange={(event) => setField("perbaikanUraianPemeriksaan", event.target.value)} placeholder="Contoh: Truck Sampah BK 9213 J tersebut telah rusak" /></Field>
                <Field label="Lokasi Kejadian"><Input list="nota-dinas-lokasi-options" value={form.perbaikanLokasi} onChange={(event) => setField("perbaikanLokasi", event.target.value)} placeholder="Contoh: Jl. Asoka Pasar 1 Tanjung Sari" /></Field>
                <Field label="Kegiatan Saat Kejadian"><Input list="nota-dinas-kegiatan-options" value={form.perbaikanKegiatan} onChange={(event) => setField("perbaikanKegiatan", event.target.value)} placeholder="Contoh: pengerjaan pohon aren" /></Field>
              </>}
            </> : <>
              {!isLanjutan && <>
                <Field label="Wilayah"><Input value={form.wilayah} readOnly disabled /></Field>
                <Field label="Jumlah Kecamatan"><Input value={form.jumlahKecamatan} onChange={(event) => setField("jumlahKecamatan", event.target.value)} /></Field>
                <Field label="Nama Kecamatan" className="sm:col-span-2 xl:col-span-1"><Textarea rows={2} value={form.kecamatan} onChange={(event) => setField("kecamatan", event.target.value)} /></Field>
                <Field label="Dimohon Kepada" className="sm:col-span-2 xl:col-span-1">
                  <Select value={form.penerima} onValueChange={(value) => setField("penerima", value)}>
                    <SelectTrigger><SelectValue placeholder="Pilih sapaan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bapak">Bapak</SelectItem>
                      <SelectItem value="Ibu">Ibu</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>}
            </>}
          </div>

          {!isLanjutan && <div className="border-t border-slate-100 pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div><h4 className="font-black text-slate-900">{isRepair ? "Daftar Perbaikan" : "Daftar Barang"}</h4><p className="text-xs text-slate-500">Tambah baris sesuai kebutuhan.</p></div>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">{isRepair ? "Perbaikan" : "Barang"} {index + 1}</span>{form.items.length > 1 && <button type="button" onClick={() => removeItem(index)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus ${isRepair ? "perbaikan" : "barang"} ${index + 1}`}><Trash2 className="h-4 w-4" /></button>}</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {isRepair ? (
                      // Render input dinamis per kolom non-rowspan (perbaikan)
                      (sheetTemplate.kolomPerbaikan ?? DEFAULT_KOLOM_PERBAIKAN)
                        .filter((k) => !k.rowspan)
                        .map((k) => (
                          <Input
                            key={k.id}
                            list="nota-dinas-item-catalog"
                            aria-label={`${k.judul} ${index + 1}`}
                            placeholder={k.judul}
                            value={k.id === "perbaikan" ? (item.jenis || "") : (item[k.id] || "")}
                            onChange={(event) => updateItem(index, k.id === "perbaikan" ? "jenis" : k.id, event.target.value)}
                          />
                        ))
                    ) : (
                      // Render input dinamis per kolom (permintaan alat / bunga)
                      (sheetTemplate.kolomPermintaan ?? DEFAULT_KOLOM_PERMINTAAN)
                        .filter((k) => k.id !== "nomor") // kolom nomor auto-generated, skip input
                        .map((k) => (
                          <Input
                            key={k.id}
                            list={k.id === "jenis" ? "nota-dinas-item-catalog" : undefined}
                            aria-label={`${k.judul} ${index + 1}`}
                            placeholder={k.judul}
                            value={k.id === "jumlah"
                              ? (item.jumlah || "")
                              : k.id === "satuan"
                                ? (item.satuan || "")
                                : (item[k.id] as string || "")}
                            onChange={(event) => updateItem(index, k.id, event.target.value)}
                          />
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
            <datalist id="nota-dinas-item-catalog">{itemOptions.map((item) => <option key={item} value={item} />)}</datalist>
            <Button type="button" variant="outline" onClick={addItem} className="mt-3 h-10 w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"><Plus className="mr-2 h-4 w-4" /> Tambah {isRepair ? "Perbaikan" : "Barang"}</Button>
          </div>}

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

        <div className={viewMode === "view" ? "xl:col-span-full nota-dinas-preview-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-6" : "nota-dinas-preview-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:p-6"}>
          <NotaDinasSheet
            kepada={form.kepada}
            dari={form.dari}
            nomor={firstNumber}
            tanggal={formatLongDate(form.tanggal)}
            hal={displayHal}
            wilayah={form.wilayah}
            jumlahKecamatan={form.jumlahKecamatan}
            kecamatan={form.kecamatan}
            penerima={form.penerima}
            koordinatorRujukan={form.koordinatorRujukan}
            referenceNumber={referenceNumber}
            referenceDate={formatLongDate(form.tanggal)}
            referenceHal={form.halRujukan || form.hal}
            isRepair={isRepair}
            platKendaraan={form.perbaikanPlatKendaraan}
            jenisKendaraan={form.perbaikanJenisKendaraan}
            supir={form.perbaikanSupir}
            noHp={form.perbaikanNoHp}
            uraianPemeriksaan={form.perbaikanUraianPemeriksaan}
            lokasiKejadian={form.perbaikanLokasi}
            kegiatanKejadian={form.perbaikanKegiatan}
            penutup={form.penutup}
            jabatanPenandatangan={form.jabatanPenandatangan}
            kantorPenandatangan={form.kantorPenandatangan}
            namaPenandatangan={form.namaPenandatangan}
            nipPenandatangan={form.nipPenandatangan}
            items={form.items}
            isLanjutan={false}
            showTitle
            templateParagrafPembuka={sheetTemplate.paragrafPembuka}
            templateParagrafSubJudul={sheetTemplate.paragrafSubJudul}
            templateParagrafPenutup={sheetTemplate.paragrafPenutup}
            templateParagrafPerbaikanPermintaan={sheetTemplate.paragrafPerbaikanPermintaan}
            templateParagrafPerbaikanLanjutan={sheetTemplate.paragrafPerbaikanLanjutan}
            templateParagrafLanjutanAlat={sheetTemplate.paragrafLanjutanAlat}
            templateParagrafKalimatPenutup={sheetTemplate.paragrafKalimatPenutup}
            kolomPerbaikan={sheetTemplate.kolomPerbaikan}
            kolomPermintaan={sheetTemplate.kolomPermintaan}
          />
          <NotaDinasSheet
            kepada={form.lanjutanKepada}
            dari={form.lanjutanDari}
            nomor={lanjutanNumber}
            tanggal={formatLongDate(form.tanggalLanjutan || form.tanggal)}
            hal={displayHal}
            wilayah={form.wilayah}
            jumlahKecamatan={form.jumlahKecamatan}
            kecamatan={form.kecamatan}
            penerima={form.penerima}
            koordinatorRujukan={form.koordinatorRujukan}
            referenceNumber={referenceNumber}
            referenceDate={formatLongDate(form.tanggal)}
            referenceHal={displayHal}
            isRepair={isRepair}
            platKendaraan={form.perbaikanPlatKendaraan}
            jenisKendaraan={form.perbaikanJenisKendaraan}
            supir={form.perbaikanSupir}
            noHp={form.perbaikanNoHp}
            uraianPemeriksaan={form.perbaikanUraianPemeriksaan}
            lokasiKejadian={form.perbaikanLokasi}
            kegiatanKejadian={form.perbaikanKegiatan}
            penutup={form.lanjutanPenutup}
            jabatanPenandatangan={form.lanjutanJabatanPenandatangan}
            kantorPenandatangan={form.lanjutanKantorPenandatangan}
            namaPenandatangan={form.lanjutanNamaPenandatangan}
            nipPenandatangan={form.lanjutanNipPenandatangan}
            items={form.items}
            isLanjutan
            showTitle
            templateParagrafPembuka={sheetTemplate.paragrafPembuka}
            templateParagrafSubJudul={sheetTemplate.paragrafSubJudul}
            templateParagrafPenutup={sheetTemplate.paragrafPenutup}
            templateParagrafPerbaikanPermintaan={sheetTemplate.paragrafPerbaikanPermintaan}
            templateParagrafPerbaikanLanjutan={sheetTemplate.paragrafPerbaikanLanjutan}
            templateParagrafLanjutanAlat={sheetTemplate.paragrafLanjutanAlat}
            templateParagrafKalimatPenutup={sheetTemplate.paragrafKalimatPenutup}
            kolomPerbaikan={sheetTemplate.kolomPerbaikan}
            kolomPermintaan={sheetTemplate.kolomPermintaan}
          />
        </div>
      </div>

      <style>{`
        .nota-dinas-sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 20mm; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.16; }
        .nota-dinas-sheet + .nota-dinas-sheet { margin-top: 24px; }
        .nota-dinas-title { margin: 0 0 18px; text-align: center; font-size: 15pt; font-weight: 400; text-decoration: underline; }
        .nota-dinas-repair-sheet .nota-dinas-title { font-size: 14pt; font-weight: 700; }
        .nota-dinas-meta { display: grid; gap: 0; margin-bottom: 18px; line-height: 1.05; }
        .nota-dinas-meta > div { display: grid; grid-template-columns: 23mm 4mm minmax(0, 1fr); align-items: start; column-gap: 0; }
        .nota-dinas-meta b { font-weight: 400; }
        .nota-dinas-meta > div > span:last-child { font-weight: 400; }
        .nota-dinas-rule { height: 6px; margin: 0 -0.5mm 12px; border-top: 4px double #111; }
        .nota-dinas-body { margin: 0 0 14px; text-align: justify; }
        .nota-dinas-numbered-paragraph { display: grid; grid-template-columns: 7mm minmax(0, 1fr); column-gap: 0; margin: 0 0 23px; text-align: justify; }
        .nota-dinas-numbered-paragraph > p { margin: 0; }
        .nota-dinas-request { margin: 0 0 14px 10mm; }
        .nota-dinas-driver { margin: 0 0 18px; }
        .nota-dinas-driver-row { display: grid; grid-template-columns: 21mm 4mm minmax(0, 1fr); }
        .nota-dinas-driver-row b { font-weight: 400; }
        .nota-dinas-table { width: 100%; border-collapse: collapse; margin-bottom: 23px; table-layout: fixed; }
        .nota-dinas-table th, .nota-dinas-table td { border: 1px solid #111; padding: 4px 7px; vertical-align: middle; }
        .nota-dinas-table th { height: 29px; font-size: 14pt; font-weight: 400; text-align: center; }
        .nota-dinas-table td { height: 22px; font-size: 11pt; }
        .nota-dinas-table th:nth-child(1), .nota-dinas-table td:nth-child(1) { width: 10%; text-align: center; }
        .nota-dinas-table th:nth-child(2), .nota-dinas-table td:nth-child(2) { width: 39%; }
        .nota-dinas-table th:nth-child(3), .nota-dinas-table td:nth-child(3) { width: 28%; }
        .nota-dinas-table th:nth-child(4), .nota-dinas-table td:nth-child(4) { width: 23%; }
        .nota-dinas-repair-paragraph { margin-bottom: 23px; text-indent: 12.7mm; }
        .nota-dinas-repair-sheet .nota-dinas-driver-row { grid-template-columns: 27.5mm 4mm minmax(0, 1fr); }
        .nota-dinas-repair-table { font-family: Calibri, Arial, sans-serif; }
        .nota-dinas-repair-table th:nth-child(1), .nota-dinas-repair-table td:nth-child(1) { width: 16.2%; text-align: center; }
        .nota-dinas-repair-table th:nth-child(2), .nota-dinas-repair-table td:nth-child(2) { width: 14.5%; text-align: center; }
        .nota-dinas-repair-table th:nth-child(3) { width: 69.3%; text-align: center; }
        .nota-dinas-repair-table td:nth-child(3) { width: 69.3%; text-align: left; }
        .nota-dinas-repair-table td.nota-dinas-repair-item { text-align: left; }
        .nota-dinas-repair-table th, .nota-dinas-repair-table td { box-sizing: border-box; font-size: 11pt; overflow-wrap: anywhere; word-break: normal; }
        .nota-dinas-repair-table th { font-weight: 700; }
        .nota-dinas-repair-table tr { break-inside: avoid; page-break-inside: avoid; }
        .nota-dinas-repair-table td { height: auto; min-height: 22px; line-height: 1.15; white-space: normal; }
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
