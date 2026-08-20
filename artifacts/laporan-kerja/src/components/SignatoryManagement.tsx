import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { signatoryService, type Signatory, type SignatoryPosition } from '@/services/signatoryService';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';

const labels: Record<SignatoryPosition, string> = {
  kabid_tata_lingkungan: 'Kabid Tata Lingkungan',
  ketua_tim_pemeliharaan_lingkungan: 'Ketua Tim Pemeliharaan Lingkungan',
  pengawas_taman_penghijauan: 'Pengawas Taman Penghijauan',
  kepala_koordinator_taman: 'Kepala Koordinator Taman',
  kepala_koordinator_pohon: 'Kepala Koordinator Pohon',
};
const regionalPositions: SignatoryPosition[] = ['kepala_koordinator_taman', 'kepala_koordinator_pohon'];
type Region = { id: string; name: string };

const blank = (): Omit<Signatory, 'id'> => ({ position: 'kabid_tata_lingkungan', name: '', nip: '', region_id: null, is_active: true });

export default function SignatoryManagement() {
  const [items, setItems] = useState<Signatory[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draft, setDraft] = useState<Omit<Signatory, 'id'> & { id?: string }>(blank());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [signatories, regionResult] = await Promise.all([
      signatoryService.getAll(),
      supabase.from('regions').select('id, name').eq('is_active', true).order('sort_order'),
    ]);
    setItems(signatories);
    setRegions(regionResult.data || []);
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!draft.name.trim()) return showError('Nama penandatangan wajib diisi.');
    if (regionalPositions.includes(draft.position) && !draft.region_id) return showError('Pilih wilayah untuk koordinator.');
    setSaving(true);
    try {
      await signatoryService.save(draft);
      showSuccess('Data penandatangan berhasil disimpan.');
      setDraft(blank());
      await load();
    } catch (error) { showError(error instanceof Error ? error.message : 'Gagal menyimpan data.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus penandatangan ini?')) return;
    try { await signatoryService.remove(id); setDraft(blank()); await load(); showSuccess('Data penandatangan dihapus.'); }
    catch (error) { showError(error instanceof Error ? error.message : 'Gagal menghapus data.'); }
  };

  const regional = regionalPositions.includes(draft.position);
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">Atur nama dan NIP pada cetakan. Kepala Koordinator dapat ditambahkan berkali-kali; tiap data wajib memiliki wilayah pimpinan sehingga cetakan memilih koordinator sesuai wilayah laporan.</p>
    <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-4">
      <div><Label>Jabatan</Label><Select value={draft.position} onValueChange={(value) => setDraft((current) => ({ ...current, position: value as SignatoryPosition, region_id: regionalPositions.includes(value as SignatoryPosition) ? current.region_id : null }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Nama</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nama dan gelar" /></div>
      <div><Label>NIP</Label><Input value={draft.nip} onChange={(e) => setDraft({ ...draft, nip: e.target.value })} placeholder="NIP. ..." /></div>
      <div>{regional && <><Label>Wilayah pimpinan</Label><Select value={draft.region_id || ''} onValueChange={(value) => setDraft({ ...draft, region_id: value })}><SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger><SelectContent>{regions.map((region) => <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>)}</SelectContent></Select></>}<Button className="mt-5 w-full" onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{draft.id ? 'Simpan Perubahan' : 'Tambah Penandatangan'}</Button></div>
    </div>
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Jabatan</th><th className="p-3">Nama / NIP</th><th className="p-3">Wilayah</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{labels[item.position]}</td><td className="p-3"><p>{item.name}</p><p className="text-xs text-slate-500">{item.nip || '-'}</p></td><td className="p-3">{regions.find((region) => region.id === item.region_id)?.name || 'Semua wilayah'}</td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setDraft(item)}>Ubah</Button><Button variant="ghost" size="icon" className="text-red-600" onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table>{items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Belum ada data penandatangan. Tambahkan data pertama di atas.</p>}</div>
  </div>;
}
