"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuelService } from '@/services/fuelService';
import { FuelReport } from '@/types/fuelReport';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Calendar as CalendarIcon, Table, Filter, Settings2, PenTool, ChevronDown, FileText, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

const regions = ["Pusat", "Wilayah 1 Medan Utara", "Wilayah 2 Medan Barat", "Wilayah 3 Medan Timur", "Wilayah 4 Medan Kota", "Wilayah 5 Medan Selatan"];

type SignatureMode = "with-signature" | "without-signature";

const FuelWeeklyRecap = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("with-signature");

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
    location: true,
    remarks: true
  });

  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const startDateStr = format(weekStart, 'yyyy-MM-dd');
      const endDateStr = format(weekEnd, 'yyyy-MM-dd');
      const filtered = await fuelService.getReportsByDateRange(startDateStr, endDateStr);
      filtered.sort((a, b) => a.date.localeCompare(b.date) || a.region.localeCompare(b.region) || a.team.localeCompare(b.team));
      setReports(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredItems = () => {
    const flat = reports.flatMap(r => r.items.map(item => ({ 
      ...item, 
      date: r.date, 
      region: r.region, 
      team: r.team, 
      remarks: r.remarks,
      reportId: r.id
    })));
    if (selectedRegion === "semua") return flat;
    return flat.filter(item => item.region === selectedRegion);
  };

  const flatItems = getFilteredItems();

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const handleExportExcel = async () => {
    if (flatItems.length === 0) {
      showError("Tidak ada data untuk diekspor");
      return;
    }
    const toastId = showLoading("Menyiapkan file Excel...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Mingguan BBM');
      const columns: any[] = [{ header: 'No', key: 'no', width: 5 }];
      if (visibleColumns.date) columns.push({ header: 'Tanggal', key: 'date', width: 14 });
      if (visibleColumns.region) columns.push({ header: 'Wilayah', key: 'region', width: 15 });
      if (visibleColumns.team) columns.push({ header: 'Tim / Operator', key: 'team', width: 18 });
      if (visibleColumns.vehicle) columns.push({ header: 'Kendaraan', key: 'vehicle', width: 24 });
      if (visibleColumns.pertamax_rp) columns.push({ header: 'Pertamax (Rp)', key: 'p_rp', width: 15 });
      if (visibleColumns.pertamax_ltr) columns.push({ header: 'Pertamax (Liter)', key: 'p_ltr', width: 10 });
      if (visibleColumns.dexlite_rp) columns.push({ header: 'Dexlite (Rp)', key: 'd_rp', width: 15 });
      if (visibleColumns.dexlite_ltr) columns.push({ header: 'Dexlite (Liter)', key: 'd_ltr', width: 10 });
      if (visibleColumns.oli) columns.push({ header: 'Oli (Liter)', key: 'oli', width: 10 });
      if (visibleColumns.location) columns.push({ header: 'Lokasi Kerja', key: 'location', width: 35 });
      if (visibleColumns.remarks) columns.push({ header: 'Ket. Umum', key: 'remarks', width: 25 });
      
      worksheet.columns = columns;
      const lastColLetter = String.fromCharCode(64 + columns.length);
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getCell('A1').value = 'PEMERINTAH KOTA MEDAN - DINAS LINGKUNGAN HIDUP';
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell('A2').value = `REKAP MINGGUAN PEMAKAIAN BBM - PERIODE: ${format(weekStart, 'dd MMM')} s/d ${format(weekEnd, 'dd MMM yyyy')}`;
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
        if (visibleColumns.region) rowData.region = item.region;
        if (visibleColumns.team) rowData.team = item.team;
        if (visibleColumns.vehicle) rowData.vehicle = item.vehicle_operator;
        
        const p_rp = item.fuel_type === 'Pertamax' ? (item.amount_rp || item.amount) : 0;
        const p_ltr = item.fuel_type === 'Pertamax' ? (item.amount_liter || 0) : 0;
        const d_rp = item.fuel_type === 'Dexlite' ? (item.amount_rp || item.amount) : 0;
        const d_ltr = item.fuel_type === 'Dexlite' ? (item.amount_liter || 0) : 0;
        const o_ltr = item.fuel_type === 'Oli' ? (item.amount_liter || item.amount) : 0;

        if (visibleColumns.pertamax_rp) rowData.p_rp = p_rp;
        if (visibleColumns.pertamax_ltr) rowData.p_ltr = p_ltr;
        if (visibleColumns.dexlite_rp) rowData.d_rp = d_rp;
        if (visibleColumns.dexlite_ltr) rowData.d_ltr = d_ltr;
        if (visibleColumns.oli) rowData.oli = o_ltr;
        if (visibleColumns.location) rowData.location = `${item.location.street}${item.location.subDistrict ? ', ' + item.location.subDistrict : ''}`;
        if (visibleColumns.remarks) rowData.remarks = item.remarks || "-";

        const row = worksheet.addRow(rowData);
        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekap_Mingguan_BBM_DLH_${format(weekStart, 'yyyy-MM-dd')}.xlsx`);
      dismissToast(toastId);
      showSuccess("Excel berhasil diunduh");
    } catch (error) {
      console.error(error);
      dismissToast(toastId);
      showError("Gagal membuat file Excel");
    }
  };

  const groupedByRegion: Record<string, any[]> = {};
  flatItems.forEach(item => {
    if (!groupedByRegion[item.region]) groupedByRegion[item.region] = [];
    groupedByRegion[item.region].push(item);
  });

  const totalPertamaxRpAll = flatItems.reduce((acc, item) => acc + (item.fuel_type === 'Pertamax' ? (item.amount_rp || item.amount) : 0), 0);
  const totalPertamaxLtrAll = flatItems.reduce((acc, item) => acc + (item.fuel_type === 'Pertamax' ? (item.amount_liter || 0) : 0), 0);
  const totalDexliteRpAll = flatItems.reduce((acc, item) => acc + (item.fuel_type === 'Dexlite' ? (item.amount_rp || item.amount) : 0), 0);
  const totalDexliteLtrAll = flatItems.reduce((acc, item) => acc + (item.fuel_type === 'Dexlite' ? (item.amount_liter || 0) : 0), 0);
  const totalOliAll = flatItems.reduce((acc, item) => acc + (item.fuel_type === 'Oli' ? (item.amount_liter || item.amount) : 0), 0);

  const bbmColCount = (visibleColumns.pertamax_rp ? 1 : 0) + (visibleColumns.pertamax_ltr ? 1 : 0) + (visibleColumns.dexlite_rp ? 1 : 0) + (visibleColumns.dexlite_ltr ? 1 : 0) + (visibleColumns.oli ? 1 : 0);
  const leadingCols = 1 + (visibleColumns.date ? 1 : 0) + (visibleColumns.region ? 1 : 0) + (visibleColumns.team ? 1 : 0) + (visibleColumns.vehicle ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <Button variant="ghost" onClick={() => navigate('/fuel-reports')} className="h-9 px-3">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 shadow-sm">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span className="text-xs md:text-sm font-bold text-blue-700">
                {format(weekStart, 'dd MMM', { locale: localeId })} - {format(weekEnd, 'dd MMM yyyy', { locale: localeId })}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-auto">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="pl-10 w-full md:w-[180px] h-10 bg-slate-50" 
                />
              </div>
              
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-full md:w-[180px] h-10 bg-slate-50 border-slate-200">
                  <Filter className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Pilih Wilayah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Wilayah</SelectItem>
                  {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={signatureMode} onValueChange={(v) => setSignatureMode(v as SignatureMode)}>
                <SelectTrigger className="flex-1 md:w-[160px] bg-amber-50 border-amber-200 h-10 text-amber-700 font-medium px-3">
                  <div className="flex items-center gap-2">
                    <PenTool size={16} />
                    <span className="text-xs md:text-sm"><SelectValue placeholder="Tanda Tangan" /></span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with-signature">Ada Tanda Tangan</SelectItem>
                  <SelectItem value="without-signature">Tanpa Tanda Tangan</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 md:w-auto bg-white border-blue-200 text-blue-600 hover:bg-blue-50 h-10">
                    <Settings2 className="mr-2 h-4 w-4" /> Pilih Kolom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tampilkan Kolom:</p>
                    {Object.entries({ date: "Tanggal", region: "Wilayah", team: "Tim", vehicle: "Kendaraan", pertamax_rp: "Pertamax (Rp)", pertamax_ltr: "Pertamax (Liter)", dexlite_rp: "Dexlite (Rp)", dexlite_ltr: "Dexlite (Liter)", oli: "Oli", location: "Lokasi", remarks: "Ket. Umum" }).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-2"><Checkbox id={`col-${key}`} checked={visibleColumns[key as keyof typeof visibleColumns]} onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)} /><Label htmlFor={`col-${key}`} className="text-sm cursor-pointer">{label}</Label></div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 md:w-auto bg-blue-600 hover:bg-blue-700 h-10 px-4 shadow-md">
                    <Printer className="h-4 w-4 mr-2" /> 
                    <span className="text-xs md:text-sm font-bold">Cetak Rekap</span>
                    <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer py-2">
                    <Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer py-2">
                    <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Excel
                  </DropdownMenuItem>
                  <div className="h-px bg-slate-100 my-1" />
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/daily-rekap')} className="cursor-pointer py-2">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/weekly-rekap')} className="cursor-pointer py-2">
                    <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/monthly-rekap')} className="cursor-pointer py-2">
                    <FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/yearly-rekap')} className="cursor-pointer py-2">
                    <CalendarDays className="mr-2 h-4 w-4 text-red-500" /> Rekap Tahunan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="print-area bg-white p-4 md:p-10 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
          <img src={LOGO_MEDAN_URL} className="h-12 w-12 md:h-20 md:w-20 object-contain" alt="Logo Medan" />
          <div className="text-center"><h1 className="text-sm md:text-xl font-bold uppercase">Pemerintah Kota Medan</h1><h2 className="text-base md:text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2><p className="text-[8px] md:text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p></div>
          <img src={LOGO_DLH_URL} className="h-12 w-12 md:h-20 md:w-20 object-contain" alt="Logo DLH" />
        </div>
        <div className="text-center mb-8"><h3 className="text-base md:text-xl font-bold underline uppercase text-orange-700">REKAP MINGGUAN PEMAKAIAN BBM & OLI</h3><p className="text-sm md:text-lg font-bold">Periode: {format(weekStart, 'dd MMMM', { locale: localeId })} s/d {format(weekEnd, 'dd MMMM yyyy', { locale: localeId })}</p>{selectedRegion !== "semua" && <p className="text-sm font-bold uppercase text-slate-500">{selectedRegion}</p>}</div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse border-2 border-black text-[9px] table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-2 border-black p-1 w-[30px]" rowSpan={bbmColCount > 0 ? 2 : 1}>No</th>
                {visibleColumns.date && <th className="border-2 border-black p-1 w-[55px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Tanggal</th>}
                {visibleColumns.region && <th className="border-2 border-black p-1 w-[80px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Wilayah</th>}
                {visibleColumns.team && <th className="border-2 border-black p-1 w-[75px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Tim / Operator</th>}
                {visibleColumns.vehicle && <th className="border-2 border-black p-1 w-[125px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Kendaraan / Alat Operasional</th>}
                {bbmColCount > 0 && <th className="border-2 border-black p-1" colSpan={bbmColCount}>Jenis BBM / Oli</th>}
                {visibleColumns.location && <th className="border-2 border-black p-1 w-[180px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Lokasi Kerja</th>}
                {visibleColumns.remarks && <th className="border-2 border-black p-1 w-[120px]" rowSpan={bbmColCount > 0 ? 2 : 1}>Ket. Umum</th>}
              </tr>
              {bbmColCount > 0 && (
                <tr className="bg-slate-50">
                  {visibleColumns.pertamax_rp && <th className="border-2 border-black p-1 w-[85px] text-center leading-tight">Pertamax<br/>(Rp)</th>}
                  {visibleColumns.pertamax_ltr && <th className="border-2 border-black p-1 w-[65px] text-center leading-tight">Pertamax<br/>(Liter)</th>}
                  {visibleColumns.dexlite_rp && <th className="border-2 border-black p-1 w-[85px] text-center leading-tight">Dexlite<br/>(Rp)</th>}
                  {visibleColumns.dexlite_ltr && <th className="border-2 border-black p-1 w-[65px] text-center leading-tight">Dexlite<br/>(Liter)</th>}
                  {visibleColumns.oli && <th className="border-2 border-black p-1 w-[65px] text-center leading-tight">Oli<br/>(Liter)</th>}
                </tr>
              )}
            </thead>
            <tbody>
              {Object.keys(groupedByRegion).length > 0 ? (
                <>
                  {Object.entries(groupedByRegion).map(([regionName, items], rIdx) => {
                    const subPertamaxRp = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? (it.amount_rp || it.amount) : 0), 0);
                    const subPertamaxLtr = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? (it.amount_liter || 0) : 0), 0);
                    const subDexliteRp = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? (it.amount_rp || it.amount) : 0), 0);
                    const subDexliteLtr = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? (it.amount_liter || 0) : 0), 0);
                    const subOli = items.reduce((acc, it) => acc + (it.fuel_type === 'Oli' ? (it.amount_liter || it.amount) : 0), 0);

                    return (
                      <React.Fragment key={regionName}>
                        {items.map((item, idx) => (
                          <tr key={`${regionName}-${idx}`}>
                            <td className="border-2 border-black p-1 text-center">{idx + 1}</td>
                            {visibleColumns.date && <td className="border-2 border-black p-1 text-center leading-tight">{format(parseISO(item.date), 'dd/MM/yy')}</td>}
                            {visibleColumns.region && idx === 0 && (<td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={items.length}>{item.region}</td>)}
                            {visibleColumns.team && <td className="border-2 border-black p-1 text-center align-middle whitespace-normal break-words leading-tight">{item.team}</td>}
                            {visibleColumns.vehicle && <td className="border-2 border-black p-1 whitespace-normal break-words font-medium leading-tight">{item.vehicle_operator}</td>}
                            
                            {visibleColumns.pertamax_rp && <td className="border-2 border-black p-1 text-right">{item.fuel_type === 'Pertamax' ? (item.amount_rp || item.amount).toLocaleString('id-ID') : "-"}</td>}
                            {visibleColumns.pertamax_ltr && <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Pertamax' ? (item.amount_liter || "-") : "-"}</td>}
                            {visibleColumns.dexlite_rp && <td className="border-2 border-black p-1 text-right">{item.fuel_type === 'Dexlite' ? (item.amount_rp || item.amount).toLocaleString('id-ID') : "-"}</td>}
                            {visibleColumns.dexlite_ltr && <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Dexlite' ? (item.amount_liter || "-") : "-"}</td>}
                            {visibleColumns.oli && <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Oli' ? (item.amount_liter || item.amount) : "-"}</td>}
                            
                            {visibleColumns.location && <td className="border-2 border-black p-1 whitespace-normal break-words leading-tight">{item.location.street}{item.location.subDistrict && item.location.subDistrict !== " " ? `, ${item.location.subDistrict}` : ""}</td>}
                            {visibleColumns.remarks && <td className="border-2 border-black p-1 italic align-middle whitespace-normal break-words leading-tight">{item.remarks || "-"}</td>}
                          </tr>
                        ))}
                        {selectedRegion === "semua" && (
                          <tr className="bg-slate-50 font-bold italic">
                            <td className="border-2 border-black p-1 text-right" colSpan={leadingCols}>SUB-TOTAL {regionName.toUpperCase()}:</td>
                            {visibleColumns.pertamax_rp && <td className="border-2 border-black p-1 text-right">{subPertamaxRp.toLocaleString('id-ID')}</td>}
                            {visibleColumns.pertamax_ltr && <td className="border-2 border-black p-1 text-center">{subPertamaxLtr.toFixed(2)}</td>}
                            {visibleColumns.dexlite_rp && <td className="border-2 border-black p-1 text-right">{subDexliteRp.toLocaleString('id-ID')}</td>}
                            {visibleColumns.dexlite_ltr && <td className="border-2 border-black p-1 text-center">{subDexliteLtr.toFixed(2)}</td>}
                            {visibleColumns.oli && <td className="border-2 border-black p-1 text-center">{subOli}</td>}
                            <td className="border-2 border-black p-1" colSpan={(visibleColumns.location ? 1 : 0) + (visibleColumns.remarks ? 1 : 0)}></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-100 font-black text-sm">
                    <td className="border-2 border-black p-2 text-right" colSpan={leadingCols}>TOTAL KESELURUHAN:</td>
                    {visibleColumns.pertamax_rp && <td className="border-2 border-black p-2 text-right">{totalPertamaxRpAll.toLocaleString('id-ID')}</td>}
                    {visibleColumns.pertamax_ltr && <td className="border-2 border-black p-2 text-center">{totalPertamaxLtrAll.toFixed(2)}</td>}
                    {visibleColumns.dexlite_rp && <td className="border-2 border-black p-2 text-right">{totalDexliteRpAll.toLocaleString('id-ID')}</td>}
                    {visibleColumns.dexlite_ltr && <td className="border-2 border-black p-2 text-center">{totalDexliteLtrAll.toFixed(2)}</td>}
                    {visibleColumns.oli && <td className="border-2 border-black p-2 text-center">{totalOliAll}</td>}
                    <td className="border-2 border-black p-2" colSpan={(visibleColumns.location ? 1 : 0) + (visibleColumns.remarks ? 1 : 0)}></td>
                  </tr>
                </>
              ) : (
                <tr><td colSpan={11} className="border-2 border-black p-8 text-center italic text-slate-400">Tidak ada data untuk periode ini</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {signatureMode === "with-signature" && (
          <div className="mt-12">
            <div className="flex justify-end mb-4 text-[10px]"><p className="w-1/4 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
            <div className="grid grid-cols-4 gap-4 text-[10px] leading-normal">
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div></div>
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div></div>
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Pengawas Taman Penghijauan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Jhosua Sibarani, S.T</p><p>NIP. 19740907 200903 1 002</p></div></div>
              <div className="text-center flex flex-col justify-between min-h-[180px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Koordinator Laporan BBM</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Ardiansyah Siregar</p><p>NIP. 19860404 201001 1 015</p></div></div>
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
          table { width: 100% !important; min-width: 0 !important; }
        }
      `}} />
    </div>
  );
};

export default FuelWeeklyRecap;