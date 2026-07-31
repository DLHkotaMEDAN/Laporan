export interface Equipment {
  type: string;
  quantity: number;
}

export interface FuelUsage {
  pertamax: number;
  pertamax_liter?: number;
  dexlite: number;
  dexlite_liter?: number;
  solar: number;
  solar_liter?: number;
  remarks?: string;
}

export interface HeavyEquipment {
  type: string;
  vehicle?: string;
  fuel: FuelUsage;
}

export interface Personnel {
  coordinator: string;
  members: number;
}

export interface Location {
  street: string;
  village: string[];
  subDistrict: string;
}

export interface Photos {
  zero: string;
  fifty: string;
  hundred: string;
}

export interface Task {
  description: string;
  location: Location;
  photos: Photos;
  volume: number;
  equipment: Equipment[];
  heavyEquipment: HeavyEquipment[];
  personnel: Personnel;
  vehicle?: string;
  remarks?: string;
}

export type ReportCategory = string;

export interface Report {
  id: string;
  date: string;
  category: ReportCategory;
  vehicle?: string;
  description: string;
  location: Location;
  tasks: Task[];
  equipment: Equipment[];
  heavyEquipment: HeavyEquipment[];
  fuel: FuelUsage;
  personnel: Personnel;
  remarks: string;
  pimpinan_note?: string;
  price_pertamax?: number; // Field baru
  price_dexlite?: number;  // Field baru
  createdAt: string;
  unit: string;
  volume: number;
  region_id?: string | null;
  team_id?: string | null;
}
