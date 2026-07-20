"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Calendar, FileText, Trash2, Edit, 
  Printer, Search, FilterX, ArrowLeft, ChevronDown,
  Table, CalendarDays, Clock, LogIn, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { WorkPlan } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const WorkPlanList = () => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("semua");
  const [selectedDate, setSelectedDate] = useState("");
  const [isWeeklyMode, setIsWeeklyMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("semua");
  const [selectedYear, setSelectedYear] = useState("semua");

  const isLoggedIn = !!session;
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAdminHarian = profile?.role === 'admin_harian' || (session?.user?.email === 'sakinah@gmail.com');
  const canManageWorkPlans = isLoggedIn && !isPimpinan && !isAdminHarian;
  
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && profile?.category && !isPimpinan && !isAdminHarian;

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await workPlanService.getAllWorkPlans();
      setPlans(data || []);
    } catch (error) {
      console.error("Error loading plans:", error);
      showError("Gagal memuat rencana kerja");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (isUserRestricted && profile?.category) {
      setSelectedCategory(profile.category);
    }
  }, [profile, isUserRestricted]);

  const handleToggleVisibility = async (e: React.MouseEvent, plan: WorkPlan) => {
    e.stopPropagation();
    if (!canManageWorkPlans) return;
    
    const newVisibility = plan.is_visible === false ? true : false;
    try {
      await workPlanService.updateWorkPlan(plan.id, { is_visible: newVisibility });
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_visible: newVisibility } : p));
      showSuccess(newVisibility ? "Rencana akan muncul di rekap" : "Rencana disembunyikan dari rekap");
    } catch (error) {
      showError("Gagal mengubah status visibilitas");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canManageWorkPlans) return;
    if (window.confirm("Hapus rencana kerja ini secara permanen?")) {
      try {
        await workPlanService.deleteWorkPlan(id);
        setPlans(prev => prev.filter(p => p.id !== id));
        showSuccess("Rencana kerja berhasil dihapus");
      } catch (error) {
        showError("Gagal menghapus data");
      }
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory(isUserRestricted ? profile?.category || "semua" : "semua");
    setSelectedDate("");
    setIsWeeklyMode(false);
    setSelectedMonth("semua");
    setSelectedYear("semua");
  };

  const filteredPlans = plans.filter(plan => {
    const search = searchQuery.toLowerCase().trim();
    const matchSearch = !search || (Array.isArray(plan.items) && plan.items.some(item => 
      (item.description?.toLowerCase() || "").includes(search) ||
      (item.location?.street?.toLowerCase() || "").includes(search)
    ));

    const matchCategory = selectedCategory === "semua" || plan.category === selectedCategory;

    let matchDate = true;
    const planDate = parseISO(plan.date);
    
    if (selectedDate) {
      if (isWeeklyMode) {
        const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
        const end = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
        matchDate = isWithinInterval(planDate, { start, end });
      } else {
        matchDate = plan.date === selectedDate;
      }
    }

    let matchMonthYear = true;
    if (!selectedDate) {
      const m = (planDate.getMonth() + 1).toString();
      const y = planDate.getFullYear().toString();
      const matchMonth = selectedMonth === "semua" || m === selectedMonth;
      const matchYear = selectedYear === "semua" || y === selectedYear;
      matchMonthYear = matchMonth && matchYear;
    }

    return matchSearch && matchCategory && matchDate && matchMonthYear;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="px-2 md:px-3 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Beranda</span>
            </Button>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
                <FileText className="text-blue-600 h-5 w-5 md:h-6 md:w-6" /> Rencana Kerja
                {!loading && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">{filteredPlans.length}</Badge>}
              </h1>
              {!isLoggedIn && (
                <Badge variant="outline" className="w-fit text-[9px] bg-amber-50 text-amber-600 border-amber-200 mt-1">
                  <Eye className="h-2.5 w-2.5 mr-1" /> Mode Lihat Saja (Publik)
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={loadPlans} disabled={loading} className="h-9 w-9 bg-white border-slate-200">
                    <RefreshCw className={cn("h-4 w-4 text-slate-600", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Segarkan Data</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white px-2 md:px-3 h-9 border-slate-200">
                  <Printer className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Cetak Rekap</span> <ChevronDown className="ml-1 md:ml-2 h-3 w-3 md:h-4 md:w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/work-plans/daily-rekap')} className="cursor-pointer py-2">
                  <Calendar className="mr-2 h-4 w-4 text-blue-600" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/work-plans/weekly-rekap')} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/work-plans/monthly-rekap')} className="cursor-pointer py-2">
                  <FileText className="mr-2 h-4 w-4 text-purple-600" /> Rekap Bulanan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {canManageWorkPlans ? (
              <Button onClick={() => navigate('/work-plans/create')} className="bg-blue-600 hover:bg-blue-700 px-2 md:px-4 h-9 shadow-sm">
                <Plus className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Buat Rencana Baru</span>
              </Button>
            ) : !isLoggedIn ? (
              <Button onClick={() => navigate('/login')} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 h-9 px-2 md:px-4">
                <LogIn className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Masuk Sistem</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Cari Kegiatan / Lokasi</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Ketik kata kunci..." 
                  className="pl-10 bg-slate-50 border-slate-200 h-10" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Kategori</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!!isUserRestricted}>
                <SelectTrigger className="bg-slate-50 border-slate-200 h-10">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Kategori</SelectItem>
                  {["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"].map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Filter Tanggal / Minggu</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type="date" 
                    className="pl-10 bg-slate-50 border-slate-200 h-10" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                {selectedDate && (
                  <div className="flex items-center gap-2 bg-blue-50 px-3 rounded-md border border-blue-100 h-10">
                    <Checkbox 
                      id="weekly" 
                      checked={isWeeklyMode} 
                      onCheckedChange={(val) => setIsWeeklyMode(!!val)} 
                    />
                    <label htmlFor="weekly" className="text-[10px] font-bold text-blue-700 cursor-pointer whitespace-nowrap">PER MINGGU</label>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button variant="ghost" onClick={resetFilters} className="h-10 text-slate-400 hover:text-red-500 hover:bg-red-50 w-full md:w-auto px-2 md:px-4">
                <FilterX className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Reset Filter</span>
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium animate-pulse">Menghubungkan ke database...</p>
          </div>
        ) : filteredPlans.length > 0 ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[920px]">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-12">No</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-28">Tanggal</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-36">Kategori</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Uraian Rencana</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Lokasi Awal</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-20">Titik</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-28">Status</th>
                    {!isAdminHarian && <th className="px-3 py-2.5 text-center font-semibold w-28">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan, index) => {
                    const isHidden = plan.is_visible === false;
                    return (
                      <tr
                        key={plan.id}
                        className={cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/70", isHidden && "opacity-70", "hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100")}
                        onClick={() => navigate(`/work-plans/print/${plan.id}`)}
                      >
                        <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                        <td className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">{plan.date}</td>
                        <td className="px-3 py-3 border-r border-slate-100">
                          <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", isHidden ? "bg-slate-100 text-slate-500 border-slate-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                            {plan.category}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100 max-w-[280px]">
                          <span className="line-clamp-2">{plan.items?.[0]?.description || "Tanpa Deskripsi"}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[260px]">
                          <span className="line-clamp-2">{plan.items?.[0]?.location?.street || "Lokasi tidak ditentukan"}</span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-100">
                          {Array.isArray(plan.items) ? plan.items.length : 0}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-100">
                          <Badge variant="outline" className={cn("text-[10px] font-bold whitespace-nowrap", isHidden ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100")}>
                            {isHidden ? "Sembunyi" : "Tampil Rekap"}
                          </Badge>
                        </td>
                        {!isAdminHarian && <td className="px-2 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/work-plans/print/${plan.id}`); }}>
                                    <Printer size={13} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Preview Cetak</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {canManageWorkPlans && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className={cn("h-7 w-7", isHidden ? "text-slate-400 hover:text-blue-600" : "text-slate-400 hover:text-green-600")} onClick={(e) => handleToggleVisibility(e, plan)} disabled={isPimpinan}>
                                        {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{isHidden ? "Tampilkan di Rekap" : "Sembunyikan dari Rekap"}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button variant="ghost" size="icon" className={cn("h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50", isPimpinan && "opacity-50 cursor-not-allowed")} disabled={isPimpinan} onClick={(e) => { e.stopPropagation(); if(!isPimpinan) navigate(`/work-plans/edit/${plan.id}`); }}>
                                  <Edit size={13} />
                                </Button>
                                <Button variant="ghost" size="icon" className={cn("h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50", isPimpinan && "opacity-50 cursor-not-allowed")} disabled={isPimpinan} onClick={(e) => handleDelete(e, plan.id)}>
                                  <Trash2 size={13} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-500">
              <strong className="text-slate-700">{filteredPlans.length}</strong> rencana kerja ditampilkan
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Search className="text-slate-300 h-6 w-6" />
            </div>
            <p className="text-slate-500 font-medium">Tidak ada rencana kerja ditemukan</p>
            <p className="text-slate-400 text-xs mt-1">Coba ubah filter pencarian atau klik tombol refresh di atas</p>
            <Button variant="link" onClick={resetFilters} className="mt-2 text-blue-600">Reset Semua Filter</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkPlanList;
