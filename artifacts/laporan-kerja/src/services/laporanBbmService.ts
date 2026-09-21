import { supabase } from '@/lib/supabase';
import { FuelReport } from '@/types/fuelReport';
import { auditLogService } from '@/services/auditLogService';

const TABLE = 'laporan_bbm_reports';

const fetchAllPages = async <T>(buildQuery: () => any, pageSize = 1000) => {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
};

const normalize = (report: FuelReport): FuelReport => ({
  ...report,
  report_type: 'laporan_bbm',
});

export const laporanBbmService = {
  async getAllReports(includeDeleted = false, regionId?: string | null) {
    const reports = await fetchAllPages<FuelReport>(() => {
      let query = supabase.from(TABLE).select('*').order('date', { ascending: false });
      if (regionId) query = query.eq('region_id', regionId);
      query = includeDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
      return query;
    });
    return reports.map(normalize);
  },

  async getReportsBySpecificDate(date: string, regionId?: string | null) {
    const reports = await fetchAllPages<FuelReport>(() => {
      let query = supabase.from(TABLE).select('*').is('deleted_at', null).eq('date', date).order('created_at', { ascending: true });
      if (regionId) query = query.eq('region_id', regionId);
      return query;
    });
    return reports.map(normalize);
  },

  async getReportsByDateRange(startDate: string, endDate: string, regionId?: string | null) {
    const reports = await fetchAllPages<FuelReport>(() => {
      let query = supabase.from(TABLE).select('*').is('deleted_at', null).gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
      if (regionId) query = query.eq('region_id', regionId);
      return query;
    });
    return reports.map(normalize);
  },

  async getReportById(id: string) {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
    if (error) throw error;
    return normalize(data as FuelReport);
  },

  async createReport(report: Omit<FuelReport, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from(TABLE).insert([report]).select().single();
    if (error) throw error;
    const normalized = normalize(data as FuelReport);
    void auditLogService.logCurrentUser({ action: 'CREATE', entityType: 'LAPORAN_BBM_REPORT', entityId: normalized.id, details: { date: normalized.date, team: normalized.team, region: normalized.region } });
    return normalized;
  },

  async updateReport(id: string, report: Partial<FuelReport>) {
    const { report_type: _reportType, ...payload } = report;
    const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single();
    if (error) throw error;
    const normalized = normalize(data as FuelReport);
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'LAPORAN_BBM_REPORT', entityId: id, details: { date: normalized.date, team: normalized.team, region: normalized.region, fields: Object.keys(payload) } });
    return normalized;
  },

  async deleteReport(id: string) {
    const { error } = await supabase.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'LAPORAN_BBM_REPORT', entityId: id, details: { mode: 'soft_delete' } });
  },

  async restoreReport(id: string) {
    const { error } = await supabase.from(TABLE).update({ deleted_at: null }).eq('id', id);
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'LAPORAN_BBM_REPORT', entityId: id, details: { mode: 'restore' } });
  },

  async hardDeleteReport(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'DELETE', entityType: 'LAPORAN_BBM_REPORT', entityId: id, details: { mode: 'hard_delete' } });
  },
};
