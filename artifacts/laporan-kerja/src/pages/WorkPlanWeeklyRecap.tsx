"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkPlan, WorkPlanItem } from '@/types/workPlan';
import { workPlanService } from '@/services/workPlanService';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Calendar as CalendarIcon, PenTool, Plus, ChevronDown, Table, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { sortByCategory } from '@/utils/report-helpers';
import { getUniqueWorkPlanItems } from '@/utils/work-plan-display';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getLogoUrl = (fileName: string) => {
  const { data } = supabase.storage.from('assets').getPublicUrl(fileName);
  return data.publicUrl;
};

const LOGO_MEDAN_URL = getLogoUrl('logo-medan.jpg');
const LOGO_DLH_URL = getLogoUrl('logo-dlh.jpg');

type SignatureMode = "with-signature" | "without-signature";

interface ResourceGroup {
  items: WorkPlanItem[];
  tools: any[];
  coordinator: string;
  members: number;
  basis: string;
  remarks: string;
}

const WorkPlanWeeklyRecap = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("with-signature");
  
  const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const isLoggedIn = !!session;

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await workPlanService.getAllWorkPlans();
      const filtered = data.filter(p => {
        const pDate = parseISO(p.date);
        return isWithinInterval(pDate, { start: weekStart, end: weekEnd }) && p.is_visible !== false;
      });
      
      filtered.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return sortByCategory(a.category, b.category);
      });
      
      setPlans(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const hasRemarks = plans.some(plan => plan.items.some(item => item.remarks && item.remarks.trim() !== ""));
  
  const categoriesInPlans = Array.from(new Set(plans.map(p => p.category)));
  const showTiurmaida = categoriesInPlans.some(c => ["Taman Kota", "Taman Amplas", "Taman Area", "Tim Babat", "Tim Siram"].includes(c));
  const showArdiansyah = categoriesInPlans.some(c => ["Tim Pohon"].includes(c));

  const groupPlanResources = (plan: WorkPlan): ResourceGroup[] => {
    const groups: ResourceGroup[] = [];
    getUniqueWorkPlanItems(plan.items).forEach((item) => {
      const itemToolsJson = JSON.stringify(item.tools);
      const lastGroup = groups[groups.length - 1];
      const isSameResource = lastGroup && 
        JSON.stringify(lastGroup.tools) === itemToolsJson && 
        lastGroup.coordinator === item.coordinator &&
        lastGroup.members === item.personnel.members &&
        lastGroup.basis === item.basis;

      if (isSameResource) {
        lastGroup.items.push(item);
      } else {
        groups.push({
          items: [item],
          tools: item.tools,
          coordinator: item.coordinator,
          members: item.personnel.members,
          basis: item.basis,
          remarks: item.remarks
        });
      }
    });
    return groups;
  };

  const getResourceSpans = (groups: ResourceGroup[]) => {
    const spans: number[] = [];
    let i = 0;
    while (i < groups.length) {
      let j = i + 1;
      const currentKey = `${groups[i].coordinator}|${groups[i].members}|${groups[i].basis}`;
      while (j < groups.length && `${groups[j].coordinator}|${groups[j].members}|${groups[j].basis}` === currentKey) {
        j++;
      }
      const count = j - i;
      for (let k = 0; k < count; k++) spans.push(k === 0 ? count : 0);
      i = j;
    }
    return spans;
  };

  const getRowsInGroups = (groups: ResourceGroup[]) => (
    groups.reduce((acc, group) => acc + Math.max(group.items.length, group.tools.length, 1), 0)
  );

  const getTableSpans = () => {
    const noSpans: number[] = [];
    const dateSpans: number[] = [];
    let currentNo = 0;
    let lastDate = "";
    
    const rows: any[] = [];
    plans.forEach((plan) => {
      const isNoActivity = plan.items[0]?.description === "TIDAK ADA RENCANA KERJA/ KEGIATAN";
      if (isNoActivity) {
        rows.push({ plan, isNoActivity: true, date: plan.date });
      } else {
        const resourceGroups = groupPlanResources(plan);
        const resourceSpans = getResourceSpans(resourceGroups);
        resourceGroups.forEach((group, groupIndex) => {
          const maxGroupRows = Math.max(group.items.length, group.tools.length, 1);
          const sharedResourceRows = resourceSpans[groupIndex] > 0
            ? getRowsInGroups(resourceGroups.slice(groupIndex, groupIndex + resourceSpans[groupIndex]))
            : 0;
          for (let i = 0; i < maxGroupRows; i++) {
            rows.push({ plan, group, rowIndex: i, maxGroupRows, date: plan.date, showSharedResource: i === 0 && resourceSpans[groupIndex] > 0, sharedResourceRows });
          }
        });
      }
    });

    rows.forEach((row, idx) => {
      if (row.date !== lastDate) {
        currentNo++;
        lastDate = row.date;
        const sameDateRows = rows.filter(r => r.date === row.date);
        noSpans[idx] = sameDateRows.length;
        dateSpans[idx] = sameDateRows.length;
      } else {
        noSpans[idx] = 0;
        dateSpans[idx] = 0;
      }
    });

    return { rows, noSpans, dateSpans };
  };

  const { rows, noSpans, dateSpans } = getTableSpans();

  const colGroup = (
    <colgroup>
      <col style={{ width: '30px' }} />
      <col style={{ width: '60px' }} />
      <col style={{ width: '60px' }} />
      <col style={{ width: '120px' }} />
      <col style={{ width: '130px' }} />
      <col style={{ width: '120px' }} />
      <col style={{ width: '30px' }} />
      <col style={{ width: '100px' }} />
      <col style={{ width: '80px' }} />
      <col style={{ width: '40px' }} />
      <col style={{ width: '100px' }} />
      {hasRemarks && <col style={{ width: '100px' }} />}
    </colgroup>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-0 md:p-8">
      <div className="max-w-[1200px] mx-auto space-y-4 no-print mb-8 p-4 bg-white rounded-xl shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => navigate('/work-plans')} className="px-2 md:px-4 h-9">
              <ArrowLeft className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Kembali</span>
            </Button>
            <div className="relative">
              <CalendarIcon className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-slate-400" />
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-7 md:pl-10 w-[130px] md:w-[180px] h-10 text-xs md:text-sm" />
            </div>
            <div className="text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 px-2 md:px-3 py-2 rounded-md border border-blue-100">
              {format(weekStart, 'dd MMM', { locale: localeId })} - {format(weekEnd, 'dd MMM yy', { locale: localeId })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0">
            <Select value={signatureMode} onValueChange={(v) => setSignatureMode(v as SignatureMode)}>
              <SelectTrigger className="w-[40px] md:w-[180px] bg-amber-50 border-amber-200 h-10 text-amber-700 font-medium p-0 md:px-3 flex justify-center">
                <div className="flex items-center gap-2">
                  <PenTool size={16} />
                  <span className="hidden md:inline"><SelectValue placeholder="Tanda Tangan" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with-signature">Ada Tanda Tangan</SelectItem>
                <SelectItem value="without-signature">Tanpa Tanda Tangan</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200 h-10 px-2 md:px-4">
                  <Printer className="h-4 w-4 md:mr-2" /> 
                  <span className="hidden md:inline">Cetak Rekap</span>
                  <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => window.print()} className="cursor-pointer py-2">
                  <Printer className="mr-2 h-4 w-4 text-blue-600" /> Cetak Halaman Ini
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                <DropdownMenuItem onClick={() => navigate('/work-plans/daily-rekap')} className="cursor-pointer py-2">
                  <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" /> Rekap Harian
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/work-plans/weekly-rekap')} className="cursor-pointer py-2">
                  <Table className="mr-2 h-4 w-4 text-green-600" /> Rekap Mingguan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/work-plans/monthly-rekap')} className="cursor-pointer py-2">
                  <FileText className="mr-2 h-4 w-4 text-orange-600" /> Rekap Bulanan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {isLoggedIn && (
              <Button onClick={() => navigate('/work-plans/create')} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-2 md:px-4 h-10">
                <Plus className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Tambah Baru</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="print-area bg-white p-10 mx-auto shadow-lg border min-h-[210mm] w-full max-w-[297mm]">
        <div className="flex items-center justify-center gap-8 border-b-4 border-double border-black pb-4 mb-6">
          <img src={LOGO_MEDAN_URL} className="h-20 w-20 object-contain" alt="Logo Medan" />
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase">Pemerintah Kota Medan</h1>
            <h2 className="text-2xl font-black uppercase">Dinas Lingkungan Hidup</h2>
            <p className="text-xs italic">Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara</p>
          </div>
          <img src={LOGO_DLH_URL} className="h-20 w-20 object-contain" alt="Logo DLH" />
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-bold underline uppercase">RENCANA KERJA WILAYAH 4 DLH MEDAN KOTA</h3>
          <p className="text-lg font-bold">Periode: {format(weekStart, 'dd MMMM', { locale: localeId })} s/d {format(weekEnd, 'dd MMMM yyyy', { locale: localeId })}</p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          {plans.length > 0 ? (
            <>
              <table className="w-full border-collapse border-2 border-black text-[9px] table-fixed print:w-full print:min-w-0">
                {colGroup}
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-2 border-black p-1">No</th>
                    <th className="border-2 border-black p-1">Hari/Tgl</th>
                    <th className="border-2 border-black p-1">Tim/Kec</th>
                    <th className="border-2 border-black p-1">Detail Kegiatan</th>
                    <th className="border-2 border-black p-1">Lokasi</th>
                    <th className="border-2 border-black p-1">Alat Operasional</th>
                    <th className="border-2 border-black p-1">Unit</th>
                    <th className="border-2 border-black p-1">Kegunaan</th>
                    <th className="border-2 border-black p-1">Koordinator</th>
                    <th className="border-2 border-black p-1">Pers</th>
                    <th className="border-2 border-black p-1">Dasar Pengerjaan</th>
                    {hasRemarks && <th className="border-2 border-black p-1">Keterangan</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let currentNo = 0;
                    let lastDate = "";
                    return rows.map((row, idx) => {
                      if (row.date !== lastDate) {
                        currentNo++;
                        lastDate = row.date;
                      }
                      
                      if (row.isNoActivity) {
                        return (
                          <tr key={`no-act-${idx}`}>
                            {noSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-top font-bold" rowSpan={noSpans[idx]}>{currentNo}</td>}
                            {dateSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-top text-[8px]" rowSpan={dateSpans[idx]}>{format(parseISO(row.date), 'eee, dd/MM', { locale: localeId })}</td>}
                            <td className="border-2 border-black p-1 text-center font-bold">{row.plan.category}</td>
                            <td colSpan={8} className="border-2 border-black p-4 text-center font-black text-sm tracking-widest">TIDAK ADA RENCANA KERJA/ KEGIATAN</td>
                            {hasRemarks && <td className="border-2 border-black p-1 italic align-top break-words">{row.plan.items[0]?.remarks || "-"}</td>}
                          </tr>
                        );
                      }

                      const { plan, group, rowIndex, maxGroupRows } = row;
                      const item = group.items[rowIndex];
                      const tool = group.tools[rowIndex];
                      const planRows = rows.filter(r => r.plan?.id === plan.id);
                      const isFirstInPlan = planRows[0] === row;

                      return (
                        <tr key={`row-${idx}`}>
                          {noSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-top font-bold" rowSpan={noSpans[idx]}>{currentNo}</td>}
                          {dateSpans[idx] > 0 && <td className="border-2 border-black p-1 text-center align-top text-[8px]" rowSpan={dateSpans[idx]}>{format(parseISO(row.date), 'eee, dd/MM', { locale: localeId })}</td>}
                          {isFirstInPlan && <td className="border-2 border-black p-1 text-center font-bold align-top" rowSpan={planRows.length}>{plan.category}</td>}
                          
                          {rowIndex < group.items.length - 1 ? (
                            <>
                              <td className="border-2 border-black p-1 align-top break-words">{item.description}</td>
                              <td className="border-2 border-black p-1 align-top break-words">{item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}</td>
                            </>
                          ) : rowIndex === group.items.length - 1 ? (
                            <>
                              <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxGroupRows - rowIndex}>{item.description}</td>
                              <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxGroupRows - rowIndex}>{item.location.street}, {Array.isArray(item.location.village) ? item.location.village.join(", ") : item.location.village}, {item.location.subDistrict}</td>
                            </>
                          ) : null}

                          {rowIndex < group.tools.length - 1 ? (
                            <>
                              <td className="border-2 border-black p-1 align-top break-words">{tool?.name ? `• ${tool.name}` : ""}</td>
                              <td className="border-2 border-black p-1 text-center align-top">{tool?.unit || ""}</td>
                              <td className="border-2 border-black p-1 align-top break-words">{tool?.usage || ""}</td>
                            </>
                          ) : rowIndex === group.tools.length - 1 || (group.tools.length === 0 && rowIndex === 0) ? (
                            <>
                              <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxGroupRows - rowIndex}>{tool?.name ? `• ${tool.name}` : ""}</td>
                              <td className="border-2 border-black p-1 text-center align-top" rowSpan={maxGroupRows - rowIndex}>{tool?.unit || ""}</td>
                              <td className="border-2 border-black p-1 align-top break-words" rowSpan={maxGroupRows - rowIndex}>{tool?.usage || ""}</td>
                            </>
                          ) : null}

                          {row.showSharedResource && (
                            <>
                              <td className="border-2 border-black p-1 text-center align-top" rowSpan={row.sharedResourceRows}>{group.coordinator}</td>
                              <td className="border-2 border-black p-1 text-center align-top" rowSpan={row.sharedResourceRows}>{group.members}</td>
                              <td className="border-2 border-black p-1 align-top break-words" rowSpan={row.sharedResourceRows}>{group.basis}</td>
                            </>
                          )}
                          {rowIndex === 0 && hasRemarks && <td className="border-2 border-black p-1 italic align-top break-words" rowSpan={maxGroupRows}>{group.remarks || "-"}</td>}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {signatureMode === "with-signature" && (
                <div className="pdf-footer mt-12 keep-together">
                  <div className="flex justify-end mb-4 text-[11px]"><p className="w-1/4 text-center">Medan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                  <div className="grid grid-cols-4 gap-4 text-[11px] leading-normal">
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Mengetahui :</p><p className="font-bold">Kabid Tata Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Heni Rustati, ST, M.Si</p><p>NIP. 19720223 200604 2 002</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Ketua Tim Pemeliharaan Lingkungan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Anitha Florida Ginting, ST, M. Si</p><p>NIP. 19811128 201001 2 011</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4"><div><p>Diketahui :</p><p className="font-bold">Pengawas Taman Penghijauan</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></div><div><p className="font-bold underline">Jhosua Sibarani, S.T</p><p>NIP. 19740907 200903 1 002</p></div></div>
                    <div className="text-center flex flex-col justify-between min-h-[200px] pb-4">
                      <div>
                        <p>Diketahui :</p>
                        {showTiurmaida && !showArdiansyah && (<><p className="font-bold">Kepala Koordinator Taman</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                        {showArdiansyah && !showTiurmaida && (<><p className="font-bold">Koordinator Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                        {showTiurmaida && showArdiansyah && (<><p className="font-bold">Koordinator Taman & Tim Pohon</p><p>Dinas Lingkungan Hidup</p><p>Kota Medan</p></>)}
                      </div>
                      <div>
                        {showTiurmaida && !showArdiansyah && (<><p className="font-bold underline">Tiurmaida Silitonga</p><p>NIP. 19690507 200701 2 042</p></>)}
                        {showArdiansyah && !showTiurmaida && (<><p className="font-bold underline">Ardiansyah Siregar</p><p>NIP. 19860404 201001 1 015</p></>)}
                        {showTiurmaida && showArdiansyah && (
                          <div className="flex justify-around gap-2">
                            <div><p className="font-bold underline">Tiurmaida Silitonga</p><p className="text-[9px]">NIP. 19690507 200701 2 042</p></div>
                            <div><p className="font-bold underline">Ardiansyah Siregar</p><p className="text-[9px]">NIP. 19860404 201001 1 015</p></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <table className="w-full border-collapse border-2 border-black text-[11px] table-fixed">
              <tbody>
                <tr><td colSpan={20} className="border-2 border-black p-12 text-center text-slate-400 italic text-lg">Tidak ada data laporan untuk periode ini</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print, [data-radix-portal], [role="menu"], [data-radix-popper-content-wrapper], .sonner-toaster { 
            display: none !important; 
            visibility: hidden !important;
          }
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
          .overflow-x-auto { overflow: visible !important; }
          table { width: 100% !important; }
          .keep-together { page-break-inside: avoid; break-inside: avoid; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />
    </div>
  );
};

export default WorkPlanWeeklyRecap;
