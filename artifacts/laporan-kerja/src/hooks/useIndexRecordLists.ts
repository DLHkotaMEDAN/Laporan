import { useMemo, type Dispatch, type SetStateAction } from "react";
import { formatLocation } from "@/components/index/indexConfig";
import { getWorkPlanDescriptions, type ReportSortKey, type SortDirection, type WorkPlanSortKey } from "@/components/index/IndexDataTables";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

type UseIndexRecordListsOptions = {
  reports: Report[];
  workPlans: WorkPlan[];
  searchQuery: string;
  isAdmin: boolean;
  canFilterWorkPlanRegions: boolean;
  selectedRegion: string;
  reportSortKey: ReportSortKey;
  reportSortDirection: SortDirection;
  setReportSortKey: Dispatch<SetStateAction<ReportSortKey>>;
  setReportSortDirection: Dispatch<SetStateAction<SortDirection>>;
  workPlanSortKey: WorkPlanSortKey;
  workPlanSortDirection: SortDirection;
  setWorkPlanSortKey: Dispatch<SetStateAction<WorkPlanSortKey>>;
  setWorkPlanSortDirection: Dispatch<SetStateAction<SortDirection>>;
};

const compareSortValues = (left: string | number, right: string | number) => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
};

export function useIndexRecordLists({
  reports,
  workPlans,
  searchQuery,
  isAdmin,
  canFilterWorkPlanRegions,
  selectedRegion,
  reportSortKey,
  reportSortDirection,
  setReportSortKey,
  setReportSortDirection,
  workPlanSortKey,
  workPlanSortDirection,
  setWorkPlanSortKey,
  setWorkPlanSortDirection,
}: UseIndexRecordListsOptions) {
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const search = searchQuery.toLowerCase();
      const searchableTasks = Array.isArray(report.tasks) ? report.tasks : [];
      const matchSearch = !search || [
        report.description,
        formatLocation(report.location),
        ...searchableTasks.flatMap((task) => [task.description, formatLocation(task.location)]),
      ].some((value) => value?.toLowerCase().includes(search));
      const matchRegion = !isAdmin || selectedRegion === "semua" || report.region_id === selectedRegion;
      return matchSearch && matchRegion;
    });
  }, [reports, searchQuery, isAdmin, selectedRegion]);

  const filteredWorkPlans = useMemo(() => {
    return workPlans.filter((plan) => {
      const search = searchQuery.toLowerCase().trim();
      const matchSearch = !search || (Array.isArray(plan.items) && plan.items.some((item) =>
        [item.description, formatLocation(item.location)].some((value) => value?.toLowerCase().includes(search))
      ));
      const matchRegion = !canFilterWorkPlanRegions || selectedRegion === "semua" || plan.region_id === selectedRegion;
      return matchSearch && matchRegion;
    });
  }, [workPlans, searchQuery, canFilterWorkPlanRegions, selectedRegion]);

  const formatReportLocation = (report: Report) => formatLocation(report.location);
  const formatWorkPlanLocation = (plan: WorkPlan) =>
    Array.isArray(plan.items) ? plan.items.map((item) => formatLocation(item.location)).join(" | ") : "-";

  const getReportSortValue = (report: Report, key: ReportSortKey) => {
    if (key === "date") return new Date(report.date).getTime();
    if (key === "category") return report.category;
    if (key === "description") return report.tasks?.map((task) => task.description).join(" | ") || report.description;
    if (key === "location") return report.tasks?.map((task) => formatLocation(task.location)).join(" | ") || formatReportLocation(report);
    if (key === "volume") return report.volume;
    return report.remarks || report.pimpinan_note || "";
  };

  const getWorkPlanSortValue = (plan: WorkPlan, key: WorkPlanSortKey) => {
    if (key === "date") return new Date(plan.date).getTime();
    if (key === "category") return plan.category;
    if (key === "description") return getWorkPlanDescriptions(plan).join(" | ");
    if (key === "location") return formatWorkPlanLocation(plan);
    return plan.is_visible === false ? 0 : 1;
  };

  const sortedReports = useMemo(() => [...filteredReports].sort((left, right) => {
    const result = compareSortValues(getReportSortValue(left, reportSortKey), getReportSortValue(right, reportSortKey));
    return reportSortDirection === "asc" ? result : -result;
  }), [filteredReports, reportSortKey, reportSortDirection]);

  const sortedWorkPlans = useMemo(() => [...filteredWorkPlans].sort((left, right) => {
    const result = compareSortValues(getWorkPlanSortValue(left, workPlanSortKey), getWorkPlanSortValue(right, workPlanSortKey));
    return workPlanSortDirection === "asc" ? result : -result;
  }), [filteredWorkPlans, workPlanSortKey, workPlanSortDirection]);

  const toggleReportSort = (key: ReportSortKey) => {
    if (reportSortKey === key) {
      setReportSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setReportSortKey(key);
    setReportSortDirection("asc");
  };

  const toggleWorkPlanSort = (key: WorkPlanSortKey) => {
    if (workPlanSortKey === key) {
      setWorkPlanSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setWorkPlanSortKey(key);
    setWorkPlanSortDirection("asc");
  };

  return {
    filteredReports,
    filteredWorkPlans,
    sortedReports,
    sortedWorkPlans,
    formatReportLocation,
    toggleReportSort,
    toggleWorkPlanSort,
  };
}
