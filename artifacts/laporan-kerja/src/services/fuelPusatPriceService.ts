import { supabase } from '@/lib/supabase';
import { FuelPrice } from '@/types/fuelSpjReport';
import { auditLogService } from '@/services/auditLogService';

const TABLE = 'fuel_prices_pusat';

export const fuelPusatPriceService = {
  async getPrices() {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) {
      return [
        { type: 'Pertamax', price: 13500 },
        { type: 'Dexlite', price: 14500 },
      ] as any[];
    }
    return data as FuelPrice[];
  },

  async updatePrice(type: string, price: number) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ type, price, updated_at: new Date().toISOString() }, { onConflict: 'type' });
    if (error) throw error;
    void auditLogService.logCurrentUser({ action: 'UPDATE', entityType: 'FUEL_PRICE_SETTINGS_PUSAT', details: { type, price } });
  },
};
