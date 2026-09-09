import { FuelType, FuelUsageItem } from '@/types/fuelReport';

export type RecapFuelItem = FuelUsageItem & {
  date?: string;
  region: string;
  team: string;
  remarks: string;
  reportId?: string;
  pertamax_rp: number;
  pertamax_liter: number;
  dexlite_rp: number;
  dexlite_liter: number;
  oli_liter: number;
};

const text = (value: unknown) => String(value ?? '').trim();

export function mergeFuelRecapItems<T extends { items: FuelUsageItem[]; region: string; team: string; remarks: string; date?: string; id?: string }>(reports: T[]): RecapFuelItem[] {
  const grouped = new Map<string, RecapFuelItem>();

  reports.forEach(report => report.items.forEach(item => {
    const locationKey = [item.location?.street, item.location?.subDistrict, item.location?.village].map(text).join('|');
    const key = [report.id, item.vehicle_operator, item.item_remarks, item.activity_detail, locationKey].map(text).join('||');
    const existing = grouped.get(key);
    const amountRp = Number(item.amount_rp || item.amount || 0);
    const amountLiter = Number(item.amount_liter || (item.fuel_type === 'Oli' ? item.amount : 0) || 0);

    if (existing) {
      if (item.fuel_type === 'Pertamax') { existing.pertamax_rp += amountRp; existing.pertamax_liter += amountLiter; }
      if (item.fuel_type === 'Dexlite') { existing.dexlite_rp += amountRp; existing.dexlite_liter += amountLiter; }
      if (item.fuel_type === 'Oli') existing.oli_liter += amountLiter;
      return;
    }

    const merged: RecapFuelItem = {
      ...item,
      date: report.date,
      region: report.region,
      team: report.team,
      remarks: report.remarks,
      reportId: report.id,
      pertamax_rp: item.fuel_type === 'Pertamax' ? amountRp : 0,
      pertamax_liter: item.fuel_type === 'Pertamax' ? amountLiter : 0,
      dexlite_rp: item.fuel_type === 'Dexlite' ? amountRp : 0,
      dexlite_liter: item.fuel_type === 'Dexlite' ? amountLiter : 0,
      oli_liter: item.fuel_type === 'Oli' ? amountLiter : 0,
    };
    grouped.set(key, merged);
  }));

  return Array.from(grouped.values());
}

export const fuelAmount = (item: RecapFuelItem, type: FuelType, unit: 'rp' | 'liter') => {
  if (type === 'Pertamax') return unit === 'rp' ? item.pertamax_rp : item.pertamax_liter;
  if (type === 'Dexlite') return unit === 'rp' ? item.dexlite_rp : item.dexlite_liter;
  return item.oli_liter;
};
