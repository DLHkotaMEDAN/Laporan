import { jsPDF } from 'jspdf';
import { Report, Task } from '@/types/report';
import { getUnitByCategory } from '@/utils/report-helpers';

export type RecapPdfKind = 'daily' | 'weekly' | 'monthly';
export type RecapPdfFuelMode = 'none' | 'daily' | 'voucher';
export type RecapPdfSignatureMode = 'with-signature' | 'without-signature';

export type RecapPdfVisibleColumns = {
  date: boolean;
  category: boolean;
  description: boolean;
  location: boolean;
  photos: boolean;
  volume: boolean;
  equipment: boolean;
  heavyEquipment: boolean;
  fuel: boolean;
  coordinator: boolean;
  members: boolean;
  remarks: boolean;
};

type FlatTask = Task & {
  reportId: string;
  reportDate: string;
  category: Report['category'];
  reportRemarks?: string;
};

type PdfColumn = {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  isPhoto?: boolean;
};

type GenerateRecapDrivePdfOptions = {
  reports: Report[];
  kind: RecapPdfKind;
  periodLabel: string;
  title?: string;
  logoMedanUrl: string;
  logoDlhUrl: string;
  visibleColumns?: RecapPdfVisibleColumns;
  fuelMode?: RecapPdfFuelMode;
  signatureMode: RecapPdfSignatureMode;
  coordinatorName: string;
  coordinatorNip: string;
};

export const getRegionalCoordinatorSignature = (regionName: string) => {
  if (regionName.includes('WILAYAH 4') || regionName.includes('WILAYAH 5')) {
    return { name: 'Tiurmaida Silitonga, SE', nip: 'NIP. 196905072007012042' };
  }

  if (regionName.includes('WILAYAH 1') || regionName.includes('WILAYAH 2') || regionName.includes('WILAYAH 3')) {
    return { name: 'Ramli Munte', nip: 'NIP. 197907112025211048' };
  }

  return { name: '____________________________', nip: '____________________________' };
};

const defaultColumns: RecapPdfVisibleColumns = {
  date: true,
  category: true,
  description: true,
  location: true,
  photos: true,
  volume: true,
  equipment: true,
  heavyEquipment: true,
  fuel: false,
  coordinator: true,
  members: true,
  remarks: true,
};

const imageCache = new Map<string, string | null>();

const toDataUrl = async (url?: string) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (imageCache.has(url)) return imageCache.get(url) ?? null;

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('image fetch failed');
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    imageCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    imageCache.set(url, null);
    return null;
  }
};

const imageFormat = (dataUrl: string) => {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'JPEG';
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const numberText = (value?: number) => {
  if (!value) return '0';
  return Number.isInteger(value) ? value.toLocaleString('id-ID') : value.toFixed(2);
};

const getVillages = (task: Task) => {
  const villages = task.location?.village;
  return Array.isArray(villages) ? villages.join(', ') : villages || '';
};

const getLocationText = (task: Task) => {
  return [task.location?.street, getVillages(task), task.location?.subDistrict]
    .filter(Boolean)
    .join(', ');
};

const sumFuel = (task: Task, key: 'pertamax' | 'pertamax_liter' | 'dexlite' | 'dexlite_liter' | 'solar' | 'solar_liter') => {
  return task.heavyEquipment?.reduce((acc, item) => acc + (item.fuel?.[key] || 0), 0) || 0;
};

const flattenReports = (reports: Report[]): FlatTask[] => {
  return reports.flatMap(report =>
    (report.tasks || []).map(task => ({
      ...task,
      reportId: report.id,
      reportDate: report.date,
      category: report.category,
      reportRemarks: report.remarks,
    }))
  );
};

const buildColumns = (visible: RecapPdfVisibleColumns, fuelMode: RecapPdfFuelMode): PdfColumn[] => {
  const columns: PdfColumn[] = [{ key: 'no', header: 'No', width: 10, align: 'center' }];
  if (visible.date) columns.push({ key: 'date', header: 'Hari / Tgl', width: 24, align: 'center' });
  if (visible.category) columns.push({ key: 'category', header: 'Tim/Kec.', width: 22, align: 'center' });
  if (visible.description) columns.push({ key: 'description', header: 'Uraian Kegiatan', width: 34 });
  if (visible.location) columns.push({ key: 'location', header: 'Lokasi', width: 42 });
  if (visible.photos) {
    columns.push(
      { key: 'photo0', header: '0%', width: 28, align: 'center', isPhoto: true },
      { key: 'photo50', header: '50%', width: 28, align: 'center', isPhoto: true },
      { key: 'photo100', header: '100%', width: 28, align: 'center', isPhoto: true },
    );
  }
  if (visible.volume) columns.push({ key: 'volume', header: 'Vol', width: 16, align: 'center' });
  if (visible.equipment) {
    columns.push(
      { key: 'equipmentType', header: 'Jenis Alat', width: 23 },
      { key: 'equipmentQty', header: 'Jml', width: 10, align: 'center' },
    );
  }
  if (visible.heavyEquipment) columns.push({ key: 'heavyEquipment', header: 'Alat Berat', width: 28 });
  if (visible.fuel && fuelMode === 'daily') {
    columns.push(
      { key: 'pertamaxRp', header: 'Pertamax (Rp)', width: 18, align: 'right' },
      { key: 'pertamaxL', header: 'Pertamax (L)', width: 15, align: 'center' },
      { key: 'dexliteRp', header: 'Dexlite (Rp)', width: 18, align: 'right' },
      { key: 'dexliteL', header: 'Dexlite (L)', width: 15, align: 'center' },
    );
  }
  if (visible.fuel && fuelMode === 'voucher') {
    columns.push(
      { key: 'pertamaxRp', header: 'Pertamax (Rp)', width: 18, align: 'right' },
      { key: 'pertamaxL', header: 'Pertamax (L)', width: 15, align: 'center' },
      { key: 'dexliteRp', header: 'Dexlite (Rp)', width: 18, align: 'right' },
      { key: 'dexliteL', header: 'Dexlite (L)', width: 15, align: 'center' },
      { key: 'solarRp', header: 'S (Rp)', width: 14, align: 'right' },
    );
  }
  if (visible.coordinator) columns.push({ key: 'coordinator', header: 'Koordinator', width: 24, align: 'center' });
  if (visible.members) columns.push({ key: 'members', header: 'Anggota', width: 13, align: 'center' });
  if (visible.remarks) columns.push({ key: 'remarks', header: 'Keterangan', width: 34 });
  return columns;
};

const getRowValue = (task: FlatTask, key: string, rowNo: number) => {
  switch (key) {
    case 'no':
      return String(rowNo);
    case 'date':
      return formatDate(task.reportDate);
    case 'category':
      return task.category;
    case 'description':
      return task.description || '-';
    case 'location':
      return getLocationText(task) || '-';
    case 'volume':
      return `${task.volume || 0} ${getUnitByCategory(task.category)}`;
    case 'equipmentType':
      return task.equipment?.map(item => item.type).filter(Boolean).join('\n') || '-';
    case 'equipmentQty':
      return task.equipment?.map(item => numberText(item.quantity)).join('\n') || '-';
    case 'heavyEquipment':
      return task.heavyEquipment?.map(item => `${item.type || ''} ${item.vehicle || ''}`.trim()).filter(Boolean).join('\n') || '-';
    case 'pertamaxRp':
      return numberText(sumFuel(task, 'pertamax'));
    case 'pertamaxL':
      return numberText(sumFuel(task, 'pertamax_liter'));
    case 'dexliteRp':
      return numberText(sumFuel(task, 'dexlite'));
    case 'dexliteL':
      return numberText(sumFuel(task, 'dexlite_liter'));
    case 'solarRp':
      return numberText(sumFuel(task, 'solar'));
    case 'coordinator':
      return task.personnel?.coordinator || '-';
    case 'members':
      return numberText(task.personnel?.members || 0);
    case 'remarks': {
      const notes = [];
      if (task.remarks) notes.push(task.remarks);
      if (task.reportRemarks) notes.push(`Catatan: ${task.reportRemarks}`);
      return notes.join('\n') || '-';
    }
    default:
      return '';
  }
};

const getPhotoUrl = (task: FlatTask, key: string) => {
  if (key === 'photo0') return task.photos?.zero;
  if (key === 'photo50') return task.photos?.fifty;
  if (key === 'photo100') return task.photos?.hundred;
  return undefined;
};

const fitColumns = (columns: PdfColumn[], contentWidth: number) => {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const factor = total > contentWidth ? contentWidth / total : 1;
  return columns.map(column => ({ ...column, width: column.width * factor }));
};

const drawText = (pdf: jsPDF, text: string | string[], x: number, y: number, options?: Parameters<jsPDF['text']>[3]) => {
  pdf.text(text, x, y, options);
};

const drawTableHeader = (pdf: jsPDF, columns: PdfColumn[], x: number, y: number, height: number) => {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setFillColor(241, 245, 249);
  let currentX = x;
  columns.forEach(column => {
    pdf.rect(currentX, y, column.width, height, 'FD');
    const lines = pdf.splitTextToSize(column.header, column.width - 2);
    drawText(pdf, lines, currentX + column.width / 2, y + 4.2, { align: 'center', baseline: 'middle' });
    currentX += column.width;
  });
};

const drawCellText = (pdf: jsPDF, text: string, column: PdfColumn, x: number, y: number, width: number, height: number) => {
  const lines = pdf.splitTextToSize(text, width - 2).slice(0, Math.max(1, Math.floor((height - 2) / 3.1)));
  const textX = column.align === 'center' ? x + width / 2 : column.align === 'right' ? x + width - 1.3 : x + 1.3;
  drawText(pdf, lines, textX, y + 3.2, { align: column.align || 'left' });
};

const drawDocumentHeader = async (
  pdf: jsPDF,
  options: GenerateRecapDrivePdfOptions,
  margin: number,
  pageWidth: number,
) => {
  const centerX = pageWidth / 2;
  const logoMedan = await toDataUrl(options.logoMedanUrl);
  const logoDlh = await toDataUrl(options.logoDlhUrl);

  if (logoMedan) {
    pdf.addImage(logoMedan, imageFormat(logoMedan), margin + 18, margin, 18, 18);
  }
  if (logoDlh) {
    pdf.addImage(logoDlh, imageFormat(logoDlh), pageWidth - margin - 36, margin, 18, 18);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  drawText(pdf, 'PEMERINTAH KOTA MEDAN', centerX, margin + 5, { align: 'center' });
  pdf.setFontSize(15);
  drawText(pdf, 'DINAS LINGKUNGAN HIDUP', centerX, margin + 11, { align: 'center' });
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  drawText(pdf, 'Jl. Pinang Baris, Lalang Kec. Medan Sunggal, Kota Medan, Sumatera Utara', centerX, margin + 16, { align: 'center' });
  pdf.line(margin, margin + 22, pageWidth - margin, margin + 22);
  pdf.line(margin, margin + 23.5, pageWidth - margin, margin + 23.5);

  const titleByKind = {
    daily: 'LAPORAN HARIAN PEKERJAAN TAMAN, PENGHIJAUAN, POHON DAN PEMBABATAN',
    weekly: 'LAPORAN MINGGUAN PEKERJAAN TAMAN, PENGHIJAUAN, POHON DAN PEMBABATAN',
    monthly: 'LAPORAN BULANAN PEKERJAAN TAMAN, PENGHIJAUAN, POHON DAN PEMBABATAN',
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  drawText(pdf, options.title || titleByKind[options.kind], centerX, margin + 32, { align: 'center' });
  pdf.setFontSize(10);
  drawText(pdf, 'WILAYAH 4 MEDAN KOTA', centerX, margin + 38, { align: 'center' });
  drawText(pdf, options.periodLabel, centerX, margin + 44, { align: 'center' });
  return margin + 52;
};

const addSignatures = (pdf: jsPDF, options: GenerateRecapDrivePdfOptions, margin: number, pageWidth: number, pageHeight: number, y: number) => {
  if (options.signatureMode !== 'with-signature') return;
  if (y + 62 > pageHeight - margin) {
    pdf.addPage('a3', 'landscape');
    y = margin;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  drawText(pdf, `Medan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - margin - 50, y + 4, { align: 'center' });

  const columnWidth = (pageWidth - margin * 2) / 4;
  const blocks = [
    ['Mengetahui :', 'Kabid Tata Lingkungan', 'Dinas Lingkungan Hidup', 'Kota Medan', '', '', 'Heni Rustati, ST, M.Si', 'NIP. 19720223 200604 2 002'],
    ['Diketahui :', 'Ketua Tim Pemeliharaan Lingkungan', 'Dinas Lingkungan Hidup', 'Kota Medan', '', '', 'Anitha Florida Ginting, ST, M. Si', 'NIP. 19811128 201001 2 011'],
    ['Diketahui :', 'Pengawas Taman Penghijauan', 'Dinas Lingkungan Hidup', 'Kota Medan', '', '', '____________________________', '____________________________'],
  ];

  const coordinatorBlock = ['Diketahui :', 'Kepala Koordinator Pemeliharaan Taman', 'Dinas Lingkungan Hidup', 'Kota Medan', '', '', options.coordinatorName, options.coordinatorNip];

  [...blocks, coordinatorBlock].forEach((block, index) => {
    const x = margin + columnWidth * index + columnWidth / 2;
    block.forEach((line, lineIndex) => {
      if (!line) return;
      pdf.setFont('helvetica', lineIndex === 1 || lineIndex === 6 ? 'bold' : 'normal');
      drawText(pdf, line, x, y + 15 + lineIndex * 5, { align: 'center' });
    });
  });
};

export const generateRecapDrivePdfBase64 = async (options: GenerateRecapDrivePdfOptions) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const visible = options.visibleColumns || defaultColumns;
  const fuelMode = options.fuelMode || 'none';
  const columns = fitColumns(buildColumns(visible, fuelMode), contentWidth);
  const tableHeaderHeight = 10;
  const rowPadding = 2;
  const lineHeight = 3.1;

  let y = await drawDocumentHeader(pdf, options, margin, pageWidth);
  drawTableHeader(pdf, columns, margin, y, tableHeaderHeight);
  y += tableHeaderHeight;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);

  const tasks = flattenReports(options.reports);
  if (tasks.length === 0) {
    pdf.rect(margin, y, contentWidth, 16);
    drawText(pdf, 'Tidak ada data laporan untuk periode ini', pageWidth / 2, y + 9, { align: 'center' });
    y += 20;
  }

  let currentNo = 0;
  let lastGroup = '';
  for (const task of tasks) {
    const groupKey = options.kind === 'daily' ? task.reportId : task.reportDate;
    if (groupKey !== lastGroup) {
      currentNo += 1;
      lastGroup = groupKey;
    }

    const textHeights = columns
      .filter(column => !column.isPhoto)
      .map(column => {
        const value = getRowValue(task, column.key, currentNo);
        return pdf.splitTextToSize(value, column.width - 2).length * lineHeight + rowPadding * 2;
      });
    const rowHeight = Math.max(visible.photos ? 28 : 8, ...textHeights);

    if (y + rowHeight > pageHeight - margin - (options.signatureMode === 'with-signature' ? 54 : 0)) {
      pdf.addPage('a3', 'landscape');
      y = margin;
      drawTableHeader(pdf, columns, margin, y, tableHeaderHeight);
      y += tableHeaderHeight;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
    }

    let x = margin;
    for (const column of columns) {
      pdf.rect(x, y, column.width, rowHeight);
      if (column.isPhoto) {
        const dataUrl = await toDataUrl(getPhotoUrl(task, column.key));
        if (dataUrl) {
          try {
            pdf.addImage(dataUrl, imageFormat(dataUrl), x + 1, y + 1, column.width - 2, rowHeight - 2);
          } catch {
            drawText(pdf, 'Foto', x + column.width / 2, y + rowHeight / 2, { align: 'center', baseline: 'middle' });
          }
        } else {
          drawText(pdf, '-', x + column.width / 2, y + rowHeight / 2, { align: 'center', baseline: 'middle' });
        }
      } else {
        drawCellText(pdf, getRowValue(task, column.key, currentNo), column, x, y, column.width, rowHeight);
      }
      x += column.width;
    }
    y += rowHeight;
  }

  if (options.kind === 'daily' && visible.fuel && fuelMode === 'daily' && tasks.length > 0) {
    const totals = {
      pertamaxRp: tasks.reduce((sum, task) => sum + sumFuel(task, 'pertamax'), 0),
      pertamaxL: tasks.reduce((sum, task) => sum + sumFuel(task, 'pertamax_liter'), 0),
      dexliteRp: tasks.reduce((sum, task) => sum + sumFuel(task, 'dexlite'), 0),
      dexliteL: tasks.reduce((sum, task) => sum + sumFuel(task, 'dexlite_liter'), 0),
    } as Record<string, number>;
    const totalHeight = 9;
    if (y + totalHeight > pageHeight - margin) {
      pdf.addPage('a3', 'landscape');
      y = margin;
    }
    let x = margin;
    pdf.setFont('helvetica', 'bold');
    columns.forEach(column => {
      pdf.rect(x, y, column.width, totalHeight, 'S');
      if (column.key === 'remarks') {
        drawCellText(pdf, 'TOTAL PEMAKAIAN BBM', column, x, y, column.width, totalHeight);
      }
      if (totals[column.key] !== undefined) {
        drawCellText(pdf, numberText(totals[column.key]), column, x, y, column.width, totalHeight);
      }
      x += column.width;
    });
    pdf.setFont('helvetica', 'normal');
    y += totalHeight + 6;
  } else {
    y += 6;
  }

  addSignatures(pdf, options, margin, pageWidth, pageHeight, y);
  return pdf.output('datauristring').split(',')[1];
};
