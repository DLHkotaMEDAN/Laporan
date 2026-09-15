export interface SpjOliRecord {
  id: string;
  date: string;
  region_id: string;
  team_id: string;
  spj_number: string;
  oil_name: string;
  quantity: number;
  unit: string;
  location?: string | null;
  remarks?: string | null;
  created_at?: string;
  updated_at?: string;
}
