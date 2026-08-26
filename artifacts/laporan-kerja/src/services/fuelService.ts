import { supabase } from '@/lib/supabase';
import { FuelReport } from '@/types/fuelReport';

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
  async getAllReports(includeDeleted = false) {
    return fetchAllPages<FuelReport>(() => {
      let query = supabase
        .from('fuel_reports')
        .select('*')
        .order('date', { ascending: false });
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      } else {
        query = query.not('deleted_at', 'is', null);
      }

      return query;
    });
  },

  async getReportsBySpecificDate(date: string) {
    return fetchAllPages<FuelReport>(() =>
      supabase
        .from('fuel_reports')
        .select('*')
        .is('deleted_at', null)
        .eq('date', date)
        .order('created_at', { ascending: true })
    );
  },

  async getReportsByDateRange(startDate: string, endDate: string) {
    return fetchAllPages<FuelReport>(() =>
      supabase
        .from('fuel_reports')
        .select('*')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
    );
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
    return data;
  },

  async deleteReport(id: string) {
    const { error } = await supabase
      .from('fuel_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  }
};
