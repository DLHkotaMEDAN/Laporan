import { supabase } from '@/lib/supabase';

export const SIGNATORY_POSITIONS = [
  'kabid_tata_lingkungan',
  'ketua_tim_pemeliharaan_lingkungan',
  'pengawas_taman_penghijauan',
  'kepala_koordinator_taman',
  'kepala_koordinator_pohon',
] as const;

export type SignatoryPosition = typeof SIGNATORY_POSITIONS[number];

export type Signatory = {
  id: string;
  position: SignatoryPosition;
  name: string;
  nip: string;
  all_regions: boolean;
  region_ids: string[];
  categories: string[];
  is_active: boolean;
};

const CACHE_KEY = 'dlh-signatories';

const readCache = (): Signatory[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); }
  catch { return []; }
};

const writeCache = (signatories: Signatory[]) => localStorage.setItem(CACHE_KEY, JSON.stringify(signatories));

export const signatoryService = {
  async getAll(): Promise<Signatory[]> {
    const { data, error } = await supabase
      .from('signatory_settings')
      .select('id, position, name, nip, all_regions, region_ids, categories, is_active')
      .order('position')
      .order('name');
    if (!error && data) {
      writeCache(data as Signatory[]);
      return data as Signatory[];
    }
    return readCache();
  },

  async save(signatory: Omit<Signatory, 'id'> & { id?: string }): Promise<Signatory> {
    const payload = { position: signatory.position, name: signatory.name.trim(), nip: signatory.nip.trim(), all_regions: signatory.all_regions, region_ids: signatory.all_regions ? [] : signatory.region_ids, categories: signatory.categories, is_active: signatory.is_active };
    const query = signatory.id
      ? supabase.from('signatory_settings').update(payload).eq('id', signatory.id).select('id, position, name, nip, all_regions, region_ids, categories, is_active').single()
      : supabase.from('signatory_settings').insert(payload).select('id, position, name, nip, all_regions, region_ids, categories, is_active').single();
    const { data, error } = await query;
    if (error || !data) {
      const cached = readCache();
      const saved: Signatory = { ...payload, id: signatory.id || crypto.randomUUID() };
      const next = signatory.id ? cached.map((item) => item.id === signatory.id ? saved : item) : [...cached, saved];
      writeCache(next);
      window.dispatchEvent(new Event('signatories-updated'));
      if (error) throw new Error('Tabel pengaturan penandatangan belum tersedia. Jalankan SQL migrasi terlebih dahulu.');
      return saved;
    }
    const saved = data as Signatory;
    const cached = readCache().filter((item) => item.id !== saved.id);
    writeCache([...cached, saved]);
    window.dispatchEvent(new Event('signatories-updated'));
    return saved;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('signatory_settings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    writeCache(readCache().filter((item) => item.id !== id));
    window.dispatchEvent(new Event('signatories-updated'));
  },
};

export const findSignatory = (signatories: Signatory[], position: SignatoryPosition, regionId?: string | null, categories: string[] = []) =>
  signatories.filter((item) => item.position === position && item.is_active && (position === 'kepala_koordinator_taman' || position === 'kepala_koordinator_pohon'
    ? (item.all_regions || (!!regionId && item.region_ids.includes(regionId))) && (categories.length === 0 || item.categories.length === 0 || categories.some((category) => item.categories.includes(category)))
    : true)).sort((first, second) => Number(first.all_regions) - Number(second.all_regions))[0];
