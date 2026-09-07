export interface OvertimeRecord {
  id: string;
  date: string;
  name: string;
  nip: string;
  position: string;
  work_location: string;
  photo_url: string;
  start_time: string;
  end_time: string;
  attendance_count: number;
  region_id: string | null;
  created_at?: string;
  updated_at?: string;
}
