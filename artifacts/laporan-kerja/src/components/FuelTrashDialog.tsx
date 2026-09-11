"use client";

import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, RotateCcw, Trash2, Fuel } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fuelService } from '@/services/fuelService';
import { FuelReport } from '@/types/fuelReport';
import { showError, showSuccess } from '@/utils/toast';

interface FuelTrashDialogProps {
  isOpen: boolean;
  onClose: () => void;
  regionId?: string | null;
  canPermanentlyDelete?: boolean;
  onRefresh: () => void;
}

const FuelTrashDialog = ({ isOpen, onClose, regionId, canPermanentlyDelete = true, onRefresh }: FuelTrashDialogProps) => {
  const [reports, setReports] = useState<FuelReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      setReports(await fuelService.getAllReports(true, regionId));
    } catch {
      showError('Gagal memuat tempat sampah BBM');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void fetchDeleted();
  }, [isOpen, regionId]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      await fuelService.restoreReport(id);
      setReports(current => current.filter(report => report.id !== id));
      showSuccess('Laporan BBM berhasil dipulihkan');
      onRefresh();
    } catch {
      showError('Gagal memulihkan laporan BBM');
    } finally {
      setBusyId(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    if (!window.confirm('Hapus permanen laporan BBM ini? Data tidak dapat dipulihkan.')) return;
    setBusyId(id);
    try {
      await fuelService.hardDeleteReport(id);
      setReports(current => current.filter(report => report.id !== id));
      showSuccess('Laporan BBM dihapus permanen');
    } catch {
      showError('Gagal menghapus permanen laporan BBM');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Tempat Sampah Admin BBM</DialogTitle>
          <DialogDescription>Laporan yang dihapus tersimpan sementara dan dapat dipulihkan.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Memuat...</div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic"><Fuel className="mx-auto mb-2 h-8 w-8" />Tempat sampah BBM kosong</div>
          ) : reports.map(report => (
            <div key={report.id} className="flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{report.team || 'Tanpa tim'} · {report.region || 'Tanpa wilayah'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {report.date}</span>
                  <Badge variant="outline" className="text-[9px]">{report.items?.length || 0} item BBM/Oli</Badge>
                  {report.deleted_at && <span>Dihapus {new Date(report.deleted_at).toLocaleString('id-ID')}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" className="h-8 text-blue-600" disabled={busyId !== null} onClick={() => void restore(report.id)}>
                  {busyId === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} Pulihkan
                </Button>
                {canPermanentlyDelete && <Button size="sm" variant="ghost" className="h-8 text-red-500" disabled={busyId !== null} onClick={() => void permanentlyDelete(report.id)} title="Hapus permanen"><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FuelTrashDialog;
