import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, ArrowRight, Edit, Trash2, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkPlan } from '@/types/workPlan';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkPlanCardProps {
  plan: WorkPlan;
  isLoggedIn: boolean;
  isPimpinan: boolean;
  onDelete: (e: React.MouseEvent, plan: WorkPlan) => void;
  onToggleVisibility: (e: React.MouseEvent, plan: WorkPlan) => void;
}

const WorkPlanCard = ({ plan, isLoggedIn, isPimpinan, onDelete, onToggleVisibility }: WorkPlanCardProps) => {
  const navigate = useNavigate();
  const isHidden = plan.is_visible === false;

  return (
    <Card 
      className={cn(
        "group hover:shadow-2xl transition-all duration-500 cursor-pointer border-none bg-white/80 backdrop-blur-sm ring-1 ring-slate-200/50 relative overflow-hidden",
        isHidden ? "opacity-75 grayscale-[0.3]" : ""
      )} 
      onClick={() => navigate(`/work-plans/daily-rekap?date=${plan.date}&category=${encodeURIComponent(plan.category)}`)}
    >
      {/* Decorative element */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-1 opacity-70 group-hover:h-1.5 transition-all",
        isHidden ? "bg-slate-400" : "bg-gradient-to-r from-emerald-500 to-teal-600"
      )} />
      
      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 w-fit px-2 py-0.5 rounded">
              <Calendar className="h-3 w-3 mr-1.5" />
              {new Date(plan.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "w-fit text-[10px] font-bold px-2.5 py-0.5 border-none",
                isHidden ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
              )}>
                {plan.category}
              </Badge>
              {isHidden && (
                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-100 font-black uppercase tracking-tighter">
                  <EyeOff size={10} className="mr-1" /> Hidden
                </Badge>
              )}
            </div>
          </div>
          
          {isLoggedIn && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className={cn("h-8 w-8 rounded-full bg-white shadow-sm transition-colors", isHidden ? "text-slate-400 hover:bg-blue-600 hover:text-white" : "text-blue-600 hover:bg-blue-600 hover:text-white")} 
                      onClick={(e) => onToggleVisibility(e, plan)} 
                      disabled={isPimpinan}
                    >
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isHidden ? "Tampilkan di Rekap" : "Sembunyikan dari Rekap"}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-emerald-600 hover:text-white transition-colors" 
                disabled={isPimpinan}
                onClick={(e) => { e.stopPropagation(); if(!isPimpinan) navigate(`/work-plans/edit/${plan.id}`); }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              {!isPimpinan && (
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-red-600 hover:text-white transition-colors" 
                  onClick={(e) => onDelete(e, plan)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        <CardTitle className="text-lg font-bold text-slate-800 line-clamp-2 group-hover:text-emerald-600 transition-colors mt-4 leading-tight">
          {plan.items?.[0]?.description || "Rencana Kerja"}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 pt-2 space-y-5">
        <div className="flex items-start gap-2.5 text-xs text-slate-500 font-medium">
          <div className="p-1.5 bg-emerald-50 rounded-lg shrink-0">
            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="line-clamp-1 pt-0.5">
            {plan.items?.[0]?.location?.street || "Lokasi Kerja"}
          </span>
        </div>
        
        <div className="pt-5 flex justify-between items-center border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cakupan</span>
            <span className="text-sm font-black text-slate-700">{plan.items?.length || 0} Titik Kerja</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-wider group-hover:gap-3 transition-all">
            Lihat Rekap Tim <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkPlanCard;
