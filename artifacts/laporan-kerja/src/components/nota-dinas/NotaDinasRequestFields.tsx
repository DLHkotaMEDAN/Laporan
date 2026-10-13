import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NotaDinasCategory, NotaDinasForm, NotaDinasKind, NotaDinasTemplate } from "@/types/notaDinas";
import {
  DOCUMENT_TYPES,
  getLetterMonth,
  getLetterYear,
  LETTER_TYPES,
  NOTA_DINAS_CATEGORIES,
  REGION_CODES,
} from "@/components/nota-dinas/notaDinasUtils";

type ActiveField = "kepada" | "dari" | "hal" | "penutup" | "jabatanPenandatangan" | "kantorPenandatangan" | "namaPenandatangan" | "nipPenandatangan";

type NotaDinasRequestFieldsProps = {
  form: NotaDinasForm;
  setForm: Dispatch<SetStateAction<NotaDinasForm>>;
  isLanjutan: boolean;
  isRepair: boolean;
  isSuperAdmin: boolean;
  templates: NotaDinasTemplate[];
  selectedTemplateId: string;
  activeRecordId: string | null;
  nextRequestSequence: string;
  activeAutoNumber: boolean;
  generatedNumber: string;
  activeManualNumber: string;
  activeDateValue: string;
  halOptions: string[];
  activeHalOption: string;
  activeHal: string;
  referenceNumber: string;
  activeKepada: string;
  activeDari: string;
  onNotaCategoryChange: (category: NotaDinasCategory) => void;
  onTemplateSelect: (templateId: string) => void;
  onDocumentTypeChange: (kind: NotaDinasKind) => void;
  onSetActiveField: (field: ActiveField, value: string) => void;
  onSetField: <K extends keyof NotaDinasForm>(key: K, value: NotaDinasForm[K]) => void;
  onActiveDateChange: (value: string) => void;
  onHalOptionChange: (value: string) => void;
  onRegionChange: (value: string) => void;
};

const Field = ({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block space-y-1.5 ${className}`}>
    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </label>
);

export function NotaDinasRequestFields({
  form,
  setForm,
  isLanjutan,
  isRepair,
  isSuperAdmin,
  templates,
  selectedTemplateId,
  activeRecordId,
  nextRequestSequence,
  activeAutoNumber,
  generatedNumber,
  activeManualNumber,
  activeDateValue,
  halOptions,
  activeHalOption,
  activeHal,
  referenceNumber,
  activeKepada,
  activeDari,
  onNotaCategoryChange,
  onTemplateSelect,
  onDocumentTypeChange,
  onSetActiveField,
  onSetField,
  onActiveDateChange,
  onHalOptionChange,
  onRegionChange,
}: NotaDinasRequestFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
      <Field label="Nota Dinas" className="sm:col-span-2 xl:col-span-1">
        <Select value={form.jenisNotaDinas} onValueChange={(value) => onNotaCategoryChange(value as NotaDinasCategory)}>
          <SelectTrigger><SelectValue placeholder="Pilih jenis Nota Dinas" /></SelectTrigger>
          <SelectContent>{NOTA_DINAS_CATEGORIES.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      {templates.length > 1 && (
        <Field label="Pilih Template" className="sm:col-span-2 xl:col-span-1">
          <Select value={selectedTemplateId} onValueChange={onTemplateSelect}>
            <SelectTrigger><SelectValue placeholder="Pilih template..." /></SelectTrigger>
            <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.nama}{template.isDefault ? " (Default)" : ""}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      )}
      {!isLanjutan && <Field label="Jenis Nota">
        <Select value={form.kodeSurat} disabled>
          <SelectTrigger><SelectValue placeholder="Pilih jenis nota" /></SelectTrigger>
          <SelectContent>{LETTER_TYPES.map((letterType) => <SelectItem key={letterType.code} value={letterType.code}>{letterType.code} - {letterType.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>}
      <Field label="Jenis Dokumen" className="sm:col-span-2 xl:col-span-1">
        <Select value={form.jenisDokumen} onValueChange={(value) => onDocumentTypeChange(value as NotaDinasKind)}>
          <SelectTrigger><SelectValue placeholder="Pilih jenis dokumen" /></SelectTrigger>
          <SelectContent>{DOCUMENT_TYPES.map((documentType) => <SelectItem key={documentType.value} value={documentType.value}>{documentType.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Yth / Kepada"><Input list="nota-dinas-kepada-options" value={activeKepada} onChange={(event) => onSetActiveField("kepada", event.target.value)} /></Field>
      <Field label="Dari"><Input list="nota-dinas-dari-options" value={activeDari} onChange={(event) => onSetActiveField("dari", event.target.value)} /></Field>
      {!isLanjutan && <Field label="Nomor Urut Surat Permintaan">
        <Input value={form.nomorUrut} onChange={(event) => onSetField("nomorUrut", event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" maxLength={3} placeholder="001" />
        <span className="block text-[11px] text-slate-400">{activeRecordId ? "Nomor tersimpan dapat diedit manual." : `Otomatis melanjutkan nomor terakhir: ${nextRequestSequence}. Tetap dapat diedit manual.`}</span>
      </Field>}
      {isLanjutan && <Field label="Nomor Urut Nota Lanjutan"><Input value={form.nomorLanjutanUrut} onChange={(event) => onSetField("nomorLanjutanUrut", event.target.value)} placeholder="Isi nomor urut" /></Field>}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:col-span-2 xl:col-span-1">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-black uppercase tracking-wider text-indigo-700">Nomor Surat</p><p className="mt-1 text-xs text-indigo-900/70">{activeAutoNumber ? "Format otomatis aktif" : "Mode edit manual aktif"}</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => isLanjutan
            ? { ...current, gunakanNomorOtomatisLanjutan: !current.gunakanNomorOtomatisLanjutan, nomorManualLanjutan: current.gunakanNomorOtomatisLanjutan ? generatedNumber : "" }
            : { ...current, gunakanNomorOtomatisPertama: !current.gunakanNomorOtomatisPertama, nomorManualPertama: current.gunakanNomorOtomatisPertama ? generatedNumber : "" }
          )} className="shrink-0 rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100">
            {activeAutoNumber ? "Edit Manual" : "Otomatis"}
          </Button>
        </div>
        {!activeAutoNumber && <Input className="mt-3 bg-white" value={activeManualNumber} onChange={(event) => setForm((current) => isLanjutan ? { ...current, nomorManualLanjutan: event.target.value } : { ...current, nomorManualPertama: event.target.value })} placeholder={isLanjutan ? "Contoh: 018/ Katim/ PL/ IX/ 2026" : "Contoh: 018/SPB/ Dinas-LH/ MK/ IX/ 2026"} aria-label="Nomor surat manual" />}
        {activeAutoNumber && <p className="mt-2 break-words rounded-lg bg-white/80 px-2.5 py-2 text-xs font-semibold text-slate-700">{generatedNumber}</p>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2 xl:col-span-1">
        {!isLanjutan ? <><p><span className="font-bold text-slate-800">SPB</span> = Surat Permintaan Barang</p><p><span className="font-bold text-slate-800">SPm-PM</span> = Nota Perbaikan</p><p><span className="font-bold text-slate-800">Dinas-LH</span> = nilai tetap</p></> : <p><span className="font-bold text-slate-800">Katim / PL</span> = nilai tetap pada Nota Dinas Lanjutan</p>}
      </div>
      <Field label={`Tanggal Surat ${isLanjutan ? "Lanjutan" : "Pertama"}`}>
        <Input type="date" value={activeDateValue} onChange={(event) => onActiveDateChange(event.target.value)} />
        <span className="block text-[11px] text-slate-400">Kode bulan dan tahun nomor dibuat otomatis: {getLetterMonth(activeDateValue)} / {getLetterYear(activeDateValue)}</span>
      </Field>
      {!isLanjutan && <Field label="Hal" className="sm:col-span-2 xl:col-span-1">
        <Select value={activeHalOption} onValueChange={onHalOptionChange}>
          <SelectTrigger><SelectValue placeholder="Pilih Hal" /></SelectTrigger>
          <SelectContent>{halOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}<SelectItem value="manual">Isi Manual</SelectItem></SelectContent>
        </Select>
        {activeHalOption === "manual" && <Textarea className="mt-2" rows={2} value={activeHal} onChange={(event) => onSetActiveField("hal", event.target.value)} placeholder="Tulis Hal secara manual" />}
      </Field>}
      {isSuperAdmin && !isLanjutan && <Field label="Pilihan Wilayah">
        <Select value={form.kodeWilayah} onValueChange={onRegionChange} disabled={!isSuperAdmin}>
          <SelectTrigger><SelectValue placeholder="Pilih kode wilayah" /></SelectTrigger>
          <SelectContent>{REGION_CODES.map((region) => <SelectItem key={region.code} value={region.code}>{region.code} - {region.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="block text-[11px] text-indigo-600">Pilih wilayah untuk Nota Dinas.</span>
      </Field>}
      {isLanjutan && <>
        <Field label="Pengirim Surat Rujukan">
          <Input list="nota-dinas-dari-options" value={form.koordinatorRujukan} onChange={(event) => onSetField("koordinatorRujukan", event.target.value)} />
          <span className="block text-[11px] text-slate-400">Otomatis dari field "Dari" surat permintaan. Bisa diedit manual jika berbeda.</span>
        </Field>
        <Field label="Nomor Surat Rujukan" className="sm:col-span-2 xl:col-span-1">
          <div className="flex gap-2">
            <Input className="min-w-0 flex-1" value={referenceNumber} readOnly={form.gunakanRujukanOtomatis} onChange={(event) => setForm((current) => ({ ...current, gunakanRujukanOtomatis: false, nomorRujukan: event.target.value }))} />
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, gunakanRujukanOtomatis: !current.gunakanRujukanOtomatis, nomorRujukan: current.gunakanRujukanOtomatis ? referenceNumber : "" }))} className="shrink-0 rounded-lg border-indigo-200 bg-white px-2.5 text-indigo-700 hover:bg-indigo-100">
              {form.gunakanRujukanOtomatis ? "Edit" : "Auto"}
            </Button>
          </div>
          <span className="block text-[11px] text-slate-400">Otomatis mengikuti nomor Nota Permintaan atau dapat diedit manual.</span>
        </Field>
      </>}
      {isRepair ? <>
        {!isLanjutan && <>
          <Field label="Wilayah Operasional"><Input value={form.wilayah} readOnly disabled /></Field>
          <Field label="Plat Kendaraan"><Input list="nota-dinas-kendaraan-options" value={form.perbaikanPlatKendaraan} onChange={(event) => onSetField("perbaikanPlatKendaraan", event.target.value)} placeholder="Contoh: BK 9213 J" /></Field>
          <Field label="Jenis Kendaraan"><Input list="nota-dinas-jenis-kendaraan-options" value={form.perbaikanJenisKendaraan} onChange={(event) => onSetField("perbaikanJenisKendaraan", event.target.value)} placeholder="Contoh: Truck Sampah" /></Field>
          <Field label="Nama Supir"><Input list="nota-dinas-supir-options" value={form.perbaikanSupir} onChange={(event) => onSetField("perbaikanSupir", event.target.value)} /></Field>
          <Field label="Nomor HP Supir"><Input list="nota-dinas-no-hp-options" value={form.perbaikanNoHp} onChange={(event) => onSetField("perbaikanNoHp", event.target.value)} inputMode="tel" /></Field>
        </>}
        {isLanjutan && <>
          <Field label="Uraian / Kondisi Hasil Pemeriksaan" className="sm:col-span-2 xl:col-span-1"><Textarea rows={3} value={form.perbaikanUraianPemeriksaan} onChange={(event) => onSetField("perbaikanUraianPemeriksaan", event.target.value)} placeholder="Contoh: Truck Sampah BK 9213 J tersebut telah rusak" /></Field>
          <Field label="Lokasi Kejadian"><Input list="nota-dinas-lokasi-options" value={form.perbaikanLokasi} onChange={(event) => onSetField("perbaikanLokasi", event.target.value)} placeholder="Contoh: Jl. Asoka Pasar 1 Tanjung Sari" /></Field>
          <Field label="Kegiatan Saat Kejadian"><Input list="nota-dinas-kegiatan-options" value={form.perbaikanKegiatan} onChange={(event) => onSetField("perbaikanKegiatan", event.target.value)} placeholder="Contoh: pengerjaan pohon aren" /></Field>
        </>}
      </> : !isLanjutan && <>
        <Field label="Wilayah"><Input value={form.wilayah} readOnly disabled /></Field>
        <Field label="Jumlah Kecamatan"><Input value={form.jumlahKecamatan} onChange={(event) => onSetField("jumlahKecamatan", event.target.value)} /></Field>
        <Field label="Nama Kecamatan" className="sm:col-span-2 xl:col-span-1"><Textarea rows={2} value={form.kecamatan} onChange={(event) => onSetField("kecamatan", event.target.value)} /></Field>
        <Field label="Dimohon Kepada" className="sm:col-span-2 xl:col-span-1">
          <Select value={form.penerima} onValueChange={(value) => onSetField("penerima", value)}>
            <SelectTrigger><SelectValue placeholder="Pilih sapaan" /></SelectTrigger>
            <SelectContent><SelectItem value="Bapak">Bapak</SelectItem><SelectItem value="Ibu">Ibu</SelectItem></SelectContent>
          </Select>
        </Field>
      </>}
    </div>
  );
}
