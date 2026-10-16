import type { Dispatch, SetStateAction } from "react";
import { showError } from "@/utils/toast";
import { logger } from "@/lib/logger";
import { reportService, type ReportFilters } from "@/services/reportService";
import { workPlanService, type WorkPlanFilters } from "@/services/workPlanService";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";
import type { RecordCounts } from "@/components/index/indexConfig";

type UseIndexDataLoaderOptions = {
  selectedDate: string;
  selectedMonth: string;
  selectedYear: string;
  selectedCategory: string;
  selectedRegion: string;
  profileCategory: string | null | undefined;
  isUserRestricted: boolean;
  isAdmin: boolean;
  accountRegionId: string | null;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setReports: Dispatch<SetStateAction<Report[]>>;
  setWorkPlans: Dispatch<SetStateAction<WorkPlan[]>>;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setRecordCounts: Dispatch<SetStateAction<RecordCounts>>;
};

export function useIndexDataLoader({
  selectedDate,
  selectedMonth,
  selectedYear,
  selectedCategory,
  selectedRegion,
  profileCategory,
  isUserRestricted,
  isAdmin,
  accountRegionId,
  setLoading,
  setReports,
  setWorkPlans,
  setSelectedRegion,
  setRecordCounts,
}: UseIndexDataLoaderOptions) {
  const loadData = async (
    date = selectedDate,
    month = selectedMonth,
    year = selectedYear,
    category = selectedCategory,
  ) => {
    try {
      setLoading(true);
      const effectiveCategory = isUserRestricted
        ? (profileCategory ?? null)
        : (category !== "semua" ? category : null);
      const effectiveRegionId = accountRegionId
        ?? (isAdmin && selectedRegion !== "semua" ? selectedRegion : null);
      const dateFilter: ReportFilters["dateFilter"] = date
        ? { type: "date", value: date }
        : month !== "semua" && year !== "semua"
          ? { type: "month", month, year }
          : year !== "semua"
            ? { type: "year", year }
            : null;

      const reportFilters: ReportFilters = {
        dateFilter,
        category: effectiveCategory,
        regionId: effectiveRegionId,
      };
      const workPlanFilters: WorkPlanFilters = {
        dateFilter,
        category: effectiveCategory,
        regionId: effectiveRegionId,
      };
      const [reportsData, workPlansData] = await Promise.all([
        reportService.getFilteredReports(reportFilters),
        workPlanService.getFilteredWorkPlans(workPlanFilters),
      ]);

      setReports(reportsData);
      setWorkPlans(workPlansData);
      setRecordCounts((current) => ({
        ...current,
        reports: reportsData.length,
        workplans: workPlansData.length,
      }));

      if (accountRegionId && selectedRegion !== accountRegionId) {
        setSelectedRegion(accountRegionId);
      } else if (!isAdmin) {
        setSelectedRegion("semua");
      }
    } catch (error) {
      logger.error("Failed to load index data", error);
      showError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  return loadData;
}
