import { supabase } from '@/lib/supabase';
import { FuelPrice } from '@/types/fuelSpjReport';

export const fuelPriceService = {
  async getPrices() {
    const { data, error } = await supabase
      .from('fuel_prices')
      .select('*');
    
    if (error) {
      // Jika tabel belum ada, kembalikan default
      return [
        { type: 'Pertamax', price: 13500 },
        { type: 'Dexlite', price: 14500 }
      ] as any[];
    }
    return data as FuelPrice[];
  },

  async updatePrice(type: string, price: number) {
    const { error } = await supabase
      .from('fuel_prices')
      .upsert({ type, price, updated_at: new Date().toISOString() }, { onConflict: 'type' });
    
    if (error) throw error;
  }
};