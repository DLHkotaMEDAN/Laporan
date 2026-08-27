import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

export const dailyPdfFileName = (title: string, date: string, regionName: string) => {
  const dateLabel = date === "semua"
    ? "SEMUA TANGGAL"
    : format(parseISO(date), "EEEE, dd-MM-yyyy", { locale: localeId }).toUpperCase();
  return `${normalized(title)} ${dateLabel}, ${normalized(regionName)}.pdf`;
};

export const weeklyPdfFileName = (title: string, startDate: Date, endDate: Date, regionName: string) => {
  const period = `${format(startDate, "dd-MM-yyyy")} s.d. ${format(endDate, "dd-MM-yyyy")}`;
  return `${normalized(title)} ${period}, ${normalized(regionName)}.pdf`;
};

export const monthlyPdfFileName = (title: string, month: number, year: string, regionName: string) => {
  const monthLabel = format(new Date(Number(year), month - 1, 1), "MMMM yyyy", { locale: localeId });
  return `${normalized(title)} ${monthLabel.toUpperCase()}, ${normalized(regionName)}.pdf`;
};
