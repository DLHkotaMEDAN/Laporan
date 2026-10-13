import type { NotaDinasCategory, NotaDinasRecord } from "@/types/notaDinas";

export const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export const REGION_CODES = [
  { code: "MK", label: "Wilayah 4 Medan Kota" },
  { code: "MU", label: "Wilayah 1 Medan Utara" },
  { code: "MB", label: "Wilayah 2 Medan Barat" },
  { code: "MT", label: "Wilayah 3 Medan Timur" },
  { code: "MS", label: "Wilayah 5 Medan Selatan" },
] as const;

export const NOTA_CODE_BY_REGION_CODE: Record<string, string> = {
  pusat: "PST",
  "wilayah-1": "MU",
  "wilayah-2": "MB",
  "wilayah-3": "MT",
  "wilayah-4": "MK",
  "wilayah-5": "MS",
};

export const LETTER_TYPES = [
  { code: "SPB", label: "Surat Permintaan Barang" },
  { code: "SPm-PM", label: "Nota Perbaikan" },
] as const;

export const DOCUMENT_TYPES = [
  { value: "permintaan" as const, label: "Nota Dinas Permintaan (SPB / SPm-PM)" },
  { value: "lanjutan" as const, label: "Nota Dinas Lanjutan / Tindak Lanjut" },
];

export const NOTA_DINAS_CATEGORIES = [
  { value: "permintaan_alat" as const, label: "Permintaan Alat" },
  { value: "permintaan_bunga_bahan" as const, label: "Permintaan Bunga dan Bahan" },
  { value: "perbaikan" as const, label: "Perbaikan" },
] as const;

export const HAL_OPTIONS = ["Permintaan Alat Kerja", "Permintaan Perbaikan"] as const;

export const formatRecordDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export const getNotaDinasCategory = (record: NotaDinasRecord): NotaDinasCategory =>
  record.form.jenisDokumen === "perbaikan" ? "perbaikan" : record.form.jenisNotaDinas || "permintaan_alat";

export const getLetterTypeForCategory = (category: NotaDinasCategory) =>
  category === "perbaikan" ? "SPm-PM" : "SPB";

export const formatLongDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const getHalWithRegion = (hal: string, wilayah: string) => {
  const trimmedHal = hal.trim();
  const trimmedRegion = wilayah.trim();
  if (!trimmedHal || !trimmedRegion) return trimmedHal || trimmedRegion;

  const regionIndex = REGION_CODES.findIndex((region) => trimmedHal.toLocaleLowerCase().includes(region.label.toLocaleLowerCase()));
  const baseHal = regionIndex >= 0
    ? trimmedHal.slice(0, trimmedHal.toLocaleLowerCase().indexOf(REGION_CODES[regionIndex].label.toLocaleLowerCase())).replace(/\s+di\s*$/i, "").trim()
    : trimmedHal;
  return [baseHal, trimmedRegion].filter(Boolean).join(" ");
};

export const getRenderedHal = (hal: string, wilayah: string) => hal.trim() ? getHalWithRegion(hal, wilayah) : "";

export const getLetterMonth = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : ROMAN_MONTHS[date.getMonth()];
};

export const getLetterYear = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "......" : String(date.getFullYear());
};

export const getUniqueOptions = (values: Array<string | undefined>) => Array.from(new Set(
  values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
)).sort((left, right) => left.localeCompare(right, "id-ID"));
