export interface SpjOliRecord {
  id: string;
  date: string;
  region_id: string;
  team_id: string;
  spj_number: string;
  vehicle_name?: string | null;
  receiver_name?: string | null;
  operator_name?: string | null;
  oil_name: string;
  quantity: number;
  unit: string;
  location?: string | null;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}
