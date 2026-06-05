import { supabase } from '@/lib/supabase';
import { WorkPlan } from '@/types/workPlan';

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

export const workPlanService = {
  async getAllWorkPlans(categoryFilter?: string | null, includeDeleted = false) {
    return fetchAllPages<WorkPlan>(() => {
      let query = supabase
        .from('work_plans')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (categoryFilter && categoryFilter !== 'semua') {
        query = query.eq('category', categoryFilter);
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
  },

  async restoreWorkPlan(id: string) {
    const { error } = await supabase
      .from('work_plans')
      .update({ deleted_at: null })
      .eq('id', id);
    
    if (error) throw error;
  },

  async hardDeleteWorkPlan(id: string) {
    const { error } = await supabase
      .from('work_plans')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
