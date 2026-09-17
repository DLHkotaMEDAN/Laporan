import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import FuelDailyRecap from "./pages/FuelDailyRecap";
import FuelWeeklyRecap from "./pages/FuelWeeklyRecap";
import FuelMonthlyRecap from "./pages/FuelMonthlyRecap";
import FuelYearlyRecap from "./pages/FuelYearlyRecap";
import OvertimeRecap from "./pages/OvertimeRecap";
import OvertimePrint from "./pages/OvertimePrint";
import CreateOvertime from "./pages/CreateOvertime";
import EditOvertime from "./pages/EditOvertime";

import FuelSpjReportList from "./pages/FuelSpjReportList";
import CreateFuelSpjReport from "./pages/CreateFuelSpjReport";
import EditFuelSpjReport from "./pages/EditFuelSpjReport";
import FuelSpjReportDetail from "./pages/FuelSpjReportDetail";
import FuelSpjDailyRecap from "./pages/FuelSpjDailyRecap";
import FuelSpjWeeklyRecap from "./pages/FuelSpjWeeklyRecap";
import FuelSpjMonthlyRecap from "./pages/FuelSpjMonthlyRecap";
import FuelSpjYearlyRecap from "./pages/FuelSpjYearlyRecap";
import SpjOli from "./pages/SpjOli";
import SpjOliRecap from "./pages/SpjOliRecap";
import {
  USER_ROLES,
  canAccessFuelArea,
  canPrintAdminRecap,
  getRoleLandingPath,
  isAdminHarianAccess,
  isAdminBbmAccess,
  isAdminRencanaKerjaAccess,
} from "@/constants/access-control";
import { AuthorizeRoute } from "@/components/AuthorizeRoute";
import { auditLogService } from "@/services/auditLogService";

const queryClient = new QueryClient();

/**
 * React Router keeps the current document scroll position during client-side
 * navigation. Reset it when opening another page so a long dashboard or
 * recap cannot make the new recap content appear to be missing.
 */
const RouteScrollReset = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};

const ActivityTracker = () => {
  const location = useLocation();
  const { session, profile } = useAuth();
  const lastPath = useRef<string | null>(null);
  const lastInteraction = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  useEffect(() => {
    if (!session?.user || !profile || location.pathname === '/login') return;
    const path = `${location.pathname}${location.search}`;
    if (lastPath.current === path) return;
    lastPath.current = path;
    void auditLogService.logAction({
      action: 'VIEW',
      entityType: 'PAGE',
      details: {
        path,
        title: document.title || path,
        referrer: document.referrer || null,
      },
      userId: session.user.id,
      username: profile.username || session.user.email,
      userEmail: session.user.email,
      role: profile.role,
    });
  }, [location.pathname, location.search, profile, session]);

  useEffect(() => {
    if (!session?.user || !profile || location.pathname === '/login') return;

    const handleInteraction = (event: MouseEvent) => {
      const rawTarget = event.target as HTMLElement | null;
      const target = rawTarget?.closest<HTMLElement>('button, a, [role="button"], [role="menuitem"]');
      if (!target || target.closest('[data-audit-ignore="true"]')) return;

      const label = (target.innerText || target.getAttribute('aria-label') || target.getAttribute('title') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      if (!label) return;

      const key = `${location.pathname}|${label}`;
      const now = Date.now();
      if (lastInteraction.current.key === key && now - lastInteraction.current.time < 800) return;
      lastInteraction.current = { key, time: now };

      const normalized = label.toLowerCase();
      const action = /cetak|print/.test(normalized)
        ? 'PRINT'
        : /export|excel|pdf|download|unduh/.test(normalized)
          ? 'EXPORT'
          : 'INTERACT';
      void auditLogService.logAction({
        action,
        entityType: 'UI',
        details: {
          path: `${location.pathname}${location.search}`,
          target: label,
          element: target.tagName.toLowerCase(),
          href: target.getAttribute('href'),
        },
        userId: session.user.id,
        username: profile.username || session.user.email,
        userEmail: session.user.email,
        role: profile.role,
      });
    };

    document.addEventListener('click', handleInteraction, true);
    return () => document.removeEventListener('click', handleInteraction, true);
  }, [location.pathname, location.search, profile, session]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  
  if (
    isAdminBbmAccess(profile?.role)
    || profile?.role === USER_ROLES.ADMIN_SPJ_BBM
    || isAdminRencanaKerjaAccess(profile?.role)
  ) {
    return <Navigate to={getRoleLandingPath(profile.role)} />;
  }
  
  return <>{children}</>;
};

const WorkPlanWriteRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;

  if (isAdminHarianAccess(profile?.role, session.user.email)) return <Navigate to="/" replace />;

  if (
    isAdminBbmAccess(profile?.role)
    || profile?.role === USER_ROLES.ADMIN_SPJ_BBM
  ) {
    return <Navigate to={getRoleLandingPath(profile.role)} replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  
  const isAllowed = canAccessFuelArea(profile?.role, session.user.email);
                    
  if (!isAllowed) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const FuelReportRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (!canAccessFuelArea(profile?.role, session.user.email) || profile?.role === USER_ROLES.ADMIN_SPJ_BBM) {
    return <Navigate to={getRoleLandingPath(profile?.role)} replace />;
  }

  return <>{children}</>;
};

const FuelSpjRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (!canAccessFuelArea(profile?.role, session.user.email) || isAdminBbmAccess(profile?.role)) {
    return <Navigate to={getRoleLandingPath(profile?.role)} replace />;
  }

  return <>{children}</>;
};

const SpjOliRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;

  const isAllowed = profile?.role === USER_ROLES.ADMIN
    || profile?.role === USER_ROLES.ADMIN_SPJ_BBM
    || profile?.role === USER_ROLES.ADMIN_SPJ_OLI
    || profile?.role === USER_ROLES.PIMPINAN;
  if (!isAllowed) return <Navigate to={getRoleLandingPath(profile?.role)} replace />;

  return <>{children}</>;
};

const NonFuelSpecialistRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (isAdminBbmAccess(profile?.role) || profile?.role === USER_ROLES.ADMIN_SPJ_BBM || profile?.role === USER_ROLES.ADMIN_SPJ_OLI) {
    return <Navigate to={getRoleLandingPath(profile.role)} replace />;
  }

  return <>{children}</>;
};

const WorkPlanAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role === USER_ROLES.LAPORAN) return <Navigate to="/" replace />;

  if (isAdminRencanaKerjaAccess(profile?.role)) return <>{children}</>;

  return <NonFuelSpecialistRoute>{children}</NonFuelSpecialistRoute>;
};

const OvertimeAccessRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;

  const isAllowed = profile?.role === USER_ROLES.ADMIN
    || profile?.role === USER_ROLES.ADMIN_REKAP_LEMBUR
    || session.user.email === 'admin@gmail.com';
  return isAllowed ? <>{children}</> : <Navigate to="/" replace />;
};

const PrintRekapAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;

  const isAllowed = canPrintAdminRecap(profile?.role, session.user.email);
  if (!isAllowed) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteScrollReset />
          <ActivityTracker />
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

            <Route path="/fuel-reports/spj" element={<FuelSpjRoute><FuelSpjReportList /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/create" element={<FuelSpjRoute><CreateFuelSpjReport /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/edit/:id" element={<FuelSpjRoute><EditFuelSpjReport /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/:id" element={<FuelSpjRoute><FuelSpjReportDetail /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/daily-rekap" element={<FuelSpjRoute><FuelSpjDailyRecap /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/weekly-rekap" element={<FuelSpjRoute><FuelSpjWeeklyRecap /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/monthly-rekap" element={<FuelSpjRoute><FuelSpjMonthlyRecap /></FuelSpjRoute>} />
            <Route path="/fuel-reports/spj/yearly-rekap" element={<FuelSpjRoute><FuelSpjYearlyRecap /></FuelSpjRoute>} />

            <Route path="/spj-oli" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
            <Route path="/spj-oli/create" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
            <Route path="/spj-oli/edit/:id" element={<SpjOliRoute><SpjOli /></SpjOliRoute>} />
            <Route path="/spj-oli/daily-rekap" element={<SpjOliRoute><SpjOliRecap period="daily" /></SpjOliRoute>} />
            <Route path="/spj-oli/weekly-rekap" element={<SpjOliRoute><SpjOliRecap period="weekly" /></SpjOliRoute>} />
            <Route path="/spj-oli/monthly-rekap" element={<SpjOliRoute><SpjOliRecap period="monthly" /></SpjOliRoute>} />
            
            <Route path="/create" element={<ProtectedRoute><CreateReport /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditReport /></ProtectedRoute>} />
            <Route path="/print-rekap" element={<PrintRekapAdminRoute><PrintRekap /></PrintRekapAdminRoute>} />
            <Route path="/maintenance" element={<AdminRoute><Maintenance /></AdminRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
