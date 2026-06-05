"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Calendar, Fuel, Trash2, Edit, 
  Search, FilterX, ArrowLeft, RefreshCw, Printer, ChevronDown,
  Table, FileText, CalendarDays, LogOut, ArrowRight, Settings2,
  Eye
} from 'lucide-react';
import { FuelReport, FuelUsageItem } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FuelPriceSettings from '@/components/FuelPriceSettings';
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

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

interface FlatRow {
  reportId: string;
  report: FuelReport;
  item: FuelUsageItem;
  itemIndex: number;
  totalItems: number;
  rowNo: number;
}

const FuelReportList = () => {
  const navigate = useNavigate();
  const { profile, session, signOut } = useAuth();
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriceSettingsOpen, setIsPriceSettingsOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("semua");
  const [selectedYear, setSelectedYear] = useState("semua");
  const [appliedMonth, setAppliedMonth] = useState("semua");
  const [appliedYear, setAppliedYear] = useState("semua");

  const isAdminBbm = profile?.role === 'admin_bbm';
  const isAdmin = profile?.role === 'admin';
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAllowed = isAdmin || isAdminBbm || isPimpinan;

  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!isAllowed && profile) {
      showError("Akses ditolak. Hanya Administrator yang dapat mengakses halaman ini.");
      navigate('/');
    }
  }, [profile, isAllowed]);

  useEffect(() => {
    if (!isAllowed) return;
    loadReports(appliedMonth, appliedYear);
  }, [isAllowed, appliedMonth, appliedYear]);

  const loadReports = async (month: string, year: string) => {
    const id = ++reqIdRef.current;
    try {
      setLoading(true);
      let data: FuelReport[];

      if (month !== "semua" && year !== "semua") {
        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await fuelService.getReportsByDateRange(startDate, endDate);
      } else if (year !== "semua") {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        data = await fuelService.getReportsByDateRange(startDate, endDate);
      } else if (month !== "semua") {
        const y = new Date().getFullYear();
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await fuelService.getReportsByDateRange(startDate, endDate);
      } else {
        data = await fuelService.getAllReports();
      }

      if (id !== reqIdRef.current) return;
      setReports(data);
    } catch (error) {
      if (id !== reqIdRef.current) return;
      showError("Gagal memuat data");
    } finally {
      if (id !== reqIdRef.current) return;
      setLoading(false);
    }
  };

  const applyFilter = () => {
    setAppliedMonth(selectedMonth);
    setAppliedYear(selectedYear);
  };

  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut();
        navigate('/login');
        showSuccess("Berhasil keluar");
      } catch (error) {
        showError("Gagal keluar");
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isPimpinan) return;
    if (!confirm("Hapus laporan ini?")) return;
    try {
      await fuelService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      showSuccess("Laporan dihapus");
    } catch (error) {
      showError("Gagal menghapus");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDate("");
    setSelectedMonth("semua");
    setSelectedYear("semua");
    setAppliedMonth("semua");
    setAppliedYear("semua");
  };

  const filteredReports = reports.filter(r => {
    const search = searchQuery.toLowerCase();
    const matchSearch = !search ||
      r.team.toLowerCase().includes(search) ||
      r.region.toLowerCase().includes(search) ||
      r.items?.some(item => item.location.street.toLowerCase().includes(search)) ||
      r.items?.some(item => item.vehicle_operator.toLowerCase().includes(search));
    const matchSpecificDate = !selectedDate || r.date === selectedDate;
    return matchSearch && matchSpecificDate;
  });

  const flatRows: FlatRow[] = [];
  let rowNo = 1;
  filteredReports.forEach(report => {
    const items = report.items?.length ? report.items : [{ 
      vehicle_operator: '-', fuel_type: 'Pertamax' as const, amount: 0, amount_rp: 0, 
      amount_liter: 0, location: { street: '-' } 
    }];
    items.forEach((item, idx) => {
      flatRows.push({
        reportId: report.id,
        report,
        item,
        itemIndex: idx,
        totalItems: items.length,
        rowNo: idx === 0 ? rowNo++ : 0,
      });
    });
  });

  const fuelBadgeColor = (type: string) => {
    if (type === 'Pertamax') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (type === 'Dexlite') return 'bg-green-100 text-green-700 border-green-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const formatRp = (n: number) => n > 0 ? `Rp ${n.toLocaleString('id-ID')}` : '-';
  const formatL = (n: number) => n > 0 ? `${n.toLocaleString('id-ID')} L` : '-';

  if (!isAllowed) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
                  <Fuel className="text-orange-600 h-5 w-5 md:h-6 md:w-6" /> Laporan BBM & Oli
                  {!loading && (
                    <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 text-[10px] md:text-xs">
                      {filteredReports.length} laporan
                    </Badge>
                  )}
                </h1>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-full">
              <LogOut size={20} />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(isAdmin || profile?.role === 'admin_spj_bbm') && (
              <Button variant="outline" onClick={() => navigate('/fuel-reports/spj')} className="bg-blue-50 text-blue-700 border-blue-200 h-9 px-3 text-xs font-bold">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Laporan SPJ <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsPriceSettingsOpen(true)} className="bg-white border-slate-200 h-9 px-3 text-xs font-bold">
              <Settings2 className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Master Harga BBM
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200 h-9 px-3 text-xs">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Cetak Rekap
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/daily-rekap')} className="cursor-pointer text-xs py-2">
                  <Calendar className="mr-2 h-3.5 w-3.5 text-blue-600" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/weekly-rekap')} className="cursor-pointer text-xs py-2">
                  <Table className="mr-2 h-3.5 w-3.5 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/monthly-rekap')} className="cursor-pointer text-xs py-2">
                  <FileText className="mr-2 h-3.5 w-3.5 text-purple-600" /> Rekap Bulanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/yearly-rekap')} className="cursor-pointer text-xs py-2">
                  <CalendarDays className="mr-2 h-3.5 w-3.5 text-orange-600" /> Rekap Tahunan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => loadReports(appliedMonth, appliedYear)} disabled={loading} className="h-9 w-9 bg-white border-slate-200 shrink-0">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Segarkan Data</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {!isPimpinan && (
              <Button onClick={() => navigate('/fuel-reports/create')} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 font-bold shadow-sm text-xs ml-auto">
                <Plus className="mr-1.5 h-4 w-4" /> Input Baru
              </Button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
            <div className="col-span-2 md:col-span-3 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Cari Tim / Wilayah / Lokasi</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input placeholder="Ketik kata kunci..." className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="col-span-2 md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Tanggal Spesifik</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input type="date" className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Bulan</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!!selectedDate}>
                <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-9 text-sm", selectedDate && "opacity-50")}>
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Bulan</SelectItem>
                  {months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Tahun</label>
              <Select value={selectedYear} onValueChange={setSelectedYear} disabled={!!selectedDate}>
                <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-9 text-sm", selectedDate && "opacity-50")}>
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Tahun</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Terapkan</label>
              <Button onClick={applyFilter} disabled={loading || !!selectedDate} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                <Search className="h-3.5 w-3.5 mr-1.5" /> Cari Data
              </Button>
            </div>
            <div className="col-span-1 md:col-span-1 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Reset</label>
              <Button variant="ghost" size="icon" onClick={resetFilters} className="h-9 w-full border border-dashed text-slate-400 hover:text-red-500 hover:bg-red-50">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {(appliedMonth !== "semua" || appliedYear !== "semua") && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <Search className="h-3 w-3 shrink-0" />
              <span>Menampilkan: <strong>{appliedMonth !== "semua" ? months[parseInt(appliedMonth)-1] : "Semua Bulan"}</strong> / <strong>{appliedYear !== "semua" ? appliedYear : "Semua Tahun"}</strong></span>
            </div>
          )}
        </div>

        {/* Datasheet Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium animate-pulse">Memuat data...</p>
          </div>
        ) : flatRows.length > 0 ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-10">No</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-24">Tanggal</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-32">Tim</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-24">Wilayah</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Kendaraan / Operator</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-20">Jenis BBM</th>
                    <th className="px-3 py-2.5 text-right font-semibold border-r border-slate-600 w-20">Jml (L)</th>
                    <th className="px-3 py-2.5 text-right font-semibold border-r border-slate-600 w-28">Nilai (Rp)</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Lokasi</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-28">Keterangan Item</th>
                    {!isPimpinan && (
                      <th className="px-3 py-2.5 text-center font-semibold w-20">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((row, idx) => {
                    const isFirstItem = row.itemIndex === 0;
                    const isEvenReport = filteredReports.findIndex(r => r.id === row.reportId) % 2 === 0;
                    const rowBg = isEvenReport ? 'bg-white' : 'bg-slate-50/60';
                    const borderTop = isFirstItem && idx > 0 ? 'border-t-2 border-slate-200' : '';

                    return (
                      <tr key={`${row.reportId}-${row.itemIndex}`} className={cn(rowBg, "hover:bg-blue-50/40 transition-colors")}>
                        {isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-3 py-2 text-center font-bold text-slate-500 border-r border-slate-100 align-middle", borderTop)}>
                            {row.rowNo}
                          </td>
                        )}
                        {isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-3 py-2 text-center font-medium text-slate-700 border-r border-slate-100 align-middle whitespace-nowrap", borderTop)}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{row.report.date}</span>
                              {row.report.pimpinan_note && (
                                <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200 px-1 py-0">Catatan</Badge>
                              )}
                            </div>
                          </td>
                        )}
                        {isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-3 py-2 font-semibold text-slate-800 border-r border-slate-100 align-middle", borderTop)}>
                            {row.report.team}
                          </td>
                        )}
                        {isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-3 py-2 border-r border-slate-100 align-middle", borderTop)}>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">
                              {row.report.region}
                            </Badge>
                          </td>
                        )}

                        <td className={cn("px-3 py-2 text-slate-700 border-r border-slate-100", borderTop && isFirstItem ? borderTop : '')}>
                          {row.item.vehicle_operator}
                        </td>
                        <td className={cn("px-3 py-2 text-center border-r border-slate-100", borderTop && isFirstItem ? borderTop : '')}>
                          <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", fuelBadgeColor(row.item.fuel_type))}>
                            {row.item.fuel_type}
                          </Badge>
                        </td>
                        <td className={cn("px-3 py-2 text-right font-mono text-slate-700 border-r border-slate-100", borderTop && isFirstItem ? borderTop : '')}>
                          {row.item.fuel_type === 'Oli' ? formatL(row.item.amount_liter || row.item.amount) : (row.item.amount_liter > 0 ? formatL(row.item.amount_liter) : '-')}
                        </td>
                        <td className={cn("px-3 py-2 text-right font-mono font-semibold text-orange-700 border-r border-slate-100", borderTop && isFirstItem ? borderTop : '')}>
                          {row.item.fuel_type !== 'Oli' ? formatRp(row.item.amount_rp || row.item.amount) : '-'}
                        </td>
                        <td className={cn("px-3 py-2 text-slate-600 border-r border-slate-100 max-w-[180px]", borderTop && isFirstItem ? borderTop : '')}>
                          <span className="line-clamp-2">{row.item.location.street}</span>
                          {row.item.location.subDistrict && (
                            <span className="text-slate-400 text-[10px]"> — {row.item.location.subDistrict}</span>
                          )}
                        </td>
                        <td className={cn("px-3 py-2 text-slate-500 italic border-r border-slate-100 max-w-[120px]", borderTop && isFirstItem ? borderTop : '')}>
                          <span className="line-clamp-2">{row.item.item_remarks || '-'}</span>
                        </td>

                        {!isPimpinan && isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-2 py-2 text-center border-r border-slate-100 align-middle", borderTop)}>
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => navigate(`/fuel-reports/${row.reportId}`)}>
                                      <Eye size={13} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Lihat Detail</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => navigate(`/fuel-reports/edit/${row.reportId}`)}>
                                      <Edit size={13} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Edit</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDelete(e, row.reportId)}>
                                      <Trash2 size={13} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Hapus</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </td>
                        )}
                        {isPimpinan && isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-2 py-2 text-center align-middle", borderTop)}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => navigate(`/fuel-reports/${row.reportId}`)}>
                                    <Eye size={13} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Lihat Detail</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span><strong className="text-slate-700">{filteredReports.length}</strong> laporan · <strong className="text-slate-700">{flatRows.length}</strong> item BBM/Oli</span>
              <span className="text-slate-400">Klik baris untuk detail</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
            <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Search className="text-slate-300 h-6 w-6" />
            </div>
            <p className="font-medium">Tidak ada laporan ditemukan</p>
            <p className="text-xs mt-1">Coba ubah filter pencarian atau klik tombol reset</p>
            <Button variant="link" onClick={resetFilters} className="mt-2 text-blue-600">Reset Semua Filter</Button>
          </div>
        )}
      </div>

      <FuelPriceSettings 
        isOpen={isPriceSettingsOpen} 
        onClose={() => setIsPriceSettingsOpen(false)} 
      />
    </div>
  );
};

export default FuelReportList;
