/**
 * Type definitions for Excel export operations
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

export interface ExcelRowData {
  no?: string | number;
  date?: string;
  cat?: string;
  desc?: string;
  location?: string;
  village?: string;
  // Add other common fields as needed
}

export interface TaskEquipment {
  type: string;
  quantity?: number;
}

export interface TaskHeavyEquipment {
  type: string;
  vehicle?: string;
  fuel?: {
    pertamax?: number;
    pertamax_liter?: string;
    dexlite?: number;
    dexlite_liter?: string;
    solar?: number;
  };
}

export interface TaskData {
  reportId: string;
  location: {
    village: string | string[];
  };
  equipment?: TaskEquipment[];
  heavyEquipment?: TaskHeavyEquipment[];
  // Add other task fields as needed
}
