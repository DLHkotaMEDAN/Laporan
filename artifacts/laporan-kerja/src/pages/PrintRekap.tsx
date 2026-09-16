"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Report } from '@/types/report';
import { reportService } from '@/services/reportService';
import { getUnitByCategory } from '@/utils/report-helpers';
import { ArrowLeft, Printer, Fuel, Users, Wrench, MessageSquare, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PrintRekap = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  
  const category = searchParams.get('category');

  useEffect(() => {
    loadData();
  }, [category]);

  const loadData = async () => {
    try {
      setLoading(true);
      let data = await reportService.getAllReports();
      if (category && category !== 'semua') {
        data = data.filter(r => r.category === category);
      }
      // Urutkan berdasarkan tanggal dari awal ke akhir (ascending)
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setReports(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const cleanDescription = (desc: string) => {
    return desc.replace(/^\[BK\s\d+\s[A-Z]+\]\s*/, '');
  };

  if (loading) return <div className="p-20 text-center">Menyiapkan data cetak...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="recap-sticky-toolbar max-w-[1000px] mx-auto space-y-6 no-print mb-8 p-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
          <Button variant="ghost" onClick={() => navigate('/')} className="px-2 md:px-4 h-9">
            <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
          </Button>
          <div className="text-center">
            <h1 className="font-bold text-sm md:text-base">Preview Cetak Rekap</h1>
            <p className="text-[10px] text-slate-500">Kategori: {category === 'semua' ? 'Semua Kategori' : category}</p>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 px-2 md:px-4 h-9">
            <Printer className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Cetak</span>
          </Button>
        </div>
      </div>

      <div className="print-container space-y-12">
        {reports.map((report) => (
          <div key={report.id} className="bg-white border shadow-none break-after-page p-8 space-y-8 mx-auto max-w-[900px]">
            {/* Header */}
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

            {/* Info Dasar */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">Tanggal</p><p className="font-bold">{report.date}</p></div>
              <div><p className="text-slate-500">Total Volume</p><p className="font-bold">{report.volume} {getUnitByCategory(report.category)}</p></div>
            </div>

            {/* Daftar Kegiatan */}
            <div className="space-y-12">
              {report.tasks?.map((task, i) => (
                <div key={i} className="space-y-6 border-b-2 border-slate-100 pb-12 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-black text-white w-8 h-8 flex items-center justify-center font-bold rounded-full text-sm">{i + 1}</div>
                    <h3 className="text-lg font-bold">Kegiatan: {cleanDescription(task.description)}</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Lokasi & Volume</p>
                        <p className="font-bold text-sm">{task.location.street}</p>
                        <p className="text-[10px] text-slate-600">
                          Kel: {Array.isArray(task.location.village) ? task.location.village.join(", ") : task.location.village}, Kec: {task.location.subDistrict}
                        </p>
                        <p className="text-blue-600 font-bold mt-2 text-sm">Volume: {task.volume} {getUnitByCategory(report.category)}</p>
                      </div>

                      <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3">
                        <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Sumber Daya & Personil</p>
                        
                        {task.vehicle && (
                          <div className="mb-2 p-1 bg-orange-50 border border-orange-100 rounded flex items-center gap-2 text-orange-700 font-bold text-[10px]">
                            <Truck size={12} /> PLAT: {task.vehicle}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-[11px]">
                          <div>
                            <p className="flex items-center gap-1 font-bold"><Users size={12} /> Koordinator:</p>
                            <p>{task.personnel.coordinator}</p>
                          </div>
                          <div>
                            <p className="flex items-center gap-1 font-bold"><Users size={12} /> Anggota:</p>
                            <p>{task.personnel.members} Orang</p>
                          </div>
                        </div>
                        
                        {task.heavyEquipment?.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-bold text-[10px] mb-1 flex items-center gap-1"><Fuel size={10} /> ALAT BERAT:</p>
                            {task.heavyEquipment.map((he, idx) => (
                              <div key={idx} className="mb-1 text-[10px]">
                                {he.type} {he.vehicle ? `- ${he.vehicle}` : ""}
                              </div>
                            ))}
                          </div>
                        )}

                        {task.equipment?.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-bold text-[10px] mb-1 flex items-center gap-1"><Wrench size={10} /> PERALATAN:</p>
                            <div className="flex flex-wrap gap-2">
                              {task.equipment.map((e, idx) => (
                                <span key={idx} className="bg-white border px-2 py-0.5 rounded text-[10px]">{e.type} ({e.quantity})</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {task.remarks && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="font-bold text-[10px] mb-1 flex items-center gap-1"><MessageSquare size={10} /> KETERANGAN KEGIATAN:</p>
                            <p className="text-[10px] italic">{task.remarks}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {['0%', '50%', '100%'].map((label, idx) => {
                        const img = idx === 0 ? task.photos.zero : idx === 1 ? task.photos.fifty : task.photos.hundred;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="aspect-[2.26/2.95] border-2 border-black bg-slate-50 overflow-hidden">
                              {img ? <img src={img} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px]">No Photo</div>}
                            </div>
                            <p className="text-center font-bold text-[10px] border-2 border-black py-1">{label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {report.remarks && (
              <div className="pt-6 border-t-2 border-black">
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Keterangan Tambahan (Umum)</p>
                <p className="text-sm italic">{report.remarks}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { padding: 0 !important; margin: 0 !important; }
          .break-after-page { page-break-after: always; }
          @page { margin: 1cm; size: portrait; }
          .bg-slate-50 { background-color: transparent !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .border { border-color: #e2e8f0 !important; }
          .border-black { border-color: #000000 !important; }
        }
      `}} />
    </div>
  );
};

export default PrintRekap;
