import { supabase } from '@/lib/supabase';
import { auditLogService } from '@/services/auditLogService';
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
  /** Resolve region_id dari form.wilayah (nama wilayah) jika regionId tidak disediakan */
  async resolveRegionId(form: NotaDinasForm, regionId?: string | null): Promise<string | null> {
    if (regionId) return regionId;
    if (!form.wilayah) return null;

    // Cari region berdasarkan nama wilayah yang tersimpan di form
    const { data } = await supabase
      .from('regions')
      .select('id')
      .ilike('name', form.wilayah.trim())
      .maybeSingle();

    return data?.id ?? null;
  },

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

    // Jika regionId tidak diberikan, coba resolve dari kodeWilayah di form
    const resolvedRegionId = await notaDinasService.resolveRegionId(form, regionId);

    const payload = {
      ...(isUuid(id) ? { id } : {}),
      form,
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(updatedAt ? { updated_at: updatedAt } : {}),
      region_id: resolvedRegionId,
      created_by: userData.user.id,
    };

    const { data, error } = await supabase
      .from('nota_dinas_records')
      .insert(payload)
      .select('id, form, region_id, created_at, updated_at')
      .single();

    if (error) throw error;
    const created = toRecord(data as NotaDinasRow);
    void auditLogService.logCurrentUser({
      action: 'CREATE',
      entityType: 'NOTA_DINAS',
      entityId: created.id,
      details: { jenisNotaDinas: form.jenisNotaDinas, tanggal: form.tanggal, wilayah: form.wilayah },
    });
    return created;
  },

  async update(id: string, form: NotaDinasForm, updatedAt?: string, regionId?: string | null) {
    // Jika regionId tidak diberikan, coba resolve dari kodeWilayah di form
    const resolvedRegionId = await notaDinasService.resolveRegionId(form, regionId);

    const { data, error } = await supabase
      .from('nota_dinas_records')
      .update({
        form,
        updated_at: updatedAt || new Date().toISOString(),
        region_id: resolvedRegionId,
      })
      .eq('id', id)
      .select('id, form, region_id, created_at, updated_at')
      .single();

    if (error) throw error;
    void auditLogService.logCurrentUser({
      action: 'UPDATE',
      entityType: 'NOTA_DINAS',
      entityId: id,
      details: { jenisNotaDinas: form.jenisNotaDinas, tanggal: form.tanggal, wilayah: form.wilayah },
    });
    return toRecord(data as NotaDinasRow);
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('nota_dinas_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
    void auditLogService.logCurrentUser({
      action: 'DELETE',
      entityType: 'NOTA_DINAS',
      entityId: id,
      details: { mode: 'hard_delete' },
    });
  },

  async save(form: NotaDinasForm, id?: string, createdAt?: string, regionId?: string | null) {
    return id ? this.update(id, form, undefined, regionId) : this.create(form, undefined, createdAt, undefined, regionId);
  },
};
