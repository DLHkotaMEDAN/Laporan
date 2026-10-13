import type { Report } from "@/types/report";

export const defaultCategories = ["semua", "Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"];

export const years = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index);

export const validMainTabs = ["reports", "workplans", "overtime", "fuel_reports", "fuel_reports_pusat", "laporan_bbm", "spj_oli", "nota_dinas"] as const;
export type MainTab = typeof validMainTabs[number];

export type RecordCounts = Record<MainTab, number | null>;

export const emptyRecordCounts: RecordCounts = {
  reports: null,
  workplans: null,
  overtime: null,
  fuel_reports: null,
  fuel_reports_pusat: null,
  laporan_bbm: null,
  spj_oli: null,
  nota_dinas: null,
};

export const systemTabBaseClass =
  "flex h-auto min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs font-semibold leading-tight whitespace-normal text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-sm focus-visible:ring-2 sm:text-sm lg:w-auto lg:px-3 xl:px-4 data-[state=active]:hover:text-white [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0";

export const systemTabToneClass: Record<MainTab, string> = {
  reports:
    "hover:border-blue-200 hover:text-blue-700 focus-visible:ring-blue-400 data-[state=active]:border-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
  workplans:
    "hover:border-emerald-200 hover:text-emerald-700 focus-visible:ring-emerald-400 data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
  overtime:
    "hover:border-amber-200 hover:text-amber-700 focus-visible:ring-amber-400 data-[state=active]:border-amber-600 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
  fuel_reports:
    "hover:border-orange-200 hover:text-orange-700 focus-visible:ring-orange-400 data-[state=active]:border-orange-600 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
  fuel_reports_pusat:
    "hover:border-cyan-200 hover:text-cyan-700 focus-visible:ring-cyan-400 data-[state=active]:border-cyan-600 data-[state=active]:bg-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-sm",
  laporan_bbm:
    "hover:border-amber-200 hover:text-amber-800 focus-visible:ring-amber-400 data-[state=active]:border-amber-700 data-[state=active]:bg-amber-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
  spj_oli:
    "hover:border-emerald-200 hover:text-emerald-800 focus-visible:ring-emerald-400 data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
  nota_dinas:
    "hover:border-indigo-200 hover:text-indigo-800 focus-visible:ring-indigo-400 data-[state=active]:border-indigo-700 data-[state=active]:bg-indigo-700 data-[state=active]:text-white data-[state=active]:shadow-sm",
};

export type IndexViewState = {
  activeTab?: MainTab;
  searchQuery?: string;
  selectedRegion?: string;
  selectedDate?: string;
  selectedMonth?: string;
  selectedYear?: string;
  selectedCategory?: string;
  scrollY?: number;
};

const INDEX_VIEW_STATE_KEY = "laporan-kerja:index-view-state";

export const isMainTab = (value: string | null | undefined): value is MainTab =>
  !!value && validMainTabs.includes(value as MainTab);

export const readIndexViewState = (): IndexViewState => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(INDEX_VIEW_STATE_KEY) || "{}");
  } catch {
    return {};
  }
};

export const writeIndexViewState = (state: IndexViewState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_VIEW_STATE_KEY, JSON.stringify(state));
};

export const formatLocation = (location: Report["location"] | undefined): string => {
  if (!location) return "Lokasi tidak ditentukan";
  const villages = Array.isArray(location.village) ? location.village.join(", ") : location.village;
  return [location.street, villages, location.subDistrict].filter(Boolean).join(", ") || "Lokasi tidak ditentukan";
};
