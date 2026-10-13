import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Cloud, Printer,
  LogOut, LogIn, Database,
  ClipboardList, CalendarDays, Fuel, Trash2, Loader2, UserCircle,
  KeyRound
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { showSuccess, showError } from '@/utils/toast';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
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
import { getRoleLabel } from '@/constants/access-control';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { IndexRecapMenu } from '@/components/index/IndexRecapMenu';
import { IndexFilters } from '@/components/index/IndexFilters';
import { IndexReportsTable, IndexWorkPlansTable, getWorkPlanDescriptions, type ReportSortKey, type SortDirection, type WorkPlanSortKey } from '@/components/index/IndexDataTables';
import { IndexOverview } from '@/components/index/IndexOverview';
import { IndexSectionHeader } from '@/components/index/IndexSectionHeader';
import { getIndexAccess } from '@/components/index/indexAccess';
import { useIndexRecordLists } from '@/hooks/useIndexRecordLists';
import { useIndexRecordCounts } from '@/hooks/useIndexRecordCounts';
import { useIndexDataLoader } from '@/hooks/useIndexDataLoader';
import { useIndexScrollPersistence } from '@/hooks/useIndexScrollPersistence';
import {
  defaultCategories,
  formatLocation,
  isMainTab,
  readIndexViewState,
  systemTabBaseClass,
  systemTabToneClass,
  years,
  writeIndexViewState,
  type IndexViewState,
  type MainTab,
} from '@/components/index/indexConfig';

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');
const DLH_HERO_IMAGE_URL = "https://dlh.medan.go.id/web/resources/img/cover/780X520.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const isLoggedIn = !!session;
  const savedViewStateRef = useRef<IndexViewState>(readIndexViewState());
  // Flag agar tab initialization effect hanya berjalan sekali setelah auth selesai.
  const hasInitializedTabRef = useRef(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
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

  const {
    isAdmin,
    canFilterWorkPlanRegions,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    isPimpinan,
    isAdminRencanaKerja,
    isAdminWilayah,
    accountRegionId,
    isCombinedWorkspace,
    isFuelSpecialist,
    canViewReportsTab,
    isOvertimeOnly,
    canViewOvertime,
    isLaporanOnly,
    isUserRestricted,
    canManageReports,
    canManageWorkPlans,
    canPrintDailyRecap,
    canPrintWeeklyRecap,
    canPrintMonthlyRecap,
    canPrintAnyReportRecap,
    showExecutiveHero,
    loginScopeLabel,
  } = getIndexAccess(profile, session?.user?.email, isLoggedIn);
  const { recordCounts, setRecordCounts, loadRecordCounts } = useIndexRecordCounts({
    reports,
    workPlans,
    hasProfile: Boolean(profile),
    isLoggedIn,
    canViewReportsTab,
    isOvertimeOnly,
    isNotaDinasOnly,
    isLaporanOnly,
    isFuelSpecialist,
    canViewOvertime,
    isAdmin,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isPimpinan,
    isAdminSpj,
    isAdminSpjOli,
    accountRegionId,
  });
  const loadData = useIndexDataLoader({
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedCategory,
    selectedRegion,
    profileCategory: profile?.category,
    isUserRestricted,
    isAdmin,
    accountRegionId,
    setLoading,
    setReports,
    setWorkPlans,
    setSelectedRegion,
    setRecordCounts,
  });
  useIndexScrollPersistence(loading, savedViewStateRef.current.scrollY);
  const { regions, teams: regionTeams } = useRegionFilterOptions(canFilterWorkPlanRegions, selectedRegion);
  const categories = useMemo(
    () => canFilterWorkPlanRegions ? ["semua", ...Array.from(new Set(regionTeams.map(team => team.name)))] : defaultCategories,
    [canFilterWorkPlanRegions, regionTeams],
  );
  const {
    filteredReports,
    filteredWorkPlans,
    sortedReports,
    sortedWorkPlans,
    formatReportLocation,
    toggleReportSort,
    toggleWorkPlanSort,
  } = useIndexRecordLists({
    reports,
    workPlans,
    searchQuery,
    isAdmin,
    canFilterWorkPlanRegions,
    selectedRegion,
    reportSortKey,
    reportSortDirection,
    setReportSortKey,
    setReportSortDirection,
    workPlanSortKey,
    workPlanSortDirection,
    setWorkPlanSortKey,
    setWorkPlanSortDirection,
  });
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
    // Tunggu sampai auth selesai load agar role-based tab initialization
    // hanya berjalan sekali dengan data yang sudah benar.
    // Tanpa ini, effect berjalan dua kali: sekali saat profile masih null
    // (semua role boolean false → savedTab terpilih), lalu sekali lagi
    // setelah profile load (role boolean berubah → tab tertimpa ke default role).
    if (authLoading) return;

    // Jika sudah pernah diinisialisasi sebelumnya, jangan override tab aktif
    // kecuali ada ?tab= di URL yang eksplisit diminta.
    const requestedTab = searchParams.get('tab');
    if (hasInitializedTabRef.current && !requestedTab) return;
    hasInitializedTabRef.current = true;

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
      // Hapus ?tab= dari URL setelah diproses agar refresh tidak memaksa tab yang sama
      setSearchParams(prev => { prev.delete('tab'); return prev; }, { replace: true });
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
  }, [authLoading, isAdmin, isAdminBbm, isAdminBbmPusat, isAdminLaporanBbm, isAdminSpj, isAdminSpjOli, isNotaDinasOnly, isAdminRencanaKerja, isAdminWilayah, isCombinedWorkspace, isOvertimeOnly, searchParams]);

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
    if (selectedCategory !== 'semua' && !categories.includes(selectedCategory)) {
      setSelectedCategory(isUserRestricted ? (profile?.category || 'semua') : 'semua');
    }
  }, [categories, isUserRestricted, profile?.category, selectedCategory]);

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
        <IndexOverview
          isExecutive={showExecutiveHero}
          loginScopeLabel={loginScopeLabel}
          stats={stats}
          logoMedanUrl={LOGO_MEDAN_URL}
          logoDlhUrl={LOGO_DLH_URL}
          heroImageUrl={DLH_HERO_IMAGE_URL}
        />
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

            <IndexRecapMenu
              activeTab={activeTab}
              canPrintAnyReportRecap={canPrintAnyReportRecap}
              canPrintDailyRecap={canPrintDailyRecap}
              canPrintWeeklyRecap={canPrintWeeklyRecap}
              canPrintMonthlyRecap={canPrintMonthlyRecap}
              canFilterWorkPlanRegions={canFilterWorkPlanRegions}
              isAdmin={isAdmin}
              selectedRegion={selectedRegion}
              onNavigate={navigate}
              onOpenDailyReportRecap={() => setIsDailyRecapDateOpen(true)}
            />
          </div>

          <IndexSectionHeader
            activeTab={activeTab}
            canManageReports={canManageReports}
            canManageWorkPlans={canManageWorkPlans}
            onNavigate={navigate}
          />
          <IndexFilters
            visible={(activeTab === "reports" || activeTab === "workplans") && !isOvertimeOnly}
            searchQuery={searchQuery}
            selectedRegion={selectedRegion}
            selectedCategory={selectedCategory}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            categories={categories}
            regions={regions}
            canFilterWorkPlanRegions={canFilterWorkPlanRegions}
            isUserRestricted={isUserRestricted}
            onSearchChange={setSearchQuery}
            onRegionChange={handleRegionChange}
            onCategoryChange={setSelectedCategory}
            onDateChange={setSelectedDate}
            onMonthChange={setSelectedMonth}
            onReset={resetFilters}
          />

          {canViewOvertime && <TabsContent value="overtime" className="mt-0"><OvertimeRecap recordCount={recordCounts.overtime} /></TabsContent>}

          {canViewReportsTab && !isOvertimeOnly && <TabsContent value="reports" className="mt-0">
            <IndexReportsTable
              records={sortedReports}
              loading={loading}
              recordCount={recordCounts.reports}
              isLoggedIn={isLoggedIn}
              canManageReports={canManageReports}
              sortKey={reportSortKey}
              sortDirection={reportSortDirection}
              formatLocation={formatLocation}
              formatReportLocation={formatReportLocation}
              onSort={toggleReportSort}
              onNavigate={navigate}
              onDelete={handleDeleteReport}
              onReset={resetFilters}
            />
          </TabsContent>}

          {!isNotaDinasOnly && !isLaporanOnly && !isFuelSpecialist && !isOvertimeOnly && <TabsContent value="workplans" className="mt-0">
            <IndexWorkPlansTable
              records={sortedWorkPlans}
              loading={loading}
              recordCount={recordCounts.workplans}
              canManageWorkPlans={canManageWorkPlans}
              isPimpinan={isPimpinan}
              sortKey={workPlanSortKey}
              sortDirection={workPlanSortDirection}
              onSort={toggleWorkPlanSort}
              onNavigate={navigate}
              onToggleVisibility={handleToggleWorkPlanVisibility}
              onDelete={handleDeleteWorkPlan}
              onReset={resetFilters}
              getDescriptions={getWorkPlanDescriptions}
              formatLocation={formatLocation}
            />
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
