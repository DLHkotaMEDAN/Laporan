import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AuthorizeRoute } from "@/components/AuthorizeRoute";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import RouteScrollReset from "@/components/RouteScrollReset";
import ActivityTracker from "@/components/ActivityTracker";
import {
  ProtectedRoute,
  WorkPlanWriteRoute,
  AdminRoute,
  FuelReportRoute,
  LaporanBbmRoute,
  SpjOliRoute,
  NotaDinasRoute,
  NonFuelSpecialistRoute,
  WorkPlanAccessRoute,
  OvertimeAccessRoute,
  PrintRekapAdminRoute,
} from "@/components/RouteGuards";
import { Loader2 } from "lucide-react";

// Lazy load all page components for better performance
const Index = lazy(() => import("./pages/Index"));
const CreateReport = lazy(() => import("./pages/CreateReport"));
const EditReport = lazy(() => import("./pages/EditReport"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const PrintRekap = lazy(() => import("./pages/PrintRekap"));
const MonthlyRecap = lazy(() => import("./pages/MonthlyRecap"));
const DailyRecap = lazy(() => import("./pages/DailyRecap"));
const WeeklyRecap = lazy(() => import("./pages/WeeklyRecap"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PdfPreview = lazy(() => import("./pages/PdfPreview"));

const CreateWorkPlan = lazy(() => import("./pages/CreateWorkPlan"));
const EditWorkPlan = lazy(() => import("./pages/EditWorkPlan"));
const PrintWorkPlan = lazy(() => import("./pages/PrintWorkPlan"));
const WorkPlanDailyRecap = lazy(() => import("./pages/WorkPlanDailyRecap"));
const WorkPlanWeeklyRecap = lazy(() => import("./pages/WorkPlanWeeklyRecap"));
const WorkPlanMonthlyRecap = lazy(() => import("./pages/WorkPlanMonthlyRecap"));

const FuelReportList = lazy(() => import("./pages/FuelReportList"));
const CreateFuelReport = lazy(() => import("./pages/CreateFuelReport"));
const EditFuelReport = lazy(() => import("./pages/EditFuelReport"));
const FuelReportDetail = lazy(() => import("./pages/FuelReportDetail"));
const LaporanBbmList = lazy(() => import("./pages/LaporanBbmList"));
const CreateLaporanBbm = lazy(() => import("./pages/CreateLaporanBbm"));
const EditLaporanBbm = lazy(() => import("./pages/EditLaporanBbm"));
const LaporanBbmDetail = lazy(() => import("./pages/LaporanBbmDetail"));
const FuelDailyRecap = lazy(() => import("./pages/FuelDailyRecap"));
const FuelWeeklyRecap = lazy(() => import("./pages/FuelWeeklyRecap"));
const FuelMonthlyRecap = lazy(() => import("./pages/FuelMonthlyRecap"));
const FuelYearlyRecap = lazy(() => import("./pages/FuelYearlyRecap"));
const OvertimeRecap = lazy(() => import("./pages/OvertimeRecap"));
const OvertimePrint = lazy(() => import("./pages/OvertimePrint"));
const CreateOvertime = lazy(() => import("./pages/CreateOvertime"));
const EditOvertime = lazy(() => import("./pages/EditOvertime"));

const SpjOli = lazy(() => import("./pages/SpjOli"));
const SpjOliRecap = lazy(() => import("./pages/SpjOliRecap"));
const NotaDinasRecap = lazy(() => import("./pages/NotaDinasRecap"));
const NotaDinasTemplate = lazy(() => import("./pages/NotaDinasTemplate"));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <p className="text-slate-600 font-medium">Memuat halaman...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteScrollReset />
            <ActivityTracker />
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Index />} />
                  <Route path="/pdf-preview" element={<PdfPreview />} />
                  <Route path="/report/:id" element={<NonFuelSpecialistRoute><ReportDetail /></NonFuelSpecialistRoute>} />
                  <Route path="/monthly-rekap" element={<NonFuelSpecialistRoute><MonthlyRecap /></NonFuelSpecialistRoute>} />
                  <Route path="/daily-rekap" element={<NonFuelSpecialistRoute><DailyRecap /></NonFuelSpecialistRoute>} />
                  <Route path="/weekly-rekap" element={<NonFuelSpecialistRoute><WeeklyRecap /></NonFuelSpecialistRoute>} />

                  <Route path="/work-plans" element={<Navigate to="/work-plans/daily-rekap" replace />} />
                  <Route path="/work-plans/print/:id" element={<WorkPlanAccessRoute><PrintWorkPlan /></WorkPlanAccessRoute>} />
                  <Route path="/work-plans/daily-rekap" element={<WorkPlanAccessRoute><WorkPlanDailyRecap /></WorkPlanAccessRoute>} />
                  <Route path="/work-plans/weekly-rekap" element={<WorkPlanAccessRoute><WorkPlanWeeklyRecap /></WorkPlanAccessRoute>} />
                  <Route path="/work-plans/monthly-rekap" element={<WorkPlanAccessRoute><WorkPlanMonthlyRecap /></WorkPlanAccessRoute>} />
                  <Route path="/overtime" element={<OvertimeAccessRoute><OvertimeRecap /></OvertimeAccessRoute>} />
                  <Route path="/overtime/print" element={<OvertimeAccessRoute><OvertimePrint /></OvertimeAccessRoute>} />
                  <Route path="/overtime/daily-rekap" element={<OvertimeAccessRoute><OvertimePrint period="daily" /></OvertimeAccessRoute>} />
                  <Route path="/overtime/weekly-rekap" element={<OvertimeAccessRoute><OvertimePrint period="weekly" /></OvertimeAccessRoute>} />
                  <Route path="/overtime/monthly-rekap" element={<OvertimeAccessRoute><OvertimePrint period="monthly" /></OvertimeAccessRoute>} />
                  <Route path="/overtime/create" element={<OvertimeAccessRoute><CreateOvertime /></OvertimeAccessRoute>} />
                  <Route path="/overtime/edit/:id" element={<OvertimeAccessRoute><EditOvertime /></OvertimeAccessRoute>} />
                  <Route path="/work-plans/create" element={<WorkPlanAccessRoute><AuthorizeRoute resource="work_plans" action="create"><CreateWorkPlan /></AuthorizeRoute></WorkPlanAccessRoute>} />
                  <Route path="/work-plans/edit/:id" element={<WorkPlanAccessRoute><AuthorizeRoute resource="work_plans" action="update"><EditWorkPlan /></AuthorizeRoute></WorkPlanAccessRoute>} />

                  <Route path="/fuel-reports" element={<FuelReportRoute><FuelReportList /></FuelReportRoute>} />
                  <Route path="/fuel-reports/create" element={<FuelReportRoute><CreateFuelReport /></FuelReportRoute>} />
                  <Route path="/fuel-reports/edit/:id" element={<FuelReportRoute><EditFuelReport /></FuelReportRoute>} />
                  <Route path="/fuel-reports/:id" element={<FuelReportRoute><FuelReportDetail /></FuelReportRoute>} />
                  <Route path="/fuel-reports/daily-rekap" element={<FuelReportRoute><FuelDailyRecap /></FuelReportRoute>} />
                  <Route path="/fuel-reports/weekly-rekap" element={<FuelReportRoute><FuelWeeklyRecap /></FuelReportRoute>} />
                  <Route path="/fuel-reports/monthly-rekap" element={<FuelReportRoute><FuelMonthlyRecap /></FuelReportRoute>} />
                  <Route path="/fuel-reports/yearly-rekap" element={<FuelReportRoute><FuelYearlyRecap /></FuelReportRoute>} />
                  <Route path="/fuel-reports-pusat" element={<FuelReportRoute><FuelReportList reportType="admin_bbm_pusat" /></FuelReportRoute>} />
                  <Route path="/fuel-reports-pusat/create" element={<FuelReportRoute><CreateFuelReport reportType="admin_bbm_pusat" /></FuelReportRoute>} />
                  <Route path="/fuel-reports-pusat/edit/:id" element={<FuelReportRoute><EditFuelReport reportType="admin_bbm_pusat" /></FuelReportRoute>} />
                  <Route path="/fuel-reports-pusat/:id" element={<FuelReportRoute><FuelReportDetail reportType="admin_bbm_pusat" /></FuelReportRoute>} />
                  <Route path="/laporan-bbm" element={<LaporanBbmRoute><LaporanBbmList /></LaporanBbmRoute>} />
                  <Route path="/laporan-bbm/create" element={<LaporanBbmRoute><CreateLaporanBbm /></LaporanBbmRoute>} />
                  <Route path="/laporan-bbm/edit/:id" element={<LaporanBbmRoute><EditLaporanBbm /></LaporanBbmRoute>} />
                  <Route path="/laporan-bbm/:id" element={<LaporanBbmRoute><LaporanBbmDetail /></LaporanBbmRoute>} />

                  <Route path="/spj-oli" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
                  <Route path="/spj-oli/create" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
                  <Route path="/spj-oli/edit/:id" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
                  <Route path="/spj-oli/daily-rekap" element={<SpjOliRoute><SpjOliRecap period="daily" /></SpjOliRoute>} />
                  <Route path="/spj-oli/weekly-rekap" element={<SpjOliRoute><SpjOliRecap period="weekly" /></SpjOliRoute>} />
                  <Route path="/spj-oli/monthly-rekap" element={<SpjOliRoute><SpjOliRecap period="monthly" /></SpjOliRoute>} />
                  <Route path="/nota-dinas/daily-rekap" element={<NotaDinasRoute><NotaDinasRecap period="daily" /></NotaDinasRoute>} />
                  <Route path="/nota-dinas/weekly-rekap" element={<NotaDinasRoute><NotaDinasRecap period="weekly" /></NotaDinasRoute>} />
                  <Route path="/nota-dinas/monthly-rekap" element={<NotaDinasRoute><NotaDinasRecap period="monthly" /></NotaDinasRoute>} />
                  <Route path="/nota-dinas/template" element={<NotaDinasRoute><NotaDinasTemplate /></NotaDinasRoute>} />

                  <Route path="/create" element={<ProtectedRoute><CreateReport /></ProtectedRoute>} />
                  <Route path="/edit/:id" element={<ProtectedRoute><EditReport /></ProtectedRoute>} />
                  <Route path="/print-rekap" element={<PrintRekapAdminRoute><PrintRekap /></PrintRekapAdminRoute>} />
                  <Route path="/maintenance" element={<AdminRoute><Maintenance /></AdminRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
