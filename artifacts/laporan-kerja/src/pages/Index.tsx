"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Search, Cloud, Printer,
  LogOut, LogIn, FilterX, Database, ChevronDown,
  Table, ClipboardList, CalendarDays, Fuel, Trash2, Loader2, UserCircle, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { showSuccess, showError } from '@/utils/toast';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
import { useAuth } from '@/context/AuthContext';
import TrashDialog from '@/components/TrashDialog';
import FuelReportTab from '@/components/FuelReportTab';
import FuelSpjTab from '@/components/FuelSpjTab';
import DashboardStats from '@/components/dashboard/DashboardStats';
import QuickActions from '@/components/dashboard/QuickActions';
import ReportCard from '@/components/dashboard/ReportCard';
import WorkPlanCard from '@/components/dashboard/WorkPlanCard';
import { cn } from "@/lib/utils";
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

const categories: string[] = [
  "semua", "Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"
];

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const Index = () => {
  const navigate = useNavigate();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("reports");
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("semua");
  const [selectedYear, setSelectedYear] = useState("semua");
  const [selectedCategory, setSelectedCategory] = useState("semua");

  const isLoggedIn = !!session;
  const isAdmin = profile?.role === 'admin' || (session?.user?.email === 'admin@gmail.com');
  const isAdminBbm = profile?.role === 'admin_bbm';
  const isAdminSpj = profile?.role === 'admin_spj_bbm';
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAdminHarian = profile?.role === 'admin_harian' || (session?.user?.email === 'sakinah@gmail.com');
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && !isPimpinan && !isAdminHarian;

  useEffect(() => {
    if (authLoading) return;
    if (isAdminBbm) { navigate('/fuel-reports'); return; }
    if (isAdminSpj) { navigate('/fuel-reports/spj'); return; }

    loadData();
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [profile, isLoggedIn, isAdminBbm, isAdminSpj, authLoading, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, workPlansData] = await Promise.all([
        reportService.getAllReports(),
        workPlanService.getAllWorkPlans()
      ]);
      setReports(reportsData);
      setWorkPlans(workPlansData);
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
    if (!isLoggedIn || isPimpinan) return;
    
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
    if (!isLoggedIn || isPimpinan) return;
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
    setSearchQuery("");
  };

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const search = searchQuery.toLowerCase();
      const reportDate = new Date(report.date);
      const m = (reportDate.getMonth() + 1).toString();
      const y = reportDate.getFullYear().toString();
      
      const matchSearch = report.description.toLowerCase().includes(search) || report.location.street.toLowerCase().includes(search);
      const matchSpecificDate = !selectedDate || report.date === selectedDate;
      const matchMonth = selectedMonth === "semua" || m === selectedMonth;
      const matchYear = selectedYear === "semua" || y === selectedYear;
      const matchCategory = selectedCategory === "semua" || report.category === selectedCategory;
      const restrictionMatch = !isUserRestricted || report.category === profile?.category;
      
      if (selectedDate) return matchSearch && matchSpecificDate && matchCategory && restrictionMatch;
      return matchSearch && matchMonth && matchYear && matchCategory && restrictionMatch;
    });
  }, [reports, searchQuery, selectedDate, selectedMonth, selectedYear, selectedCategory, isUserRestricted, profile]);

  const filteredWorkPlans = useMemo(() => {
    return workPlans.filter(plan => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch = !search || (Array.isArray(plan.items) && plan.items.some(item => 
        (item.description?.toLowerCase() || "").includes(search) ||
        (item.location?.street?.toLowerCase() || "").includes(search)
      ));
      const matchSpecificDate = !selectedDate || plan.date === selectedDate;
      const matchMonth = selectedMonth === "semua" || (new Date(plan.date).getMonth() + 1).toString() === selectedMonth;
      const matchYear = selectedYear === "semua" || new Date(plan.date).getFullYear().toString() === selectedYear;
      const matchCategory = selectedCategory === "semua" || plan.category === selectedCategory;
      const restrictionMatch = !isUserRestricted || plan.category === profile?.category;
      
      return matchSearch && matchSpecificDate && matchMonth && matchYear && matchCategory && restrictionMatch;
    });
  }, [workPlans, searchQuery, selectedDate, selectedMonth, selectedYear, selectedCategory, isUserRestricted, profile]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      totalReports: reports.length,
      totalWorkPlans: workPlans.length,
      reportsToday: reports.filter(r => r.date === today).length,
      plansToday: workPlans.filter(p => p.date === today).length
    };
  }, [reports, workPlans]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Memverifikasi Hak Akses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-blue-200 shadow-lg shrink-0">
              <FileText className="text-white h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm md:text-lg font-black text-slate-900 leading-tight tracking-tight">SISTEM LAPORAN</h1>
              <Badge variant="outline" className="w-fit text-[8px] md:text-[10px] py-0 h-4 bg-green-50 text-green-600 border-green-200 font-bold">
                <Cloud className="h-2 w-2 mr-1" /> CLOUD DLH
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
                  <p className="text-[9px] font-bold text-blue-600 mt-1">
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
              <Button onClick={() => navigate('/login')} size="sm" className="bg-blue-600 hover:bg-blue-700 h-9 px-4 font-bold shadow-md">
                <LogIn className="h-4 w-4 mr-2" /> Masuk
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Halo, {profile?.username || 'Selamat Datang'}! 👋
          </h2>
          <p className="text-slate-500 text-sm md:text-base mt-1 font-medium">
            Pantau dan kelola laporan kegiatan harian Dinas Lingkungan Hidup dengan mudah.
          </p>
        </div>

        {/* Stats Overview */}
        <DashboardStats 
          totalReports={stats.totalReports}
          totalWorkPlans={stats.totalWorkPlans}
          reportsToday={stats.reportsToday}
          plansToday={stats.plansToday}
        />

        {/* Quick Actions for Users */}
        <QuickActions isPimpinan={isPimpinan} isLoggedIn={isLoggedIn} activeTab={activeTab} />

        <Tabs defaultValue="reports" onValueChange={setActiveTab} className="w-full space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border ring-1 ring-slate-100">
            <TabsList className="grid w-full grid-cols-2 md:flex md:w-auto gap-1 bg-transparent h-auto p-0">
              <TabsTrigger 
                value="reports" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold transition-all"
              >
                <FileText size={16} /> Laporan Harian
              </TabsTrigger>
              <TabsTrigger 
                value="workplans" 
                className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs md:text-sm font-bold transition-all"
              >
                <ClipboardList size={16} /> Rencana Kerja
              </TabsTrigger>
              {(isAdmin || isPimpinan) && (
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-slate-50 text-slate-700 border-slate-200 h-10 px-4 font-bold rounded-xl">
                    <Printer className="h-4 w-4 mr-2 text-blue-600" /> Cetak Rekap <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {activeTab === 'reports' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate(`/print-rekap?category=semua`)} className="py-3 cursor-pointer">
                        <Printer className="mr-3 h-4 w-4 text-blue-600" /> Cetak Harian Laporan
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/daily-rekap?categories=semua&date=semua`)} className="py-3 cursor-pointer">
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

          <TabsContent value="reports" className="mt-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium">Sinkronisasi data laporan...</p>
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReports.map((report) => (
                  <ReportCard 
                    key={report.id} 
                    report={report} 
                    isLoggedIn={isLoggedIn} 
                    isPimpinan={isPimpinan} 
                    onDelete={handleDeleteReport} 
                  />
                ))}
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
          </TabsContent>

          <TabsContent value="workplans" className="mt-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                <p className="text-slate-500 font-medium">Memuat rencana kerja...</p>
              </div>
            ) : filteredWorkPlans.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWorkPlans.map((plan) => (
                  <WorkPlanCard 
                    key={plan.id} 
                    plan={plan} 
                    isLoggedIn={isLoggedIn} 
                    isPimpinan={isPimpinan} 
                    onDelete={handleDeleteWorkPlan}
                    onToggleVisibility={handleToggleWorkPlanVisibility}
                  />
                ))}
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
          </TabsContent>

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
    </div>
  );
};

export default Index;
