import { supabase } from '@/lib/supabase';
import { SpjOliRecord } from '@/types/spjOli';
import { auditLogService } from '@/services/auditLogService';

export const spjOliService = {
  async getAll() {
    const { data, error } = await supabase.from('spj_oli_records').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []) as SpjOliRecord[];
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('spj_oli_records').select('*').eq('id', id).single();
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: id ? 'UPDATE' : 'CREATE', entityType: 'SPJ_OLI', entityId: data.id, details: { date: data.date, mode: id ? 'update' : 'create' } });
    return data as SpjOliRecord;
  },
  async save(record: Omit<SpjOliRecord, 'id' | 'created_at' | 'updated_at'>, id?: string) {
    const query = id
      ? supabase.from('spj_oli_records').update(record).eq('id', id)
      : supabase.from('spj_oli_records').insert(record);
    const { data, error } = await query.select().single();
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'SPJ_OLI', entityId: id, details: { mode: 'hard_delete' } });
    return data as SpjOliRecord;
  },
  async remove(id: string) {
    const { error } = await supabase.from('spj_oli_records').delete().eq('id', id);
    if (error) throw error;
  },
};
