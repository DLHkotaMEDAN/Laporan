"use client";

import { Location } from "./report";

export interface WorkPlanTool {
  name: string;
  unit: number;
  usage: string;
  members?: number;
}

export interface WorkPlanItem {
  description: string;
  location: Location;
  tools: WorkPlanTool[];
  coordinator: string;
  personnel: {
    members: number;
  };
  basis: string;
  remarks: string;
}

export interface WorkPlan {
  id: string;
  date: string;
  category: string;
  items: WorkPlanItem[];
  created_at: string;
  is_visible: boolean;
  has_no_activity?: boolean;
  pimpinan_note?: string; // Field baru untuk penilaian pimpinan
  region_id?: string | null;
  team_id?: string | null;
}
