export interface OvertimeRecord {
  id: string;
  date: string;
  name: string;
  nip: string;
  position: string;
  work_location: string;
  photo_url: string;
  photo_before_url: string;
  photo_after_url: string;
  start_time: string;
  end_time: string;
  attendance_count: number;
  region_id: string | null;
  team_id: string | null;
  team?: { name: string } | null;
  region?: { name: string } | null;
  created_at?: string;
  updated_at?: string;
}
