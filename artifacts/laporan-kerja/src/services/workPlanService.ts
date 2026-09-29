import { supabase } from '@/lib/supabase';
import { WorkPlan } from '@/types/workPlan';
import { auditLogService } from '@/services/auditLogService';

const fetchAllPages = async <T>(buildQuery: () => any, pageSize = 1000) => {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    const page = (data || []) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
};

export type WorkPlanDateFilter =
  | { type: 'date'; value: string }
  | { type: 'month'; month: string; year: string }
  | { type: 'year'; year: string };

export interface WorkPlanFilters {
  dateFilter?: WorkPlanDateFilter | null;
  category?: string | null;
  regionId?: string | null;
  includeDeleted?: boolean;
}

export const workPlanService = {
  /**
   * Mengambil rencana kerja dengan filter yang dikirim ke Supabase (server-side).
   * Gunakan method ini di Index.tsx menggantikan getAllWorkPlans.
   */
  async getFilteredWorkPlans(filters: WorkPlanFilters = {}) {
    const { dateFilter, category, regionId, includeDeleted = false } = filters;

    return fetchAllPages<WorkPlan>(() => {
      let query = supabase
        .from('work_plans')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateFilter?.type === 'date') {
        query = query.eq('date', dateFilter.value);
      } else if (dateFilter?.type === 'month') {
        const y = parseInt(dateFilter.year, 10);
        const m = parseInt(dateFilter.month, 10);
        const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0);
        const lastDayStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        query = query.gte('date', firstDay).lte('date', lastDayStr);
      } else if (dateFilter?.type === 'year') {
        const y = dateFilter.year;
        query = query.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
      }

      if (category && category !== 'semua') {
        query = query.eq('category', category);
      }

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      return query;
    });
  },

  async getAllWorkPlans(categoryFilter?: string | null, includeDeleted = false, regionId?: string | null) {
    return fetchAllPages<WorkPlan>(() => {
      let query = supabase
        .from('work_plans')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (categoryFilter && categoryFilter !== 'semua') {
        query = query.eq('category', categoryFilter);
      }

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      return query;
    });
  },

  async getWorkPlanById(id: string) {
    const { data, error } = await supabase
      .from('work_plans')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as WorkPlan;
  },

  async createWorkPlan(plan: Omit<WorkPlan, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('work_plans')
      .insert([plan])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateWorkPlan(id: string, plan: Partial<WorkPlan>) {
    const { data, error } = await supabase
      .from('work_plans')
      .update(plan)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteWorkPlan(id: string) {
    // Soft Delete
    const { error } = await supabase
      .from('work_plans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'WORK_PLAN', entityId: id, details: { mode: 'soft_delete' } });
  },

  async restoreWorkPlan(id: string) {
    const { error } = await supabase
      .from('work_plans')
      .update({ deleted_at: null })
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'WORK_PLAN', entityId: id, details: { mode: 'restore' } });
  },

  async hardDeleteWorkPlan(id: string) {
    const { error } = await supabase
      .from('work_plans')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'WORK_PLAN', entityId: id, details: { mode: 'hard_delete' } });
  }
};
