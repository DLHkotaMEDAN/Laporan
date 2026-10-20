import { useRef, type Dispatch, type SetStateAction } from "react";
import { showError } from "@/utils/toast";
import { getErrorMessage, logger } from "@/lib/logger";
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
  const requestIdRef = useRef(0);

  const loadData = async (
    date = selectedDate,
    month = selectedMonth,
    year = selectedYear,
    category = selectedCategory,
  ) => {
    const requestId = ++requestIdRef.current;

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

      // Ignore a slower response when a newer filter request has already
      // started. This keeps stale data from replacing the current view.
      if (requestId !== requestIdRef.current) return false;

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
      return true;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        logger.error("Failed to load index data", getErrorMessage(error));
        showError(`Gagal memuat data: ${getErrorMessage(error)}`);
      }
      return false;
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  return loadData;
}
