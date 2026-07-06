"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  isPimpinan: boolean;
  isLoggedIn: boolean;
  activeTab: string;
}

const QuickActions = ({ isPimpinan, isLoggedIn, activeTab }: QuickActionsProps) => {
  const navigate = useNavigate();

  if (!isLoggedIn || isPimpinan) return null;

  return (
    <div className="grid gap-4 mb-8 md:grid-cols-2">
      <Button 
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
      </Button>
      
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
            <p className="text-base font-black">Buat Rencana Kerja</p>
            <p className="mt-1 text-xs font-medium text-white/75">Susun agenda tim dan lokasi kerja</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 opacity-70 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
};

export default QuickActions;
