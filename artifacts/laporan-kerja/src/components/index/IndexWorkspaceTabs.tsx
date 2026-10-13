import { CalendarDays, ClipboardList, FileText, Fuel } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FuelReportTab from "@/components/FuelReportTab";
import NotaDinasTab from "@/components/NotaDinasTab";
import OvertimeRecap from "@/pages/OvertimeRecap";
import { IndexFilters } from "@/components/index/IndexFilters";
import { IndexRecapMenu } from "@/components/index/IndexRecapMenu";
import { IndexReportsTable, IndexWorkPlansTable, getWorkPlanDescriptions, type ReportSortKey, type SortDirection, type WorkPlanSortKey } from "@/components/index/IndexDataTables";
import { IndexSectionHeader } from "@/components/index/IndexSectionHeader";
import { systemTabBaseClass, systemTabToneClass, type MainTab, type RecordCounts } from "@/components/index/indexConfig";
import type { getIndexAccess } from "@/components/index/indexAccess";
import type { RegionOption } from "@/hooks/useRegionFilterOptions";
import type { Report } from "@/types/report";
import type { WorkPlan } from "@/types/workPlan";
import { cn } from "@/lib/utils";

type IndexAccess = ReturnType<typeof getIndexAccess>;

type Props = {
  access: IndexAccess;
  activeTab: MainTab;
  recordCounts: RecordCounts;
  loading: boolean;
  isLoggedIn: boolean;
  sortedReports: Report[];
  sortedWorkPlans: WorkPlan[];
  reportSortKey: ReportSortKey;
  reportSortDirection: SortDirection;
  workPlanSortKey: WorkPlanSortKey;
  workPlanSortDirection: SortDirection;
  formatLocation: (location: Report["location"] | undefined) => string;
  formatReportLocation: (report: Report) => string;
  regions: RegionOption[];
  categories: string[];
  searchQuery: string;
  selectedRegion: string;
  selectedCategory: string;
  selectedDate: string;
  selectedMonth: string;
  onTabChange: (tab: string) => void;
  onNavigate: (path: string) => void;
  onOpenDailyReportRecap: () => void;
  onSearchChange: (value: string) => void;
  onRegionChange: (regionId: string) => void;
  onCategoryChange: (category: string) => void;
  onDateChange: (date: string) => void;
  onMonthChange: (month: string) => void;
  onReset: () => void;
  onReportSort: (key: ReportSortKey) => void;
  onWorkPlanSort: (key: WorkPlanSortKey) => void;
  onDeleteReport: (event: React.MouseEvent, report: Report) => void;
  onToggleWorkPlanVisibility: (event: React.MouseEvent, plan: WorkPlan) => void | Promise<void>;
  onDeleteWorkPlan: (event: React.MouseEvent, plan: WorkPlan) => void;
};

export function IndexWorkspaceTabs({
  access,
  activeTab,
  recordCounts,
  loading,
  isLoggedIn,
  sortedReports,
  sortedWorkPlans,
  reportSortKey,
  reportSortDirection,
  workPlanSortKey,
  workPlanSortDirection,
  formatLocation,
  formatReportLocation,
  regions,
  categories,
  searchQuery,
  selectedRegion,
  selectedCategory,
  selectedDate,
  selectedMonth,
  onTabChange,
  onNavigate,
  onOpenDailyReportRecap,
  onSearchChange,
  onRegionChange,
  onCategoryChange,
  onDateChange,
  onMonthChange,
  onReset,
  onReportSort,
  onWorkPlanSort,
  onDeleteReport,
  onToggleWorkPlanVisibility,
  onDeleteWorkPlan,
}: Props) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className={cn("w-full space-y-6", activeTab === "nota_dinas" && "nota-dinas-tabs")}>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm ring-1 ring-slate-100/80 print:hidden xl:flex-row xl:items-center xl:justify-between">
        <TabsList className="grid h-auto w-full min-w-0 grid-cols-2 gap-2 overflow-visible bg-transparent p-0 text-slate-600 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-start xl:flex-1">
          {access.canViewReportsTab && !access.isOvertimeOnly && <TabsTrigger value="reports" className={cn(systemTabBaseClass, systemTabToneClass.reports)}><FileText size={16} /> Laporan Kerja</TabsTrigger>}
          {!access.isNotaDinasOnly && !access.isLaporanOnly && !access.isFuelSpecialist && !access.isOvertimeOnly && <TabsTrigger value="workplans" className={cn(systemTabBaseClass, systemTabToneClass.workplans)}><ClipboardList size={16} /> Rencana Kerja</TabsTrigger>}
          {access.canViewOvertime && <TabsTrigger value="overtime" className={cn(systemTabBaseClass, systemTabToneClass.overtime)}><FileText size={16} /> Rekap Lembur</TabsTrigger>}
          {(access.isAdmin || access.isPimpinan || access.isAdminBbm || access.isAdminBbmPusat || access.isAdminLaporanBbm || access.isAdminSpj || access.isAdminSpjOli || access.isNotaDinasOnly) && <>
            {(access.isAdmin || access.isAdminBbm) && <TabsTrigger value="fuel_reports" className={cn(systemTabBaseClass, systemTabToneClass.fuel_reports)}><Fuel size={16} /> Admin BBM</TabsTrigger>}
            {(access.isAdmin || access.isAdminBbmPusat) && <TabsTrigger value="fuel_reports_pusat" className={cn(systemTabBaseClass, systemTabToneClass.fuel_reports_pusat)}><Fuel size={16} /> Admin BBM Pusat</TabsTrigger>}
            {(access.isAdmin || access.isAdminLaporanBbm) && <TabsTrigger value="laporan_bbm" className={cn(systemTabBaseClass, systemTabToneClass.laporan_bbm)}><FileText size={16} /> Laporan BBM</TabsTrigger>}
            {(access.isAdmin || access.isPimpinan || access.isAdminSpj || access.isAdminSpjOli) && <TabsTrigger value="spj_oli" className={cn(systemTabBaseClass, systemTabToneClass.spj_oli)}><Fuel size={16} /> SPJ Oli</TabsTrigger>}
            {(access.isAdmin || access.isNotaDinasOnly) && <TabsTrigger value="nota_dinas" className={cn(systemTabBaseClass, systemTabToneClass.nota_dinas)}><FileText size={16} /> Nota Dinas</TabsTrigger>}
          </>}
        </TabsList>
        <IndexRecapMenu
          activeTab={activeTab}
          canPrintAnyReportRecap={access.canPrintAnyReportRecap}
          canPrintDailyRecap={access.canPrintDailyRecap}
          canPrintWeeklyRecap={access.canPrintWeeklyRecap}
          canPrintMonthlyRecap={access.canPrintMonthlyRecap}
          canFilterWorkPlanRegions={access.canFilterWorkPlanRegions}
          isAdmin={access.isAdmin}
          selectedRegion={selectedRegion}
          onNavigate={onNavigate}
          onOpenDailyReportRecap={onOpenDailyReportRecap}
        />
      </div>

      <IndexSectionHeader activeTab={activeTab} canManageReports={access.canManageReports} canManageWorkPlans={access.canManageWorkPlans} onNavigate={onNavigate} />
      <IndexFilters
        visible={(activeTab === "reports" || activeTab === "workplans") && !access.isOvertimeOnly}
        searchQuery={searchQuery}
        selectedRegion={selectedRegion}
        selectedCategory={selectedCategory}
        selectedDate={selectedDate}
        selectedMonth={selectedMonth}
        categories={categories}
        regions={regions}
        canFilterWorkPlanRegions={access.canFilterWorkPlanRegions}
        isUserRestricted={access.isUserRestricted}
        onSearchChange={onSearchChange}
        onRegionChange={onRegionChange}
        onCategoryChange={onCategoryChange}
        onDateChange={onDateChange}
        onMonthChange={onMonthChange}
        onReset={onReset}
      />

      {access.canViewOvertime && <TabsContent value="overtime" className="mt-0"><OvertimeRecap recordCount={recordCounts.overtime} /></TabsContent>}
      {access.canViewReportsTab && !access.isOvertimeOnly && <TabsContent value="reports" className="mt-0">
        <IndexReportsTable
          records={sortedReports}
          loading={loading}
          recordCount={recordCounts.reports}
          isLoggedIn={isLoggedIn}
          canManageReports={access.canManageReports}
          sortKey={reportSortKey}
          sortDirection={reportSortDirection}
          formatLocation={formatLocation}
          formatReportLocation={formatReportLocation}
          onSort={onReportSort}
          onNavigate={onNavigate}
          onDelete={onDeleteReport}
          onReset={onReset}
        />
      </TabsContent>}

      {!access.isNotaDinasOnly && !access.isLaporanOnly && !access.isFuelSpecialist && !access.isOvertimeOnly && <TabsContent value="workplans" className="mt-0">
        <IndexWorkPlansTable
          records={sortedWorkPlans}
          loading={loading}
          recordCount={recordCounts.workplans}
          canManageWorkPlans={access.canManageWorkPlans}
          isPimpinan={access.isPimpinan}
          sortKey={workPlanSortKey}
          sortDirection={workPlanSortDirection}
          onSort={onWorkPlanSort}
          onNavigate={onNavigate}
          onToggleVisibility={onToggleWorkPlanVisibility}
          onDelete={onDeleteWorkPlan}
          onReset={onReset}
          getDescriptions={getWorkPlanDescriptions}
          formatLocation={formatLocation}
        />
      </TabsContent>}

      {(access.isAdmin || access.isPimpinan || access.isAdminBbm || access.isAdminBbmPusat || access.isAdminLaporanBbm || access.isAdminSpj || access.isAdminSpjOli) && <>
        {(access.isAdmin || access.isAdminBbm) && <TabsContent value="fuel_reports" className="mt-0"><FuelReportTab regionId={access.accountRegionId} recordCount={recordCounts.fuel_reports} /></TabsContent>}
        {(access.isAdmin || access.isAdminBbmPusat) && <TabsContent value="fuel_reports_pusat" className="mt-0"><FuelReportTab regionId={access.accountRegionId} reportType="admin_bbm_pusat" recordCount={recordCounts.fuel_reports_pusat} /></TabsContent>}
        {(access.isAdmin || access.isAdminLaporanBbm) && <TabsContent value="laporan_bbm" className="mt-0"><FuelReportTab regionId={access.accountRegionId} reportType="laporan_bbm" recordCount={recordCounts.laporan_bbm} /></TabsContent>}
      </>}
      {(access.isAdmin || access.isNotaDinasOnly) && <TabsContent value="nota_dinas" className="mt-0"><NotaDinasTab isActive={activeTab === "nota_dinas"} recordCount={recordCounts.nota_dinas} /></TabsContent>}
    </Tabs>
  );
}
