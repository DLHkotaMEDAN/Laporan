import { supabase } from '@/lib/supabase';
import type { NotaDinasForm, NotaDinasRecord } from '@/types/notaDinas';

type NotaDinasRow = {
  id: string;
  form: NotaDinasForm;
  region_id: string | null;
  created_at: string;
  updated_at: string;
};

const isUuid = (value: string | undefined): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const toRecord = (row: NotaDinasRow): NotaDinasRecord => ({
  id: row.id,
  // Dokumen lama belum memiliki kategori; anggap sebagai Permintaan Alat.
  form: {
    ...row.form,
    jenisDokumen: row.form.jenisDokumen === 'perbaikan' ? 'permintaan' : row.form.jenisDokumen,
    jenisNotaDinas: row.form.jenisDokumen === 'perbaikan' || row.form.jenisNotaDinas === 'perbaikan'
      ? 'perbaikan'
      : row.form.jenisNotaDinas ?? 'permintaan_alat',
    kodeSurat: row.form.jenisDokumen === 'perbaikan' || row.form.jenisNotaDinas === 'perbaikan' ? 'SPm-PM' : 'SPB',
  },
  regionId: row.region_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const notaDinasService = {
  async getAll() {
    const { data, error } = await supabase
      .from('nota_dinas_records')
      .select('id, form, region_id, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return ((data || []) as NotaDinasRow[]).map(toRecord);
  },

  async create(form: NotaDinasForm, id?: string, createdAt?: string, updatedAt?: string, regionId?: string | null) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Sesi login tidak ditemukan.');

    const payload = {
      // Older browser-only records may have used a non-UUID id. Let
      // PostgreSQL generate an id for those records instead of rejecting the
      // whole migration.
      ...(isUuid(id) ? { id } : {}),
      form,
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(updatedAt ? { updated_at: updatedAt } : {}),
      ...(regionId ? { region_id: regionId } : {}),
      created_by: userData.user.id,
    };

    const { data, error } = await supabase
      .from('nota_dinas_records')
      .insert(payload)
      .select('id, form, region_id, created_at, updated_at')
      .single();

    if (error) throw error;
    return toRecord(data as NotaDinasRow);
  },

  async update(id: string, form: NotaDinasForm, updatedAt?: string, regionId?: string | null) {
    const { data, error } = await supabase
      .from('nota_dinas_records')
      .update({ form, updated_at: updatedAt || new Date().toISOString(), ...(regionId ? { region_id: regionId } : {}) })
      .eq('id', id)
      .select('id, form, region_id, created_at, updated_at')
      .single();

    if (error) throw error;
    return toRecord(data as NotaDinasRow);
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('nota_dinas_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async save(form: NotaDinasForm, id?: string, createdAt?: string, regionId?: string | null) {
    return id ? this.update(id, form, undefined, regionId) : this.create(form, undefined, createdAt, undefined, regionId);
  },
};
