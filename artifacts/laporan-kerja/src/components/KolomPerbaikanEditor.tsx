import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KolomTabel } from "@/types/notaDinas";
import { DEFAULT_KOLOM_PERBAIKAN } from "@/types/notaDinas";

type Props = {
  kolom: KolomTabel[];
  onChange: (kolom: KolomTabel[]) => void;
};

const totalLebar = (kolom: KolomTabel[]) =>
  kolom.reduce((sum, k) => sum + (Number(k.lebar) || 0), 0);

const KolomPerbaikanEditor = ({ kolom, onChange }: Props) => {
  const total = totalLebar(kolom);
  const isOverTotal = total > 100;

  const setField = (index: number, field: keyof KolomTabel, value: string | number | boolean) => {
    const updated = kolom.map((k, i) => i === index ? { ...k, [field]: value } : k);
    onChange(updated);
  };

  const addKolom = () => {
    const sisaLebar = Math.max(0, 100 - total);
    onChange([...kolom, {
      id: `kolom_${Date.now()}`,
      judul: "Kolom Baru",
      lebar: sisaLebar,
      rowspan: false,
    }]);
  };

  const removeKolom = (index: number) => {
    if (kolom.length <= 1) return;
    onChange(kolom.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...kolom];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index === kolom.length - 1) return;
    const updated = [...kolom];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const resetToDefault = () => onChange([...DEFAULT_KOLOM_PERBAIKAN]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_auto_auto] items-center gap-2 px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Judul Kolom</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Lebar (%)</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Rowspan</span>
        <span className="w-16" />
      </div>

      {/* Baris kolom */}
      {kolom.map((k, index) => (
        <div key={k.id} className="grid grid-cols-[auto_1fr_80px_auto_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
          {/* Drag handle / urutan */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="h-5 w-5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30"
              aria-label="Naik"
            >▲</button>
            <button
              type="button"
              onClick={() => moveDown(index)}
              disabled={index === kolom.length - 1}
              className="h-5 w-5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30"
              aria-label="Turun"
            >▼</button>
          </div>

          {/* Judul */}
          <Input
            value={k.judul}
            onChange={(e) => setField(index, "judul", e.target.value)}
            className="h-8 rounded-lg text-sm"
            placeholder="Judul kolom"
          />

          {/* Lebar % */}
          <Input
            type="number"
            min={1}
            max={100}
            value={k.lebar}
            onChange={(e) => setField(index, "lebar", Math.max(1, Math.min(100, Number(e.target.value))))}
            className="h-8 rounded-lg text-center text-sm"
          />

          {/* Rowspan toggle */}
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={k.rowspan}
              onChange={(e) => setField(index, "rowspan", e.target.checked)}
              title="Rowspan: nilai sama untuk semua baris"
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Hapus */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeKolom(index)}
            disabled={kolom.length <= 1}
            className="h-8 w-8 rounded-lg p-0 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            aria-label="Hapus kolom"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {/* Total lebar */}
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${isOverTotal ? "bg-red-50 text-red-600" : total === 100 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
        <span>Total lebar: <strong>{total}%</strong> {isOverTotal ? "— melebihi 100%!" : total < 100 ? `— sisa ${100 - total}%` : "✓ Pas"}</span>
        <Button type="button" variant="ghost" size="sm" onClick={resetToDefault} className="h-6 rounded-lg px-2 text-xs text-slate-500 hover:bg-white">
          Reset Default
        </Button>
      </div>

      {/* Tambah kolom */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addKolom}
        className="h-8 w-full rounded-xl border-dashed border-slate-300 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Kolom
      </Button>

      {/* Keterangan rowspan */}
      <p className="text-[11px] text-slate-400">
        <strong>Rowspan</strong> ☑ = nilai kolom sama untuk semua baris (pakai rowspan di tabel, cocok untuk Plat/Jenis Kendaraan).
        ☐ = nilai per baris (cocok untuk kolom Perbaikan/Kerusakan).
      </p>
    </div>
  );
};

export default KolomPerbaikanEditor;
