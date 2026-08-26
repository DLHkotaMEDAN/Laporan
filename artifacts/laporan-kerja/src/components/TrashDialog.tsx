"use client";

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trash2, RotateCcw, FileText, ClipboardList, 
  Calendar, MapPin, Loader2, Search 
} from 'lucide-react';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
import { auditLogService } from '@/services/auditLogService';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { cn } from "@/lib/utils";

interface TrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const TrashDialog = ({ isOpen, onClose, onRefresh }: TrashDialogProps) => {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');
  const isAdminHarian = profile?.role === 'admin_harian' || (session?.user?.email === 'sakinah@gmail.com');
  const isAdmin = profile?.role === 'admin' || (session?.user?.email === 'admin@gmail.com');
  const isUserRestricted = profile?.role === 'user' && !isPimpinan && !isAdminHarian && !isAdmin;

  useEffect(() => {
    if (isOpen) {
      fetchDeletedData();
    }
  }, [isOpen]);

  const fetchDeletedData = async () => {
    setLoading(true);
    try {
      const categoryFilter = isUserRestricted ? profile?.category : 'semua';
      const [deletedReports, deletedPlans] = await Promise.all([
        reportService.getAllReports(categoryFilter, true),
        workPlanService.getAllWorkPlans(categoryFilter, true)
      ]);
      setReports(deletedReports);
      setWorkPlans(deletedPlans);
    } catch (error) {
      showError("Gagal memuat data terhapus");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (type: 'REPORT' | 'WORK_PLAN', id: string, title: string) => {
    if (isPimpinan) return;
    setRestoringId(id);
    try {
      if (type === 'REPORT') {
        await reportService.restoreReport(id);
      } else {
        await workPlanService.restoreWorkPlan(id);
      }

      // Catat Log
      if (session?.user) {
        await auditLogService.logAction({
          action: 'UPDATE',
          entityType: type,
          entityId: id,
          details: { title: `Memulihkan data: ${title}` },
          userId: session.user.id,
          username: profile?.username || session.user.email || "User"
        });
      }

      showSuccess("Data berhasil dipulihkan");
      fetchDeletedData();
      onRefresh();
    } catch (error) {
      showError("Gagal memulihkan data");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Tempat Sampah
          </DialogTitle>
          <DialogDescription>
            Data yang Anda hapus akan tersimpan di sini. Anda dapat memulihkannya kembali ke daftar utama.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="reports" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText size={14} /> Laporan ({reports.length})
              </TabsTrigger>
              <TabsTrigger value="workplans" className="flex items-center gap-2">
                <ClipboardList size={14} /> Rencana ({workPlans.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="reports" className="mt-0 space-y-3">
              {loading ? (
                <div className="py-10 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat...</div>
              ) : reports.length > 0 ? (
                reports.map((report) => (
                  <div key={report.id} className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{report.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {report.date}</span>
                        <span className="flex items-center gap-1"><MapPin size={10} /> {report.location.street}</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                      onClick={() => handleRestore('REPORT', report.id, report.description)}
                      disabled={!!restoringId || isPimpinan}
                    >
                      {restoringId === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                      Pulihkan
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400 italic text-sm">Tidak ada laporan di tempat sampah</div>
              )}
            </TabsContent>

            <TabsContent value="workplans" className="mt-0 space-y-3">
              {loading ? (
                <div className="py-10 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Memuat...</div>
              ) : workPlans.length > 0 ? (
                workPlans.map((plan) => (
                  <div key={plan.id} className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{plan.items[0]?.description || "Rencana Kerja"}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={10} /> {plan.date}</span>
                        <Badge variant="outline" className="text-[8px] py-0 h-3.5">{plan.category}</Badge>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                      onClick={() => handleRestore('WORK_PLAN', plan.id, plan.items[0]?.description || "Rencana Kerja")}
                      disabled={!!restoringId || isPimpinan}
                    >
                      {restoringId === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                      Pulihkan
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-slate-400 italic text-sm">Tidak ada rencana kerja di tempat sampah</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="p-4 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-800 flex items-start gap-2">
          <RotateCcw size={12} className="mt-0.5 shrink-0" />
          <p>Hanya Administrator yang dapat menghapus data secara permanen dari sistem. Pengguna hanya dapat memulihkan data yang telah dihapus.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrashDialog;