type RecapPeriod = "harian" | "mingguan" | "bulanan";

const categoryLabels: Record<string, string> = {
  "Taman Kota": "TAMAN",
  "Taman Amplas": "TAMAN",
  "Taman Area": "TAMAN",
  "Tim Siram": "PENYIRAMAN",
  "Tim Babat": "PEMBABATAN",
  "Tim Pohon": "POHON",
};

const joinLabels = (labels: string[]) => {
  if (labels.length <= 1) return labels[0] || "KEGIATAN";
  if (labels.length === 2) return `${labels[0]} DAN ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} DAN ${labels[labels.length - 1]}`;
};

export const getRecapCategoryLabel = (categories: string[]) => {
  const labels = Array.from(
    new Set(
      categories
        .map((category) => categoryLabels[category] || category.toUpperCase())
        .filter(Boolean),
    ),
  );
  return joinLabels(labels);
};

export const getReportRecapTitle = (
  period: RecapPeriod,
  categories: string[],
) => {
  return `LAPORAN ${period.toUpperCase()} ${getRecapCategoryLabel(categories)}`;
};
