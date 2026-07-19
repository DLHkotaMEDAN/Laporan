import { ReportCategory } from "@/types/report";

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
