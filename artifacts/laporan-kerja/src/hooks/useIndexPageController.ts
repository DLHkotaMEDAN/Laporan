import { useMemo, useRef, useState, type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { IndexConfirmDialogState } from "@/components/index/IndexDialogs";
import { getIndexAccess } from "@/components/index/indexAccess";
import { IndexWorkspaceTabs } from "@/components/index/IndexWorkspaceTabs";
import { defaultCategories, formatLocation, readIndexViewState, type IndexViewState, type MainTab } from "@/components/index/indexConfig";
import { useAuth } from "@/context/AuthContext";
import { useIndexActions } from "@/hooks/useIndexActions";
import { useIndexDataEffects } from "@/hooks/useIndexDataEffects";
import { useIndexDataLoader } from "@/hooks/useIndexDataLoader";
import { useIndexPageControls } from "@/hooks/useIndexPageControls";
import { useIndexRecordCounts } from "@/hooks/useIndexRecordCounts";
import { useIndexRecordLists } from "@/hooks/useIndexRecordLists";
import { useIndexScrollPersistence } from "@/hooks/useIndexScrollPersistence";
import { useIndexStats } from "@/hooks/useIndexStats";
import { useIndexTabInitialization } from "@/hooks/useIndexTabInitialization";
import { useIndexViewStatePersistence } from "@/hooks/useIndexViewStatePersistence";
import { useRegionFilterOptions } from "@/hooks/useRegionFilterOptions";
import type { ReportSortKey, SortDirection, WorkPlanSortKey } from "@/components/index/IndexDataTables";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";

type WorkspaceProps = ComponentProps<typeof IndexWorkspaceTabs>;

type UseIndexPageControllerOptions = {
  setConfirmDialog: Dispatch<SetStateAction<IndexConfirmDialogState>>;
  onOpenDailyReportRecap: () => void;
};

export const useIndexPageController = ({ setConfirmDialog, onOpenDailyReportRecap }: UseIndexPageControllerOptions) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile, signOut, loading: authLoading } = useAuth();
  const isLoggedIn = !!session;
  const savedViewStateRef = useRef<IndexViewState>(readIndexViewState());
  const hasInitializedTabRef = useRef(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(savedViewStateRef.current.searchQuery || "");
  const [activeTab, setActiveTab] = useState<MainTab>(savedViewStateRef.current.activeTab || "reports");
  const [selectedRegion, setSelectedRegion] = useState(savedViewStateRef.current.selectedRegion || "semua");
  const [selectedDate, setSelectedDate] = useState(savedViewStateRef.current.selectedDate || "");
  const [selectedMonth, setSelectedMonth] = useState(savedViewStateRef.current.selectedMonth || "semua");
  const [selectedYear, setSelectedYear] = useState(savedViewStateRef.current.selectedYear || "semua");
  const [selectedCategory, setSelectedCategory] = useState(savedViewStateRef.current.selectedCategory || "semua");
  const [reportSortKey, setReportSortKey] = useState<ReportSortKey>("date");
  const [reportSortDirection, setReportSortDirection] = useState<SortDirection>("desc");
  const [workPlanSortKey, setWorkPlanSortKey] = useState<WorkPlanSortKey>("date");
  const [workPlanSortDirection, setWorkPlanSortDirection] = useState<SortDirection>("desc");

  const access = getIndexAccess(profile, session?.user?.email, isLoggedIn);
  const { recordCounts, setRecordCounts, loadRecordCounts } = useIndexRecordCounts({
    reports,
    workPlans,
    hasProfile: Boolean(profile),
    isLoggedIn,
    canViewReportsTab: access.canViewReportsTab,
    isOvertimeOnly: access.isOvertimeOnly,
    isNotaDinasOnly: access.isNotaDinasOnly,
    isLaporanOnly: access.isLaporanOnly,
    isFuelSpecialist: access.isFuelSpecialist,
    canViewOvertime: access.canViewOvertime,
    isAdmin: access.isAdmin,
    isAdminBbm: access.isAdminBbm,
    isAdminBbmPusat: access.isAdminBbmPusat,
    isAdminLaporanBbm: access.isAdminLaporanBbm,
    isPimpinan: access.isPimpinan,
    isAdminSpj: access.isAdminSpj,
    isAdminSpjOli: access.isAdminSpjOli,
    accountRegionId: access.accountRegionId,
  });
  const actions = useIndexActions({
    canManageReports: access.canManageReports,
    canManageWorkPlans: access.canManageWorkPlans,
    reports,
    workPlans,
    setReports,
    setWorkPlans,
    setConfirmDialog,
    signOut,
  });
  const loadData = useIndexDataLoader({
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedCategory,
    selectedRegion,
    profileCategory: profile?.category,
    isUserRestricted: access.isUserRestricted,
    isAdmin: access.isAdmin,
    accountRegionId: access.accountRegionId,
    setLoading,
    setReports,
    setWorkPlans,
    setSelectedRegion,
    setRecordCounts,
  });

  useIndexTabInitialization({
    authLoading,
    access,
    hasInitializedTabRef,
    savedViewState: savedViewStateRef.current,
    searchParams,
    setSearchParams,
    setActiveTab,
  });
  useIndexViewStatePersistence({ activeTab, searchQuery, selectedRegion, selectedDate, selectedMonth, selectedYear, selectedCategory });
  useIndexScrollPersistence(loading, savedViewStateRef.current.scrollY);

  const { regions, teams: regionTeams } = useRegionFilterOptions(access.canFilterWorkPlanRegions, selectedRegion);
  const categories = useMemo(
    () => access.canFilterWorkPlanRegions ? ["semua", ...Array.from(new Set(regionTeams.map((team) => team.name)))] : defaultCategories,
    [access.canFilterWorkPlanRegions, regionTeams],
  );
  const lists = useIndexRecordLists({
    reports,
    workPlans,
    searchQuery,
    isAdmin: access.isAdmin,
    canFilterWorkPlanRegions: access.canFilterWorkPlanRegions,
    selectedRegion,
    reportSortKey,
    reportSortDirection,
    setReportSortKey,
    setReportSortDirection,
    workPlanSortKey,
    workPlanSortDirection,
    setWorkPlanSortKey,
    setWorkPlanSortDirection,
  });
  useIndexDataEffects({
    authLoading,
    isLoggedIn,
    profile,
    access,
    loadRecordCounts,
    loadData,
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedCategory,
    selectedRegion,
    categories,
    setLoading,
    setSelectedRegion,
    setSelectedCategory,
  });
  const controls = useIndexPageControls({
    isUserRestricted: access.isUserRestricted,
    profileCategory: profile?.category,
    setSelectedDate,
    setSelectedMonth,
    setSelectedYear,
    setSelectedCategory,
    setSelectedRegion,
    setSearchQuery,
    setActiveTab,
  });
  const stats = useIndexStats(lists.filteredReports, lists.filteredWorkPlans);

  const workspaceProps: WorkspaceProps = {
    access,
    activeTab,
    recordCounts,
    loading,
    isLoggedIn,
    sortedReports: lists.sortedReports,
    sortedWorkPlans: lists.sortedWorkPlans,
    reportSortKey,
    reportSortDirection,
    workPlanSortKey,
    workPlanSortDirection,
    formatLocation,
    formatReportLocation: lists.formatReportLocation,
    regions,
    categories,
    searchQuery,
    selectedRegion,
    selectedCategory,
    selectedDate,
    selectedMonth,
    onTabChange: controls.handleTabChange,
    onNavigate: navigate,
    onOpenDailyReportRecap,
    onSearchChange: setSearchQuery,
    onRegionChange: controls.handleRegionChange,
    onCategoryChange: setSelectedCategory,
    onDateChange: setSelectedDate,
    onMonthChange: setSelectedMonth,
    onReset: controls.resetFilters,
    onReportSort: lists.toggleReportSort,
    onWorkPlanSort: lists.toggleWorkPlanSort,
    onDeleteReport: actions.handleDeleteReport,
    onToggleWorkPlanVisibility: actions.handleToggleWorkPlanVisibility,
    onDeleteWorkPlan: actions.handleDeleteWorkPlan,
  };

  return {
    authLoading,
    isLoggedIn,
    profile,
    session,
    navigate,
    access,
    activeTab,
    recordCounts,
    loading,
    stats,
    workspaceProps,
    loadData,
    ...actions,
  };
};
