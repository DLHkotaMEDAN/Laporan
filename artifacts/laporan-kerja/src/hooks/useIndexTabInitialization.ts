import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { useSearchParams } from "react-router-dom";
import type { getIndexAccess } from "@/components/index/indexAccess";
import { isMainTab, type IndexViewState, type MainTab } from "@/components/index/indexConfig";

type SetSearchParams = ReturnType<typeof useSearchParams>[1];
type IndexAccess = ReturnType<typeof getIndexAccess>;

type UseIndexTabInitializationOptions = {
  authLoading: boolean;
  access: IndexAccess;
  hasInitializedTabRef: MutableRefObject<boolean>;
  savedViewState: IndexViewState;
  searchParams: URLSearchParams;
  setSearchParams: SetSearchParams;
  setActiveTab: Dispatch<SetStateAction<MainTab>>;
};

export const useIndexTabInitialization = ({
  authLoading,
  access,
  hasInitializedTabRef,
  savedViewState,
  searchParams,
  setSearchParams,
  setActiveTab,
}: UseIndexTabInitializationOptions) => {
  const {
    isAdmin,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    isAdminRencanaKerja,
    isAdminWilayah,
    isCombinedWorkspace,
    isOvertimeOnly,
  } = access;

  useEffect(() => {
    // Tunggu sampai auth selesai load agar role-based tab initialization
    // hanya berjalan sekali dengan data yang sudah benar.
    if (authLoading) return;

    // Jangan override tab aktif kecuali URL secara eksplisit meminta tab.
    const requestedTab = searchParams.get("tab");
    if (hasInitializedTabRef.current && !requestedTab) return;
    hasInitializedTabRef.current = true;

    const savedTab = savedViewState.activeTab;
    const canViewLaporanBbm = isAdmin || isAdminLaporanBbm;

    if (isNotaDinasOnly) {
      setActiveTab("nota_dinas");
    } else if (isOvertimeOnly) {
      setActiveTab("overtime");
    } else if (isMainTab(requestedTab)
      && (requestedTab !== "nota_dinas" || isAdmin || isNotaDinasOnly)
      && (requestedTab !== "laporan_bbm" || canViewLaporanBbm)
      && (requestedTab !== "fuel_reports_pusat" || isAdmin || isAdminBbmPusat)) {
      setActiveTab(requestedTab);
      // Hapus ?tab= dari URL setelah diproses agar refresh tidak memaksa tab yang sama.
      setSearchParams(prev => { prev.delete("tab"); return prev; }, { replace: true });
    } else if (isAdminBbmPusat) {
      setActiveTab("fuel_reports_pusat");
    } else if (isAdminLaporanBbm) {
      setActiveTab("laporan_bbm");
    } else if (isAdminBbm && !isCombinedWorkspace) {
      setActiveTab("fuel_reports");
    } else if (isAdminSpj || isAdminSpjOli) {
      setActiveTab("spj_oli");
    } else if (savedTab) {
      const safeSavedTab = (savedTab === "nota_dinas" && !isAdmin && !isNotaDinasOnly)
        || (savedTab === "laporan_bbm" && !canViewLaporanBbm)
        || (savedTab === "fuel_reports_pusat" && !isAdmin && !isAdminBbmPusat)
        ? isAdminBbm ? "fuel_reports" : "reports"
        : savedTab;

      // Untuk role yang tidak memiliki tab reports, gunakan workplans sebagai tab utama.
      const correctedTab = (safeSavedTab === "reports" && isCombinedWorkspace && !isAdminWilayah)
        ? "workplans"
        : (isAdminRencanaKerja && !isCombinedWorkspace && safeSavedTab === "reports")
          ? "workplans"
          : safeSavedTab;

      setActiveTab(correctedTab);
    } else {
      setActiveTab(isCombinedWorkspace ? (isAdminWilayah ? "reports" : "workplans") : isAdminRencanaKerja ? "workplans" : "reports");
    }
  }, [
    authLoading,
    isAdmin,
    isAdminBbm,
    isAdminBbmPusat,
    isAdminLaporanBbm,
    isAdminSpj,
    isAdminSpjOli,
    isNotaDinasOnly,
    isAdminRencanaKerja,
    isAdminWilayah,
    isCombinedWorkspace,
    isOvertimeOnly,
    searchParams,
  ]);
};
