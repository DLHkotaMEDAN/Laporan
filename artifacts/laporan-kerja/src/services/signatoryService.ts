import { supabase } from '@/lib/supabase';
import { auditLogService } from '@/services/auditLogService';

export const SIGNATORY_POSITIONS = [
  'kabid_tata_lingkungan',
  'ketua_tim_pemeliharaan_lingkungan',
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
// Cache berlaku selama 5 menit — cukup untuk mencegah redundant fetch
// dalam satu sesi, tapi tidak bocor data lama ke sesi berikutnya.
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  data: Signatory[];
  expiresAt: number;
};

const readCache = (): Signatory[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    // Tolak cache yang sudah kadaluarsa
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const writeCache = (signatories: Signatory[]) => {
  try {
    const entry: CacheEntry = {
      data: signatories,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage penuh atau tidak tersedia — abaikan, tidak kritis
  }
};

const clearCache = () => localStorage.removeItem(CACHE_KEY);

export const signatoryService = {
  async getAll(): Promise<Signatory[]> {
    // Coba dari cache yang masih valid dulu untuk mengurangi request ke DB.
    const cached = readCache();
    if (cached !== null) return cached;

    const { data, error } = await supabase
      .from('signatory_settings')
      .select('id, position, name, nip, all_regions, region_ids, categories, is_active')
      .order('position')
      .order('name');

    if (error || !data) {
      // Gagal ambil dari DB: kembalikan array kosong.
      // Lebih aman daripada mengembalikan data lama yang mungkin stale atau
      // sudah dimanipulasi. Komponen pemanggil bertanggung jawab menampilkan
      // pesan error kepada user.
      console.error('Gagal memuat data penandatangan:', error?.message);
      return [];
    }

    writeCache(data as Signatory[]);
    return data as Signatory[];
  },

  async save(signatory: Omit<Signatory, 'id'> & { id?: string }): Promise<Signatory> {
    const payload = {
      position: signatory.position,
      name: signatory.name.trim(),
      nip: signatory.nip.trim(),
      all_regions: signatory.all_regions,
      region_ids: signatory.all_regions ? [] : signatory.region_ids,
      categories: signatory.categories,
      is_active: signatory.is_active,
    };
    const query = signatory.id
      ? supabase.from('signatory_settings').update(payload).eq('id', signatory.id).select('id, position, name, nip, all_regions, region_ids, categories, is_active').single()
      : supabase.from('signatory_settings').insert(payload).select('id, position, name, nip, all_regions, region_ids, categories, is_active').single();
    const { data, error } = await query;
    if (error || !data) {
      throw new Error(error?.message || 'Data penandatangan gagal disimpan.');
    }
    const saved = data as Signatory;
    // Invalidasi cache setelah mutasi agar getAll() berikutnya ambil data segar dari DB.
    clearCache();
    window.dispatchEvent(new Event('signatories-updated'));
    void auditLogService.logCurrentUser({
      action: signatory.id ? 'UPDATE' : 'CREATE',
      entityType: 'SIGNATORY_SETTINGS',
      entityId: saved.id,
      details: { position: saved.position, name: saved.name, all_regions: saved.all_regions, region_count: saved.region_ids.length },
    });
    return saved;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('signatory_settings').delete().eq('id', id);
    if (error) throw new Error(error.message);
    // Invalidasi cache setelah mutasi.
    clearCache();
    window.dispatchEvent(new Event('signatories-updated'));
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'SIGNATORY_SETTINGS', entityId: id, details: { mode: 'hard_delete' } });
  },
};

export const findSignatory = (signatories: Signatory[], position: SignatoryPosition, regionId?: string | null, categories: string[] = []) =>
  signatories.filter((item) => item.position === position && item.is_active && (position === 'kepala_koordinator_taman' || position === 'kepala_koordinator_pohon'
    ? (item.all_regions || (!!regionId && item.region_ids.includes(regionId))) && (categories.length === 0 || item.categories.length === 0 || categories.some((category) => item.categories.includes(category)))
    : true)).sort((first, second) => Number(first.all_regions) - Number(second.all_regions))[0];
