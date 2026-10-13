import { FilePlus2, FileText, Filter, Loader2, Settings2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TotalRecordLabel from "@/components/TotalRecordLabel";
import { NotaDinasRecordTable, type NotaDinasSort, type NotaDinasSortKey } from "@/components/nota-dinas/NotaDinasRecordTable";
import { formatLongDate, formatRecordDate, NOTA_DINAS_CATEGORIES } from "@/components/nota-dinas/notaDinasUtils";
import type { NotaDinasCategory, NotaDinasRecord } from "@/types/notaDinas";

type NotaDinasListViewProps = {
  recordCount?: number | null;
  records: NotaDinasRecord[];
  sortedRecords: NotaDinasRecord[];
  recordsError: string | null;
  recordsLoading: boolean;
  categoryFilter: NotaDinasCategory | "semua";
  sort: NotaDinasSort;
  onCategoryChange: (category: NotaDinasCategory | "semua") => void;
  onSort: (key: NotaDinasSortKey) => void;
  onOpen: (record: NotaDinasRecord, mode?: "view" | "edit") => void;
  onDelete: (record: NotaDinasRecord) => void;
  getNumberLabel: (record: NotaDinasRecord, continuation?: boolean) => string;
  onAdd: () => void;
  onOpenTemplates: () => void;
};

export function NotaDinasListView({
  recordCount,
  records,
  sortedRecords,
  recordsError,
  recordsLoading,
  categoryFilter,
  sort,
  onCategoryChange,
  onSort,
  onOpen,
  onDelete,
  getNumberLabel,
  onAdd,
  onOpenTemplates,
}: NotaDinasListViewProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <h2 className="font-black">Nota Dinas</h2>
            <p className="mt-0.5 text-sm text-indigo-800/80">Kelola Nota Dinas Permintaan dan Nota Dinas Lanjutan dalam satu dokumen PDF dua halaman.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onOpenTemplates} className="h-10 shrink-0 rounded-xl border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">
            <Settings2 className="mr-2 h-4 w-4" /> Pengaturan Template
          </Button>
          <Button type="button" onClick={onAdd} className="h-10 shrink-0 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
            <FilePlus2 className="mr-2 h-4 w-4" /> Tambah Nota Dinas
          </Button>
        </div>
      </div>

      <TotalRecordLabel count={recordCount === undefined ? records.length : recordCount} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-slate-950">Data Nota Dinas</h3>
            <p className="text-sm text-slate-500">Daftar Nota Dinas yang telah disimpan.</p>
          </div>
          <span className="text-xs font-bold text-slate-500">{sortedRecords.length} dokumen</span>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Filter className="h-4 w-4 text-indigo-500" />
            <span>Filter Nota Dinas</span>
          </div>
          <Select value={categoryFilter} onValueChange={(value) => onCategoryChange(value as NotaDinasCategory | "semua")}>
            <SelectTrigger className="w-full bg-white sm:w-[260px]"><SelectValue placeholder="Semua Nota Dinas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Nota Dinas</SelectItem>
              {NOTA_DINAS_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {recordsError && <p className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">{recordsError}</p>}

        {recordsLoading ? (
          <div className="flex flex-col items-center px-6 py-16 text-center text-slate-500">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm font-semibold">Memuat data dari Supabase...</p>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-bold text-slate-700">{categoryFilter === "semua" ? "Belum ada Nota Dinas tersimpan" : "Tidak ada Nota Dinas dengan filter ini"}</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">{categoryFilter === "semua" ? "Klik “Tambah Nota Dinas” untuk membuat dan menyimpan dokumen pertama." : "Pilih filter lain atau tambahkan Nota Dinas baru."}</p>
          </div>
        ) : (
          <NotaDinasRecordTable
            records={sortedRecords}
            sort={sort}
            onSort={onSort}
            onOpen={onOpen}
            onDelete={onDelete}
            getNumberLabel={getNumberLabel}
            formatLongDate={formatLongDate}
          />
        )}
        {sortedRecords.length > 0 && <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Data terakhir diperbarui: {formatRecordDate(sortedRecords[0].updatedAt)}</div>}
      </div>
    </section>
  );
}
