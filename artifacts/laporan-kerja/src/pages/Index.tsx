"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Search, Cloud, Printer,
  LogOut, LogIn, FilterX, Database, ChevronDown,
  Table, ClipboardList, CalendarDays, Fuel, Trash2, Loader2, UserCircle, Bell,
  ArrowUpDown, ChevronUp, Edit, Eye, EyeOff, Leaf, MapPin, ShieldCheck,
  Activity, Clock3, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { showSuccess, showError } from '@/utils/toast';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrashDialog from '@/components/TrashDialog';
import FuelReportTab from '@/components/FuelReportTab';
import FuelSpjTab from '@/components/FuelSpjTab';
import DashboardStats from '@/components/dashboard/DashboardStats';
import QuickActions from '@/components/dashboard/QuickActions';
import { cn } from "@/lib/utils";
import { getUnitByCategory } from '@/utils/report-helpers';
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

const Index = () => {
  const navigate = useNavigate();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("reports");
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDailyRecapDateOpen, setIsDailyRecapDateOpen] = useState(false);
  const [dailyRecapDate, setDailyRecapDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("semua");
  const [selectedYear, setSelectedYear] = useState("semua");
  const [selectedCategory, setSelectedCategory] = useState("semua");
  const [reportSortKey, setReportSortKey] = useState<ReportSortKey>("date");
  const [reportSortDirection, setReportSortDirection] = useState<SortDirection>("desc");
  const [workPlanSortKey, setWorkPlanSortKey] = useState<WorkPlanSortKey>("date");
  const [workPlanSortDirection, setWorkPlanSortDirection] = useState<SortDirection>("desc");

  const isLoggedIn = !!session;
  const isAdmin = profile?.role === 'admin' || (session?.user?.email === 'admin@gmail.com');
  const isAdminBbm = profile?.role === 'admin_bbm';
  const isAdminSpj = profile?.role === 'admin_spj_bbm';
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAdminHarian = profile?.role === 'admin_harian' || session?.user?.email === 'sakinah@gmail.com' || session?.user?.email === 'admin.laporan@gmail.com';
  const isAdminRencanaKerja = profile?.role === 'admin_rencana_kerja';
  const isAdminWilayah = profile?.role === 'admin_wilayah';
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && !isPimpinan && !isAdminHarian;
  const canManageReports = isLoggedIn && !isPimpinan && !isAdminRencanaKerja;
  const canManageWorkPlans = isLoggedIn && !isPimpinan && !isAdminHarian;
  const showExecutiveHero = isAdmin;
  const { regions, teams: regionTeams } = useRegionFilterOptions(isAdmin, selectedRegion);
  const categories = useMemo(
    () => isAdmin ? ["semua", ...Array.from(new Set(regionTeams.map(team => team.name)))] : defaultCategories,
    [isAdmin, regionTeams],
  );
  const loginScopeLabel = isPimpinan
    ? "Pimpinan"
    : isAdminHarian
      ? "Admin Harian"
      : isUserRestricted
        ? (profile?.category || "Petugas Lapangan")
        : "Sistem Laporan";

  useEffect(() => {
    if (authLoading) return;
    if (isAdminBbm) { navigate('/fuel-reports'); return; }
    if (isAdminSpj) { navigate('/fuel-reports/spj'); return; }
    loadData();
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [profile, isLoggedIn, isAdminBbm, isAdminSpj, authLoading, navigate]);

  useEffect(() => {
    setActiveTab(isAdminRencanaKerja ? "workplans" : "reports");
  }, [isAdminRencanaKerja]);

  useEffect(() => {
    if (selectedCategory !== 'semua' && !categories.includes(selectedCategory)) {
      setSelectedCategory(isUserRestricted ? (profile?.category || 'semua') : 'semua');
    }
  }, [categories, isUserRestricted, profile?.category, selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, workPlansData] = await Promise.all([
        reportService.getAllReports(),
        workPlanService.getAllWorkPlans()
      ]);
      setReports(reportsData);
      setWorkPlans(workPlansData);
      if (!isAdmin) {
        setSelectedRegion('semua');
      }
    } catch (error) {
      console.error(error);
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut();
        showSuccess("Berhasil keluar");
      } catch (error) {
        showError("Gagal keluar");
      }
    }
  };

  const handleDeleteReport = async (e: React.MouseEvent, report: Report) => {
    e.stopPropagation();
    if (isPimpinan) return;
    if (window.confirm(`Pindahkan laporan "${report.description}" ke tempat sampah?`)) {
      try {
        await reportService.deleteReport(report.id);
        setReports(reports.filter(r => r.id !== report.id));
        showSuccess("Laporan dipindahkan ke tempat sampah");
      } catch (error) {
        showError("Gagal menghapus");
      }
    }
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

  const handleDeleteWorkPlan = async (e: React.MouseEvent, plan: WorkPlan) => {
    e.stopPropagation();
    if (!canManageWorkPlans) return;
    if (window.confirm(`Pindahkan rencana kerja "${plan.items[0]?.description}" ke tempat sampah?`)) {
      try {
        await workPlanService.deleteWorkPlan(plan.id);
        setWorkPlans(workPlans.filter(p => p.id !== plan.id));
        showSuccess("Rencana kerja dipindahkan ke tempat sampah");
      } catch (error) {
        showError("Gagal menghapus data");
      }
    }
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
      const reportDate = new Date(report.date);
      const m = (reportDate.getMonth() + 1).toString();
      const y = reportDate.getFullYear().toString();
      
      const searchableTasks = Array.isArray(report.tasks) ? report.tasks : [];
      const matchSearch = !search || [
        report.description,
        formatLocation(report.location),
        ...searchableTasks.flatMap(task => [task.description, formatLocation(task.location)]),
      ].some(value => value?.toLowerCase().includes(search));
      const matchSpecificDate = !selectedDate || report.date === selectedDate;
      const matchMonth = selectedMonth === "semua" || m === selectedMonth;
      const matchYear = selectedYear === "semua" || y === selectedYear;
      const matchCategory = selectedCategory === "semua" || report.category === selectedCategory;
      const restrictionMatch = !isUserRestricted || report.category === profile?.category;
      const regionMatch = !isAdmin || selectedRegion === "semua" || report.region_id === selectedRegion;
      
      if (selectedDate) return matchSearch && matchSpecificDate && matchCategory && restrictionMatch && regionMatch;
      return matchSearch && matchMonth && matchYear && matchCategory && restrictionMatch && regionMatch;
    });
  }, [reports, searchQuery, selectedDate, selectedMonth, selectedYear, selectedCategory, isUserRestricted, profile, isAdmin, selectedRegion]);

  const filteredWorkPlans = useMemo(() => {
    return workPlans.filter(plan => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch = !search || (Array.isArray(plan.items) && plan.items.some(item => 
        [item.description, formatLocation(item.location)].some(value => value?.toLowerCase().includes(search))
      ));
      const matchSpecificDate = !selectedDate || plan.date === selectedDate;
      const matchMonth = selectedMonth === "semua" || (new Date(plan.date).getMonth() + 1).toString() === selectedMonth;
      const matchYear = selectedYear === "semua" || new Date(plan.date).getFullYear().toString() === selectedYear;
      const matchCategory = selectedCategory === "semua" || plan.category === selectedCategory;
      const restrictionMatch = !isUserRestricted || plan.category === profile?.category;
      const regionMatch = !isAdmin || selectedRegion === "semua" || plan.region_id === selectedRegion;
      
      return matchSearch && matchSpecificDate && matchMonth && matchYear && matchCategory && restrictionMatch && regionMatch;
    });
  }, [workPlans, searchQuery, selectedDate, selectedMonth, selectedYear, selectedCategory, isUserRestricted, profile, isAdmin, selectedRegion]);

  const formatReportLocation = (report: Report) => {
    return formatLocation(report.location);
  };

  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId);
    setSelectedCategory('semua');
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
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
              <img src={LOGO_MEDAN_URL} alt="Logo Kota Medan" className="h-9 w-9 object-contain" />
              <img src={LOGO_DLH_URL} alt="Logo DLH Kota Medan" className="h-9 w-9 object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm md:text-lg font-black text-slate-900 leading-tight tracking-tight">DLH KOTA MEDAN</h1>
              <Badge variant="outline" className="w-fit text-[8px] md:text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                <Cloud className="h-2 w-2 mr-1" /> SISTEM OPERASIONAL
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[11px] font-black text-slate-900 leading-none uppercase">
                    {isPimpinan ? 'Pimpinan' : isAdminHarian ? 'Admin Harian' : isAdmin ? 'Administrator' : 'User Lapangan'}
                  </p>
                  <p className="text-[9px] font-bold text-emerald-700 mt-1">
                    {isPimpinan || isAdminHarian ? 'Semua Wilayah' : (profile?.category || 'Umum')}
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
                    <div className="h-px bg-slate-100 my-1" />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer py-2.5 text-red-600 font-bold">
                      <LogOut className="mr-2 h-4 w-4" /> Keluar Sistem
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button onClick={() => navigate('/login')} size="sm" className="bg-emerald-700 hover:bg-emerald-800 h-9 px-4 font-bold shadow-md">
                <LogIn className="h-4 w-4 mr-2" /> Masuk
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => navigate('/create')} disabled={!canManageReports} className="h-11 bg-white text-slate-950 hover:bg-emerald-50">
                  <FileText className="mr-2 h-4 w-4" /> Laporan
                </Button>
                <Button onClick={() => navigate('/work-plans/create')} disabled={!canManageWorkPlans} className="h-11 bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                  <ClipboardList className="mr-2 h-4 w-4" /> Rencana
                </Button>
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

        {showExecutiveHero && (
          <QuickActions
            isPimpinan={isPimpinan}
            isLoggedIn={isLoggedIn}
            activeTab={activeTab}
            canManageWorkPlans={canManageWorkPlans}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border ring-1 ring-slate-100">
            <TabsList className="grid w-full grid-cols-2 md:flex md:w-auto gap-1 bg-transparent h-auto p-0">
              {!isAdminRencanaKerja && <TabsTrigger 
                value="reports" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold transition-all"
              >
                <FileText size={16} /> Laporan Harian
              </TabsTrigger>}
              {!isAdminHarian && <TabsTrigger 
                value="workplans" 
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold transition-all"
              >
                <ClipboardList size={16} /> Rencana Kerja
              </TabsTrigger>}
              {(isAdmin || isPimpinan) && !isAdminHarian && (
                <>
                  {isAdmin && (
                    <TabsTrigger value="fuel_reports" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold">
                      <Fuel size={16} className="mr-2" /> Admin BBM
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="fuel_spj" className="data-[state=active]:bg-blue-800 data-[state=active]:text-white py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold">
                    <Table size={16} className="mr-2" /> Laporan SPJ
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <div className="flex items-center gap-2 px-2">
              {activeTab === 'reports' && isAdminHarian && (
                <Button
                  type="button"
                  onClick={() => navigate('/create')}
                  className="h-10 rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Tambah Laporan Harian
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-slate-50 text-slate-700 border-slate-200 h-10 px-4 font-bold rounded-xl">
                    <Printer className="h-4 w-4 mr-2 text-blue-600" /> Cetak Rekap <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
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
                      <DropdownMenuItem onSelect={() => setIsDailyRecapDateOpen(true)} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Harian Laporan
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/weekly-rekap?categories=semua&date=${new Date().toISOString().split('T')[0]}`)} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-purple-600" /> Rekap Mingguan Laporan
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/monthly-rekap`)} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan Laporan
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === 'workplans' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/work-plans/daily-rekap')} className="py-3 cursor-pointer">
                        <Printer className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian Rencana
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/work-plans/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan Rencana
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/work-plans/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-purple-600" /> Rekap Bulanan Rencana
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
                  {activeTab === 'fuel_spj' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/daily-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-blue-600" /> Rekap Harian SPJ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/weekly-rekap')} className="py-3 cursor-pointer">
                        <Table className="mr-3 h-4 w-4 text-green-600" /> Rekap Mingguan SPJ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/monthly-rekap')} className="py-3 cursor-pointer">
                        <FileText className="mr-3 h-4 w-4 text-orange-600" /> Rekap Bulanan SPJ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/yearly-rekap')} className="py-3 cursor-pointer">
                        <CalendarDays className="mr-3 h-4 w-4 text-red-600" /> Rekap Tahunan SPJ
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filter Section */}
          {(activeTab === "reports" || activeTab === "workplans") && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border ring-1 ring-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Pencarian Cepat</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Cari uraian kegiatan atau lokasi..." 
                      className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl focus-visible:ring-blue-500" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="md:col-span-3 space-y-1.5">
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
                {isAdmin && (
                  <div className="md:col-span-2 space-y-1.5">
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
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Tanggal</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="date" className="pl-10 bg-slate-50 border-slate-200 h-11 rounded-xl" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
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
                <div className="md:col-span-1 flex justify-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={resetFilters} className="h-11 w-11 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-dashed border-slate-200">
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

          {!isAdminRencanaKerja && <TabsContent value="reports" className="mt-0">
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/edit/${report.id}`); }}>
                                  <Edit size={13} />
                                </Button>
                                {!isPimpinan && (
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

          {!isAdminHarian && <TabsContent value="workplans" className="mt-0">
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
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" disabled={isPimpinan} onClick={(e) => { e.stopPropagation(); if (!isPimpinan) navigate(`/work-plans/edit/${plan.id}`); }}>
                                    <Edit size={13} />
                                  </Button>
                                  {!isPimpinan && (
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

          {(isAdmin || isPimpinan) && (
            <>
              {isAdmin && (
                <TabsContent value="fuel_reports" className="mt-0">
                  <FuelReportTab />
                </TabsContent>
              )}
              <TabsContent value="fuel_spj" className="mt-0">
                <FuelSpjTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
      
      <TrashDialog 
        isOpen={isTrashOpen} 
        onClose={() => setIsTrashOpen(false)} 
        onRefresh={loadData} 
      />

      <Dialog open={isDailyRecapDateOpen} onOpenChange={setIsDailyRecapDateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-green-600" /> Pilih Tanggal Rekap Harian
            </DialogTitle>
            <DialogDescription>
              Tentukan tanggal laporan yang ingin ditampilkan dan dicetak.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label htmlFor="daily-recap-date" className="text-sm font-semibold text-slate-700">Tanggal Laporan</label>
            <Input
              id="daily-recap-date"
              type="date"
              value={dailyRecapDate}
              onChange={(event) => setDailyRecapDate(event.target.value)}
              className="h-11"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setIsDailyRecapDateOpen(false)}>Batal</Button>
            <Button
              type="button"
              disabled={!dailyRecapDate}
              className="bg-green-600 hover:bg-green-700"
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
