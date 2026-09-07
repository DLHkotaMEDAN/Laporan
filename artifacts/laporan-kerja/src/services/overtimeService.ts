import { supabase } from '@/lib/supabase';
import { OvertimeRecord } from '@/types/overtime';

export const overtimeService = {
  async getAll(regionId?: string | null) {
    let query = supabase.from('overtime_records').select('*').order('date', { ascending: false }).order('name');
    if (regionId) query = query.eq('region_id', regionId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as OvertimeRecord[];
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('overtime_records').select('*').eq('id', id).single();
    if (error) throw error;
    return data as OvertimeRecord;
  },
  async create(record: Omit<OvertimeRecord, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('overtime_records').insert(record).select().single();
    if (error) throw error;
    return data as OvertimeRecord;
  },
  async update(id: string, record: Partial<Omit<OvertimeRecord, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await supabase.from('overtime_records').update(record).eq('id', id).select().single();
    if (error) throw error;
    return data as OvertimeRecord;
  },
  async remove(id: string) {
    const { error } = await supabase.from('overtime_records').delete().eq('id', id);
    if (error) throw error;
  },
};
