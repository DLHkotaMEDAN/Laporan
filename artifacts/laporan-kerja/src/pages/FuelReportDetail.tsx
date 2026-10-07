import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Fuel, MapPin, Calendar, ShieldCheck, Edit, Calculator } from 'lucide-react';
import { FuelReport, FuelReportType } from '@/types/fuelReport';
import { fuelService } from '@/services/fuelService';
import { fuelPusatService } from '@/services/fuelPusatService';
import { laporanBbmService } from '@/services/laporanBbmService';
import { useAuth } from '@/context/AuthContext';
import { isPimpinanAccess } from '@/constants/access-control';
import { Badge } from "@/components/ui/badge";
import { showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import PimpinanNoteSection from '@/components/PimpinanNoteSection';
import { supabase } from '@/lib/supabase';

interface FuelReportDetailProps {
  reportType?: FuelReportType;
}

const FuelReportDetail = ({ reportType = 'admin_bbm' }: FuelReportDetailProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [report, setReport] = useState<FuelReport | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!session;
  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);
  const isLaporanBbm = reportType === 'laporan_bbm';
  const isAdminBbmPusat = reportType === 'admin_bbm_pusat';
  const routeBase = isAdminBbmPusat ? '/fuel-reports-pusat' : isLaporanBbm ? '/laporan-bbm' : '/fuel-reports';

  useEffect(() => { if (id) loadReport(id); }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = isLaporanBbm
        ? await laporanBbmService.getReportById(reportId)
        : isAdminBbmPusat
          ? await fuelPusatService.getReportById(reportId)
          : await fuelService.getReportById(reportId);
      if (data.report_type !== reportType) throw new Error('Laporan tidak ditemukan');
      setReport(data);
    } catch (error) {
      showError("Laporan tidak ditemukan");
      navigate(routeBase);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!report) return;
    // Gunakan RPC khusus agar pimpinan hanya bisa update kolom pimpinan_note.
    // Tentukan nama tabel berdasarkan jenis laporan BBM.
    const tableName = isLaporanBbm
      ? 'laporan_bbm_reports'
      : isAdminBbmPusat
        ? 'fuel_reports_pusat'
        : 'fuel_reports';
    const { error } = await supabase.rpc('update_pimpinan_note', {
      p_record_id: report.id,
      p_note: note,
      p_table: tableName,
    });
    if (error) throw error;
    setReport({ ...report, pimpinan_note: note });
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl auto space-y-6">
        <div className="flex items-center justify-between no-print">
          <Button variant="ghost" onClick={() => navigate(routeBase)} className="px-2 md:px-4 h-9">
            <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
          </Button>
          
          {isLoggedIn && (
            <div className="flex gap-2 items-center">
              {isPimpinan && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-9 px-2 md:px-4">
                  <ShieldCheck className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Mode Pantau</span>
                </Badge>
              )}
              <Button variant="outline" onClick={() => navigate(`${routeBase}/edit/${report.id}`)} className="h-9">
                <Edit className="h-4 w-4 md:mr-2" /> Edit
              </Button>
            </div>
          )}
        </div>

        <PimpinanNoteSection 
          initialNote={report.pimpinan_note} 
          onSave={handleSaveNote} 
        />

        <Card className="border-t-4 border-t-orange-500 shadow-lg">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex justify-between items-start">
              <div>
                  <CardTitle className="text-2xl font-black flex items-center gap-2">
                    <Fuel className="text-orange-600 h-6 w-6" /> {isLaporanBbm ? 'LAPORAN BBM' : isAdminBbmPusat ? 'ADMIN BBM PUSAT' : 'LAPORAN BBM & OLI'}
                </CardTitle>
                <p className="text-slate-500 font-medium mt-1">{report.team} - {report.region}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <Calendar className="h-4 w-4" /> {report.date}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {isLaporanBbm && <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm"><span className="font-bold text-blue-800">No. SPJ:</span> <span className="ml-2 font-semibold text-slate-700">{report.no_spj || '-'}</span></div>}
            <div className="grid gap-4">
              <h3 className="text-sm font-bold uppercase text-slate-400 tracking-widest">Detail Pemakaian</h3>
              {report.items.filter(item => !isLaporanBbm || item.fuel_type !== 'Oli').map((item, idx) => (
                <div key={idx} className="p-4 border rounded-xl bg-white shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div><span className="font-black text-slate-800">{item.vehicle_operator}</span>{isLaporanBbm && <p className="mt-0.5 text-xs font-medium text-slate-500">No. Polisi: {item.no_pol || '-'}</p>}</div>
                    <div className="flex gap-2">
                      <Badge className={cn(
                        "font-bold",
                        item.fuel_type === 'Pertamax' ? "bg-blue-100 text-blue-700" :
                        item.fuel_type === 'Dexlite' ? "bg-green-100 text-green-700" :
                        "bg-purple-100 text-purple-700"
                      )}>
                        {item.fuel_type}
                      </Badge>
                      {item.fuel_type !== 'Oli' && (
                        <Badge variant="outline" className="font-bold border-slate-200">
                          Rp {(item.amount_rp || item.amount).toLocaleString('id-ID')}
                        </Badge>
                      )}
                      <Badge className="bg-blue-600 text-white font-bold">
                        <Calculator size={10} className="mr-1" /> {(item.amount_liter || (item.fuel_type === 'Oli' ? item.amount : 0))} L
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                    <span>{item.location.street}, {item.location.subDistrict}, {item.location.village}</span>
                  </div>
                  {isLaporanBbm && item.recipient_name && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Penerima:</p>
                      <p className="text-xs font-medium text-slate-700">{item.recipient_name}</p>
                    </div>
                  )}
                  {item.item_remarks && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Keterangan:</p>
                      <p className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded border border-dashed">
                        {item.item_remarks}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {report.remarks && (
              <div className="pt-6 border-t">
                <h3 className="text-sm font-bold uppercase text-slate-400 tracking-widest mb-2">Keterangan Umum</h3>
                <p className="text-slate-700 italic">{report.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FuelReportDetail;
