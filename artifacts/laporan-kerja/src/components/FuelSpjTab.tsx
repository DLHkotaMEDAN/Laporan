"use client";

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Edit, Search, RefreshCw, FilterX, CalendarDays, Eye } from 'lucide-react';
import { FuelSpjReport } from '@/types/fuelSpjReport';
import { fuelSpjService } from '@/services/fuelSpjService';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';

const FuelSpjTab = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [reports, setReports] = useState<FuelSpjReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const isPimpinan = profile?.role === 'pimpinan' || (session?.user?.email === 'pimpinan@gmail.com');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fuelSpjService.getAllReports();
      setReports(data);
    } catch (error) {
      showError("Gagal memuat data SPJ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isPimpinan) return;
    if (!confirm("Hapus laporan SPJ ini?")) return;
    try {
      await fuelSpjService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      showSuccess("Laporan SPJ dihapus");
    } catch (error) {
      showError("Gagal menghapus");
    }
  };

  const filteredReports = reports.filter(r => {
    const matchSearch = r.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       r.entries.some(e => e.spj_no.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                         e.vehicle_operator.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchDate = !selectedDate || r.date === selectedDate;
    return matchSearch && matchDate;
  });

  const flatRows = filteredReports.flatMap((report, reportIndex) => {
    const entries = report.entries?.length ? report.entries : [{ spj_no: "-", vehicle_operator: "-", receiver_name: "-", locations: [] }];
    return entries.map((entry, entryIndex) => ({ report, reportIndex, entry, entryIndex, totalEntries: entries.length }));
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Cari No. SPJ / Wilayah / Kendaraan</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Ketik kata kunci..." 
                className="pl-10 bg-slate-50 border-slate-200 h-10 text-sm" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="lg:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Filter Tanggal</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                type="date"
                className="pl-10 bg-slate-50 border-slate-200 h-10 text-sm" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => { setSearchQuery(""); setSelectedDate(""); }}
              className="h-10 w-10 shrink-0 border-slate-200 text-slate-400 hover:text-red-500"
            >
              <FilterX size={18} />
            </Button>

            <Button variant="outline" size="icon" onClick={loadReports} disabled={loading} className="h-10 w-10 shrink-0 border-slate-200">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
          <p className="text-slate-500 text-sm font-medium">Memuat data SPJ...</p>
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-slate-700 text-white">
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-12">No</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-28">Tanggal</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-36">Wilayah</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-32">No. SPJ</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Kendaraan / Operator</th>
                  <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Penerima</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-20">Lokasi</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row) => (
                  <tr
                    key={`${row.report.id}-${row.entryIndex}`}
                    className={cn(row.reportIndex % 2 === 0 ? "bg-white" : "bg-slate-50/70", "hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-100")}
                    onClick={() => navigate(`/fuel-reports/spj/${row.report.id}`)}
                  >
                    {row.entryIndex === 0 && (
                      <>
                        <td rowSpan={row.totalEntries} className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100 align-middle">{row.reportIndex + 1}</td>
                        <td rowSpan={row.totalEntries} className="px-3 py-3 text-center font-medium text-slate-700 border-r border-slate-100 align-middle whitespace-nowrap">{row.report.date}</td>
                        <td rowSpan={row.totalEntries} className="px-3 py-3 border-r border-slate-100 align-middle">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] whitespace-nowrap">{row.report.region}</Badge>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3 font-semibold text-slate-800 border-r border-slate-100">{row.entry.spj_no}</td>
                    <td className="px-3 py-3 text-slate-700 border-r border-slate-100 max-w-[240px]"><span className="line-clamp-2">{row.entry.vehicle_operator}</span></td>
                    <td className="px-3 py-3 text-slate-600 border-r border-slate-100 max-w-[200px]"><span className="line-clamp-2">{row.entry.receiver_name}</span></td>
                    <td className="px-3 py-3 text-center font-mono text-slate-700 border-r border-slate-100">{row.entry.locations?.length || 0}</td>
                    {row.entryIndex === 0 && (
                      <td rowSpan={row.totalEntries} className="px-2 py-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); navigate(`/fuel-reports/spj/${row.report.id}`); }}><Eye size={13} /></Button>
                          {!isPimpinan && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); navigate(`/fuel-reports/spj/edit/${row.report.id}`); }}><Edit size={13} /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={(e) => handleDelete(e, row.report.id)}><Trash2 size={13} /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t bg-slate-50 text-xs text-slate-500">
            <strong className="text-slate-700">{filteredReports.length}</strong> laporan SPJ Â· <strong className="text-slate-700">{flatRows.length}</strong> entry ditampilkan
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
          <Search className="mx-auto h-8 w-8 text-slate-200 mb-2" />
          <p className="text-sm">Tidak ada laporan SPJ ditemukan</p>
        </div>
      )}
    </div>
  );
};

export default FuelSpjTab;
