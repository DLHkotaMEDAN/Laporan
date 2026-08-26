"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, FileText, MapPin, Calendar, 
  ShieldCheck, Edit, Trash2, User, Truck, Calculator, Info
} from 'lucide-react';
import { fuelSpjService } from '@/services/fuelSpjService';
import { FuelSpjReport } from '@/types/fuelSpjReport';
import { useAuth } from '@/context/AuthContext';
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from '@/utils/toast';
import { cn } from "@/lib/utils";
import PimpinanNoteSection from '@/components/PimpinanNoteSection';

const FuelSpjReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [report, setReport] = useState<FuelSpjReport | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!session;
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');

  useEffect(() => {
    if (id) loadReport(id);
  }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = await fuelSpjService.getReportById(reportId);
      setReport(data);
    } catch (error) {
      showError("Laporan SPJ tidak ditemukan");
      navigate('/fuel-reports/spj');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!report) return;
    await fuelSpjService.updateReport(report.id, { pimpinan_note: note });
    setReport({ ...report, pimpinan_note: note });
  };

  const handleDelete = async () => {
    if (!report || isPimpinan) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus laporan SPJ ini?")) {
      try {
        await fuelSpjService.deleteReport(report.id);
        showSuccess("Laporan SPJ berhasil dihapus");
        navigate('/fuel-reports/spj');
      } catch (error) {
        showError("Gagal menghapus laporan");
      }
    }
  };

  if (loading) return <div className="p-20 text-center">Memuat data SPJ...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between no-print">
          <Button variant="ghost" onClick={() => navigate('/fuel-reports/spj')} className="px-2 md:px-4 h-9">
            <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
          </Button>
          
          {isLoggedIn && (
            <div className="flex gap-2 items-center">
              {isPimpinan && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-9 px-2 md:px-4">
                  <ShieldCheck className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Mode Pantau</span>
                </Badge>
              )}
              <Button variant="outline" onClick={() => navigate(`/fuel-reports/spj/edit/${report.id}`)} className="h-9 border-blue-200 text-blue-600 hover:bg-blue-50">
                <Edit className="h-4 w-4 md:mr-2" /> Edit
              </Button>
              {!isPimpinan && (
                <Button variant="destructive" onClick={handleDelete} className="h-9">
                  <Trash2 className="h-4 w-4 md:mr-2" /> Hapus
                </Button>
              )}
            </div>
          )}
        </div>

        <PimpinanNoteSection 
          initialNote={report.pimpinan_note} 
          onSave={handleSaveNote} 
        />

        <Card className="border-t-4 border-t-blue-700 shadow-lg overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-black flex items-center gap-2 text-blue-800">
                  <FileText className="h-6 w-6" /> PREVIEW LAPORAN SPJ BBM
                </CardTitle>
                <div className="flex flex-wrap gap-3 mt-2">
                  <Badge variant="outline" className="bg-white font-bold border-blue-200 text-blue-700">
                    {report.region}
                  </Badge>
                  <Badge variant="outline" className="bg-white font-bold border-slate-200 text-slate-600">
                    {report.team}
                  </Badge>
                </div>
              </div>
              <div className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-md flex items-center gap-2 font-bold">
                <Calendar className="h-4 w-4" /> {report.date}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-200">
                    <th className="p-4 text-left font-bold text-slate-600 w-16">No</th>
                    <th className="p-4 text-left font-bold text-slate-600">Informasi Kendaraan & SPJ</th>
                    <th className="p-4 text-left font-bold text-slate-600">Detail Lokasi & Pemakaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 align-top font-black text-slate-400">{idx + 1}</td>
                      <td className="p-4 align-top space-y-3 w-1/3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">No. SPJ</p>
                          <p className="font-black text-lg text-slate-900">{entry.spj_no}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Kendaraan / Alat</p>
                          <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Truck size={14} className="text-orange-500" /> {entry.vehicle_operator}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Penerima / Operator</p>
                          <div className="flex items-center gap-2 text-slate-700">
                            <User size={14} className="text-blue-500" /> {entry.receiver_name}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="space-y-4">
                          {entry.locations.map((loc, lIdx) => (
                            <div key={lIdx} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <div className="flex items-start gap-2 flex-1">
                                  <MapPin size={16} className="text-red-500 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-slate-800">{loc.street}</p>
                                    <p className="text-xs text-slate-500">
                                      {loc.subDistrict && `Kec. ${loc.subDistrict}`}{loc.village && `, Kel. ${loc.village}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Badge className={cn(
                                    "font-bold",
                                    loc.fuel_type === 'Pertamax' ? "bg-blue-100 text-blue-700" :
                                    loc.fuel_type === 'Dexlite' ? "bg-green-100 text-green-700" :
                                    "bg-purple-100 text-purple-700"
                                  )}>
                                    {loc.fuel_type}
                                  </Badge>
                                  <Badge variant="outline" className="font-black border-slate-200">
                                    Rp {loc.amount_rp.toLocaleString('id-ID')}
                                  </Badge>
                                  <Badge className="bg-blue-600 text-white font-black">
                                    <Calculator size={10} className="mr-1" /> {loc.amount_liter} L
                                  </Badge>
                                </div>
                              </div>
                              {loc.remarks && (
                                <div className="pt-2 border-t border-dashed border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Keterangan Item:</p>
                                  <p className="text-xs italic text-slate-600">{loc.remarks}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.remarks && (
              <div className="p-6 bg-slate-50 border-t">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Info size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-widest">Catatan Umum Laporan</h3>
                </div>
                <p className="text-slate-700 italic leading-relaxed">{report.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FuelSpjReportDetail;