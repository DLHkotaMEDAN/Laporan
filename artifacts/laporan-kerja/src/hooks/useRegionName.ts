import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_REGION_NAME = 'WILAYAH 4 MEDAN KOTA';

export const useRegionName = (regionId?: string | null, fallbackName = DEFAULT_REGION_NAME) => {
  const [regionName, setRegionName] = useState(fallbackName);

  useEffect(() => {
    if (!regionId) {
      setRegionName(fallbackName);
      return;
    }

    const loadRegionName = async () => {
      const { data } = await supabase
        .from('regions')
        .select('name')
        .eq('id', regionId)
        .maybeSingle();

      setRegionName(data?.name?.toUpperCase() || fallbackName);
    };

    loadRegionName();
  }, [regionId, fallbackName]);

  return regionName;
};
