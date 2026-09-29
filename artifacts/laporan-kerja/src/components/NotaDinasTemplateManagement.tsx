"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/lib/supabase";
import { notaDinasTemplateService } from "@/services/notaDinasTemplateService";
import { DEFAULT_NOTA_TEMPLATES, DEFAULT_KOLOM_PERBAIKAN } from "@/types/notaDinas";
import type { NotaDinasCategory, NotaDinasTemplate, KolomTabel } from "@/types/notaDinas";
import KolomPerbaikanEditor from "@/components/KolomPerbaikanEditor";

const KATEGORI_OPTIONS: { value: NotaDinasCategory; label: string }[] = [
  { value: "permintaan_alat", label: "Permintaan Alat" },
  { value: "permintaan_bunga_bahan", label: "Permintaan Bunga dan Bahan" },
  { value: "perbaikan", label: "Perbaikan" },
];

type RegionOption = { id: string | null; name: string };

type FieldDef = {
  key: keyof Omit<NotaDinasTemplate, 'id' | 'nama' | 'regionId' | 'kategori' | 'isDefault' | 'createdAt' | 'updatedAt'>;
  label: string;
  hint: string;
  showFor: NotaDinasCategory[];
};

const FIELDS: FieldDef[] = [
  {
    key: "paragrafPembuka",
    label: "Paragraf Pembuka Permintaan",
    hint: "Teks awal surat sebelum tabel barang. Placeholder: {wilayah}, {jumlahKecamatan}, {kecamatan}",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafSubJudul",
    label: "Sub Judul Permintaan",
    hint: "Kalimat pengantar sebelum tabel barang.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafLanjutanAlat",
    label: "Paragraf Nota Lanjutan",
    hint: "Teks pembuka nota lanjutan. Placeholder: {koordinatorRujukan}, {nomorRujukan}, {tanggalRujukan}, {halRujukan}",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafPerbaikanPermintaan",
    label: "Paragraf Perbaikan — Surat Pertama",
    hint: "Teks sebelum tabel perbaikan. Placeholder: {wilayah}, {jenisKendaraan}, {platKendaraan}",
    showFor: ["perbaikan"],
  },
  {
    key: "paragrafPerbaikanLanjutan",
    label: "Paragraf Perbaikan — Nota Lanjutan",
    hint: "Teks pembuka nota lanjutan perbaikan. Placeholder: {koordinatorRujukan}, {uraianPemeriksaan}, {lokasiKejadian}, {kegiatanKejadian}",
    showFor: ["perbaikan"],
  },
  {
    key: "paragrafPenutup",
    label: "Kalimat Penutup",
    hint: "Kalimat setelah tabel. Placeholder: {penerima}, {kepada}",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan", "perbaikan"],
  },
  {
    key: "paragrafKalimatPenutup",
    label: "Kalimat Penutup Surat (sebelum tanda tangan)",
    hint: "Muncul setelah tabel dan sebelum blok tanda tangan. Auto-terisi ke form saat buat Nota Dinas baru.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan", "perbaikan"],
  },
];

const NotaDinasTemplateManagement = () => {
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [kategori, setKategori] = useState<NotaDinasCategory>("permintaan_alat");
  const [templates, setTemplates] = useState<NotaDinasTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Partial<NotaDinasTemplate> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Muat daftar wilayah
  useEffect(() => {
    void supabase
      .from("regions")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        const opts: RegionOption[] = [
          { id: null, name: "Default Global (semua wilayah)" },
          ...((data || []) as { id: string; name: string }[]).map((r) => ({ id: r.id, name: r.name })),
        ];
        setRegions(opts);
      });
  }, []);

  // Muat daftar template saat wilayah atau kategori berubah
  const loadTemplates = () => {
    setLoading(true);
    void notaDinasTemplateService
      .getTemplatesByKategori(kategori, selectedRegionId)
      .then((tpls) => setTemplates(tpls))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
    setEditingTemplate(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, selectedRegionId]);

  const handleCreateNew = () => {
    const defaults = DEFAULT_NOTA_TEMPLATES[kategori || "permintaan_alat"];
    setEditingTemplate({
      nama: "",
      kategori,
      regionId: selectedRegionId,
      isDefault: templates.length === 0,
      ...defaults,
    });
  };

  const handleEdit = (tpl: NotaDinasTemplate) => {
    setEditingTemplate({ ...tpl });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
  };

  const handleDelete = async (tpl: NotaDinasTemplate) => {
    if (!window.confirm(`Hapus template "${tpl.nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await notaDinasTemplateService.deleteTemplate(tpl.id);
      showSuccess(`Template "${tpl.nama}" dihapus.`);
      loadTemplates();
      if (editingTemplate?.id === tpl.id) setEditingTemplate(null);
    } catch (err) {
      const msg = (err as any)?.message || JSON.stringify(err);
      showError(`Gagal menghapus template: ${msg}`);
    }
  };

  const handleSetDefault = async (tpl: NotaDinasTemplate) => {
    try {
      await notaDinasTemplateService.setDefault(tpl.id);
      showSuccess(`"${tpl.nama}" dijadikan template default.`);
      loadTemplates();
    } catch (err) {
      const msg = (err as any)?.message || JSON.stringify(err);
      showError(`Gagal mengatur template default: ${msg}`);
    }
  };

  const handleResetToDefault = () => {
    if (!editingTemplate) return;
    const defaults = DEFAULT_NOTA_TEMPLATES[kategori || "permintaan_alat"];
    setEditingTemplate((prev) => ({ ...prev, ...defaults }));
    showSuccess("Isi template dikembalikan ke nilai default. Klik Simpan untuk menyimpan.");
  };

  const setEditField = (key: keyof NotaDinasTemplate, value: string | boolean) => {
    setEditingTemplate((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.nama?.trim()) {
      showError("Nama template tidak boleh kosong.");
      return;
    }
    setSaving(true);
    try {
      await notaDinasTemplateService.save({
        id: editingTemplate.id,
        nama: editingTemplate.nama ?? "Template Baru",
        regionId: selectedRegionId,
        kategori,
        isDefault: editingTemplate.isDefault ?? false,
        paragrafPembuka: editingTemplate.paragrafPembuka ?? "",
        paragrafSubJudul: editingTemplate.paragrafSubJudul ?? "",
        paragrafPenutup: editingTemplate.paragrafPenutup ?? "",
        paragrafPerbaikanPermintaan: editingTemplate.paragrafPerbaikanPermintaan ?? "",
        paragrafPerbaikanLanjutan: editingTemplate.paragrafPerbaikanLanjutan ?? "",
        paragrafLanjutanAlat: editingTemplate.paragrafLanjutanAlat ?? "",
        paragrafKalimatPenutup: editingTemplate.paragrafKalimatPenutup ?? "",
        kolomPerbaikan: kategori === "perbaikan" ? (editingTemplate.kolomPerbaikan ?? null) : null,
      });
      showSuccess("Template berhasil disimpan.");
      loadTemplates();
      setEditingTemplate(null);
    } catch (err) {
      console.error("Save template error:", JSON.stringify(err));
      const msg = (err as any)?.message || (err as any)?.error_description || JSON.stringify(err);
      showError(`Gagal menyimpan template: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const visibleFields = FIELDS.filter((f) => f.showFor.includes(kategori));

  return (
    <div className="space-y-5">
      {/* Filter wilayah + kategori */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Wilayah</span>
          <Select
            value={selectedRegionId ?? "global"}
            onValueChange={(v) => setSelectedRegionId(v === "global" ? null : v)}
          >
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r.id ?? "global"} value={r.id ?? "global"}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">Kategori</span>
          <Select value={kategori} onValueChange={(v) => setKategori(v as NotaDinasCategory)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KATEGORI_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Daftar Template */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Daftar Template</h3>
          <Button
            type="button"
            size="sm"
            onClick={handleCreateNew}
            className="h-7 rounded-xl bg-indigo-600 text-xs font-bold hover:bg-indigo-700"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Buat Baru
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
          </div>
        ) : templates.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Belum ada template. Klik <span className="font-bold text-indigo-600">Buat Baru</span>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex items-center gap-2 py-2.5">
                {tpl.isDefault ? (
                  <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                ) : (
                  <Star className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {tpl.nama}
                  {tpl.isDefault && <span className="ml-1.5 text-xs font-normal text-amber-600">(Default)</span>}
                  {tpl.regionId === null && <span className="ml-1.5 text-xs font-normal text-slate-400">(Global)</span>}
                </span>
                <div className="flex shrink-0 gap-1">
                  {!tpl.isDefault && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(tpl)}
                      title="Jadikan Default"
                      className="h-6 rounded-lg px-1.5 text-xs text-amber-600 hover:bg-amber-50"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(tpl)}
                    title="Edit"
                    className="h-6 rounded-lg px-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(tpl)}
                    title="Hapus"
                    className="h-6 rounded-lg px-1.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form Edit/Buat Template */}
      {editingTemplate !== null && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-indigo-700">
            {editingTemplate.id ? "Edit Template" : "Buat Template Baru"}
          </h3>

          {/* Nama template */}
          <div className="mb-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Nama Template</span>
              <Input
                value={editingTemplate.nama ?? ""}
                onChange={(e) => setEditField("nama", e.target.value)}
                className="rounded-xl"
                placeholder="Contoh: Template Permintaan Alat"
              />
            </label>
          </div>

          {/* Toggle set default */}
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              id="mgmt-is-default-chk"
              checked={editingTemplate.isDefault ?? false}
              onChange={(e) => setEditField("isDefault", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            <label htmlFor="mgmt-is-default-chk" className="text-sm font-semibold text-slate-700 cursor-pointer">
              Jadikan template default untuk kategori ini
            </label>
          </div>

          {/* Field paragraf */}
          <div className="space-y-3">
            {visibleFields.map((field) => (
              <div key={field.key}>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{field.label}</span>
                  <Textarea
                    rows={3}
                    value={(editingTemplate[field.key] as string) ?? ""}
                    onChange={(e) => setEditField(field.key, e.target.value)}
                    className="rounded-xl font-mono text-sm"
                  />
                  <p className="text-[11px] text-slate-400">{field.hint}</p>
                </label>
              </div>
            ))}
          </div>

          {/* Editor kolom tabel — hanya untuk kategori perbaikan */}
          {kategori === "perbaikan" && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Konfigurasi Kolom Tabel</h4>
              <KolomPerbaikanEditor
                kolom={editingTemplate.kolomPerbaikan ?? [...DEFAULT_KOLOM_PERBAIKAN]}
                onChange={(kolom) => setEditField("kolomPerbaikan" as any, kolom as any)}
              />
            </div>
          )}

          {/* Tombol aksi */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleResetToDefault} className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Isi
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelEdit} className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100">
              Batal
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="ml-auto rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Menyimpan..." : "Simpan Template"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaDinasTemplateManagement;
