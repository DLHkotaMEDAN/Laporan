"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, ArrowRight, Fuel, FileText } from 'lucide-react';
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
    <div className={cn("grid gap-4 mb-8", canManageReports && canManageWorkPlans ? "md:grid-cols-2" : "md:grid-cols-1")}>
      {canManageReports && <Button 
        onClick={() => navigate('/create')}
        className={cn(
          "group h-auto justify-between rounded-2xl p-5 text-left shadow-lg shadow-sky-900/10 transition-all hover:-translate-y-1 active:scale-[0.99]",
          "bg-gradient-to-br from-sky-700 to-cyan-700 hover:from-sky-800 hover:to-cyan-800"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-3">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-black">Buat Laporan Harian</p>
            <p className="mt-1 text-xs font-medium text-white/75">Input realisasi pekerjaan lapangan</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
      </Button>}
      
      {canManageWorkPlans && (
        <Button 
          onClick={() => navigate('/work-plans/create')}
          className={cn(
            "group h-auto justify-between rounded-2xl p-5 text-left shadow-lg shadow-emerald-900/10 transition-all hover:-translate-y-1 active:scale-[0.99]",
            "bg-gradient-to-br from-emerald-700 to-lime-700 text-white hover:from-emerald-800 hover:to-lime-800"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
            <p className="text-base font-black">Rencana Kerja Baru</p>
              <p className="mt-1 text-xs font-medium text-white/75">Susun agenda tim dan lokasi kerja</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
      {canManageFuel && (
        <Button
          onClick={() => navigate('/fuel-reports/create')}
          className={cn(
            "group h-auto justify-between rounded-2xl p-5 text-left shadow-lg shadow-orange-900/10 transition-all hover:-translate-y-1 active:scale-[0.99]",
            "bg-gradient-to-br from-orange-600 to-amber-600 text-white hover:from-orange-700 hover:to-amber-700"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3">
              <Fuel className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black">Laporan BBM Baru</p>
              <p className="mt-1 text-xs font-medium text-white/75">Input laporan penggunaan BBM</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
      {canManageFuel && (
        <Button
          onClick={() => navigate('/fuel-reports/spj/create')}
          className={cn(
            "group h-auto justify-between rounded-2xl p-5 text-left shadow-lg shadow-blue-900/10 transition-all hover:-translate-y-1 active:scale-[0.99]",
            "bg-gradient-to-br from-blue-700 to-indigo-700 text-white hover:from-blue-800 hover:to-indigo-800"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black">Laporan SPJ Baru</p>
              <p className="mt-1 text-xs font-medium text-white/75">Input laporan pertanggungjawaban BBM</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
};

export default QuickActions;
