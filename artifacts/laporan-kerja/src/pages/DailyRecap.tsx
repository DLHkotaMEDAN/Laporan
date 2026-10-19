import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Report, Task, Equipment, HeavyEquipment } from '@/types/report';
import { reportService, ReportFilters } from '@/services/reportService';
import { getUnitByCategory, sortByCategory } from '@/utils/report-helpers';
import {
  ArrowLeft, Printer, FileText, ChevronsUpDown,
  Table, LogOut, LogIn, CloudUpload,
  Loader2, Lock, ChevronDown,
  Image as ImageIcon, ImageOff, PenTool, Calendar, Settings2, Edit, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { useRegionName } from '@/hooks/useRegionName';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { logger, getErrorMessage } from '@/lib/logger';
import { loadExcelJS } from '@/utils/lazy-imports';
import { storageService } from '@/services/storageService';

// ExcelJS column definition type
interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

// Excel row data type for daily recap
interface DailyRecapRowData {
  no: string | number;
  cat?: string;
  desc?: string;
  loc?: string;
  vol?: string;
  eq_type?: string;
  eq_qty?: string;
  he?: string;
  coord?: string;
  members?: number;
  rem?: string;
  p0?: string;
  p50?: string;
  p100?: string;
  fp?: string | number;
  fpl?: string | number;
  fd?: string | number;
  fdl?: string | number;
  fs?: string | number;
}
import '@/styles/printStyles.css';
import { saveAs } from 'file-saver';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import DriveUploadDialog from '@/components/DriveUploadDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import SignatoryText from '@/components/SignatoryText';
import { generateRecapDrivePdfBase64, getRegionalCoordinatorSignature } from '@/utils/recap-drive-pdf';
import { getReportRecapTitle } from '@/utils/report-recap-title';
import { canPrintReportRecap, getRecapPrintDeniedMessage } from '@/utils/recap-print-permissions';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { dailyPdfFileName } from '@/utils/pdf-file-name';
import { isPimpinanAccess } from '@/constants/access-control';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

type SignatureMode = "with-signature" | "without-signature";
type LogoMode = "with-logo" | "without-logo";

const DailyRecap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, signOut } = useAuth();
  const regionName = useRegionName(profile?.region_id, profile?.role === 'admin' ? 'SEMUA WILAYAH' : undefined);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("without-signature");
  const [logoMode, setLogoMode] = useState<LogoMode>("without-logo");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hasSetDefaults, setHasSetDefaults] = useState(false);
  const dataRequestId = useRef(0);

  const [visibleColumns, setVisibleColumns] = useState({
    category: true,
    description: true,
    location: true,
    photos: true,
    volume: true,
    equipment: true,
    heavyEquipment: true,
    fuel: false,
    coordinator: true,
    members: true,
    remarks: true
  });
  
  const printRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = !!session;
  
  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);
  const isUserRestricted = isLoggedIn && profile?.role === 'user' && !isPimpinan;
  const regionId = !isPimpinan && profile?.role !== 'admin' ? profile?.region_id : null;
  const availableCategories = Array.from(new Set(reports.map((report) => report.category))).sort((first, second) => first.localeCompare(second));

  // Check permission for printing daily recap
  const canPrintDailyRecap = () => {
    return canPrintReportRecap(profile?.role, 'daily', session?.user?.email);
  };

  const printAccessDeniedMessage = () => getRecapPrintDeniedMessage(profile?.role, 'daily');

  useEffect(() => {
    if (profile && !hasSetDefaults) {
      setVisibleColumns(prev => ({ ...prev, photos: false }));
      setSignatureMode("without-signature");
      setHasSetDefaults(true);
    }
  }, [profile, hasSetDefaults]);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const catsParam = searchParams.get('categories');
    setSelectedDate(dateParam || new Date().toISOString().split('T')[0]);
    if (catsParam) {
      setSelectedCategories(catsParam.split(','));
    } else if (isLoggedIn && profile) {
      if (isUserRestricted && profile.category) {
        setSelectedCategories([profile.category]);
      } else {
        setSelectedCategories(['semua']);
      }
    } else {
      setSelectedCategories(['semua']);
    }
  }, [profile, isLoggedIn, isUserRestricted, searchParams]);

  useEffect(() => {
    if (selectedCategories.length > 0) {
      loadData();
    }
  }, [selectedDate, selectedCategories, regionId, isLoggedIn, profile?.role, profile?.category, isPimpinan, isUserRestricted]);

  const loadData = async () => {
    const requestId = ++dataRequestId.current;
    try {
      setLoading(true);

      // Tentukan filter kategori — user terbatas hanya boleh lihat kategori profilnya
      const effectiveCategory = isUserRestricted
        ? (profile?.category ?? null)
        : selectedCategories.includes('semua') ? null : selectedCategories[0] ?? null;

      const filters: ReportFilters = {
        // Filter tanggal dikirim ke server agar tidak menarik semua data
        dateFilter: selectedDate && selectedDate !== 'semua'
          ? { type: 'date', value: selectedDate }
          : null,
        category: effectiveCategory,
        // regionId sudah ditentukan di luar berdasarkan role user
        regionId: regionId ?? null,
      };

      let data = await reportService.getFilteredReports(filters);

      // Filter kategori multi-select tetap di client karena server hanya
      // mendukung satu nilai kategori per query. Untuk 'semua', tidak perlu filter.
      if (!isUserRestricted && !selectedCategories.includes('semua') && selectedCategories.length > 1) {
        data = data.filter(r => selectedCategories.includes(r.category));
      }

      data.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return sortByCategory(a.category, b.category);
      });

      if (requestId === dataRequestId.current) {
        setReports(data);
      }
    } catch (error) {
      logger.error('Error loading daily recap data', error);
    } finally {
      if (requestId === dataRequestId.current) {
        setLoading(false);
      }
    }
  };

  const handleLogout = () => setLogoutConfirmOpen(true);

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const handlePrint = () => {
    if (!canPrintDailyRecap()) {
      showError(printAccessDeniedMessage());
      return;
    }
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSharePdf = async () => {
    if (!canPrintDailyRecap() || !printRef.current) return;
    const toastId = showLoading("Menyiapkan pratinjau PDF...");
    try {
      await openShareablePdfPreview({
        fileName: dailyPdfFileName("Laporan Harian", selectedDate, regionName),
      });
    } catch (error) {
      logger.error('Error sharing PDF', error);
      showError(error instanceof Error ? error.message : "Gagal membuat PDF untuk dibagikan");
    } finally {
      dismissToast(toastId);
    }
  };

  const handleDriveUpload = async (config: { fileName: string; folderId: string; accessToken: string }) => {
    if (!canPrintDailyRecap()) {
      showError(printAccessDeniedMessage());
      throw new Error('Akses cetak rekap harian ditolak');
    }
    const toastId = showLoading("Menyiapkan PDF A3...");
    try {
      const pdfBase64 = await generateRecapDrivePdfBase64({
        reports,
        kind: 'daily',
        title: recapTitle,
        periodLabel: `Tanggal: ${selectedDate === "semua" ? "Semua Tanggal" : new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        logoMedanUrl: logoMode === "with-logo" ? LOGO_MEDAN_URL : "",
        logoDlhUrl: logoMode === "with-logo" ? LOGO_DLH_URL : "",
        visibleColumns: { ...visibleColumns, date: false },
        fuelMode: visibleColumns.fuel ? 'daily' : 'none',
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
    } catch (error: unknown) {
      logger.error('Error uploading to Drive', error);
      showError("Gagal mengunggah: " + getErrorMessage(error));
      throw error;
    } finally {
      dismissToast(toastId);
    }
  };

  const handleExportExcel = async () => {
    if (!canPrintDailyRecap()) {
      showError(printAccessDeniedMessage());
      return;
    }
    if (reports.length === 0) {
      showError("Tidak ada data untuk diekspor");
      return;
    }
    const toastId = showLoading("Menyiapkan file Excel...");
    try {
      // Lazy load ExcelJS only when export is triggered
      const ExcelJS = await loadExcelJS() as any;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Harian');
      const columns: ExcelColumn[] = [{ header: 'No', key: 'no', width: 5 }];
      if (visibleColumns.category) columns.push({ header: 'Tim/Kec.', key: 'cat', width: 15 });
      if (visibleColumns.description) columns.push({ header: 'Uraian Kegiatan', key: 'desc', width: 30 });
      if (visibleColumns.location) columns.push({ header: 'Lokasi', key: 'loc', width: 40 });
      if (visibleColumns.photos) {
        columns.push({ header: '0%', key: 'p0', width: 22 }, { header: '50%', key: 'p50', width: 22 }, { header: '100%', key: 'p100', width: 22 });
      }
      if (visibleColumns.volume) columns.push({ header: 'Vol', key: 'vol', width: 10 });
      if (visibleColumns.equipment) {
        columns.push({ header: 'Jenis Alat', key: 'eq_type', width: 20 }, { header: 'Jumlah Alat', key: 'eq_qty', width: 10 });
      }
      if (visibleColumns.heavyEquipment) columns.push({ header: 'Alat Berat', key: 'he', width: 25 });
      if (visibleColumns.fuel) {
        columns.push(
          { header: 'Pertamax (Rp)', key: 'fp', width: 14 }, { header: 'Pertamax (L)', key: 'fpl', width: 12 },
          { header: 'Dexlite (Rp)', key: 'fd', width: 14 }, { header: 'Dexlite (L)', key: 'fdl', width: 12 }
        );
      }
      if (visibleColumns.coordinator) columns.push({ header: 'Koordinator', key: 'coord', width: 20 });
      if (visibleColumns.members) columns.push({ header: 'Anggota', key: 'members', width: 10 });
      if (visibleColumns.remarks) columns.push({ header: 'Keterangan', key: 'rem', width: 35 });

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
      const headerRow = worksheet.addRow(columns.map((c: ExcelColumn) => c.header));
      headerRow.eachCell((cell: unknown) => {
        const typedCell = cell as any;
        typedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
        typedCell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
        typedCell.alignment = { horizontal: 'center', vertical: 'middle' };
        typedCell.font = { bold: true };
      });
      let displayIdx = 1;
      for (const report of reports) {
        for (let i = 0; i < report.tasks.length; i++) {
          const task = report.tasks[i];
          const villages = Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village;
          const rowData: DailyRecapRowData = {
            no: i === 0 ? displayIdx : '',
            cat: i === 0 ? report.category : '',
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
          if (visibleColumns.fuel) {
            const pertamax = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.pertamax || 0), 0) || 0;
            const pertamaxLiter = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.pertamax_liter || 0), 0) || 0;
            const dexlite = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.dexlite || 0), 0) || 0;
            const dexliteLiter = task.heavyEquipment?.reduce((acc, he) => acc + (he.fuel?.dexlite_liter || 0), 0) || 0;
            rowData.fp = pertamax ? pertamax.toLocaleString('id-ID') : '';
            rowData.fpl = pertamaxLiter || '';
            rowData.fd = dexlite ? dexlite.toLocaleString('id-ID') : '';
            rowData.fdl = dexliteLiter || '';
          }
          const row = worksheet.addRow(rowData);
          if (visibleColumns.photos) row.height = 100;
          row.eachCell((cell: unknown) => {
            const typedCell = cell as any;
            typedCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            typedCell.alignment = { vertical: 'middle', wrapText: true };
          });
          if (visibleColumns.photos) {
            const addImageToCell = async (url: string, colIndex: number) => {
              if (!url) return;
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'jpeg' });
                worksheet.addImage(imageId, { tl: { col: colIndex - 1, row: row.number - 1 }, ext: { width: 140, height: 130 }, editAs: 'oneCell' });
              } catch (e) { logger.error('Error adding image to Excel', e); }
            };
            // Hitung index kolom foto secara dinamis
            let photoStartCol = 5; // Default jika kategori, uraian, dan lokasi ada
            if (!visibleColumns.category) photoStartCol--;
            if (!visibleColumns.description) photoStartCol--;
            if (!visibleColumns.location) photoStartCol--;
            
            await addImageToCell(task.photos.zero, photoStartCol);
            await addImageToCell(task.photos.fifty, photoStartCol + 1);
            await addImageToCell(task.photos.hundred, photoStartCol + 2);
          }
        }
        displayIdx++;
      }
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Rekap_Harian_DLH_${selectedDate}.xlsx`);
      dismissToast(toastId);
      showSuccess("Rekap Excel berhasil diunduh");
    } catch (error) {
      logger.error('Error exporting Excel', error);
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
  const recapTitle = getReportRecapTitle('harian', reports.map(report => report.category));

  const headerStyle = { backgroundColor: '#42FF41', color: '#000000', fontWeight: 'bold', textAlign: 'center' as const, verticalAlign: 'middle' as const, WebkitPrintColorAdjust: 'exact' as const, printColorAdjust: 'exact' as const };
  const subHeaderStyle = headerStyle;

  const totalPertamax = reports.reduce((acc, r) => acc + r.tasks.reduce((tAcc, t) => tAcc + (t.heavyEquipment?.reduce((heAcc, he) => heAcc + (he.fuel?.pertamax || 0), 0) || 0), 0), 0);
  const totalPertamaxLtr = reports.reduce((acc, r) => acc + r.tasks.reduce((tAcc, t) => tAcc + (t.heavyEquipment?.reduce((heAcc, he) => heAcc + (he.fuel?.pertamax_liter || 0), 0) || 0), 0), 0);
  const totalDexlite = reports.reduce((acc, r) => acc + r.tasks.reduce((tAcc, t) => tAcc + (t.heavyEquipment?.reduce((heAcc, he) => heAcc + (he.fuel?.dexlite || 0), 0) || 0), 0), 0);
  const totalDexliteLtr = reports.reduce((acc, r) => acc + r.tasks.reduce((tAcc, t) => tAcc + (t.heavyEquipment?.reduce((heAcc, he) => heAcc + (he.fuel?.dexlite_liter || 0), 0) || 0), 0), 0);
  const displayFuel = (value?: number, currency = false) => value ? (currency ? value.toLocaleString('id-ID') : value) : '';

  const renderReportRows = (report: Report, reportIdx: number) => {
    return report.tasks.map((task, taskIdx) => {
      const villages = Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village;
      return (
        <tr key={`${report.id}-${taskIdx}`}>
          {taskIdx === 0 ? (
            <>
              <td className="border-2 border-black p-2 text-center align-top font-bold" rowSpan={report.tasks.length}>
                {reportIdx + 1}
              </td>
              {visibleColumns.category && (
                <td className="border-2 border-black p-2 text-center align-top font-bold text-blue-700" rowSpan={report.tasks.length}>
                  {report.category}
                </td>
              )}
            </>
          ) : null}
          {visibleColumns.description && <td className="border-2 border-black p-2 align-top whitespace-normal break-words leading-tight">{task.description}</td>}
          {visibleColumns.location && <td className="border-2 border-black p-2 align-top whitespace-normal break-words leading-tight">{`${task.location.street}, ${villages}, ${task.location.subDistrict}`}</td>}
          {visibleColumns.photos && (
            <>
              <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.zero ? <img src={storageService.getDisplayImageUrl(task.photos.zero)} className="w-full h-full object-fill" alt="0%" loading="lazy" /> : null}</div></td>
              <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.fifty ? <img src={storageService.getDisplayImageUrl(task.photos.fifty)} className="w-full h-full object-fill" alt="50%" loading="lazy" /> : null}</div></td>
              <td className="border-2 border-black p-1 align-middle"><div className="w-full h-[110px] bg-slate-100 border border-slate-300 overflow-hidden">{task.photos?.hundred ? <img src={storageService.getDisplayImageUrl(task.photos.hundred)} className="w-full h-full object-fill" alt="100%" loading="lazy" /> : null}</div></td>
            </>
          )}
          {visibleColumns.volume && <td className="border-2 border-black p-2 text-center font-bold align-top">{task.volume} {getUnitByCategory(report.category)}</td>}
          {visibleColumns.equipment && (
            <>
              <td className="border border-black p-0 align-top text-[10px] leading-tight">{task.equipment?.map((e, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0 whitespace-nowrap">• {e.type}</div>))}</td>
              <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.equipment?.map((e, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{e.quantity}</div>))}</td>
            </>
          )}
          {visibleColumns.heavyEquipment && <td className="border border-black p-0 align-top text-[10px] leading-tight overflow-hidden">{task.heavyEquipment?.map((he, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0 whitespace-nowrap">• {he.type} {he.vehicle || ""}</div>))}</td>}
          {visibleColumns.fuel && (
            <>
              <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{displayFuel(he.fuel?.pertamax, true)}</div>))}</td>
              <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{displayFuel(he.fuel?.pertamax_liter)}</div>))}</td>
              <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{displayFuel(he.fuel?.dexlite, true)}</div>))}</td>
              <td className="border border-black p-0 align-top text-[10px] text-center leading-tight">{task.heavyEquipment?.map((he, i) => (<div key={i} className="min-h-5 px-1 py-0.5 border-b border-black last:border-b-0">{displayFuel(he.fuel?.dexlite_liter)}</div>))}</td>
            </>
          )}
          {visibleColumns.coordinator && <td className="border-2 border-black p-2 text-center align-top font-medium">{task.personnel.coordinator}</td>}
          {visibleColumns.members && <td className="border-2 border-black p-2 text-center align-top font-medium">{task.personnel.members}</td>}
          {visibleColumns.remarks && (
            <td className="border-2 border-black p-2 align-top whitespace-normal break-words italic">
              <div className="space-y-1">
                {task.remarks && <div>{task.remarks}</div>}
                {taskIdx === 0 && report.remarks && (
                  <div className={cn("text-blue-700 font-medium", task.remarks && "border-t border-slate-200 pt-1")}>
                    Catatan: {report.remarks}
                  </div>
                )}
                {!task.remarks && (taskIdx !== 0 || !report.remarks) && "-"}
              </div>
            </td>
          )}
        </tr>
      );
    });
  };

  const getColGroup = () => {
    const cols = [];
    cols.push(<col key="no" style={{ width: '35px' }} />);
    if (visibleColumns.category) cols.push(<col key="cat" style={{ width: '75px' }} />);
    if (visibleColumns.description) cols.push(<col key="desc" style={{ width: '105px' }} />);
    if (visibleColumns.location) cols.push(<col key="loc" style={{ width: '110px' }} />);
    if (visibleColumns.photos) {
      cols.push(<col key="p0" style={{ width: '145px' }} />);
      cols.push(<col key="p50" style={{ width: '145px' }} />);
      cols.push(<col key="p100" style={{ width: '145px' }} />);
    }
    if (visibleColumns.volume) cols.push(<col key="vol" style={{ width: '65px' }} />);
    if (visibleColumns.equipment) {
      cols.push(<col key="eq_t" style={{ width: '90px' }} />);
      cols.push(<col key="eq_q" style={{ width: '25px' }} />);
    }
    if (visibleColumns.heavyEquipment) cols.push(<col key="he" style={{ width: '120px' }} />);
    if (visibleColumns.fuel) {
      cols.push(<col key="fp_r" style={{ width: '45px' }} />);
      cols.push(<col key="fp_l" style={{ width: '35px' }} />);
      cols.push(<col key="fd_r" style={{ width: '45px' }} />);
      cols.push(<col key="fd_l" style={{ width: '35px' }} />);
    }
    if (visibleColumns.coordinator) cols.push(<col key="coord" style={{ width: '90px' }} />);
    if (visibleColumns.members) cols.push(<col key="mem" style={{ width: '50px' }} />);
    if (visibleColumns.remarks) cols.push(<col key="rem" style={{ width: '160px' }} />);
    return <colgroup>{cols}</colgroup>;
  };

  const getTableHeader = () => {
    return (
      <thead className="pdf-table-header">
        <tr style={{ height: '40px' }}>
          <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">No</div></th>
          {visibleColumns.category && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Tim/Kec.</div></th>}
          {visibleColumns.description && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Uraian Kegiatan</div></th>}
          {visibleColumns.location && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Lokasi</div></th>}
          {visibleColumns.photos && (<th style={headerStyle} className="border-2 border-black p-2" colSpan={3}>Dokumentasi</th>)}
          {visibleColumns.volume && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Vol</div></th>}
          {visibleColumns.equipment && <th style={headerStyle} className="border-2 border-black p-2" colSpan={2}>Peralatan</th>}
          {visibleColumns.heavyEquipment && <th style={headerStyle} className="border-2 border-black p-1" colSpan={visibleColumns.fuel ? 5 : 1}>Alat Operasional</th>}
          {!visibleColumns.heavyEquipment && visibleColumns.fuel && (<th style={headerStyle} className="border-2 border-black p-1" colSpan={4}>BBM (Voucher Rp & Liter)</th>)}
          {visibleColumns.coordinator && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Koordinator</div></th>}
          {visibleColumns.members && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Anggota</div></th>}
          {visibleColumns.remarks && <th style={headerStyle} className="border-2 border-black p-2" rowSpan={2}><div className="flex items-center justify-center h-full">Keterangan</div></th>}
        </tr>
        <tr style={{ height: '30px' }}>
          {visibleColumns.photos && (<><th style={subHeaderStyle} className="border-2 border-black p-1">0%</th><th style={subHeaderStyle} className="border-2 border-black p-1">50%</th><th style={subHeaderStyle} className="border-2 border-black p-1">100%</th></>)}
          {visibleColumns.equipment && (<><th style={subHeaderStyle} className="border-2 border-black p-1">Jenis Alat</th><th style={subHeaderStyle} className="border-2 border-black p-1 px-0">Jml</th></>)}
          {visibleColumns.heavyEquipment && <th style={subHeaderStyle} className="border-2 border-black p-1 text-[8px]">Nama Alat Berat</th>}
          {visibleColumns.fuel && (
            <>
              <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Pertamax (Rp)</th>
              <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Pertamax (L)</th>
              <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Dexlite (Rp)</th>
              <th style={subHeaderStyle} className="border-2 border-black p-1 text-[7px] leading-tight">Dexlite (L)</th>
            </>
          )}
        </tr>
      </thead>
    );
  };

  const getTotalColSpan = () => {
    let span = 1; // No
    if (visibleColumns.category) span++;
    if (visibleColumns.description) span++;
    if (visibleColumns.location) span++;
    if (visibleColumns.photos) span += 3;
    if (visibleColumns.volume) span++;
    if (visibleColumns.equipment) span += 2;
    if (visibleColumns.heavyEquipment) span++;
    return span;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="recap-sticky-toolbar max-w-[1400px] mx-auto space-y-6 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/?tab=reports')} className="px-2 md:px-4 h-9">
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
            <div className="flex items-center gap-2">
              <Select value={selectedDate === "semua" ? "semua" : "custom"} onValueChange={(v) => {
                if (v === "semua") setSelectedDate("semua");
                else setSelectedDate(new Date().toISOString().split('T')[0]);
              }}>
                <SelectTrigger className="w-[110px] md:w-[160px] bg-slate-50 border-slate-200 h-10 text-xs md:text-sm">
                  <SelectValue placeholder="Pilih Tanggal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Tanggal</SelectItem>
                  <SelectItem value="custom">Pilih Tanggal...</SelectItem>
                </SelectContent>
              </Select>
              {selectedDate !== "semua" && (
                <div className="relative">
                  <Calendar className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-slate-400" />
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-7 md:pl-10 w-[130px] md:w-[180px] h-10 text-xs md:text-sm" />
                </div>
              )}
            </div>
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
                    {availableCategories.map((cat) => (<div key={cat} className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-md cursor-pointer" onClick={() => toggleCategory(cat)}><Checkbox checked={selectedCategories.includes(cat)} /><label className="text-sm font-medium leading-none cursor-pointer">{cat}</label></div>))}
                  </div>
                </PopoverContent>
              </Popover>
              {isUserRestricted && <div className="absolute -top-2 -right-2 bg-amber-100 text-amber-700 p-1 rounded-full border border-amber-200 shadow-sm"><Lock size={10} /></div>}
            </div>

          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-3 md:px-4">
                  <FileText className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Menu Rekap</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-72">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Settings2 className="mr-2 h-4 w-4 text-blue-600" /> Pilih Kolom
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    {Object.entries({
                      category: "Tim/Kec.",
                      description: "Uraian Kegiatan",
                      location: "Lokasi",
                      photos: "Dokumentasi",
                      volume: "Volume",
                      equipment: "Peralatan",
                      heavyEquipment: "Alat Berat",
                      fuel: "BBM",
                      coordinator: "Koordinator",
                      members: "Anggota",
                      remarks: "Keterangan"
                    }).map(([key, label]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => setLogoMode(logoMode === 'with-logo' ? 'without-logo' : 'with-logo')} className="cursor-pointer py-2">
                  {logoMode === 'with-logo' ? <ImageOff className="mr-2 h-4 w-4 text-slate-500" /> : <ImageIcon className="mr-2 h-4 w-4 text-green-600" />}
                  Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSignatureMode(signatureMode === 'with-signature' ? 'without-signature' : 'with-signature')} className="cursor-pointer py-2">
                  <PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}
                </DropdownMenuItem>
                {isLoggedIn && reports.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Data
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 w-[calc(100vw-2rem)] max-w-80">
                      {reports.map((report) => (
                        <DropdownMenuItem key={report.id} onClick={() => navigate(`/edit/${report.id}`)} className="cursor-pointer whitespace-normal">
                          {report.category} — {report.description || "Laporan Harian"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                {isLoggedIn && (
                  <DropdownMenuItem onClick={() => setIsDriveDialogOpen(true)} disabled={reports.length === 0 || !canPrintDailyRecap()} className="cursor-pointer py-2">
                    <CloudUpload className="mr-2 h-4 w-4 text-blue-600" /> Simpan ke Drive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handlePrint} disabled={!canPrintDailyRecap()} className="cursor-pointer py-2">
                  <Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSharePdf} disabled={!canPrintDailyRecap()} className="cursor-pointer py-2">
                  <Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} disabled={!canPrintDailyRecap()} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canPrintDailyRecap() && <DropdownMenuItem onClick={() => navigate('/daily-rekap')} className="cursor-pointer py-2">
                  <Calendar className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                </DropdownMenuItem>}
                {canPrintReportRecap(profile?.role, 'weekly', session?.user?.email) && <DropdownMenuItem onClick={() => navigate('/weekly-rekap')} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-purple-500" /> Rekap Mingguan
                </DropdownMenuItem>}
                {canPrintReportRecap(profile?.role, 'monthly', session?.user?.email) && <DropdownMenuItem onClick={() => navigate('/monthly-rekap')} className="cursor-pointer py-2">
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
        defaultFileName={`Rekap_Harian_DLH_${selectedDate}`}
      />
      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="Keluar dari Sistem"
        description="Anda akan keluar dari sistem. Pastikan semua data sudah tersimpan."
        variant="logout"
        confirmLabel="Ya, Keluar"
        onConfirm={async () => {
          try {
            await signOut();
            navigate('/login');
            showSuccess("Berhasil keluar");
          } catch (error) {
            showError("Gagal keluar");
          }
        }}
      />

      <div ref={printRef} className="print-area recap-print-area bg-white p-4 md:p-10 mx-auto shadow-lg border min-h-[297mm] w-full max-w-[420mm]">
        <div className="pdf-header text-center mb-5 leading-tight">
          <h1 className="text-[11px] font-bold uppercase">Pemerintah Kota Medan</h1>
          <h2 className="text-[13px] font-black uppercase">Dinas Lingkungan Hidup</h2>
          <h3 className="text-[10px] font-bold uppercase mt-1">Laporan Harian Kegiatan</h3>
        </div>

        <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
          {reports.length > 0 ? (
            <>
              <table className="w-full min-w-[1200px] border-collapse border-2 border-black text-[11px] table-fixed print:w-full print:min-w-0">
                {getColGroup()}
                {getTableHeader()}
                {reports.slice(0, -1).map((report, reportIdx) => (
                  <tbody key={report.id} className="pdf-report-block border-b-2 border-black">
                    {renderReportRows(report, reportIdx)}
                  </tbody>
                ))}
              </table>

              <div className="keep-together">
                <table className="w-full min-w-[1200px] border-collapse border-2 border-black text-[11px] table-fixed print:w-full print:min-w-0 border-t-0">
                  {getColGroup()}
                  <tbody className="pdf-report-block border-b-2 border-black">
                    {renderReportRows(reports[reports.length - 1], reports.length - 1)}
                    
                    {visibleColumns.fuel && (
                      <tr className="bg-slate-50 font-black">
                        <td className="border-2 border-black p-2 text-right" colSpan={getTotalColSpan()}>TOTAL PEMAKAIAN BBM:</td>
                        <td className="border-2 border-black p-1 text-center text-[9px]">{totalPertamax.toLocaleString('id-ID')}</td>
                        <td className="border-2 border-black p-1 text-center text-[9px] bg-blue-50/50">{totalPertamaxLtr.toFixed(2)}</td>
                        <td className="border-2 border-black p-1 text-center text-[9px]">{totalDexlite.toLocaleString('id-ID')}</td>
                        <td className="border-2 border-black p-1 text-center text-[9px] bg-green-50/50">{totalDexliteLtr.toFixed(2)}</td>
                        <td className="border-2 border-black p-2" colSpan={(visibleColumns.coordinator?1:0) + (visibleColumns.members?1:0) + (visibleColumns.remarks?1:0)}></td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {signatureMode === "with-signature" && (
                  <div className="pdf-footer mt-12">
                    <div className="flex justify-end mb-4 text-[11px]"><p className="w-1/3 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                    <div className="grid grid-cols-3 gap-4 text-[11px] leading-normal">
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><SignatoryText position="kabid_tata_lingkungan" fallbackName="Heni Rustati, ST, M.Si" fallbackNip="NIP. 19720223 200604 2 002" /></div></div>
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><SignatoryText position="ketua_tim_pemeliharaan_lingkungan" fallbackName="Anitha Florida Ginting, ST, M. Si" fallbackNip="NIP. 19811128 201001 2 011" /></div></div>
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4">
                        <div>
                          <p>Diketahui :</p>
                          <p className="font-bold">Kepala Koordinator Pemeliharaan Taman</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p>
                        </div>
                        <div><SignatoryText position="kepala_koordinator_taman" regionId={profile?.region_id} categories={selectedCategories} fallbackName={coordinatorSignature.name} fallbackNip={coordinatorSignature.nip} /></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-[11px] table-fixed">
              <tbody>
                <tr><td colSpan={20} className="border-2 border-black p-12 text-center text-slate-400 italic text-lg">{loading ? 'Memuat data rekap...' : 'Tidak ada data laporan untuk periode ini'}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyRecap;
