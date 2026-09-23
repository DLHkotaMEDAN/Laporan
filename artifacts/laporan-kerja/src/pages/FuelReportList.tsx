"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Calendar, Fuel, Trash2, Edit, 
  Search, FilterX, ArrowLeft, RefreshCw, Printer, ChevronDown,
  Table, FileText, CalendarDays, LogOut, ArrowRight, Settings2,
  Eye, ArrowDownAZ, ArrowDownZA, ArrowDownUp
} from 'lucide-react';
import { FuelReport, FuelReportType, FuelUsageItem } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { fuelPusatService } from '@/services/fuelPusatService';
import { laporanBbmService } from '@/services/laporanBbmService';
import { useAuth } from '@/context/AuthContext';
import { isGlobalFuelAdmin, isLaporanBbmAdmin } from '@/constants/access-control';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { showSuccess, showError } from '@/utils/toast';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FuelPriceSettings from '@/components/FuelPriceSettings';
import TrashDialog from '@/components/TrashDialog';
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

type SortKey = 'no' | 'date' | 'spj' | 'region' | 'team' | 'vehicle' | 'fuelType' | 'liters' | 'value' | 'location' | 'receiver' | 'remarks';
type SortDirection = 'asc' | 'desc';
const normalizeText = (value?: string | null) => (value || "").trim().toLowerCase();

const getReportSortValue = (report: FuelReport, key: Exclude<SortKey, 'no'>): string | number => {
  const items = report.items || [];
  const firstItem = items[0];

  switch (key) {
    case 'date': return report.date || '';
    case 'spj': return report.no_spj || '';
    case 'region': return report.region || '';
    case 'team': return report.team || '';
    case 'vehicle': return firstItem?.vehicle_operator || '';
    case 'fuelType': return firstItem?.fuel_type || '';
    case 'liters': return items.reduce((total, item) => total + Number(item.amount_liter || (item.fuel_type === 'Oli' ? item.amount : 0) || 0), 0);
    case 'value': return items.reduce((total, item) => total + (item.fuel_type === 'Oli' ? 0 : Number(item.amount_rp || item.amount || 0)), 0);
    case 'location': return firstItem?.location?.street || '';
    case 'receiver': return firstItem?.recipient_name || '';
    case 'remarks': return firstItem?.item_remarks || '';
  }
};

const getFuelReportDuplicateKey = (report: FuelReport) => {
  const items = (report.items || []).map((item) => ({
    vehicle_operator: normalizeText(item.vehicle_operator),
    no_pol: normalizeText(item.no_pol),
    recipient_name: normalizeText(item.recipient_name),
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
    no_spj: normalizeText(report.no_spj),
    region: normalizeText(report.region),
    team: normalizeText(report.team),
    remarks: normalizeText(report.remarks),
    price_pertamax: Number(report.price_pertamax || 0),
    price_dexlite: Number(report.price_dexlite || 0),
    items,
  });
};

interface FuelReportListProps {
  reportType?: FuelReportType;
}

const FuelReportList = ({ reportType = 'admin_bbm' }: FuelReportListProps) => {
  const navigate = useNavigate();
  const { profile, session, signOut } = useAuth();
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [allActiveReports, setAllActiveReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [isPriceSettingsOpen, setIsPriceSettingsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [appliedMonth, setAppliedMonth] = useState("semua");
  const [appliedYear, setAppliedYear] = useState("semua");
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [selectedTeam, setSelectedTeam] = useState("semua");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;
  const isLaporanBbm = reportType === 'laporan_bbm';
  const isAdminBbmPusat = reportType === 'admin_bbm_pusat';
  const routeBase = isAdminBbmPusat ? '/fuel-reports-pusat' : isLaporanBbm ? '/laporan-bbm' : '/fuel-reports';
  const recapQuery = isAdminBbmPusat ? '?reportType=admin_bbm_pusat' : '';

  const isAdminBbm = profile?.role === 'admin_bbm' || profile?.role === 'admin_rencana_kerja_bbm' || profile?.role === 'admin_wilayah_bbm';
  const isAdminBbmPusatRole = profile?.role === 'admin_bbm_pusat';
  const isAdminLaporanBbm = isLaporanBbmAdmin(profile?.role);
  const isSuperAdmin = profile?.role === 'admin' || session?.user?.email === 'admin@gmail.com';
  const fuelRegionId = (isAdminBbm || isAdminLaporanBbm) && !isSuperAdmin && !isGlobalFuelAdmin(profile?.role) ? profile?.region_id || "__unassigned__" : null;
  const isAdmin = isSuperAdmin;
  const isAccountActive = profile?.is_active !== false;
  const canFilterByRegionTeam = isSuperAdmin || isGlobalFuelAdmin(profile?.role);
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const canInputFuelReport = isAccountActive && (isLaporanBbm
    ? isSuperAdmin || isAdminLaporanBbm
    : isAdminBbmPusat
      ? isSuperAdmin || isAdminBbmPusatRole
      : isSuperAdmin || isAdminBbm);
  const isAllowed = isLaporanBbm
    ? isSuperAdmin || isAdminLaporanBbm
    : isAdminBbmPusat
      ? isSuperAdmin || isAdminBbmPusatRole
      : isSuperAdmin || isAdminBbm || isPimpinan;
  const roleLabel = isAdmin
    ? "Administrator"
    : isPimpinan
      ? "Pimpinan"
      : isAdminLaporanBbm
        ? "Admin Laporan BBM"
        : isAdminBbmPusat
          ? "Admin BBM Pusat"
          : "Admin BBM";
  const { regions, teams: regionTeams } = useRegionFilterOptions(canFilterByRegionTeam, selectedRegion);

  const reqIdRef = useRef(0);
  const specificDateInputRef = useRef<HTMLInputElement>(null);

  const getAllReports = (includeDeleted = false) => isLaporanBbm
    ? laporanBbmService.getAllReports(includeDeleted, fuelRegionId)
    : isAdminBbmPusat
      ? fuelPusatService.getAllReports(includeDeleted, fuelRegionId)
      : fuelService.getAllReports(includeDeleted, fuelRegionId, reportType);
  const getReportsBySpecificDate = (date: string) => isLaporanBbm
    ? laporanBbmService.getReportsBySpecificDate(date, fuelRegionId)
    : isAdminBbmPusat
      ? fuelPusatService.getReportsBySpecificDate(date, fuelRegionId)
      : fuelService.getReportsBySpecificDate(date, fuelRegionId, reportType);
  const getReportsByDateRange = (startDate: string, endDate: string) => isLaporanBbm
    ? laporanBbmService.getReportsByDateRange(startDate, endDate, fuelRegionId)
    : isAdminBbmPusat
      ? fuelPusatService.getReportsByDateRange(startDate, endDate, fuelRegionId)
      : fuelService.getReportsByDateRange(startDate, endDate, fuelRegionId, reportType);

  useEffect(() => {
    if (!isAllowed && profile) {
      showError("Akses ditolak. Hanya Administrator yang dapat mengakses halaman ini.");
      navigate('/');
    }
  }, [profile, isAllowed]);

  useEffect(() => {
    if (!profile || !session) return;
    if (!isAllowed) return;
    loadReports(appliedDate, appliedMonth, appliedYear);
  }, [profile, session, isAllowed, appliedDate, appliedMonth, appliedYear, fuelRegionId, reportType]);

  const loadReports = async (date: string, month: string, year: string) => {
    const id = ++reqIdRef.current;
    try {
      setLoading(true);
      let data: FuelReport[];

      if (date) {
        data = await getReportsBySpecificDate(date);
      } else if (month !== "semua" && year !== "semua") {
        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await getReportsByDateRange(startDate, endDate);
      } else if (year !== "semua") {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        data = await getReportsByDateRange(startDate, endDate);
      } else if (month !== "semua") {
        const y = new Date().getFullYear();
        const m = parseInt(month);
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        data = await getReportsByDateRange(startDate, endDate);
      } else {
        data = await getAllReports();
      }

      // Ambil seluruh data aktif sebagai pembanding sehingga filter tidak
      // membuat salah satu pasangan duplikat hilang dari analisis.
      const duplicateSource = await getAllReports();
      if (id !== reqIdRef.current) return;
      setReports(data);
      setAllActiveReports(duplicateSource);
      setCurrentPage(1);
    } catch (error) {
      if (id !== reqIdRef.current) return;
      showError("Gagal memuat data");
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
    if (!isAccountActive || isPimpinan) return;
    if (!confirm("Hapus laporan ini?")) return;
    try {
      if (isLaporanBbm) {
        await laporanBbmService.deleteReport(id);
      } else {
        if (isAdminBbmPusat) await fuelPusatService.deleteReport(id);
        else await fuelService.deleteReport(id);
      }
      setReports(prev => prev.filter(r => r.id !== id));
      showSuccess("Laporan dihapus");
    } catch (error) {
      showError("Gagal menghapus");
    }
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
    setSort(null);
    setCurrentPage(1);
  };

  const handleSort = (key: SortKey) => {
    setSort(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const duplicateReportKeys = useMemo(() => {
    const counts = new Map<string, number>();
    allActiveReports.forEach((report) => {
      const key = getFuelReportDuplicateKey(report);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [allActiveReports]);

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
      const search = searchQuery.trim().toLowerCase();
      const matchSearch = !search ||
        (r.team || '').toLowerCase().includes(search) ||
        (r.no_spj || '').toLowerCase().includes(search) ||
        (r.region || '').toLowerCase().includes(search) ||
        r.items?.some(item => (item.location?.street || '').toLowerCase().includes(search)) ||
        r.items?.some(item => (item.vehicle_operator || '').toLowerCase().includes(search)) ||
        r.items?.some(item => (item.no_pol || '').toLowerCase().includes(search)) ||
        r.items?.some(item => (item.recipient_name || '').toLowerCase().includes(search));
      const matchDuplicate = !showDuplicatesOnly || duplicateReportKeys.has(getFuelReportDuplicateKey(r));
      const selectedRegionName = regions.find((region) => region.id === selectedRegion)?.name;
      const selectedTeamName = regionTeams.find((team) => team.id === selectedTeam)?.name;
      const matchRegion = !canFilterByRegionTeam || selectedRegion === "semua" || r.region_id === selectedRegion || normalizeText(r.region) === normalizeText(selectedRegionName);
      const matchTeam = !canFilterByRegionTeam || selectedTeam === "semua" || r.team_id === selectedTeam || normalizeText(r.team) === normalizeText(selectedTeamName);
      return matchSearch && matchDuplicate && matchRegion && matchTeam;
    })
    .sort((a, b) => {
      if (sort) {
        const aValue = sort.key === 'no' ? (reportOrderIndexes.get(a.id) || 0) : getReportSortValue(a, sort.key);
        const bValue = sort.key === 'no' ? (reportOrderIndexes.get(b.id) || 0) : getReportSortValue(b, sort.key);
        const comparison = typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), 'id', { numeric: true, sensitivity: 'base' });
        if (comparison !== 0) return sort.direction === 'asc' ? comparison : -comparison;
      }

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
    const reportItems = isLaporanBbm
      ? (report.items || []).filter(item => item.fuel_type !== 'Oli')
      : report.items || [];
    const items = reportItems.length ? reportItems : [{
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
  const sortableHeader = (label: string, key: SortKey, className: string) => {
    const isActive = sort?.key === key;
    const Icon = isActive && sort.direction === 'desc' ? ArrowDownZA : isActive ? ArrowDownAZ : ArrowDownUp;
    const directionLabel = isActive && sort.direction === 'desc' ? 'Z ke A / besar ke kecil' : 'A ke Z / kecil ke besar';

    return (
      <th className={cn("px-3 py-2.5 font-semibold border-r border-slate-600", className)}>
        <button
          type="button"
          onClick={() => handleSort(key)}
          aria-label={`Urutkan ${label}: ${directionLabel}`}
          title={`Urutkan ${label}: ${directionLabel}`}
          className="inline-flex w-full items-center gap-1.5 rounded text-inherit outline-none transition-colors hover:text-orange-200 focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <span>{label}</span>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-orange-300" : "text-slate-300")} aria-hidden="true" />
        </button>
      </th>
    );
  };

  if (!isAllowed) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-full mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 ring-1 ring-orange-100">
                  <Fuel className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-[10px] font-black uppercase tracking-widest text-orange-700">
                      {roleLabel}
                    </Badge>
                    {!loading && (
                      <Badge variant="secondary" className="bg-slate-100 text-[10px] font-bold text-slate-700 md:text-xs">
                        {filteredReports.length} laporan
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-lg font-black tracking-tight text-slate-950 md:text-2xl">{isLaporanBbm ? 'Laporan BBM' : isAdminBbmPusat ? 'Admin BBM Pusat' : 'Sistem Laporan BBM & Oli'}</h1>
                  <p className="text-xs font-semibold text-slate-500 md:text-sm">Dinas Lingkungan Hidup Kota Medan</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 self-end rounded-full text-red-500 hover:bg-red-50 md:self-auto">
                <LogOut size={20} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLaporanBbm && <Button variant="outline" onClick={() => setIsPriceSettingsOpen(true)} className="bg-white border-slate-200 h-9 px-3 text-xs font-bold">
              <Settings2 className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Master Harga BBM
            </Button>}
            {isAllowed && <Button variant="outline" onClick={() => setIsTrashOpen(true)} className="border-red-200 bg-red-50 text-red-700 h-9 px-3 text-xs font-bold hover:bg-red-100"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Tempat Sampah</Button>}
            {!isLaporanBbm && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200 h-9 px-3 text-xs">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Cetak Rekap
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => navigate(`/fuel-reports/daily-rekap${recapQuery}`)} className="cursor-pointer text-xs py-2">
                  <Calendar className="mr-2 h-3.5 w-3.5 text-blue-600" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/fuel-reports/weekly-rekap${recapQuery}`)} className="cursor-pointer text-xs py-2">
                  <Table className="mr-2 h-3.5 w-3.5 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/fuel-reports/monthly-rekap${recapQuery}`)} className="cursor-pointer text-xs py-2">
                  <FileText className="mr-2 h-3.5 w-3.5 text-purple-600" /> Rekap Bulanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/fuel-reports/yearly-rekap${recapQuery}`)} className="cursor-pointer text-xs py-2">
                  <CalendarDays className="mr-2 h-3.5 w-3.5 text-orange-600" /> Rekap Tahunan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => loadReports(appliedDate, appliedMonth, appliedYear)} disabled={loading} className="h-9 w-9 bg-white border-slate-200 shrink-0">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Segarkan Data</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {canInputFuelReport && (
              <Button onClick={() => navigate(`${routeBase}/create`)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 font-bold shadow-sm text-xs ml-auto">
                <Plus className="mr-1.5 h-4 w-4" /> Input Baru
              </Button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
            <div className="col-span-2 md:col-span-3 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">{isLaporanBbm ? 'Cari No. SPJ / Tim / Wilayah / Kendaraan' : 'Cari Tim / Wilayah / Lokasi'}</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Ketik kata kunci..." className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
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
                <Input ref={specificDateInputRef} type="date" className="pl-10 bg-slate-50 border-slate-200 h-9 text-sm" value={selectedDate} onChange={(e) => handleSpecificDateChange(e.target.value)} />
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
                  {months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
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
            {canFilterByRegionTeam && (
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
                  <label className="text-[10px] font-bold uppercase text-slate-500">Tim / Kategori</label>
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
                <span>Menampilkan: <strong>{appliedMonth !== "semua" ? months[parseInt(appliedMonth)-1] : "Semua Bulan"}</strong> / <strong>{appliedYear !== "semua" ? appliedYear : "Semua Tahun"}</strong></span>
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
              <table className="w-full text-xs border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    {sortableHeader('No', 'no', 'text-center w-10')}
                    {sortableHeader('Tanggal', 'date', 'text-center w-24')}
                    {isLaporanBbm && sortableHeader('No. SPJ', 'spj', 'text-left w-32')}
                    {sortableHeader('Wilayah', 'region', 'text-left w-24')}
                    {sortableHeader('Tim', 'team', 'text-left w-32')}
                    {sortableHeader('Kendaraan / Alat', 'vehicle', 'text-left')}
                    {isLaporanBbm && <th className="px-3 py-2.5 text-left font-semibold w-28">No. Polisi</th>}
                    {sortableHeader('Jenis BBM', 'fuelType', 'text-center w-20')}
                    {sortableHeader('Jml (L)', 'liters', 'text-right w-20')}
                    {sortableHeader('Nilai (Rp)', 'value', 'text-right w-28')}
                    {sortableHeader('Lokasi', 'location', 'text-left')}
                    {isLaporanBbm && sortableHeader('Penerima', 'receiver', 'text-left w-32')}
                    {sortableHeader('Petugas', 'remarks', 'text-left w-28')}
                    {!isPimpinan && (
                      <th className="px-3 py-2.5 text-center font-semibold w-20">Aksi</th>
                    )}
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
                        {isLaporanBbm && isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-3 py-2 font-semibold text-slate-700 border-r border-slate-100 align-middle", borderTop)}>
                            {row.report.no_spj || '-'}
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
                        {isLaporanBbm && <td className={cn("px-3 py-2 font-medium text-slate-600 border-r border-slate-100", borderTop && isFirstItem ? borderTop : '')}>
                          {row.item.no_pol || '-'}
                        </td>}
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
                        {isLaporanBbm && <td className={cn("px-3 py-2 text-slate-700 border-r border-slate-100 max-w-[140px]", borderTop && isFirstItem ? borderTop : '')}>
                          <span className="line-clamp-2">{row.item.recipient_name || '-'}</span>
                        </td>}
                        <td className={cn("px-3 py-2 text-slate-500 italic border-r border-slate-100 max-w-[120px]", borderTop && isFirstItem ? borderTop : '')}>
                          <span className="line-clamp-2">{row.item.item_remarks || '-'}</span>
                        </td>

                        {!isPimpinan && isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-2 py-2 text-center border-r border-slate-100 align-middle", borderTop)}>
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => navigate(`${routeBase}/${row.reportId}`)}>
                                      <Eye size={13} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Lihat Detail</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {isAccountActive && <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => navigate(`${routeBase}/edit/${row.reportId}`)}>
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
                        {isPimpinan && isFirstItem && (
                          <td rowSpan={row.totalItems} className={cn("px-2 py-2 text-center align-middle", borderTop)}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={() => navigate(`${routeBase}/${row.reportId}`)}>
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
              <span><strong className="text-slate-700">{filteredReports.length}</strong> laporan · <strong className="text-slate-700">{flatRows.length}</strong> item {isLaporanBbm ? 'BBM' : 'BBM/Oli'} ditampilkan</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-slate-600">Hal {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
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
            <p className="font-medium">Tidak ada laporan ditemukan</p>
            <p className="text-xs mt-1">Coba ubah filter pencarian atau klik tombol reset</p>
            <Button variant="link" onClick={resetFilters} className="mt-2 text-blue-600">Reset Semua Filter</Button>
          </div>
        )}
      </div>

      {!isLaporanBbm && <FuelPriceSettings
        isOpen={isPriceSettingsOpen}
        onClose={() => setIsPriceSettingsOpen(false)}
        isPusat={isAdminBbmPusat}
      />}
      <TrashDialog
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRefresh={() => void loadReports(appliedDate, appliedMonth, appliedYear)}
        fuelReportType={reportType}
      />
    </div>
  );
};

export default FuelReportList;
