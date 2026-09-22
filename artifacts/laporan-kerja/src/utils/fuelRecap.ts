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
  recap_locations: RecapLocationEntry[];
  usageGroupId: string;
};

export type RecapLocationEntry = {
  street: string;
  subDistrict?: string;
  village?: string;
  activity_detail?: string;
};

const text = (value: unknown) => String(value ?? '').trim();

export function mergeFuelRecapItems<T extends { items: FuelUsageItem[]; region: string; team: string; remarks: string; date?: string; id?: string }>(reports: T[]): RecapFuelItem[] {
  const grouped = new Map<string, RecapFuelItem>();

  reports.forEach(report => {
    let usageGroup = 0;
    let currentGroup: RecapFuelItem[] = [];
    let currentLocations: RecapLocationEntry[] = [];

    report.items.forEach(item => {
      const locationEntry: RecapLocationEntry = {
        street: item.location?.street || '',
        subDistrict: item.location?.subDistrict,
        village: item.location?.village,
        activity_detail: item.activity_detail || '',
      };

      // This is a location marker, not another vehicle/tool or another fuel usage.
      // Attach it to every tool in the preceding usage group so the recap keeps
      // the three operational tools together without duplicating fuel totals.
      if (item.requires_fuel === false) {
        const locationKey = [locationEntry.street, locationEntry.subDistrict, locationEntry.village, locationEntry.activity_detail].map(text).join('|');
        if (locationEntry.street && !currentLocations.some(entry => [entry.street, entry.subDistrict, entry.village, entry.activity_detail].map(text).join('|') === locationKey)) {
          currentLocations = [...currentLocations, locationEntry];
          currentGroup.forEach(row => { row.recap_locations = [...currentLocations]; });
        }
        return;
      }

      if (!item.is_location_same || currentGroup.length === 0) {
        usageGroup += 1;
        currentGroup = [];
        currentLocations = [locationEntry];
      }

      const locationKey = [locationEntry.street, locationEntry.subDistrict, locationEntry.village].map(text).join('|');
      const key = [report.id, usageGroup, item.vehicle_operator, item.item_remarks, item.activity_detail, locationKey].map(text).join('||');
      const existing = grouped.get(key);
      const amountRp = Number(item.amount_rp || item.amount || 0);
      const amountLiter = Number(item.amount_liter || (item.fuel_type === 'Oli' ? item.amount : 0) || 0);

      if (existing) {
        if (item.fuel_type === 'Pertamax') { existing.pertamax_rp += amountRp; existing.pertamax_liter += amountLiter; }
        if (item.fuel_type === 'Dexlite') { existing.dexlite_rp += amountRp; existing.dexlite_liter += amountLiter; }
        if (item.fuel_type === 'Oli') existing.oli_liter += amountLiter;
        existing.recap_locations = [...currentLocations];
        if (!currentGroup.includes(existing)) currentGroup.push(existing);
        return;
      }

      const merged: RecapFuelItem = {
        ...item,
        date: report.date,
        region: report.region,
        team: report.team,
        remarks: report.remarks,
        reportId: report.id,
        usageGroupId: `${report.id}-${usageGroup}`,
        recap_locations: [...currentLocations],
        pertamax_rp: item.fuel_type === 'Pertamax' ? amountRp : 0,
        pertamax_liter: item.fuel_type === 'Pertamax' ? amountLiter : 0,
        dexlite_rp: item.fuel_type === 'Dexlite' ? amountRp : 0,
        dexlite_liter: item.fuel_type === 'Dexlite' ? amountLiter : 0,
        oli_liter: item.fuel_type === 'Oli' ? amountLiter : 0,
      };
      grouped.set(key, merged);
      currentGroup.push(merged);
    });
  });

  return Array.from(grouped.values());
}

export const fuelAmount = (item: RecapFuelItem, type: FuelType, unit: 'rp' | 'liter') => {
  if (type === 'Pertamax') return unit === 'rp' ? item.pertamax_rp : item.pertamax_liter;
  if (type === 'Dexlite') return unit === 'rp' ? item.dexlite_rp : item.dexlite_liter;
  return item.oli_liter;
};

/** Penanda lokasi tambahan tidak boleh ditampilkan sebagai kendaraan/alat baru. */
export const recapVehicleLabel = (item: Pick<RecapFuelItem, 'vehicle_operator' | 'requires_fuel'>) =>
  item.requires_fuel === false ? 'Lokasi tambahan (BBM sama)' : item.vehicle_operator || '-';

const formatRecapLocation = (location: RecapLocationEntry) =>
  [location.street, location.subDistrict, location.village]
    .filter(value => value && value !== ' ')
    .join(', ') || '-';

export const recapLocationLabel = (item: Pick<RecapFuelItem, 'location' | 'recap_locations'>) => {
  const locations = item.recap_locations?.length ? item.recap_locations : [item.location];
  const numbered = locations.length > 1;
  return locations
    .map((location, index) => `${numbered ? `${index + 1}. ` : ''}${formatRecapLocation(location)}`)
    .join('\n');
};

export const recapActivityLabel = (item: Pick<RecapFuelItem, 'activity_detail' | 'item_remarks' | 'remarks' | 'recap_locations'>) => {
  const locations = item.recap_locations || [];
  const activities = locations.map(location => text(location.activity_detail));
  if (activities.some(Boolean)) {
    const numbered = activities.length > 1;
    return activities
      .map((activity, index) => `${numbered ? `${index + 1}. ` : ''}${activity || '-'}`)
      .join('\n');
  }
  return item.activity_detail || item.item_remarks || item.remarks || '-';
};

export function getMergedCellSpan<T extends { reportId?: string }>(items: T[], index: number, getValue: (item: T) => string) {
  const current = items[index];
  const value = getValue(current);
  if (index > 0 && items[index - 1].reportId === current.reportId && getValue(items[index - 1]) === value) return 0;
  let span = 1;
  for (let next = index + 1; next < items.length; next += 1) {
    const nextItem = items[next];
    if (nextItem.reportId !== current.reportId || getValue(nextItem) !== value) break;
    span += 1;
  }
  return span;
}
