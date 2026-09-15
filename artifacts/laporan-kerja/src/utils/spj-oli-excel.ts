import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SpjOliRecord } from '@/types/spjOli';

const border = {
  top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
  left: { style: 'thin' as const }, right: { style: 'thin' as const },
};

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

export async function exportSpjOliExcel(
  records: SpjOliRecord[],
  title: string,
  periodLabel: string,
  regionName: (id: string) => string,
  teamName: (id: string) => string,
  showRegionColumn: boolean,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap SPJ Oli', {
    pageSetup: { orientation: 'landscape', paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = [
    'No', 'Tanggal', 'No. SPJ',
    ...(showRegionColumn ? ['Wilayah'] : []),
    'Tim', 'Alat Operasional/\nKendaraan', 'Nama Operator/\nSupir/Penerima',
    'Jenis Oli', 'Jumlah', 'Lokasi', 'Keterangan',
  ];
  const lastColumn = showRegionColumn ? 'K' : 'J';

  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell('A1').value = 'REKAP SPJ OLI';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell('A2').value = title.toUpperCase();
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.mergeCells(`A3:${lastColumn}3`);
  sheet.getCell('A3').value = periodLabel;
  sheet.getCell('A3').alignment = { horizontal: 'center' };

  const header = sheet.addRow(headers);
  header.height = 36;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });

  records.forEach((record, index) => {
    sheet.addRow([
      index + 1,
      formatDate(record.date),
      record.spj_number,
      ...(showRegionColumn ? [regionName(record.region_id)] : []),
      teamName(record.team_id),
      record.vehicle_name || '-',
      record.operator_name || record.receiver_name || '-',
      record.oil_name,
      `${record.quantity} ${record.unit}`,
      record.location || '-',
      record.remarks || '-',
    ]);
  });

  sheet.eachRow((row, index) => {
    if (index < 5) return;
    row.height = 32;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = border;
    });
  });

  sheet.columns = showRegionColumn
    ? [{ width: 6 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 20 }, { width: 28 }, { width: 28 }, { width: 20 }, { width: 14 }, { width: 28 }, { width: 28 }]
    : [{ width: 6 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 28 }, { width: 28 }, { width: 20 }, { width: 14 }, { width: 28 }, { width: 28 }];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Rekap_SPJ_Oli_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
