import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Edit, Search, Trash2, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { roleRequiresRegion } from '@/constants/access-control';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';
import { showError, showSuccess } from '@/utils/toast';
import TotalRecordLabel from '@/components/TotalRecordLabel';
import ConfirmDialog from '@/components/ConfirmDialog';

type SortDirection = 'asc' | 'desc';
type OvertimeSortKey = 'date' | 'name' | 'nip' | 'position' | 'work_location' | 'start_time' | 'attendance_count';

const compareSortValues = (left: string | number, right: string | number) => {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'id-ID', { numeric: true, sensitivity: 'base' });
};

const OvertimeRecap = ({ recordCount }: { recordCount?: number | null }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const regionId = !isAdmin && roleRequiresRegion(profile?.role) ? profile?.region_id || '__unassigned__' : null;
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: OvertimeSortKey; direction: SortDirection } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  const load = async () => { try { setRecords(await overtimeService.getAll(regionId)); } catch (error) { showError('Gagal memuat rekap lembur.'); } };
  useEffect(() => { void load(); }, [regionId]);
  const filtered = useMemo(() => records.filter(record => (!date || record.date === date) && (!search || `${record.name} ${record.nip} ${record.work_location}`.toLowerCase().includes(search.toLowerCase()))), [records, date, search]);
  const sortedRecords = useMemo(() => [...filtered].sort((left, right) => {
    if (!sort) return 0;
    const getValue = (record: OvertimeRecord): string | number => {
      switch (sort.key) {
        case 'date': return new Date(record.date).getTime();
        case 'attendance_count': return Number(record.attendance_count || 0);
        case 'name': return record.name || '';
        case 'nip': return record.nip || '';
        case 'position': return record.position || '';
        case 'work_location': return record.work_location || '';
        case 'start_time': return `${record.start_time || ''} ${record.end_time || ''}`;
      }
    };
    const comparison = compareSortValues(getValue(left), getValue(right));
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [filtered, sort]);
  const toggleSort = (key: OvertimeSortKey) => setSort(current => ({
    key,
    direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }));
  const sortableHeader = (label: string, key: OvertimeSortKey, className = '') => {
    const active = sort?.key === key;
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ChevronUp : ChevronDown;
    return <th className={`border border-black px-3 py-3 text-center font-bold ${className}`}>
      <button type="button" onClick={() => toggleSort(key)} className="mx-auto inline-flex items-center justify-center gap-1.5 hover:text-blue-700" aria-label={`Urutkan ${label}`} title={`Urutkan ${label}`}>
        {label}<Icon className="h-3.5 w-3.5" />
      </button>
    </th>;
  };
  const regionTitle = [...new Set(filtered.map(record => record.region?.name).filter(Boolean))].join(', ') || 'Semua Wilayah';
  const teamTitle = [...new Set(filtered.map(record => record.team?.name).filter(Boolean))].join(', ') || 'Semua Tim';
  const remove = (id: string) => setDeleteConfirm({ open: true, id });

  return <><div className="space-y-5">
    <div className="recap-sticky-toolbar flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="md:w-48" /><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Cari nama, NIP, atau lokasi" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    <TotalRecordLabel count={recordCount === undefined ? records.length : recordCount} />
    <div className="space-y-2"><div className="text-center"><p className="text-sm font-bold uppercase text-slate-700">Wilayah: {regionTitle}</p><p className="text-sm font-semibold text-slate-600">Tim: {teamTitle}</p></div><div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full min-w-[1250px] border-collapse text-sm"><thead className="bg-slate-300"><tr><th className="border border-black px-3 py-3 text-center font-bold">No</th>{sortableHeader('Tanggal', 'date')}{sortableHeader('Nama', 'name')}{sortableHeader('NIP', 'nip')}{sortableHeader('Jabatan', 'position')}{sortableHeader('Lokasi Pekerjaan', 'work_location')}{['Foto Sebelum', 'Foto Sesudah'].map(header => <th key={header} className="border border-black px-3 py-3 text-center font-bold">{header}</th>)}{sortableHeader('Jam', 'start_time')}{sortableHeader('Jumlah Kehadiran', 'attendance_count')}<th className="border border-black px-3 py-3 text-center font-bold">Aksi</th></tr></thead><tbody>{sortedRecords.map((record, index) => <tr key={record.id} className="hover:bg-slate-50"><td className="border border-slate-300 p-3 text-center">{index + 1}</td><td className="border border-slate-300 p-3 text-center whitespace-nowrap">{record.date}</td><td className="border border-slate-300 p-3 font-medium">{record.name}</td><td className="border border-slate-300 p-3">{record.nip}</td><td className="border border-slate-300 p-3 text-center">{record.position}</td><td className="border border-slate-300 p-3 text-center">{record.work_location}</td><td className="border border-slate-300 p-1 text-center">{(record.photo_before_url || record.photo_url) ? <img src={record.photo_before_url || record.photo_url} alt={`Foto sebelum ${record.name}`} className="mx-auto h-28 w-48 object-cover" /> : '-'}</td><td className="border border-slate-300 p-1 text-center">{record.photo_after_url ? <img src={record.photo_after_url} alt={`Foto sesudah ${record.name}`} className="mx-auto h-28 w-48 object-cover" /> : '-'}</td><td className="border border-slate-300 p-3 text-center whitespace-nowrap">{record.start_time} s/d {record.end_time}</td><td className="border border-slate-300 p-3 text-center">{record.attendance_count}</td><td className="border border-slate-300 p-2"><div className="flex justify-center gap-1"><Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/overtime/edit/${record.id}`)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Hapus" className="text-red-600" onClick={() => void remove(record.id)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{sortedRecords.length === 0 && <tr><td colSpan={11} className="p-12 text-center text-slate-500">Belum ada data lembur.</td></tr>}</tbody></table></div></div>
  </div>
  <ConfirmDialog
    open={deleteConfirm.open}
    onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}
    title="Hapus Data Lembur"
    description="Data lembur ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
    variant="danger"
    confirmLabel="Ya, Hapus"
    onConfirm={async () => {
      try {
        await overtimeService.remove(deleteConfirm.id);
        setRecords(current => current.filter(record => record.id !== deleteConfirm.id));
        showSuccess('Data lembur dihapus.');
        setDeleteConfirm({ open: false, id: '' });
      } catch {
        showError('Gagal menghapus data lembur.');
      }
    }}
  /></>;
};

export default OvertimeRecap;
