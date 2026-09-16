import { supabase } from '@/lib/supabase';
import { OvertimeRecord } from '@/types/overtime';
import { auditLogService } from '@/services/auditLogService';

export const overtimeService = {
  async getAll(regionId?: string | null) {
    let query = supabase.from('overtime_records').select('*, team:teams(name), region:regions(name)').order('date', { ascending: false }).order('name');
    if (regionId) query = query.eq('region_id', regionId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as OvertimeRecord[];
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('overtime_records').select('*, team:teams(name), region:regions(name)').eq('id', id).single();
    if (error) throw error;
    return data as OvertimeRecord;
  },
  async findPersonByNip(nip: string, regionId?: string | null) {
    let query = supabase
      .from('overtime_records')
      .select('name, nip, position, region_id, updated_at')
      .eq('nip', nip.trim())
      .order('updated_at', { ascending: false })
      .limit(1);
    if (regionId) query = query.eq('region_id', regionId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data as Pick<OvertimeRecord, 'name' | 'nip' | 'position' | 'region_id'> | null;
  },
  async create(record: Omit<OvertimeRecord, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('overtime_records').insert(record).select().single();
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'CREATE', entityType: 'OVERTIME', entityId: data.id, details: { date: data.date, name: data.name, nip: data.nip } });
    return data as OvertimeRecord;
  },
  async update(id: string, record: Partial<Omit<OvertimeRecord, 'id' | 'created_at' | 'updated_at'>>) {
    const { data, error } = await supabase.from('overtime_records').update(record).eq('id', id).select().single();
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'OVERTIME', entityId: id, details: { fields: Object.keys(record) } });
    return data as OvertimeRecord;
  },
  async remove(id: string) {
    const { error } = await supabase.from('overtime_records').delete().eq('id', id);
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'OVERTIME', entityId: id, details: { mode: 'hard_delete' } });
  },
};
