import { saveAs } from 'file-saver';
import { SpjOliRecord } from '@/types/spjOli';
import { loadExcelJS } from './lazy-imports';

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
  fileName: string,
) {
  // Lazy load ExcelJS only when export is triggered
  const ExcelJS = await loadExcelJS();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap SPJ Oli', {
    // Keep A3 (paper-size code 8); ExcelJS's PaperSize declaration omits this valid OOXML value.
    pageSetup: { orientation: 'landscape', paperSize: 8 as any, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = [
    'No', 'No. SPJ', 'Tanggal',
    ...(showRegionColumn ? ['Wilayah'] : []),
    'Tim', 'Alat Operasional/\nKendaraan', 'Nama Operator/\nPengemudi', 'Nama Penerima',
    'Jenis Oli / Minyak Rem', 'Jumlah', 'Lokasi', 'Keterangan',
  ];
  const lastColumn = showRegionColumn ? 'L' : 'K';

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
  header.eachCell((cell: unknown) => {
    const typedCell = cell as any;
    typedCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    typedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    typedCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    typedCell.border = border;
  });

  records.forEach((record, index) => {
    sheet.addRow([
      index + 1,
      record.spj_number,
      formatDate(record.date),
      ...(showRegionColumn ? [regionName(record.region_id)] : []),
      teamName(record.team_id),
      record.vehicle_name || '-',
      record.operator_name || '-',
      record.receiver_name || '-',
      record.oil_name,
      `${record.quantity} ${record.unit}`,
      record.location || '-',
      record.remarks || '-',
    ]);
  });

  // Gabungkan sel Tanggal untuk record yang berurutan pada tanggal yang sama,
  // sama seperti tabel rekap pada layar dan hasil cetak.
  let start = 0;
  while (start < records.length) {
    let end = start + 1;
    while (end < records.length && records[end].date === records[start].date) end += 1;
    if (end - start > 1) {
      const firstDataRow = start + 5;
      const lastDataRow = end + 4;
      sheet.mergeCells(firstDataRow, 3, lastDataRow, 3);
      sheet.getCell(firstDataRow, 3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    start = end;
  }

  // Kolom Wilayah pada Excel mengikuti tabel rekap: gabungkan hanya jika
  // tanggal dan wilayah pada baris yang berurutan memang sama.
  if (showRegionColumn) {
    start = 0;
    while (start < records.length) {
      let end = start + 1;
      while (
        end < records.length
        && records[end].date === records[start].date
        && records[end].region_id === records[start].region_id
      ) end += 1;
      if (end - start > 1) {
        const firstDataRow = start + 5;
        const lastDataRow = end + 4;
        sheet.mergeCells(firstDataRow, 4, lastDataRow, 4);
        sheet.getCell(firstDataRow, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
      start = end;
    }
  }

  sheet.eachRow((row: unknown, index: number) => {
    if (index < 5) return;
    const typedRow = row as any;
    typedRow.height = 32;
    typedRow.eachCell((cell: unknown) => {
      const typedCell = cell as any;
      typedCell.alignment = { vertical: 'top', wrapText: true };
      typedCell.border = border;
    });
  });

  sheet.columns = showRegionColumn
    ? [{ width: 6 }, { width: 18 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 10 }, { width: 34 }, { width: 24 }]
    : [{ width: 6 }, { width: 18 }, { width: 10 }, { width: 18 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 10 }, { width: 34 }, { width: 24 }];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}.xlsx`);
}
