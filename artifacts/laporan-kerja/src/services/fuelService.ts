import { supabase } from '@/lib/supabase';
import { FuelReport, FuelReportType } from '@/types/fuelReport';
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

export const fuelService = {
  async getAllReports(includeDeleted = false, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchAllPages<FuelReport>(() => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .order('date', { ascending: false });

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (reportType) {
        query = query.eq('report_type', reportType);
      }
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      return query;
    });
  },

  async getReportsBySpecificDate(date: string, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchAllPages<FuelReport>(() => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .is('deleted_at', null)
        .eq('date', date)
        .order('created_at', { ascending: true });

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      return query;
    });
  },

  async getReportsByDateRange(startDate: string, endDate: string, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchAllPages<FuelReport>(() => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      return query;
    });
  },

  async getReportById(id: string) {
    const { data, error } = await supabase
      .from('fuel_reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as FuelReport;
  },

  async createReport(report: Omit<FuelReport, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('fuel_reports')
      .insert([report])
      .select()
      .single();
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'CREATE', entityType: 'FUEL_REPORT', entityId: data.id, details: { date: data.date, team: data.team, region: data.region } });
    return data;
  },

  async updateReport(id: string, report: Partial<FuelReport>) {
    const { data, error } = await supabase
      .from('fuel_reports')
      .update(report)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'FUEL_REPORT', entityId: id, details: { date: data.date, team: data.team, region: data.region, fields: Object.keys(report) } });
    return data;
  },

  async deleteReport(id: string) {
    const { error } = await supabase
      .from('fuel_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'FUEL_REPORT', entityId: id, details: { mode: 'soft_delete' } });
  },

  async restoreReport(id: string) {
    const { error } = await supabase
      .from('fuel_reports')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'FUEL_REPORT', entityId: id, details: { mode: 'restore' } });
  },

  async hardDeleteReport(id: string) {
    const { error } = await supabase
      .from('fuel_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'FUEL_REPORT', entityId: id, details: { mode: 'hard_delete' } });
  }
};
