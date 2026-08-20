"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkPlan, WorkPlanItem } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Calendar as CalendarIcon, PenTool, Plus, ChevronDown, Table, FileText, Image, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { sortByCategory } from '@/utils/report-helpers';
import {
  getRowsInWorkPlanItems,
  getSequentialSpans,
  getUniqueWorkPlanItems,
  getWorkPlanBasisKey,
  getWorkPlanRemarkKey,
} from '@/utils/work-plan-display';
import { useAuth } from '@/context/AuthContext';
import { useRegionName } from '@/hooks/useRegionName';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { exportWorkPlanExcel } from '@/utils/work-plan-excel';
import { WorkPlanColumnPicker } from '@/components/WorkPlanColumnPicker';
import { dismissToast, showError, showLoading, showSuccess } from '@/utils/toast';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { weeklyPdfFileName } from '@/utils/pdf-file-name';
import { getRecapCategoryLabel } from '@/utils/report-recap-title';
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

type SignatureMode = "with-signature" | "without-signature";
type LogoMode = "with-logo" | "without-logo";

const workPlanColumnLabels = {
  date: "Hari/Tanggal", category: "Tim/Kec.", description: "Detail Kegiatan", location: "Lokasi",
  tools: "Alat Operasional", unit: "Unit", usage: "Kegunaan", personnel: "Personel",
  coordinator: "Koordinator", basis: "Dasar Pengerjaan", remarks: "Keterangan",
};

type WeeklyTableRow =
  | {
      type: "noActivity";
      plan: WorkPlan;
      date: string;
    }
  | {
      type: "work";
      plan: WorkPlan;
      item: WorkPlanItem;
      itemToolsLength: number;
      tool: WorkPlanItem["tools"][number];
      itemIndex: number;
      toolIndex: number;
      date: string;
      showTools: boolean;
      toolRows: number;
      showTeam: boolean;
      teamRows: number;
      showBasis: boolean;
      basisRows: number;
      descriptionSpanRows: number;
      showRemarks: boolean;
      remarkRows: number;
      alignTreeTools: boolean;
    };

const WorkPlanWeeklyRecap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || session?.user?.email === 'admin@gmail.com';
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') || "semua");
  const { regions } = useRegionFilterOptions(isAdmin, selectedRegion);
  const regionId = isAdmin ? (selectedRegion === 'semua' ? null : selectedRegion) : profile?.region_id;
  const regionName = useRegionName(regionId, isAdmin && selectedRegion === 'semua' ? 'SEMUA WILAYAH' : undefined);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || "semua");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("without-signature");
  const [logoMode, setLogoMode] = useState<LogoMode>("without-logo");
  const [visibleColumns, setVisibleColumns] = useState({ date: true, category: true, description: true, location: true, tools: true, unit: true, usage: true, personnel: true, coordinator: true, basis: true, remarks: true });
  const printRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const isLoggedIn = !!session;
  const getRegionOrder = (regionId: string | null | undefined) => {
    const regionIndex = regions.findIndex((region) => region.id === regionId);
    return regionIndex === -1 ? Number.MAX_SAFE_INTEGER : regionIndex;
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedCategory, regionId, regions]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await workPlanService.getAllWorkPlans(undefined, false, regionId);
      setAvailableCategories(Array.from(new Set(data.map((plan) => plan.category))).sort((first, second) => first.localeCompare(second)));
      const filtered = data.filter(p => {
        const pDate = parseISO(p.date);
        return isWithinInterval(pDate, { start: weekStart, end: weekEnd }) &&
          (selectedCategory === 'semua' || p.category === selectedCategory) &&
          p.is_visible !== false;
      });

      filtered.sort((a, b) => {
        if (isAdmin && selectedRegion === 'semua') {
          const regionDiff = getRegionOrder(a.region_id) - getRegionOrder(b.region_id);
          if (regionDiff !== 0) return regionDiff;
        }
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return sortByCategory(a.category, b.category);
      });

      setPlans(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const hasRemarks = plans.some(plan => plan.items.some(item => item.remarks && item.remarks.trim() !== ""));
  const toggleColumn = (column: keyof typeof visibleColumns) => setVisibleColumns((current) => ({ ...current, [column]: !current[column] }));
  const recapTitle = `REKAP RENCANA KERJA MINGGUAN ${getRecapCategoryLabel(plans.map((plan) => plan.category))}`;

  const handleExportExcel = async () => {
    const toastId = showLoading("Menyiapkan rekap Excel...");
    try {
      const startLabel = format(weekStart, "dd MMMM yyyy", { locale: localeId });
      const endLabel = format(weekEnd, "dd MMMM yyyy", { locale: localeId });
      await exportWorkPlanExcel({
        plans,
        title: recapTitle,
        periodLabel: `Periode: ${startLabel} s.d. ${endLabel}`,
        fileName: `Rekap_Rencana_Kerja_Mingguan_${format(weekStart, "yyyy-MM-dd")}_sd_${format(weekEnd, "yyyy-MM-dd")}.xlsx`,
        includeLogo: logoMode === "with-logo",
        logoMedanUrl: LOGO_MEDAN_URL,
        logoDlhUrl: LOGO_DLH_URL,
      });
      showSuccess("Rekap Excel berhasil disimpan");
    } catch (error) {
      console.error(error);
      showError("Gagal membuat rekap Excel");
    } finally {
      dismissToast(toastId);
    }
  };

  const handleSharePdf = async () => {
    if (!printRef.current) return;
    const toastId = showLoading("Menyiapkan pratinjau PDF...");
    try {
      await openShareablePdfPreview({
        fileName: weeklyPdfFileName("Rencana Kerja Mingguan", weekStart, weekEnd, regionName),
      });
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : "Gagal membuat PDF untuk dibagikan");
    } finally {
      dismissToast(toastId);
    }
  };

  const categoriesInPlans = Array.from(new Set(plans.map(p => p.category)));
  const showTiurmaida = categoriesInPlans.some(c => ["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram"].includes(c));
  const showArdiansyah = categoriesInPlans.some(c => ["Tim Pohon"].includes(c));

  const getTableSpans = () => {
    const noSpans: number[] = [];
    const dateSpans: number[] = [];
    let currentNo = 0;
    let lastDate = "";

    const rows: WeeklyTableRow[] = [];
    plans.forEach((plan) => {
      const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
      if (isNoActivity) {
        rows.push({ type: "noActivity", plan, date: plan.date });
      } else {
        const displayItems = getUniqueWorkPlanItems(plan.items);
        const descriptionSpans = getSequentialSpans(displayItems, (item) => item.description.trim());
        const toolSpans = getSequentialSpans(displayItems, (item) => JSON.stringify(item.tools));
        const teamSpans = getSequentialSpans(displayItems, (item) => plan.category === "Tim Pohon" ? item.coordinator : `${item.coordinator}|${item.personnel.members}`);
        const basisSpans = getSequentialSpans(displayItems, (item) => getWorkPlanBasisKey(item.basis));
        const remarksSpans = getSequentialSpans(displayItems, getWorkPlanRemarkKey);

        displayItems.forEach((item, itemIndex) => {
          const isTreeLayout = plan.category === "Tim Pohon";
          let toolGroupStart = itemIndex;
          while (toolGroupStart > 0 && toolSpans[toolGroupStart] === 0) toolGroupStart--;
          const sharedTreeTools = displayItems[toolGroupStart]?.tools || [];
          const treeToolOffset = itemIndex - toolGroupStart;
          const alignTreeTools = isTreeLayout && toolSpans[toolGroupStart] === sharedTreeTools.length && toolSpans[toolGroupStart] > 1;
          const alignedTreeTool = alignTreeTools ? sharedTreeTools[treeToolOffset] : undefined;
          const toolsToRender = isTreeLayout ? [alignedTreeTool || item.tools[0] || { name: "", unit: 0, usage: "", members: 0 }] : (item.tools.length > 0 ? item.tools : [{ name: "", unit: 0, usage: "" }]);
          toolsToRender.forEach((tool, toolIndex) => {
            const descriptionSpan = descriptionSpans[itemIndex];
            const toolSpan = toolSpans[itemIndex];
            const teamSpan = teamSpans[itemIndex];
            const basisSpan = basisSpans[itemIndex];
            const remarksSpan = remarksSpans[itemIndex];

            rows.push({
              plan,
              type: "work",
              item,
              itemToolsLength: isTreeLayout ? 1 : Math.max(item.tools.length, 1),
              tool,
              itemIndex,
              toolIndex,
              date: plan.date,
              showTools: toolIndex === 0 && toolSpan > 0,
              toolRows: toolSpan > 0 ? (isTreeLayout ? toolSpan : getRowsInWorkPlanItems(displayItems.slice(itemIndex, itemIndex + toolSpan))) : 0,
              showTeam: toolIndex === 0 && teamSpan > 0,
              teamRows: teamSpan > 0 ? (isTreeLayout ? teamSpan : getRowsInWorkPlanItems(displayItems.slice(itemIndex, itemIndex + teamSpan))) : 0,
              showBasis: toolIndex === 0 && basisSpan > 0,
              basisRows: basisSpan > 0 ? (isTreeLayout ? basisSpan : getRowsInWorkPlanItems(displayItems.slice(itemIndex, itemIndex + basisSpan))) : 0,
              descriptionSpanRows: toolIndex === 0 && descriptionSpan > 0 ? (isTreeLayout ? descriptionSpan : getRowsInWorkPlanItems(displayItems.slice(itemIndex, itemIndex + descriptionSpan))) : 0,
              showRemarks: toolIndex === 0 && remarksSpan > 0,
              remarkRows: remarksSpan > 0 ? (isTreeLayout ? remarksSpan : getRowsInWorkPlanItems(displayItems.slice(itemIndex, itemIndex + remarksSpan))) : 0,
              alignTreeTools,
            });
          });
        });
      }
    });

    rows.forEach((row, idx) => {
      if (row.date !== lastDate) {
        currentNo++;
        lastDate = row.date;
        const sameDateRows = rows.filter((r) => r.date === row.date);
        noSpans[idx] = sameDateRows.length;
        dateSpans[idx] = sameDateRows.length;
      } else {
        noSpans[idx] = 0;
        dateSpans[idx] = 0;
      }
    });

    return { rows, noSpans, dateSpans };
  };

  const { rows, noSpans, dateSpans } = getTableSpans();
  const showRegionColumn = isAdmin && selectedRegion === 'semua';
  const getPlanRegionName = (plan: WorkPlan) => regions.find((region) => region.id === plan.region_id)?.name || '-';

  const colGroup = (
    <colgroup>
      <col style={{ width: '30px' }} />
      {showRegionColumn && <col style={{ width: '60px' }} />}
      <col style={{ width: '60px', display: visibleColumns.date ? undefined : 'none' }} />
      <col style={{ width: '60px', display: visibleColumns.category ? undefined : 'none' }} />
      <col style={{ width: '120px', display: visibleColumns.description ? undefined : 'none' }} />
      <col style={{ width: '130px', display: visibleColumns.location ? undefined : 'none' }} />
      <col style={{ width: '120px', display: visibleColumns.tools ? undefined : 'none' }} />
      <col style={{ width: '30px', display: visibleColumns.unit ? undefined : 'none' }} />
      <col style={{ width: '100px', display: visibleColumns.usage ? undefined : 'none' }} />
      <col style={{ width: '40px', display: visibleColumns.personnel ? undefined : 'none' }} />
      <col style={{ width: '80px', display: visibleColumns.coordinator ? undefined : 'none' }} />
      <col style={{ width: '100px', display: visibleColumns.basis ? undefined : 'none' }} />
      {hasRemarks && <col style={{ width: '130px', display: visibleColumns.remarks ? undefined : 'none' }} />}
    </colgroup>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/')} className="px-2 md:px-4 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
            </Button>
            {isAdmin && (
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-[150px] bg-slate-50 border-slate-200 h-10 text-xs md:text-sm"><SelectValue placeholder="Pilih Wilayah" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Wilayah</SelectItem>
                  {regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px] bg-slate-50 border-slate-200 h-10 text-xs md:text-sm"><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Kategori</SelectItem>
                {availableCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            <WorkPlanColumnPicker columns={visibleColumns} labels={workPlanColumnLabels} onToggle={toggleColumn} />
            <div className="relative">
              <CalendarIcon className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-slate-400" />
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-7 md:pl-10 w-[130px] md:w-[180px] h-10 text-xs md:text-sm" />
            </div>
            <div className="text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 px-2 md:px-3 py-2 rounded-md border border-blue-100">
              {format(weekStart, 'dd MMM', { locale: localeId })} - {format(weekEnd, 'dd MMM yy', { locale: localeId })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0">
            <Select value={logoMode} onValueChange={(v) => setLogoMode(v as LogoMode)}>
              <SelectTrigger className="w-[40px] shrink-0 md:w-[160px] bg-blue-50 border-blue-200 h-10 text-blue-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex min-w-0 items-center gap-2"><Image size={16} /><span className="hidden whitespace-nowrap md:inline"><SelectValue placeholder="Logo" /></span></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-logo">Dengan Logo</SelectItem>
                <SelectItem value="without-logo">Tanpa Logo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={signatureMode} onValueChange={(v) => setSignatureMode(v as SignatureMode)}>
              <SelectTrigger className="w-[40px] shrink-0 md:w-[180px] bg-amber-50 border-amber-200 h-10 text-amber-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex min-w-0 items-center gap-2">
                  <PenTool size={16} />
                  <span className="hidden whitespace-nowrap md:inline"><SelectValue placeholder="Tanda Tangan" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-signature">Ada Tanda Tangan</SelectItem>
                <SelectItem value="without-signature">Tanpa Tanda Tangan</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200 h-10 px-2 md:px-4">
                  <Printer className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Cetak Rekap</span>
                  <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer py-2">
                  <Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSharePdf} className="cursor-pointer py-2">
                  <Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                <DropdownMenuItem onClick={() => navigate(`/work-plans/daily-rekap${isAdmin && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="cursor-pointer py-2">
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/work-plans/weekly-rekap${isAdmin && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/work-plans/monthly-rekap${isAdmin && selectedRegion !== 'semua' ? `?region=${selectedRegion}` : ''}`)} className="cursor-pointer py-2">
                  <FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isLoggedIn && (
              <Button onClick={() => navigate('/work-plans/create')} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-2 md:px-4 h-10">
                <Plus className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Tambah Baru</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div ref={printRef} className="print-area recap-print-area bg-white p-10 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
          {logoMode === "with-logo" && <img src={LOGO_MEDAN_URL} className="h-20 w-20 object-contain" alt="Logo Medan" />}
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase">Pemerintah Kota Medan</h1>
            <h2 className="text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2>
            <p className="text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p>
          </div>
          {logoMode === "with-logo" && <img src={LOGO_DLH_URL} className="h-20 w-20 object-contain" alt="Logo DLH" />}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-bold underline uppercase">{recapTitle} {regionName}</h3>
          <p className="text-lg font-bold">Periode: {format(weekStart, 'dd MMMM', { locale: localeId })} s/d {format(weekEnd, 'dd MMMM yyyy', { locale: localeId })}</p>
        </div>

        <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
          {plans.length > 0 ? (
            <>
              <table className="w-full min-w-[1200px] border-collapse border-2 border-black text-[9px] table-fixed print:w-full print:min-w-0">
                {colGroup}
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-2 border-black p-1">No</th>
                    {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                    <th className="border-2 border-black p-1">Hari/Tgl</th>
                    <th className="border-2 border-black p-1">Tim/Kec</th>
                    <th className="border-2 border-black p-1">Detail Kegiatan</th>
                    <th className="border-2 border-black p-1">Lokasi</th>
                    <th className="border-2 border-black p-1">Alat Operasional</th>
                    <th className="border-2 border-black p-1">Unit</th>
                    <th className="border-2 border-black p-1">Kegunaan</th>
                    <th className="border-2 border-black p-1">Pers</th>
                    <th className="border-2 border-black p-1">Koordinator</th>
                    <th className="border-2 border-black p-1">Dasar Pengerjaan</th>
                    {hasRemarks && <th className="border-2 border-black p-1">Keterangan</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let currentNo = 0;
                    let lastDate = "";
                    return rows.map((row, idx) => {
                      if (row.date !== lastDate) {
                        currentNo++;
                        lastDate = row.date;
                      }

                      if (row.type === "noActivity") {
                        return (
                          <tr key={`no-act-${idx}`}>
                            {noSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={noSpans[idx]}>{currentNo}</td>}
                            {showRegionColumn && <td className="border-2 border-black p-1 text-center align-middle font-bold whitespace-normal break-words">{getPlanRegionName(row.plan)}</td>}
                            {dateSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={dateSpans[idx]}>{format(parseISO(row.date), 'eee, dd/MM', { locale: localeId })}</td>}
                            <td className="border-2 border-black p-1 text-center align-middle font-bold">{row.plan.category}</td>
                            <td colSpan={8} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">TIDAK ADA RENCANA KERJA/ KEGIATAN</td>
                            {hasRemarks && <td className="border-2 border-black p-1 italic text-center align-middle break-words">{row.plan.items[0]?.remarks || "-"}</td>}
                          </tr>
                        );
                      }

                      const { plan, item, toolIndex } = row;
                      const planRows = rows.filter(r => r.plan?.id === plan.id);
                      const isFirstInPlan = planRows[0] === row;

                      return (
                        <tr key={`row-${idx}`}>
                          {noSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={noSpans[idx]}>{currentNo}</td>}
                          {showRegionColumn && isFirstInPlan && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal break-words" rowSpan={planRows.length}>{getPlanRegionName(plan)}</td>}
                          {dateSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={dateSpans[idx]}>{format(parseISO(row.date), 'eee, dd/MM', { locale: localeId })}</td>}
                          {isFirstInPlan && <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={planRows.length}>{plan.category}</td>}

                          {row.descriptionSpanRows > 0 && (
                            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={row.descriptionSpanRows}>{item.description}</td>
                          )}

                          {toolIndex === 0 && (
                            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={row.itemToolsLength}>{item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}</td>
                          )}

                          {row.plan.category === "Tim Pohon" ? (row.alignTreeTools ? (
                            <>
                              <td className="border-2 border-black p-1 text-center align-middle break-words">{row.tool.name ? `• ${row.tool.name}` : "-"}</td>
                              <td className="border-2 border-black p-1 text-center align-middle">{row.tool.unit || "-"}</td>
                              <td className="border-2 border-black p-1 text-center align-middle break-words">{row.tool.usage || "-"}</td>
                            </>
                          ) : row.showTools ? (
                            <>
                              <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={row.toolRows}>{item.tools.map((tool, toolIdx) => <div key={toolIdx} className={`h-16 flex items-center justify-center text-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.name ? `• ${tool.name}` : "-"}</div>)}</td>
                              <td className="border-2 border-black p-1 text-center align-middle" rowSpan={row.toolRows}>{item.tools.map((tool, toolIdx) => <div key={toolIdx} className={`h-16 flex items-center justify-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.unit || "-"}</div>)}</td>
                              <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={row.toolRows}>{item.tools.map((tool, toolIdx) => <div key={toolIdx} className={`h-16 flex items-center justify-center text-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.usage || "-"}</div>)}</td>
                            </>
                          ) : null) : row.showTools && (
                            <>
                              <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={row.toolRows}>
                                {item.tools.length > 0 ? item.tools.map((tool, toolIdx) => (
                                  <div key={toolIdx} className={`h-16 flex items-center justify-center text-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.name ? `• ${tool.name}` : "-"}</div>
                                )) : "-"}
                              </td>
                              <td className="border-2 border-black p-1 text-center align-middle" rowSpan={row.toolRows}>
                                {item.tools.length > 0 ? item.tools.map((tool, toolIdx) => (
                                  <div key={toolIdx} className={`h-16 flex items-center justify-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.unit || "-"}</div>
                                )) : "-"}
                              </td>
                              <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={row.toolRows}>
                                {item.tools.length > 0 ? item.tools.map((tool, toolIdx) => (
                                  <div key={toolIdx} className={`h-16 flex items-center justify-center text-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.usage || "-"}</div>
                                )) : "-"}
                              </td>
                            </>
                          )}

                          {row.plan.category === "Tim Pohon" ? (row.alignTreeTools ? (
                            <td className="border-2 border-black p-1 text-center align-middle">{row.tool.members ?? 0}</td>
                          ) : row.showTools ? (
                            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={row.toolRows}>{item.tools.map((tool, toolIdx) => <div key={toolIdx} className={`h-16 flex items-center justify-center ${toolIdx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{tool.members ?? 0}</div>)}</td>
                          ) : null) : row.showTeam && (
                            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={row.teamRows}>{item.personnel.members}</td>
                          )}
                          {row.showTeam && (
                            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={row.teamRows}>{item.coordinator}</td>
                          )}
                          {row.showBasis && (
                            <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={row.basisRows}>{item.basis}</td>
                          )}
                          {hasRemarks && row.showRemarks && <td className="border-2 border-black p-1 italic text-center align-middle break-words" rowSpan={row.remarkRows}>{item.remarks || "-"}</td>}
                        </tr>
                      );
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
                        {showTiurmaida && !showArdiansyah && (<><p className="font-bold">Kepala Koordinator Taman</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                        {showArdiansyah && !showTiurmaida && (<><p className="font-bold">Koordinator Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                        {showTiurmaida && showArdiansyah && (<><p className="font-bold">Koordinator Taman & Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                      </div>
                      <div>
                        {showTiurmaida && !showArdiansyah && (<><p className="font-bold underline">Tiurmaida Silitonga</p><p>NIP. 19690507 200701 2 042</p></>)}
                        {showArdiansyah && !showTiurmaida && (<><p className="font-bold underline">Ardiansyah Siregar</p><p>NIP. 19860404 201001 1 015</p></>)}
                        {showTiurmaida && showArdiansyah && (
                          <div className="flex justify-around gap-2">
                            <div><p className="font-bold underline">Tiurmaida Silitonga</p><p className="text-[9px]">NIP. 19690507 200701 2 042</p></div>
                            <div><p className="font-bold underline">Ardiansyah Siregar</p><p className="text-[9px]">NIP. 19860404 201001 1 015</p></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-[11px] table-fixed">
              <tbody>
                <tr><td colSpan={20} className="border-2 border-black p-12 text-center text-slate-400 italic text-lg">Tidak ada data laporan untuk periode ini</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .print-area td > div.border-t.border-black { border-top-width: 2px !important; }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print, [data-radix-portal], [role="menu"], [data-radix-popper-content-wrapper], .sonner-toaster {
            display: none !important;
            visibility: hidden !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }
          @page { size: A3 landscape; margin: 1.5cm; }
          .overflow-x-auto { overflow: visible !important; }
          table { width: 100% !important; }
          table thead { display: table-header-group !important; }
          table tr { break-inside: avoid; page-break-inside: avoid; }
          .keep-together { page-break-inside: avoid; break-inside: avoid; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />
    </div>
  );
};

export default WorkPlanWeeklyRecap;
