import React from "react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { WorkPlan, WorkPlanItem } from "@/types/workPlan";
import { getSequentialSpans, getUniqueWorkPlanItems } from "@/utils/work-plan-display";

type CompactRecapMode = "weekly" | "monthly";

type Region = { id: string; name: string };

type CompactRow = {
  itemIndex: number;
  detail: string;
  location: string;
  toolName: string;
  unit: string | number;
  usage: string;
  personnel: string | number;
  coordinator: string;
  foreman: string;
  basis: string;
};

type WorkPlanCompactTableProps = {
  plans: WorkPlan[];
  mode: CompactRecapMode;
  showRegionColumn: boolean;
  regions: Region[];
  columns: {
    date?: boolean;
    category?: boolean;
    description?: boolean;
    location?: boolean;
    tools?: boolean;
    unit?: boolean;
    personnel?: boolean;
    coordinator?: boolean;
    foreman?: boolean;
    basis?: boolean;
  };
};

export const workPlanCompactColumnLabels = {
  date: "Hari/Tanggal",
  category: "Tim/Kec.",
  description: "Detail Kegiatan",
  location: "Lokasi",
  tools: "Alat Operasional & Kegunaan",
  unit: "Unit",
  personnel: "Personel",
  coordinator: "Koordinator",
  foreman: "Mandor",
  basis: "Dasar Pengerjaan",
} as const;

const noActivityLabel = "TIDAK ADA RENCANA KERJA/ KEGIATAN";

const formatLocation = (item: WorkPlanItem) => [
  item.location?.street,
  Array.isArray(item.location?.village) ? item.location.village.filter(Boolean).join(", ") : item.location?.village,
  item.location?.subDistrict,
].filter(Boolean).join(", ") || "-";

const getToolsForTreeItem = (items: WorkPlanItem[], itemIndex: number) => {
  const getToolsKey = (item: WorkPlanItem) => JSON.stringify((item.tools || []).map((tool) => ({
    name: tool.name?.trim() || "",
    unit: Number(tool.unit || 0),
    usage: tool.usage?.trim() || "",
    members: Number(tool.members || 0),
  })));
  const toolSpans = getSequentialSpans(items, getToolsKey);
  let groupStart = itemIndex;
  while (groupStart > 0 && toolSpans[groupStart] === 0) groupStart -= 1;
  const sharedTools = items[groupStart]?.tools || [];
  const canAlign = toolSpans[groupStart] === sharedTools.length && toolSpans[groupStart] > 1;
  return canAlign
    ? sharedTools[itemIndex - groupStart] || items[itemIndex]?.tools?.[0]
    : items[itemIndex]?.tools?.[0];
};

export const WorkPlanCompactTable = ({ plans, mode, showRegionColumn, regions, columns }: WorkPlanCompactTableProps) => {
  const showDate = columns.date !== false;
  const showCategory = columns.category !== false;
  const showDescription = columns.description !== false;
  const showLocation = columns.location !== false;
  const showTools = columns.tools !== false;
  const showUnit = columns.unit !== false;
  const showPersonnel = columns.personnel !== false;
  const showCoordinator = columns.coordinator !== false;
  // Pertahankan perilaku Tabel Ringkas sebelumnya: kolom Mandor hanya
  // muncul untuk rekap yang seluruhnya berisi Tim Pohon.
  const showCompactForeman = columns.foreman !== false && plans.length > 0 && plans.every((plan) => plan.category === "Tim Pohon");
  const showBasis = columns.basis !== false;
  const getPlanRegionName = (plan: WorkPlan) => regions.find((region) => region.id === plan.region_id)?.name || "-";
  const getPlanRows = (plan: WorkPlan): CompactRow[] => {
    const items = getUniqueWorkPlanItems(plan.items);
    if (plan.items[0]?.description === noActivityLabel) return [];

    if (plan.category === "Tim Pohon") {
      return items.map((item, itemIndex) => {
        const tool = getToolsForTreeItem(items, itemIndex) || { name: "", unit: 0, usage: "", members: 0 };
        return {
          itemIndex,
          detail: item.description || "-",
          location: formatLocation(item),
          toolName: tool.name || "-",
          unit: tool.unit || "-",
          usage: tool.usage || "-",
          personnel: Number(tool.members || 0) || "-",
          coordinator: item.coordinator || "-",
          foreman: item.foreman || "-",
          basis: item.basis || "-",
        };
      });
    }

    return items.flatMap((item, itemIndex) => {
      const tools = item.tools?.length ? item.tools : [{ name: "", unit: 0, usage: "", members: 0 }];
      return tools.map((tool) => ({
        itemIndex,
        detail: item.description || "-",
        location: formatLocation(item),
        toolName: tool.name || "-",
        unit: tool.unit || "-",
        usage: tool.usage || "-",
        personnel: item.personnel?.members || "-",
        coordinator: item.coordinator || "-",
        foreman: item.foreman || "-",
        basis: item.basis || "-",
      }));
    });
  };

  const planRows = plans.map((plan) => getPlanRows(plan));
  const planRowCount = (index: number) => planRows[index].length || 1;

  const regionCells = new Map<string, { isFirst: boolean; rowSpan: number }>();
  if (showRegionColumn) {
    for (let start = 0; start < plans.length;) {
      const regionId = plans[start].region_id || "-";
      let end = start;
      let rowSpan = 0;
      while (end < plans.length && (plans[end].region_id || "-") === regionId) {
        rowSpan += planRowCount(end);
        end += 1;
      }
      for (let index = start; index < end; index += 1) {
        regionCells.set(plans[index].id, { isFirst: index === start, rowSpan });
      }
      start = end;
    }
  }

  const weeklyDateCells = new Map<string, { isFirst: boolean; rowSpan: number }>();
  if (mode === "weekly") {
    for (let start = 0; start < plans.length;) {
      const date = plans[start].date;
      let end = start;
      let rowSpan = 0;
      while (end < plans.length && plans[end].date === date) {
        rowSpan += planRowCount(end);
        end += 1;
      }
      for (let index = start; index < end; index += 1) {
        weeklyDateCells.set(plans[index].id, { isFirst: index === start, rowSpan });
      }
      start = end;
    }
  }

  const getSpan = (rows: CompactRow[], getValue: (row: CompactRow) => string) => getSequentialSpans(rows, getValue);
  const compactBodyColSpan = Math.max([
    showDescription,
    showLocation,
    showTools,
    showUnit,
    showTools,
    showPersonnel,
    showCoordinator,
    showCompactForeman,
    showBasis,
  ].filter(Boolean).length, 1);
  const weeklyDateNumbers = new Map<string, number>();
  if (mode === "weekly") {
    let currentNumber = 0;
    let lastDate = "";
    plans.forEach((plan) => {
      if (plan.date !== lastDate) {
        currentNumber += 1;
        lastDate = plan.date;
      }
      weeklyDateNumbers.set(plan.id, currentNumber);
    });
  }

  const renderNoActivity = (plan: WorkPlan, planIndex: number) => {
    const regionCell = regionCells.get(plan.id);
    const dateCell = weeklyDateCells.get(plan.id);
    return (
      <tr key={`compact-${plan.id}`}>
        {(mode === "monthly" || !dateCell || dateCell.isFirst) && (
          <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={mode === "weekly" && dateCell ? dateCell.rowSpan : 1}>{weeklyDateNumbers.get(plan.id) || planIndex + 1}</td>
        )}
        {showRegionColumn && regionCell?.isFirst && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
        {showDate && mode === "weekly" && dateCell?.isFirst && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={dateCell.rowSpan}>{format(parseISO(plan.date), "eee, dd/MM", { locale: localeId })}</td>}
        {showDate && mode === "monthly" && <td className="border-2 border-black p-1 text-center align-middle text-[8px]">{format(parseISO(plan.date), "dd/MM/yy")}</td>}
        {showCategory && <td className="border-2 border-black p-1 text-center font-bold align-middle">{plan.category}</td>}
        <td colSpan={compactBodyColSpan} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">{noActivityLabel}</td>
      </tr>
    );
  };

  return (
    <table className="w-full min-w-[1200px] border-collapse border-2 border-black text-[8px] leading-[1.25] table-fixed print:w-full print:min-w-0">
      <colgroup>
        <col style={{ width: "4%" }} />
        {showRegionColumn && <col style={{ width: "8%" }} />}
        {showDate && <col style={{ width: mode === "weekly" ? "7%" : "6%" }} />}
        {showCategory && <col style={{ width: "9%" }} />}
        {showDescription && <col style={{ width: "17%" }} />}
        {showLocation && <col style={{ width: "19%" }} />}
        {showTools && <col style={{ width: "16%" }} />}
        {showUnit && <col style={{ width: "4%" }} />}
        {showTools && <col style={{ width: "13%" }} />}
        {showPersonnel && <col style={{ width: "5%" }} />}
        {showCoordinator && <col style={{ width: "12%" }} />}
        {showCompactForeman && <col style={{ width: "12%" }} />}
        {showBasis && <col style={{ width: "13%" }} />}
      </colgroup>
      <thead>
        <tr className="bg-slate-100">
          <th className="border-2 border-black p-1">No</th>
          {showRegionColumn && <th className="border-2 border-black p-1">Wilayah</th>}
          {showDate && <th className="border-2 border-black p-1">{mode === "weekly" ? "Hari/Tgl" : "Tgl"}</th>}
          {showCategory && <th className="border-2 border-black p-1">Tim/Kec</th>}
          {showDescription && <th className="border-2 border-black p-1">Detail Kegiatan</th>}
          {showLocation && <th className="border-2 border-black p-1">Lokasi</th>}
          {showTools && <th className="border-2 border-black p-1">Alat Operasional</th>}
          {showUnit && <th className="border-2 border-black p-1">Unit</th>}
          {showTools && <th className="border-2 border-black p-1">Kegunaan</th>}
          {showPersonnel && <th className="border-2 border-black p-1">Personil</th>}
          {showCoordinator && <th className="border-2 border-black p-1">Koordinator</th>}
          {showCompactForeman && <th className="border-2 border-black p-1">Mandor</th>}
          {showBasis && <th className="border-2 border-black p-1">Dasar Pengerjaan</th>}
        </tr>
      </thead>
      <tbody>
        {plans.map((plan, planIndex) => {
          if (planRows[planIndex].length === 0) return renderNoActivity(plan, planIndex);
          const rows = planRows[planIndex];
          const totalRows = rows.length;
          const regionCell = regionCells.get(plan.id);
          const dateCell = weeklyDateCells.get(plan.id);
          const detailSpans = getSpan(rows, (row) => row.detail);
          const locationSpans = getSpan(rows, (row) => row.location);
          const toolSpans = getSpan(rows, (row) => row.toolName);
          const unitSpans = getSpan(rows, (row) => `${row.toolName}|${row.unit}`);
          const usageSpans = getSpan(rows, (row) => `${row.toolName}|${row.usage}`);
          const personnelSpans = getSpan(rows, (row) => `${row.toolName}|${row.personnel}`);
          const coordinatorSpans = getSpan(rows, (row) => `${row.toolName}|${row.coordinator}`);
          const basisSpans = getSpan(rows, (row) => row.basis);

          return rows.map((row, rowIndex) => {
            const first = rowIndex === 0;
            return (
              <tr key={`compact-${plan.id}-${rowIndex}`}>
                {first && <td className="border-2 border-black p-1 text-center align-middle font-bold" rowSpan={mode === "weekly" && dateCell ? dateCell.rowSpan : totalRows}>{weeklyDateNumbers.get(plan.id) || planIndex + 1}</td>}
                {showRegionColumn && regionCell?.isFirst && first && <td className="border-2 border-black p-1 text-center font-bold align-middle whitespace-normal" rowSpan={regionCell.rowSpan}>{getPlanRegionName(plan)}</td>}
                {showDate && mode === "weekly" && dateCell?.isFirst && first && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={dateCell.rowSpan}>{format(parseISO(plan.date), "eee, dd/MM", { locale: localeId })}</td>}
                {showDate && mode === "monthly" && first && <td className="border-2 border-black p-1 text-center align-middle text-[8px]" rowSpan={totalRows}>{format(parseISO(plan.date), "dd/MM/yy")}</td>}
                {showCategory && first && <td className="border-2 border-black p-1 text-center font-bold align-middle" rowSpan={totalRows}>{plan.category}</td>}
                {showDescription && detailSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={detailSpans[rowIndex]}>{row.detail}</td>}
                {showLocation && locationSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-left align-middle break-words" rowSpan={locationSpans[rowIndex]}>{row.location}</td>}
                {showTools && toolSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={toolSpans[rowIndex]}>{row.toolName !== "-" ? `- ${row.toolName}` : "-"}</td>}
                {showUnit && unitSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={unitSpans[rowIndex]}>{row.unit}</td>}
                {showTools && usageSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={usageSpans[rowIndex]}>{row.usage}</td>}
                {showPersonnel && personnelSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle" rowSpan={personnelSpans[rowIndex]}>{row.personnel}</td>}
                {showCoordinator && coordinatorSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={coordinatorSpans[rowIndex]}>{row.coordinator}</td>}
                {showCompactForeman && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={getSpan(rows, (candidate) => `${candidate.toolName}|${candidate.foreman}`)[rowIndex]}>{row.foreman}</td>}
                {showBasis && basisSpans[rowIndex] > 0 && <td className="border-2 border-black p-1 text-center align-middle break-words" rowSpan={basisSpans[rowIndex]}>{row.basis}</td>}
              </tr>
            );
          });
        })}
      </tbody>
    </table>
  );
};

export default WorkPlanCompactTable;
