import { useCallback, useEffect, useRef, useState } from "react";
import { emptyRecordCounts, type MainTab, type RecordCounts } from "@/components/index/indexConfig";
import { getDatabaseRecordCount } from "@/services/indexRecordCountService";
import { getErrorMessage, logger } from "@/lib/logger";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

type UseIndexRecordCountsOptions = {
  reports: Report[];
  workPlans: WorkPlan[];
  hasProfile: boolean;
  isLoggedIn: boolean;
  canViewReportsTab: boolean;
  isOvertimeOnly: boolean;
  isNotaDinasOnly: boolean;
  isLaporanOnly: boolean;
  isFuelSpecialist: boolean;
  canViewOvertime: boolean;
  isAdmin: boolean;
  isAdminBbm: boolean;
  isAdminBbmPusat: boolean;
  isAdminLaporanBbm: boolean;
  isPimpinan: boolean;
  isAdminSpj: boolean;
  isAdminSpjOli: boolean;
  accountRegionId: string | null;
};

export function useIndexRecordCounts({
  reports,
  workPlans,
  hasProfile,
  isLoggedIn,
  canViewReportsTab,
  isOvertimeOnly,
  isNotaDinasOnly,
  isLaporanOnly,
  isFuelSpecialist,
  canViewOvertime,
  isAdmin,
  isAdminBbm,
  isAdminBbmPusat,
  isAdminLaporanBbm,
  isPimpinan,
  isAdminSpj,
  isAdminSpjOli,
  accountRegionId,
}: UseIndexRecordCountsOptions) {
  const [recordCounts, setRecordCounts] = useState<RecordCounts>(emptyRecordCounts);
  const reportsRef = useRef<Report[]>([]);
  const workPlansRef = useRef<WorkPlan[]>([]);

  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { workPlansRef.current = workPlans; }, [workPlans]);

  const loadRecordCounts = useCallback(async () => {
    if (!hasProfile || !isLoggedIn) return;

    const jobs: Partial<Record<MainTab, Promise<number>>> = {};
    const canShowReports = canViewReportsTab && !isOvertimeOnly;
    const canShowWorkPlans = !isNotaDinasOnly && !isLaporanOnly && !isFuelSpecialist && !isOvertimeOnly;

    if (canShowReports && reportsRef.current.length > 0) {
      // Baca ref agar selalu memakai data terbaru, bukan nilai closure lama.
      jobs.reports = Promise.resolve(reportsRef.current.length);
    }
    if (canShowWorkPlans && workPlansRef.current.length > 0) {
      jobs.workplans = Promise.resolve(workPlansRef.current.length);
    }
    if (canViewOvertime) {
      jobs.overtime = getDatabaseRecordCount("overtime_records", { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isAdminBbm) {
      jobs.fuel_reports = getDatabaseRecordCount("fuel_reports", { regionId: accountRegionId, reportType: "admin_bbm", softDeleted: false });
    }
    if (isAdmin || isAdminBbmPusat) {
      jobs.fuel_reports_pusat = getDatabaseRecordCount("fuel_reports_pusat", { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isAdminLaporanBbm) {
      jobs.laporan_bbm = getDatabaseRecordCount("laporan_bbm_reports", { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isPimpinan || isAdminSpj || isAdminSpjOli) {
      jobs.spj_oli = getDatabaseRecordCount("spj_oli_records", { regionId: accountRegionId, softDeleted: false });
    }
    if (isAdmin || isNotaDinasOnly) {
      jobs.nota_dinas = getDatabaseRecordCount("nota_dinas_records", { regionId: accountRegionId, softDeleted: false });
    }

    const entries = await Promise.all(Object.entries(jobs).map(async ([tab, job]) => {
      try {
        return [tab, await job] as const;
      } catch (error) {
        logger.warn(`Gagal menghitung record tab ${tab}: ${getErrorMessage(error)}`);
        return [tab, null] as const;
      }
    }));

    setRecordCounts((current) => ({
      ...current,
      ...Object.fromEntries(entries),
    } as RecordCounts));
  }, [
    hasProfile,
    isLoggedIn,
    canViewReportsTab,
    isOvertimeOnly,
    isNotaDinasOnly,
    isLaporanOnly,
    isFuelSpecialist,
    canViewOvertime,
    isAdmin,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isPimpinan,
    isAdminSpj,
    isAdminSpjOli,
    accountRegionId,
  ]);

  return { recordCounts, setRecordCounts, loadRecordCounts };
}
