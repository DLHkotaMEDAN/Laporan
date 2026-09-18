"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkPlan } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, FileText, PenTool, Plus, ChevronDown, Table, Calendar as CalendarIcon, Image, Share2, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
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
import { isGlobalWorkPlanAdmin } from '@/constants/access-control';
import { useRegionName } from '@/hooks/useRegionName';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { exportWorkPlanExcel } from '@/utils/work-plan-excel';
import { WorkPlanColumnPicker } from '@/components/WorkPlanColumnPicker';
import WorkPlanRecapMenu from '@/components/WorkPlanRecapMenu';
import WorkPlanCompactTable, { workPlanCompactColumnLabels } from '@/components/WorkPlanCompactTable';
import { dismissToast, showError, showLoading, showSuccess } from '@/utils/toast';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { monthlyPdfFileName } from '@/utils/pdf-file-name';
import { getRecapCategoryLabel } from '@/utils/report-recap-title';
import {
  DropdownMenu,
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

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

type SignatureMode = "with-signature" | "without-signature";
type LogoMode = "with-logo" | "without-logo";
type TableMode = "complete" | "compact";

const workPlanColumnLabels = {
  date: "Hari/Tanggal", category: "Tim/Kec.", description: "Detail Kegiatan", location: "Lokasi", target_area: "Target Luas (M²)",
  tools: "Alat Operasional", unit: "Unit", personnel: "Personel",
  coordinator: "Koordinator", foreman: "Mandor", basis: "Dasar Pengerjaan", fuel_need_liters: "Kebutuhan BBM/Liter", fuel_usage_estimate: "Estimasi Penggunaan BBM (Liter)", remarks: "Keterangan",
};

const formatFuelLiters = (value?: number | string) => Number(value || 0) ? `${Number(value).toLocaleString('id-ID')} L` : "-";

const getInitialSelectedCategories = (searchParams: URLSearchParams) => {
  const categories = searchParams.get('categories');
  if (categories) return categories.split(',').map((category) => category.trim()).filter(Boolean);
  return [searchParams.get('category') || 'semua'];
};

const getSelectedCategoryLabel = (selectedCategories: string[]) => {
  if (selectedCategories.includes('semua')) return 'Semua Kategori';
  if (selectedCategories.length > 1) return `${selectedCategories.length} Kategori Terpilih`;
  return selectedCategories[0] || 'Pilih Kategori';
};

const WorkPlanMonthlyRecap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const isAdmin = isGlobalWorkPlanAdmin(profile?.role, session?.user?.email);
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') || "semua");
  const { regions } = useRegionFilterOptions(isAdmin, selectedRegion);
  const regionId = isAdmin ? (selectedRegion === 'semua' ? null : selectedRegion) : profile?.region_id;
  const regionName = useRegionName(regionId, isAdmin && selectedRegion === 'semua' ? 'SEMUA WILAYAH' : undefined);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedCategories, setSelectedCategories] = useState<string[]>(getInitialSelectedCategories(searchParams));
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("without-signature");
  const [logoMode, setLogoMode] = useState<LogoMode>("without-logo");
  const [tableMode, setTableMode] = useState<TableMode>("complete");
  const [userVisibleColumns, setVisibleColumns] = useState({ date: true, category: true, description: true, location: true, target_area: !isAdmin, tools: true, unit: true, personnel: true, coordinator: true, foreman: true, basis: true, fuel_need_liters: false, fuel_usage_estimate: true, remarks: true });
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  useEffect(() => {
    if (isAdmin) setVisibleColumns((current) => ({ ...current, target_area: false }));
  }, [isAdmin]);
  const printRef = useRef<HTMLDivElement>(null);
  const dataRequestId = useRef(0);

  const isLoggedIn = !!session;
  const regionOrderKey = regions.map((region) => region.id).join(',');
  const getRegionOrder = (regionId: string | null | undefined) => {
    const regionIndex = regions.findIndex((region) => region.id === regionId);
    return regionIndex === -1 ? Number.MAX_SAFE_INTEGER : regionIndex;
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => setIsCompactViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, selectedCategories, regionId, regionOrderKey]);

  useEffect(() => {
    setSelectedRegion(searchParams.get('region') || 'semua');
    setSelectedCategories(getInitialSelectedCategories(searchParams));
  }, [searchParams]);

  const loadData = async () => {
    const requestId = ++dataRequestId.current;
    try {
      setLoading(true);
      const data = await workPlanService.getAllWorkPlans(undefined, false, regionId);
      if (requestId !== dataRequestId.current) return;
      setAvailableCategories(Array.from(new Set(data.map((plan) => plan.category))).sort((first, second) => first.localeCompare(second)));
      const filtered = data.filter(p => {
        const pDate = parseISO(p.date);
        return (pDate.getMonth() + 1).toString() === selectedMonth &&
               pDate.getFullYear().toString() === selectedYear &&
               (selectedCategories.includes('semua') || selectedCategories.includes(p.category)) &&
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

      if (requestId === dataRequestId.current) setPlans(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === dataRequestId.current) setLoading(false);
    }
  };

  const hasRemarks = plans.some(plan => plan.items.some(item => item.remarks && item.remarks.trim() !== ""));
  const isTimSiramSelected = selectedCategories.includes("Tim Siram");
  const visibleColumns = { ...userVisibleColumns, target_area: userVisibleColumns.target_area && !isTimSiramSelected };
  const toggleColumn = (column: keyof typeof userVisibleColumns) => setVisibleColumns((current) => ({ ...current, [column]: !current[column] }));
  const toggleCategory = (category: string) => {
    if (category === 'semua') {
      setSelectedCategories(['semua']);
      return;
    }

    setSelectedCategories((current) => {
      const withoutAll = current.filter((selected) => selected !== 'semua');
      const next = withoutAll.includes(category)
        ? withoutAll.filter((selected) => selected !== category)
        : [...withoutAll, category];
      return next.length ? next : ['semua'];
    });
  };
  const showRemarksColumn = hasRemarks && visibleColumns.remarks;
  const noActivityColSpan = [
    visibleColumns.description,
    visibleColumns.location,
    visibleColumns.target_area,
    visibleColumns.tools,
    visibleColumns.unit,
    visibleColumns.personnel,
    visibleColumns.coordinator,
    visibleColumns.foreman,
    visibleColumns.basis,
    visibleColumns.fuel_need_liters,
    visibleColumns.fuel_usage_estimate,
  ].filter(Boolean).length;
  const displayedCategoryCount = new Set(plans.map((plan) => plan.category)).size;
  const showCategoryInTitle = !selectedCategories.includes('semua') || displayedCategoryCount === 2;
  const recapTitle = `REKAP RENCANA KERJA BULANAN${showCategoryInTitle ? ` ${getRecapCategoryLabel(plans.map((plan) => plan.category))}` : ''}`;

  const handleExportExcel = async () => {
    const toastId = showLoading("Menyiapkan rekap Excel...");
    try {
      const monthLabel = months[parseInt(selectedMonth, 10) - 1];
      await exportWorkPlanExcel({
        plans,
        title: recapTitle,
        periodLabel: `Bulan: ${monthLabel} ${selectedYear}`,
        fileName: `Rekap_Rencana_Kerja_Bulanan_${monthLabel}_${selectedYear}.xlsx`,
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
    if (!printRef.current || plans.length === 0) {
      showError("Tidak ada data rencana kerja untuk dibuatkan PDF");
      return;
    }
    const toastId = showLoading("Menyiapkan pratinjau PDF...");
    try {
      await openShareablePdfPreview({
        fileName: monthlyPdfFileName("Rencana Kerja Bulanan", Number(selectedMonth), selectedYear, regionName),
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
  const showRegionColumn = isAdmin && selectedRegion === 'semua';
  const getPlanRegionName = (plan: WorkPlan) => regions.find((region) => region.id === plan.region_id)?.name || '-';

  const renderPlanRows = (plan: WorkPlan, pIdx: number) => {
    const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
    if (isNoActivity) {
      return (
        <tr key={plan.id}>
          <td className="border-2 border-black p-1 text-center align-middle font-bold">{pIdx + 1}</td>
          {showRegionColumn && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal break-words">{getPlanRegionName(plan)}</td>}
          {visibleColumns.date && <td className="border-2 border-black p-1 text-center align-middle text-[8px]">{format(parseISO(plan.date), 'dd/MM/yy')}</td>}
          {visibleColumns.category && <td className="border-2 border-black p-1 text-center font-bold align-middle">{plan.category}</td>}
          {noActivityColSpan > 0 && <td colSpan={noActivityColSpan} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">
            TIDAK ADA RENCANA KERJA/ KEGIATAN
          </td>}
          {showRemarksColumn && <td className="border-2 border-black p-1 italic text-center align-middle break-words">{plan.items[0]?.remarks || "-"}</td>}
        </tr>
      );
    }

    const displayItems = getUniqueWorkPlanItems(plan.items);
    const descriptionSpans = getSequentialSpans(displayItems, (item) => item.description.trim());
    const toolSpans = getSequentialSpans(displayItems, (item) => JSON.stringify(item.tools));
    const teamSpans = getSequentialSpans(displayItems, (item) => plan.category === "Tim Pohon" ? `${item.coordinator}|${item.foreman || ""}` : `${item.coordinator}|${item.foreman || ""}|${item.personnel.members}`);
    const basisSpans = getSequentialSpans(displayItems, (item) => getWorkPlanBasisKey(item.basis));
    const remarksSpans = getSequentialSpans(displayItems, getWorkPlanRemarkKey);
    const isTreeLayout = plan.category === "Tim Pohon";
    const totalPlanRows = isTreeLayout ? displayItems.length : getRowsInWorkPlanItems(displayItems);
    const getSpanRows = (itemIdx: number, span: number) => isTreeLayout ? span : getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + span));
    const getFuelRemarkSource = (itemIdx: number, span: number) => displayItems
      .slice(itemIdx, itemIdx + span)
      .reduce((source, current) => (current.fuel_need_liters || current.fuel_usage_estimate?.trim() || current.remarks?.trim() ? current : source), displayItems[itemIdx]);

    return displayItems.flatMap((item, itemIdx) => {
      let toolGroupStart = itemIdx;
      while (toolGroupStart > 0 && toolSpans[toolGroupStart] === 0) toolGroupStart--;
      const sharedTreeTools = displayItems[toolGroupStart]?.tools || [];
      const treeToolOffset = itemIdx - toolGroupStart;
      const alignTreeTools = isTreeLayout && toolSpans[toolGroupStart] === sharedTreeTools.length && toolSpans[toolGroupStart] > 1;
      const alignedTreeTool = alignTreeTools ? sharedTreeTools[treeToolOffset] : undefined;
      const toolsToRender = isTreeLayout ? [alignedTreeTool || item.tools[0] || { name: "", unit: 0, usage: "", members: 0 }] : (item.tools.length > 0 ? item.tools : [{ name: "", unit: 0, usage: "", members: 0 }]);
      const descriptionSpan = descriptionSpans[itemIdx];
      const toolSpan = toolSpans[itemIdx];
      const teamSpan = teamSpans[itemIdx];
      const basisSpan = basisSpans[itemIdx];
      const remarksSpan = remarksSpans[itemIdx];
      const fuelRemarkSource = toolSpan > 0 ? getFuelRemarkSource(itemIdx, toolSpan) : item;
      const fuelRemarkRows = toolSpan > 0 ? getSpanRows(itemIdx, toolSpan) : 0;

      return toolsToRender.map((tool, toolIdx) => (
        <tr key={`${plan.id}-${itemIdx}-${toolIdx}`}>
          {itemIdx === 0 && toolIdx === 0 && (
            <>
              <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={totalPlanRows}>{pIdx + 1}</td>
              {showRegionColumn && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal break-words" rowSpan={totalPlanRows}>{getPlanRegionName(plan)}</td>}
              {visibleColumns.date && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={totalPlanRows}>
                {format(parseISO(plan.date), 'dd/MM/yy')}
              </td>}
              {visibleColumns.category && <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={totalPlanRows}>{plan.category}</td>}
            </>
          )}

          {visibleColumns.description && descriptionSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={getSpanRows(itemIdx, descriptionSpan)}>{item.description}</td>
          )}

          {visibleColumns.location && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={isTreeLayout ? 1 : Math.max(item.tools.length, 1)}>
              {item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}
            </td>
          )}
          {visibleColumns.target_area && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={isTreeLayout ? 1 : Math.max(item.tools.length, 1)}>{item.target_area ? Number(item.target_area).toLocaleString('id-ID') : "-"}</td>
          )}

          {(visibleColumns.tools || visibleColumns.unit) && (isTreeLayout ? (alignTreeTools ? (
            <>
              {visibleColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words">{tool.name ? `• ${tool.name}` : "-"}</td>}
              {visibleColumns.unit && <td className="border-2 border-black p-1 text-center align-middle">{tool.unit || "-"}</td>}
            </>
          ) : toolSpan > 0 && toolIdx === 0 ? (
            <>
              {visibleColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`h-16 flex items-center justify-center text-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.name ? `• ${t.name}` : "-"}</div>)}</td>}
              {visibleColumns.unit && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`h-16 flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.unit || "-"}</div>)}</td>}
            </>
          ) : null) : toolSpan > 0 && toolIdx === 0 && (
            <>
              {visibleColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                {item.tools.length > 0 ? item.tools.map((t, idx) => (
                  <div key={idx} className={`h-16 flex items-center justify-center text-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.name ? `• ${t.name}` : "-"}</div>
                )) : "-"}
              </td>}
              {visibleColumns.unit && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                {item.tools.length > 0 ? item.tools.map((t, idx) => (
                  <div key={idx} className={`h-16 flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.unit || "-"}</div>
                )) : "-"}
              </td>}
            </>
          ))}

          {visibleColumns.personnel && (isTreeLayout ? (alignTreeTools ? (
            <td className="border-2 border-black p-1 text-center align-middle">{tool.members ?? 0}</td>
          ) : toolSpan > 0 && toolIdx === 0 ? (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`h-16 flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.members ?? 0}</div>)}</td>
          ) : null) : teamSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + teamSpan))}>{item.personnel.members}</td>
          ))}
          {visibleColumns.coordinator && teamSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getSpanRows(itemIdx, teamSpan)}>{item.coordinator}</td>
          )}
          {visibleColumns.foreman && teamSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getSpanRows(itemIdx, teamSpan)}>{item.foreman || "-"}</td>
          )}
          {visibleColumns.basis && basisSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getSpanRows(itemIdx, basisSpan)}>{item.basis}</td>
          )}
          {visibleColumns.fuel_need_liters && toolSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={fuelRemarkRows}>{formatFuelLiters(fuelRemarkSource.fuel_need_liters)}</td>
          )}
          {visibleColumns.fuel_usage_estimate && toolSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={fuelRemarkRows}>{fuelRemarkSource.fuel_usage_estimate || "-"}</td>
          )}
          {showRemarksColumn && toolSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 italic text-center align-middle break-words" rowSpan={fuelRemarkRows}>{fuelRemarkSource.remarks || "-"}</td>
          )}
        </tr>
      ));
    });
  };

  const colGroup = (
    <colgroup>
      <col style={{ width: '25px' }} />
      {showRegionColumn && <col style={{ width: '60px' }} />}
      {visibleColumns.date && <col style={{ width: '55px' }} />}
      {visibleColumns.category && <col style={{ width: '55px' }} />}
      {visibleColumns.description && <col style={{ width: '110px' }} />}
      {visibleColumns.location && <col style={{ width: '120px' }} />}
      {visibleColumns.target_area && <col style={{ width: '55px' }} />}
      {visibleColumns.tools && <col style={{ width: '110px' }} />}
      {visibleColumns.unit && <col style={{ width: '25px' }} />}
      {visibleColumns.personnel && <col style={{ width: '35px' }} />}
      {visibleColumns.coordinator && <col style={{ width: '75px' }} />}
      {visibleColumns.foreman && <col style={{ width: '75px' }} />}
      {visibleColumns.basis && <col style={{ width: '86px' }} />}
      {visibleColumns.fuel_need_liters && <col style={{ width: '86px' }} />}
      {visibleColumns.fuel_usage_estimate && <col style={{ width: '124px' }} />}
      {showRemarksColumn && <col style={{ width: '120px' }} />}
    </colgroup>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="recap-sticky-toolbar max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/?tab=workplans')} className="px-2 md:px-4 h-9">
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] justify-between bg-slate-50 border-slate-200 h-10 px-3 text-xs font-normal md:text-sm">
                  <span className="truncate">{getSelectedCategoryLabel(selectedCategories)}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <div className="max-h-[320px] space-y-1 overflow-y-auto p-2">
                  <div className="flex cursor-pointer items-center space-x-2 rounded-md p-2 hover:bg-slate-100" onClick={() => toggleCategory('semua')}>
                    <Checkbox checked={selectedCategories.includes('semua')} />
                    <label className="cursor-pointer text-sm font-medium leading-none">Semua Kategori</label>
                  </div>
                  {availableCategories.map((category) => (
                    <div key={category} className="flex cursor-pointer items-center space-x-2 rounded-md p-2 hover:bg-slate-100" onClick={() => toggleCategory(category)}>
                      <Checkbox checked={selectedCategories.includes(category)} />
                      <label className="cursor-pointer text-sm font-medium leading-none">{category}</label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {tableMode === 'compact' ? (
              <WorkPlanColumnPicker
                columns={{
                  date: visibleColumns.date,
                  category: visibleColumns.category,
                  description: visibleColumns.description,
                  location: visibleColumns.location,
                  tools: visibleColumns.tools,
                  unit: visibleColumns.unit,
                  personnel: visibleColumns.personnel,
                  coordinator: visibleColumns.coordinator,
                  foreman: visibleColumns.foreman,
                  basis: visibleColumns.basis,
                }}
                labels={workPlanCompactColumnLabels}
                onToggle={(column) => toggleColumn(column)}
              />
            ) : (
              <WorkPlanColumnPicker columns={visibleColumns} labels={workPlanColumnLabels} disabledColumns={{ target_area: isTimSiramSelected }} onToggle={toggleColumn} />
            )}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[110px] md:w-[150px] h-10 text-xs md:text-sm"><SelectValue placeholder="Bulan" /></SelectTrigger>
              <SelectContent>{months.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[80px] md:w-[100px] h-10 text-xs md:text-sm"><SelectValue placeholder="Tahun" /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <WorkPlanRecapMenu
              navigate={navigate}
              isCompactViewport={isCompactViewport}
              isLoggedIn={isLoggedIn}
              plans={plans}
              logoMode={logoMode}
              setLogoMode={setLogoMode}
              signatureMode={signatureMode}
              setSignatureMode={setSignatureMode}
              tableMode={tableMode}
              setTableMode={setTableMode}
              handleSharePdf={handleSharePdf}
              handleExportExcel={handleExportExcel}
            />
          </div>

          <div className="hidden">
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

      <div className="hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 bg-blue-600 px-4 shadow-md hover:bg-blue-700">
              <FileText className="mr-2 h-4 w-4" /> Menu Rekap
              <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-64">
            {isCompactViewport ? <>
              <DropdownMenuItem onClick={() => setLogoMode(logoMode === 'with-logo' ? 'without-logo' : 'with-logo')} className="cursor-pointer py-2"><Image className="mr-2 h-4 w-4 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSignatureMode(signatureMode === 'with-signature' ? 'without-signature' : 'with-signature')} className="cursor-pointer py-2"><PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTableMode(tableMode === 'complete' ? 'compact' : 'complete')} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}</DropdownMenuItem>
              {isLoggedIn && plans.map((plan) => <DropdownMenuItem key={plan.id} onClick={() => navigate(`/work-plans/edit/${plan.id}`)} className="cursor-pointer py-2 whitespace-normal"><Edit className="mr-2 h-4 w-4 shrink-0 text-blue-600" /> Edit: {plan.category} - {plan.items[0]?.description || 'Rencana Kerja'}</DropdownMenuItem>)}
            </> : <>
              <DropdownMenuSub><DropdownMenuSubTrigger><Image className="mr-2 h-4 w-4 text-blue-600" /> Logo: {logoMode === 'with-logo' ? 'Dengan Logo' : 'Tanpa Logo'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setLogoMode('with-logo')}>Dengan Logo</DropdownMenuItem><DropdownMenuItem onClick={() => setLogoMode('without-logo')}>Tanpa Logo</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger><PenTool className="mr-2 h-4 w-4 text-amber-600" /> Tanda Tangan: {signatureMode === 'with-signature' ? 'Ada' : 'Tanpa'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setSignatureMode('with-signature')}>Ada Tanda Tangan</DropdownMenuItem><DropdownMenuItem onClick={() => setSignatureMode('without-signature')}>Tanpa Tanda Tangan</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
              <DropdownMenuSub><DropdownMenuSubTrigger><Table className="mr-2 h-4 w-4 text-emerald-600" /> Mode Tabel: {tableMode === 'complete' ? 'Lengkap' : 'Ringkas'}</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem onClick={() => setTableMode('complete')}>Tabel Lengkap</DropdownMenuItem><DropdownMenuItem onClick={() => setTableMode('compact')}>Tabel Ringkas</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
              {isLoggedIn && plans.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Data</DropdownMenuSubTrigger><DropdownMenuSubContent className="w-80">{plans.map((plan) => <DropdownMenuItem key={plan.id} onClick={() => navigate(`/work-plans/edit/${plan.id}`)}>{plan.category} - {plan.items[0]?.description || 'Rencana Kerja'}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>}
            </>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer py-2"><Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini</DropdownMenuItem>
            <DropdownMenuItem onClick={handleSharePdf} className="cursor-pointer py-2"><Share2 className="mr-2 h-4 w-4 text-indigo-600" /> Simpan PDF untuk Dibagikan</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Simpan ke Excel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/work-plans/daily-rekap')} className="cursor-pointer py-2"><CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/work-plans/weekly-rekap')} className="cursor-pointer py-2"><Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/work-plans/monthly-rekap')} className="cursor-pointer py-2"><FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan</DropdownMenuItem>
            {isLoggedIn && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => navigate('/work-plans/create')} className="cursor-pointer py-2 text-blue-700"><Plus className="mr-2 h-4 w-4" /> Tambah Baru</DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
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
          <h3 className="text-xl font-bold underline uppercase">{recapTitle}</h3>
          <p className="text-lg font-bold">Bulan: {months[parseInt(selectedMonth)-1]} {selectedYear}</p>
        </div>

        <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
          {plans.length > 0 ? (
            <>
              {tableMode === "compact" && <WorkPlanCompactTable plans={plans} mode="monthly" showRegionColumn={showRegionColumn} regions={regions} columns={visibleColumns} />}
              <table className={`${tableMode === "compact" ? "hidden" : ""} split-table-before-footer w-full min-w-[1200px] border-collapse border-2 border-black text-[9px] table-fixed print:w-full print:min-w-0`}>
                {colGroup}
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-2 border-black p-1">No</th>
                    {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                    {visibleColumns.date && <th className="border-2 border-black p-1">Hari/Tgl</th>}
                    {visibleColumns.category && <th className="border-2 border-black p-1">Tim/Kec</th>}
                    {visibleColumns.description && <th className="border-2 border-black p-1">Detail Kegiatan</th>}
                    {visibleColumns.location && <th className="border-2 border-black p-1">Lokasi</th>}
                    {visibleColumns.target_area && <th className="border-2 border-black p-1">Target Luas (M²)</th>}
                    {visibleColumns.tools && <th className="border-2 border-black p-1">Alat Operasional</th>}
                    {visibleColumns.unit && <th className="border-2 border-black p-1">Unit</th>}
                    {visibleColumns.personnel && <th className="border-2 border-black p-1">Pers</th>}
                    {visibleColumns.coordinator && <th className="border-2 border-black p-1">Koordinator</th>}
                    {visibleColumns.foreman && <th className="border-2 border-black p-1">Mandor</th>}
                    {visibleColumns.basis && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Dasar<br />Pengerjaan</th>}
                    {visibleColumns.fuel_need_liters && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Kebutuhan<br />BBM<br />(Liter)</th>}
                    {visibleColumns.fuel_usage_estimate && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Estimasi<br />Penggunaan<br />BBM (Liter)</th>}
                    {showRemarksColumn && <th className="border-2 border-black p-1">Keterangan</th>}
                  </tr>
                </thead>
                <tbody>
                  {plans.slice(0, -1).map((plan, pIdx) => renderPlanRows(plan, pIdx))}
                </tbody>
              </table>

              <div className="keep-together">
                <table className={`${tableMode === "compact" ? "hidden" : ""} continuation-table w-full min-w-[1200px] border-collapse border-2 border-black text-[9px] table-fixed print:w-full print:min-w-0`}>
                  {colGroup}
                  <thead className="hidden print:table-header-group">
                    <tr className="bg-slate-100">
                      <th className="border-2 border-black p-1">No</th>
                      {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                      {visibleColumns.date && <th className="border-2 border-black p-1">Hari/Tgl</th>}
                      {visibleColumns.category && <th className="border-2 border-black p-1">Tim/Kec</th>}
                      {visibleColumns.description && <th className="border-2 border-black p-1">Detail Kegiatan</th>}
                      {visibleColumns.location && <th className="border-2 border-black p-1">Lokasi</th>}
                      {visibleColumns.target_area && <th className="border-2 border-black p-1">Target Luas (M²)</th>}
                      {visibleColumns.tools && <th className="border-2 border-black p-1">Alat Operasional</th>}
                      {visibleColumns.unit && <th className="border-2 border-black p-1">Unit</th>}
                      {visibleColumns.personnel && <th className="border-2 border-black p-1">Pers</th>}
                      {visibleColumns.coordinator && <th className="border-2 border-black p-1">Koordinator</th>}
                      {visibleColumns.foreman && <th className="border-2 border-black p-1">Mandor</th>}
                      {visibleColumns.basis && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Dasar<br />Pengerjaan</th>}
                      {visibleColumns.fuel_need_liters && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Kebutuhan<br />BBM<br />(Liter)</th>}
                      {visibleColumns.fuel_usage_estimate && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Estimasi<br />Penggunaan<br />BBM (Liter)</th>}
                      {showRemarksColumn && <th className="border-2 border-black p-1">Keterangan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {renderPlanRows(plans[plans.length - 1], plans.length - 1)}
                  </tbody>
                </table>

                {signatureMode === "with-signature" && (
                  <div className="pdf-footer mt-12">
                    <div className="flex justify-end mb-4 text-[11px]"><p className="w-1/3 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                    <div className="grid grid-cols-3 gap-4 text-[11px] leading-normal">
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div></div>
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div></div>
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
              </div>
            </>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-[9px] table-fixed">
              <tbody>
                <tr><td colSpan={hasRemarks ? 15 : 14} className="border-2 border-black p-8 text-center italic text-slate-400">{loading ? 'Memuat data rekap...' : 'Tidak ada rencana kerja untuk periode ini'}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .split-table-before-footer {
          border-bottom-width: 0 !important;
        }
        /* Tabel lanjutan langsung mengikuti tabel utama. Hilangkan sisi atas
           tabel kedua agar tidak menumpuk dengan batas bawah baris terakhir. */
        .continuation-table {
          border-top-width: 0 !important;
        }
        .continuation-table tbody tr:first-child > td {
          border-top-width: 0 !important;
        }
        /* Tumpangkan pemisah isi sel dengan garis antarbaris tabel saat cetak. */
        .print-area td > div.border-t.border-black {
          border-top-width: 1px !important;
          position: relative;
          top: -1px;
        }
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
          table.continuation-table thead { display: none !important; }
          table tr { break-inside: avoid; page-break-inside: avoid; }
          .keep-together { page-break-inside: avoid; break-inside: avoid; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />
    </div>
  );
};

export default WorkPlanMonthlyRecap;
