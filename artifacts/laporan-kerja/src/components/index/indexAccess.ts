import {
  canManageReportEntries,
  canManageWorkPlans as hasWorkPlanManagement,
  isAdminBbmPusatAccess,
  isGlobalWorkPlanAdmin,
  isLaporanBbmAdmin,
  isNotaDinasAdmin,
  isPimpinanAccess,
  isSuperAdminAccess,
  roleRequiresRegion,
  type UserRole,
} from "@/constants/access-control";
import { canPrintReportRecap } from "@/utils/recap-print-permissions";

type IndexProfile = {
  role?: UserRole | null;
  category?: string | null;
  region_id?: string | null;
  is_active?: boolean;
} | null;

export function getIndexAccess(profile: IndexProfile, email: string | undefined, isLoggedIn: boolean) {
  const role = profile?.role;
  const isAdmin = isSuperAdminAccess(role, email);
  const canFilterWorkPlanRegions = isGlobalWorkPlanAdmin(role, email);
  const isAdminBbm = role === "admin_bbm" || role === "admin_rencana_kerja_bbm" || role === "admin_wilayah_bbm";
  const isAdminBbmPusat = isAdminBbmPusatAccess(role);
  const isAdminLaporanBbm = isLaporanBbmAdmin(role);
  const isAdminSpj = role === "admin_spj_bbm";
  const isAdminSpjOli = role === "admin_spj_oli";
  const isNotaDinasOnly = isNotaDinasAdmin(role);
  const isPimpinan = isPimpinanAccess(role, email);
  const isAdminRencanaKerja = role === "admin_rencana_kerja"
    || role === "admin_rencana_kerja_bbm"
    || role === "admin_wilayah_bbm";
  const isAdminWilayah = role === "admin_wilayah" || role === "admin_wilayah_bbm";
  const accountRegionId = !isAdmin && (roleRequiresRegion(role) || isAdminSpjOli) ? profile?.region_id || "__unassigned__" : null;
  const isCombinedWorkspace = isAdminBbm && (isAdminRencanaKerja || isAdminWilayah);
  const isFuelSpecialist = (isAdminBbm || isAdminBbmPusat || isAdminLaporanBbm || isAdminSpj || isAdminSpjOli) && !isCombinedWorkspace;
  const canViewReportsTab = !isNotaDinasOnly && !isFuelSpecialist && (!isAdminRencanaKerja || isAdminWilayah);
  const isOvertimeOnly = role === "admin_rekap_lembur";
  const canViewOvertime = isAdmin || isOvertimeOnly;
  const isLaporanOnly = role === "laporan";
  const isUserRestricted = isLoggedIn && role === "user" && !isPimpinan;
  const isAccountActive = profile?.is_active !== false;
  const canManageReports = isLoggedIn && isAccountActive && !isPimpinan && canManageReportEntries(role, email);
  const canManageWorkPlans = isLoggedIn && isAccountActive && !isPimpinan && hasWorkPlanManagement(role, email);
  const canPrintDailyRecap = canPrintReportRecap(role, "daily", email);
  const canPrintWeeklyRecap = canPrintReportRecap(role, "weekly", email);
  const canPrintMonthlyRecap = canPrintReportRecap(role, "monthly", email);
  const canPrintAnyReportRecap = canPrintDailyRecap || canPrintWeeklyRecap || canPrintMonthlyRecap;
  const loginScopeLabel = isPimpinan
    ? "Pimpinan"
    : isLaporanOnly
      ? "Petugas Laporan"
      : isUserRestricted
        ? (profile?.category || "Petugas Lapangan")
        : "Sistem Laporan";

  return {
    isAdmin,
    canFilterWorkPlanRegions,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    isPimpinan,
    isAdminRencanaKerja,
    isAdminWilayah,
    accountRegionId,
    isCombinedWorkspace,
    isFuelSpecialist,
    canViewReportsTab,
    isOvertimeOnly,
    canViewOvertime,
    isLaporanOnly,
    isUserRestricted,
    canManageReports,
    canManageWorkPlans,
    canPrintDailyRecap,
    canPrintWeeklyRecap,
    canPrintMonthlyRecap,
    canPrintAnyReportRecap,
    showExecutiveHero: isAdmin,
    loginScopeLabel,
  };
}
