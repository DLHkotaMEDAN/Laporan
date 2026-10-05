import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RegionOption { id: string; name: string; }
export interface RegionTeamOption { id: string; region_id: string; name: string; }

// Cache module-level — bertahan selama tab browser terbuka.
// TTL 10 menit cukup untuk data wilayah yang jarang berubah.
const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = { data: T; expiresAt: number };

let regionsCache: CacheEntry<RegionOption[]> | null = null;
// Key: regionId ('semua' atau UUID spesifik)
const teamsCache = new Map<string, CacheEntry<RegionTeamOption[]>>();

const getCachedRegions = (): RegionOption[] | null => {
  if (!regionsCache || Date.now() > regionsCache.expiresAt) {
    regionsCache = null;
    return null;
  }
  return regionsCache.data;
};

const setCachedRegions = (data: RegionOption[]) => {
  regionsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
};

const getCachedTeams = (regionId: string): RegionTeamOption[] | null => {
  const entry = teamsCache.get(regionId);
  if (!entry || Date.now() > entry.expiresAt) {
    teamsCache.delete(regionId);
    return null;
  }
  return entry.data;
};

const setCachedTeams = (regionId: string, data: RegionTeamOption[]) => {
  teamsCache.set(regionId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

/** Master wilayah dan tim untuk filter administrator. */
export const useRegionFilterOptions = (enabled: boolean, regionId: string) => {
  const [regions, setRegions] = useState<RegionOption[]>(() => getCachedRegions() ?? []);
  const [teams, setTeams] = useState<RegionTeamOption[]>(() => getCachedTeams(regionId) ?? []);

  useEffect(() => {
    let active = true;
    const loadRegions = async () => {
      if (!enabled) {
        if (active) setRegions([]);
        return;
      }

      // Gunakan cache jika masih valid — regions tidak tergantung regionId
      const cached = getCachedRegions();
      if (cached) {
        if (active) setRegions(cached);
        return;
      }

      const { data, error } = await supabase
        .from('regions')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order');
      if (!active) return;
      const result = error ? [] : (data || []);
      if (!error && data) setCachedRegions(result);
      setRegions(result);
    };
    void loadRegions();
    return () => { active = false; };
  // PENTING: regionId sengaja tidak ada di sini — query regions tidak memakai regionId.
  // Hanya re-fetch saat enabled berubah.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    let active = true;
    const loadTeams = async () => {
      if (!enabled) {
        if (active) setTeams([]);
        return;
      }

      // Gunakan cache per regionId jika masih valid
      const cacheKey = regionId || 'semua';
      const cached = getCachedTeams(cacheKey);
      if (cached) {
        if (active) setTeams(cached);
        return;
      }

      // Hilangkan opsi tim sebelumnya sebelum hasil query baru diterima.
      setTeams([]);
      let query = supabase.from('teams').select('id, region_id, name').eq('is_active', true).order('name');
      if (regionId !== 'semua') query = query.eq('region_id', regionId);
      const { data, error } = await query;
      if (!active) return;
      const result = error ? [] : (data || []);
      if (!error && data) setCachedTeams(cacheKey, result);
      setTeams(result);
    };
    void loadTeams();
    return () => { active = false; };
  }, [enabled, regionId]);

  return { regions, teams };
};
