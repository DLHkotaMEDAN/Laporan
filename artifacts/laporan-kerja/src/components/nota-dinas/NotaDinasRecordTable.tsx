import { ArrowUpDown, ChevronDown, ChevronUp, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotaDinasRecord } from "@/types/notaDinas";

export type NotaDinasSortKey = "requestNumber" | "continuationNumber" | "date" | "subject" | "region" | "items";
export type NotaDinasSort = { key: NotaDinasSortKey; direction: "asc" | "desc" } | null;

type Props = {
  records: NotaDinasRecord[];
  sort: NotaDinasSort;
  onSort: (key: NotaDinasSortKey) => void;
  onOpen: (record: NotaDinasRecord, mode: "view" | "edit") => void;
  onDelete: (record: NotaDinasRecord) => void;
  getNumberLabel: (record: NotaDinasRecord, continuation?: boolean) => string;
  formatLongDate: (value: string) => string;
};

export function NotaDinasRecordTable({
  records,
  sort,
  onSort,
  onOpen,
  onDelete,
  getNumberLabel,
  formatLongDate,
}: Props) {
  const sortableHeader = (label: string, key: NotaDinasSortKey, className = "") => {
    const active = sort?.key === key;
    const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ChevronUp : ChevronDown;
    return (
      <th className={`px-3 py-3 sm:px-5 ${className}`}>
        <button
          type="button"
          onClick={() => onSort(key)}
          className="inline-flex items-center gap-1.5 hover:text-indigo-700"
          aria-label={`Urutkan ${label}`}
          title={`Urutkan ${label}`}
        >
          {label}<Icon className="h-3.5 w-3.5" />
        </button>
      </th>
    );
  };

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full table-fixed text-left text-xs sm:text-sm">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <tr>
            <th className="w-10 px-3 py-3 sm:px-5">No.</th>
            {sortableHeader("Nota Permintaan", "requestNumber")}
            {sortableHeader("Nota Lanjutan", "continuationNumber", "hidden md:table-cell")}
            {sortableHeader("Tanggal", "date", "hidden sm:table-cell")}
            {sortableHeader("Perihal", "subject")}
            {sortableHeader("Wilayah", "region", "hidden lg:table-cell")}
            {sortableHeader("Barang", "items", "hidden text-center md:table-cell")}
            <th className="w-20 px-3 py-3 text-right sm:w-28 sm:px-5">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record, index) => {
            const firstNumber = getNumberLabel(record);
            const continuationNumber = getNumberLabel(record, true);
            return (
              <tr key={record.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-4 font-semibold text-slate-500 sm:px-5">{index + 1}</td>
                <td className="break-words px-3 py-4 font-semibold text-slate-800 sm:px-5">{firstNumber}</td>
                <td className="hidden break-words px-3 py-4 text-slate-700 md:table-cell sm:px-5">{continuationNumber}</td>
                <td className="hidden px-3 py-4 whitespace-nowrap text-slate-600 sm:table-cell sm:px-5">{formatLongDate(record.form.tanggal)}</td>
                <td className="px-3 py-4 text-slate-700 sm:px-5">
                  <span className="line-clamp-2">{record.form.hal || "-"}</span>
                  <span className="mt-1 block text-[10px] text-slate-400 sm:hidden">{formatLongDate(record.form.tanggal)}</span>
                </td>
                <td className="hidden px-3 py-4 text-slate-700 lg:table-cell sm:px-5">{record.form.wilayah || "-"}</td>
                <td className="hidden px-3 py-4 text-center font-semibold text-slate-700 md:table-cell sm:px-5">{record.form.items.length}</td>
                <td className="px-3 py-4 text-right sm:px-5">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpen(record, "view")} className="border-indigo-200 px-2 text-indigo-700 hover:bg-indigo-50 sm:px-3">
                      <Eye className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Buka</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpen(record, "edit")} className="border-emerald-200 px-2 text-emerald-700 hover:bg-emerald-50 sm:px-3">
                      <Pencil className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDelete(record)} aria-label="Hapus Nota Dinas" title="Hapus Nota Dinas" className="border-red-200 px-2 text-red-600 hover:bg-red-50 sm:px-3">
                      <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
