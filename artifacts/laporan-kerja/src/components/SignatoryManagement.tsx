import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signatoryService, type Signatory, type SignatoryPosition } from '@/services/signatoryService';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';

const labels: Record<SignatoryPosition, string> = {
  kabid_tata_lingkungan: 'Kabid Tata Lingkungan',
  ketua_tim_pemeliharaan_lingkungan: 'Ketua Tim Pemeliharaan Lingkungan',
  kepala_koordinator_taman: 'Kepala Koordinator Taman',
  kepala_koordinator_pohon: 'Kepala Koordinator Pohon',
};
const coordinatorPositions: SignatoryPosition[] = ['kepala_koordinator_taman', 'kepala_koordinator_pohon'];
const coordinatorCategories = ['Taman Kota', 'Taman Amplas', 'Taman Area', 'Tim Babat', 'Tim Siram', 'Tim Pohon'];
type Region = { id: string; name: string };
type Draft = Omit<Signatory, 'id'> & { id?: string };
const emptyDraft = (): Draft => ({ position: 'kabid_tata_lingkungan', name: '', nip: '', all_regions: false, region_ids: [], categories: [], is_active: true });

export default function SignatoryManagement() {
  const [items, setItems] = useState<Signatory[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isCoordinator = coordinatorPositions.includes(draft.position);
  const isEditing = Boolean(draft.id);
  const load = async () => {
    setLoading(true);
    const [signatories, regionResult] = await Promise.all([
      signatoryService.getAll(),
      supabase.from('regions').select('id, name').eq('is_active', true).order('sort_order'),
    ]);
    setItems(signatories.filter((item) => item.position in labels));
    setRegions(regionResult.data || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const toggle = (field: 'region_ids' | 'categories', value: string) => setDraft((current) => ({
    ...current,
    [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value],
  }));
  const selectPosition = (position: SignatoryPosition) => setDraft((current) => ({
    ...current,
    position,
    all_regions: coordinatorPositions.includes(position) ? current.all_regions : false,
    region_ids: coordinatorPositions.includes(position) ? current.region_ids : [],
    categories: coordinatorPositions.includes(position) ? current.categories : [],
  }));
  const save = async () => {
    if (!draft.name.trim()) return showError('Nama penandatangan wajib diisi.');
    if (isCoordinator && !draft.all_regions && draft.region_ids.length === 0) return showError('Pilih Semua Wilayah atau minimal satu wilayah.');
    if (!isCoordinator && !isEditing && items.some((item) => item.position === draft.position && item.is_active)) return showError('Jabatan ini sudah memiliki penandatangan. Gunakan tombol Ubah pada data yang ada.');
    setSaving(true);
    try {
      await signatoryService.save(draft);
      showSuccess('Penandatangan berhasil disimpan.');
      setDraft(emptyDraft());
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Gagal menyimpan penandatangan.');
    } finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Hapus data penandatangan ini?')) return;
    try { await signatoryService.remove(id); setDraft(emptyDraft()); await load(); showSuccess('Penandatangan dihapus.'); }
    catch (error) { showError(error instanceof Error ? error.message : 'Gagal menghapus data.'); }
  };
  const regionLabel = (item: Signatory) => item.all_regions || !coordinatorPositions.includes(item.position)
    ? 'Semua wilayah'
    : regions.filter((region) => item.region_ids.includes(region.id)).map((region) => region.name).join(', ');
  const helper = useMemo(() => isCoordinator
    ? 'Pilih cakupan wilayah dan kategori. Data khusus wilayah akan diprioritaskan pada cetakan.'
    : 'Jabatan ini berlaku untuk seluruh wilayah dan hanya dapat memiliki satu penandatangan aktif.', [isCoordinator]);

  return <div className="space-y-5">
    <div className="rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950"><p className="font-semibold">Input Penandatangan Cetakan</p><p className="mt-1 text-violet-800">{helper}</p></div>
    <div className="rounded-lg border bg-slate-50 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div><Label htmlFor="signatory-position">Jabatan</Label><Select value={draft.position} onValueChange={(value) => selectPosition(value as SignatoryPosition)}><SelectTrigger id="signatory-position"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="signatory-name">Nama dan gelar</Label><Input id="signatory-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Contoh: Nama, S.T." /></div>
        <div><Label htmlFor="signatory-nip">NIP</Label><Input id="signatory-nip" value={draft.nip} onChange={(event) => setDraft({ ...draft, nip: event.target.value })} placeholder="Contoh: NIP. 1974..." /></div>
      </div>
      {isCoordinator && <div className="mt-5 grid gap-5 border-t pt-5 md:grid-cols-2">
        <section><div className="flex items-center gap-2"><Checkbox id="all-regions" checked={draft.all_regions} onCheckedChange={(value) => setDraft({ ...draft, all_regions: value === true })} /><Label htmlFor="all-regions" className="font-semibold">Semua Wilayah</Label></div><p className="mb-3 mt-1 text-xs text-slate-500">Atau hilangkan pilihan ini dan checklist wilayah yang dipimpin.</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{regions.map((region) => <label key={region.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.region_ids.includes(region.id)} disabled={draft.all_regions} onCheckedChange={() => toggle('region_ids', region.id)} />{region.name}</label>)}</div></section>
        <section><Label className="font-semibold">Kategori yang ditangani</Label><p className="mb-3 mt-1 text-xs text-slate-500">Kosong berarti berlaku untuk seluruh kategori.</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{coordinatorCategories.map((category) => <label key={category} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.categories.includes(category)} onCheckedChange={() => toggle('categories', category)} />{category}</label>)}</div></section>
      </div>}
      <div className="mt-5 flex justify-end gap-2">{isEditing && <Button variant="outline" onClick={() => setDraft(emptyDraft)}><X className="mr-2 h-4 w-4" />Batal</Button>}<Button onClick={() => void save()} disabled={saving}>{isEditing ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{isEditing ? 'Simpan Perubahan' : 'Tambah Penandatangan'}</Button></div>
    </div>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Jabatan</th><th className="p-3">Nama / NIP</th><th className="p-3">Cakupan</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{labels[item.position]}</td><td className="p-3"><p>{item.name}</p><p className="text-xs text-slate-500">{item.nip || 'NIP belum diisi'}</p></td><td className="p-3 text-xs">{regionLabel(item)}{coordinatorPositions.includes(item.position) && <p className="mt-1 text-slate-500">{item.categories.length ? item.categories.join(', ') : 'Semua kategori'}</p>}</td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setDraft({ ...item, region_ids: item.region_ids || [], categories: item.categories || [] })}><Pencil className="mr-1 h-4 w-4" />Ubah</Button><Button variant="ghost" size="icon" aria-label="Hapus penandatangan" className="text-red-600" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table>{!loading && items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Belum ada data penandatangan.</p>}{loading && <p className="p-6 text-center text-sm text-slate-500">Memuat data penandatangan…</p>}</div>
  </div>;
}
