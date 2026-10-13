import { Input } from "@/components/ui/input";
import { NotaDinasRequestFields } from "@/components/nota-dinas/NotaDinasRequestFields";
import { NotaDinasItemsEditor } from "@/components/nota-dinas/NotaDinasItemsEditor";
import { DEFAULT_KOLOM_PERBAIKAN, DEFAULT_KOLOM_PERMINTAAN } from "@/types/notaDinas";
import type { NotaDinasForm, NotaDinasTemplate } from "@/types/notaDinas";
import type { getNotaDinasSavedChoices } from "@/components/nota-dinas/notaDinasRecordUtils";

type RequestFieldsProps = React.ComponentProps<typeof NotaDinasRequestFields>;
type SavedChoices = ReturnType<typeof getNotaDinasSavedChoices>;

type NotaDinasEditorFieldsPanelProps = {
  form: NotaDinasForm;
  requestFields: RequestFieldsProps;
  sheetTemplate: NotaDinasTemplate;
  itemOptions: string[];
  savedChoices: SavedChoices;
  lastSavedAt: number | null;
  activeJabatanPenandatangan: string;
  activeKantorPenandatangan: string;
  activeNamaPenandatangan: string;
  activeNipPenandatangan: string;
  onSetActiveField: (field: "kepada" | "dari" | "hal" | "penutup" | "jabatanPenandatangan" | "kantorPenandatangan" | "namaPenandatangan" | "nipPenandatangan", value: string) => void;
  onUpdateItem: (index: number, key: keyof NotaDinasForm["items"][number], value: string) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: () => void;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </label>
);

export const NotaDinasEditorFieldsPanel = ({
  form,
  requestFields,
  sheetTemplate,
  itemOptions,
  savedChoices,
  lastSavedAt,
  activeJabatanPenandatangan,
  activeKantorPenandatangan,
  activeNamaPenandatangan,
  activeNipPenandatangan,
  onSetActiveField,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
}: NotaDinasEditorFieldsPanelProps) => (
  <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
    <div>
      <h3 className="text-lg font-black text-slate-950">Input Nota Dinas</h3>
      <p className="mt-1 text-sm text-slate-500">
        Isi atau ubah data yang dicetak tebal pada pratinjau. <span className="text-xs text-slate-400">{lastSavedAt ? "Draft tersimpan" : "Draft akan tersimpan otomatis"}</span>
      </p>
    </div>

    <NotaDinasRequestFields {...requestFields} />
    {!requestFields.isLanjutan && (
      <NotaDinasItemsEditor
        items={form.items}
        isRepair={requestFields.isRepair}
        repairColumns={sheetTemplate.kolomPerbaikan ?? DEFAULT_KOLOM_PERBAIKAN}
        requestColumns={sheetTemplate.kolomPermintaan ?? DEFAULT_KOLOM_PERMINTAAN}
        itemOptions={itemOptions}
        onUpdate={onUpdateItem}
        onRemove={onRemoveItem}
        onAdd={onAddItem}
      />
    )}

    <div className="grid gap-4 border-t border-slate-100 pt-5">
      <Field label="Jabatan Penandatangan">
        <Input value={activeJabatanPenandatangan} readOnly disabled className="bg-slate-50 text-slate-500" />
        <span className="block text-[11px] text-slate-400">Otomatis diambil dari field "Dari".</span>
      </Field>
      <Field label="Kantor / Wilayah Penandatangan"><Input list="nota-dinas-kantor-options" value={activeKantorPenandatangan} onChange={(event) => onSetActiveField("kantorPenandatangan", event.target.value)} /></Field>
      <Field label="Nama Penandatangan"><Input list="nota-dinas-nama-options" value={activeNamaPenandatangan} onChange={(event) => onSetActiveField("namaPenandatangan", event.target.value)} /></Field>
      <Field label="NIP"><Input list="nota-dinas-nip-options" value={activeNipPenandatangan} onChange={(event) => onSetActiveField("nipPenandatangan", event.target.value)} /></Field>
    </div>
    <datalist id="nota-dinas-kepada-options">{savedChoices.kepada.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-dari-options">{savedChoices.dari.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-kendaraan-options">{savedChoices.kendaraan.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-jenis-kendaraan-options">{savedChoices.jenisKendaraan.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-supir-options">{savedChoices.supir.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-no-hp-options">{savedChoices.noHp.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-lokasi-options">{savedChoices.lokasi.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-kegiatan-options">{savedChoices.kegiatan.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-jabatan-options">{savedChoices.jabatan.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-kantor-options">{savedChoices.kantor.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-nama-options">{savedChoices.nama.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="nota-dinas-nip-options">{savedChoices.nip.map((value) => <option key={value} value={value} />)}</datalist>
  </div>
);
