"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuelSpjService } from '@/services/fuelSpjService';
import { FuelSpjReport } from '@/types/fuelSpjReport';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Calendar as CalendarIcon, Settings2, Filter, Table, ChevronDown, FileText, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const FuelSpjWeeklyRecap = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [reports, setReports] = useState<FuelSpjReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRegion, setSelectedRegion] = useState("semua");
  const [groupBy, setGroupBy] = useState<"region" | "team">("region");
  
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    spj_no: true,
    region: true,
    team: false,
    vehicle: true,
    fuel: true,
    remarks: true,
    receiver: true,
    location: true
  });

  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const isAllowed = profile?.role === 'admin' || profile?.role === 'admin_spj_bbm' || profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');

  useEffect(() => {
    if (isAllowed) loadData();
  }, [selectedDate, isAllowed]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fuelSpjService.getAllReports();
      const filtered = data.filter(r => {
        const rDate = parseISO(r.date);
        return isWithinInterval(rDate, { start: weekStart, end: weekEnd });
      });
      setReports(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const getFilteredItems = () => {
    const flat = reports.flatMap(r => 
      r.entries.flatMap(entry => 
        entry.locations.map(loc => ({
          date: r.date,
          region: r.region,
          team: r.team || "-",
          spj_no: entry.spj_no,
          vehicle: entry.vehicle_operator,
          receiver: entry.receiver_name,
          ...loc
        }))
      )
    );
    
    if (selectedRegion === "semua") return flat;
    return flat.filter(item => item.region === selectedRegion);
  };

  const flatItems = getFilteredItems();

  const groupedData: Record<string, any[]> = {};
  flatItems.forEach(item => {
    const key = groupBy === "region" ? item.region : item.team;
    if (!groupedData[key]) groupedData[key] = [];
    groupedData[key].push(item);
  });

  const totalPertamaxRp = flatItems.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_rp : 0), 0);
  const totalPertamaxLtr = flatItems.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_liter : 0), 0);
  const totalDexliteRp = flatItems.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_rp : 0), 0);
  const totalDexliteLtr = flatItems.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_liter : 0), 0);
  const totalOliLtr = flatItems.reduce((acc, it) => acc + (it.fuel_type === 'Oli' ? it.amount_liter : 0), 0);

  const handleExportExcel = async () => {
    if (flatItems.length === 0) {
      showError("Tidak ada data untuk diekspor");
      return;
    }
    const toastId = showLoading("Menyiapkan file Excel...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Mingguan SPJ');
      
      const columns: any[] = [{ header: 'No', key: 'no', width: 5 }];
      if (visibleColumns.date) columns.push({ header: 'Tgl', key: 'date', width: 10 });
      if (visibleColumns.spj_no) columns.push({ header: 'No. SPJ', key: 'spj_no', width: 15 });
      if (visibleColumns.region) columns.push({ header: 'Wilayah', key: 'region', width: 15 });
      if (visibleColumns.team) columns.push({ header: 'Tim / Operator', key: 'team', width: 18 });
      if (visibleColumns.vehicle) columns.push({ header: 'Kendaraan', key: 'vehicle', width: 24 });
      if (visibleColumns.fuel) {
        columns.push(
          { header: 'Pertamax (Rp)', key: 'p_rp', width: 15 },
          { header: 'Ltr', key: 'p_ltr', width: 8 },
          { header: 'Dexlite (Rp)', key: 'd_rp', width: 15 },
          { header: 'Ltr', key: 'd_ltr', width: 8 },
          { header: 'Oli (L)', key: 'o_ltr', width: 8 }
        );
      }
      if (visibleColumns.remarks) columns.push({ header: 'Keterangan', key: 'remarks', width: 25 });
      if (visibleColumns.receiver) columns.push({ header: 'Penerima', key: 'receiver', width: 20 });
      if (visibleColumns.location) columns.push({ header: 'Lokasi', key: 'location', width: 35 });

      worksheet.columns = columns;
      
      const lastColLetter = String.fromCharCode(64 + columns.length);
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getCell('A1').value = 'PEMERINTAH KOTA MEDAN - DINAS LINGKUNGAN HIDUP';
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell('A2').value = `REKAP MINGGUAN SPJ BBM - PERIODE: ${format(weekStart, 'dd MMM')} s/d ${format(weekEnd, 'dd MMM yyyy')}`;
      worksheet.getCell('A2').font = { bold: true, size: 12 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      worksheet.addRow([]);
      
      const headerRow = worksheet.addRow(columns.map(c => c.header));
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true };
      });

      Object.entries(groupedData).forEach(([groupName, items]) => {
        const groupRow = worksheet.addRow([`${groupBy.toUpperCase()}: ${groupName.toUpperCase()}`]);
        worksheet.mergeCells(groupRow.number, 1, groupRow.number, columns.length);
        groupRow.getCell(1).font = { bold: true };
        groupRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };

        items.forEach((item, idx) => {
          const rowData: any = { no: idx + 1 };
          if (visibleColumns.date) rowData.date = format(parseISO(item.date), 'dd/MM');
          if (visibleColumns.spj_no) rowData.spj_no = item.spj_no;
          if (visibleColumns.region) rowData.region = item.region;
          if (visibleColumns.team) rowData.team = item.team;
          if (visibleColumns.vehicle) rowData.vehicle = item.vehicle;
          if (visibleColumns.fuel) {
            rowData.p_rp = item.fuel_type === 'Pertamax' ? item.amount_rp : 0;
            rowData.p_ltr = item.fuel_type === 'Pertamax' ? item.amount_liter : 0;
            rowData.d_rp = item.fuel_type === 'Dexlite' ? item.amount_rp : 0;
            rowData.d_ltr = item.fuel_type === 'Dexlite' ? item.amount_liter : 0;
            rowData.o_ltr = item.fuel_type === 'Oli' ? item.amount_liter : 0;
          }
          if (visibleColumns.remarks) rowData.remarks = item.remarks || "-";
          if (visibleColumns.receiver) rowData.receiver = item.receiver;
          if (visibleColumns.location) rowData.location = item.street;

          const row = worksheet.addRow(rowData);
          row.eachCell(cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
          });
        });

        // Sub-total row
        const subP_Rp = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_rp : 0), 0);
        const subP_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_liter : 0), 0);
        const subD_Rp = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_rp : 0), 0);
        const subD_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_liter : 0), 0);
        const subO_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Oli' ? it.amount_liter : 0), 0);

        const subTotalRowData: any = { no: `SUB-TOTAL ${groupName.toUpperCase()}:` };
        if (visibleColumns.fuel) {
          subTotalRowData.p_rp = subP_Rp;
          subTotalRowData.p_ltr = subP_Ltr;
          subTotalRowData.d_rp = subD_Rp;
          subTotalRowData.d_ltr = subD_Ltr;
          subTotalRowData.o_ltr = subO_Ltr;
        }
        const subTotalRow = worksheet.addRow(subTotalRowData);
        const leadingCols = 1 + (visibleColumns.date?1:0) + (visibleColumns.spj_no?1:0) + (visibleColumns.region?1:0) + (visibleColumns.team?1:0) + (visibleColumns.vehicle?1:0);
        worksheet.mergeCells(subTotalRow.number, 1, subTotalRow.number, leadingCols);
        subTotalRow.eachCell(cell => {
          cell.font = { bold: true, italic: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      // Grand Total
      const totalRowData: any = { no: 'TOTAL KESELURUHAN:' };
      if (visibleColumns.fuel) {
        totalRowData.p_rp = totalPertamaxRp;
        totalRowData.p_ltr = totalPertamaxLtr;
        totalRowData.d_rp = totalDexliteRp;
        totalRowData.d_ltr = totalDexliteLtr;
        totalRowData.o_ltr = totalOliLtr;
      }
      const totalRow = worksheet.addRow(totalRowData);
      const leadingCols = 1 + (visibleColumns.date?1:0) + (visibleColumns.spj_no?1:0) + (visibleColumns.region?1:0) + (visibleColumns.team?1:0) + (visibleColumns.vehicle?1:0);
      worksheet.mergeCells(totalRow.number, 1, totalRow.number, leadingCols);
      totalRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekap_Mingguan_SPJ_BBM_${format(weekStart, 'yyyy-MM-dd')}.xlsx`);
      dismissToast(toastId);
      showSuccess("Excel berhasil diunduh");
    } catch (error) {
      console.error(error);
      dismissToast(toastId);
      showError("Gagal membuat file Excel");
    }
  };

  if (!isAllowed) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <Button variant="ghost" onClick={() => navigate('/fuel-reports/spj')} className="h-9 px-3">
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

              <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                <SelectTrigger className="w-full md:w-[180px] h-10 bg-slate-50 border-slate-200">
                  <Settings2 className="mr-2 h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Kelompokkan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="region">Grup Per Wilayah</SelectItem>
                  <SelectItem value="team">Grup Per Tim</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 md:w-auto bg-white border-blue-200 text-blue-600 hover:bg-blue-50 h-10">
                    <Settings2 className="mr-2 h-4 w-4" /> Pilih Kolom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tampilkan Kolom:</p>
                    <div className="space-y-2">
                      {Object.entries({ date: "Tanggal", spj_no: "No. SPJ", region: "Wilayah", team: "Tim / Operator", vehicle: "Kendaraan", fuel: "BBM / Oli", remarks: "Ket. BBM", receiver: "Penerima", location: "Lokasi" }).map(([key, label]) => (
                        <div key={key} className="flex items-center space-x-2"><Checkbox id={`col-${key}`} checked={visibleColumns[key as keyof typeof visibleColumns]} onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)} /><Label htmlFor={`col-${key}`} className="text-sm cursor-pointer">{label}</Label></div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-2 md:px-4">
                    <Printer className="h-4 w-4 md:mr-2" /> 
                    <span className="hidden md:inline">Cetak Rekap</span>
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
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/daily-rekap')} className="cursor-pointer py-2">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/weekly-rekap')} className="cursor-pointer py-2">
                    <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/monthly-rekap')} className="cursor-pointer py-2">
                    <FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/fuel-reports/spj/yearly-rekap')} className="cursor-pointer py-2">
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
          <img src={LOGO_MEDAN_URL} className="h-16 w-16 object-contain" alt="Logo Medan" />
          <div className="text-center"><h1 className="text-lg font-bold uppercase">Pemerintah Kota Medan</h1><h2 className="text-xl font-black uppercase">Dinas Lingkungan Hidup</h2><p className="text-[10px] italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p></div>
          <img src={LOGO_DLH_URL} className="h-16 w-16 object-contain" alt="Logo DLH" />
        </div>

        <div className="text-center mb-8">
          <h3 className="text-lg font-bold underline uppercase text-blue-800">REKAP MINGGUAN SPJ PEMAKAIAN BBM & OLI</h3>
          <p className="text-sm font-bold">Periode: {format(weekStart, 'd MMMM', { locale: localeId })} s/d {format(weekEnd, 'd MMMM yyyy', { locale: localeId })}</p>
          {selectedRegion !== "semua" && <p className="text-xs font-bold uppercase text-slate-500 mt-1">{selectedRegion}</p>}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse border-2 border-black text-[9px] table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border-2 border-black p-1 w-[30px]" rowSpan={visibleColumns.fuel ? 2 : 1}>No</th>
                {visibleColumns.date && <th className="border-2 border-black p-1 w-[50px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Tgl</th>}
                {visibleColumns.spj_no && <th className="border-2 border-black p-1 w-[80px]" rowSpan={visibleColumns.fuel ? 2 : 1}>No. SPJ</th>}
                {visibleColumns.region && <th className="border-2 border-black p-1 w-[70px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Wilayah</th>}
                {visibleColumns.team && <th className="border-2 border-black p-1 w-[80px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Tim / Operator</th>}
                {visibleColumns.vehicle && <th className="border-2 border-black p-1 w-[100px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Kendaraan</th>}
                {visibleColumns.fuel && <th className="border-2 border-black p-1" colSpan={5}>Jenis BBM / Oli</th>}
                {visibleColumns.remarks && <th className="border-2 border-black p-1 w-[100px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Ket. BBM</th>}
                {visibleColumns.receiver && <th className="border-2 border-black p-1 w-[80px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Penerima</th>}
                {visibleColumns.location && <th className="border-2 border-black p-1 w-[120px]" rowSpan={visibleColumns.fuel ? 2 : 1}>Lokasi</th>}
              </tr>
              {visibleColumns.fuel && (
                <tr className="bg-slate-50">
                  <th className="border-2 border-black p-1 w-[50px]">Pertamax (Rp)</th>
                  <th className="border-2 border-black p-1 w-[35px]">Ltr</th>
                  <th className="border-2 border-black p-1 w-[50px]">Dexlite (Rp)</th>
                  <th className="border-2 border-black p-1 w-[35px]">Ltr</th>
                  <th className="border-2 border-black p-1 w-[30px]">Oli (L)</th>
                </tr>
              )}
            </thead>
            <tbody>
              {Object.keys(groupedData).length > 0 ? (
                <>
                  {Object.entries(groupedData).map(([groupName, items], gIdx) => {
                    const subP_Rp = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_rp : 0), 0);
                    const subP_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Pertamax' ? it.amount_liter : 0), 0);
                    const subD_Rp = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_rp : 0), 0);
                    const subD_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Dexlite' ? it.amount_liter : 0), 0);
                    const subO_Ltr = items.reduce((acc, it) => acc + (it.fuel_type === 'Oli' ? it.amount_liter : 0), 0);

                    return (
                      <React.Fragment key={groupName}>
                        <tr className="bg-slate-50/50 font-bold"><td colSpan={13} className="border-2 border-black p-1.5 bg-blue-50/30">{groupBy.toUpperCase()}: {groupName.toUpperCase()}</td></tr>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="border-2 border-black p-1 text-center">{idx + 1}</td>
                            {visibleColumns.date && <td className="border-2 border-black p-1 text-center">{format(parseISO(item.date), 'dd/MM')}</td>}
                            {visibleColumns.spj_no && <td className="border-2 border-black p-1 text-center font-bold">{item.spj_no}</td>}
                            {visibleColumns.region && <td className="border-2 border-black p-1 text-center">{item.region}</td>}
                            {visibleColumns.team && <td className="border-2 border-black p-1 text-center">{item.team}</td>}
                            {visibleColumns.vehicle && <td className="border-2 border-black p-1 font-medium">{item.vehicle}</td>}
                            {visibleColumns.fuel && (
                              <>
                                <td className="border-2 border-black p-1 text-right">{item.fuel_type === 'Pertamax' ? item.amount_rp.toLocaleString('id-ID') : "-"}</td>
                                <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Pertamax' ? item.amount_liter : "-"}</td>
                                <td className="border-2 border-black p-1 text-right">{item.fuel_type === 'Dexlite' ? item.amount_rp.toLocaleString('id-ID') : "-"}</td>
                                <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Dexlite' ? item.amount_liter : "-"}</td>
                                <td className="border-2 border-black p-1 text-center">{item.fuel_type === 'Oli' ? item.amount_liter : "-"}</td>
                              </>
                            )}
                            {visibleColumns.remarks && <td className="border-2 border-black p-1 italic whitespace-normal break-words leading-tight">{item.remarks || "-"}</td>}
                            {visibleColumns.receiver && <td className="border-2 border-black p-1 whitespace-normal break-words leading-tight">{item.receiver}</td>}
                            {visibleColumns.location && <td className="border-2 border-black p-1 whitespace-normal break-words leading-tight">{item.street}</td>}
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold italic">
                          <td className="border-2 border-black p-1 text-right" colSpan={1 + (visibleColumns.date?1:0) + (visibleColumns.spj_no?1:0) + (visibleColumns.region?1:0) + (visibleColumns.team?1:0) + (visibleColumns.vehicle?1:0)}>SUB-TOTAL {groupName.toUpperCase()}:</td>
                          {visibleColumns.fuel && (
                            <>
                              <td className="border-2 border-black p-1 text-right">{subP_Rp.toLocaleString('id-ID')}</td>
                              <td className="border-2 border-black p-1 text-center">{subP_Ltr.toFixed(2)}</td>
                              <td className="border-2 border-black p-1 text-right">{subD_Rp.toLocaleString('id-ID')}</td>
                              <td className="border-2 border-black p-1 text-center">{subD_Ltr.toFixed(2)}</td>
                              <td className="border-2 border-black p-1 text-center">{subO_Ltr.toFixed(2)}</td>
                            </>
                          )}
                          <td className="border-2 border-black p-1" colSpan={(visibleColumns.remarks?1:0) + (visibleColumns.receiver?1:0) + (visibleColumns.location?1:0)}></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-slate-100 font-black text-sm">
                    <td className="border-2 border-black p-2 text-right" colSpan={1 + (visibleColumns.date?1:0) + (visibleColumns.spj_no?1:0) + (visibleColumns.region?1:0) + (visibleColumns.team?1:0) + (visibleColumns.vehicle?1:0)}>TOTAL KESELURUHAN:</td>
                    {visibleColumns.fuel && (
                      <>
                        <td className="border-2 border-black p-2 text-right">{totalPertamaxRp.toLocaleString('id-ID')}</td>
                        <td className="border-2 border-black p-2 text-center">{totalPertamaxLtr.toFixed(2)}</td>
                        <td className="border-2 border-black p-2 text-right">{totalDexliteRp.toLocaleString('id-ID')}</td>
                        <td className="border-2 border-black p-2 text-center">{totalDexliteLtr.toFixed(2)}</td>
                        <td className="border-2 border-black p-2 text-center">{totalOliLtr.toFixed(2)}</td>
                      </>
                    )}
                    <td className="border-2 border-black p-2" colSpan={(visibleColumns.remarks?1:0) + (visibleColumns.receiver?1:0) + (visibleColumns.location?1:0)}></td>
                  </tr>
                </>
              ) : (
                <tr><td colSpan={13} className="border-2 border-black p-8 text-center italic text-slate-400">Tidak ada data untuk periode ini</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8 text-[10px] leading-normal max-w-[700px] mx-auto">
          <div className="text-center flex flex-col justify-between min-h-[150px]">
            <div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p></div>
            <div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div>
          </div>
          <div className="text-center flex flex-col justify-between min-h-[150px]">
            <div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p></div>
            <div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div>
          </div>
        </div>
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

export default FuelSpjWeeklyRecap;