import { supabase } from '@/lib/supabase';
import { SpjOliRecord } from '@/types/spjOli';
import { auditLogService } from '@/services/auditLogService';

/**
 * Mengambil semua baris dengan paginasi otomatis.
 * Berhenti ketika halaman terakhir mengembalikan data kurang dari pageSize,
 * atau ketika batas maksimum halaman tercapai (cegah loop tak henti).
 */
const fetchAllPages = async <T>(
  buildQuery: () => any,
  pageSize = 1000,
  maxPages = 50,
): Promise<T[]> => {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    const batch = (data || []) as T[];
    rows.push(...batch);

    if (batch.length < pageSize) break;
  }

  return rows;
};

export const spjOliService = {
  async getAll() {
    return fetchAllPages<SpjOliRecord>(() =>
      supabase
        .from('spj_oli_records')
        .select('*')
        .order('date', { ascending: false }),
    );
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('spj_oli_records').select('*').eq('id', id).single();
    if (error) throw error;
    return data as SpjOliRecord;
  },
  async save(record: Omit<SpjOliRecord, 'id' | 'created_at' | 'updated_at'>, id?: string) {
    const query = id
      ? supabase.from('spj_oli_records').update(record).eq('id', id)
      : supabase.from('spj_oli_records').insert(record);
    const { data, error } = await query.select().single();
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: id ? 'UPDATE' : 'CREATE', entityType: 'SPJ_OLI', entityId: data.id, details: { date: data.date, mode: id ? 'update' : 'create' } });
    return data as SpjOliRecord;
  },
  async remove(id: string) {
    const { error } = await supabase.from('spj_oli_records').delete().eq('id', id);
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'SPJ_OLI', entityId: id, details: { mode: 'hard_delete' } });
  },
};
