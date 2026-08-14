"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Report, Task, Equipment, HeavyEquipment } from '@/types/report';
import { reportService } from '@/services/reportService';
import { getUnitByCategory, sortByCategory } from '@/utils/report-helpers';
import { 
  ArrowLeft, Printer, Fuel, FileText, ChevronsUpDown, 
  Table, Image as ImageIcon, ImageOff, LogOut, LogIn, CloudUpload, 
  Loader2, Lock, ChevronDown, PenTool, Calendar, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { useRegionName } from '@/hooks/useRegionName';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import DriveUploadDialog from '@/components/DriveUploadDialog';
import { generateRecapDrivePdfBase64, getRegionalCoordinatorSignature } from '@/utils/recap-drive-pdf';
import { getReportRecapTitle } from '@/utils/report-recap-title';
import { canPrintReportRecap, getRecapPrintDeniedMessage } from '@/utils/recap-print-permissions';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { monthlyPdfFileName } from '@/utils/pdf-file-name';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const allCategories = [
  "Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram", "Tim Pohon"
];

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

type RecapMode = "with-fuel" | "without-fuel";
type PhotoMode = "with-photo" | "without-photo";
type SignatureMode = "with-signature" | "without-signature";

const MonthlyRecap = () => {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const regionName = useRegionName(profile?.region_id, profile?.role === 'admin' ? 'SEMUA WILAYAH' : undefined);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [recapMode, setRecapMode] = useState<RecapMode>("without-fuel");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("with-photo");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("with-signature");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const printRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = !!session;
  
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAdminHarian = profile?.role === 'admin_harian' || session?.user?.email === 'sakinah@gmail.com' || session?.user?.email === 'admin.laporan@gmail.com';
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && !isPimpinan && !isAdminHarian;

  // Check permission for printing monthly recap
  const canPrintMonthlyRecap = () => {
    return canPrintReportRecap(profile?.role, 'monthly');
  };

  const printAccessDeniedMessage = () => getRecapPrintDeniedMessage(profile?.role, 'monthly');

  useEffect(() => {
    if (isLoggedIn && profile) {
      if (isUserRestricted && profile.category) {
        setSelectedCategories([profile.category]);
      } else {
        setSelectedCategories(['semua']);
      }
    } else {
      setSelectedCategories(['semua']);
    }
  }, [profile, isLoggedIn, isUserRestricted]);

  useEffect(() => {
    if (selectedCategories.length > 0) {
      loadData();
    }
  }, [selectedMonth, selectedYear, selectedCategories]);

  const loadData = async () => {
    try {
      setLoading(true);
      let data = await reportService.getAllReports();
      data = data.filter(r => {
        const reportDate = new Date(r.date);
        const m = (reportDate.getMonth() + 1).toString();
        const y = reportDate.getFullYear().toString();
        const matchMonth = selectedMonth === "semua" || m === selectedMonth;
        const matchYear = selectedYear === "semua" || y === selectedYear;
        let matchCategory = false;
        if (!isLoggedIn || profile?.role === 'admin' || isPimpinan || isAdminHarian) {
          matchCategory = selectedCategories.includes('semua') || selectedCategories.includes(r.category);
        } else {
          matchCategory = r.category === profile?.category;
        }
        return matchMonth && matchYear && matchCategory;
      });
      
      data.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return sortByCategory(a.category, b.category);
      });
      
      setReports(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        showError("Gagal keluar");
      }
    }
  };

  const handlePrint = () => {
    if (!canPrintMonthlyRecap()) {
      showError(printAccessDeniedMessage());
      return;
    }
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSharePdf = async () => {
    if (!canPrintMonthlyRecap() || !printRef.current) return;
    const toastId = showLoading("Menyiapkan pratinjau PDF...");
    try {
      await openShareablePdfPreview({
        fileName: monthlyPdfFileName("Laporan Bulanan", Number(selectedMonth), selectedYear, regionName),
      });
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : "Gagal membuat PDF untuk dibagikan");
    } finally {
      dismissToast(toastId);
    }
  };

  const handleDriveUpload = async (config: { fileName: string; folderId: string; accessToken: string }) => {
    if (!canPrintMonthlyRecap()) {
      showError(printAccessDeniedMessage());
      throw new Error('Akses cetak rekap bulanan ditolak');
    }
    const toastId = showLoading("Menyiapkan PDF A3...");
    try {
      const pdfBase64 = await generateRecapDrivePdfBase64({
        reports,
        kind: 'monthly',
        title: recapTitle,
        periodLabel: `Bulan: ${selectedMonth === 'semua' ? 'Semua Bulan' : months[parseInt(selectedMonth)-1]} ${selectedYear === 'semua' ? 'Semua Tahun' : selectedYear}`,
        logoMedanUrl: LOGO_MEDAN_URL,
        logoDlhUrl: LOGO_DLH_URL,
        visibleColumns: {
          date: true,
          category: true,
          description: true,
          location: true,
          photos: photoMode === "with-photo",
          volume: true,
          equipment: true,
          heavyEquipment: true,
          fuel: recapMode === "with-fuel",
          coordinator: true,
          members: true,
          remarks: true,
        },
        fuelMode: recapMode === "with-fuel" ? 'voucher' : 'none',
        signatureMode,
        coordinatorName: coordinatorSignature.name,
        coordinatorNip: coordinatorSignature.nip,
      });
      const { data, error } = await supabase.functions.invoke('upload-to-drive', {
        body: { 
          pdfBase64, 
          fileName: config.fileName.endsWith('.pdf') ? config.fileName : `${config.fileName}.pdf`,
          folderId: config.folderId,
          userAccessToken: config.accessToken
        }
      });
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error(error);
      showError("Gagal mengunggah: " + error.message);
      throw error;
    } finally {
      dismissToast(toastId);
    }
  };

  const handleExportExcel = async () => {
    if (!canPrintMonthlyRecap()) {
      showError(printAccessDeniedMessage());
      return;
    }
    if (reports.length === 0) {
      showError("Tidak ada data untuk diekspor");
      return;
    }
    const toastId = showLoading("Menyiapkan file Excel...");
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Laporan');
      const columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Hari / Tgl', key: 'date', width: 15 },
        { header: 'Tim/Kec.', key: 'category', width: 15 },
        { header: 'Uraian Kegiatan', key: 'desc', width: 30 },
        { header: 'Lokasi', key: 'loc', width: 40 },
      ];
      if (photoMode === "with-photo") {
        columns.push({ header: '0%', key: 'p0', width: 22 }, { header: '50%', key: 'p50', width: 22 }, { header: '100%', key: 'p100', width: 22 });
      }
      columns.push({ header: 'Vol', key: 'vol', width: 10 }, { header: 'Jenis Alat', key: 'eq_type', width: 20 }, { header: 'Jumlah Alat', key: 'eq_qty', width: 10 }, { header: 'Alat Berat', key: 'he', width: 25 });
      if (recapMode === "with-fuel") {
        columns.push(
          { header: 'Pertamax (Rp)', key: 'fp', width: 14 }, { header: 'Pertamax (L)', key: 'fpl', width: 12 },
          { header: 'Dexlite (Rp)', key: 'fd', width: 14 }, { header: 'Dexlite (L)', key: 'fdl', width: 12 },
          { header: 'S (Rp)', key: 'fs', width: 10 }
        );
      }
      columns.push({ header: 'Koordinator', key: 'coord', width: 20 }, { header: 'Anggota', key: 'members', width: 10 }, { header: 'Keterangan', key: 'rem', width: 35 });
      worksheet.columns = columns;
      
      const lastColLetter = String.fromCharCode(64 + columns.length);
      worksheet.mergeCells(`A1:${lastColLetter}1`);
      worksheet.getCell('A1').value = 'PEMERINTAH KOTA MEDAN';
      worksheet.getCell('A1').font = { bold: true, size: 14 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      worksheet.mergeCells(`A2:${lastColLetter}2`);
      worksheet.getCell('A2').value = 'DINAS LINGKUNGAN HIDUP';
      worksheet.getCell('A2').font = { bold: true, size: 16 };
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      worksheet.mergeCells(`A3:${lastColLetter}3`);
      worksheet.getCell('A3').value = recapTitle;
      worksheet.getCell('A3').font = { bold: true, size: 13 };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };
      
      const headerRow = worksheet.addRow(columns.map(c => c.header));
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true };
      });

      let currentNo = 0;
      let lastDate = "";

      for (const report of reports) {
        if (report.date !== lastDate) {
          currentNo++;
          lastDate = report.date;
        }

        for (let i = 0; i < report.tasks.length; i++) {
          const task = report.tasks[i];
          const villages = Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village;
          const rowData: any = {
            no: (i === 0 && report === reports.find(r => r.date === report.date)) ? currentNo : '',
            date: i === 0 ? new Date(report.date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '',
            category: i === 0 ? report.category : '',
            desc: task.description,
            loc: `${task.location.street}, ${villages}`,
            vol: `${task.volume} ${getUnitByCategory(report.category)}`,
            eq_type: task.equipment?.map(e => e.type).join("\n"),
            eq_qty: task.equipment?.map(e => e.quantity).join("\n"),
            he: task.heavyEquipment?.map(he => `${he.type} ${he.vehicle || ""}`).join("\n"),
            coord: task.personnel.coordinator,
            members: task.personnel.members,
            rem: [task.remarks, i === 0 ? report.remarks : ""].filter(Boolean).join(" | ")
          };
          if (recapMode === "with-fuel") {
            rowData.fp = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.pertamax || 0), 0) || 0;
            rowData.fpl = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.pertamax_liter || 0), 0) || 0;
            rowData.fd = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.dexlite || 0), 0) || 0;
            rowData.fdl = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.dexlite_liter || 0), 0) || 0;
            rowData.fs = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.solar || 0), 0) || 0;
          }
          const row = worksheet.addRow(rowData);
          if (photoMode === "with-photo") row.height = 100;
          row.eachCell(cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', wrapText: true };
          });
        }
      }
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekap_DLH_${selectedMonth === 'semua' ? 'Semua' : months[parseInt(selectedMonth)-1]}_${selectedYear}.xlsx`);
      dismissToast(toastId);
      showSuccess("Rekap Excel berhasil diunduh");
    } catch (error) {
      console.error(error);
      dismissToast(toastId);
      showError("Gagal membuat file Excel");
    }
  };

  const toggleCategory = (category: string) => {
    if (category === 'semua') { setSelectedCategories(['semua']); return; }
    let newSelected = [...selectedCategories].filter(c => c !== 'semua');
    if (newSelected.includes(category)) { newSelected = newSelected.filter(c => c !== category); }
    else { newSelected.push(category); }
    if (newSelected.length === 0) { setSelectedCategories(['semua']); }
    else { setSelectedCategories(newSelected); }
  };

  const coordinatorSignature = getRegionalCoordinatorSignature(regionName);
  const recapTitle = getReportRecapTitle('bulanan', reports.map(report => report.category));

  const headerStyle = { backgroundColor: '#e5e7eb', color: '#000000', fontWeight: 'bold', textAlign: 'center' as const, verticalAlign: 'middle' as const, WebkitPrintColorAdjust: 'exact' as const, printColorAdjust: 'exact' as const };
  const subHeaderStyle = { backgroundColor: '#f8fafc', color: '#000000', fontWeight: 'bold', textAlign: 'center' as const, verticalAlign: 'middle' as const };

  const totalCols = 12 + (photoMode === "with-photo" ? 3 : 0) + (recapMode === "with-fuel" ? 6 : 0);

  const getTableSpans = () => {
    const noSpans: number[] = [];
    const dateSpans: number[] = [];
    let currentNo = 0;
    let lastDate = "";
    
    const flatTasks = reports.flatMap(r => r.tasks.map(t => ({ ...t, reportDate: r.date, reportId: r.id, category: r.category, reportRemarks: r.remarks })));
    
    flatTasks.forEach((task, idx) => {
      if (task.reportDate !== lastDate) {
        currentNo++;
        lastDate = task.reportDate;
        const sameDateTasks = flatTasks.filter(t => t.reportDate === task.reportDate);
        noSpans[idx] = sameDateTasks.length;
        dateSpans[idx] = sameDateTasks.length;
      } else {
        noSpans[idx] = 0;
        dateSpans[idx] = 0;
      }
    });

    return { flatTasks, noSpans, dateSpans };
  };

  const { flatTasks, noSpans, dateSpans } = getTableSpans();

  const renderTaskRow = (task: any, idx: number, currentNo: number) => {
    const villages = Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village;
    const reportTasks = flatTasks.filter(t => t.reportId === task.reportId);
    const isFirstInReport = reportTasks[0] === task;

    return (
      <tr key={`${task.reportId}-${idx}`}>
        {noSpans[idx] > 0 && (
          <td className="border-2 border-black p-2 text-center align-top font-bold" rowSpan={noSpans[idx]}>{currentNo}</td>
        )}
        {dateSpans[idx] > 0 && (
          <td className="border-2 border-black p-2 text-center align-top font-medium" rowSpan={dateSpans[idx]}>
            {new Date(task.reportDate).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </td>
        )}
        {isFirstInReport && (
          <td className="border-2 border-black p-2 text-center align-top font-bold text-blue-700" rowSpan={reportTasks.length}>
            {task.category}
          </td>
        )}
        <td className="border-2 border-black p-2 align-top whitespace-normal break-words leading-tight">{task.description}</td>
        <td className="border-2 border-black p-2 align-top whitespace-normal break-words leading-tight">{`${task.location.street}, ${villages}, ${task.location.subDistrict}`}</td>
        {photoMode === "with-photo" && (
          <>
            <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.zero ? <img src={task.photos.zero} className="w-full h-full object-fill" alt="0%" /> : null}</div></td>
            <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.fifty ? <img src={task.photos.fifty} className="w-full h-full object-fill" alt="50%" /> : null}</div></td>
            <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.hundred ? <img src={task.photos.hundred} className="w-full h-full object-fill" alt="100%" /> : null}</div></td>
          </>
        )}
        <td className="border-2 border-black p-2 text-center font-bold align-top">{task.volume} {getUnitByCategory(task.category)}</td>
        <td className="border border-black p-0 align-top text-[10px] leading-tight">{task.equipment?.map((e: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0 whitespace-nowrap">• {e.type}</div>))}</td>
        <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.equipment?.map((e: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{e.quantity}</div>))}</td>
        <td className="border border-black p-0 align-top text-[10px] leading-tight overflow-hidden">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0 whitespace-nowrap">• {he.type} {he.vehicle || ""}</div>))}</td>
        {recapMode === "with-fuel" && (
          <>
            <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{he.fuel?.pertamax ? he.fuel.pertamax.toLocaleString('id-ID') : ''}</div>))}</td>
            <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{he.fuel?.pertamax_liter || ''}</div>))}</td>
            <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{he.fuel?.dexlite ? he.fuel.dexlite.toLocaleString('id-ID') : ''}</div>))}</td>
            <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{he.fuel?.dexlite_liter || ''}</div>))}</td>
            <td className="border-2 border-black p-1.5 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he: any, i: number) => (<div key={i} className="mb-0.5">{he.fuel?.solar || 0}</div>))}</td>
          </>
        )}
        <td className="border-2 border-black p-2 text-center align-top font-medium">{task.personnel.coordinator}</td>
        <td className="border-2 border-black p-2 text-center align-top font-medium">{task.personnel.members}</td>
        <td className="border-2 border-black p-2 align-top whitespace-normal break-words italic">
          <div className="space-y-1">
            {task.remarks && <div>{task.remarks}</div>}
            {isFirstInReport && task.reportRemarks && (
              <div className={cn("text-blue-700 font-medium", task.remarks && "border-t border-slate-200 pt-1")}>
                Catatan: {task.reportRemarks}
              </div>
            )}
            {!task.remarks && (!isFirstInReport || !task.reportRemarks) && "-"}
          </div>
        </td>
      </tr>
    );
  };

  const colGroup = (
    <colgroup>
      <col style={{ width: '35px' }} />
      <col style={{ width: '70px' }} />
      <col style={{ width: '75px' }} />
      <col style={{ width: '105px' }} />
      <col style={{ width: '110px' }} />
      {photoMode === "with-photo" && (
        <>
          <col style={{ width: '145px' }} />
          <col style={{ width: '145px' }} />
          <col style={{ width: '145px' }} />
        </>
      )}
      <col style={{ width: '65px' }} />
      <col style={{ width: '90px' }} />
      <col style={{ width: '25px' }} />
      <col style={{ width: '120px' }} />
      {recapMode === "with-fuel" && (
        <>
          <col style={{ width: '45px' }} />
          <col style={{ width: '45px' }} />
          <col style={{ width: '35px' }} />
          <col style={{ width: '45px' }} />
          <col style={{ width: '35px' }} />
        </>
      )}
      <col style={{ width: '90px' }} />
      <col style={{ width: '50px' }} />
      <col style={{ width: '160px' }} />
    </colgroup>
  );

  const tableHeader = (
    <thead className="pdf-table-header">
      <tr style={{ height: '40px' }}>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">No</div></th>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Hari / Tgl</div></th>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Tim/Kec.</div></th>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Uraian Kegiatan</div></th>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Lokasi</div></th>
        {photoMode === "with-photo" && (<th style={headerStyle} className="border-2 border-black p-2" colSpan={3}>Dokumentasi</th>)}
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Vol</div></th>
        <th style={headerStyle} className="border-2 border-black p-2" colSpan={2}>Peralatan</th>
        <th style={headerStyle} className="border-2 border-black p-1" colSpan={recapMode === "with-fuel" ? 6 : 1}>Alat Operasional</th>
        <th style={headerStyle} className="border-2 border-black p-2" colSpan={2}>Personil</th>
        <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Keterangan</div></th>
      </tr>
      <tr style={{ height: '30px' }}>
        {photoMode === "with-photo" && (<><th style={subHeaderStyle} className="border-2 border-black p-1">0%</th><th style={subHeaderStyle} className="border-2 border-black p-1">50%</th><th style={subHeaderStyle} className="border-2 border-black p-1">100%</th></>)}
        <th style={subHeaderStyle} className="border-2 border-black p-1">Jenis Alat</th>
        <th style={subHeaderStyle} className="border-2 border-black p-1 px-0">Jml</th>
        <th style={subHeaderStyle} className="border-2 border-black p-1 text-[8px]">Nama Alat Berat</th>
        {recapMode === "with-fuel" && (
          <>
            <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Pertamax (Rp)</th>
            <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Pertamax (L)</th>
            <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Dexlite (Rp)</th>
            <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Dexlite (L)</th>
            <th style={subHeaderStyle} className="border-2 border-black p-1 text-[8px]">S (Rp)</th>
          </>
        )}
        <th style={subHeaderStyle} className="border-2 border-black p-1">Koordinator</th>
        <th style={subHeaderStyle} className="border-2 border-black p-1">Anggota</th>
      </tr>
    </thead>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/')} className="px-2 md:px-4 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
            </Button>
            {isLoggedIn ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"><LogOut className="h-5 w-5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Keluar Sistem</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="text-blue-600 border-blue-600 px-2 md:px-4 h-9">
                <LogIn className="mr-2 h-4 w-4" /> <span className="hidden md:inline">Masuk</span>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[110px] md:w-[140px] h-10 text-xs md:text-sm"><SelectValue placeholder="Bulan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Bulan</SelectItem>
                {months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[80px] md:w-[100px] h-10 text-xs md:text-sm"><SelectValue placeholder="Tahun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Tahun</SelectItem>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" disabled={isUserRestricted} className={cn("w-[160px] md:w-[220px] justify-between font-normal h-10 text-xs md:text-sm", isUserRestricted && "bg-slate-50 text-slate-500")}>
                    <span className="truncate">{selectedCategories.includes('semua') ? "Semua Kategori" : selectedCategories.length > 1 ? `${selectedCategories.length} Kategori Terpilih` : selectedCategories[0]}</span>
                    <ChevronsUpDown className="ml-1 md:ml-2 h-3 w-3 md:h-4 md:w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <div className="p-2 space-y-1">
                    <div className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-md cursor-pointer" onClick={() => toggleCategory('semua')}><Checkbox checked={selectedCategories.includes('semua')} /><label className="text-sm font-medium leading-none cursor-pointer">Semua Kategori</label></div>
                    <div className="h-px bg-slate-200 my-1" />
                    {allCategories.map((cat) => (<div key={cat} className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-md cursor-pointer" onClick={() => toggleCategory(cat)}><Checkbox checked={selectedCategories.includes(cat)} /><label className="text-sm font-medium leading-none cursor-pointer">{cat}</label></div>))}
                  </div>
                </PopoverContent>
              </Popover>
              {isUserRestricted && <div className="absolute -top-2 -right-2 bg-amber-100 text-amber-700 p-1 rounded-full border border-amber-200 shadow-sm"><Lock size={10} /></div>}
            </div>
            <Select value={photoMode} onValueChange={(v) => setPhotoMode(v as PhotoMode)}>
              <SelectTrigger className="w-[40px] md:w-[160px] bg-slate-50 border-slate-200 h-10 text-slate-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} />
                  <span className="hidden md:inline"><SelectValue placeholder="Mode Foto" /></span>
                </div>
              </SelectTrigger>
              <SelectContent><SelectItem value="with-photo"><div className="flex items-center gap-2"><ImageIcon size={14} /> Dengan Foto</div></SelectItem><SelectItem value="without-photo"><div className="flex items-center gap-2"><ImageOff size={14} /> Tanpa Foto</div></SelectItem></SelectContent>
            </Select>
            <Select value={recapMode} onValueChange={(v) => setRecapMode(v as RecapMode)}>
              <SelectTrigger className="w-[40px] md:w-[180px] bg-blue-50 border-blue-200 h-10 text-blue-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex items-center gap-2">
                  <Fuel size={16} />
                  <span className="hidden md:inline"><SelectValue placeholder="Mode Rekap" /></span>
                </div>
              </SelectTrigger>
              <SelectContent><SelectItem value="with-fuel"><div className="flex items-center gap-2"><Fuel size={14} /> Rekap Dengan BBM</div></SelectItem><SelectItem value="without-fuel"><div className="flex items-center gap-2"><FileText size={14} /> Rekap Tanpa BBM</div></SelectItem></SelectContent>
            </Select>
            <Select value={signatureMode} onValueChange={(v) => setSignatureMode(v as SignatureMode)}>
              <SelectTrigger className="w-[40px] md:w-[180px] bg-amber-50 border-amber-200 h-10 text-amber-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex items-center gap-2">
                  <PenTool size={16} />
                  <span className="hidden md:inline"><SelectValue placeholder="Tanda Tangan" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-signature"><div className="flex items-center gap-2"><PenTool size={14} /> Ada Tanda Tangan</div></SelectItem>
                <SelectItem value="without-signature"><div className="flex items-center gap-2"><PenTool size={14} className="opacity-40" /> Tanpa Tanda Tangan</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <Button onClick={() => setIsDriveDialogOpen(true)} disabled={reports.length === 0 || !canPrintMonthlyRecap()} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 h-10 px-2 md:px-4">
                <CloudUpload className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Simpan ke Drive</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700 h-10 px-2 md:px-4 disabled:bg-slate-300 disabled:cursor-not-allowed"
                        disabled={!canPrintMonthlyRecap()}
                      >
                        <Printer className="h-4 w-4 md:mr-2" /> 
                        <span className="hidden md:inline">Cetak Rekap</span>
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    {!canPrintMonthlyRecap() && (
                      <TooltipContent side="left" className="bg-red-600 text-white border-red-700">
                        <p className="max-w-xs">{printAccessDeniedMessage()}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handlePrint} className="cursor-pointer py-2">
                  <Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSharePdf} className="cursor-pointer py-2">
                  <Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Excel
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                {canPrintReportRecap(profile?.role, 'daily') && <DropdownMenuItem onClick={() => navigate('/daily-rekap')} className="cursor-pointer py-2">
                  <Calendar className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                </DropdownMenuItem>}
                {canPrintReportRecap(profile?.role, 'weekly') && <DropdownMenuItem onClick={() => navigate('/weekly-rekap')} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-purple-500" /> Rekap Mingguan
                </DropdownMenuItem>}
                {canPrintMonthlyRecap() && <DropdownMenuItem onClick={() => navigate('/monthly-rekap')} className="cursor-pointer py-2">
                  <FileText className="mr-2 h-4 w-4 text-orange-500" /> Rekap Bulanan
                </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <DriveUploadDialog 
        isOpen={isDriveDialogOpen}
        onClose={() => setIsDriveDialogOpen(false)}
        onUpload={handleDriveUpload}
        defaultFileName={`Rekap_DLH_${selectedMonth === 'semua' ? 'Semua' : months[parseInt(selectedMonth)-1]}_${selectedYear}`}
      />

      <div ref={printRef} className="print-area recap-print-area bg-white p-4 md:p-10 mx-auto shadow-lg border min-h-[297mm] w-full max-w-[420mm]">
        <div className="pdf-header">
          <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
            <div className="w-20 h-20 flex items-center justify-center overflow-hidden"><img src={LOGO_MEDAN_URL} className="max-h-full max-w-full object-contain" alt="Logo Medan" /></div>
            <div className="text-center px-4">
              <h1 className="text-2xl font-bold uppercase">Pemerintah Kota Medan</h1>
              <h2 className="text-3xl font-black uppercase">Dinas LIngkungan Hidup</h2>
              <p className="text-sm italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p>
            </div>
            <div className="w-20 h-20 flex items-center justify-center overflow-hidden"><img src={LOGO_DLH_URL} className="max-h-full max-w-full object-contain" alt="Logo DLH" /></div>
          </div>
          <div className="text-center mb-8 space-y-1">
            <h3 className="text-xl font-bold underline uppercase">{recapTitle}</h3>
            <p className="text-xl font-bold uppercase">{regionName}</p>
            <p className="text-xl font-bold uppercase">Bulan: {selectedMonth === 'semua' ? 'Semua Bulan' : months[parseInt(selectedMonth)-1]} {selectedYear === 'semua' ? 'Semua Tahun' : selectedYear}</p>
          </div>
        </div>

        <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
          {flatTasks.length > 0 ? (
            <>
              <table className="w-full min-w-[1200px] border-collapse border-2 border-black text-[11px] table-fixed print:w-full print:min-w-0">
                {colGroup}
                {tableHeader}
                <tbody className="pdf-report-block">
                  {(() => {
                    let currentNo = 0;
                    let lastDate = "";
                    return flatTasks.map((task, idx) => {
                      if (task.reportDate !== lastDate) {
                        currentNo++;
                        lastDate = task.reportDate;
                      }
                      return renderTaskRow(task, idx, currentNo);
                    });
                  })()}
                </tbody>
              </table>

              {signatureMode === "with-signature" && (
                <div className="pdf-footer mt-12 keep-together">
                  <div className="flex justify-end mb-4 text-[11px]"><p className="w-1/4 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                  <div className="grid grid-cols-4 gap-4 text-[11px] leading-normal">
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Pengawas Taman Penghijauan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">____________________________</p><p>____________________________</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4">
                      <div>
                        <p>Diketahui :</p>
                        <p className="font-bold">Kepala Koordinator Pemeliharaan Taman</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p>
                      </div>
                      <div><p className="font-bold underline">{coordinatorSignature.name}</p><p>{coordinatorSignature.nip}</p></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-[11px] table-fixed">
              <tbody>
                <tr><td colSpan={totalCols} className="border-2 border-black p-12 text-center text-slate-400 italic text-lg">Tidak ada data laporan untuk periode ini</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print, [data-radix-portal], [role="menu"], [data-radix-popper-content-wrapper] { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; background-color: white !important; overflow: visible !important; box-sizing: border-box !important; }
          @page { size: A3 landscape; margin: 1.5cm; }
          table { page-break-inside: auto; width: 100% !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .pdf-report-block { page-break-inside: avoid; }
          .keep-together { page-break-inside: avoid; break-inside: avoid; }
          .bg-slate-50, .bg-slate-100 { background-color: white !important; }
          .overflow-x-auto { overflow: visible !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />
    </div>
  );
};

export default MonthlyRecap;
