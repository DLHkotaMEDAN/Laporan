"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, CreditCard as Edit, Search, RefreshCw, ListFilter as FilterX, CalendarDays, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FuelReport, FuelUsageItem } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const PAGE_SIZE = 100;

interface FlatRow {
  reportId: string;
  report: FuelReport;
  item: FuelUsageItem;
  itemIndex: number;
  totalItems: number;
  rowNo: number;
}

const normalizeText = (value?: string | null) => (value || "").trim().toLowerCase();

const getFuelReportDuplicateKey = (report: FuelReport) => {
  const items = (report.items || []).map((item) => ({
    vehicle_operator: normalizeText(item.vehicle_operator),
    fuel_type: item.fuel_type,
    amount: Number(item.amount || 0),
    amount_rp: Number(item.amount_rp || 0),
    amount_liter: Number(item.amount_liter || 0),
    item_remarks: normalizeText(item.item_remarks),
    street: normalizeText(item.location?.street),
    subDistrict: normalizeText(item.location?.subDistrict),
    village: normalizeText(item.location?.village),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return JSON.stringify({
    date: report.date,
    region: normalizeText(report.region),
    team: normalizeText(report.team),
    remarks: normalizeText(report.remarks),
    price_pertamax: Number(report.price_pertamax || 0),
    price_dexlite: Number(report.price_dexlite || 0),
    items,
  });
};

const FuelReportTab = ({ regionId = null }: { regionId?: string | null }) => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const isAccountActive = profile?.is_active !== false;
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [appliedMonth, setAppliedMonth] = useState("semua");
  const [appliedYear, setAppliedYear] = useState("semua");
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [selectedTeam, setSelectedTeam] = useState("semua");

  const isSuperAdmin = profile?.role === 'admin' || session?.user?.email === 'admin@gmail.com';
  const { regions, teams: regionTeams } = useRegionFilterOptions(isSuperAdmin, selectedRegion);

  const [currentPage, setCurrentPage] = useState(1);
  const reqIdRef = useRef(0);
  const specificDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadReports(appliedDate, appliedMonth, appliedYear);
  }, [appliedDate, appliedMonth, appliedYear, regionId]);

  const loadReports = async (date: string, month: string, year: string) => {
    const id = ++reqIdRef.current;
    try {
      setLoading(true);
      let data: FuelReport[];

      if (date) {
        data = await fuelService.getReportsBySpecificDate(date, regionId);
      } else if (month !== "semua" && year !== "semua") {
        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await fuelService.getReportsByDateRange(startDate, endDate, regionId);
      } else if (year !== "semua") {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        data = await fuelService.getReportsByDateRange(startDate, endDate, regionId);
      } else if (month !== "semua") {
        const y = new Date().getFullYear();
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await fuelService.getReportsByDateRange(startDate, endDate, regionId);
      } else {
        data = await fuelService.getAllReports(false, regionId);
      }

      if (id !== reqIdRef.current) return;
      setReports(data);
      setCurrentPage(1);
    } catch (error) {
      if (id !== reqIdRef.current) return;
      showError("Gagal memuat data BBM");
    } finally {
      if (id !== reqIdRef.current) return;
      setLoading(false);
    }
  };

  const handleSpecificDateChange = (date: string) => {
    setSelectedDate(date);
    setAppliedDate(date);
    setAppliedMonth("semua");
    setAppliedYear("semua");
    setCurrentPage(1);
  };

  const handleMonthChange = (month: string) => {
    setSelectedDate("");
    setAppliedDate("");
    setAppliedMonth(month);
    setCurrentPage(1);
  };

  const handleYearChange = (year: string) => {
    setSelectedDate("");
    setAppliedDate("");
    setAppliedYear(year);
    setCurrentPage(1);
  };

  const openSpecificDatePicker = () => {
    const input = specificDateInputRef.current;
    if (!input) return;

    input.showPicker?.();
    input.focus();
  };

  const resetFilters = () => {
    setSearchQuery("");
    setShowDuplicatesOnly(false);
    setSelectedDate("");
    setAppliedDate("");
    setAppliedMonth("semua");
    setAppliedYear("semua");
    setSelectedRegion("semua");
    setSelectedTeam("semua");
    setCurrentPage(1);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isAccountActive) return;
    if (!confirm("Hapus laporan ini?")) return;
    try {
      await fuelService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      showSuccess("Laporan dihapus");
    } catch (error) {
      showError("Gagal menghapus");
    }
  };

  const duplicateReportKeys = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      const key = getFuelReportDuplicateKey(report);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [reports]);

  const duplicateReportCount = useMemo(() => {
    return reports.filter((report) => duplicateReportKeys.has(getFuelReportDuplicateKey(report))).length;
  }, [reports, duplicateReportKeys]);

  const duplicateReportGroupIndexes = useMemo(() => {
    const firstIndexes = new Map<string, number>();
    reports.forEach((report, index) => {
      const key = getFuelReportDuplicateKey(report);
      if (!firstIndexes.has(key)) firstIndexes.set(key, index);
    });

    const duplicateKeys = [...duplicateReportKeys].sort((a, b) => {
      return (firstIndexes.get(a) || 0) - (firstIndexes.get(b) || 0);
    });

    return new Map(duplicateKeys.map((key, index) => [key, index]));
  }, [reports, duplicateReportKeys]);

  const reportOrderIndexes = useMemo(() => {
    return new Map(reports.map((report, index) => [report.id, index]));
  }, [reports]);

  const filteredReports = reports
    .filter(r => {
      const search = searchQuery.toLowerCase();
      const matchSearch = !search ||
        r.team.toLowerCase().includes(search) ||
        r.region.toLowerCase().includes(search) ||
        r.items?.some(item => item.location.street.toLowerCase().includes(search)) ||
        r.items?.some(item => item.vehicle_operator.toLowerCase().includes(search));
      const matchDuplicate = !showDuplicatesOnly || duplicateReportKeys.has(getFuelReportDuplicateKey(r));
      const selectedRegionName = regions.find((region) => region.id === selectedRegion)?.name;
      const selectedTeamName = regionTeams.find((team) => team.id === selectedTeam)?.name;
      const matchRegion = !isSuperAdmin || selectedRegion === "semua" || r.region_id === selectedRegion || normalizeText(r.region) === normalizeText(selectedRegionName);
      const matchTeam = !isSuperAdmin || selectedTeam === "semua" || r.team_id === selectedTeam || normalizeText(r.team) === normalizeText(selectedTeamName);

      return matchSearch && matchDuplicate && matchRegion && matchTeam;
    })
    .sort((a, b) => {
      const aKey = getFuelReportDuplicateKey(a);
      const bKey = getFuelReportDuplicateKey(b);
      const aDuplicate = duplicateReportKeys.has(aKey);
      const bDuplicate = duplicateReportKeys.has(bKey);

      if (aDuplicate && bDuplicate) {
        const groupDiff = (duplicateReportGroupIndexes.get(aKey) || 0) - (duplicateReportGroupIndexes.get(bKey) || 0);
        if (groupDiff !== 0) return groupDiff;
      }

      if (aDuplicate !== bDuplicate) return aDuplicate ? -1 : 1;
      return (reportOrderIndexes.get(a.id) || 0) - (reportOrderIndexes.get(b.id) || 0);
    });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const paginatedReports = filteredReports.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const flatRows: FlatRow[] = [];
  let rowNo = (currentPage - 1) * PAGE_SIZE + 1;
  paginatedReports.forEach(report => {
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

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
          <div className="col-span-2 md:col-span-3 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Cari Tim / Wilayah / Lokasi</label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Ketik kata kunci..."
                  className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <Button
                type="button"
                variant={showDuplicatesOnly ? "default" : "outline"}
                onClick={() => { setShowDuplicatesOnly(prev => !prev); setCurrentPage(1); }}
                className={cn("h-9 shrink-0 px-3 text-[11px] font-bold", showDuplicatesOnly && "bg-amber-600 hover:bg-amber-700 text-white")}
              >
                Data Ganda
                {duplicateReportCount > 0 && (
                  <Badge className={cn("ml-1.5 px-1.5 py-0 text-[9px]", showDuplicatesOnly ? "bg-white text-amber-700" : "bg-amber-100 text-amber-700")}>
                    {duplicateReportCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
          <div className="col-span-2 md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Tanggal Spesifik</label>
            <div className="relative">
              <button
                type="button"
                aria-label="Pilih tanggal spesifik"
                onClick={openSpecificDatePicker}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center"
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
              <Input
                ref={specificDateInputRef}
                type="date"
                className="pl-10 bg-slate-50 border-slate-200 h-9 text-sm"
                value={selectedDate}
                onChange={(e) => handleSpecificDateChange(e.target.value)}
              />
            </div>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Bulan</label>
            <Select value={appliedMonth} onValueChange={handleMonthChange} disabled={!!selectedDate}>
              <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-9 text-sm", selectedDate && "opacity-50")}>
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Bulan</SelectItem>
                {months.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Tahun</label>
            <Select value={appliedYear} onValueChange={handleYearChange} disabled={!!selectedDate}>
              <SelectTrigger className={cn("bg-slate-50 border-slate-200 h-9 text-sm", selectedDate && "opacity-50")}>
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Tahun</SelectItem>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isSuperAdmin && (
            <>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Wilayah</label>
                <Select value={selectedRegion} onValueChange={(value) => { setSelectedRegion(value); setSelectedTeam("semua"); setCurrentPage(1); }}>
                  <SelectTrigger className="bg-slate-50 border-slate-200 h-9 text-sm">
                    <SelectValue placeholder="Semua Wilayah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Wilayah</SelectItem>
                    {regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Tim</label>
                <Select value={selectedTeam} onValueChange={(value) => { setSelectedTeam(value); setCurrentPage(1); }}>
                  <SelectTrigger className="bg-slate-50 border-slate-200 h-9 text-sm">
                    <SelectValue placeholder="Semua Tim" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Tim</SelectItem>
                    {regionTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="col-span-2 md:col-span-3 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Reset</label>
            <Button variant="ghost" size="icon" onClick={resetFilters} className="h-9 w-full border border-dashed text-slate-400 hover:text-red-500 hover:bg-red-50">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {(appliedDate || appliedMonth !== "semua" || appliedYear !== "semua" || showDuplicatesOnly || selectedRegion !== "semua" || selectedTeam !== "semua") && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Search className="h-3 w-3 shrink-0" />
            {appliedDate ? (
              <span>Menampilkan tanggal spesifik: <strong>{appliedDate}</strong></span>
            ) : (
              <span>Menampilkan: <strong>{appliedMonth !== "semua" ? months[parseInt(appliedMonth) - 1] : "Semua Bulan"}</strong> / <strong>{appliedYear !== "semua" ? appliedYear : "Semua Tahun"}</strong></span>
            )}
            {showDuplicatesOnly && <span className="font-bold text-amber-700">Data ganda saja</span>}
            {selectedRegion !== "semua" && <span>Wilayah: <strong>{regions.find((region) => region.id === selectedRegion)?.name || selectedRegion}</strong></span>}
            {selectedTeam !== "semua" && <span>Tim: <strong>{regionTeams.find((team) => team.id === selectedTeam)?.name || selectedTeam}</strong></span>}
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
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-24">Wilayah</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-32">Tim</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Kendaraan / Operator</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-20">Jenis BBM</th>
                  <th className="px-3 py-2.5 text-right font-semibold border-r border-slate-600 w-20">Jml (L)</th>
                  <th className="px-3 py-2.5 text-right font-semibold border-r border-slate-600 w-28">Nilai (Rp)</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Lokasi</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-28">Keterangan Item</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-20">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row, idx) => {
                  const isFirstItem = row.itemIndex === 0;
                  const duplicateKey = getFuelReportDuplicateKey(row.report);
                  const duplicateGroupIndex = duplicateReportGroupIndexes.get(duplicateKey);
                  const isDuplicate = duplicateGroupIndex !== undefined;
                  const isEvenReport = paginatedReports.findIndex(r => r.id === row.reportId) % 2 === 0;
                  const rowBg = isDuplicate
                    ? duplicateGroupIndex % 2 === 0
                      ? 'bg-amber-50/80'
                      : 'bg-blue-50/80'
                    : isEvenReport ? 'bg-white' : 'bg-slate-50/60';
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
                            {duplicateReportKeys.has(getFuelReportDuplicateKey(row.report)) && (
                              <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200 px-1 py-0">Ganda</Badge>
                            )}
                            {row.report.pimpinan_note && (
                              <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200 px-1 py-0">Catatan</Badge>
                            )}
                          </div>
                        </td>
                      )}
                      {isFirstItem && (
                        <td rowSpan={row.totalItems} className={cn("px-3 py-2 border-r border-slate-100 align-middle", borderTop)}>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">
                            {row.report.region}
                          </Badge>
                        </td>
                      )}
                      {isFirstItem && (
                        <td rowSpan={row.totalItems} className={cn("px-3 py-2 font-semibold text-slate-800 border-r border-slate-100 align-middle", borderTop)}>
                          {row.report.team}
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

                      {isFirstItem && (
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
                            {isAccountActive && <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => navigate(`/fuel-reports/edit/${row.reportId}`)}>
                                    <Edit size={13} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>}
                            {isAccountActive && <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDelete(e, row.reportId)}>
                                    <Trash2 size={13} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Hapus</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span><strong className="text-slate-700">{filteredReports.length}</strong> laporan · <strong className="text-slate-700">{flatRows.length}</strong> item BBM/Oli ditampilkan</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-medium text-slate-600">Hal {currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
          <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
            <Search className="text-slate-300 h-6 w-6" />
          </div>
          <p className="font-medium">Tidak ada laporan BBM ditemukan</p>
          <p className="text-xs mt-1">Coba ubah filter pencarian atau klik tombol reset</p>
          <Button variant="link" onClick={resetFilters} className="mt-2 text-blue-600">Reset Semua Filter</Button>
        </div>
      )}
    </div>
  );
};

export default FuelReportTab;
