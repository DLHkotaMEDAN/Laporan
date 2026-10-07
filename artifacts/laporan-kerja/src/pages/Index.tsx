import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Search, Cloud, Printer,
  LogOut, LogIn, FilterX, Database, ChevronDown,
  Table, ClipboardList, CalendarDays, Fuel, Trash2, Loader2, UserCircle, Bell,
  ArrowUpDown, ChevronUp, Edit, Eye, EyeOff, Leaf, MapPin, ShieldCheck,
  Activity, Clock3, Plus, KeyRound
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { showSuccess, showError } from '@/utils/toast';
import { reportService, ReportFilters } from '@/services/reportService';
import { workPlanService, WorkPlanFilters } from '@/services/workPlanService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrashDialog from '@/components/TrashDialog';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import FuelReportTab from '@/components/FuelReportTab';
import SpjOli from '@/pages/SpjOli';
import OvertimeRecap from '@/pages/OvertimeRecap';
import DashboardStats from '@/components/dashboard/DashboardStats';
import { cn } from "@/lib/utils";
import { getUnitByCategory } from '@/utils/report-helpers';
import { canPrintReportRecap } from '@/utils/recap-print-permissions';
import { canManageReportEntries, canManageWorkPlans as hasWorkPlanManagement, getRoleLabel, isAdminBbmPusatAccess, isGlobalWorkPlanAdmin, isLaporanBbmAdmin, isNotaDinasAdmin, roleRequiresRegion, isSuperAdminAccess, isPimpinanAccess } from '@/constants/access-control';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PublicLanding from "./PublicLanding";
import NotaDinasTab from '@/components/NotaDinasTab';
import TotalRecordLabel from '@/components/TotalRecordLabel';

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const defaultCategories = ["semua", "Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"];

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');
const DLH_HERO_IMAGE_URL = "https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg";

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
type SortDirection = "asc" | "desc";
type ReportSortKey = "date" | "category" | "description" | "location" | "volume" | "remarks";
type WorkPlanSortKey = "date" | "category" | "description" | "location" | "status";
const validMainTabs = ['reports', 'workplans', 'overtime', 'fuel_reports', 'fuel_reports_pusat', 'laporan_bbm', 'spj_oli', 'nota_dinas'] as const;
type MainTab = typeof validMainTabs[number];

type RecordCounts = Record<MainTab, number | null>;

const emptyRecordCounts: RecordCounts = {
  reports: null,
  workplans: null,
  overtime: null,
  fuel_reports: null,
  fuel_reports_pusat: null,
  laporan_bbm: null,
  spj_oli: null,
  nota_dinas: null,
};

const systemTabBaseClass =
  "flex h-auto min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs font-semibold leading-tight whitespace-normal text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-sm focus-visible:ring-2 sm:text-sm lg:w-auto lg:px-3 xl:px-4 data-[state=active]:hover:text-white [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0";

const systemTabToneClass: Record<MainTab, string> = {
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

type IndexViewState = {
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

const isMainTab = (value: string | null | undefined): value is MainTab => {
  return !!value && validMainTabs.includes(value as MainTab);
};

const readIndexViewState = (): IndexViewState => {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.sessionStorage.getItem(INDEX_VIEW_STATE_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeIndexViewState = (state: IndexViewState) => {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(INDEX_VIEW_STATE_KEY, JSON.stringify(state));
};

const getWorkPlanDescriptions = (plan: WorkPlan): string[] => {
  if (!Array.isArray(plan.items)) return [];

  return plan.items.map(item => item.description?.trim() || "Tanpa uraian");
};

const formatLocation = (location: Report["location"] | undefined): string => {
  if (!location) return "Lokasi tidak ditentukan";
  const villages = Array.isArray(location.village) ? location.village.join(", ") : location.village;
  return [location.street, villages, location.subDistrict].filter(Boolean).join(", ") || "Lokasi tidak ditentukan";
};

const PointList = ({ values, fallback }: { values: string[]; fallback: string }) => {
  const displayValues = values.length > 0 ? values : [fallback];

  if (displayValues.length === 1) {
    return <span className="whitespace-normal break-words">{displayValues[0]}</span>;
  }

  return (
    <div className="space-y-2">
      {displayValues.map((value, index) => (
        <div key={index} className={cn("whitespace-normal break-words", index > 0 && "border-t border-slate-200 pt-2")}>
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Titik {index + 1}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
};

const TabPageHeader = ({
  title,
  description,
  actionLabel,
  onAction,
  showAction = true,
  actionIcon: ActionIcon = Plus,
  actionClassName = "bg-emerald-600 hover:bg-emerald-700",
  iconClassName = "bg-emerald-50 text-emerald-600",
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  showAction?: boolean;
  actionIcon?: React.ElementType;
  actionClassName?: string;
  iconClassName?: string;
}) => (
  <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex min-w-0 items-start gap-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClassName)}>
        <ActionIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {showAction && (
      <Button onClick={onAction} className={cn("h-10 w-full rounded-xl px-4 font-bold shadow-sm sm:w-auto", actionClassName)}>
        <ActionIcon className="mr-2 h-4 w-4 shrink-0" />
        {actionLabel}
      </Button>
    )}
  </section>
);

const getDatabaseRecordCount = async (
  table: string,
  options: { regionId?: string | null; reportType?: string; softDeleted?: boolean } = {},
) => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (options.regionId) query = query.eq('region_id', options.regionId);
  if (options.reportType) query = query.eq('report_type', options.reportType);
  // Default: filter hanya data aktif (non-deleted).
  // Hanya tampilkan data terhapus jika softDeleted === true secara eksplisit.
  if (options.softDeleted !== true) query = query.is('deleted_at', null);

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const savedViewStateRef = useRef<IndexViewState>(readIndexViewState());
  const hasRestoredScrollRef = useRef(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  // Ref untuk membaca nilai terbaru di dalam async functions tanpa stale closure.
  const reportsRef = useRef<Report[]>([]);
  const workPlansRef = useRef<WorkPlan[]>([]);
  const [recordCounts, setRecordCounts] = useState<RecordCounts>(emptyRecordCounts);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'danger' | 'warning' | 'logout';
    confirmLabel: string;
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'danger',
    confirmLabel: 'Ya, Lanjutkan',
    loading: false,
    onConfirm: async () => {},
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(savedViewStateRef.current.searchQuery || "");
  const [activeTab, setActiveTab] = useState<MainTab>(savedViewStateRef.current.activeTab || "reports");
  const [selectedRegion, setSelectedRegion] = useState(savedViewStateRef.current.selectedRegion || "semua");
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDailyRecapDateOpen, setIsDailyRecapDateOpen] = useState(false);
  const [dailyRecapDate, setDailyRecapDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedDate, setSelectedDate] = useState(savedViewStateRef.current.selectedDate || "");
  const [selectedMonth, setSelectedMonth] = useState(savedViewStateRef.current.selectedMonth || "semua");
  const [selectedYear, setSelectedYear] = useState(savedViewStateRef.current.selectedYear || "semua");
  const [selectedCategory, setSelectedCategory] = useState(savedViewStateRef.current.selectedCategory || "semua");
  const [reportSortKey, setReportSortKey] = useState<ReportSortKey>("date");
  const [reportSortDirection, setReportSortDirection] = useState<SortDirection>("desc");
  const [workPlanSortKey, setWorkPlanSortKey] = useState<WorkPlanSortKey>("date");
  const [workPlanSortDirection, setWorkPlanSortDirection] = useState<SortDirection>("desc");

  const isLoggedIn = !!session;
  const isAdmin = isSuperAdminAccess(profile?.role, session?.user?.email);
  const canFilterWorkPlanRegions = isGlobalWorkPlanAdmin(profile?.role, session?.user?.email);
  const isAdminBbm = profile?.role === 'admin_bbm' || profile?.role === 'admin_rencana_kerja_bbm' || profile?.role === 'admin_wilayah_bbm';
  const isAdminBbmPusat = isAdminBbmPusatAccess(profile?.role);
  const isAdminLaporanBbm = isLaporanBbmAdmin(profile?.role);
  const isAdminSpj = profile?.role === 'admin_spj_bbm';
  const isAdminSpjOli = profile?.role === 'admin_spj_oli';
  const isNotaDinasOnly = isNotaDinasAdmin(profile?.role);
  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);
  // Admin Rencana Kerja: admin_rencana_kerja (semua wilayah), admin_rencana_kerja_bbm,
  // dan admin_wilayah_bbm (combined workspace dengan BBM).
  const isAdminRencanaKerja = profile?.role === 'admin_rencana_kerja'
    || profile?.role === 'admin_rencana_kerja_bbm'
    || profile?.role === 'admin_wilayah_bbm';
  // Admin Wilayah: punya akses laporan harian + rencana kerja dalam wilayah sendiri.
  const isAdminWilayah = profile?.role === 'admin_wilayah' || profile?.role === 'admin_wilayah_bbm';
  const accountRegionId = !isAdmin && (roleRequiresRegion(profile?.role) || isAdminSpjOli) ? profile?.region_id || "__unassigned__" : null;
  // isCombinedWorkspace: role yang punya akses BBM sekaligus laporan/rencana kerja.
  const isCombinedWorkspace = isAdminBbm && (isAdminRencanaKerja || isAdminWilayah);
  const isFuelSpecialist = (isAdminBbm || isAdminBbmPusat || isAdminLaporanBbm || isAdminSpj || isAdminSpjOli) && !isCombinedWorkspace;
  // Tab Laporan Kerja hanya tampil untuk role yang memang punya akses laporan harian:
  // - Admin Wilayah (admin_wilayah, admin_wilayah_bbm)
  // - Laporan, User, Super Admin, Pimpinan
  // - admin_rencana_kerja_bbm TIDAK tampil tab ini (hanya RK + BBM, bukan laporan harian)
  const canViewReportsTab = !isNotaDinasOnly && !isFuelSpecialist && (!isAdminRencanaKerja || isAdminWilayah);
  const isOvertimeOnly = profile?.role === 'admin_rekap_lembur';
  const canViewOvertime = isAdmin || isOvertimeOnly;
  const isLaporanOnly = profile?.role === 'laporan';
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && !isPimpinan;
  const isAccountActive = profile?.is_active !== false;
  const canManageReports = isLoggedIn && isAccountActive && !isPimpinan && canManageReportEntries(profile?.role, session?.user?.email);
  const canManageWorkPlans = isLoggedIn && isAccountActive && !isPimpinan && hasWorkPlanManagement(profile?.role, session?.user?.email);
  const canPrintDailyRecap = canPrintReportRecap(profile?.role, 'daily', session?.user?.email);
  const canPrintWeeklyRecap = canPrintReportRecap(profile?.role, 'weekly', session?.user?.email);
  const canPrintMonthlyRecap = canPrintReportRecap(profile?.role, 'monthly', session?.user?.email);
  const canPrintAnyReportRecap = canPrintDailyRecap || canPrintWeeklyRecap || canPrintMonthlyRecap;
  const showExecutiveHero = isAdmin;
  const { regions, teams: regionTeams } = useRegionFilterOptions(canFilterWorkPlanRegions, selectedRegion);
  const categories = useMemo(
    () => canFilterWorkPlanRegions ? ["semua", ...Array.from(new Set(regionTeams.map(team => team.name)))] : defaultCategories,
    [canFilterWorkPlanRegions, regionTeams],
  );
  const loginScopeLabel = isPimpinan
    ? "Pimpinan"
    : isLaporanOnly
      ? "Petugas Laporan"
      : isUserRestricted
        ? (profile?.category || "Petugas Lapangan")
        : "Sistem Laporan";

  // Sync ref agar loadRecordCounts selalu membaca nilai terbaru.
  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { workPlansRef.current = workPlans; }, [workPlans]);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    void loadRecordCounts();
    // Admin SPJ Oli hanya memerlukan data SPJ Oli. Jangan memuat laporan
    // harian/rencana kerja yang memang tidak diberi akses oleh RLS.
    if (isAdminSpj || isAdminSpjOli || isAdminLaporanBbm || isNotaDinasOnly) {
      setLoading(false);
      return;
    }
    loadData();
    if (accountRegionId && selectedRegion !== accountRegionId) {
      setSelectedRegion(accountRegionId);
    }
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [profile, isLoggedIn, isAdminBbm, isAdminBbmPusat, isAdminLaporanBbm, isAdminSpj, isAdminSpjOli, authLoading, navigate, accountRegionId]);

  // Re-fetch saat filter utama (tanggal/bulan/tahun/kategori) berubah.
  // Nilai filter di-pass eksplisit ke loadData agar tidak terjadi stale closure
  // saat React 18 memproses state update secara bersamaan.
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    if (isAdminSpj || isAdminSpjOli || isAdminLaporanBbm || isNotaDinasOnly) return;
    loadData(selectedDate, selectedMonth, selectedYear, selectedCategory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedMonth, selectedYear, selectedCategory]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const savedTab = savedViewStateRef.current.activeTab;
    const canViewLaporanBbm = isAdmin || isAdminLaporanBbm;

    if (isNotaDinasOnly) {
      setActiveTab("nota_dinas");
    } else if (isOvertimeOnly) {
      setActiveTab("overtime");
    } else if (isMainTab(requestedTab)
      && (requestedTab !== "nota_dinas" || isAdmin || isNotaDinasOnly)
      && (requestedTab !== "laporan_bbm" || canViewLaporanBbm)
      && (requestedTab !== "fuel_reports_pusat" || isAdmin || isAdminBbmPusat)) {
      setActiveTab(requestedTab);
    } else if (isAdminBbmPusat) {
      setActiveTab("fuel_reports_pusat");
    } else if (isAdminLaporanBbm) {
      setActiveTab("laporan_bbm");
    } else if (isAdminBbm && !isCombinedWorkspace) {
      setActiveTab("fuel_reports");
    } else if (isAdminSpj || isAdminSpjOli) {
      setActiveTab("spj_oli");
    } else if (savedTab) {
      const safeSavedTab = (savedTab === "nota_dinas" && !isAdmin && !isNotaDinasOnly)
        || (savedTab === "laporan_bbm" && !canViewLaporanBbm)
        || (savedTab === "fuel_reports_pusat" && !isAdmin && !isAdminBbmPusat)
        ? isAdminBbm ? "fuel_reports" : "reports"
        : savedTab;

      // Untuk admin_rencana_kerja_bbm: tab "reports" tidak tersedia,
      // koreksi ke "workplans" sebagai tab utama.
      const correctedTab = (safeSavedTab === "reports" && isCombinedWorkspace && !isAdminWilayah)
        ? "workplans"
        : (isAdminRencanaKerja && !isCombinedWorkspace && safeSavedTab === "reports")
          ? "workplans"
          : safeSavedTab;

      setActiveTab(correctedTab);
    } else {
      // Pertama kali login (tidak ada savedTab):
      // - admin_rencana_kerja_bbm → workplans (tab utamanya)
      // - admin_wilayah_bbm → reports (punya akses laporan harian)
      // - admin_rencana_kerja murni → workplans
      // - semua lainnya → reports
      setActiveTab(isCombinedWorkspace ? (isAdminWilayah ? "reports" : "workplans") : isAdminRencanaKerja ? "workplans" : "reports");
    }
  }, [isAdmin, isAdminBbm, isAdminBbmPusat, isAdminLaporanBbm, isAdminSpj, isAdminSpjOli, isNotaDinasOnly, isAdminRencanaKerja, isCombinedWorkspace, isOvertimeOnly, searchParams]);

  useEffect(() => {
    const state: IndexViewState = {
      activeTab,
      searchQuery,
      selectedRegion,
      selectedDate,
      selectedMonth,
      selectedYear,
      selectedCategory,
      scrollY: window.scrollY,
    };

    writeIndexViewState(state);
  }, [activeTab, searchQuery, selectedRegion, selectedDate, selectedMonth, selectedYear, selectedCategory]);

  useEffect(() => {
    const saveScrollPosition = () => {
      writeIndexViewState({
        ...readIndexViewState(),
        scrollY: window.scrollY,
      });
    };

    window.addEventListener("pagehide", saveScrollPosition);
    window.addEventListener("blur", saveScrollPosition);
    document.addEventListener("visibilitychange", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("pagehide", saveScrollPosition);
      window.removeEventListener("blur", saveScrollPosition);
      document.removeEventListener("visibilitychange", saveScrollPosition);
    };
  }, []);

  useEffect(() => {
    const savedScrollY = savedViewStateRef.current.scrollY;

    if (hasRestoredScrollRef.current || loading || typeof savedScrollY !== "number") return;

    hasRestoredScrollRef.current = true;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY });
    });
  }, [loading]);

  useEffect(() => {
    if (selectedCategory !== 'semua' && !categories.includes(selectedCategory)) {
      setSelectedCategory(isUserRestricted ? (profile?.category || 'semua') : 'semua');
    }
  }, [categories, isUserRestricted, profile?.category, selectedCategory]);

  const buildDateFilter = (
    date: string,
    month: string,
    year: string,
  ): ReportFilters['dateFilter'] => {
    if (date) return { type: 'date', value: date };
    if (month !== 'semua' && year !== 'semua') return { type: 'month', month, year };
    if (year !== 'semua') return { type: 'year', year };
    return null;
  };

  const loadData = async (
    date = selectedDate,
    month = selectedMonth,
    year = selectedYear,
    category = selectedCategory,
  ) => {
    try {
      setLoading(true);

      // Kategori untuk user yang dibatasi selalu dari profile, bukan dari filter UI
      const effectiveCategory = isUserRestricted
        ? (profile?.category ?? null)
        : (category !== 'semua' ? category : null);

      // Region: user dengan region_id tetap di-scope ke region mereka,
      // admin bisa memilih region via selectedRegion (filter UI)
      const effectiveRegionId = accountRegionId
        ?? (isAdmin && selectedRegion !== 'semua' ? selectedRegion : null);

      const dateFilter = buildDateFilter(date, month, year);

      const reportFilters: ReportFilters = {
        dateFilter,
        category: effectiveCategory,
        regionId: effectiveRegionId,
      };
      const workPlanFilters: WorkPlanFilters = {
        dateFilter,
        category: effectiveCategory,
        regionId: effectiveRegionId,
      };

      const [reportsData, workPlansData] = await Promise.all([
        reportService.getFilteredReports(reportFilters),
        workPlanService.getFilteredWorkPlans(workPlanFilters),
      ]);

      setReports(reportsData);
      setWorkPlans(workPlansData);
      setRecordCounts(current => ({
        ...current,
        reports: reportsData.length,
        workplans: workPlansData.length,
      }));

      if (accountRegionId && selectedRegion !== accountRegionId) {
        setSelectedRegion(accountRegionId);
      } else if (!isAdmin) {
        setSelectedRegion('semua');
      }
    } catch (error) {
      console.error(error);
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      open: true,
      title: 'Keluar dari Sistem',
      description: 'Anda akan keluar dari sistem. Pastikan semua data sudah tersimpan sebelum keluar.',
      variant: 'logout',
      confirmLabel: 'Ya, Keluar',
      loading: false,
      onConfirm: async () => {
        try {
          await signOut();
          showSuccess("Berhasil keluar");
        } catch (error) {
          showError("Gagal keluar");
        }
      },
    });
  };

  const handleDeleteReport = (e: React.MouseEvent, report: Report) => {
    e.stopPropagation();
    if (!canManageReports) return;
    setConfirmDialog({
      open: true,
      title: 'Pindahkan ke Tempat Sampah',
      description: `Laporan "${report.description}" akan dipindahkan ke tempat sampah. Anda dapat memulihkannya nanti.`,
      variant: 'warning',
      confirmLabel: 'Pindahkan',
      loading: false,
      onConfirm: async () => {
        try {
          await reportService.deleteReport(report.id);
          setReports(reports.filter(r => r.id !== report.id));
          showSuccess("Laporan dipindahkan ke tempat sampah");
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          showError("Gagal menghapus");
        }
      },
    });
  };

  const handleToggleWorkPlanVisibility = async (e: React.MouseEvent, plan: WorkPlan) => {
    e.stopPropagation();
    if (!canManageWorkPlans) return;
    
    const newVisibility = plan.is_visible === false ? true : false;
    try {
      await workPlanService.updateWorkPlan(plan.id, { is_visible: newVisibility });
      setWorkPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_visible: newVisibility } : p));
      showSuccess(newVisibility ? "Rencana akan muncul di rekap" : "Rencana disembunyikan dari rekap");
    } catch (error) {
      showError("Gagal mengubah status visibilitas");
    }
  };

  const handleDeleteWorkPlan = (e: React.MouseEvent, plan: WorkPlan) => {
    e.stopPropagation();
    if (!canManageWorkPlans) return;
    setConfirmDialog({
      open: true,
      title: 'Pindahkan ke Tempat Sampah',
      description: `Rencana kerja "${plan.items[0]?.description}" akan dipindahkan ke tempat sampah. Anda dapat memulihkannya nanti.`,
      variant: 'warning',
      confirmLabel: 'Pindahkan',
      loading: false,
      onConfirm: async () => {
        try {
          await workPlanService.deleteWorkPlan(plan.id);
          setWorkPlans(workPlans.filter(p => p.id !== plan.id));
          showSuccess("Rencana kerja dipindahkan ke tempat sampah");
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          showError("Gagal menghapus data");
        }
      },
    });
  };

  const resetFilters = () => {
    setSelectedDate("");
    setSelectedMonth("semua");
    setSelectedYear("semua");
    setSelectedCategory(isUserRestricted ? (profile?.category || "semua") : "semua");
    setSelectedRegion("semua");
    setSearchQuery("");
  };

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const search = searchQuery.toLowerCase();

      // Search tetap client-side (multi-kolom, termasuk tasks JSON)
      const searchableTasks = Array.isArray(report.tasks) ? report.tasks : [];
      const matchSearch = !search || [
        report.description,
        formatLocation(report.location),
        ...searchableTasks.flatMap(task => [task.description, formatLocation(task.location)]),
      ].some(value => value?.toLowerCase().includes(search));

      // Region filter hanya berlaku untuk admin yang bisa switch region di UI.
      // User ber-region sudah di-filter server-side via accountRegionId.
      const matchRegion = !isAdmin || selectedRegion === 'semua' || report.region_id === selectedRegion;

      return matchSearch && matchRegion;
    });
  }, [reports, searchQuery, isAdmin, selectedRegion]);

  const filteredWorkPlans = useMemo(() => {
    return workPlans.filter(plan => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch = !search || (Array.isArray(plan.items) && plan.items.some(item =>
        [item.description, formatLocation(item.location)].some(value => value?.toLowerCase().includes(search))
      ));

      const matchRegion = !canFilterWorkPlanRegions || selectedRegion === 'semua' || plan.region_id === selectedRegion;

      return matchSearch && matchRegion;
    });
  }, [workPlans, searchQuery, canFilterWorkPlanRegions, selectedRegion]);

  const formatReportLocation = (report: Report) => {
    return formatLocation(report.location);
  };

  const loadRecordCounts = async () => {
    if (!profile || !isLoggedIn) return;

    const jobs: Partial<Record<MainTab, Promise<number>>> = {};
    const canShowReports = canViewReportsTab && !isOvertimeOnly;
    const canShowWorkPlans = !isNotaDinasOnly && !isLaporanOnly && !isFuelSpecialist && !isOvertimeOnly;

    if (canShowReports) {
      // Gunakan ref (bukan closure) agar selalu membaca nilai terbaru dari state.
      jobs.reports = reportsRef.current.length > 0
        ? Promise.resolve(reportsRef.current.length)
        : getDatabaseRecordCount('reports', { regionId: accountRegionId ?? undefined, softDeleted: false });
    }
    if (canShowWorkPlans) {
      jobs.workplans = workPlansRef.current.length > 0
        ? Promise.resolve(workPlansRef.current.length)
        : getDatabaseRecordCount('work_plans', { regionId: accountRegionId ?? undefined, softDeleted: false });
    }
    if (canViewOvertime) {
      jobs.overtime = getDatabaseRecordCount('overtime_records', { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isAdminBbm) {
      jobs.fuel_reports = getDatabaseRecordCount('fuel_reports', { regionId: accountRegionId, reportType: 'admin_bbm', softDeleted: false });
    }
    if (isAdmin || isAdminBbmPusat) {
      jobs.fuel_reports_pusat = getDatabaseRecordCount('fuel_reports_pusat', { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isAdminLaporanBbm) {
      jobs.laporan_bbm = getDatabaseRecordCount('laporan_bbm_reports', { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isPimpinan || isAdminSpj || isAdminSpjOli) {
      jobs.spj_oli = getDatabaseRecordCount('spj_oli_records', { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isNotaDinasOnly) {
      jobs.nota_dinas = getDatabaseRecordCount('nota_dinas_records', { regionId: accountRegionId, softDeleted: false });
    }

    const entries = await Promise.all(Object.entries(jobs).map(async ([tab, job]) => {
      try {
        return [tab, await job] as const;
      } catch (error) {
        console.warn(`Gagal menghitung record tab ${tab}:`, error);
        return [tab, null] as const;
      }
    }));

    setRecordCounts(current => ({
      ...current,
      ...Object.fromEntries(entries),
    } as RecordCounts));
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    setSelectedCategory('semua');
  };

  const handleTabChange = (tab: string) => {
    if (!isMainTab(tab)) return;

    writeIndexViewState({
      ...readIndexViewState(),
      activeTab: tab,
      scrollY: window.scrollY,
    });
    setActiveTab(tab);
  };

  const formatWorkPlanLocation = (plan: WorkPlan) => {
    return Array.isArray(plan.items) ? plan.items.map(item => formatLocation(item.location)).join(" | ") : "-";
  };

  const getReportSortValue = (report: Report, key: ReportSortKey) => {
    if (key === "date") return new Date(report.date).getTime();
    if (key === "category") return report.category;
    if (key === "description") return (report.tasks?.map(task => task.description).join(" | ") || report.description);
    if (key === "location") return (report.tasks?.map(task => formatLocation(task.location)).join(" | ") || formatReportLocation(report));
    if (key === "volume") return report.volume;
    return report.remarks || report.pimpinan_note || "";
  };

  const getWorkPlanSortValue = (plan: WorkPlan, key: WorkPlanSortKey) => {
    if (key === "date") return new Date(plan.date).getTime();
    if (key === "category") return plan.category;
    if (key === "description") return getWorkPlanDescriptions(plan).join(" | ");
    if (key === "location") return formatWorkPlanLocation(plan);
    return plan.is_visible === false ? 0 : 1;
  };

  const compareSortValues = (a: string | number, b: string | number) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "id-ID", { numeric: true, sensitivity: "base" });
  };

  const sortedReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => {
      const result = compareSortValues(getReportSortValue(a, reportSortKey), getReportSortValue(b, reportSortKey));
      return reportSortDirection === "asc" ? result : -result;
    });
  }, [filteredReports, reportSortKey, reportSortDirection]);

  const sortedWorkPlans = useMemo(() => {
    return [...filteredWorkPlans].sort((a, b) => {
      const result = compareSortValues(getWorkPlanSortValue(a, workPlanSortKey), getWorkPlanSortValue(b, workPlanSortKey));
      return workPlanSortDirection === "asc" ? result : -result;
    });
  }, [filteredWorkPlans, workPlanSortKey, workPlanSortDirection]);

  const toggleReportSort = (key: ReportSortKey) => {
    if (reportSortKey === key) {
      setReportSortDirection(prev => prev === "asc" ? "desc" : "asc");
      return;
    }
    setReportSortKey(key);
    setReportSortDirection("asc");
  };

  const toggleWorkPlanSort = (key: WorkPlanSortKey) => {
    if (workPlanSortKey === key) {
      setWorkPlanSortDirection(prev => prev === "asc" ? "desc" : "asc");
      return;
    }
    setWorkPlanSortKey(key);
    setWorkPlanSortDirection("asc");
  };

  const SortIcon = ({ active, direction }: { active: boolean; direction: SortDirection }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      totalReports: filteredReports.length,
      totalWorkPlans: filteredWorkPlans.length,
      reportsToday: filteredReports.filter(r => r.date === today).length,
      plansToday: filteredWorkPlans.filter(p => p.date === today).length
    };
  }, [filteredReports, filteredWorkPlans]);

  if (!authLoading && !isLoggedIn) {
    return <PublicLanding />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Memverifikasi Hak Akses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7f2]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl print:hidden">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200 sm:gap-2">
              <img src={LOGO_MEDAN_URL} alt="Logo Kota Medan" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
              <img src={LOGO_DLH_URL} alt="Logo DLH Kota Medan" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-xs font-black leading-tight tracking-tight text-slate-900 sm:text-sm md:text-lg">DLH KOTA MEDAN</h1>
              <Badge variant="outline" className="w-fit text-[8px] md:text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                <Cloud className="h-2 w-2 mr-1" /> SISTEM OPERASIONAL
              </Badge>
            </div>
          </div>
          
          <div className="ml-2 flex shrink-0 items-center gap-2 md:gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="max-w-40 truncate text-[11px] font-black leading-none text-slate-900">
                    {profile?.username || session?.user?.email || 'Pengguna'}
                  </p>
                  <p className="max-w-40 truncate text-[9px] font-bold text-emerald-700 mt-1">
                    Hak akses: {getRoleLabel(profile?.role)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200">
                      <UserCircle className="h-6 w-6 text-slate-600" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="p-3 border-b bg-slate-50/50">
                      <p className="text-xs font-bold text-slate-900">{profile?.username || session?.user?.email}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{profile?.role?.toUpperCase()}</p>
                    </div>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate('/maintenance')} className="cursor-pointer py-2.5">
                        <Database className="mr-2 h-4 w-4 text-amber-600" /> Maintenance Sistem
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsTrashOpen(true)} className="cursor-pointer py-2.5">
                      <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Tempat Sampah
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="cursor-pointer py-2.5">
                      <KeyRound className="mr-2 h-4 w-4 text-emerald-600" /> Ubah Password
                    </DropdownMenuItem>
                    <div className="h-px bg-slate-100 my-1" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2.5 text-red-600 font-bold">
                      <LogOut className="mr-2 h-4 w-4" /> Keluar Sistem
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                size="sm"
                aria-label="Masuk"
                title="Masuk"
                className="h-10 w-10 shrink-0 rounded-full bg-emerald-700 p-0 font-bold shadow-md hover:bg-emerald-800 sm:h-9 sm:w-auto sm:rounded-md sm:px-4"
              >
                <LogIn className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Masuk</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={cn("max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", activeTab === "nota_dinas" && "nota-dinas-main")}>
        {showExecutiveHero ? (
        <section className="relative mb-8 overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-2xl shadow-emerald-950/20">
          <img
            src={DLH_HERO_IMAGE_URL}
            alt="Pemerintah Kota Medan Dinas Lingkungan Hidup"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-emerald-950/35" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/70 to-transparent" />
          <div className="relative grid gap-8 p-6 md:grid-cols-[1.35fr_0.65fr] md:p-8 lg:p-10">
            <div className="flex min-h-[320px] flex-col justify-between gap-8">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur">
                  <Leaf className="mr-2 h-3.5 w-3.5" /> Pemerintah Kota Medan
                </Badge>
                <Badge className="border border-emerald-300/30 bg-emerald-400/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-50 backdrop-blur">
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Wilayah Operasional
                </Badge>
              </div>

              <div className="max-w-3xl">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/20">
                    <img src={LOGO_MEDAN_URL} alt="Logo Kota Medan" className="h-12 w-12 object-contain" />
                    <img src={LOGO_DLH_URL} alt="Logo Dinas Lingkungan Hidup Kota Medan" className="h-12 w-12 object-contain" />
                  </div>
                  <div className="hidden h-12 w-px bg-white/30 sm:block" />
                  <div className="hidden text-sm font-semibold leading-tight text-white/80 sm:block">
                    Sistem pelaporan dan rekap kegiatan lapangan
                  </div>
                </div>
                <h2 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
                  Dinas Lingkungan Hidup Kota Medan
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-100 md:text-base">
                  Portal kerja internal untuk laporan harian, rencana kerja, rekap operasional, BBM, dan SPJ BBM dengan tampilan data yang cepat dibaca.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Laporan</p>
                  <p className="mt-1 text-2xl font-black">{stats.totalReports}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Rencana Kerja</p>
                  <p className="mt-1 text-2xl font-black">{stats.totalWorkPlans}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Hari Ini</p>
                  <p className="mt-1 text-2xl font-black">{stats.reportsToday + stats.plansToday}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/15 bg-white/14 p-5 backdrop-blur-xl">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100">Status Sistem</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-white/12 p-3">
                    <span className="flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-emerald-200" /> Sinkronisasi</span>
                    <Badge className="bg-emerald-400 text-emerald-950">Aktif</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/12 p-3">
                    <span className="flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4 text-amber-200" /> Data Hari Ini</span>
                    <span className="text-sm font-black">{stats.reportsToday + stats.plansToday}</span>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-white/12 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                    <p className="text-xs font-medium leading-5 text-white/85">
                      Jl. Pinang Baris No. 114 Medan Sunggal, Medan, Sumatera Utara - 20127
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        ) : (
        <section className="mb-8 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-2 ring-1 ring-emerald-100">
                <img src={LOGO_MEDAN_URL} alt="Logo Kota Medan" className="h-11 w-11 object-contain" />
                <img src={LOGO_DLH_URL} alt="Logo DLH Kota Medan" className="h-11 w-11 object-contain" />
              </div>
              <div>
                <Badge variant="outline" className="mb-2 bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  {loginScopeLabel}
                </Badge>
                <h2 className="text-xl font-black tracking-tight text-slate-950 md:text-2xl">Sistem Laporan</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">Dinas Lingkungan Hidup Kota Medan</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
              Berdasarkan Login
            </Badge>
          </div>
        </section>
        )}
        {/* Welcome Section */}
        <div className="sr-only">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Halo, {profile?.username || 'Selamat Datang'}! 👋
          </h2>
          <p className="text-slate-500 text-sm md:text-base mt-1 font-medium">
            Pantau dan kelola laporan kegiatan harian Dinas Lingkungan Hidup dengan mudah.
          </p>
        </div>

        {showExecutiveHero && (
          <DashboardStats 
            totalReports={stats.totalReports}
            totalWorkPlans={stats.totalWorkPlans}
            reportsToday={stats.reportsToday}
            plansToday={stats.plansToday}
          />
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className={cn("w-full space-y-6", activeTab === "nota_dinas" && "nota-dinas-tabs")}>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm ring-1 ring-slate-100/80 print:hidden xl:flex-row xl:items-center xl:justify-between">
            <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-2 overflow-visible bg-transparent p-0 text-slate-600 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-start xl:flex-1">
              {canViewReportsTab && !isOvertimeOnly && <TabsTrigger
                value="reports"
                className={cn(systemTabBaseClass, systemTabToneClass.reports)}
              >
                <FileText size={16} /> Laporan Kerja
              </TabsTrigger>}
              {!isNotaDinasOnly && !isLaporanOnly && !isFuelSpecialist && !isOvertimeOnly && <TabsTrigger
                value="workplans"
                className={cn(systemTabBaseClass, systemTabToneClass.workplans)}
              >
                <ClipboardList size={16} /> Rencana Kerja
              </TabsTrigger>}
              {canViewOvertime && <TabsTrigger
                value="overtime"
                className={cn(systemTabBaseClass, systemTabToneClass.overtime)}
              >
                <FileText size={16} /> Rekap Lembur
              </TabsTrigger>}
              {(isAdmin || isPimpinan || isAdminBbm || isAdminBbmPusat || isAdminLaporanBbm || isAdminSpj || isAdminSpjOli || isNotaDinasOnly) && (
                <>
                  {(isAdmin || isAdminBbm) && (
                    <TabsTrigger value="fuel_reports" className={cn(systemTabBaseClass, systemTabToneClass.fuel_reports)}>
                      <Fuel size={16} /> Admin BBM
                    </TabsTrigger>
                  )}
                  {(isAdmin || isAdminBbmPusat) && (
                    <TabsTrigger value="fuel_reports_pusat" className={cn(systemTabBaseClass, systemTabToneClass.fuel_reports_pusat)}>
                      <Fuel size={16} /> Admin BBM Pusat
                    </TabsTrigger>
                  )}
                  {(isAdmin || isAdminLaporanBbm) && (
                    <TabsTrigger value="laporan_bbm" className={cn(systemTabBaseClass, systemTabToneClass.laporan_bbm)}>
                      <FileText size={16} /> Laporan BBM
                    </TabsTrigger>
                  )}
                  {(isAdmin || isPimpinan || isAdminSpj || isAdminSpjOli) && (
                    <TabsTrigger value="spj_oli" className={cn(systemTabBaseClass, systemTabToneClass.spj_oli)}>
                      <Fuel size={16} /> SPJ Oli
                    </TabsTrigger>
                  )}
                  {(isAdmin || isNotaDinasOnly) && (
                    <TabsTrigger value="nota_dinas" className={cn(systemTabBaseClass, systemTabToneClass.nota_dinas)}>
                      <FileText size={16} /> Nota Dinas
                    </TabsTrigger>
                  )}
                </>
              )}
            </TabsList>

            {(activeTab !== 'reports' || canPrintAnyReportRecap) && (
              <div className="flex w-full items-center justify-end border-t border-slate-200/80 pt-3 xl:w-auto xl:shrink-0 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button aria-label="Cetak rekap" title="Cetak rekap" variant="outline" size="sm" className="h-10 w-10 justify-center rounded-xl border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md sm:w-auto sm:px-4">
                    <Printer className="h-4 w-4 text-blue-600 sm:mr-2" /> <span className="hidden sm:inline">Cetak Rekap</span> <ChevronDown className="hidden h-3 w-3 opacity-50 sm:ml-2 sm:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {activeTab === 'reports' && (
                    <>
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => navigate(`/print-rekap?category=semua`)} className="py-3 cursor-pointer">
                          <Printer className="mr-3 h-4 w-4 text-blue-600" /> Cetak Harian Laporan
                        </DropdownMenuItem>
                      )}
                      {canPrintDailyRecap && <DropdownMenuItem onSelect={() => setIsDailyRecapDateOpen(true)} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Harian Laporan
                      </DropdownMenuItem>}
                      {canPrintWeeklyRecap && <DropdownMenuItem onClick={() => navigate(`/weekly-rekap?categories=semua&date=${new Date().toISOString().split('T')[0]}`)} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-purple-600" /> Rekap Mingguan Laporan
                      </DropdownMenuItem>}
                      {canPrintMonthlyRecap && <DropdownMenuItem onClick={() => navigate(`/monthly-rekap`)} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Laporan
                      </DropdownMenuItem>}
                    </>
                  )}
                  {activeTab === 'workplans' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate(`/work-plans/daily-rekap${canFilterWorkPlanRegions && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="py-3 cursor-pointer">
                        <Printer className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Rencana
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/work-plans/weekly-rekap${canFilterWorkPlanRegions && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Rencana
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/work-plans/monthly-rekap${canFilterWorkPlanRegions && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-purple-600" /> Rekap Bulanan Rencana
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'overtime' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/overtime/daily-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Lembur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/overtime/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Lembur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/overtime/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Lembur
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'fuel_reports' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/daily-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/yearly-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-red-600" /> Rekap Tahunan BBM
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'fuel_reports_pusat' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/daily-rekap?reportType=admin_bbm_pusat')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Admin BBM Pusat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/weekly-rekap?reportType=admin_bbm_pusat')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Admin BBM Pusat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/monthly-rekap?reportType=admin_bbm_pusat')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Admin BBM Pusat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/yearly-rekap?reportType=admin_bbm_pusat')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-red-600" /> Rekap Tahunan Admin BBM Pusat
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'laporan_bbm' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/daily-rekap?reportType=laporan_bbm')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Laporan BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/weekly-rekap?reportType=laporan_bbm')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Laporan BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/monthly-rekap?reportType=laporan_bbm')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Laporan BBM
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/yearly-rekap?reportType=laporan_bbm')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-red-600" /> Rekap Tahunan Laporan BBM
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'spj_oli' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/spj-oli/daily-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian SPJ Oli
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/spj-oli/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan SPJ Oli
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/spj-oli/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan SPJ Oli
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'nota_dinas' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/nota-dinas/daily-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Nota Dinas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/nota-dinas/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Nota Dinas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/nota-dinas/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Nota Dinas
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {activeTab === 'reports' && (
            <TabPageHeader
              title="Laporan Harian"
              description="Pencatatan realisasi pekerjaan lapangan."
              actionLabel="Input Laporan"
              onAction={() => navigate('/create')}
              showAction={canManageReports}
              actionIcon={FileText}
              actionClassName="bg-blue-600 hover:bg-blue-700"
              iconClassName="bg-blue-50 text-blue-600"
            />
          )}
          {activeTab === 'workplans' && (
            <TabPageHeader
              title="Rencana Kerja"
              description="Penyusunan agenda kerja tim dan lokasi."
              actionLabel="Input Rencana Kerja"
              onAction={() => navigate('/work-plans/create')}
              showAction={canManageWorkPlans}
              actionIcon={ClipboardList}
              actionClassName="bg-emerald-600 hover:bg-emerald-700"
              iconClassName="bg-emerald-50 text-emerald-600"
            />
          )}
          {activeTab === 'overtime' && (
            <TabPageHeader
              title="Rekap Lembur"
              description="Pencatatan kehadiran dan aktivitas lembur."
              actionLabel="Input Rekap Lembur"
              onAction={() => navigate('/overtime/create')}
              actionIcon={Clock3}
              actionClassName="bg-amber-600 hover:bg-amber-700"
              iconClassName="bg-amber-50 text-amber-600"
            />
          )}
          {activeTab === 'fuel_reports' && (
            <TabPageHeader
              title="Admin BBM"
              description="Pencatatan penggunaan bahan bakar minyak."
              actionLabel="Input BBM"
              onAction={() => navigate('/fuel-reports/create')}
              actionIcon={Fuel}
              actionClassName="bg-orange-600 hover:bg-orange-700"
              iconClassName="bg-orange-50 text-orange-600"
            />
          )}
          {activeTab === 'fuel_reports_pusat' && (
            <TabPageHeader
              title="Admin BBM Pusat"
              description="Pencatatan penggunaan BBM dan Oli untuk administrasi BBM Pusat."
              actionLabel="Input BBM Pusat"
              onAction={() => navigate('/fuel-reports-pusat/create')}
              actionIcon={Fuel}
              actionClassName="bg-cyan-600 hover:bg-cyan-700"
              iconClassName="bg-cyan-50 text-cyan-600"
            />
          )}
          {activeTab === 'laporan_bbm' && (
            <TabPageHeader
              title="Laporan BBM"
              description="Pencatatan BBM per wilayah dengan No. SPJ dan No. Polisi kendaraan atau alat."
              actionLabel="Input Laporan BBM"
              onAction={() => navigate('/laporan-bbm/create')}
              actionIcon={Fuel}
              actionClassName="bg-amber-700 hover:bg-amber-800"
              iconClassName="bg-amber-50 text-amber-700"
            />
          )}
          {/* Filter Section */}
          {(activeTab === "reports" || activeTab === "workplans") && !isOvertimeOnly && (
            <div className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-12">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Pencarian Cepat</label>
                  <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Cari uraian kegiatan atau lokasi..." 
                      className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl focus-visible:ring-blue-500" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                  </div>
                </div>
                {canFilterWorkPlanRegions && (
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Wilayah</label>
                    <Select value={selectedRegion} onValueChange={handleRegionChange}>
                      <SelectTrigger className="bg-slate-50 border-slate-200 h-11 rounded-xl font-medium">
                        <SelectValue placeholder="Pilih Wilayah" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semua">Semua Wilayah</SelectItem>
                        {regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5 lg:col-span-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Kategori Tim</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isUserRestricted}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 rounded-xl font-medium">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => <SelectItem key={cat} value={cat} className="font-medium">{cat === 'semua' ? 'Semua Kategori' : cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Tanggal</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="date" className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bulan</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!!selectedDate}>
                    <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-11 rounded-xl font-medium", selectedDate && "opacity-50")}>
                      <SelectValue placeholder="Pilih Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua Bulan</SelectItem>
                      {months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end sm:col-span-2 lg:col-span-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button aria-label="Reset filter" title="Reset filter" variant="ghost" size="icon" onClick={resetFilters} className="h-10 w-10 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl border border-dashed border-slate-200 sm:h-11 sm:w-11">
                          <FilterX className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Reset Filter</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          )}

          {canViewOvertime && <TabsContent value="overtime" className="mt-0"><OvertimeRecap recordCount={recordCounts.overtime} /></TabsContent>}

          {canViewReportsTab && !isOvertimeOnly && <TabsContent value="reports" className="mt-0">
            <TotalRecordLabel count={recordCounts.reports} />
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium">Sinkronisasi data laporan...</p>
              </div>
            ) : sortedReports.length > 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-12">No</th>
                        <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-28">
                          <button type="button" onClick={() => toggleReportSort("date")} className="mx-auto flex items-center justify-center gap-1.5 hover:text-blue-100">
                            Tanggal <SortIcon active={reportSortKey === "date"} direction={reportSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-36">
                          <button type="button" onClick={() => toggleReportSort("category")} className="flex items-center gap-1.5 hover:text-blue-100">
                            Kategori <SortIcon active={reportSortKey === "category"} direction={reportSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">
                          <button type="button" onClick={() => toggleReportSort("description")} className="flex items-center gap-1.5 hover:text-blue-100">
                            Uraian Kegiatan <SortIcon active={reportSortKey === "description"} direction={reportSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">
                          <button type="button" onClick={() => toggleReportSort("location")} className="flex items-center gap-1.5 hover:text-blue-100">
                            Lokasi <SortIcon active={reportSortKey === "location"} direction={reportSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-right font-semibold border-r border-slate-600 w-28">
                          <button type="button" onClick={() => toggleReportSort("volume")} className="ml-auto flex items-center justify-end gap-1.5 hover:text-blue-100">
                            Volume <SortIcon active={reportSortKey === "volume"} direction={reportSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-40">
                          <button type="button" onClick={() => toggleReportSort("remarks")} className="flex items-center gap-1.5 hover:text-blue-100">
                            Keterangan <SortIcon active={reportSortKey === "remarks"} direction={reportSortDirection} />
                          </button>
                        </th>
                        {isLoggedIn && <th className="px-3 py-3 text-center font-semibold w-24">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReports.map((report, index) => (
                        <tr
                          key={report.id}
                          className={cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/70", "hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100")}
                          onClick={() => navigate(`/daily-rekap?date=${report.date}&categories=${encodeURIComponent(report.category)}`)}
                        >
                          <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                          <td className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">{report.date}</td>
                          <td className="px-3 py-3 border-r border-slate-100">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">
                              {report.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100 max-w-[260px] whitespace-normal break-words leading-relaxed align-top">
                            <PointList values={report.tasks?.map(task => task.description?.trim() || "Tanpa uraian") || []} fallback={report.description || "Tanpa uraian"} />
                          </td>
                          <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[280px] leading-relaxed align-top">
                            <PointList values={report.tasks?.map(task => formatLocation(task.location)) || []} fallback={formatReportLocation(report)} />
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 border-r border-slate-100">
                            {report.volume} {getUnitByCategory(report.category)}
                          </td>
                          <td className="px-3 py-3 text-slate-500 italic border-r border-slate-100 max-w-[160px]">
                            <span className="line-clamp-2">{report.remarks || report.pimpinan_note || "-"}</span>
                          </td>
                          {isLoggedIn && (
                            <td className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/daily-rekap?date=${report.date}&categories=${encodeURIComponent(report.category)}`); }}>
                                  <Eye size={13} />
                                </Button>
                                {canManageReports && <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/edit/${report.id}`); }}>
                                  <Edit size={13} />
                                </Button>}
                                {canManageReports && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDeleteReport(e, report)}>
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500">
                  <strong className="text-slate-700">{sortedReports.length}</strong> laporan harian ditampilkan
                </div>
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="text-slate-300 h-10 w-10" />
                </div>
                <p className="text-slate-900 font-black text-xl">Tidak Ada Laporan</p>
                <p className="text-slate-500 mt-2 max-w-xs mx-auto">Coba sesuaikan filter pencarian atau buat laporan baru untuk hari ini.</p>
                <Button variant="link" onClick={resetFilters} className="mt-4 text-blue-600 font-bold">Reset Semua Filter</Button>
              </div>
            )}
          </TabsContent>}

          {!isNotaDinasOnly && !isLaporanOnly && !isFuelSpecialist && !isOvertimeOnly && <TabsContent value="workplans" className="mt-0">
            <TotalRecordLabel count={recordCounts.workplans} />
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                <p className="text-slate-500 font-medium">Memuat rencana kerja...</p>
              </div>
            ) : sortedWorkPlans.length > 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[980px]">
                    <thead>
                      <tr className="bg-slate-700 text-white">
                        <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-12">No</th>
                        <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-28">
                          <button type="button" onClick={() => toggleWorkPlanSort("date")} className="mx-auto flex items-center justify-center gap-1.5 hover:text-emerald-100">
                            Tanggal <SortIcon active={workPlanSortKey === "date"} direction={workPlanSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-36">
                          <button type="button" onClick={() => toggleWorkPlanSort("category")} className="flex items-center gap-1.5 hover:text-emerald-100">
                            Kategori <SortIcon active={workPlanSortKey === "category"} direction={workPlanSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">
                          <button type="button" onClick={() => toggleWorkPlanSort("description")} className="flex items-center gap-1.5 hover:text-emerald-100">
                            Uraian Rencana <SortIcon active={workPlanSortKey === "description"} direction={workPlanSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-left font-semibold border-r border-slate-600">
                          <button type="button" onClick={() => toggleWorkPlanSort("location")} className="flex items-center gap-1.5 hover:text-emerald-100">
                            Lokasi <SortIcon active={workPlanSortKey === "location"} direction={workPlanSortDirection} />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-24">
                          <button type="button" onClick={() => toggleWorkPlanSort("status")} className="mx-auto flex items-center justify-center gap-1.5 hover:text-emerald-100">
                            Status <SortIcon active={workPlanSortKey === "status"} direction={workPlanSortDirection} />
                          </button>
                        </th>
                        {canManageWorkPlans && <th className="px-3 py-3 text-center font-semibold w-28">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedWorkPlans.map((plan, index) => {
                        const isHidden = plan.is_visible === false;
                        return (
                          <tr
                            key={plan.id}
                            className={cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/70", isHidden && "opacity-70", "hover:bg-emerald-50/50 transition-colors cursor-pointer border-b border-slate-100")}
                            onClick={() => navigate(`/work-plans/daily-rekap?date=${plan.date}&category=${encodeURIComponent(plan.category)}`)}
                          >
                            <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                            <td className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">{plan.date}</td>
                            <td className="px-3 py-3 border-r border-slate-100">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] whitespace-nowrap">
                                {plan.category}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100 max-w-[280px] whitespace-normal break-words leading-relaxed align-top">
                              <PointList values={getWorkPlanDescriptions(plan)} fallback="Rencana Kerja" />
                            </td>
                            <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[280px] leading-relaxed align-top">
                              <PointList values={plan.items?.map(item => formatLocation(item.location)) || []} fallback="Lokasi tidak ditentukan" />
                            </td>
                            <td className="px-3 py-3 text-center border-r border-slate-100">
                              <Badge variant="outline" className={cn("text-[10px] font-bold", isHidden ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100")}>
                                {isHidden ? "Hidden" : "Tampil"}
                              </Badge>
                            </td>
                            {canManageWorkPlans && (
                              <td className="px-2 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" disabled={isPimpinan} onClick={(e) => handleToggleWorkPlanVisibility(e, plan)}>
                                    {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" disabled={!canManageWorkPlans} onClick={(e) => { e.stopPropagation(); if (canManageWorkPlans) navigate(`/work-plans/edit/${plan.id}`); }}>
                                    <Edit size={13} />
                                  </Button>
                                  {canManageWorkPlans && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDeleteWorkPlan(e, plan)}>
                                      <Trash2 size={13} />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500">
                  <strong className="text-slate-700">{sortedWorkPlans.length}</strong> rencana kerja ditampilkan
                </div>
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="text-slate-300 h-10 w-10" />
                </div>
                <p className="text-slate-900 font-black text-xl">Belum Ada Rencana</p>
                <p className="text-slate-500 mt-2 max-w-xs mx-auto">Rencana kerja untuk periode ini belum tersedia atau tidak ditemukan.</p>
                <Button variant="link" onClick={resetFilters} className="mt-4 text-green-600 font-bold">Reset Semua Filter</Button>
              </div>
            )}
          </TabsContent>}

          {(isAdmin || isPimpinan || isAdminBbm || isAdminBbmPusat || isAdminLaporanBbm || isAdminSpj || isAdminSpjOli) && (
            <>
              {(isAdmin || isAdminBbm) && (
                <TabsContent value="fuel_reports" className="mt-0">
                  <FuelReportTab regionId={accountRegionId} recordCount={recordCounts.fuel_reports} />
                </TabsContent>
              )}
              {(isAdmin || isAdminBbmPusat) && (
                <TabsContent value="fuel_reports_pusat" className="mt-0">
                  <FuelReportTab regionId={accountRegionId} reportType="admin_bbm_pusat" recordCount={recordCounts.fuel_reports_pusat} />
                </TabsContent>
              )}
              {(isAdmin || isAdminLaporanBbm) && (
                <TabsContent value="laporan_bbm" className="mt-0">
                  <FuelReportTab regionId={accountRegionId} reportType="laporan_bbm" recordCount={recordCounts.laporan_bbm} />
                </TabsContent>
              )}
            </>
          )}
          {(isAdmin || isNotaDinasOnly) && <TabsContent value="nota_dinas" className="mt-0"><NotaDinasTab isActive={activeTab === "nota_dinas"} recordCount={recordCounts.nota_dinas} /></TabsContent>}
        </Tabs>
        {activeTab === 'spj_oli' && (isAdmin || isPimpinan || isAdminSpj || isAdminSpjOli) && (
          <div className="mt-6">
          <SpjOli recordCount={recordCounts.spj_oli} />
          </div>
        )}
      </main>
      
      <TrashDialog
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRefresh={loadData}
        fuelReportType={activeTab === 'fuel_reports_pusat' ? 'admin_bbm_pusat' : activeTab === 'laporan_bbm' ? 'laporan_bbm' : 'admin_bbm'}
      />
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
      />

      <Dialog open={isDailyRecapDateOpen} onOpenChange={setIsDailyRecapDateOpen}>
        <DialogContent className="rounded-2xl p-5 sm:max-w-[460px] sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <CalendarDays className="h-5 w-5 text-green-600" /> Pilih Tanggal Rekap Harian
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Tentukan tanggal laporan yang ingin ditampilkan dan dicetak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3 sm:py-4">
            <label htmlFor="daily-recap-date" className="text-base font-semibold text-slate-700">Tanggal Laporan</label>
            <Input
              id="daily-recap-date"
              type="date"
              value={dailyRecapDate}
              onChange={(event) => setDailyRecapDate(event.target.value)}
              className="h-12 rounded-xl text-base"
            />
          </div>
          <DialogFooter className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 sm:[&>[data-slot=button]]:w-full">
            <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={() => setIsDailyRecapDateOpen(false)}>Batal</Button>
            <Button
              type="button"
              disabled={!dailyRecapDate}
              className="h-11 w-full rounded-xl bg-green-600 font-bold shadow-sm hover:bg-green-700"
              onClick={() => {
                setIsDailyRecapDateOpen(false);
                navigate(`/daily-rekap?categories=semua&date=${dailyRecapDate}`);
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Buka Rekap Harian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
