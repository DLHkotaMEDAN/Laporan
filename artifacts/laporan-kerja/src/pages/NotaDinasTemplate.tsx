"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Plus, RotateCcw, Save, Settings2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminAccess, isNotaDinasAdmin } from "@/constants/access-control";
import { notaDinasTemplateService } from "@/services/notaDinasTemplateService";
import { DEFAULT_NOTA_TEMPLATES, DEFAULT_KOLOM_PERBAIKAN, DEFAULT_KOLOM_PERMINTAAN } from "@/types/notaDinas";
import type { NotaDinasCategory, NotaDinasTemplate, KolomTabel } from "@/types/notaDinas";
import { supabase } from "@/lib/supabase";
import KolomPerbaikanEditor from "@/components/KolomPerbaikanEditor";
import ConfirmDialog from "@/components/ConfirmDialog";

const KATEGORI_OPTIONS: { value: NotaDinasCategory; label: string }[] = [
  { value: "permintaan_alat", label: "Permintaan Alat" },
  { value: "permintaan_bunga_bahan", label: "Permintaan Bunga dan Bahan" },
  { value: "perbaikan", label: "Perbaikan" },
];

const PLACEHOLDER_HINTS = [
  { key: "{wilayah}", desc: "Nama wilayah operasional" },
  { key: "{jumlahKecamatan}", desc: "Jumlah kecamatan" },
  { key: "{kecamatan}", desc: "Daftar nama kecamatan" },
  { key: "{penerima}", desc: "Bapak / Ibu" },
  { key: "{kepada}", desc: "Nama / jabatan penerima (field Yth/Kepada)" },
  { key: "{koordinatorRujukan}", desc: "Pengirim surat rujukan" },
  { key: "{nomorRujukan}", desc: "Nomor surat rujukan" },
  { key: "{tanggalRujukan}", desc: "Tanggal surat rujukan" },
  { key: "{halRujukan}", desc: "Perihal surat rujukan" },
  { key: "{jenisKendaraan}", desc: "Jenis kendaraan (perbaikan)" },
  { key: "{platKendaraan}", desc: "Plat nomor kendaraan (perbaikan)" },
  { key: "{uraianPemeriksaan}", desc: "Uraian hasil pemeriksaan (perbaikan lanjutan)" },
  { key: "{lokasiKejadian}", desc: "Lokasi kejadian (perbaikan lanjutan)" },
  { key: "{kegiatanKejadian}", desc: "Kegiatan saat kejadian (perbaikan lanjutan)" },
];

type FieldConfig = {
  key: keyof Omit<NotaDinasTemplate, 'id' | 'nama' | 'regionId' | 'kategori' | 'isDefault' | 'createdAt' | 'updatedAt'>;
  label: string;
  hint: string;
  showFor: NotaDinasCategory[];
};

const FIELDS: FieldConfig[] = [
  {
    key: "paragrafPembuka",
    label: "Paragraf Pembuka Permintaan",
    hint: "Teks awal surat sebelum tabel barang. Gunakan {wilayah}, {jumlahKecamatan}, {kecamatan}.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafSubJudul",
    label: "Sub Judul Permintaan",
    hint: "Kalimat sebelum tabel barang, misal: \"Adapun Permintaan Barang yang dibutuhkan sebagai berikut :\"",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafLanjutanAlat",
    label: "Paragraf Nota Lanjutan (Alat)",
    hint: "Teks pembuka pada nota lanjutan untuk permintaan alat. Gunakan {koordinatorRujukan}, {nomorRujukan}, {tanggalRujukan}, {halRujukan}.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan"],
  },
  {
    key: "paragrafPerbaikanPermintaan",
    label: "Paragraf Perbaikan — Surat Pertama",
    hint: "Teks sebelum tabel perbaikan. Gunakan {wilayah}, {jenisKendaraan}, {platKendaraan}.",
    showFor: ["perbaikan"],
  },
  {
    key: "paragrafPerbaikanLanjutan",
    label: "Paragraf Perbaikan — Nota Lanjutan",
    hint: "Teks pembuka nota lanjutan perbaikan. Gunakan {koordinatorRujukan}, {nomorRujukan}, {uraianPemeriksaan}, {lokasiKejadian}, {kegiatanKejadian}.",
    showFor: ["perbaikan"],
  },
  {
    key: "paragrafPenutup",
    label: "Kalimat Penutup",
    hint: "Kalimat setelah tabel. Untuk permintaan alat: gunakan {penerima} {kepada}. Untuk perbaikan: teks bebas.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan", "perbaikan"],
  },
  {
    key: "paragrafKalimatPenutup",
    label: "Kalimat Penutup Surat (sebelum tanda tangan)",
    hint: "Muncul setelah tabel dan sebelum blok tanda tangan. Auto-terisi ke form saat buat Nota Dinas baru.",
    showFor: ["permintaan_alat", "permintaan_bunga_bahan", "perbaikan"],
  },
];

const NotaDinasTemplate = () => {
  const navigate = useNavigate();
  const { profile, session, loading: authLoading } = useAuth();
  const isSuperAdmin = isSuperAdminAccess(profile?.role, session?.user?.email);
  const isRegionalAdmin = isNotaDinasAdmin(profile?.role);

  const [kategori, setKategori] = useState<NotaDinasCategory>("permintaan_alat");
  const [templates, setTemplates] = useState<NotaDinasTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Partial<NotaDinasTemplate> | null>(null);
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState<{ open: boolean; template: NotaDinasTemplate | null }>({ open: false, template: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regionName, setRegionName] = useState<string>("");

  /**
   * Aturan regionId:
   * - Super admin di halaman ini → kelola template global (null).
   *   Pengaturan per-wilayah sepenuhnya diserahkan ke admin masing-masing wilayah.
   * - admin_nota_dinas → dikunci ke profile.region_id (wilayah sendiri).
   *   Template wilayah ini independen — tidak mempengaruhi wilayah lain.
   */
  const effectiveRegionId: string | null = isSuperAdmin
    ? null
    : isRegionalAdmin
      ? (profile?.region_id ?? null)
      : null;

  // Muat nama wilayah untuk admin_nota_dinas
  useEffect(() => {
    if (!isRegionalAdmin || isSuperAdmin || !effectiveRegionId) {
      setRegionName("");
      return;
    }
    void supabase
      .from("regions")
      .select("name")
      .eq("id", effectiveRegionId)
      .maybeSingle()
      .then(({ data }) => setRegionName(data?.name || ""));
  }, [effectiveRegionId, isRegionalAdmin, isSuperAdmin]);

  // Muat daftar template saat kategori atau auth berubah
  const loadTemplates = () => {
    if (authLoading || (!isSuperAdmin && !isRegionalAdmin)) return;
    setLoading(true);
    void notaDinasTemplateService
      // Gunakan getOwnTemplates agar hanya melihat template milik sendiri
      .getOwnTemplates(kategori, effectiveRegionId)
      .then((tpls) => setTemplates(tpls))
      .catch((err) => { console.error(err); setTemplates([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
    setEditingTemplate(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, effectiveRegionId, authLoading, isSuperAdmin, isRegionalAdmin]);

  const handleCreateNew = () => {
    const defaults = DEFAULT_NOTA_TEMPLATES[kategori || "permintaan_alat"];
    setEditingTemplate({
      ...defaults,
      nama: "",
      kategori,
      regionId: effectiveRegionId,
      isDefault: templates.length === 0,
    });
  };

  const handleEdit = (tpl: NotaDinasTemplate) => {
    setEditingTemplate({ ...tpl });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
  };

  const handleDelete = (tpl: NotaDinasTemplate) => {
    setDeleteTemplateConfirm({ open: true, template: tpl });
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
        regionId: effectiveRegionId,
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
        kolomPermintaan: (kategori === "permintaan_alat" || kategori === "permintaan_bunga_bahan") ? (editingTemplate.kolomPermintaan ?? null) : null,
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

  if (!authLoading && !isSuperAdmin && !isRegionalAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Akses ditolak.
      </div>
    );
  }

  const visibleFields = FIELDS.filter((f) => f.showFor.includes(kategori));

  // Label konteks yang ditampilkan di info banner
  const contextLabel = isSuperAdmin
    ? "Template Default Global"
    : `Template Wilayah: ${regionName || "..."}`;

  const contextDescription = isSuperAdmin
    ? "Perubahan di sini berlaku sebagai fallback untuk semua wilayah yang belum memiliki template sendiri. Template ini tidak mempengaruhi wilayah yang sudah punya template sendiri."
    : "Template ini hanya berlaku untuk wilayah Anda dan tidak mempengaruhi wilayah lain. Jika belum ada template, sistem akan menggunakan template default global sebagai fallback.";

  return (
    <>
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate("/?tab=nota_dinas")} className="rounded-xl bg-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Settings2 className="h-5 w-5 text-indigo-600" /> Pengaturan Template
          </h1>
          <div className="w-24" />
        </div>

        {/* Info konteks */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-5 py-4">
          <p className="font-black text-indigo-900">{contextLabel}</p>
          <p className="mt-1 text-sm text-indigo-700/80">{contextDescription}</p>
        </div>

        {/* Pilih kategori */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Kategori Nota Dinas</span>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-600">Daftar Template</h2>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateNew}
              className="h-8 rounded-xl bg-indigo-600 text-xs font-bold hover:bg-indigo-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Baru
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat template...
            </div>
          ) : templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Belum ada template. Klik <span className="font-bold text-indigo-600">Buat Baru</span> untuk membuat template.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {templates.map((tpl) => (
                <li key={tpl.id} className="flex items-center gap-3 py-3">
                  {tpl.isDefault ? (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-label="Default" />
                  ) : (
                    <Star className="h-4 w-4 shrink-0 text-slate-300" aria-label="Bukan default" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                    {tpl.nama}
                    {tpl.isDefault && <span className="ml-2 text-xs font-normal text-amber-600">(Default)</span>}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {!tpl.isDefault && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(tpl)}
                        title="Jadikan Default"
                        className="h-7 rounded-lg px-2 text-xs text-amber-600 hover:bg-amber-50"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tpl)}
                      title="Edit"
                      className="h-7 rounded-lg px-2 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tpl)}
                      title="Hapus"
                      className="h-7 rounded-lg px-2 text-xs text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Form Edit/Buat Template */}
        {editingTemplate !== null && (
          <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-indigo-700">
              {editingTemplate.id ? "Edit Template" : "Buat Template Baru"}
            </h2>

            {/* Nama template */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block space-y-2">
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
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                id="is-default-chk"
                checked={editingTemplate.isDefault ?? false}
                onChange={(e) => setEditField("isDefault", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <label htmlFor="is-default-chk" className="cursor-pointer text-sm font-semibold text-slate-700">
                Jadikan template default untuk kategori ini
              </label>
            </div>

            {/* Field paragraf */}
            <div className="space-y-4">
              {visibleFields.map((field) => (
                <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">{field.label}</span>
                    <Textarea
                      rows={4}
                      value={(editingTemplate[field.key] as string) ?? ""}
                      onChange={(e) => setEditField(field.key, e.target.value)}
                      className="rounded-xl font-mono text-sm"
                      placeholder={`Isi ${field.label.toLowerCase()}...`}
                    />
                    <p className="text-[11px] text-slate-400">{field.hint}</p>
                  </label>
                </div>
              ))}
            </div>

            {/* Editor kolom tabel perbaikan */}
            {kategori === "perbaikan" && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Konfigurasi Kolom Tabel Perbaikan</h3>
                <KolomPerbaikanEditor
                  kolom={editingTemplate.kolomPerbaikan ?? [...DEFAULT_KOLOM_PERBAIKAN]}
                  onChange={(kolom) => setEditField("kolomPerbaikan" as any, kolom as any)}
                />
              </div>
            )}

            {/* Editor kolom tabel permintaan */}
            {(kategori === "permintaan_alat" || kategori === "permintaan_bunga_bahan") && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Konfigurasi Kolom Tabel Permintaan</h3>
                <KolomPerbaikanEditor
                  kolom={editingTemplate.kolomPermintaan ?? [...DEFAULT_KOLOM_PERMINTAAN]}
                  onChange={(kolom) => setEditField("kolomPermintaan" as any, kolom as any)}
                />
              </div>
            )}

            {/* Panduan placeholder */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Panduan Placeholder</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {PLACEHOLDER_HINTS.map(({ key, desc }) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <code className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-indigo-700">{key}</code>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol aksi form */}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetToDefault}
                className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Isi ke Default
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="h-10 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Menyimpan..." : "Simpan Template"}
              </Button>
            </div>
          </div>
        )}

        <div className="pb-10" />
      </div>
    </main>
    <ConfirmDialog
      open={deleteTemplateConfirm.open}
      onOpenChange={(open) => setDeleteTemplateConfirm(prev => ({ ...prev, open }))}
      title="Hapus Template"
      description={`Template "${deleteTemplateConfirm.template?.nama || ''}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
      variant="danger"
      confirmLabel="Ya, Hapus"
      onConfirm={async () => {
        if (!deleteTemplateConfirm.template) return;
        const tpl = deleteTemplateConfirm.template;
        try {
          await notaDinasTemplateService.deleteTemplate(tpl.id);
          showSuccess(`Template "${tpl.nama}" dihapus.`);
          loadTemplates();
          if (editingTemplate?.id === tpl.id) setEditingTemplate(null);
          setDeleteTemplateConfirm({ open: false, template: null });
        } catch (err) {
          const msg = (err as any)?.message || JSON.stringify(err);
          showError(`Gagal menghapus template: ${msg}`);
        }
      }}
    />
    </>
  );
};

export default NotaDinasTemplate;
