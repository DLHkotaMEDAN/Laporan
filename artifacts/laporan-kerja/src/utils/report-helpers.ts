import { Report, ReportCategory, Task } from "@/types/report";

export const getUnitByCategory = (category: ReportCategory | string): string => {
  if (category === "Tim Pohon") return "Pohon";
  return "m2";
};

export const categoryOrder = [
  "Taman Kota",
  "Taman Amplas",
  "Taman Area",
  "Tim Babat",
  "Tim Siram",
  "Tim Pohon"
];

export const sortByCategory = (a: string, b: string) => {
  const indexA = categoryOrder.indexOf(a);
  const indexB = categoryOrder.indexOf(b);
  
  // Jika kategori tidak ditemukan di list, taruh di paling bawah
  const priorityA = indexA === -1 ? 999 : indexA;
  const priorityB = indexB === -1 ? 999 : indexB;
  
  return priorityA - priorityB;
};

/**
 * Laporan lama menyimpan satu kegiatan pada field utama laporan, sebelum
 * field `tasks` digunakan. Pertahankan data tersebut pada seluruh rekap.
 */
export const getReportTasks = (report: Report): Task[] => {
  if (Array.isArray(report.tasks) && report.tasks.length > 0) {
    return report.tasks;
  }

  const hasLegacyTaskData = Boolean(
    report.description?.trim()
    || report.location?.street?.trim()
    || report.volume,
  );

  if (!hasLegacyTaskData) return [];

  return [{
    description: report.description || "-",
    location: report.location || { street: "", village: [], subDistrict: "" },
    photos: { zero: "", fifty: "", hundred: "" },
    volume: report.volume || 0,
    equipment: report.equipment || [],
    heavyEquipment: report.heavyEquipment || [],
    personnel: report.personnel || { coordinator: "", members: 0 },
    vehicle: report.vehicle,
    remarks: report.remarks || "",
  }];
};
