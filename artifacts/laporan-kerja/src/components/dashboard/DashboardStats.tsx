"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ClipboardList, CheckCircle2, Calendar, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  totalReports: number;
  totalWorkPlans: number;
  reportsToday: number;
  plansToday: number;
}

const DashboardStats = ({ totalReports, totalWorkPlans, reportsToday, plansToday }: DashboardStatsProps) => {
  const stats = [
    {
      label: "Laporan Hari Ini",
      value: reportsToday,
      icon: FileText,
      color: "text-sky-700",
      bgColor: "bg-sky-100",
      borderColor: "border-sky-200",
      trend: "Operasional"
    },
    {
      label: "Rencana Hari Ini",
      value: plansToday,
      icon: ClipboardList,
      color: "text-emerald-700",
      bgColor: "bg-emerald-100",
      borderColor: "border-emerald-200",
      trend: "Terjadwal"
    },
    {
      label: "Total Laporan",
      value: totalReports,
      icon: CheckCircle2,
      color: "text-violet-700",
      bgColor: "bg-violet-100",
      borderColor: "border-violet-200",
      trend: "Data tersinkron"
    },
    {
      label: "Total Rencana",
      value: totalWorkPlans,
      icon: Calendar,
      color: "text-amber-700",
      bgColor: "bg-amber-100",
      borderColor: "border-amber-200",
      trend: "Arsip lengkap"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <Card key={i} className={cn(
          "group relative overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
          stat.borderColor
        )}>
          <div className={cn("absolute right-0 top-0 h-24 w-24 -mr-8 -mt-8 rounded-full opacity-60 transition-transform group-hover:scale-110", stat.bgColor)} />
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className={cn("p-2.5 rounded-xl shrink-0 ring-1 ring-white/70", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                <TrendingUp size={12} className={stat.color} />
                {stat.trend}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;
