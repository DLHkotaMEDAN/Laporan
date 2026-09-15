"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuelService } from '@/services/fuelService';
import { FuelReport } from '@/types/fuelReport';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Table, Filter, Settings2, PenTool, ChevronDown, FileText, Calendar, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import { isGlobalFuelAdmin } from '@/constants/access-control';
import { fuelAmount, getMergedCellSpan, mergeFuelRecapItems } from '@/utils/fuelRecap';
import FuelRecapMenu from '@/components/FuelRecapMenu';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const regions = ["Pusat", "Wilayah 1 Medan Utara", "Wilayah 2 Medan Barat", "Wilayah 3 Medan Timur", "Wilayah 4 Medan Kota", "Wilayah 5 Medan Selatan"];

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

type SignatureMode = "with-signature" | "without-signature";

const FuelYearlyRecap = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [selectedTeam, setSelectedTeam] = useState("semua");
  const [loginRegionName, setLoginRegionName] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("with-signature");
  const dataRequestId = useRef(0);

  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    region: true,
    team: true,
    vehicle: true,
    pertamax_rp: true,
    pertamax_ltr: true,
    dexlite_rp: true,
    dexlite_ltr: true,
    oli: true,
    item_remarks: true,
    location: true,
    remarks: true
  });
  const fuelRegionId = profile?.role !== 'admin' && (profile?.role === 'admin_bbm' || profile?.role === 'admin_rencana_kerja_bbm' || profile?.role === 'admin_wilayah_bbm') && !isGlobalFuelAdmin(profile?.role) ? profile.region_id || "__unassigned__" : null;
  const isRegularUser = profile?.role !== 'admin';
  const showRegion = visibleColumns.region && !isRegularUser;

  useEffect(() => {
    if (isRegularUser) setVisibleColumns(prev => ({ ...prev, region: false }));
  }, [isRegularUser]);

  useEffect(() => {
    if (!isRegularUser || !profile?.region_id) { setLoginRegionName(null); return; }
    let active = true;
    void supabase.from('regions').select('name').eq('id', profile.region_id).maybeSingle()
      .then(({ data }) => { if (active) setLoginRegionName(data?.name ?? null); });
    return () => { active = false; };
  }, [isRegularUser, profile?.region_id]);

  useEffect(() => {
    loadData();
  }, [selectedYear, fuelRegionId]);

  const loadData = async () => {
    const requestId = ++dataRequestId.current;
    try {
      setLoading(true);
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const filtered = await fuelService.getReportsByDateRange(startDate, endDate, fuelRegionId);
      filtered.sort((a, b) => a.date.localeCompare(b.date) || a.region.localeCompare(b.region) || a.team.localeCompare(b.team));
      if (requestId === dataRequestId.current) setReports(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === dataRequestId.current) setLoading(false);
    }
  };

  const getFilteredItems = () => {
    const flat = mergeFuelRecapItems(reports);
    return flat.filter(item =>
      (isRegularUser || selectedRegion === "semua" || item.region === selectedRegion)
      && (selectedTeam === "semua" || item.team === selectedTeam)
    );
  };

  const flatItems = getFilteredItems();

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const handleExportExcel = async () => {
    if (flatItems.length === 0) { showError("Tidak ada data untuk diekspor"); return; }
    const toastId = showLoading("Menyiapkan file Excel...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Tahunan BBM');
      const columns: any[] = [{ header: 'No', key: 'no', width: 5 }];
      if (visibleColumns.date) columns.push({ header: 'Tanggal', key: 'date', width: 14 });
      if (showRegion) columns.push({ header: 'Wilayah', key: 'region', width: 15 });
      if (visibleColumns.team) columns.push({ header: 'Tim', key: 'team', width: 18 });
      if (visibleColumns.vehicle) columns.push({ header: 'Kendaraan', key: 'vehicle', width: 24 });
      if (visibleColumns.pertamax_rp) columns.push({ header: 'Pertamax (Rp)', key: 'p_rp', width: 20 });
      if (visibleColumns.pertamax_ltr) columns.push({ header: 'Pertamax (Liter)', key: 'p_ltr', width: 12 });
      if (visibleColumns.dexlite_rp) columns.push({ header: 'Dexlite (Rp)', key: 'd_rp', width: 20 });
      if (visibleColumns.dexlite_ltr) columns.push({ header: 'Dexlite (Liter)', key: 'd_ltr', width: 12 });
      if (visibleColumns.oli) columns.push({ header: 'Oli (Liter)', key: 'oli', width: 12 });
      if (visibleColumns.item_remarks) columns.push({ header: 'Petugas', key: 'item_remarks', width: 20 });
      if (visibleColumns.location) columns.push({ header: 'Lokasi', key: 'location', width: 35 });
      if (visibleColumns.remarks) columns.push({ header: 'Ket. Umum', key: 'remarks', width: 25 });
      
      worksheet.columns = columns;
      const lastColLetter = String.fromCharCode(64 + columns.length);
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getCell('A1').value = 'PEMERINTAH KOTA MEDAN - DINAS LINGKUNGAN HIDUP';
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell('A2').value = `REKAP TAHUNAN BBM - TAHUN: ${selectedYear}`;
      worksheet.getCell('A2').font = { bold: true, size: 12 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      worksheet.addRow([]);
      
      const headerRow = worksheet.addRow(columns.map(c => c.header));
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.font = { bold: true };
      });

      flatItems.forEach((item, idx) => {
        const rowData: any = { no: idx + 1 };
        if (visibleColumns.date) rowData.date = format(parseISO(item.date), 'dd/MM/yy');
        if (showRegion) rowData.region = item.region;
        if (visibleColumns.team) rowData.team = item.team;
        if (visibleColumns.vehicle) rowData.vehicle = item.vehicle_operator;
        
        const p_rp = fuelAmount(item, 'Pertamax', 'rp');
        const p_ltr = fuelAmount(item, 'Pertamax', 'liter');
        const d_rp = fuelAmount(item, 'Dexlite', 'rp');
        const d_ltr = fuelAmount(item, 'Dexlite', 'liter');
        const o_ltr = fuelAmount(item, 'Oli', 'liter');

        if (visibleColumns.pertamax_rp) rowData.p_rp = p_rp;
        if (visibleColumns.pertamax_ltr) rowData.p_ltr = p_ltr;
        if (visibleColumns.dexlite_rp) rowData.d_rp = d_rp;
        if (visibleColumns.dexlite_ltr) rowData.d_ltr = d_ltr;
        if (visibleColumns.oli) rowData.oli = o_ltr;
        if (visibleColumns.item_remarks) rowData.item_remarks = item.item_remarks || "-";
        if (visibleColumns.location) rowData.location = `${item.location.street}${item.location.subDistrict ? ', ' + item.location.subDistrict : ''}`;
        if (visibleColumns.remarks) rowData.remarks = item.remarks || "-";

        const row = worksheet.addRow(rowData);
        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekap_Tahunan_BBM_DLH_${selectedYear}.xlsx`);
      dismissToast(toastId);
      showSuccess("Excel berhasil diunduh");
    } catch (error) {
      console.error(error);
      dismissToast(toastId);
      showError("Gagal membuat file Excel");
    }
  };

  const handleSharePdf = async () => {
    if (flatItems.length === 0) { showError("Tidak ada data untuk dibuatkan PDF"); return; }
    try { await openShareablePdfPreview({ fileName: `Rekap_Tahunan_BBM_${selectedYear}.pdf` }); }
    catch (error) { console.error(error); showError(error instanceof Error ? error.message : "PDF tidak dapat dibuat"); }
  };

  const groupedByRegion: Record<string, any[]> = {};
  flatItems.forEach(item => {
    if (!groupedByRegion[item.region]) groupedByRegion[item.region] = [];
    groupedByRegion[item.region].push(item);
  });

  const totalPertamaxRpAll = flatItems.reduce((acc, it) => acc + fuelAmount(it, 'Pertamax', 'rp'), 0);
  const totalPertamaxLtrAll = flatItems.reduce((acc, it) => acc + fuelAmount(it, 'Pertamax', 'liter'), 0);
  const totalDexliteRpAll = flatItems.reduce((acc, it) => acc + fuelAmount(it, 'Dexlite', 'rp'), 0);
  const totalDexliteLtrAll = flatItems.reduce((acc, it) => acc + fuelAmount(it, 'Dexlite', 'liter'), 0);
  const totalOliAll = flatItems.reduce((acc, it) => acc + fuelAmount(it, 'Oli', 'liter'), 0);

  const teamOptions = Array.from(new Set(reports.map(report => report.team))).sort();
  const bbmColCount = (visibleColumns.pertamax_rp ? 1 : 0) + (visibleColumns.pertamax_ltr ? 1 : 0) + (visibleColumns.dexlite_rp ? 1 : 0) + (visibleColumns.dexlite_ltr ? 1 : 0) + (visibleColumns.oli ? 1 : 0);
  const tableColumnCount = 1 + (visibleColumns.date ? 1 : 0) + (showRegion ? 1 : 0) + (visibleColumns.team ? 1 : 0) + (visibleColumns.vehicle ? 1 : 0) + bbmColCount + (visibleColumns.location ? 1 : 0) + (visibleColumns.remarks ? 1 : 0);
  const leadingCols = 1 + (visibleColumns.date ? 1 : 0) + (showRegion ? 1 : 0) + (visibleColumns.team ? 1 : 0) + (visibleColumns.vehicle ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-3 no-print mb-8 p-3 sm:p-4 bg-white rounded-2xl shadow-sm border">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/?tab=fuel_reports')} aria-label="Kembali" title="Kembali" className="h-10 w-10 rounded-xl p-0 sm:w-auto sm:px-3"><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Kembali</span></Button>
            <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="w-[120px] md:w-[150px]"><SelectValue placeholder="Tahun" /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
            {isRegularUser ? <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200"><Filter className="mr-2 h-4 w-4 text-slate-400" /><SelectValue placeholder="Pilih Tim" /></SelectTrigger>
              <SelectContent><SelectItem value="semua">Semua Tim / Kategori</SelectItem>{teamOptions.map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}</SelectContent>
            </Select> : <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200"><Filter className="mr-2 h-4 w-4 text-slate-400" /><SelectValue placeholder="Pilih Wilayah" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Wilayah</SelectItem>
                {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>}
          </div>
          <div className="flex w-full items-center justify-end gap-2 xl:w-auto">
            <Select value={signatureMode} onValueChange={(v) => setSignatureMode(v as SignatureMode)}>
              <SelectTrigger aria-label="Pengaturan tanda tangan" title="Pengaturan tanda tangan" className="h-10 w-10 shrink-0 justify-center rounded-xl border-amber-200 bg-amber-50 p-0 font-medium text-amber-700 sm:w-[180px] sm:px-3">
                <div className="flex items-center gap-2">
                  <PenTool size={16} />
                  <span className="hidden sm:inline"><SelectValue placeholder="Tanda Tangan" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-signature">Ada Tanda Tangan</SelectItem>
                <SelectItem value="without-signature">Tanpa Tanda Tangan</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-label="Pilih kolom" title="Pilih kolom" className="h-10 w-10 shrink-0 rounded-xl border-blue-200 bg-white p-0 text-blue-600 hover:bg-blue-50 sm:w-auto sm:px-3">
                  <Settings2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Pilih Kolom</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tampilkan Kolom:</p>
                  {Object.entries({
                    date: "Tanggal",
                    ...(isRegularUser ? {} : { region: "Wilayah" }),
                    team: "Tim",
                    vehicle: "Kendaraan",
                    pertamax_rp: "Pertamax (Rp)",
                    pertamax_ltr: "Pertamax (Liter)",
                    dexlite_rp: "Dexlite (Rp)",
                    dexlite_ltr: "Dexlite (Liter)",
                    oli: "Oli",
                    item_remarks: "Petugas",
                    location: "Lokasi",
                    remarks: "Ket. Umum"
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`col-${key}`} 
                        checked={visibleColumns[key as keyof typeof visibleColumns]} 
                        onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                      />
                      <Label htmlFor={`col-${key}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <FuelRecapMenu signatureMode={signatureMode} onSignatureChange={setSignatureMode} onPrint={() => window.print()} onSharePdf={handleSharePdf} onExportExcel={handleExportExcel} editItems={reports.map(report => ({ id: report.id, label: `${report.date} — ${report.team}` }))} />
          </div>
        </div>
      </div>

        <div className="print-area recap-print-area bg-white p-4 md:p-10 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
          <img src={LOGO_MEDAN_URL} className="h-12 w-12 md:h-20 md:w-20 object-contain" alt="Logo Medan" />
          <div className="text-center"><h1 className="text-sm md:text-xl font-bold uppercase">Pemerintah Kota Medan</h1><h2 className="text-base md:text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2><p className="text-[8px] md:text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p></div>
          <img src={LOGO_DLH_URL} className="h-12 w-12 md:h-20 md:w-20 object-contain" alt="Logo DLH" />
        </div>
        <div className="text-center mb-8"><h3 className="text-base md:text-xl font-bold underline uppercase text-orange-700">REKAP TAHUNAN PEMAKAIAN BBM & OLI</h3>{isRegularUser && loginRegionName && <p className="text-base md:text-xl font-black uppercase text-slate-600">{loginRegionName}</p>}{!isRegularUser && selectedRegion !== "semua" && <p className="text-base md:text-xl font-black uppercase text-slate-600">{selectedRegion}</p>}<p className="text-sm md:text-base font-bold">Tahun: {selectedYear}</p>{isRegularUser && selectedTeam !== "semua" && <p className="text-sm font-bold uppercase text-slate-500">Tim: {selectedTeam}</p>}</div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse border-2 border-black text-[9px] table-auto">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-2 border-black p-1 w-[30px]" rowSpan={bbmColCount > 0 ? 2 : 1}>No</th>
                {visibleColumns.date && <th className="border-2 border-black p-1 w-[55px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Tanggal</th>}
                {showRegion && <th className="border-2 border-black p-1 w-[80px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Wilayah</th>}
                {visibleColumns.team && <th className="border-2 border-black p-1 w-[80px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Tim / Operator</th>}
                {visibleColumns.vehicle && <th className="border-2 border-black p-1 w-[100px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Kendaraan</th>}
                {bbmColCount > 0 && <th className="border-2 border-black p-1" colSpan={bbmColCount}>Jenis BBM / Oli</th>}
                {visibleColumns.item_remarks && <th className="border-2 border-black p-1 w-[100px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Petugas</th>}
                {visibleColumns.location && <th className="border-2 border-black p-1 w-[120px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Lokasi</th>}
                {visibleColumns.remarks && <th className="border-2 border-black p-1 w-[120px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Ket. Umum</th>}
              </tr>
              {bbmColCount > 0 && (
                <tr className="bg-slate-50">
                  {visibleColumns.pertamax_rp && <th className="border-2 border-black p-1 text-center leading-tight">Pertamax<br/>(Rp)</th>}
                  {visibleColumns.pertamax_ltr && <th className="border-2 border-black p-1 text-center leading-tight">Pertamax<br/>(Liter)</th>}
                  {visibleColumns.dexlite_rp && <th className="border-2 border-black p-1 text-center leading-tight">Dexlite<br/>(Rp)</th>}
                  {visibleColumns.dexlite_ltr && <th className="border-2 border-black p-1 text-center leading-tight">Dexlite<br/>(Liter)</th>}
                  {visibleColumns.oli && <th className="border-2 border-black p-1 text-center leading-tight">Oli<br/>(Liter)</th>}
                </tr>
              )}
            </thead>
            <tbody>
              {Object.keys(groupedByRegion).length > 0 ? (
                <>
                  {Object.entries(groupedByRegion).map(([regionName, items], rIdx) => {
                    const subPertamaxRp = items.reduce((acc, it) => acc + fuelAmount(it, 'Pertamax', 'rp'), 0);
                    const subPertamaxLtr = items.reduce((acc, it) => acc + fuelAmount(it, 'Pertamax', 'liter'), 0);
                    const subDexliteRp = items.reduce((acc, it) => acc + fuelAmount(it, 'Dexlite', 'rp'), 0);
                    const subDexliteLtr = items.reduce((acc, it) => acc + fuelAmount(it, 'Dexlite', 'liter'), 0);
                    const subOli = items.reduce((acc, it) => acc + fuelAmount(it, 'Oli', 'liter'), 0);

                    return (
                      <React.Fragment key={regionName}>
                        {items.map((item, idx) => (
                          <tr key={`${regionName}-${idx}`}>
                            {getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-center align-middle">{idx + 1}</td>}
                            {visibleColumns.date && <td className="border-2 border-black p-1 text-center leading-tight">{format(parseISO(item.date), 'dd/MM/yy')}</td>}
                            {showRegion && idx === 0 && (<td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={items.length}>{item.region}</td>)}
                            {visibleColumns.team && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-center align-middle whitespace-normal break-words leading-tight">{item.team}</td>}
                            {visibleColumns.vehicle && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 whitespace-normal break-words font-medium leading-tight">{item.vehicle_operator}</td>}
                            
                            {visibleColumns.pertamax_rp && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-right whitespace-nowrap">{fuelAmount(item, 'Pertamax', 'rp') ? fuelAmount(item, 'Pertamax', 'rp').toLocaleString('id-ID') : "-"}</td>}
                            {visibleColumns.pertamax_ltr && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-center whitespace-nowrap">{fuelAmount(item, 'Pertamax', 'liter') || "-"}</td>}
                            {visibleColumns.dexlite_rp && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-right whitespace-nowrap">{fuelAmount(item, 'Dexlite', 'rp') ? fuelAmount(item, 'Dexlite', 'rp').toLocaleString('id-ID') : "-"}</td>}
                            {visibleColumns.dexlite_ltr && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-center whitespace-nowrap">{fuelAmount(item, 'Dexlite', 'liter') || "-"}</td>}
                            {visibleColumns.oli && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 text-center whitespace-nowrap">{fuelAmount(item, 'Oli', 'liter') || "-"}</td>}
                            
                            {visibleColumns.item_remarks && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 whitespace-normal break-words leading-tight">{item.item_remarks || "-"}</td>}
                            {visibleColumns.location && <td className="border-2 border-black p-1 whitespace-normal break-words leading-tight">{item.location.street}{item.location.subDistrict && item.location.subDistrict !== " " ? `, ${item.location.subDistrict}` : ""}</td>}
                            {visibleColumns.remarks && getMergedCellSpan(items, idx, item => item.reportId || '') > 0 && <td rowSpan={getMergedCellSpan(items, idx, item => item.reportId || '')} className="border-2 border-black p-1 italic align-middle whitespace-normal break-words leading-tight">{item.remarks || "-"}</td>}
                          </tr>
                        ))}
                        {!isRegularUser && selectedRegion === "semua" && (
                          <tr className="bg-slate-50 font-bold italic">
                            <td className="border-2 border-black p-1 text-right" colSpan={leadingCols}>SUB-TOTAL {regionName.toUpperCase()}:</td>
                            {visibleColumns.pertamax_rp && <td className="border-2 border-black p-1 text-right whitespace-nowrap">{subPertamaxRp.toLocaleString('id-ID')}</td>}
                            {visibleColumns.pertamax_ltr && <td className="border-2 border-black p-1 text-center whitespace-nowrap">{subPertamaxLtr.toFixed(2)}</td>}
                            {visibleColumns.dexlite_rp && <td className="border-2 border-black p-1 text-right whitespace-nowrap">{subDexliteRp.toLocaleString('id-ID')}</td>}
                            {visibleColumns.dexlite_ltr && <td className="border-2 border-black p-1 text-center whitespace-nowrap">{subDexliteLtr.toFixed(2)}</td>}
                            {visibleColumns.oli && <td className="border-2 border-black p-1 text-center whitespace-nowrap">{subOli.toFixed(2)}</td>}
                            <td className="border-2 border-black p-1" colSpan={(visibleColumns.item_remarks ? 1 : 0) + (visibleColumns.location ? 1 : 0) + (visibleColumns.remarks ? 1 : 0)}></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-100 font-black text-sm">
                    <td className="border-2 border-black p-2 text-right" colSpan={leadingCols}>TOTAL KESELURUHAN:</td>
                    {visibleColumns.pertamax_rp && <td className="border-2 border-black p-2 text-right whitespace-nowrap">{totalPertamaxRpAll.toLocaleString('id-ID')}</td>}
                    {visibleColumns.pertamax_ltr && <td className="border-2 border-black p-2 text-center whitespace-nowrap">{totalPertamaxLtrAll.toFixed(2)}</td>}
                    {visibleColumns.dexlite_rp && <td className="border-2 border-black p-2 text-right whitespace-nowrap">{totalDexliteRpAll.toLocaleString('id-ID')}</td>}
                    {visibleColumns.dexlite_ltr && <td className="border-2 border-black p-2 text-center whitespace-nowrap">{totalDexliteLtrAll.toFixed(2)}</td>}
                    {visibleColumns.oli && <td className="border-2 border-black p-2 text-center whitespace-nowrap">{totalOliAll.toFixed(2)}</td>}
                    <td className="border-2 border-black p-2" colSpan={(visibleColumns.item_remarks ? 1 : 0) + (visibleColumns.location ? 1 : 0) + (visibleColumns.remarks ? 1 : 0)}></td>
                  </tr>
                </>
              ) : (
                <tr><td colSpan={tableColumnCount} className="border-2 border-black p-8 text-center italic text-slate-400">{loading ? 'Memuat data rekap...' : 'Tidak ada data untuk periode ini'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {signatureMode === "with-signature" && (
          <div className="mt-12">
            <div className="flex justify-end mb-2 text-[10px]"><p className="w-1/2 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
            <div className="grid grid-cols-2 gap-4 text-[10px] leading-normal">
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div></div>
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div></div>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print, [data-radix-portal], [role="menu"], [data-radix-popper-content-wrapper], .sonner-toaster { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
          @page { size: landscape; margin: 1cm; }
          .overflow-x-auto { overflow: visible !important; }
          table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: fixed !important;
          }
          th, td {
            box-sizing: border-box !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
          }
          @page { size: A3 landscape; margin: 10mm; }
        }
      `}} />
    </div>
  );
};

export default FuelYearlyRecap;
