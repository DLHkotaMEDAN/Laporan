import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { Report } from '@/types/report';
import { auditLogService } from '@/services/auditLogService';

export type ReportDateFilter =
  | { type: 'date'; value: string }           // tanggal spesifik: "2026-09-24"
  | { type: 'month'; month: string; year: string } // bulan + tahun: month="9", year="2026"
  | { type: 'year'; year: string };            // tahun saja: year="2026"

export interface ReportFilters {
  dateFilter?: ReportDateFilter | null;
  category?: string | null;
  regionId?: string | null;
  includeDeleted?: boolean;
}

export const reportService = {
  /**
   * Mengambil laporan dengan filter yang dikirim ke Supabase (server-side).
   * Gunakan method ini di Index.tsx menggantikan getAllReports agar tidak
   * mengambil semua baris lalu memfilter di client.
   */
  async getFilteredReports(filters: ReportFilters = {}) {
    const { dateFilter, category, regionId, includeDeleted = false } = filters;

    return fetchAllPages<Report>(() => {
      let query = supabase
        .from('reports')
        .select('*')
        .order('date', { ascending: false })
        .order('category', { ascending: true });

      // Filter tanggal — kirim ke Supabase agar baris yang tidak relevan tidak ditarik
      if (dateFilter?.type === 'date') {
        query = query.eq('date', dateFilter.value);
      } else if (dateFilter?.type === 'month') {
        // Supabase belum punya fungsi month() di filter — gunakan range tanggal
        const y = parseInt(dateFilter.year, 10);
        const m = parseInt(dateFilter.month, 10);
        const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0); // hari terakhir bulan tsb
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

  async getReportsByDateRange(startDate: string, endDate: string, categoryFilter?: string | null, regionId?: string | null) {
    return fetchAllPages<Report>(() => {
      let query = supabase
        .from('reports')
        .select('*')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('category', { ascending: true });

      if (categoryFilter && categoryFilter !== 'semua') {
        query = query.eq('category', categoryFilter);
      }

      if (regionId) {
        query = query.eq('region_id', regionId);
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
    void auditLogService.logCurrentUser({ action: 'CREATE', entityType: 'REPORT', entityId: data.id, details: { date: report.date, category: report.category } });
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
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'REPORT', entityId: id, details: { fields: Object.keys(report) } });
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
