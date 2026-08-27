"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Calendar, MapPin, Fuel, Trash2, Edit, 
  Search, FilterX, RefreshCw, Printer, ChevronDown,
  Table, FileText, Settings2, Eye, LogOut, CalendarDays
} from 'lucide-react';
import { fuelSpjService } from '@/services/fuelSpjService';
import { FuelSpjReport } from '@/types/fuelSpjReport';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Input } from "@/components/ui/input";
import FuelPriceSettings from '@/components/FuelPriceSettings';
import { cn } from "@/lib/utils";
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
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

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const FuelSpjReportList = () => {
  const navigate = useNavigate();
  const { profile, session, signOut } = useAuth();
  const [reports, setReports] = useState<FuelSpjReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriceSettingsOpen, setIsPriceSettingsOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("semua");
  const [selectedYear, setSelectedYear] = useState("semua");
  const [selectedRegion, setSelectedRegion] = useState("semua");

  const isAllowed = profile?.role === 'admin' || 
                    profile?.role === 'admin_spj_bbm' || 
                    profile?.role === 'pimpinan' || 
                    (session?.user?.email === 'pimpinan@gmail.com');

  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const { regions } = useRegionFilterOptions(Boolean(profile), 'semua');
  const roleLabel = profile?.role === 'admin'
    ? "Administrator"
    : isPimpinan
      ? "Pimpinan"
      : "Admin SPJ BBM";

  useEffect(() => {
    if (!isAllowed && profile) {
      showError("Akses ditolak.");
      navigate('/');
      return;
    }
    loadReports();
  }, [profile, isAllowed]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fuelSpjService.getAllReports();
      setReports(data);
    } catch (error) {
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isPimpinan) return;
    if (!confirm("Hapus laporan SPJ ini?")) return;
    try {
      await fuelSpjService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      showSuccess("Laporan SPJ dihapus");
    } catch (error) {
      showError("Gagal menghapus");
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedDate("");
    setSelectedMonth("semua");
    setSelectedYear("semua");
    setSelectedRegion("semua");
  };

  const filteredReports = reports.filter(r => {
    const search = searchQuery.toLowerCase();
    const reportDate = new Date(r.date);
    const m = (reportDate.getMonth() + 1).toString();
    const y = reportDate.getFullYear().toString();

    const matchSearch = r.region.toLowerCase().includes(search) || 
           r.entries.some(e => e.spj_no.toLowerCase().includes(search) || e.vehicle_operator.toLowerCase().includes(search));

    const matchSpecificDate = !selectedDate || r.date === selectedDate;
    const matchMonth = selectedMonth === "semua" || m === selectedMonth;
    const matchYear = selectedYear === "semua" || y === selectedYear;
    const matchRegion = selectedRegion === "semua" || r.region === selectedRegion;

    if (selectedDate) {
      return matchSearch && matchSpecificDate && matchRegion;
    }

    return matchSearch && matchMonth && matchYear && matchRegion;
  });

  const flatRows = filteredReports.flatMap((report, reportIndex) => {
    const entries = report.entries?.length ? report.entries : [{ spj_no: "-", vehicle_operator: "-", receiver_name: "-", locations: [] }];
    return entries.map((entry, entryIndex) => ({ report, reportIndex, entry, entryIndex, totalEntries: entries.length }));
  });

  if (!isAllowed) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
                  <FileText className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-[10px] font-black uppercase tracking-widest text-blue-700">
                      {roleLabel}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-[10px] font-bold text-slate-700 md:text-xs">
                      {filteredReports.length} laporan
                    </Badge>
                  </div>
                  <h1 className="text-lg font-black tracking-tight text-slate-950 md:text-2xl">Sistem Laporan SPJ BBM</h1>
                  <p className="text-xs font-semibold text-slate-500 md:text-sm">Dinas Lingkungan Hidup Kota Medan</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-9 w-9 self-end rounded-full text-red-500 hover:bg-red-50 md:self-auto">
                <LogOut size={20} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setIsPriceSettingsOpen(true)} className="bg-white border-slate-200">
              <Settings2 className="mr-2 h-4 w-4" /> Master Harga BBM
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200">
                  <Printer className="h-4 w-4 mr-2" /> Cetak Rekap <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/daily-rekap')} className="cursor-pointer py-2">
                  <Calendar className="mr-2 h-4 w-4 text-blue-600" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/weekly-rekap')} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/monthly-rekap')} className="cursor-pointer py-2">
                  <FileText className="mr-2 h-4 w-4 text-purple-600" /> Rekap Bulanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/yearly-rekap')} className="cursor-pointer py-2">
                  <CalendarDays className="mr-2 h-4 w-4 text-orange-600" /> Rekap Tahunan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isPimpinan && (
              <Button onClick={() => navigate('/fuel-reports/spj/create')} className="bg-blue-600 font-bold shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Input SPJ Baru
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Cari No. SPJ / Kendaraan</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Ketik kata kunci..." 
                  className="pl-10 bg-slate-50 border-slate-200 h-10 text-sm" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Wilayah</label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="bg-slate-50 border-slate-200 h-10 text-sm">
                  <SelectValue placeholder="Semua Wilayah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Wilayah</SelectItem>
                  {regions.map(region => <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Tanggal</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="date" 
                  className="pl-10 bg-slate-50 border-slate-200 h-10 text-sm" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Bulan</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!!selectedDate}>
                <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-10 text-sm", selectedDate && "opacity-50")}>
                  <SelectValue placeholder="Pilih Bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Bulan</SelectItem>
                  {months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Tahun</label>
              <Select value={selectedYear} onValueChange={setSelectedYear} disabled={!!selectedDate}>
                <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-10 text-sm", selectedDate && "opacity-50")}>
                  <SelectValue placeholder="Pilih Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Tahun</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1 flex justify-end">
              <Button variant="ghost" size="icon" onClick={resetFilters} className="h-10 w-full md:w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 border border-dashed md:border-none">
                <FilterX className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">Memuat data SPJ...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[920px]">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-12">No</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-28">Tanggal</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-36">Wilayah</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-32">No. SPJ</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Kendaraan / Operator</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Penerima</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-24">Lokasi</th>
                    <th className="px-3 py-2.5 text-center font-semibold w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((row, idx) => (
                    <tr
                      key={`${row.report.id}-${row.entryIndex}`}
                      className={cn(row.reportIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70", "hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100")}
                      onClick={() => navigate(`/fuel-reports/spj/${row.report.id}`)}
                    >
                      {row.entryIndex === 0 && (
                        <>
                          <td rowSpan={row.totalEntries} className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100 align-middle">{row.reportIndex + 1}</td>
                          <td rowSpan={row.totalEntries} className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 align-middle whitespace-nowrap">{row.report.date}</td>
                          <td rowSpan={row.totalEntries} className="px-3 py-3 border-r border-slate-100 align-middle">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">{row.report.region}</Badge>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100">{row.entry.spj_no}</td>
                      <td className="px-3 py-3 text-slate-700 border-r border-slate-100 max-w-[260px]"><span className="line-clamp-2">{row.entry.vehicle_operator}</span></td>
                      <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[220px]"><span className="line-clamp-2">{row.entry.receiver_name}</span></td>
                      <td className="px-3 py-3 text-center font-mono text-slate-700 border-r border-slate-100">{row.entry.locations?.length || 0}</td>
                      {row.entryIndex === 0 && (
                        <td rowSpan={row.totalEntries} className="px-2 py-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); navigate(`/fuel-reports/spj/${row.report.id}`); }}><Eye size={13} /></Button>
                            {!isPimpinan && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/fuel-reports/spj/edit/${row.report.id}`); }}><Edit size={13} /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDelete(e, row.report.id)}><Trash2 size={13} /></Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-500">
              <strong className="text-slate-700">{filteredReports.length}</strong> laporan SPJ Â· <strong className="text-slate-700">{flatRows.length}</strong> baris entry ditampilkan
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
            <p className="font-medium">Tidak ada laporan SPJ ditemukan</p>
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

export default FuelSpjReportList;
