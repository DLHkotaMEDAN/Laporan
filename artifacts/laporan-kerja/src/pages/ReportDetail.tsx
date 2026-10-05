import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Edit, Fuel, Users, Wrench, MessageSquare, Truck, LogIn, ShieldCheck, Calculator } from 'lucide-react';
import { Report } from '@/types/report';
import { showError } from '@/utils/toast';
import { getUnitByCategory } from '@/utils/report-helpers';
import { reportService } from '@/services/reportService';
import { useAuth } from '@/context/AuthContext';
import { isPimpinanAccess } from '@/constants/access-control';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import PimpinanNoteSection from '@/components/PimpinanNoteSection';
import ConfirmDialog from '@/components/ConfirmDialog';

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteReportConfirm, setDeleteReportConfirm] = useState(false);

  const isLoggedIn = !!session;
  const isPimpinan = isPimpinanAccess(profile?.role, session?.user?.email);

  useEffect(() => { if (id) loadReport(id); }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      const data = await reportService.getReportById(reportId);
      setReport(data);
    } catch (error) {
      showError("Laporan tidak ditemukan");
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!report) return;
    await reportService.updateReport(report.id, { pimpinan_note: note });
    setReport({ ...report, pimpinan_note: note });
  };

  const cleanDescription = (desc: string) => {
    return desc.replace(/^\[BK\s\d+\s[A-Z]+\]\s*/, '');
  };

  if (loading) return <div className="p-20 text-center">Memuat data...</div>;
  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-[420mm] mx-auto space-y-6">
        <div className="flex items-center justify-between no-print">
          <Button variant="ghost" onClick={() => navigate('/')} className="px-2 md:px-4 h-9">
            <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
          </Button>
          
          {isLoggedIn ? (
            <div className="flex gap-2 items-center">
              {isPimpinan && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 h-9 px-2 md:px-4">
                  <ShieldCheck className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Mode Pantau</span>
                </Badge>
              )}
              <Button 
                variant="outline" 
                onClick={() => navigate(`/edit/${report.id}`)}
                className="px-2 md:px-4 h-9"
              >
                <Edit className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Edit</span>
              </Button>
              <Button 
                variant="destructive" 
                className={cn("px-2 md:px-4 h-9", isPimpinan && "opacity-50 cursor-not-allowed")}
                disabled={isPimpinan}
                onClick={() => { 
                  if (isPimpinan) return;
                  setDeleteReportConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Hapus</span>
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => navigate('/login')} className="text-blue-600 border-blue-600 px-2 md:px-4 h-9">
              <LogIn className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Masuk untuk Edit</span>
            </Button>
          )}
        </div>

        {/* Seksi Catatan Pimpinan */}
        <PimpinanNoteSection 
          initialNote={report.pimpinan_note} 
          onSave={handleSaveNote} 
        />

        <div id="report-content" className="print-area w-full max-w-[420mm] bg-white border shadow-lg p-4 md:p-10 space-y-8">
          <div className="border-b-2 border-black pb-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">PEMERINTAH KOTA MEDAN</h1>
              <h2 className="text-2xl font-black">DINAS LINGKUNGAN HIDUP</h2>
            </div>
            <div className="text-right">
              <h3 className="text-lg font-bold underline">LAPORAN KEGIATAN HARIAN</h3>
              <p className="font-bold">{report.category.toUpperCase()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-slate-500">Tanggal</p><p className="font-bold">{report.date}</p></div>
            <div><p className="text-slate-500">Total Volume</p><p className="font-bold">{report.volume} {getUnitByCategory(report.category)}</p></div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[1200px] table-fixed border-collapse text-[11px] print:min-w-0">
              <colgroup>
                <col style={{ width: '35px' }} />
                <col style={{ width: '105px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '145px' }} />
                <col style={{ width: '145px' }} />
                <col style={{ width: '145px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '25px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead>
                <tr className="h-10 bg-[#42FF41] text-center font-bold text-black">
                  <th className="border-2 border-black p-2" rowSpan={2}>No</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Uraian Kegiatan</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Lokasi</th>
                  <th className="border-2 border-black p-2" colSpan={3}>Dokumentasi</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Vol</th>
                  <th className="border-2 border-black p-2" colSpan={2}>Peralatan</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Alat Berat</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Koordinator</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Anggota</th>
                  <th className="border-2 border-black p-2" rowSpan={2}>Keterangan</th>
                </tr>
                <tr className="h-8 bg-[#42FF41] text-center font-bold text-black">
                  <th className="border-2 border-black p-1">0%</th>
                  <th className="border-2 border-black p-1">50%</th>
                  <th className="border-2 border-black p-1">100%</th>
                  <th className="border-2 border-black p-1">Jenis Alat</th>
                  <th className="border-2 border-black p-1">Jml</th>
                </tr>
              </thead>
              <tbody>
                {report.tasks?.map((task, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-2 border-black p-2 text-center font-bold">{i + 1}</td>
                    <td className="border-2 border-black p-2 whitespace-normal break-words leading-tight">{cleanDescription(task.description)}</td>
                    <td className="border-2 border-black p-2 whitespace-normal break-words leading-tight">
                      <p className="font-semibold">{task.location.street || "-"}</p>
                      <p className="mt-1">Kel. {Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village || "-"}</p>
                      <p>Kec. {task.location.subDistrict || "-"}</p>
                    </td>
                    {['0%', '50%', '100%'].map((label, photoIndex) => {
                      const image = photoIndex === 0 ? task.photos.zero : photoIndex === 1 ? task.photos.fifty : task.photos.hundred;
                      return (
                        <td key={label} className="border-2 border-black p-1 align-middle">
                          <div className="h-[110px] w-[145px] overflow-hidden bg-slate-100">
                            {image ? <img src={image} alt={`Dokumentasi ${label}`} className="h-full w-full object-fill" /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-400">Tidak ada foto</div>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-2 border-black p-2 text-center font-bold">{task.volume} {getUnitByCategory(report.category)}</td>
                    <td className="border-2 border-black p-1.5 align-top leading-tight">
                      {task.equipment?.length > 0 ? task.equipment.map((equipment, equipmentIndex) => (
                        <p key={equipmentIndex} className="mb-0.5">• {equipment.type}</p>
                      )) : "-"}
                    </td>
                    <td className="border-2 border-black p-1.5 text-center align-top leading-tight">
                      {task.equipment?.length > 0 ? task.equipment.map((equipment, equipmentIndex) => (
                        <p key={equipmentIndex} className="mb-0.5">{equipment.quantity}</p>
                      )) : "-"}
                    </td>
                    <td className="border-2 border-black p-1.5 align-top leading-tight">
                      {task.heavyEquipment?.length > 0 ? task.heavyEquipment.map((heavyEquipment, heavyEquipmentIndex) => (
                        <p key={heavyEquipmentIndex} className="mb-0.5">• {heavyEquipment.type} {heavyEquipment.vehicle || ""}</p>
                      )) : "-"}
                    </td>
                    <td className="border-2 border-black p-2 text-center align-top">{task.personnel.coordinator || "-"}</td>
                    <td className="border-2 border-black p-2 text-center align-top">{task.personnel.members || 0}</td>
                    <td className="border-2 border-black p-2 align-top whitespace-normal break-words italic">
                      {task.remarks || (i === 0 && report.remarks) || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.remarks && (
            <div className="pt-6 border-t-2 border-black">
              <p className="text-slate-500 text-xs uppercase font-bold mb-1">Keterangan Tambahan (Umum)</p>
              <p className="text-sm italic">{report.remarks}</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }
          @page { size: A3 landscape; margin: 1.5cm; }
          .print-area table { width: 100% !important; min-width: 0 !important; }
          .print-area tr { page-break-inside: avoid; break-inside: avoid; }
          .print-area thead { display: table-header-group; }
          .print-area .overflow-x-auto { overflow: visible !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>
      <ConfirmDialog
        open={deleteReportConfirm}
        onOpenChange={setDeleteReportConfirm}
        title="Hapus Laporan"
        description="Laporan ini akan dipindahkan ke tempat sampah. Anda dapat memulihkannya nanti."
        variant="warning"
        confirmLabel="Ya, Hapus"
        onConfirm={async () => {
          try {
            await reportService.deleteReport(report.id);
            setDeleteReportConfirm(false);
            navigate('/');
          } catch {
            showError("Gagal menghapus laporan");
          }
        }}
      />
    </div>
  );
};

export default ReportDetail;
