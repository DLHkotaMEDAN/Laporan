import { useMemo } from "react";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

export const useIndexStats = (reports: Report[], workPlans: WorkPlan[]) => useMemo(() => {
  const today = new Date().toISOString().split("T")[0];
  return {
    totalReports: reports.length,
    totalWorkPlans: workPlans.length,
    reportsToday: reports.filter(report => report.date === today).length,
    plansToday: workPlans.filter(workPlan => workPlan.date === today).length,
  };
}, [reports, workPlans]);
