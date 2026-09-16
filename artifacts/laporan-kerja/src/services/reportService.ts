import { supabase } from '@/lib/supabase';
import { Report } from '@/types/report';
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

export const reportService = {
  async getAllReports(categoryFilter?: string | null, includeDeleted = false, regionId?: string | null) {
    return fetchAllPages<Report>(() => {
      let query = supabase
        .from('reports')
        .select('*')
        .order('date', { ascending: false });
      
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

  async getReportsByDateRange(startDate: string, endDate: string, categoryFilter?: string | null) {
    return fetchAllPages<Report>(() => {
      let query = supabase
        .from('reports')
        .select('*')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (categoryFilter && categoryFilter !== 'semua') {
        query = query.eq('category', categoryFilter);
      }

      return query;
    });
  },

  async getReportById(id: string) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Report;
  },

  async createReport(report: Omit<Report, 'id' | 'createdAt'>) {
    const { data, error } = await supabase
      .from('reports')
      .insert([report])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateReport(id: string, report: Partial<Report>) {
    const { data, error } = await supabase
      .from('reports')
      .update(report)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteReport(id: string) {
    // Soft Delete: Tandai sebagai dihapus
    const { error } = await supabase
      .from('reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'REPORT', entityId: id, details: { mode: 'soft_delete' } });
  },

  async restoreReport(id: string) {
    const { error } = await supabase
      .from('reports')
      .update({ deleted_at: null })
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'REPORT', entityId: id, details: { mode: 'restore' } });
  },

  async hardDeleteReport(id: string) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'REPORT', entityId: id, details: { mode: 'hard_delete' } });
  }
};
