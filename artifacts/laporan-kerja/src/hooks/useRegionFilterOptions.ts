import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RegionOption { id: string; name: string; }
export interface RegionTeamOption { id: string; region_id: string; name: string; }

/** Master wilayah dan tim untuk filter administrator. */
export const useRegionFilterOptions = (enabled: boolean, regionId: string) => {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [teams, setTeams] = useState<RegionTeamOption[]>([]);

  useEffect(() => {
    let active = true;
    const loadRegions = async () => {
      if (!enabled) {
        if (active) setRegions([]);
        return;
      }
      const { data, error } = await supabase
        .from('regions')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order');
      if (!active) return;
      setRegions(error ? [] : (data || []));
    };
    void loadRegions();
    return () => { active = false; };
  }, [enabled]);

  useEffect(() => {
    let active = true;
    const loadTeams = async () => {
      if (!enabled) {
        if (active) setTeams([]);
        return;
      }

      // Hilangkan opsi wilayah sebelumnya sebelum hasil query wilayah baru diterima.
      setTeams([]);
      let query = supabase.from('teams').select('id, region_id, name').eq('is_active', true).order('name');
      if (regionId !== 'semua') query = query.eq('region_id', regionId);
      const { data, error } = await query;
      if (!active) return;
      setTeams(error ? [] : (data || []));
    };
    void loadTeams();
    return () => { active = false; };
  }, [enabled, regionId]);

  return { regions, teams };
};
