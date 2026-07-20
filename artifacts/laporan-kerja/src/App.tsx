import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

import WorkPlanList from "./pages/WorkPlanList";
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

import FuelSpjReportList from "./pages/FuelSpjReportList";
import CreateFuelSpjReport from "./pages/CreateFuelSpjReport";
import EditFuelSpjReport from "./pages/EditFuelSpjReport";
import FuelSpjReportDetail from "./pages/FuelSpjReportDetail";
import FuelSpjDailyRecap from "./pages/FuelSpjDailyRecap";
import FuelSpjWeeklyRecap from "./pages/FuelSpjWeeklyRecap";
import FuelSpjMonthlyRecap from "./pages/FuelSpjMonthlyRecap";
import FuelSpjYearlyRecap from "./pages/FuelSpjYearlyRecap";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  
  if (profile?.role === 'admin_bbm') return <Navigate to="/fuel-reports" />;
  if (profile?.role === 'admin_spj_bbm') return <Navigate to="/fuel-reports/spj" />;
  
  return <>{children}</>;
};

const WorkPlanWriteRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;

  const isAdminHarian = profile?.role === 'admin_harian' || session.user.email === 'sakinah@gmail.com' || session.user.email === 'admin.laporan@gmail.com';
  if (isAdminHarian) return <Navigate to="/" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat...</div>;
  if (!session) return <Navigate to="/login" />;
  
  const isAllowed = profile?.role === 'admin' || 
                    profile?.role === 'admin_bbm' || 
                    profile?.role === 'admin_spj_bbm' || 
                    profile?.role === 'pimpinan' || 
                    session?.user?.email === 'admin@gmail.com' ||
                    session?.user?.email === 'pimpinan@gmail.com';
                    
  if (!isAllowed) return <Navigate to="/" />;
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/monthly-rekap" element={<MonthlyRecap />} />
            <Route path="/daily-rekap" element={<DailyRecap />} />
            <Route path="/weekly-rekap" element={<WeeklyRecap />} />
            
            <Route path="/work-plans" element={<WorkPlanList />} />
            <Route path="/work-plans/print/:id" element={<PrintWorkPlan />} />
            <Route path="/work-plans/daily-rekap" element={<WorkPlanDailyRecap />} />
            <Route path="/work-plans/weekly-rekap" element={<WorkPlanWeeklyRecap />} />
            <Route path="/work-plans/monthly-rekap" element={<WorkPlanMonthlyRecap />} />
            <Route path="/work-plans/create" element={<WorkPlanWriteRoute><CreateWorkPlan /></WorkPlanWriteRoute>} />
            <Route path="/work-plans/edit/:id" element={<WorkPlanWriteRoute><EditWorkPlan /></WorkPlanWriteRoute>} />
            
            <Route path="/fuel-reports" element={<AdminRoute><FuelReportList /></AdminRoute>} />
            <Route path="/fuel-reports/create" element={<AdminRoute><CreateFuelReport /></AdminRoute>} />
            <Route path="/fuel-reports/edit/:id" element={<AdminRoute><EditFuelReport /></AdminRoute>} />
            <Route path="/fuel-reports/:id" element={<AdminRoute><FuelReportDetail /></AdminRoute>} />
            <Route path="/fuel-reports/daily-rekap" element={<AdminRoute><FuelDailyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/weekly-rekap" element={<AdminRoute><FuelWeeklyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/monthly-rekap" element={<AdminRoute><FuelMonthlyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/yearly-rekap" element={<AdminRoute><FuelYearlyRecap /></AdminRoute>} />

            <Route path="/fuel-reports/spj" element={<AdminRoute><FuelSpjReportList /></AdminRoute>} />
            <Route path="/fuel-reports/spj/create" element={<AdminRoute><CreateFuelSpjReport /></AdminRoute>} />
            <Route path="/fuel-reports/spj/edit/:id" element={<AdminRoute><EditFuelSpjReport /></AdminRoute>} />
            <Route path="/fuel-reports/spj/:id" element={<AdminRoute><FuelSpjReportDetail /></AdminRoute>} />
            <Route path="/fuel-reports/spj/daily-rekap" element={<AdminRoute><FuelSpjDailyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/spj/weekly-rekap" element={<AdminRoute><FuelSpjWeeklyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/spj/monthly-rekap" element={<AdminRoute><FuelSpjMonthlyRecap /></AdminRoute>} />
            <Route path="/fuel-reports/spj/yearly-rekap" element={<AdminRoute><FuelSpjYearlyRecap /></AdminRoute>} />
            
            <Route path="/create" element={<ProtectedRoute><CreateReport /></ProtectedRoute>} />
            <Route path="/edit/:id" element={<ProtectedRoute><EditReport /></ProtectedRoute>} />
            <Route path="/print-rekap" element={<ProtectedRoute><PrintRekap /></ProtectedRoute>} />
            <Route path="/maintenance" element={<AdminRoute><Maintenance /></AdminRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
