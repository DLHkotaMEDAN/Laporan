import { supabase } from '@/lib/supabase';
import type { NotaDinasCategory, NotaDinasTemplate, KolomTabel } from '@/types/notaDinas';
import { DEFAULT_NOTA_TEMPLATES, DEFAULT_KOLOM_PERBAIKAN } from '@/types/notaDinas';

type TemplateRow = {
  id: string;
  nama: string;
  region_id: string | null;
  kategori: NotaDinasCategory;
  is_default: boolean;
  paragraf_pembuka: string;
  paragraf_sub_judul: string;
  paragraf_penutup: string;
  paragraf_perbaikan_permintaan: string;
  paragraf_perbaikan_lanjutan: string;
  paragraf_lanjutan_alat: string;
  paragraf_kalimat_penutup: string;
  kolom_perbaikan: KolomTabel[] | null;
  created_at: string;
  updated_at: string;
};

const toTemplate = (row: TemplateRow): NotaDinasTemplate => ({
  id: row.id,
  nama: row.nama ?? 'Template',
  regionId: row.region_id,
  kategori: row.kategori,
  isDefault: row.is_default ?? false,
  paragrafPembuka: row.paragraf_pembuka,
  paragrafSubJudul: row.paragraf_sub_judul,
  paragrafPenutup: row.paragraf_penutup,
  paragrafPerbaikanPermintaan: row.paragraf_perbaikan_permintaan,
  paragrafPerbaikanLanjutan: row.paragraf_perbaikan_lanjutan,
  paragrafLanjutanAlat: row.paragraf_lanjutan_alat,
  paragrafKalimatPenutup: row.paragraf_kalimat_penutup ?? '',
  kolomPerbaikan: row.kolom_perbaikan ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const notaDinasTemplateService = {
  /**
   * Ambil template aktif (is_default = true) untuk kategori tertentu.
   * Prioritas: template wilayah (regionId cocok) → template global (regionId null).
   * Fallback ke DEFAULT_NOTA_TEMPLATES jika belum ada di DB.
   */
  async getTemplate(kategori: NotaDinasCategory, regionId: string | null): Promise<NotaDinasTemplate> {
    let query = supabase
      .from('nota_dinas_templates')
      .select('*')
      .eq('kategori', kategori || 'permintaan_alat')
      .eq('is_default', true);

    if (regionId) {
      // Ambil keduanya: template wilayah dan template global
      query = query.or(`region_id.eq.${regionId},region_id.is.null`);
    } else {
      // Hanya template global
      query = query.is('region_id', null);
    }

    const { data, error } = await query.order('region_id', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Gagal memuat template Nota Dinas:', error);
      return notaDinasTemplateService.buildDefaultTemplate(kategori);
    }

    const rows = (data || []) as TemplateRow[];
    const wilayahTemplate = regionId ? rows.find((r) => r.region_id === regionId) : null;
    const globalTemplate = rows.find((r) => r.region_id === null);
    const best = wilayahTemplate ?? globalTemplate;
    return best ? toTemplate(best) : notaDinasTemplateService.buildDefaultTemplate(kategori);
  },

  /**
   * Ambil semua template untuk kategori+wilayah tertentu.
   * Digunakan di halaman manajemen template dan dropdown pilih template di form.
   */
  async getTemplatesByKategori(kategori: NotaDinasCategory, regionId: string | null): Promise<NotaDinasTemplate[]> {
    let query = supabase
      .from('nota_dinas_templates')
      .select('*')
      .eq('kategori', kategori || 'permintaan_alat');

    if (regionId) {
      // Tampilkan template wilayah dan template global
      query = query.or(`region_id.eq.${regionId},region_id.is.null`);
    } else {
      // Hanya template global
      query = query.is('region_id', null);
    }

    const { data, error } = await query.order('nama');
    if (error) throw error;
    return ((data || []) as TemplateRow[]).map(toTemplate);
  },

  /** Ambil semua template (untuk halaman Maintenance super admin) */
  async getAll(): Promise<NotaDinasTemplate[]> {
    const { data, error } = await supabase
      .from('nota_dinas_templates')
      .select('*')
      .order('region_id', { nullsFirst: true })
      .order('kategori')
      .order('nama');

    if (error) throw error;
    return ((data || []) as TemplateRow[]).map(toTemplate);
  },

  /** Simpan (upsert) template — buat baru atau update yang sudah ada */
  async save(
    template: Omit<NotaDinasTemplate, 'createdAt' | 'updatedAt'> & { id?: string },
  ): Promise<NotaDinasTemplate> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Sesi login tidak ditemukan.');

    const payload = {
      nama: template.nama || 'Template Baru',
      region_id: template.regionId ?? null,
      kategori: template.kategori,
      is_default: template.isDefault ?? false,
      paragraf_pembuka: template.paragrafPembuka,
      paragraf_sub_judul: template.paragrafSubJudul,
      paragraf_penutup: template.paragrafPenutup,
      paragraf_perbaikan_permintaan: template.paragrafPerbaikanPermintaan,
      paragraf_perbaikan_lanjutan: template.paragrafPerbaikanLanjutan,
      paragraf_lanjutan_alat: template.paragrafLanjutanAlat,
      paragraf_kalimat_penutup: template.paragrafKalimatPenutup,
      kolom_perbaikan: template.kolomPerbaikan ?? null,
      updated_at: new Date().toISOString(),
    };

    const insertPayload = {
      ...payload,
      created_by: userData.user.id,
    };

    // Jika sudah punya id → UPDATE langsung berdasarkan id
    if (template.id) {
      const { data, error } = await supabase
        .from('nota_dinas_templates')
        .update(payload)
        .eq('id', template.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (data) return toTemplate(data as TemplateRow);

      // UPDATE tidak return data — coba fetch ulang
      const { data: refetched, error: refetchError } = await supabase
        .from('nota_dinas_templates')
        .select('*')
        .eq('id', template.id)
        .maybeSingle();
      if (refetchError) throw refetchError;
      if (refetched) return toTemplate(refetched as TemplateRow);
    }

    // Insert baru
    const { data: inserted, error: insertError } = await supabase
      .from('nota_dinas_templates')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();
    if (insertError) throw insertError;
    if (inserted) return toTemplate(inserted as TemplateRow);

    // INSERT berhasil tapi RLS blokir SELECT — coba fetch manual
    let fetchAfterInsert = supabase
      .from('nota_dinas_templates')
      .select('*')
      .eq('kategori', template.kategori)
      .eq('nama', template.nama || 'Template Baru');
    if (template.regionId) {
      fetchAfterInsert = fetchAfterInsert.eq('region_id', template.regionId);
    } else {
      fetchAfterInsert = fetchAfterInsert.is('region_id', null);
    }
    const { data: afterInsert } = await fetchAfterInsert.maybeSingle();
    if (afterInsert) return toTemplate(afterInsert as TemplateRow);

    throw new Error('Template tidak tersimpan. Coba lagi.');
  },

  /**
   * Jadikan template tertentu sebagai default untuk region+kategorinya.
   * Trigger DB akan otomatis unset is_default pada template lain.
   */
  async setDefault(id: string): Promise<void> {
    const { error } = await supabase
      .from('nota_dinas_templates')
      .update({ is_default: true })
      .eq('id', id);
    if (error) throw error;
  },

  /** Hapus template berdasarkan id */
  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('nota_dinas_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Reset template wilayah tertentu — hapus agar fallback ke global */
  async resetRegionTemplate(regionId: string, kategori: NotaDinasCategory): Promise<void> {
    const { error } = await supabase
      .from('nota_dinas_templates')
      .delete()
      .eq('region_id', regionId)
      .eq('kategori', kategori);

    if (error) throw error;
  },

  buildDefaultTemplate(kategori: NotaDinasCategory): NotaDinasTemplate {
    const defaults = DEFAULT_NOTA_TEMPLATES[kategori || 'permintaan_alat'];
    return {
      id: '',
      nama: 'Template Default',
      regionId: null,
      kategori: kategori || 'permintaan_alat',
      isDefault: true,
      ...defaults,
      kolomPerbaikan: null,
      createdAt: '',
      updatedAt: '',
    };
  },

  /**
   * Terapkan nilai placeholder ke teks template.
   * Contoh: "{wilayah}" → "Wilayah 4 Medan Kota"
   */
  applyPlaceholders(text: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
      (result, [key, value]) => result.replaceAll(`{${key}}`, value || '......'),
      text,
    );
  },
};
