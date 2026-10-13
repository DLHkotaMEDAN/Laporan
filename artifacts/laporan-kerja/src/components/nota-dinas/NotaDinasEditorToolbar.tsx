import { FilePlus2, FileText, Loader2, Pencil, Printer, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotaDinasEditorToolbarProps = {
  isRegionalNotaAdmin: boolean;
  regionName?: string;
  activeRecordId: string | null;
  viewMode: "view" | "edit";
  saving: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onPrint: () => void;
};

export const NotaDinasEditorToolbar = ({
  isRegionalNotaAdmin,
  regionName,
  activeRecordId,
  viewMode,
  saving,
  onBack,
  onEdit,
  onDelete,
  onDuplicate,
  onSave,
  onPrint,
}: NotaDinasEditorToolbarProps) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
      <div>
        <p className="font-black">{isRegionalNotaAdmin ? `Nota Dinas ${regionName || "Wilayah Akun"}` : "Nota Dinas untuk Super Admin"}</p>
        <p className="mt-0.5 text-sm text-indigo-800/80">Pratinjau dan tombol cetak selalu menghasilkan satu PDF berisi Nota pertama dan Nota lanjutan (2 halaman). Pilih jenis dokumen untuk mengedit halaman terkait.</p>
      </div>
    </div>
    <div className="flex flex-wrap justify-end gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={onBack} className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
        Kembali ke Data
      </Button>
      {activeRecordId && viewMode === "view" && (
        <Button type="button" variant="outline" onClick={onEdit} className="h-10 rounded-xl border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50">
          <Pencil className="mr-2 h-4 w-4" /> Edit Nota Dinas
        </Button>
      )}
      {activeRecordId && viewMode === "edit" && (
        <Button type="button" variant="outline" onClick={onDelete} className="h-10 rounded-xl border-red-200 bg-white text-red-600 hover:bg-red-50">
          <Trash2 className="mr-2 h-4 w-4" /> Hapus
        </Button>
      )}
      {activeRecordId && viewMode === "edit" && (
        <Button type="button" variant="outline" onClick={onDuplicate} className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
          <FilePlus2 className="mr-2 h-4 w-4" /> Duplikat
        </Button>
      )}
      {viewMode === "edit" && (
        <Button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan Nota Dinas"}
        </Button>
      )}
      <Button type="button" onClick={onPrint} className="h-10 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
        <Printer className="mr-2 h-4 w-4" /> Cetak / Simpan PDF
      </Button>
    </div>
  </div>
);
