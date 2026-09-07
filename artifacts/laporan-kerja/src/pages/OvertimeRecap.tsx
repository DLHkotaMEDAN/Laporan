"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Edit, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { roleRequiresRegion } from '@/constants/access-control';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';
import { showError, showSuccess } from '@/utils/toast';

const OvertimeRecap = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const regionId = !isAdmin && roleRequiresRegion(profile?.role) ? profile?.region_id || '__unassigned__' : null;
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => { try { setRecords(await overtimeService.getAll(regionId)); } catch (error) { showError('Gagal memuat rekap lembur.'); } };
  useEffect(() => { void load(); }, [regionId]);
  const filtered = useMemo(() => records.filter(record => (!date || record.date === date) && (!search || `${record.name} ${record.nip} ${record.work_location}`.toLowerCase().includes(search.toLowerCase()))), [records, date, search]);
  const remove = async (id: string) => { if (!window.confirm('Hapus data lembur ini?')) return; try { await overtimeService.remove(id); setRecords(current => current.filter(record => record.id !== id)); showSuccess('Data lembur dihapus.'); } catch { showError('Gagal menghapus data lembur.'); } };

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h1 className="text-2xl font-bold text-slate-900">Rekap Lembur</h1><p className="text-sm text-slate-500">Rekap lembur berdasarkan wilayah dan tanggal.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigate('/overtime/print')}><FileText className="mr-2 h-4 w-4" /> Cetak Rekap</Button><Button onClick={() => navigate('/overtime/create')}><Plus className="mr-2 h-4 w-4" /> Tambah Lembur</Button></div></div>
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="md:w-48" /><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Cari nama, NIP, atau lokasi" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[1100px] border-collapse text-sm"><thead className="bg-slate-300"><tr>{['No', 'Nama', 'NIP', 'Jabatan', 'Lokasi Pekerjaan', 'Foto', 'Jam', 'Jumlah Kehadiran', 'Aksi'].map(header => <th key={header} className="border border-black px-3 py-3 text-center font-bold">{header}</th>)}</tr></thead><tbody>{filtered.map((record, index) => <tr key={record.id} className="hover:bg-slate-50"><td className="border border-slate-300 p-3 text-center">{index + 1}</td><td className="border border-slate-300 p-3 font-medium">{record.name}</td><td className="border border-slate-300 p-3">{record.nip}</td><td className="border border-slate-300 p-3 text-center">{record.position}</td><td className="border border-slate-300 p-3 text-center">{record.work_location}</td><td className="border border-slate-300 p-1 text-center">{record.photo_url ? <img src={record.photo_url} alt={`Dokumentasi ${record.name}`} className="mx-auto h-28 w-48 object-cover" /> : '-'}</td><td className="border border-slate-300 p-3 text-center whitespace-nowrap">{record.start_time} s/d {record.end_time}</td><td className="border border-slate-300 p-3 text-center">{record.attendance_count}</td><td className="border border-slate-300 p-2"><div className="flex justify-center gap-1"><Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/overtime/edit/${record.id}`)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Hapus" className="text-red-600" onClick={() => void remove(record.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-slate-500">Belum ada data lembur.</td></tr>}</tbody></table></div>
  </div>;
};

export default OvertimeRecap;
