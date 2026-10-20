// TODO: This component is 1046 lines. Consider decomposing into smaller components.
// Future: Extract table, filters, actions into separate components after test coverage is established.

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkPlan } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Printer, Calendar as CalendarIcon, PenTool, Plus, ChevronDown, Table, FileText, Image, Edit, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { sortByCategory } from '@/utils/report-helpers';
import {
  getRowsInWorkPlanItems,
  getSequentialSpans,
  getUniqueWorkPlanItems,
  getWorkPlanBasisKey,
} from '@/utils/work-plan-display';
import { useAuth } from '@/context/AuthContext';
import { isGlobalWorkPlanAdmin } from '@/constants/access-control';
import { useRegionName } from '@/hooks/useRegionName';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { exportWorkPlanExcel } from '@/utils/work-plan-excel';
import { WorkPlanColumnPicker } from '@/components/WorkPlanColumnPicker';
import WorkPlanRecapMenu from '@/components/WorkPlanRecapMenu';
import { dismissToast, showError, showLoading, showSuccess } from '@/utils/toast';
import { openShareablePdfPreview } from '@/utils/pdf-preview';
import { dailyPdfFileName } from '@/utils/pdf-file-name';
import { getRecapCategoryLabel } from '@/utils/report-recap-title';
import SignatoryText from '@/components/SignatoryText';
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
import '@/styles/printStyles.css';

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

type SignatureMode = "with-signature" | "without-signature";
type LogoMode = "with-logo" | "without-logo";
type TableMode = "complete" | "compact";

const workPlanColumnLabels = {
  category: "Tim/Kec.", description: "Detail Kegiatan", location: "Lokasi", target_area: "Target Luas (M²)", tools: "Alat Operasional",
  unit: "Unit", personnel: "Personel", coordinator: "Koordinator", foreman: "Mandor", fuel_need_liters: "Kebutuhan BBM/Liter", fuel_usage_estimate: "Estimasi Penggunaan BBM (Liter)",
  basis: "Dasar Pengerjaan", remarks: "Keterangan",
};

const formatFuelLiters = (value?: number | string) => Number(value || 0) ? `${Number(value).toLocaleString('id-ID')} L` : "-";
const fuelRemarkMergedCategories = ["Tim Siram", "Becak Sampah", "Becak Siram"];

const getInitialSelectedCategories = (searchParams: URLSearchParams) => {
  const categories = searchParams.get('categories');
  if (categories) return categories.split(',').map((category) => category.trim()).filter(Boolean);
  return [searchParams.get('category') || 'semua'];
};

const getSelectedCategoryLabel = (selectedCategories: string[]) => {
  if (selectedCategories.includes('semua')) return 'Semua Kategori / Tim';
  if (selectedCategories.length > 1) return `${selectedCategories.length} Kategori / Tim Terpilih`;
  return selectedCategories[0] || 'Pilih Kategori / Tim';
};

const WorkPlanDailyRecap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const isAdmin = isGlobalWorkPlanAdmin(profile?.role, session?.user?.email);
  const [selectedRegion, setSelectedRegion] = useState(isAdmin ? "semua" : (searchParams.get('region') || "semua"));
  const teamFilterRegion = isAdmin ? selectedRegion : (profile?.region_id || 'semua');
  const { regions, teams } = useRegionFilterOptions(Boolean(session && profile && profile.role !== 'user'), teamFilterRegion);
  const regionId = isAdmin ? (selectedRegion === 'semua' ? null : selectedRegion) : profile?.region_id;
  const regionName = useRegionName(regionId, isAdmin && selectedRegion === 'semua' ? 'SEMUA WILAYAH' : undefined);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(getInitialSelectedCategories(searchParams));
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("without-signature");
  const [logoMode, setLogoMode] = useState<LogoMode>("without-logo");
  const [tableMode, setTableMode] = useState<TableMode>("complete");
  const [userVisibleColumns, setVisibleColumns] = useState({
    category: true, description: true, location: true, target_area: !isAdmin, tools: true, unit: true,
    personnel: true, coordinator: true, foreman: true, basis: true, fuel_need_liters: false, fuel_usage_estimate: true, remarks: true,
  });
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    if (isAdmin) setVisibleColumns((current) => ({ ...current, target_area: false }));
  }, [isAdmin]);

  const printRef = useRef<HTMLDivElement>(null);
  const dataRequestId = useRef(0);
  const isLoggedIn = !!session;
  const regionOrderKey = regions.map((region) => region.id).join(',');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => setIsCompactViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const getRegionOrder = (regionId: string | null | undefined) => {
    const regionIndex = regions.findIndex((region) => region.id === regionId);
    return regionIndex === -1 ? Number.MAX_SAFE_INTEGER : regionIndex;
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedCategories, regionId, regionOrderKey]);

  useEffect(() => {
    setSelectedRegion(searchParams.get('region') || 'semua');
    setSelectedDate(searchParams.get('date') || '');
    setSelectedCategories(getInitialSelectedCategories(searchParams));
  }, [searchParams]);

  const loadData = async () => {
    const requestId = ++dataRequestId.current;
    try {
      setLoading(true);

      // Kirim filter tanggal ke server untuk performa lebih baik
      const dateFilter = selectedDate && selectedDate !== 'semua'
        ? { type: 'date' as const, value: selectedDate }
        : null;

      const data = await workPlanService.getFilteredWorkPlans({
        dateFilter,
        category: selectedCategories.includes('semua') ? null : selectedCategories[0] || null,
        regionId,
      });

      if (requestId !== dataRequestId.current) return;

      setAvailableCategories(Array.from(new Set(data.map((plan) => plan.category))).sort((first, second) => first.localeCompare(second)));

      // Filter kategori multi-select di client (server hanya mendukung satu nilai)
      const filtered = data.filter(p =>
        (selectedCategories.includes("semua") || selectedCategories.includes(p.category)) &&
        p.is_visible !== false
      );

      // Sorting untuk admin yang melihat semua wilayah
      if (isAdmin && selectedRegion === 'semua') {
        filtered.sort((a, b) => {
          const regionDiff = getRegionOrder(a.region_id) - getRegionOrder(b.region_id);
          if (regionDiff !== 0) return regionDiff;
          return sortByCategory(a.category, b.category);
        });
      }

      if (requestId === dataRequestId.current) setPlans(filtered);
    } catch (error) {
      logger.error("Failed to load work plan daily reports", error);
    } finally {
      if (requestId === dataRequestId.current) setLoading(false);
    }
  };

  const hasRemarks = plans.some(plan => plan.items.some(item => item.remarks && item.remarks.trim() !== ""));
  const hasBasisForRemarks = tableMode === "complete" && plans.some((plan) => (
    plan.items.some((item) => item.basis?.trim())
  ));
  const isTimSiramSelected = selectedCategories.includes("Tim Siram");
  const visibleColumns = { ...userVisibleColumns, target_area: userVisibleColumns.target_area && !isTimSiramSelected };
  const toggleColumn = (column: keyof typeof userVisibleColumns) => setVisibleColumns((current) => ({ ...current, [column]: !current[column] }));
  const hasForemanValues = plans.some((plan) => plan.items.some((item) => {
    const value = item.foreman?.trim();
    return value && value !== "-";
  }));
  const printColumns = {
    ...visibleColumns,
    foreman: visibleColumns.foreman && hasForemanValues,
  };
  const showRemarksColumn = (hasRemarks || hasBasisForRemarks) && printColumns.remarks;
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
  const categoryOptions = teams.length > 0
    ? Array.from(new Set([...teams.map((team) => team.name), ...availableCategories])).sort((first, second) => first.localeCompare(second))
    : availableCategories;
  const noActivityColSpan = [
    printColumns.description,
    printColumns.location,
    printColumns.target_area,
    printColumns.tools,
    printColumns.unit,
    printColumns.personnel,
    printColumns.coordinator,
    printColumns.foreman,
    printColumns.basis,
    printColumns.fuel_need_liters,
    printColumns.fuel_usage_estimate,
  ].filter(Boolean).length;
  const displayedCategoryCount = new Set(plans.map((plan) => plan.category)).size;
  const showCategoryInTitle = !selectedCategories.includes('semua') || displayedCategoryCount === 2;
  const recapTitle = `REKAP RENCANA KERJA HARIAN${showCategoryInTitle ? ` ${getRecapCategoryLabel(plans.map((plan) => plan.category))}` : ''}`;

  const handleExportExcel = async () => {
    const toastId = showLoading("Menyiapkan rekap Excel...");
    try {
      const dateLabel = selectedDate === "semua"
        ? "Semua Tanggal"
        : format(parseISO(selectedDate), "dd MMMM yyyy", { locale: localeId });
      await exportWorkPlanExcel({
        plans,
        title: recapTitle,
        periodLabel: `Tanggal: ${dateLabel}`,
        fileName: `Rekap_Rencana_Kerja_Harian_${selectedDate || "semua"}.xlsx`,
        includeLogo: logoMode === "with-logo",
        logoMedanUrl: LOGO_MEDAN_URL,
        logoDlhUrl: LOGO_DLH_URL,
      });
      showSuccess("Rekap Excel berhasil disimpan");
    } catch (error) {
      logger.error("Failed to create Excel file", error);
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
        fileName: dailyPdfFileName("Rencana Kerja", selectedDate, regionName),
      });
    } catch (error) {
      logger.error("Failed to create shareable PDF", error);
      showError(error instanceof Error ? error.message : "Gagal membuat PDF untuk dibagikan");
    } finally {
      dismissToast(toastId);
    }
  };

  const categoriesInPlans = Array.from(new Set(plans.map(p => p.category)));
  const showTiurmaida = categoriesInPlans.some(c => ["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram"].includes(c));
  const showArdiansyah = categoriesInPlans.some(c => ["Tim Pohon"].includes(c));
  const showRegionColumn = isAdmin && selectedRegion === 'semua';
  const showCompactForeman = tableMode === "compact" && plans.length > 0 && plans.every((plan) => plan.category === "Tim Pohon");
  const getPlanRegionName = (plan: WorkPlan) => regions.find((region) => region.id === plan.region_id)?.name || '-';
  const getPlanRowCount = (plan: WorkPlan) => {
    if (plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN") return 1;
    const items = getUniqueWorkPlanItems(plan.items);
    return plan.category === "Tim Pohon" ? items.length : getRowsInWorkPlanItems(items);
  };
  // Data sudah diurutkan berdasarkan wilayah. Hitung seluruh tinggi baris tiap
  // kelompok wilayah supaya satu sel Wilayah dapat mencakup beberapa Tim/Kec.
  const regionCells = new Map<string, { rowSpan: number; isFirst: boolean; number: number }>();
  let regionNumber = 1;
  for (let start = 0; start < plans.length;) {
    const regionId = plans[start].region_id || "-";
    let end = start;
    let rowSpan = 0;
    while (end < plans.length && (plans[end].region_id || "-") === regionId) {
      rowSpan += getPlanRowCount(plans[end]);
      end += 1;
    }
    for (let index = start; index < end; index += 1) {
      regionCells.set(plans[index].id, { rowSpan, isFirst: index === start, number: regionNumber });
    }
    start = end;
    regionNumber += 1;
  }

  // Tabel ringkas ditampilkan sebagai satu rangkaian baris, bukan per rencana
  // kerja. Karena itu, hitung span Dasar Pengerjaan dari seluruh rangkaian agar
  // dasar yang sama dan berurutan tidak ditulis ulang saat berganti rencana.
  const compactBasisSpans = new Map<string, number>();
  const compactBasisRows: Array<{ key: string; basisKey: string }> = [];
  plans.forEach((plan) => {
    if (plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN") {
      compactBasisRows.push({ key: `compact-${plan.id}-no-activity`, basisKey: `no-activity-${plan.id}` });
      return;
    }

    getUniqueWorkPlanItems(plan.items).forEach((item, itemIndex) => {
      const rowCount = plan.category === "Tim Pohon" ? 1 : Math.max(item.tools.length, 1);
      for (let toolIndex = 0; toolIndex < rowCount; toolIndex += 1) {
        // Nilai kosong tidak digabung; hanya Dasar Pengerjaan yang benar-benar
        // sama yang perlu disatukan pada hasil cetak.
        const basis = getWorkPlanBasisKey(item.basis);
        const basisKey = basis
          ? `${plan.category.trim().toLocaleLowerCase("id-ID")}|${basis}`
          : `empty-${plan.id}-${itemIndex}-${toolIndex}`;
        compactBasisRows.push({ key: `compact-${plan.id}-${itemIndex}-${toolIndex}`, basisKey });
      }
    });
  });
  getSequentialSpans(compactBasisRows, (row) => row.basisKey).forEach((span, index) => {
    compactBasisSpans.set(compactBasisRows[index].key, span);
  });
  const getCompactBasisSpan = (planId: string, itemIndex: number, toolIndex: number) => (
    compactBasisSpans.get(`compact-${planId}-${itemIndex}-${toolIndex}`) ?? 1
  );
  // Hanya untuk tampilan cetak tabel lengkap: Keterangan asli diprioritaskan,
  // lalu Dasar Pengerjaan dipakai sebagai cadangan bila Keterangan kosong.
  const getPrintedRemark = (item: WorkPlan["items"][number]) => (
    item.remarks?.trim() || (tableMode === "complete" ? item.basis?.trim() : "") || "-"
  );

  const renderPlanRows = (plan: WorkPlan, pIdx: number) => {
    const regionCell = regionCells.get(plan.id);
    const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
    if (isNoActivity) {
      return (
        <tr key={plan.id}>
          {(!showRegionColumn || regionCell?.isFirst) && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={showRegionColumn ? regionCell?.rowSpan : 1}>{showRegionColumn ? regionCell?.number : pIdx + 1}</td>}
          {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal break-words" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
          {printColumns.category && <td className="border-2 border-black p-1 text-center font-bold">{plan.category}</td>}
          {noActivityColSpan > 0 && <td colSpan={noActivityColSpan} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">
            TIDAK ADA RENCANA KERJA/ KEGIATAN
          </td>}
          {showRemarksColumn && <td className="border-2 border-black p-1 italic text-center align-middle break-words">{getPrintedRemark(plan.items[0])}</td>}
        </tr>
      );
    }

    const displayItems = getUniqueWorkPlanItems(plan.items);
    const descriptionSpans = getSequentialSpans(displayItems, (item) => item.description.trim());
    const getItemLocationKey = (item: WorkPlan["items"][number]) => JSON.stringify({
      street: item.location?.street?.trim() || "",
      village: Array.isArray(item.location?.village)
        ? item.location.village.map((value) => value.trim()).filter(Boolean)
        : String(item.location?.village || "").trim(),
      subDistrict: item.location?.subDistrict?.trim() || "",
    });
    const getItemToolsKey = (item: WorkPlan["items"][number]) => JSON.stringify((item.tools || []).map((tool) => ({
      name: tool.name?.trim() || "",
      unit: Number(tool.unit || 0),
    })));
    const toolSpans = getSequentialSpans(displayItems, getItemToolsKey);
    const teamSpans = getSequentialSpans(displayItems, (item) => {
      const teamKey = plan.category === "Tim Pohon"
        ? `${item.coordinator}|${item.foreman || ""}`
        : `${item.coordinator}|${item.foreman || ""}|${item.personnel.members}`;

      // Tim Siram dapat memiliki personil yang sama pada beberapa kegiatan,
      // tetapi personil harus tetap berada pada baris alatnya bila nama alat berbeda.
      const toolKey = plan.category === "Tim Siram"
        ? item.tools.map((tool) => tool.name.trim()).join("|")
        : "";

      return `${teamKey}|${toolKey}`;
    });
    // Untuk Taman Amplas, Taman Area, dan Tim Siram, tampilkan satu sel
    // koordinator untuk seluruh kegiatan/lokasi berurutan dengan nama sama.
    // Kategori lain mempertahankan aturan span personil yang berlaku.
    const coordinatorSpans = ["Taman Amplas", "Taman Area", "Tim Siram"].includes(plan.category)
      ? getSequentialSpans(displayItems, (item) => item.coordinator.trim())
      : teamSpans;
    const foremanSpans = getSequentialSpans(displayItems, (item) => item.foreman?.trim() || "");
    const personnelShouldStaySeparate = ["Taman Amplas", "Taman Kota", "Taman Area"].includes(plan.category.trim())
      && new Set(displayItems.map((item) => JSON.stringify({
        detail: item.description?.trim() || "",
        location: getItemLocationKey(item),
      }))).size > 1;
    const personnelSpans = personnelShouldStaySeparate
      ? displayItems.map(() => 1)
      : teamSpans;
    const basisSpans = getSequentialSpans(displayItems, (item) => getWorkPlanBasisKey(item.basis));
    const remarksSpans = getSequentialSpans(displayItems, getItemToolsKey);
    const isTreeLayout = plan.category === "Tim Pohon";
    const isFuelRemarkMergedCategory = fuelRemarkMergedCategories.includes(plan.category.trim());
    const totalPlanRows = isTreeLayout ? displayItems.length : getRowsInWorkPlanItems(displayItems);
    const getSpanRows = (itemIdx: number, span: number) => isTreeLayout ? span : getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + span));
    const getFuelRemarkSource = (itemIdx: number, span: number) => displayItems
      .slice(itemIdx, itemIdx + span)
      .reduce((source, current) => (current.fuel_need_liters || current.fuel_usage_estimate?.trim() || current.remarks?.trim() ? current : source), displayItems[itemIdx]);
    const getLastValue = <T,>(items: WorkPlan["items"], getValue: (item: WorkPlan["items"][number]) => T, hasValue: (value: T) => boolean) => {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const value = getValue(items[index]);
        if (hasValue(value)) return value;
      }
      return getValue(items[0]);
    };
    const wateringFuelNeedLiters = getLastValue(displayItems, (current) => current.fuel_need_liters || 0, (value) => Number(value || 0) > 0);
    const fuelEstimateRows = displayItems.map((item) => ({ item }));
    const fuelEstimateSpans = isFuelRemarkMergedCategory
      ? getSequentialSpans(fuelEstimateRows, (row) => getItemToolsKey(row.item))
      : [];
    const remarkRows = displayItems.map((item) => ({ item }));
    const mergedRemarkSpans = isFuelRemarkMergedCategory
      ? getSequentialSpans(remarkRows, (row) => getItemToolsKey(row.item))
      : [];

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
      const basisSpan = basisSpans[itemIdx];
      const remarksSpan = remarksSpans[itemIdx];
      const fuelRemarkSource = toolSpan > 0 ? getFuelRemarkSource(itemIdx, toolSpan) : item;
      const fuelRemarkRows = isFuelRemarkMergedCategory ? totalPlanRows : toolSpan > 0 ? getSpanRows(itemIdx, toolSpan) : 0;
      const fuelEstimateSpan = isFuelRemarkMergedCategory ? fuelEstimateSpans[itemIdx] : 0;
      const fuelEstimateRowsCount = isFuelRemarkMergedCategory && fuelEstimateSpan > 0 ? getSpanRows(itemIdx, fuelEstimateSpan) : toolSpan > 0 ? getSpanRows(itemIdx, toolSpan) : 0;
      const fuelEstimateValue = isFuelRemarkMergedCategory && fuelEstimateSpan > 0
        ? getLastValue(displayItems.slice(itemIdx, itemIdx + fuelEstimateSpan), (current) => current.fuel_usage_estimate || "", (value) => value.trim() !== "")
        : fuelRemarkSource.fuel_usage_estimate || "";
      const remarkSpan = isFuelRemarkMergedCategory ? mergedRemarkSpans[itemIdx] : remarksSpan;
      const remarkRowsCount = isFuelRemarkMergedCategory && remarkSpan > 0 ? getSpanRows(itemIdx, remarkSpan) : toolSpan > 0 ? getSpanRows(itemIdx, toolSpan) : 0;
      const remarkValue = remarkSpan > 0
        ? getLastValue(displayItems.slice(itemIdx, itemIdx + remarkSpan), getPrintedRemark, (value) => value !== "-")
        : getPrintedRemark(fuelRemarkSource);
      const toolItemClass = isTreeLayout ? "h-12 leading-tight" : "h-16";

      return toolsToRender.map((tool, toolIdx) => {
        const showFuelRemarkCell = isFuelRemarkMergedCategory ? itemIdx === 0 && toolIdx === 0 : toolSpan > 0 && toolIdx === 0;
        const showFuelEstimateCell = isFuelRemarkMergedCategory ? fuelEstimateSpan > 0 && toolIdx === 0 : showFuelRemarkCell;
        const showRemarkCell = isFuelRemarkMergedCategory ? remarkSpan > 0 && toolIdx === 0 : showFuelRemarkCell;

        return (
          <tr key={`${plan.id}-${itemIdx}-${toolIdx}`}>
            {itemIdx === 0 && toolIdx === 0 && (
              <>
                {(!showRegionColumn || regionCell?.isFirst) && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={showRegionColumn ? regionCell?.rowSpan : totalPlanRows}>{showRegionColumn ? regionCell?.number : pIdx + 1}</td>}
                {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal break-words" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
                {printColumns.category && <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={totalPlanRows}>{plan.category}</td>}
              </>
            )}

          {printColumns.description && descriptionSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={getSpanRows(itemIdx, descriptionSpan)}>{item.description}</td>
          )}

          {printColumns.location && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={isTreeLayout ? 1 : Math.max(item.tools.length, 1)}>
              {item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}
            </td>
          )}
          {printColumns.target_area && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={isTreeLayout ? 1 : Math.max(item.tools.length, 1)}>{item.target_area ? Number(item.target_area).toLocaleString('id-ID') : "-"}</td>
          )}

          {(printColumns.tools || printColumns.unit) && (isTreeLayout ? (alignTreeTools ? (
            <>
              {printColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words">{tool.name ? `• ${tool.name}` : "-"}</td>}
              {printColumns.unit && <td className="border-2 border-black p-1 text-center align-middle">{tool.unit || "-"}</td>}
            </>
          ) : toolSpan > 0 && toolIdx === 0 ? (
            <>
              {printColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`${toolItemClass} flex items-center justify-center text-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.name ? `• ${t.name}` : "-"}</div>)}</td>}
              {printColumns.unit && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`${toolItemClass} flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.unit || "-"}</div>)}</td>}
            </>
          ) : null) : toolSpan > 0 && toolIdx === 0 && (
            <>
              {printColumns.tools && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                {item.tools.length > 0 ? item.tools.map((t, idx) => (
                  <div key={idx} className={`${toolItemClass} flex items-center justify-center text-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.name ? `• ${t.name}` : "-"}</div>
                )) : "-"}
              </td>}
              {printColumns.unit && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                {item.tools.length > 0 ? item.tools.map((t, idx) => (
                  <div key={idx} className={`${toolItemClass} flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.unit || "-"}</div>
                )) : "-"}
              </td>}
            </>
          ))}

          {printColumns.personnel && (isTreeLayout ? (alignTreeTools ? (
            <td className="border-2 border-black p-1 text-center align-middle">{tool.members ?? 0}</td>
          ) : toolSpan > 0 && toolIdx === 0 ? (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={toolSpan}>{item.tools.map((t, idx) => <div key={idx} className={`${toolItemClass} flex items-center justify-center ${idx > 0 ? "-mx-1 border-t border-black px-1" : ""}`}>{t.members ?? 0}</div>)}</td>
          ) : null) : personnelSpans[itemIdx] > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getRowsInWorkPlanItems(displayItems.slice(itemIdx, itemIdx + personnelSpans[itemIdx]))}>{item.personnel.members}</td>
          ))}
          {printColumns.coordinator && coordinatorSpans[itemIdx] > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getSpanRows(itemIdx, coordinatorSpans[itemIdx])}>{item.coordinator}</td>
          )}
          {printColumns.foreman && foremanSpans[itemIdx] > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={getSpanRows(itemIdx, foremanSpans[itemIdx])}>{item.foreman || "-"}</td>
          )}
          {printColumns.basis && basisSpan > 0 && toolIdx === 0 && (
            <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getSpanRows(itemIdx, basisSpan)}>{item.basis}</td>
          )}
          {printColumns.fuel_need_liters && showFuelRemarkCell && (
            <td className="border-2 border-black p-1 text-center align-middle" rowSpan={fuelRemarkRows}>{formatFuelLiters(isFuelRemarkMergedCategory ? wateringFuelNeedLiters : fuelRemarkSource.fuel_need_liters)}</td>
          )}
          {printColumns.fuel_usage_estimate && showFuelEstimateCell && (
            <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={fuelEstimateRowsCount}>{fuelEstimateValue || "-"}</td>
          )}
            {showRemarksColumn && showRemarkCell && (
              <td className="border-2 border-black p-1 italic text-center align-middle break-words" rowSpan={remarkRowsCount}>{remarkValue || "-"}</td>
            )}
          </tr>
        );
      });
    });
  };

  const columnWidths = showRemarksColumn
    ? ['3%', '6%', '11.5%', '12%', '6%', '10%', '4%', '6.5%', '7.5%', '7%', '6%', '5%', '10%', '5.5%']
    : ['3.5%', '7%', '12.5%', '13.5%', '7%', '11%', '4%', '7.5%', '8.5%', '7.5%', '5%', '5%', '7.5%'];
  const displayColumnWidths = showRegionColumn && showRemarksColumn
    ? [columnWidths[0], "6%", ...columnWidths.slice(1, -1), "15%"]
    : showRegionColumn
    ? [columnWidths[0], "6%", ...columnWidths.slice(1)]
    : columnWidths;

  const colGroup = (
    <colgroup>
      {displayColumnWidths.map((width, index) => {
        const column = (['no', ...(showRegionColumn ? ['region'] : []), 'category', 'description', 'location', 'target_area', 'tools', 'unit', 'personnel', 'coordinator', 'foreman', 'basis', 'fuel_need_liters', 'fuel_usage_estimate', ...(showRemarksColumn ? ['remarks'] : [])] as const)[index];
        if (column in printColumns && !printColumns[column as keyof typeof printColumns]) return null;
        return <col key={index} style={{ width }} />;
      })}
    </colgroup>
  );

  const compactColGroup = (
    <colgroup>
      <col style={{ width: '4%' }} />
      {showRegionColumn && <col style={{ width: '8%' }} />}
      <col style={{ width: '9%' }} />
      <col style={{ width: '18%' }} />
      <col style={{ width: '20%' }} />
      <col style={{ width: '18%' }} />
      <col style={{ width: '4%' }} />
      <col style={{ width: '16%' }} />
      <col style={{ width: '5%' }} />
       <col style={{ width: '13%' }} />
       {showCompactForeman && <col style={{ width: '13%' }} />}
       <col style={{ width: '14%' }} />
    </colgroup>
  );

  const formatCompactLocation = (item: WorkPlan["items"][number]) => [
    item.location?.street,
    Array.isArray(item.location?.village) ? item.location.village.filter(Boolean).join(", ") : item.location?.village,
    item.location?.subDistrict,
  ].filter(Boolean).join(", ") || "-";

  const renderCompactPlanRows = (plan: WorkPlan, pIdx: number) => {
    const regionCell = regionCells.get(plan.id);
    const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
    const compactBodyColSpan = (showRegionColumn ? 9 : 8) + (showCompactForeman ? 1 : 0);

    if (isNoActivity) {
      return (
        <tr key={`compact-${plan.id}`}>
          {(!showRegionColumn || regionCell?.isFirst) && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={showRegionColumn ? regionCell?.rowSpan : 1}>{showRegionColumn ? regionCell?.number : pIdx + 1}</td>}
          {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
          <td className="border-2 border-black p-1 text-center font-bold">{plan.category}</td>
          <td colSpan={compactBodyColSpan} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">
            TIDAK ADA RENCANA KERJA/ KEGIATAN
          </td>
        </tr>
      );
    }

    const displayItems = getUniqueWorkPlanItems(plan.items);
    const compactRows = displayItems.flatMap((item, itemIndex) => {
      const tools = item.tools.length > 0 ? item.tools : [{ name: "", unit: 0, usage: "", members: 0 }];
      return tools.map((tool, toolIndex) => ({
        item,
        itemIndex,
        tool,
        toolIndex,
        detail: item.description || "-",
        location: formatCompactLocation(item),
        toolName: tool.name || "-",
        unit: tool.unit || "-",
        usage: tool.usage || "-",
        personnel: plan.category === "Tim Pohon" ? Number(tool.members || 0) || "-" : item.personnel?.members || "-",
        coordinator: item.coordinator || "-",
        basis: item.basis || "-",
      }));
    });

    if (plan.category === "Tim Pohon") {
      const getItemToolsKey = (item: WorkPlan["items"][number]) => JSON.stringify((item.tools || []).map((tool) => ({
        name: tool.name?.trim() || "",
        unit: Number(tool.unit || 0),
        usage: tool.usage?.trim() || "",
        members: Number(tool.members || 0),
      })));
      const toolSpans = getSequentialSpans(displayItems, getItemToolsKey);
      const teamSpans = getSequentialSpans(displayItems, (item) => `${item.coordinator}|${item.foreman || ""}`);

      return displayItems.map((item, itemIdx) => {
        let toolGroupStart = itemIdx;
        while (toolGroupStart > 0 && toolSpans[toolGroupStart] === 0) toolGroupStart--;
        const sharedTools = displayItems[toolGroupStart]?.tools || [];
        const alignTreeTools = toolSpans[toolGroupStart] === sharedTools.length && toolSpans[toolGroupStart] > 1;
        const tool = alignTreeTools
          ? sharedTools[itemIdx - toolGroupStart]
          : item.tools[0] || { name: "", unit: 0, usage: "", members: 0 };

        return (
          <tr key={`compact-${plan.id}-${itemIdx}`}>
            {itemIdx === 0 && (
              <>
                {(!showRegionColumn || regionCell?.isFirst) && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={showRegionColumn ? regionCell?.rowSpan : displayItems.length}>{showRegionColumn ? regionCell?.number : pIdx + 1}</td>}
                {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
                <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={displayItems.length}>{plan.category}</td>
              </>
            )}
            <td className="border-2 border-black p-1 text-left align-middle break-words">{item.description || "-"}</td>
            <td className="border-2 border-black p-1 text-left align-middle break-words">{formatCompactLocation(item)}</td>
            <td className="border-2 border-black p-1 text-center align-middle break-words">{tool.name ? `- ${tool.name}` : "-"}</td>
            <td className="border-2 border-black p-1 text-center align-middle">{tool.unit || "-"}</td>
            <td className="border-2 border-black p-1 text-center align-middle break-words">{tool.usage || "-"}</td>
            <td className="border-2 border-black p-1 text-center align-middle">{Number(tool.members || 0) || "-"}</td>
            {teamSpans[itemIdx] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={teamSpans[itemIdx]}>{item.coordinator || "-"}</td>}
            {showCompactForeman && teamSpans[itemIdx] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={teamSpans[itemIdx]}>{item.foreman || "-"}</td>}
            {getCompactBasisSpan(plan.id, itemIdx, 0) > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getCompactBasisSpan(plan.id, itemIdx, 0)}>{item.basis || "-"}</td>}
          </tr>
        );
      });
    }

    const totalPlanRows = compactRows.length;
    const personnelShouldStaySeparate = ["Taman Amplas", "Taman Kota", "Taman Area"].includes(plan.category.trim())
      && new Set(compactRows.map((row) => JSON.stringify({ detail: row.detail, location: row.location }))).size > 1;
    const sameInPlan = (value: unknown) => JSON.stringify({ category: plan.category, value });
    const sameInTool = (toolName: string, value: unknown) => JSON.stringify({ category: plan.category, toolName, value });
    const detailSpans = getSequentialSpans(compactRows, (row) => sameInPlan(row.detail));
    const locationSpans = getSequentialSpans(compactRows, (row) => sameInPlan(row.location));
    const toolSpans = getSequentialSpans(compactRows, (row) => sameInPlan(row.toolName));
    const unitSpans = getSequentialSpans(compactRows, (row) => sameInTool(row.toolName, row.unit));
    const usageSpans = getSequentialSpans(compactRows, (row) => sameInTool(row.toolName, row.usage));
    const personnelSpans = getSequentialSpans(compactRows, (row) => (
      personnelShouldStaySeparate
        ? JSON.stringify({ category: plan.category, itemIndex: row.itemIndex })
        : sameInTool(row.toolName, row.personnel)
    ));
    const coordinatorSpans = getSequentialSpans(compactRows, (row) => sameInTool(row.toolName, row.coordinator));

    return compactRows.map((row, rowIdx) => (
      <tr key={`compact-${plan.id}-${row.itemIndex}-${row.toolIndex}`}>
        {rowIdx === 0 && (
          <>
            {(!showRegionColumn || regionCell?.isFirst) && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={showRegionColumn ? regionCell?.rowSpan : totalPlanRows}>{showRegionColumn ? regionCell?.number : pIdx + 1}</td>}
            {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
            <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={totalPlanRows}>{plan.category}</td>
          </>
        )}
        {detailSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={detailSpans[rowIdx]}>{row.detail}</td>
        )}
        {locationSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={locationSpans[rowIdx]}>{row.location}</td>
        )}
        {toolSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={toolSpans[rowIdx]}>{row.toolName !== "-" ? `- ${row.toolName}` : "-"}</td>
        )}
        {unitSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle" rowSpan={unitSpans[rowIdx]}>{row.unit}</td>
        )}
        {usageSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={usageSpans[rowIdx]}>{row.usage}</td>
        )}
        {personnelSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle" rowSpan={personnelSpans[rowIdx]}>{row.personnel}</td>
        )}
        {coordinatorSpans[rowIdx] > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={coordinatorSpans[rowIdx]}>{row.coordinator}</td>
        )}
        {getCompactBasisSpan(plan.id, row.itemIndex, row.toolIndex) > 0 && (
          <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getCompactBasisSpan(plan.id, row.itemIndex, row.toolIndex)}>{row.basis}</td>
        )}
      </tr>
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="recap-sticky-toolbar max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/?tab=workplans')} className="px-2 md:px-4 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Kembali</span>
            </Button>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-[150px] bg-slate-50 border-slate-200 h-10 text-xs md:text-sm">
                    <SelectValue placeholder="Pilih Wilayah" />
                  </SelectTrigger>
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
                      <Checkbox checked={selectedCategories.includes('semua')} onCheckedChange={() => toggleCategory('semua')} onClick={(event) => event.stopPropagation()} />
                      <span className="cursor-pointer text-sm font-medium leading-none">Semua Kategori / Tim</span>
                    </div>
                    {categoryOptions.map((category) => (
                      <div key={category} className="flex cursor-pointer items-center space-x-2 rounded-md p-2 hover:bg-slate-100" onClick={() => toggleCategory(category)}>
                        <Checkbox checked={selectedCategories.includes(category)} onCheckedChange={() => toggleCategory(category)} onClick={(event) => event.stopPropagation()} />
                        <span className="cursor-pointer text-sm font-medium leading-none">{category}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <WorkPlanColumnPicker columns={visibleColumns} labels={workPlanColumnLabels} disabledColumns={{ target_area: isTimSiramSelected }} onToggle={toggleColumn} />
              <Select value={selectedDate === "semua" ? "semua" : selectedDate === "" ? "" : "custom"} onValueChange={(v) => {
                if (v === "semua") setSelectedDate("semua");
                else if (v === "custom") setSelectedDate(new Date().toISOString().split('T')[0]);
              }}>
                <SelectTrigger className="w-[110px] md:w-[160px] bg-slate-50 border-slate-200 h-10 text-xs md:text-sm">
                  <SelectValue placeholder="Pilih Tanggal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua</SelectItem>
                  <SelectItem value="custom">Pilih...</SelectItem>
                </SelectContent>
              </Select>
              {selectedDate !== "semua" && selectedDate !== "" && (
                <div className="relative">
                  <CalendarIcon className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-slate-400" />
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-7 md:pl-10 w-[130px] md:w-[180px] h-10 text-xs md:text-sm" />
                </div>
              )}
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

            {isLoggedIn && plans.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 h-10">
                    <Edit className="mr-2 h-4 w-4" /> Edit Data
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 w-80 overflow-y-auto">
                  {plans.map((plan) => (
                    <DropdownMenuItem key={plan.id} onClick={() => navigate(`/work-plans/edit/${plan.id}`)} className="cursor-pointer">
                      {plan.category} — {plan.items[0]?.description || "Rencana Kerja"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Tambah Baru</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div ref={printRef} className="print-area recap-print-area bg-white p-8 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-3 mb-4">
          {logoMode === "with-logo" && <img src={LOGO_MEDAN_URL} className="h-20 w-20 object-contain" alt="Logo Medan" />}
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase">Pemerintah Kota Medan</h1>
            <h2 className="text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2>
            <p className="text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p>
          </div>
          {logoMode === "with-logo" && <img src={LOGO_DLH_URL} className="h-20 w-20 object-contain" alt="Logo DLH" />}
        </div>

        <div className="text-center mb-5">
          <h3 className="text-xl font-bold underline uppercase">{recapTitle}</h3>
          <p className="text-lg font-bold">
            Tanggal: {selectedDate === "semua" ? "Semua Tanggal" : selectedDate ? format(new Date(selectedDate), 'EEEE, dd MMMM yyyy', { locale: localeId }) : "Memuat..."}
          </p>
        </div>

        <div className="recap-table-scroll overflow-x-auto print:overflow-visible">
          {plans.length > 0 ? (
            <>
              {tableMode === "compact" ? (
              <table className="work-plan-table w-full min-w-[1200px] border-collapse border-2 border-black text-[8px] leading-[1.25] table-fixed print:w-full print:min-w-0">
                {compactColGroup}
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-2 border-black p-1">No</th>
                    {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                    <th className="border-2 border-black p-1">Tim/ Kec</th>
                    <th className="border-2 border-black p-1">Detail Kegiatan</th>
                    <th className="border-2 border-black p-1">Lokasi</th>
                    <th className="border-2 border-black p-1">Alat Operasional</th>
                    <th className="border-2 border-black p-1">Unit</th>
                    <th className="border-2 border-black p-1">Kegunaan</th>
                    <th className="border-2 border-black p-1">Personil</th>
                    <th className="border-2 border-black p-1">Koordinator</th>
                    {showCompactForeman && <th className="border-2 border-black p-1">Mandor</th>}
                    <th className="border-2 border-black p-1">Dasar Pengerjaan</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan, pIdx) => renderCompactPlanRows(plan, pIdx))}
                </tbody>
              </table>
              ) : (
              <table className="work-plan-table w-full min-w-[1200px] border-collapse border-2 border-black text-[10px] leading-[1.35] table-fixed print:w-full print:min-w-0">
                {colGroup}
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-2 border-black p-1">No</th>
                    {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
                    {printColumns.category && <th className="border-2 border-black p-1">Tim/ Kec</th>}
                    {printColumns.description && <th className="border-2 border-black p-1">Detail Kegiatan</th>}
                    {printColumns.location && <th className="border-2 border-black p-1">Lokasi</th>}
                    {printColumns.target_area && <th className="border-2 border-black p-1">Target Luas (M²)</th>}
                    {printColumns.tools && <th className="border-2 border-black p-1">Alat Operasional</th>}
                    {printColumns.unit && <th className="border-2 border-black p-1">Unit</th>}
                    {printColumns.personnel && <th className="border-2 border-black p-1">Personil</th>}
                    {printColumns.coordinator && <th className="border-2 border-black p-1">Koordinator</th>}
                    {printColumns.foreman && <th className="border-2 border-black p-1">Mandor</th>}
                    {printColumns.basis && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Dasar<br />Pengerjaan</th>}
                    {printColumns.fuel_need_liters && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Kebutuhan<br />BBM<br />(Liter)</th>}
                    {printColumns.fuel_usage_estimate && <th className="border-2 border-black p-1 text-[8px] leading-tight whitespace-normal">Estimasi<br />Penggunaan<br />BBM (Liter)</th>}
                    {showRemarksColumn && <th className="border-2 border-black p-1">Keterangan</th>}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan, pIdx) => renderPlanRows(plan, pIdx))}
                </tbody>
              </table>
              )}

              <div className="keep-together">
                {signatureMode === "with-signature" && (
                  <div className="pdf-footer mt-12">
                    <div className="flex justify-end mb-4 text-[11px]"><p className="w-1/3 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                    <div className="grid grid-cols-3 gap-4 text-[11px] leading-normal">
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><SignatoryText position="kabid_tata_lingkungan" fallbackName="Heni Rustati, ST, M.Si" fallbackNip="NIP. 19720223 200604 2 002" /></div></div>
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><SignatoryText position="ketua_tim_pemeliharaan_lingkungan" fallbackName="Anitha Florida Ginting, ST, M. Si" fallbackNip="NIP. 19811128 201001 2 011" /></div></div>
                      <div className="text-center flex flex-col justify-between min-h-[200px] pb-4">
                        <div>
                          <p>Diketahui :</p>
                          {showTiurmaida && !showArdiansyah && (<><p className="font-bold">Kepala Koordinator Taman</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                          {showArdiansyah && !showTiurmaida && (<><p className="font-bold">Koordinator Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                          {showTiurmaida && showArdiansyah && (<><p className="font-bold">Koordinator Taman & Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                        </div>
                        <div>
                          {showTiurmaida && !showArdiansyah && (<SignatoryText position="kepala_koordinator_taman" regionId={regionId} categories={categoriesInPlans} fallbackName="Tiurmaida Silitonga" fallbackNip="NIP. 19690507 200701 2 042" />)}
                          {showArdiansyah && !showTiurmaida && (<SignatoryText position="kepala_koordinator_pohon" regionId={regionId} categories={categoriesInPlans} fallbackName="Ardiansyah Siregar" fallbackNip="NIP. 19860404 201001 1 015" />)}
                          {showTiurmaida && showArdiansyah && (
                            <div className="flex justify-around gap-2">
                              <div><SignatoryText position="kepala_koordinator_taman" regionId={regionId} categories={categoriesInPlans} fallbackName="Tiurmaida Silitonga" fallbackNip="NIP. 19690507 200701 2 042" nipClassName="text-[9px]" /></div>
                              <div><SignatoryText position="kepala_koordinator_pohon" regionId={regionId} categories={categoriesInPlans} fallbackName="Ardiansyah Siregar" fallbackNip="NIP. 19860404 201001 1 015" nipClassName="text-[9px]" /></div>
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
            <table className="work-plan-table w-full border-collapse border-2 border-black text-[10px] leading-[1.35] table-fixed">
              <tbody>
                <tr><td colSpan={showRemarksColumn ? 14 : 13} className="border-2 border-black p-8 text-center italic text-slate-400">{loading ? 'Memuat data rekap...' : 'Tidak ada rencana kerja untuk periode ini'}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkPlanDailyRecap;
