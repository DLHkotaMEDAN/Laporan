import { ArrowUpDown, ChevronDown, ChevronUp, ClipboardList, Edit, Eye, EyeOff, Loader2, Search, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TotalRecordLabel from "@/components/TotalRecordLabel";
import { PointList } from "@/components/index/IndexShared";
import { getUnitByCategory } from "@/utils/report-helpers";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

export type SortDirection = "asc" | "desc";
export type ReportSortKey = "date" | "category" | "description" | "location" | "volume" | "remarks";
export type WorkPlanSortKey = "date" | "category" | "description" | "location" | "status";

export const getWorkPlanDescriptions = (plan: WorkPlan): string[] => {
  if (!Array.isArray(plan.items)) return [];
  return plan.items.map((item) => item.description?.trim() || "Tanpa uraian");
};

type ReportTableProps = {
  records: Report[];
  loading: boolean;
  recordCount: number | null;
  isLoggedIn: boolean;
  canManageReports: boolean;
  sortKey: ReportSortKey;
  sortDirection: SortDirection;
  formatLocation: (location: Report["location"] | undefined) => string;
  formatReportLocation: (report: Report) => string;
  onSort: (key: ReportSortKey) => void;
  onNavigate: (path: string) => void;
  onDelete: (event: MouseEvent, report: Report) => void;
  onReset: () => void;
};

export function IndexReportsTable({
  records,
  loading,
  recordCount,
  isLoggedIn,
  canManageReports,
  sortKey,
  sortDirection,
  formatLocation,
  formatReportLocation,
  onSort,
  onNavigate,
  onDelete,
  onReset,
}: ReportTableProps) {
  return (
    <>
      <TotalRecordLabel count={recordCount} />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Sinkronisasi data laporan...</p>
        </div>
      ) : records.length > 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-12">No</th>
                  <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-28"><SortButton label="Tanggal" active={sortKey === "date"} direction={sortDirection} onClick={() => onSort("date")} align="center" tone="blue" /></th>
                  <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-36"><SortButton label="Kategori" active={sortKey === "category"} direction={sortDirection} onClick={() => onSort("category")} tone="blue" /></th>
                  <th className="px-3 py-3 text-left font-semibold border-r border-slate-600"><SortButton label="Uraian Kegiatan" active={sortKey === "description"} direction={sortDirection} onClick={() => onSort("description")} tone="blue" /></th>
                  <th className="px-3 py-3 text-left font-semibold border-r border-slate-600"><SortButton label="Lokasi" active={sortKey === "location"} direction={sortDirection} onClick={() => onSort("location")} tone="blue" /></th>
                  <th className="px-3 py-3 text-right font-semibold border-r border-slate-600 w-28"><SortButton label="Volume" active={sortKey === "volume"} direction={sortDirection} onClick={() => onSort("volume")} align="right" tone="blue" /></th>
                  <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-40"><SortButton label="Keterangan" active={sortKey === "remarks"} direction={sortDirection} onClick={() => onSort("remarks")} tone="blue" /></th>
                  {isLoggedIn && <th className="px-3 py-3 text-center font-semibold w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((report, index) => (
                  <tr
                    key={report.id}
                    className={index % 2 === 0 ? "bg-white hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100" : "bg-slate-50/70 hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100"}
                    onClick={() => onNavigate(`/daily-rekap?date=${report.date}&categories=${encodeURIComponent(report.category)}`)}
                  >
                    <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                    <td className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">{report.date}</td>
                    <td className="px-3 py-3 border-r border-slate-100"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">{report.category}</Badge></td>
                    <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100 max-w-[260px] whitespace-normal break-words leading-relaxed align-top"><PointList values={report.tasks?.map((task) => task.description?.trim() || "Tanpa uraian") || []} fallback={report.description || "Tanpa uraian"} /></td>
                    <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[280px] leading-relaxed align-top"><PointList values={report.tasks?.map((task) => formatLocation(task.location)) || []} fallback={formatReportLocation(report)} /></td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-700 border-r border-slate-100">{report.volume} {getUnitByCategory(report.category)}</td>
                    <td className="px-3 py-3 text-slate-500 italic border-r border-slate-100 max-w-[160px]"><span className="line-clamp-2">{report.remarks || report.pimpinan_note || "-"}</span></td>
                    {isLoggedIn && (
                      <td className="px-2 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(event) => { event.stopPropagation(); onNavigate(`/daily-rekap?date=${report.date}&categories=${encodeURIComponent(report.category)}`); }}><Eye size={13} /></Button>
                          {canManageReports && <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(event) => { event.stopPropagation(); onNavigate(`/edit/${report.id}`); }}><Edit size={13} /></Button>}
                          {canManageReports && <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(event) => onDelete(event, report)}><Trash2 size={13} /></Button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500"><strong className="text-slate-700">{records.length}</strong> laporan harian ditampilkan</div>
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="text-slate-300 h-10 w-10" /></div>
          <p className="text-slate-900 font-black text-xl">Tidak Ada Laporan</p>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto">Coba sesuaikan filter pencarian atau buat laporan baru untuk hari ini.</p>
          <Button variant="link" onClick={onReset} className="mt-4 text-blue-600 font-bold">Reset Semua Filter</Button>
        </div>
      )}
    </>
  );
}

type WorkPlanTableProps = {
  records: WorkPlan[];
  loading: boolean;
  recordCount: number | null;
  canManageWorkPlans: boolean;
  isPimpinan: boolean;
  sortKey: WorkPlanSortKey;
  sortDirection: SortDirection;
  onSort: (key: WorkPlanSortKey) => void;
  onNavigate: (path: string) => void;
  onToggleVisibility: (event: MouseEvent, plan: WorkPlan) => void;
  onDelete: (event: MouseEvent, plan: WorkPlan) => void;
  onReset: () => void;
  getDescriptions: (plan: WorkPlan) => string[];
  formatLocation: (location: Report["location"] | undefined) => string;
};

export function IndexWorkPlansTable({
  records,
  loading,
  recordCount,
  canManageWorkPlans,
  isPimpinan,
  sortKey,
  sortDirection,
  onSort,
  onNavigate,
  onToggleVisibility,
  onDelete,
  onReset,
  getDescriptions,
  formatLocation,
}: WorkPlanTableProps) {
  return (
    <>
      <TotalRecordLabel count={recordCount} />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="h-10 w-10 animate-spin text-green-600" /><p className="text-slate-500 font-medium">Memuat rencana kerja...</p></div>
      ) : records.length > 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[980px]">
              <thead><tr className="bg-slate-700 text-white">
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-12">No</th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-28"><SortButton label="Tanggal" active={sortKey === "date"} direction={sortDirection} onClick={() => onSort("date")} align="center" tone="emerald" /></th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600 w-36"><SortButton label="Kategori" active={sortKey === "category"} direction={sortDirection} onClick={() => onSort("category")} tone="emerald" /></th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600"><SortButton label="Uraian Rencana" active={sortKey === "description"} direction={sortDirection} onClick={() => onSort("description")} tone="emerald" /></th>
                <th className="px-3 py-3 text-left font-semibold border-r border-slate-600"><SortButton label="Lokasi" active={sortKey === "location"} direction={sortDirection} onClick={() => onSort("location")} tone="emerald" /></th>
                <th className="px-3 py-3 text-center font-semibold border-r border-slate-600 w-24"><SortButton label="Status" active={sortKey === "status"} direction={sortDirection} onClick={() => onSort("status")} align="center" tone="emerald" /></th>
                {canManageWorkPlans && <th className="px-3 py-3 text-center font-semibold w-28">Aksi</th>}
              </tr></thead>
              <tbody>
                {records.map((plan, index) => {
                  const isHidden = plan.is_visible === false;
                  return (
                    <tr key={plan.id} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/70"} ${isHidden ? "opacity-70" : ""} hover:bg-emerald-50/50 transition-colors cursor-pointer border-b border-slate-100`} onClick={() => onNavigate(`/work-plans/daily-rekap?date=${plan.date}&category=${encodeURIComponent(plan.category)}`)}>
                      <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100">{index + 1}</td>
                      <td className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 whitespace-nowrap">{plan.date}</td>
                      <td className="px-3 py-3 border-r border-slate-100"><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] whitespace-nowrap">{plan.category}</Badge></td>
                      <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100 max-w-[280px] whitespace-normal break-words leading-relaxed align-top"><PointList values={getDescriptions(plan)} fallback="Rencana Kerja" /></td>
                      <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[280px] leading-relaxed align-top"><PointList values={plan.items?.map((item) => formatLocation(item.location)) || []} fallback="Lokasi tidak ditentukan" /></td>
                      <td className="px-3 py-3 text-center border-r border-slate-100"><Badge variant="outline" className={isHidden ? "text-[10px] font-bold bg-red-50 text-red-600 border-red-100" : "text-[10px] font-bold bg-green-50 text-green-700 border-green-100"}>{isHidden ? "Hidden" : "Tampil"}</Badge></td>
                      {canManageWorkPlans && (
                        <td className="px-2 py-3 text-center"><div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" disabled={isPimpinan} onClick={(event) => onToggleVisibility(event, plan)}>{isHidden ? <EyeOff size={13} /> : <Eye size={13} />}</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" disabled={!canManageWorkPlans} onClick={(event) => { event.stopPropagation(); if (canManageWorkPlans) onNavigate(`/work-plans/edit/${plan.id}`); }}><Edit size={13} /></Button>
                          {canManageWorkPlans && <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(event) => onDelete(event, plan)}><Trash2 size={13} /></Button>}
                        </div></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t bg-slate-50 text-xs text-slate-500"><strong className="text-slate-700">{records.length}</strong> rencana kerja ditampilkan</div>
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><ClipboardList className="text-slate-300 h-10 w-10" /></div>
          <p className="text-slate-900 font-black text-xl">Belum Ada Rencana</p>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto">Rencana kerja untuk periode ini belum tersedia atau tidak ditemukan.</p>
          <Button variant="link" onClick={onReset} className="mt-4 text-green-600 font-bold">Reset Semua Filter</Button>
        </div>
      )}
    </>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
  tone,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "center" | "right";
  tone: "blue" | "emerald";
}) {
  const icon = !active
    ? <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
    : direction === "asc"
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  const toneClass = tone === "blue" ? "hover:text-blue-100" : "hover:text-emerald-100";
  const alignmentClass = align === "center" ? "mx-auto flex justify-center" : align === "right" ? "ml-auto flex justify-end" : "flex";
  return <button type="button" onClick={onClick} className={`${alignmentClass} items-center gap-1.5 ${toneClass}`}>{label}{icon}</button>;
}
