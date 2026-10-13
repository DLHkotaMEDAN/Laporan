import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KolomTabel, NotaDinasItem } from "@/types/notaDinas";

type Props = {
  items: NotaDinasItem[];
  isRepair: boolean;
  repairColumns: KolomTabel[];
  requestColumns: KolomTabel[];
  itemOptions: string[];
  onUpdate: (index: number, key: keyof NotaDinasItem, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
};

export function NotaDinasItemsEditor({
  items,
  isRepair,
  repairColumns,
  requestColumns,
  itemOptions,
  onUpdate,
  onRemove,
  onAdd,
}: Props) {
  return (
    <div className="border-t border-slate-100 pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h4 className="font-black text-slate-900">{isRepair ? "Daftar Perbaikan" : "Daftar Barang"}</h4>
          <p className="text-xs text-slate-500">Tambah baris sesuai kebutuhan.</p>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">{isRepair ? "Perbaikan" : "Barang"} {index + 1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => onRemove(index)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Hapus ${isRepair ? "perbaikan" : "barang"} ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {isRepair
                ? repairColumns.filter((column) => !column.rowspan).map((column) => (
                    <Input
                      key={column.id}
                      list="nota-dinas-item-catalog"
                      aria-label={`${column.judul} ${index + 1}`}
                      placeholder={column.judul}
                      value={column.id === "perbaikan" ? (item.jenis || "") : (item[column.id] || "")}
                      onChange={(event) => onUpdate(index, column.id === "perbaikan" ? "jenis" : column.id, event.target.value)}
                    />
                  ))
                : requestColumns.filter((column) => column.id !== "nomor").map((column) => (
                    <Input
                      key={column.id}
                      list={column.id === "jenis" ? "nota-dinas-item-catalog" : undefined}
                      aria-label={`${column.judul} ${index + 1}`}
                      placeholder={column.judul}
                      value={column.id === "jumlah"
                        ? (item.jumlah || "")
                        : column.id === "satuan"
                          ? (item.satuan || "")
                          : (item[column.id] as string || "")}
                      onChange={(event) => onUpdate(index, column.id, event.target.value)}
                    />
                  ))}
            </div>
          </div>
        ))}
      </div>
      <datalist id="nota-dinas-item-catalog">{itemOptions.map((item) => <option key={item} value={item} />)}</datalist>
      <Button type="button" variant="outline" onClick={onAdd} className="mt-3 h-10 w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50">
        <Plus className="mr-2 h-4 w-4" /> Tambah {isRepair ? "Perbaikan" : "Barang"}
      </Button>
    </div>
  );
}
