import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface TeamOption {
  id: string;
  region_id: string;
  name: string;
}

export const useAvailableTeams = (regionId?: string | null) => {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(Boolean(regionId));

  useEffect(() => {
    let active = true;

    const loadTeams = async () => {
      if (!regionId) {
        if (active) {
          setTeams([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('teams')
        .select('id, region_id, name')
        .eq('region_id', regionId)
        .eq('is_active', true)
        .order('name');

      if (active) {
        setTeams(error ? [] : (data || []));
        setLoading(false);
      }
    };

    void loadTeams();
    return () => { active = false; };
  }, [regionId]);

  return { teams, loading };
};
