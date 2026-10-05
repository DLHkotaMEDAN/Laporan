"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, FileText, ClipboardList, Fuel, Calendar, MapPin, Loader2 } from 'lucide-react';
import { reportService } from '@/services/reportService';
import { workPlanService } from '@/services/workPlanService';
import { fuelService } from '@/services/fuelService';
import { fuelPusatService } from '@/services/fuelPusatService';
import { laporanBbmService } from '@/services/laporanBbmService';
import { auditLogService } from '@/services/auditLogService';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { isPimpinanAccess, isSuperAdminAccess } from '@/constants/access-control';
import { Report } from '@/types/report';
import { WorkPlan } from '@/types/workPlan';
import { FuelReport, FuelReportType } from '@/types/fuelReport';

interface TrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  fuelReportType?: FuelReportType | null;
}
type TrashType = 'REPORT' | 'WORK_PLAN' | 'FUEL_REPORT';

const TrashDialog = ({ isOpen, onClose, onRefresh, fuelReportType = 'admin_bbm' }: TrashDialogProps) => {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [fuelReports, setFuelReports] = useState<FuelReport[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const role = profile?.role;
  const isPimpinan = isPimpinanAccess(role, session?.user?.email);
  const isAdmin = isSuperAdminAccess(role, session?.user?.email);
  const isFuelAdmin = role === 'admin_bbm' || role === 'admin_rencana_kerja_bbm' || role === 'admin_wilayah_bbm';
  const isPusatFuelAdmin = role === 'admin_bbm_pusat';
  const isLaporanFuelAdmin = role === 'admin_laporan_bbm';
  const canViewFuelTrash = isAdmin || isFuelAdmin || isPusatFuelAdmin || isLaporanFuelAdmin || isPimpinan;
  const isUserRestricted = role === 'user' && !isPimpinan && !isAdmin;
  // Admin BBM adalah administrator global; hanya role gabungan yang dibatasi
  // oleh wilayah akun saat membaca tempat sampah BBM.
  const fuelRegionId = (isFuelAdmin || isPusatFuelAdmin || isLaporanFuelAdmin) && !isAdmin && role !== 'admin_bbm' && role !== 'admin_bbm_pusat' ? profile?.region_id || '__unassigned__' : null;

  useEffect(() => { if (isOpen) void fetchDeletedData(); }, [isOpen, fuelRegionId, role, fuelReportType]);

  const fetchDeletedData = async () => {
    setLoading(true);
    try {
      const categoryFilter = isUserRestricted ? profile?.category : 'semua';
      const results = await Promise.allSettled([
        reportService.getAllReports(categoryFilter, true),
        workPlanService.getAllWorkPlans(categoryFilter, true),
        canViewFuelTrash
          ? fuelReportType === 'laporan_bbm'
            ? laporanBbmService.getAllReports(true, fuelRegionId)
            : fuelReportType === 'admin_bbm_pusat'
              ? fuelPusatService.getAllReports(true, fuelRegionId)
              : fuelService.getAllReports(true, fuelRegionId, fuelReportType || 'admin_bbm')
          : Promise.resolve([]),
      ]);
      const deletedReports: Report[] = results[0].status === 'fulfilled' ? results[0].value as Report[] : [];
      const deletedPlans: WorkPlan[] = results[1].status === 'fulfilled' ? results[1].value as WorkPlan[] : [];
      const deletedFuel: FuelReport[] = results[2].status === 'fulfilled' ? results[2].value as FuelReport[] : [];
      // Query untuk tab yang tidak dimiliki role dapat ditolak oleh RLS.
      // Itu kondisi normal, bukan kegagalan tempat sampah secara keseluruhan.
      if (results.every(result => result.status === 'rejected')) throw new Error('Tidak ada data yang dapat dibaca');
      const newestFirst = <T,>(items: T[], getDeletedAt: (item: T) => string | null | undefined): T[] => [...items].sort((a, b) => {
        const aDeletedAt = getDeletedAt(a);
        const bDeletedAt = getDeletedAt(b);
        const aTime = aDeletedAt ? new Date(aDeletedAt).getTime() : 0;
        const bTime = bDeletedAt ? new Date(bDeletedAt).getTime() : 0;
        return bTime - aTime;
      });
      const getDeletedAt = (item: { deleted_at?: string | null }) => item.deleted_at;
      setReports(newestFirst(deletedReports, item => getDeletedAt(item as Report & { deleted_at?: string | null })));
      setWorkPlans(newestFirst(deletedPlans, item => getDeletedAt(item as WorkPlan & { deleted_at?: string | null })));
      setFuelReports(newestFirst(deletedFuel, getDeletedAt) as FuelReport[]);
    } catch { showError('Gagal memuat data terhapus'); }
    finally { setLoading(false); }
  };

  const handleRestore = async (type: TrashType, id: string, title: string) => {
    if (isPimpinan) return;
    setRestoringId(id);
    try {
      if (type === 'REPORT') await reportService.restoreReport(id);
      if (type === 'WORK_PLAN') await workPlanService.restoreWorkPlan(id);
      if (type === 'FUEL_REPORT') {
        if (fuelReportType === 'laporan_bbm') await laporanBbmService.restoreReport(id);
        else if (fuelReportType === 'admin_bbm_pusat') await fuelPusatService.restoreReport(id);
        else await fuelService.restoreReport(id);
      }
      if (session?.user && (type === 'REPORT' || type === 'WORK_PLAN')) await auditLogService.logAction({ action: 'UPDATE', entityType: type, entityId: id, details: { title: `Memulihkan data: ${title}` }, userId: session.user.id, username: profile?.username || session.user.email || 'User' });
      showSuccess('Data berhasil dipulihkan');
      await fetchDeletedData();
      onRefresh();
    } catch { showError('Gagal memulihkan data'); }
    finally { setRestoringId(null); }
  };

  const action = (type: TrashType, id: string, title: string) => (
    <Button size="sm" variant="outline" className="h-8 shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => void handleRestore(type, id, title)} disabled={!!restoringId || isPimpinan}>
      {restoringId === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} Pulihkan
    </Button>
  );

  const empty = (label: string) => <div className="py-10 text-center text-sm italic text-slate-400">Tidak ada {label} di tempat sampah</div>;
  const busy = <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Memuat...</div>;
  const deletedAt = (value?: string | null) => value ? <span className="font-medium text-red-600">Dihapus: {new Date(value).toLocaleString('id-ID')}</span> : null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Tempat Sampah</DialogTitle>
          <DialogDescription>Semua data terhapus tersedia dalam tab sesuai hak akses Anda.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="reports" className="flex flex-1 flex-col overflow-hidden">
          <div className="px-6"><TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="reports"><FileText className="mr-1 h-3.5 w-3.5" />Laporan ({reports.length})</TabsTrigger>
            <TabsTrigger value="workplans"><ClipboardList className="mr-1 h-3.5 w-3.5" />Rencana ({workPlans.length})</TabsTrigger>
            {canViewFuelTrash && <TabsTrigger value="fuel"><Fuel className="mr-1 h-3.5 w-3.5" />{fuelReportType === 'laporan_bbm' ? 'Laporan BBM' : fuelReportType === 'admin_bbm_pusat' ? 'Admin BBM Pusat' : 'BBM'} ({fuelReports.length})</TabsTrigger>}
          </TabsList></div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="reports" className="mt-0 space-y-3">{loading ? busy : reports.length ? reports.map(report => <div key={report.id} className="flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{report.description}</p><div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500"><span><Calendar size={10} className="mr-1 inline" />{report.date}</span><span><MapPin size={10} className="mr-1 inline" />{report.location.street}</span>{deletedAt((report as Report & { deleted_at?: string | null }).deleted_at)}</div></div>{action('REPORT', report.id, report.description)}</div>) : empty('laporan')}</TabsContent>
            <TabsContent value="workplans" className="mt-0 space-y-3">{loading ? busy : workPlans.length ? workPlans.map(plan => <div key={plan.id} className="flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{plan.items[0]?.description || 'Rencana Kerja'}</p><div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500"><span><Calendar size={10} className="mr-1 inline" />{plan.date}</span><Badge variant="outline" className="text-[8px]">{plan.category}</Badge>{deletedAt((plan as WorkPlan & { deleted_at?: string | null }).deleted_at)}</div></div>{action('WORK_PLAN', plan.id, plan.items[0]?.description || 'Rencana Kerja')}</div>) : empty('rencana kerja')}</TabsContent>
            <TabsContent value="fuel" className="mt-0 space-y-3">{loading ? busy : fuelReports.length ? fuelReports.map(report => <div key={report.id} className="flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{report.team || 'Tanpa tim'} · {report.region || 'Tanpa wilayah'}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span><Calendar size={10} className="mr-1 inline" />{report.date}</span><Badge variant="outline" className="text-[9px]">{fuelReportType === 'laporan_bbm' ? report.items?.filter(item => item.fuel_type !== 'Oli').length || 0 : report.items?.length || 0} item {fuelReportType === 'laporan_bbm' ? 'BBM' : 'BBM/Oli'}</Badge>{deletedAt(report.deleted_at)}</div></div>{action('FUEL_REPORT', report.id, `${report.team} ${report.date}`)}</div>) : empty(fuelReportType === 'laporan_bbm' ? 'Laporan BBM' : fuelReportType === 'admin_bbm_pusat' ? 'Admin BBM Pusat' : 'laporan BBM')}</TabsContent>
          </div>
        </Tabs>
        <div className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 p-4 text-[10px] text-amber-800"><RotateCcw size={12} className="mt-0.5 shrink-0" /><p>Data dapat dipulihkan dari tab yang sesuai. Pimpinan hanya dapat melihat isi tempat sampah.</p></div>
      </DialogContent>
    </Dialog>
  );
};

export default TrashDialog;
