"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkPlan, WorkPlanItem } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PimpinanNoteSection from '@/components/PimpinanNoteSection';
import { useAuth } from '@/context/AuthContext';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { getUniqueWorkPlanItems } from '@/utils/work-plan-display';

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

const PrintWorkPlan = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [plan, setPlan] = useState<WorkPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = !!session;
  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');

  useEffect(() => {
    if (id) loadPlan(id);
  }, [id]);

  const loadPlan = async (planId: string) => {
    try {
      setLoading(true);
      const data = await workPlanService.getWorkPlanById(planId);
      setPlan(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!plan) return;
    await workPlanService.updateWorkPlan(plan.id, { pimpinan_note: note });
    setPlan({ ...plan, pimpinan_note: note });
  };

  const handleDelete = async () => {
    if (!id || isPimpinan) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus rencana kerja ini?")) {
      try {
        await workPlanService.deleteWorkPlan(id);
        showSuccess("Rencana kerja berhasil dihapus");
        navigate('/work-plans');
      } catch (error) {
        showError("Gagal menghapus data");
      }
    }
  };

  if (loading) return <div className="p-20 text-center">Menyiapkan dokumen...</div>;
  if (!plan) return null;

  const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
  const hasRemarks = plan.items.some(item => item.remarks && item.remarks.trim() !== "");
  const isGlobalStyle = plan.category === "Tim Babat";
  const displayItems = getUniqueWorkPlanItems(plan.items);

  const getSpans = (items: WorkPlanItem[], keyExtractor: (item: WorkPlanItem) => string) => {
    const spans: number[] = [];
    let i = 0;
    while (i < items.length) {
      let j = i + 1;
      const currentKey = keyExtractor(items[i]);
      while (j < items.length && keyExtractor(items[j]) === currentKey) {
        j++;
      }
      const count = j - i;
      for (let k = 0; k < count; k++) spans.push(k === 0 ? count : 0);
      i = j;
    }
    return spans;
  };

  const toolSpans = getSpans(displayItems, (it) => JSON.stringify(it.tools));
  const teamSpans = getSpans(displayItems, (it) => `${it.coordinator}|${it.personnel.members}|${it.basis}`);
  const getRowsInItems = (items: WorkPlanItem[]) => (
    items.reduce((acc, it) => acc + Math.max(it.tools.length, 1), 0)
  );

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 no-print mb-8 p-4 bg-white rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/work-plans')} className="px-2 md:px-4 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
            </Button>
            <h1 className="font-bold text-sm md:text-base">Preview Cetak Rencana Kerja</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {isLoggedIn && !isPimpinan && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/work-plans/edit/${plan.id}`)}
                  className="h-9 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Edit</span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDelete}
                  className="h-9 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Hapus</span>
                </Button>
              </>
            )}
            <Button onClick={() => window.print()} className="bg-blue-600 px-2 md:px-4 h-9">
              <Printer className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Cetak</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto mb-6">
        <PimpinanNoteSection 
          initialNote={plan.pimpinan_note} 
          onSave={handleSaveNote} 
        />
      </div>

      <div className="print-container bg-white p-10 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
          <img src={LOGO_MEDAN_URL} className="h-20 w-20 object-contain" alt="Logo Medan" />
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase">Pemerintah Kota Medan</h1>
            <h2 className="text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2>
            <p className="text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p>
          </div>
          <img src={LOGO_DLH_URL} className="h-20 w-20 object-contain" alt="Logo DLH" />
        </div>

        <div className="text-center mb-6">
          <h3 className="text-lg font-bold underline uppercase">RENCANA KERJA WILAYAH 4 DLH MEDAN KOTA</h3>
          <p className="font-bold">Tanggal: {new Date(plan.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <table className="w-full border-collapse border-2 border-black text-[10px] table-fixed">
          <thead>
            <tr className="bg-slate-100">
              <th className="border-2 border-black p-1 w-[30px]">No</th>
              <th className="border-2 border-black p-1 w-[60px]">Tim/ Kec</th>
              <th className="border-2 border-black p-1 w-[120px]">Detail Kegiatan</th>
              <th className="border-2 border-black p-1 w-[140px]">Lokasi</th>
              <th className="border-2 border-black p-1 w-[110px]">Alat Operasional</th>
              <th className="border-2 border-black p-1 w-[40px]">Unit</th>
              <th className="border-2 border-black p-1 w-[100px]">Kegunaan</th>
              <th className="border-2 border-black p-1 w-[80px]">Koordinator</th>
              <th className="border-2 border-black p-1 w-[50px]">Personil</th>
              <th className="border-2 border-black p-1 w-[100px]">Dasar Pengerjaan</th>
              {hasRemarks && <th className="border-2 border-black p-1 w-[100px]">Keterangan</th>}
            </tr>
          </thead>
          <tbody>
            {isNoActivity ? (
              <tr>
                <td className="border-2 border-black p-1 text-center">1</td>
                <td className="border-2 border-black p-1 text-center font-bold">{plan.category}</td>
                <td colSpan={8} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">
                  TIDAK ADA RENCANA KERJA/ KEGIATAN
                </td>
                {hasRemarks && <td className="border-2 border-black p-1 italic align-top break-words">{plan.items[0]?.remarks || "-"}</td>}
              </tr>
            ) : isGlobalStyle ? (
              (() => {
                const allTools = displayItems[0].tools;
                const allItems = displayItems;
                const maxRows = Math.max(allItems.length, allTools.length);
                return Array.from({ length: maxRows }).map((_, rowIndex) => {
                  const item = allItems[rowIndex];
                  return (
                    <tr key={`global-${rowIndex}`}>
                      {rowIndex === 0 && (
                        <>
                          <td className="border-2 border-black p-1 text-center align-top" rowSpan={maxRows}>1</td>
                          <td className="border-2 border-black p-1 text-center font-bold align-top" rowSpan={maxRows}>{plan.category}</td>
                        </>
                      )}
                      
                      {item && (
                        <>
                          <td className="border-2 border-black p-1 align-top break-words" rowSpan={rowIndex === allItems.length - 1 ? maxRows - rowIndex : 1}>
                            {item.description}
                          </td>
                          <td className="border-2 border-black p-1 align-top break-words" rowSpan={rowIndex === allItems.length - 1 ? maxRows - rowIndex : 1}>
                            {item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}
                          </td>
                        </>
                      )}

                      {rowIndex === 0 && (
                        <>
                          <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxRows}>
                            {allTools.map((t, i) => (
                              <div key={i} className={i > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                                {t.name ? `• ${t.name}` : "-"}
                              </div>
                            ))}
                          </td>
                          <td className="border-2 border-black p-1 text-center align-top" rowSpan={maxRows}>
                            {allTools.map((t, i) => (
                              <div key={i} className={i > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                                {t.unit || "-"}
                              </div>
                            ))}
                          </td>
                          <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxRows}>
                            {allTools.map((t, i) => (
                              <div key={i} className={i > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                                {t.usage || "-"}
                              </div>
                            ))}
                          </td>
                          <td className="border-2 border-black p-1 text-center align-top" rowSpan={maxRows}>{displayItems[0].coordinator}</td>
                          <td className="border-2 border-black p-1 text-center align-top" rowSpan={maxRows}>{displayItems[0].personnel.members} Org</td>
                          <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxRows}>{displayItems[0].basis}</td>
                          {hasRemarks && <td className="border-2 border-black p-1 italic align-top break-words" rowSpan={maxRows}>{displayItems[0].remarks || "-"}</td>}
                        </>
                      )}
                    </tr>
                  );
                });
              })()
            ) : (
              displayItems.flatMap((item, itemIdx) => {
                const toolsToRender = item.tools.length > 0 ? item.tools : [{ name: "", unit: "", usage: "" }];
                const toolSpan = toolSpans[itemIdx];
                const teamSpan = teamSpans[itemIdx];

                return toolsToRender.map((tool, toolIdx) => (
                  <tr key={`${itemIdx}-${toolIdx}`}>
                    {itemIdx === 0 && toolIdx === 0 && (
                      <>
                        <td className="border-2 border-black p-1 text-center align-top" rowSpan={displayItems.reduce((acc, it) => acc + Math.max(it.tools.length, 1), 0)}>1</td>
                        <td className="border-2 border-black p-1 text-center font-bold align-top" rowSpan={displayItems.reduce((acc, it) => acc + Math.max(it.tools.length, 1), 0)}>{plan.category}</td>
                      </>
                    )}
                    
                    {toolIdx === 0 && (
                      <>
                        <td className="border-2 border-black p-1 align-top break-words" rowSpan={Math.max(item.tools.length, 1)}>
                          {item.description}
                        </td>
                        <td className="border-2 border-black p-1 align-top break-words" rowSpan={Math.max(item.tools.length, 1)}>
                          {item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}
                        </td>
                      </>
                    )}

                    {toolSpan > 0 && toolIdx === 0 ? (
                      <>
                        <td className="border-2 border-black p-1 align-top break-words" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                          {item.tools.map((t, ti) => (
                            <div key={ti} className={ti > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                              {t.name ? `• ${t.name}` : "-"}
                            </div>
                          ))}
                        </td>
                        <td className="border-2 border-black p-1 text-center align-top" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                          {item.tools.map((t, ti) => (
                            <div key={ti} className={ti > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                              {t.unit || "-"}
                            </div>
                          ))}
                        </td>
                        <td className="border-2 border-black p-1 align-top break-words" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + toolSpan))}>
                          {item.tools.map((t, ti) => (
                            <div key={ti} className={ti > 0 ? "mt-1 border-t border-slate-200 pt-1" : ""}>
                              {t.usage || "-"}
                            </div>
                          ))}
                        </td>
                      </>
                    ) : null}
                    {teamSpan > 0 && toolIdx === 0 && (
                      <>
                        <td className="border-2 border-black p-1 text-center align-top" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + teamSpan))}>
                          {item.coordinator}
                        </td>
                        <td className="border-2 border-black p-1 text-center align-top" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + teamSpan))}>
                          {item.personnel.members} Org
                        </td>
                        <td className="border-2 border-black p-1 align-top break-words" rowSpan={getRowsInItems(displayItems.slice(itemIdx, itemIdx + teamSpan))}>
                          {item.basis}
                        </td>
                      </>
                    )}
                    {hasRemarks && toolIdx === 0 && (
                      <td className="border-2 border-black p-1 italic align-top break-words" rowSpan={Math.max(item.tools.length, 1)}>
                        {item.remarks || "-"}
                      </td>
                    )}
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>

        <div className="mt-12 flex justify-end">
          <div className="text-center w-64">
            <p>Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold mt-1">Koordinator Wilayah 4</p>
            <div className="h-20"></div>
            <p className="font-bold underline">( ............................................ )</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
          @page { size: landscape; margin: 1cm; }
          table { border-color: black !important; }
          th, td { border-color: black !important; }
        }
      `}} />
    </div>
  );
};

export default PrintWorkPlan;
