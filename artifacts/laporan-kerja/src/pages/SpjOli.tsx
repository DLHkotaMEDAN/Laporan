"use client";

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Edit, FilterX, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { useValueDraft } from '@/hooks/useFormDraft';
import { spjOliService } from '@/services/spjOliService';
import { workPlanService } from '@/services/workPlanService';
import { SpjOliRecord } from '@/types/spjOli';
import { WorkPlan } from '@/types/workPlan';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { isSpjOliAdmin } from '@/constants/access-control';

const emptyRecord = { date: new Date().toISOString().slice(0, 10), region_id: '', team_id: '', spj_number: '', vehicle_name: '', receiver_name: '', operator_name: '', oil_name: '', quantity: 0, unit: 'Liter', location: '', remarks: '' };
const canAccess = (role?: string) => ['admin', 'admin_spj_bbm', 'admin_spj_oli', 'pimpinan'].includes(role || '');
const defaultOilOptions = ['Oli Hydraulic', 'Oli Mesin', 'Minyak Rem'];

const getNextSpjNumber = (value: string) => value.replace(/^(\d+)/, (_, number: string) => String(Number(number) + 1).padStart(number.length, '0'));

type SpjOliFormValues = typeof emptyRecord;

const SpjOliInputForm = ({ form, regions, teams, selectedTeam, savedRecords, vehicleOptions, editable, editing, regionLocked, onChange, onSubmit, onCancel }: {
  form: SpjOliFormValues;
  regions: { id: string; name: string }[];
  teams: { id: string; region_id: string; name: string }[];
  selectedTeam?: { id: string; region_id: string; name: string };
  savedRecords: SpjOliRecord[];
  vehicleOptions: string[];
  editable: boolean;
  editing: boolean;
  regionLocked: boolean;
  onChange: (key: keyof SpjOliFormValues, value: string | number) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) => (
  <main className="min-h-screen bg-slate-50 p-4 md:p-8">
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <datalist id="spj-oli-number-options">{Array.from(new Set(savedRecords.map(record => record.spj_number).filter(Boolean))).map(value => <option key={value} value={value} />)}</datalist>
      <datalist id="spj-oli-vehicle-options">{vehicleOptions.map(value => <option key={value} value={value} />)}</datalist>
      <datalist id="spj-oli-operator-options">{Array.from(new Set(savedRecords.map(record => record.operator_name).filter((value): value is string => Boolean(value)))).map(value => <option key={value} value={value} />)}</datalist>
      <datalist id="spj-oli-oil-options">{Array.from(new Set([...defaultOilOptions, ...savedRecords.map(record => record.oil_name).filter(Boolean)])).map(value => <option key={value} value={value} />)}</datalist>
      <datalist id="spj-oli-location-options">{Array.from(new Set(savedRecords.map(record => record.location).filter((value): value is string => Boolean(value)))).map(value => <option key={value} value={value} />)}</datalist>
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-black">{editing ? 'Edit' : 'Input'} SPJ Oli</h1><p className="text-sm text-slate-500">Wilayah dan Tim menggunakan master yang tersedia. Draf tersimpan sementara di perangkat ini.</p></div><Button type="button" variant="outline" onClick={onCancel}>Kembali</Button></div>
      <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold">Tanggal<Input type="date" value={form.date} onChange={e => onChange('date', e.target.value)} /></label>
        <label className="space-y-1 text-sm font-semibold">Nomor SPJ<Input list="spj-oli-number-options" value={form.spj_number} onChange={e => onChange('spj_number', e.target.value)} />{(() => { const lastSpjNumber = [...savedRecords].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0]?.spj_number?.trim(); return lastSpjNumber ? <span className="block rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-800">Nomor SPJ terakhir: <b>{lastSpjNumber}</b>. Nomor lanjutan: <b>{getNextSpjNumber(lastSpjNumber)}</b></span> : null; })()}</label>
        <label className="space-y-1 text-sm font-semibold">Wilayah<Select value={form.region_id} onValueChange={value => { onChange('region_id', value); onChange('team_id', ''); }} disabled={regionLocked}><SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger><SelectContent>{regions.map(region => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1 text-sm font-semibold">Tim / Operator<Select value={form.team_id} onValueChange={value => onChange('team_id', value)} disabled={!form.region_id}><SelectTrigger><SelectValue placeholder="Pilih Tim / Operator" /></SelectTrigger><SelectContent>{[...teams.filter(team => team.region_id === form.region_id), ...(selectedTeam && !teams.some(team => team.id === selectedTeam.id) ? [selectedTeam] : [])].map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></label>
        <label className="space-y-1 text-sm font-semibold">Alat Operasional / Kendaraan<Input list="spj-oli-vehicle-options" value={form.vehicle_name} onChange={e => onChange('vehicle_name', e.target.value)} placeholder="Pilih atau ketik kendaraan" /></label>
        <label className="space-y-1 text-sm font-semibold">Nama Operator / Pengemudi / Penerima<Input list="spj-oli-operator-options" value={form.operator_name} onChange={e => onChange('operator_name', e.target.value)} placeholder="Nama operator, pengemudi, atau penerima" /></label>
        <label className="space-y-1 text-sm font-semibold">Jenis Oli / Minyak Rem<Input list="spj-oli-oil-options" value={form.oil_name} onChange={e => onChange('oil_name', e.target.value)} placeholder="Pilih atau ketik jenis oli / minyak rem" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm font-semibold">Jumlah<Input type="number" min="0" step="0.01" value={form.quantity} onChange={e => onChange('quantity', e.target.valueAsNumber || 0)} /></label><label className="space-y-1 text-sm font-semibold">Satuan<Select value={form.unit} onValueChange={value => onChange('unit', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Liter">Liter</SelectItem><SelectItem value="Botol">Botol</SelectItem><SelectItem value="Pcs">Pcs</SelectItem></SelectContent></Select></label></div>
        <label className="space-y-1 text-sm font-semibold md:col-span-2">Lokasi<Input list="spj-oli-location-options" value={form.location} onChange={e => onChange('location', e.target.value)} placeholder="Lokasi penggunaan oli" /></label>
        <label className="space-y-1 text-sm font-semibold md:col-span-2">Keterangan<Input value={form.remarks} onChange={e => onChange('remarks', e.target.value)} placeholder="Keterangan tambahan (opsional)" /></label>
      </section>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Batal</Button><Button disabled={!editable} type="submit" className="bg-emerald-600 hover:bg-emerald-700">Simpan SPJ Oli</Button></div>
    </form>
  </main>
);

export default function SpjOli() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { profile, session } = useAuth();
  const isRegionalSpjOliAdmin = isSpjOliAdmin(profile?.role) && Boolean(profile?.region_id);
  const lockedRegionId = isRegionalSpjOliAdmin ? profile?.region_id || '' : '';
  const editable = profile?.is_active !== false && profile?.role !== 'pimpinan' && session?.user?.email !== 'pimpinan@gmail.com';
  const [records, setRecords] = useState<SpjOliRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState('semua');
  const [teamId, setTeamId] = useState('semua');
  const [date, setDate] = useState('');
  const [form, setForm] = useState(emptyRecord);
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; region_id: string; name: string }>();
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const isForm = window.location.pathname.endsWith('/create') || Boolean(id);
  const draftKey = isForm && session?.user?.id ? `spj-oli:${session.user.id}:${id ?? 'new'}` : undefined;
  const { clearDraft, isReady: isDraftReady, restoredAt } = useValueDraft(
    form,
    values => setForm({ ...emptyRecord, ...values }),
    draftKey,
  );
  const teamFilterRegion = isForm && form.region_id ? form.region_id : (lockedRegionId || regionId);
  const { regions, teams } = useRegionFilterOptions(true, teamFilterRegion);
  const period = params.get('period');

  const load = async () => { try { setLoading(true); setRecords(await spjOliService.getAll()); } catch { showError('Gagal memuat data SPJ Oli'); } finally { setLoading(false); } };
  useEffect(() => {
    if (!canAccess(profile?.role) && profile) { navigate('/', { replace: true }); return; }
    if (lockedRegionId) {
      setRegionId(lockedRegionId);
      setTeamId('semua');
      if (isForm) setForm(current => current.region_id === lockedRegionId ? current : { ...current, region_id: lockedRegionId, team_id: '' });
    }
    void load();
  }, [profile, lockedRegionId, isForm]);
  useEffect(() => { void workPlanService.getAllWorkPlans().then(setWorkPlans).catch(() => setWorkPlans([])); }, []);
  useEffect(() => {
    if (!id || !isDraftReady || restoredAt) return;
    spjOliService.getById(id)
      .then(async data => {
        const teamId = data.team_id || '';
        if (teamId) {
          const { data: team } = await supabase.from('teams').select('id, region_id, name').eq('id', teamId).maybeSingle();
          setSelectedTeam(team || undefined);
        }
        setForm({
          ...emptyRecord,
          ...data,
          region_id: data.region_id || '',
          team_id: teamId,
          vehicle_name: data.vehicle_name || '',
          receiver_name: data.receiver_name || '',
          operator_name: data.operator_name || '',
          location: data.location || '',
          remarks: data.remarks || '',
        });
      })
      .catch(() => { showError('Data SPJ Oli tidak ditemukan'); navigate('/', { replace: true }); });
  }, [id, isDraftReady, restoredAt]);

  useEffect(() => {
    if (restoredAt) showSuccess('Draf SPJ Oli sebelumnya dipulihkan.');
  }, [restoredAt]);

  // Data SPJ Oli lama bisa belum memiliki team_id. Pulihkan Tim dari kendaraan
  // yang tersimpan dengan mencocokkannya ke alat pada Rencana Kerja wilayah yang sama.
  useEffect(() => {
    if (!id || form.team_id || !form.region_id || !form.vehicle_name || !workPlans.length) return;
    const vehicle = form.vehicle_name.trim().toLowerCase();
    const matchingTeamIds = Array.from(new Set(workPlans
      .filter(plan => plan.region_id === form.region_id && plan.team_id && !plan.category.toLowerCase().includes('taman'))
      .filter(plan => plan.items.some(item => item.tools.some(tool => {
        const toolName = tool.name?.trim().toLowerCase();
        return toolName && (toolName === vehicle || vehicle.includes(toolName) || toolName.includes(vehicle));
      })))
      .map(plan => plan.team_id as string)));

    if (matchingTeamIds.length === 1) {
      update('team_id', matchingTeamIds[0]);
    }
  }, [id, form.team_id, form.region_id, form.vehicle_name, workPlans]);

  const visibleTeams = teams.filter(team => (lockedRegionId || regionId) === 'semua' || team.region_id === (lockedRegionId || regionId));
  const savedRecordsForForm = useMemo(() => records
    .filter(record => !form.region_id || record.region_id === form.region_id)
    .filter(record => !form.team_id || record.team_id === form.team_id), [records, form.region_id, form.team_id]);
  const vehicleOptions = useMemo(() => {
    if (!form.region_id || !form.team_id) return [];
    const vehiclesFromWorkPlans = workPlans
      .filter(plan => plan.region_id === form.region_id && plan.team_id === form.team_id)
      .filter(plan => !plan.category.toLowerCase().includes('taman'))
      .flatMap(plan => plan.items.flatMap(item => item.tools.map(tool => tool.name?.trim()).filter((value): value is string => Boolean(value))));
    const vehiclesFromSpjOli = savedRecordsForForm.map(record => record.vehicle_name?.trim()).filter(Boolean);
    return Array.from(new Set([...vehiclesFromWorkPlans, ...vehiclesFromSpjOli])).sort();
  }, [workPlans, savedRecordsForForm, form.region_id, form.team_id]);
  const filtered = useMemo(() => records.filter(record => {
    const text = `${record.spj_number} ${record.vehicle_name || ''} ${record.receiver_name || ''} ${record.operator_name || ''} ${record.oil_name} ${record.location || ''} ${record.remarks || ''}`.toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;
    if (lockedRegionId && record.region_id !== lockedRegionId) return false;
    if (!lockedRegionId && regionId !== 'semua' && record.region_id !== regionId) return false;
    if (teamId !== 'semua' && record.team_id !== teamId) return false;
    if (date && record.date !== date) return false;
    if (period) {
      const days = period === 'weekly' ? 7 : period === 'monthly' ? 31 : 1;
      const diff = (Date.now() - new Date(`${record.date}T00:00:00`).getTime()) / 86400000;
      if (diff < 0 || diff >= days) return false;
    }
    return true;
  }), [records, search, regionId, lockedRegionId, teamId, date, period]);

  const regionName = (value: string) => regions.find(region => region.id === value)?.name || '-';
  const teamName = (value: string) => teams.find(team => team.id === value)?.name || '-';
  const update = (key: keyof typeof form, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date || !form.region_id || !form.team_id || !form.spj_number || !form.oil_name || Number(form.quantity) <= 0) { showError('Lengkapi seluruh data wajib dan jumlah oli.'); return; }
    try { await spjOliService.save({ ...form, quantity: Number(form.quantity) }, id); await clearDraft(); showSuccess(id ? 'SPJ Oli diperbarui' : 'SPJ Oli disimpan'); navigate('/'); } catch (error: any) { showError(`Gagal menyimpan: ${error.message}`); }
  };
  const remove = async (recordId: string) => { if (!confirm('Hapus data SPJ Oli ini?')) return; try { await spjOliService.remove(recordId); setRecords(current => current.filter(record => record.id !== recordId)); showSuccess('SPJ Oli dihapus'); } catch { showError('Gagal menghapus SPJ Oli'); } };

  if (!canAccess(profile?.role)) return null;
  if (isForm) return <SpjOliInputForm form={form} regions={regions} teams={teams} selectedTeam={selectedTeam} savedRecords={savedRecordsForForm} vehicleOptions={vehicleOptions} editable={editable} editing={Boolean(id)} regionLocked={Boolean(lockedRegionId)} onChange={update} onSubmit={submit} onCancel={() => navigate('/', { replace: true })} />;

}
