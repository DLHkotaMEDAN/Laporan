import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Index from "./pages/Index";
import CreateReport from "./pages/CreateReport";
import EditReport from "./pages/EditReport";
import ReportDetail from "./pages/ReportDetail";
import PrintRekap from "./pages/PrintRekap";
import MonthlyRecap from "./pages/MonthlyRecap";
import DailyRecap from "./pages/DailyRecap";
import WeeklyRecap from "./pages/WeeklyRecap";
import Maintenance from "./pages/Maintenance";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PdfPreview from "./pages/PdfPreview";

import CreateWorkPlan from "./pages/CreateWorkPlan";
import EditWorkPlan from "./pages/EditWorkPlan";
import PrintWorkPlan from "./pages/PrintWorkPlan";
import WorkPlanDailyRecap from "./pages/WorkPlanDailyRecap";
import WorkPlanWeeklyRecap from "./pages/WorkPlanWeeklyRecap";
import WorkPlanMonthlyRecap from "./pages/WorkPlanMonthlyRecap";

import FuelReportList from "./pages/FuelReportList";
import CreateFuelReport from "./pages/CreateFuelReport";
import EditFuelReport from "./pages/EditFuelReport";
import FuelReportDetail from "./pages/FuelReportDetail";
import LaporanBbmList from "./pages/LaporanBbmList";
import CreateLaporanBbm from "./pages/CreateLaporanBbm";
import EditLaporanBbm from "./pages/EditLaporanBbm";
import LaporanBbmDetail from "./pages/LaporanBbmDetail";
import FuelDailyRecap from "./pages/FuelDailyRecap";
import FuelWeeklyRecap from "./pages/FuelWeeklyRecap";
import FuelMonthlyRecap from "./pages/FuelMonthlyRecap";
import FuelYearlyRecap from "./pages/FuelYearlyRecap";
import OvertimeRecap from "./pages/OvertimeRecap";
import OvertimePrint from "./pages/OvertimePrint";
import CreateOvertime from "./pages/CreateOvertime";
import EditOvertime from "./pages/EditOvertime";

import SpjOli from "./pages/SpjOli";
import SpjOliRecap from "./pages/SpjOliRecap";
import NotaDinasRecap from "./pages/NotaDinasRecap";
import NotaDinasTemplate from "./pages/NotaDinasTemplate";
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
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
