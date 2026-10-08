import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLoginDestination } from '@/constants/access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { useAvailableTeams } from '@/hooks/useAvailableTeams';
import { useValueDraft } from '@/hooks/useFormDraft';
import { storageService } from '@/services/storageService';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';
import { showError, showSuccess } from '@/utils/toast';

const OvertimeForm = ({ initialData }: { initialData?: OvertimeRecord }) => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const isSuperAdmin = profile?.role === 'admin';
  const { regions } = useRegionFilterOptions(true, 'semua');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    name: initialData?.name || '', nip: initialData?.nip || '', position: initialData?.position || '',
    work_location: initialData?.work_location || '',
    photo_url: initialData?.photo_url || '',
    photo_before_url: initialData?.photo_before_url || initialData?.photo_url || '',
    photo_after_url: initialData?.photo_after_url || '',
    start_time: initialData?.start_time || '00.00', end_time: initialData?.end_time || '05.00',
    attendance_count: String(initialData?.attendance_count ?? 1), region_id: initialData?.region_id || profile?.region_id || '',
    team_id: initialData?.team_id || '',
  });
  const { teams, loading: teamsLoading } = useAvailableTeams(form.region_id);
  const [personLookup, setPersonLookup] = useState(false);
  const draftKey = session?.user?.id ? `overtime:${session.user.id}:${initialData?.id ?? 'new'}` : undefined;
  const { clearDraft, lastSavedAt, restoredAt } = useValueDraft(form, values => setForm(current => ({ ...current, ...values })), draftKey);

  useEffect(() => {
    if (restoredAt) showSuccess('Draf Rekap Lembur sebelumnya dipulihkan.');
  }, [restoredAt]);

  useEffect(() => {
    if (!isSuperAdmin && profile?.region_id && !form.region_id) setForm(current => ({ ...current, region_id: profile.region_id || '' }));
  }, [isSuperAdmin, profile?.region_id]);

  const setField = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const handleNipBlur = async () => {
    const nip = form.nip.trim();
    if (!nip) return;
    setPersonLookup(true);
    try {
      const person = await overtimeService.findPersonByNip(nip, form.region_id);
      if (person) {
        setForm(current => ({ ...current, name: person.name, position: person.position }));
        showSuccess('Nama dan jabatan ditemukan dari data tersimpan.');
      }
    } catch {
      showError('Data NIP belum dapat dicari.');
    } finally { setPersonLookup(false); }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.region_id) return showError('Wilayah wajib dipilih.');
    if (!form.team_id) return showError('Kategori / Tim wajib dipilih.');
    setSaving(true);
    try {
      let photoBeforeUrl = form.photo_before_url;
      let photoAfterUrl = form.photo_after_url;
      const photoName = form.name.trim().replace(/\s+/g, '_') || 'tanpa_nama';
      const userId = session?.user?.id ?? 'anonymous';
      if (photoBeforeUrl.startsWith('data:image')) photoBeforeUrl = await storageService.uploadPhoto(photoBeforeUrl, `lembur_${photoName}_sebelum`, userId);
      if (photoAfterUrl.startsWith('data:image')) photoAfterUrl = await storageService.uploadPhoto(photoAfterUrl, `lembur_${photoName}_sesudah`, userId);
      const payload = {
        ...form,
        photo_url: photoBeforeUrl,
        photo_before_url: photoBeforeUrl,
        photo_after_url: photoAfterUrl,
        attendance_count: Number(form.attendance_count) || 0,
        region_id: form.region_id,
        team_id: form.team_id,
      };
      if (initialData) await overtimeService.update(initialData.id, payload);
      else await overtimeService.create(payload);
      await clearDraft();
      showSuccess(initialData ? 'Data lembur berhasil diperbarui.' : 'Data lembur berhasil disimpan.');
      navigate(getLoginDestination(profile?.role));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan data lembur.');
    } finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between"><Button type="button" variant="ghost" onClick={() => navigate('/overtime')}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button><div className="text-center"><h1 className="text-xl font-bold">{initialData ? 'Edit Rekap Lembur' : 'Tambah Rekap Lembur'}</h1><p className="text-[10px] text-slate-500">{lastSavedAt ? 'Draft tersimpan' : 'Draft akan tersimpan otomatis'}</p></div><span /></div>
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="overtime-date">Tanggal</Label><Input id="overtime-date" type="date" value={form.date} onChange={e => setField('date', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-region">Wilayah</Label><select id="overtime-region" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.region_id} onChange={e => setForm(current => ({ ...current, region_id: e.target.value, team_id: '' }))} disabled={!isSuperAdmin} required><option value="">Pilih wilayah</option>{regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
        <div><Label htmlFor="overtime-team">Kategori / Tim</Label><select id="overtime-team" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.team_id} onChange={e => setField('team_id', e.target.value)} disabled={!form.region_id || teamsLoading} required><option value="">{teamsLoading ? 'Memuat tim...' : 'Pilih kategori / tim'}</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
        <div><Label htmlFor="overtime-nip">NIP</Label><Input id="overtime-nip" value={form.nip} onChange={e => setField('nip', e.target.value)} onBlur={() => void handleNipBlur()} placeholder="Ketik NIP lalu keluar dari kolom" required />{personLookup && <p className="mt-1 text-xs text-slate-500">Mencari data NIP...</p>}</div>
        <div><Label htmlFor="overtime-name">Nama</Label><Input id="overtime-name" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-position">Jabatan</Label><Input id="overtime-position" value={form.position} onChange={e => setField('position', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-attendance">Jumlah Kehadiran</Label><Input id="overtime-attendance" type="number" min="0" value={form.attendance_count} onChange={e => setField('attendance_count', e.target.value)} required /></div>
        <div className="md:col-span-2"><Label htmlFor="overtime-location">Lokasi Pekerjaan</Label><Input id="overtime-location" value={form.work_location} onChange={e => setField('work_location', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-start">Jam Mulai</Label><Input id="overtime-start" placeholder="00.00" value={form.start_time} onChange={e => setField('start_time', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-end">Jam Selesai</Label><Input id="overtime-end" placeholder="05.00" value={form.end_time} onChange={e => setField('end_time', e.target.value)} required /></div>
        <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
          <ImageUpload label="Foto Dokumentasi Sebelum" value={form.photo_before_url} onChange={value => setField('photo_before_url', value)} aspectClassName="aspect-[2.4/1]" compressionSize={{ width: 2.4, height: 1 }} />
          <ImageUpload label="Foto Dokumentasi Sesudah" value={form.photo_after_url} onChange={value => setField('photo_after_url', value)} aspectClassName="aspect-[2.4/1]" compressionSize={{ width: 2.4, height: 1 }} />
        </div>
      </div>
      <Button type="submit" className="mt-6" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Rekap Lembur</Button>
    </form>
  </div>;
};

export default OvertimeForm;

