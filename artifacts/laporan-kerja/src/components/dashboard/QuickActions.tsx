import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, ArrowRight, Fuel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  isPimpinan: boolean;
  isLoggedIn: boolean;
  canManageReports?: boolean;
  canManageWorkPlans?: boolean;
  canManageFuel?: boolean;
}

const QuickActions = ({ isPimpinan, isLoggedIn, canManageReports = true, canManageWorkPlans = true, canManageFuel = false }: QuickActionsProps) => {
  const navigate = useNavigate();

  if (!isLoggedIn || isPimpinan || (!canManageReports && !canManageWorkPlans && !canManageFuel)) return null;

  return (
    <div className={cn("mb-8 grid min-w-0 gap-3 sm:gap-4", canManageReports && canManageWorkPlans ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
      {canManageReports && <Button 
        onClick={() => navigate('/create')}
        className={cn(
          "group h-auto w-full min-w-0 justify-between rounded-2xl p-4 text-left shadow-lg shadow-sky-900/10 transition-all hover:-translate-y-1 active:scale-[0.99] sm:p-5",
          "bg-gradient-to-br from-sky-700 to-cyan-700 hover:from-sky-800 hover:to-cyan-800"
        )}
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="shrink-0 rounded-xl bg-white/20 p-3">
            <Plus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black sm:text-base">Buat Laporan Harian</p>
            <p className="mt-1 text-xs font-medium leading-5 text-white/75">Input realisasi pekerjaan lapangan</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
      </Button>}
      
      {canManageWorkPlans && (
        <Button 
          onClick={() => navigate('/work-plans/create')}
          className={cn(
          "group h-auto w-full min-w-0 justify-between rounded-2xl p-4 text-left shadow-lg shadow-emerald-900/10 transition-all hover:-translate-y-1 active:scale-[0.99] sm:p-5",
            "bg-gradient-to-br from-emerald-700 to-lime-700 text-white hover:from-emerald-800 hover:to-lime-800"
          )}
        >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="shrink-0 rounded-xl bg-white/20 p-3">
              <ClipboardList className="h-5 w-5" />
            </div>
          <div className="min-w-0">
          <p className="text-sm font-black sm:text-base">Rencana Kerja Baru</p>
              <p className="mt-1 text-xs font-medium leading-5 text-white/75">Susun agenda tim dan lokasi kerja</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
      {canManageFuel && (
        <Button
          onClick={() => navigate('/fuel-reports/create')}
          className={cn(
            "group h-auto w-full min-w-0 justify-between rounded-2xl p-4 text-left shadow-lg shadow-orange-900/10 transition-all hover:-translate-y-1 active:scale-[0.99] sm:p-5",
            "bg-gradient-to-br from-orange-600 to-amber-600 text-white hover:from-orange-700 hover:to-amber-700"
          )}
        >
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="shrink-0 rounded-xl bg-white/20 p-3">
              <Fuel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black sm:text-base">Laporan BBM Baru</p>
              <p className="mt-1 text-xs font-medium leading-5 text-white/75">Input laporan penggunaan BBM</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
};

export default QuickActions;
