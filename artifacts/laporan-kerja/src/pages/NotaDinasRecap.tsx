import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, FileDown, FileText, Loader2, Printer, Table } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format, isWithinInterval, parseISO, startOfMonth, startOfWeek, endOfMonth, endOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { notaDinasService } from "@/services/notaDinasService";
import type { NotaDinasCategory, NotaDinasItem, NotaDinasRecord } from "@/types/notaDinas";
import { useAuth } from "@/context/AuthContext";

export type NotaDinasRecapPeriod = "daily" | "weekly" | "monthly";

const CATEGORY_OPTIONS = [
  { value: "permintaan_alat" as const, label: "Permintaan Alat" },
  { value: "permintaan_bunga_bahan" as const, label: "Permintaan Bunga dan Bahan" },
  { value: "perbaikan" as const, label: "Perbaikan" },
] as const;

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const getToday = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value || "-" : date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

const formatPeriodDate = (date: Date) => format(date, "dd MMMM yyyy", { locale: localeId });

const categoryLabel = (category: NotaDinasCategory) =>
  CATEGORY_OPTIONS.find((option) => option.value === category)?.label || "Permintaan Alat";

const getRecordCategory = (record: NotaDinasRecord): NotaDinasCategory =>
  record.form.jenisDokumen === "perbaikan" || record.form.jenisNotaDinas === "perbaikan"
    ? "perbaikan"
    : record.form.jenisNotaDinas || "permintaan_alat";

const getNumber = (record: NotaDinasRecord) => {
  const date = new Date(`${(record.form.tanggalLanjutan || record.form.tanggal)}T00:00:00`);
  const month = Number.isNaN(date.getTime()) ? "..." : ROMAN_MONTHS[date.getMonth()];
  const year = Number.isNaN(date.getTime()) ? "...." : String(date.getFullYear());
  if (!record.form.gunakanNomorOtomatisLanjutan) return record.form.nomorManualLanjutan || "-";
  const sequence = record.form.nomorLanjutanUrut.trim() || ".....";
  return `${sequence}/ Katim/ PL/ ${month}/ ${year}`;
};

const splitQuantity = (item: NotaDinasItem) => {
  const quantity = item.jumlah?.trim() || "-";
  if (item.satuan?.trim()) return { quantity, unit: item.satuan.trim() };
  const match = quantity.match(/^(.*?)(?:\s+)([A-Za-zÀ-ÿ./-]+)$/);
  return match ? { quantity: match[1], unit: match[2] } : { quantity, unit: "-" };
};

type RecapRow = {
  record: NotaDinasRecord;
  item: NotaDinasItem;
  number: number;
};

type MergeColumn = "date" | "number" | "detail";

const rowsForRecords = (records: NotaDinasRecord[]): RecapRow[] => records.flatMap((record) => {
  const items = Array.isArray(record.form.items) && record.form.items.length > 0
    ? record.form.items
    : [{ jenis: "", jumlah: "", keterangan: "" }];
  return items.map((item, index) => ({ record, item, number: index }));
});

const getMergeValue = (row: RecapRow, column: MergeColumn, isRepair: boolean) => {
  if (column === "date") return row.record.form.tanggal || "";
  if (column === "number") return getNumber(row.record);
  return isRepair ? row.item.bkKendaraan || "-" : row.record.form.hal || "-";
};

const getRowSpan = (sourceRows: RecapRow[], index: number, column: MergeColumn, isRepair: boolean) => {
  const value = getMergeValue(sourceRows[index], column, isRepair);
  if (index > 0 && getMergeValue(sourceRows[index - 1], column, isRepair) === value) return 0;
  let span = 1;
  while (
    index + span < sourceRows.length
    && getMergeValue(sourceRows[index + span], column, isRepair) === value
  ) {
    span += 1;
  }
  return span;
};

const NotaDinasRecap = ({ period }: { period: NotaDinasRecapPeriod }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const today = getToday();
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || today);
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get("month") || String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(searchParams.get("year") || String(new Date().getFullYear()));
  const [selectedCategory, setSelectedCategory] = useState<NotaDinasCategory>((searchParams.get("category") as NotaDinasCategory) || "permintaan_alat");
  const [records, setRecords] = useState<NotaDinasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const selectedDateValue = useMemo(() => {
    const parsed = parseISO(selectedDate);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [selectedDate]);

  const range = useMemo(() => {
    if (period === "daily") return { start: selectedDateValue, end: selectedDateValue };
    if (period === "weekly") return { start: startOfWeek(selectedDateValue, { weekStartsOn: 1 }), end: endOfWeek(selectedDateValue, { weekStartsOn: 1 }) };
    const monthDate = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);
    return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
  }, [period, selectedDateValue, selectedMonth, selectedYear]);

  const filteredRecords = useMemo(() => records
    .filter((record) => {
      const recordDate = parseISO(record.form.tanggal);
      return !Number.isNaN(recordDate.getTime()) && isWithinInterval(recordDate, { start: range.start, end: range.end });
    })
    .filter((record) => getRecordCategory(record) === selectedCategory)
    .sort((left, right) => left.form.tanggal.localeCompare(right.form.tanggal) || right.updatedAt.localeCompare(left.updatedAt)),
  [range, records, selectedCategory]);

  const rows = useMemo(() => rowsForRecords(filteredRecords), [filteredRecords]);
  const periodLabel = period === "daily"
    ? `Tanggal: ${formatPeriodDate(range.start)}`
    : `Periode: ${formatPeriodDate(range.start)} s/d ${formatPeriodDate(range.end)}`;
  const recapTitle = `REKAP ${period === "daily" ? "HARIAN" : period === "weekly" ? "MINGGUAN" : "BULANAN"} NOTA DINAS`;
  const isRepair = selectedCategory === "perbaikan";

  useEffect(() => {
    if (authLoading || !session) return;
    let active = true;
    setLoading(true);
    setError(null);
    void notaDinasService.getAll()
      .then((data) => { if (active) setRecords(data); })
      .catch((loadError) => {
        console.error("Gagal memuat rekap Nota Dinas:", loadError);
        if (active) setError("Data Nota Dinas belum dapat dimuat.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, session]);

  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      showError("Tidak ada data Nota Dinas pada periode dan jenis yang dipilih.");
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rekap Nota Dinas");
    const headers = isRepair
      ? ["NO", "Tanggal Permintaan", "Nomor Nodis Katim", "BK Kendaraan", "Jenis Perbaikan", "Jumlah", "Satuan", "Keterangan"]
      : ["NO", "Tanggal Permintaan", "Nomor Nodis Katim", "Hal", selectedCategory === "permintaan_alat" ? "Nama Alat/Barang" : "Nama Bunga", "Jumlah", "Satuan", "Keterangan"];
    worksheet.columns = headers.map((header, index) => ({ header, key: `col${index}`, width: [6, 20, 30, 28, 28, 12, 14, 32][index] }));
    worksheet.mergeCells(`A1:H1`);
    worksheet.getCell("A1").value = "PEMERINTAH KOTA MEDAN";
    worksheet.getCell("A1").font = { bold: true, size: 14 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value = "DINAS LINGKUNGAN HIDUP";
    worksheet.getCell("A2").font = { bold: true, size: 16 };
    worksheet.getCell("A2").alignment = { horizontal: "center" };
    worksheet.mergeCells("A3:H3");
    worksheet.getCell("A3").value = `${recapTitle} - ${categoryLabel(selectedCategory)}`;
    worksheet.getCell("A3").font = { bold: true, size: 13 };
    worksheet.getCell("A3").alignment = { horizontal: "center" };
    worksheet.mergeCells("A4:H4");
    worksheet.getCell("A4").value = periodLabel;
    worksheet.getCell("A4").alignment = { horizontal: "center" };
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DBEAFE" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    rows.forEach(({ record, item }, index) => {
      const quantity = splitQuantity(item);
      worksheet.addRow(isRepair
        ? [index + 1, formatDate(record.form.tanggal), getNumber(record), item.bkKendaraan || "-", item.jenis || "-", quantity.quantity, quantity.unit, item.keterangan || "-"]
        : [index + 1, formatDate(record.form.tanggal), getNumber(record), record.form.hal || "-", item.jenis || "-", quantity.quantity, quantity.unit, item.keterangan || "-"]);
    });
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 5) return;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
    });
    const dataStartRow = 6;
    const mergeColumns: Record<MergeColumn, string> = { date: "B", number: "C", detail: "D" };
    (Object.keys(mergeColumns) as MergeColumn[]).forEach((column) => {
      let start = 0;
      while (start < rows.length) {
        const value = getMergeValue(rows[start], column, isRepair);
        let end = start;
        while (end + 1 < rows.length && getMergeValue(rows[end + 1], column, isRepair) === value) end += 1;
        if (end > start) {
          worksheet.mergeCells(`${mergeColumns[column]}${dataStartRow + start}:${mergeColumns[column]}${dataStartRow + end}`);
        }
        start = end + 1;
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `rekap-nota-dinas-${period}-${selectedCategory}.xlsx`);
    showSuccess("Rekap Nota Dinas berhasil diekspor ke Excel.");
  };

  return (
    <main className="nota-recap-page min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="nota-recap-controls mx-auto mb-5 flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => navigate("/?tab=nota_dinas")} className="rounded-xl bg-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Nota Dinas
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExportExcel} className="rounded-xl bg-white">
            <FileDown className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button type="button" onClick={handlePrint} className="rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
            <Printer className="mr-2 h-4 w-4" /> Cetak Rekap
          </Button>
        </div>
      </div>

      <section className="nota-recap-controls mx-auto mb-5 max-w-7xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          {period === "daily" ? <CalendarDays className="mt-1 h-5 w-5 text-indigo-600" /> : <Table className="mt-1 h-5 w-5 text-indigo-600" />}
          <div>
            <h1 className="text-xl font-black text-slate-950">{recapTitle}</h1>
            <p className="text-sm text-slate-500">{categoryLabel(selectedCategory)} · {periodLabel}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {period !== "monthly" ? (
            <label className="space-y-1.5 text-sm font-semibold text-slate-600">
              <span>{period === "daily" ? "Tanggal Permintaan" : "Tanggal Acuan Minggu"}</span>
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          ) : (
            <label className="space-y-1.5 text-sm font-semibold text-slate-600">
              <span>Bulan</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((month, index) => <SelectItem key={index + 1} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          )}
          {period === "monthly" && <label className="space-y-1.5 text-sm font-semibold text-slate-600"><span>Tahun</span><Input type="number" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} /></label>}
          <label className="space-y-1.5 text-sm font-semibold text-slate-600 sm:col-span-2 lg:col-span-2">
            <span>Jenis Nota Dinas</span>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as NotaDinasCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
      </section>

      <section ref={printRef} className="nota-recap-print mx-auto max-w-7xl bg-white p-4 shadow-sm sm:p-8">
        <header className="mb-5 text-center">
          <h2 className="text-lg font-black uppercase tracking-wide">Pemerintah Kota Medan</h2>
          <h3 className="text-xl font-black uppercase">Dinas Lingkungan Hidup</h3>
          <h1 className="mt-4 text-xl font-black uppercase underline">{recapTitle}</h1>
          <p className="mt-1 font-semibold">{categoryLabel(selectedCategory)}</p>
          <p className="text-sm">{periodLabel}</p>
        </header>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /> Memuat data Nota Dinas...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500">Tidak ada data Nota Dinas pada periode dan jenis yang dipilih.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm text-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-700 px-2 py-2">NO</th>
                  <th className="border border-slate-700 px-2 py-2">Tanggal Permintaan</th>
                  <th className="border border-slate-700 px-2 py-2">Nomor Nodis Katim</th>
                  {isRepair ? <th className="border border-slate-700 px-2 py-2">BK Kendaraan</th> : <th className="border border-slate-700 px-2 py-2">Hal</th>}
                  <th className="border border-slate-700 px-2 py-2">{isRepair ? "Jenis Perbaikan" : selectedCategory === "permintaan_alat" ? "Nama Alat/Barang" : "Nama Bunga"}</th>
                  <th className="border border-slate-700 px-2 py-2">Jumlah</th>
                  <th className="border border-slate-700 px-2 py-2">Satuan</th>
                  <th className="border border-slate-700 px-2 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ record, item }, index) => {
                  const quantity = splitQuantity(item);
                  const dateSpan = getRowSpan(rows, index, "date", isRepair);
                  const numberSpan = getRowSpan(rows, index, "number", isRepair);
                  const detailSpan = getRowSpan(rows, index, "detail", isRepair);
                  return <tr key={`${record.id}-${index}`}>
                    <td className="border border-slate-700 px-2 py-2 text-center">{index + 1}</td>
                    {dateSpan > 0 && <td rowSpan={dateSpan} className="border border-slate-700 px-2 py-2 align-top whitespace-nowrap">{formatDate(record.form.tanggal)}</td>}
                    {numberSpan > 0 && <td rowSpan={numberSpan} className="border border-slate-700 px-2 py-2 align-top">{getNumber(record)}</td>}
                    {detailSpan > 0 && <td rowSpan={detailSpan} className="border border-slate-700 px-2 py-2 align-top">{isRepair ? item.bkKendaraan || "-" : record.form.hal || "-"}</td>}
                    <td className="border border-slate-700 px-2 py-2">{item.jenis || "-"}</td>
                    <td className="border border-slate-700 px-2 py-2 text-center">{quantity.quantity}</td>
                    <td className="border border-slate-700 px-2 py-2">{quantity.unit}</td>
                    <td className="border border-slate-700 px-2 py-2">{item.keterangan || "-"}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-right text-xs text-slate-500">Jumlah baris: {rows.length}</p>
      </section>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white !important; }
          .nota-recap-controls { display: none !important; }
          .nota-recap-page { min-height: 0 !important; padding: 0 !important; background: white !important; }
          .nota-recap-print { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
          .nota-recap-print table { min-width: 0 !important; font-size: 10pt !important; }
          .nota-recap-print thead { display: table-header-group; }
          .nota-recap-print tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </main>
  );
};

export default NotaDinasRecap;
