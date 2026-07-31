"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Eye, Edit, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Report } from '@/types/report';
import { getUnitByCategory } from '@/utils/report-helpers';
import { cn } from "@/lib/utils";

interface ReportCardProps {
  report: Report;
  isLoggedIn: boolean;
  isPimpinan: boolean;
  onDelete: (e: React.MouseEvent, report: Report) => void;
}

const ReportCard = ({ report, isLoggedIn, isPimpinan, onDelete }: ReportCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="group hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden border-none bg-white/80 backdrop-blur-sm ring-1 ring-slate-200/50 relative"
      onClick={() => navigate(`/daily-rekap?date=${report.date}&categories=${encodeURIComponent(report.category)}`)}
    >
      {/* Decorative element */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-70 group-hover:h-1.5 transition-all" />
      
      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 w-fit px-2 py-0.5 rounded">
              <Calendar className="h-3 w-3 mr-1.5" />
              {new Date(report.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <Badge variant="secondary" className="w-fit text-[10px] font-bold bg-slate-100 text-slate-700 border-none px-2.5 py-1">
              {report.category}
            </Badge>
          </div>
          
          {isLoggedIn && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-blue-600 hover:text-white transition-colors" 
                onClick={(e) => { e.stopPropagation(); navigate(`/edit/${report.id}`); }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              {!isPimpinan && (
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-red-600 hover:text-white transition-colors" 
                  onClick={(e) => onDelete(e, report)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        <CardTitle className="text-lg font-bold text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors mt-4 leading-tight">
          {report.description}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 pt-2 space-y-5">
        <div className="flex items-start gap-2.5 text-xs text-slate-500 font-medium">
          <div className="p-1.5 bg-red-50 rounded-lg shrink-0">
            <MapPin className="h-3.5 w-3.5 text-red-500" />
          </div>
          <span className="line-clamp-2 pt-0.5">
            {report.location.street}, {Array.isArray(report.location.village) ? report.location.village.join(", ") : report.location.village}
          </span>
        </div>
        
        <div className="pt-5 flex justify-between items-center border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Volume</span>
            <span className="text-sm font-black text-slate-700">{report.volume} {getUnitByCategory(report.category)}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-600 font-black text-[11px] uppercase tracking-wider group-hover:gap-3 transition-all">
            Lihat Rekap Tim <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportCard;
