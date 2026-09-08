"use client";

export type FuelType = "Pertamax" | "Dexlite" | "Oli";

export interface FuelUsageItem {
  vehicle_operator: string;
  fuel_type: FuelType;
  amount: number; // Tetap dipertahankan untuk kompatibilitas data lama
  amount_rp: number; // Kolom baru
  amount_liter: number; // Kolom baru
  item_remarks?: string;
  activity_detail?: string;
  is_location_same?: boolean;
  requires_fuel?: boolean;
  location: {
    street: string;
    subDistrict?: string;
    village?: string;
  };
}

export interface FuelReport {
  id: string;
  date: string;
  region: string;
  team: string;
  region_id?: string | null;
  team_id?: string | null;
  items: FuelUsageItem[];
  remarks: string;
  price_pertamax: number; // Field baru
  price_dexlite: number;  // Field baru
  pimpinan_note?: string;
  created_at?: string;
  deleted_at?: string | null;
}
