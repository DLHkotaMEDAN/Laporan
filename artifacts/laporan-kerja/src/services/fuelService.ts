import { supabase } from '@/lib/supabase';
import { FuelReport, FuelReportType } from '@/types/fuelReport';
import { auditLogService } from '@/services/auditLogService';

/**
 * Mengambil semua baris dari Supabase dengan paginasi otomatis.
 * Berhenti ketika halaman terakhir mengembalikan data kurang dari pageSize,
 * atau ketika batas maksimum halaman tercapai (cegah loop tak henti).
 *
 * @param buildQuery  Fungsi yang mengembalikan Supabase query builder
 * @param pageSize    Jumlah baris per halaman (default 1000)
 * @param maxPages    Batas maksimum halaman — cegah loop tak henti (default 50 = 50.000 baris)
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

    // Berhenti jika halaman terakhir (data kurang dari pageSize)
    if (batch.length < pageSize) break;
  }

  return rows;
};

const isMissingReportTypeColumnError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string; details?: string } | null;
  const text = [candidate?.message, candidate?.details].filter(Boolean).join(' ').toLowerCase();
  return candidate?.code === '42703'
    || candidate?.code === 'PGRST204'
    || (text.includes('report_type') && (text.includes('does not exist') || text.includes('schema cache')));
};

const fetchFuelReports = async (
  buildQuery: (includeReportType: boolean) => any,
  reportType: FuelReportType | null,
) => {
  try {
    return await fetchAllPages<FuelReport>(() => buildQuery(Boolean(reportType)));
  } catch (error) {
    // Data lama dibuat sebelum report_type ditambahkan. Sampai migrasi kolom
    // diterapkan di Supabase, anggap semua data lama sebagai Admin BBM.
    // Laporan BBM tetap gagal dengan jelas agar tidak tercampur dengan data lama.
    if (reportType === 'admin_bbm' && isMissingReportTypeColumnError(error)) {
      console.warn('Kolom fuel_reports.report_type belum tersedia; membaca data Admin BBM lama. Jalankan migrasi database.', error);
      return fetchAllPages<FuelReport>(() => buildQuery(false));
    }
    throw error;
  }
};

export const fuelService = {
  async getAllReports(includeDeleted = false, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchFuelReports((includeReportType) => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .order('date', { ascending: false });

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (includeReportType && reportType) {
        query = query.eq('report_type', reportType);
      }
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      return query;
    }, reportType);
  },

  async getReportsBySpecificDate(date: string, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchFuelReports((includeReportType) => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .is('deleted_at', null)
        .eq('date', date)
        .order('created_at', { ascending: true });

      if (regionId) {
        query = query.eq('region_id', regionId);
      }

      if (includeReportType && reportType) {
        query = query.eq('report_type', reportType);
      }

      return query;
    }, reportType);
  },

  async getReportsByDateRange(startDate: string, endDate: string, regionId?: string | null, reportType: FuelReportType | null = 'admin_bbm') {
    return fetchFuelReports((includeReportType) => {
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

      if (includeReportType && reportType) {
        query = query.eq('report_type', reportType);
      }

      return query;
    }, reportType);
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
