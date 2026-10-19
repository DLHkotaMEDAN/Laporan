import { saveAs } from "file-saver";
import { logger } from "@/lib/logger";
import { WorkPlan } from "@/types/workPlan";
import { loadExcelJS } from "./lazy-imports";

type ExportWorkPlanExcelOptions = {
  plans: WorkPlan[];
  title: string;
  periodLabel: string;
  fileName: string;
  includeLogo: boolean;
  logoMedanUrl?: string;
  logoDlhUrl?: string;
};

const fetchImage = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo gagal dimuat (${response.status})`);
  return response.arrayBuffer();
};

export const exportWorkPlanExcel = async ({
  plans,
  title,
  periodLabel,
  fileName,
  includeLogo,
  logoMedanUrl,
  logoDlhUrl,
}: ExportWorkPlanExcelOptions) => {
  // Lazy load ExcelJS only when export is triggered
  const ExcelJS = await loadExcelJS();

  const thinBorder: Partial<unknown> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Laporan Kerja DLH Kota Medan";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Rekap Rencana Kerja", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.views = [{ state: "frozen", ySplit: 5 }];

  sheet.mergeCells("A1:P1");
  sheet.getCell("A1").value = title.toUpperCase();
  sheet.getCell("A1").font = { bold: true, size: 16 };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = includeLogo ? 34 : 24;

  sheet.mergeCells("A2:P2");
  sheet.getCell("A2").value = "DINAS LINGKUNGAN HIDUP KOTA MEDAN";
  sheet.getCell("A2").font = { bold: true, size: 13 };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.mergeCells("A3:P3");
  sheet.getCell("A3").value = periodLabel;
  sheet.getCell("A3").font = { bold: true, size: 11 };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  if (includeLogo && logoMedanUrl && logoDlhUrl) {
    try {
      const [medanBuffer, dlhBuffer] = await Promise.all([
        fetchImage(logoMedanUrl),
        fetchImage(logoDlhUrl),
      ]);
      const medanId = workbook.addImage({ buffer: medanBuffer, extension: "jpeg" });
      const dlhId = workbook.addImage({ buffer: dlhBuffer, extension: "jpeg" });
      sheet.addImage(medanId, { tl: { col: 0.15, row: 0.1 }, ext: { width: 55, height: 55 } });
      sheet.addImage(dlhId, { tl: { col: 10.9, row: 0.1 }, ext: { width: 55, height: 55 } });
    } catch (error) {
      logger.warn("Logo tidak dapat dimasukkan ke Excel:", error);
    }
  }

  const headers = [
    "No", "Tanggal", "Kategori", "Uraian Rencana", "Lokasi", "Target Luas (M²)", "Alat",
    "Jumlah Alat", "Jumlah Personel", "Koordinator", "Mandor", "Kegunaan", "Dasar\nPengerjaan", "Kebutuhan\nBBM\n(Liter)", "Estimasi Penggunaan\nBBM (Liter)", "Keterangan",
  ];
  const headerRow = sheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.eachCell((cell: unknown) => {
    const typedCell = cell as any;
    typedCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    typedCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    typedCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    typedCell.border = thinBorder;
  });

  let rowNumber = 1;
  plans.forEach((plan) => {
    const items = plan.items?.length ? plan.items : [];
    if (!items.length) {
      sheet.addRow([rowNumber++, plan.date, plan.category, "Tidak ada rencana kerja/kegiatan", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
      return;
    }

    items.forEach((item, itemIndex) => {
      const tools = item.tools?.length ? item.tools : [{ name: "-", unit: 0, usage: "-", members: undefined }];
      tools.forEach((tool, toolIndex) => {
        const location = [
          item.location?.street,
          Array.isArray(item.location?.village) ? item.location.village.join(", ") : item.location?.village,
          item.location?.subDistrict,
        ].filter(Boolean).join(", ");

        sheet.addRow([
          itemIndex === 0 && toolIndex === 0 ? rowNumber : "",
          plan.date,
          plan.category,
          item.description || "-",
          location || "-",
          item.target_area ? Number(item.target_area) : "-",
          tool.name || "-",
          tool.unit || 0,
          tool.members ?? item.personnel?.members ?? 0,
          item.coordinator || "-",
          item.foreman || "-",
          tool.usage || "-",
          item.basis || "-",
          item.fuel_need_liters ? Number(item.fuel_need_liters) : "-",
          item.fuel_usage_estimate || "-",
          item.remarks || "-",
        ]);
      });
    });
    rowNumber += 1;
  });

  if (!plans.length) {
    sheet.mergeCells("A6:P6");
    sheet.getCell("A6").value = "Tidak ada rencana kerja pada periode yang dipilih.";
    sheet.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
  }

  for (let rowIndex = 6; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, (cell: unknown) => {
      const typedCell = cell as any;
      typedCell.border = thinBorder;
      typedCell.alignment = { vertical: "top", wrapText: true };
    });
  }

  sheet.columns = [
    { width: 6 }, { width: 13 }, { width: 18 }, { width: 34 }, { width: 35 }, { width: 16 }, { width: 22 },
    { width: 12 }, { width: 15 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 16 }, { width: 28 }, { width: 25 },
  ];
  sheet.autoFilter = { from: "A5", to: "P5" };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
};
