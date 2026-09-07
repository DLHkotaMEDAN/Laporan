"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/context/AuthContext';
import { useRegionFilterOptions } from '@/hooks/useRegionFilterOptions';
import { storageService } from '@/services/storageService';
import { overtimeService } from '@/services/overtimeService';
import { OvertimeRecord } from '@/types/overtime';
import { showError, showSuccess } from '@/utils/toast';

const OvertimeForm = ({ initialData }: { initialData?: OvertimeRecord }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'admin';
  const { regions } = useRegionFilterOptions(true, 'semua');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    name: initialData?.name || '', nip: initialData?.nip || '', position: initialData?.position || '',
    work_location: initialData?.work_location || '', photo_url: initialData?.photo_url || '',
    start_time: initialData?.start_time || '00.00', end_time: initialData?.end_time || '05.00',
    attendance_count: String(initialData?.attendance_count ?? 1), region_id: initialData?.region_id || profile?.region_id || '',
  });

  useEffect(() => {
    if (!isSuperAdmin && profile?.region_id) setForm(current => ({ ...current, region_id: profile.region_id || '' }));
  }, [isSuperAdmin, profile?.region_id]);

  const setField = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.region_id) return showError('Wilayah wajib dipilih.');
    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      if (photoUrl.startsWith('data:image')) photoUrl = await storageService.uploadPhoto(photoUrl, `lembur_${form.name.replace(/\s+/g, '_')}`);
      const payload = { ...form, photo_url: photoUrl, attendance_count: Number(form.attendance_count) || 0, region_id: form.region_id };
      if (initialData) await overtimeService.update(initialData.id, payload);
      else await overtimeService.create(payload);
      showSuccess(initialData ? 'Data lembur berhasil diperbarui.' : 'Data lembur berhasil disimpan.');
      navigate('/overtime');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan data lembur.');
    } finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between"><Button type="button" variant="ghost" onClick={() => navigate('/overtime')}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button><h1 className="text-xl font-bold">{initialData ? 'Edit Rekap Lembur' : 'Tambah Rekap Lembur'}</h1><span /></div>
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="overtime-date">Tanggal</Label><Input id="overtime-date" type="date" value={form.date} onChange={e => setField('date', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-region">Wilayah</Label><select id="overtime-region" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.region_id} onChange={e => setField('region_id', e.target.value)} disabled={!isSuperAdmin} required><option value="">Pilih wilayah</option>{regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
        <div><Label htmlFor="overtime-name">Nama</Label><Input id="overtime-name" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-nip">NIP</Label><Input id="overtime-nip" value={form.nip} onChange={e => setField('nip', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-position">Jabatan</Label><Input id="overtime-position" value={form.position} onChange={e => setField('position', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-attendance">Jumlah Kehadiran</Label><Input id="overtime-attendance" type="number" min="0" value={form.attendance_count} onChange={e => setField('attendance_count', e.target.value)} required /></div>
        <div className="md:col-span-2"><Label htmlFor="overtime-location">Lokasi Pekerjaan</Label><Input id="overtime-location" value={form.work_location} onChange={e => setField('work_location', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-start">Jam Mulai</Label><Input id="overtime-start" placeholder="00.00" value={form.start_time} onChange={e => setField('start_time', e.target.value)} required /></div>
        <div><Label htmlFor="overtime-end">Jam Selesai</Label><Input id="overtime-end" placeholder="05.00" value={form.end_time} onChange={e => setField('end_time', e.target.value)} required /></div>
        <div className="md:col-span-2"><ImageUpload label="Foto Dokumentasi" value={form.photo_url} onChange={value => setField('photo_url', value)} aspectClassName="aspect-[2.4/1]" compressionSize={{ width: 2.4, height: 1 }} /></div>
      </div>
      <Button type="submit" className="mt-6" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Rekap Lembur</Button>
    </form>
  </div>;
};

export default OvertimeForm;
