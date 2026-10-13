-- Menambahkan kolom deleted_at untuk soft delete pada tabel yang belum memilikinya
-- Ini diperlukan karena service indexRecordCountService menggunakan filter deleted_at = null

-- Tambahkan deleted_at ke overtime_records
alter table public.overtime_records
add column if not exists deleted_at timestamptz;

-- Tambahkan deleted_at ke nota_dinas_records
alter table public.nota_dinas_records
add column if not exists deleted_at timestamptz;

-- Tambahkan deleted_at ke spj_oli_records
alter table public.spj_oli_records
add column if not exists deleted_at timestamptz;

-- Buat index untuk deleted_at agar query lebih cepat
create index if not exists overtime_records_deleted_at_idx on public.overtime_records(deleted_at);
create index if not exists nota_dinas_records_deleted_at_idx on public.nota_dinas_records(deleted_at);
create index if not exists spj_oli_records_deleted_at_idx on public.spj_oli_records(deleted_at);

-- Update RLS policies untuk mendukung soft delete
-- Overtime records - hanya admin dan role yang berhak bisa melihat data yang belum dihapus
drop policy if exists "overtime_select_authenticated" on public.overtime_records;
create policy "overtime_select_authenticated"
on public.overtime_records for select to authenticated
using (public.has_overtime_access(region_id, 'select') and deleted_at is null);

drop policy if exists "overtime_insert_authenticated" on public.overtime_records;
create policy "overtime_insert_authenticated"
on public.overtime_records for insert to authenticated
with check (public.has_overtime_access(region_id, 'insert') and deleted_at is null);

drop policy if exists "overtime_update_authenticated" on public.overtime_records;
create policy "overtime_update_authenticated"
on public.overtime_records for update to authenticated
using (public.has_overtime_access(region_id, 'update') and deleted_at is null)
with check (public.has_overtime_access(region_id, 'update') and deleted_at is null);

drop policy if exists "overtime_delete_authenticated" on public.overtime_records;
create policy "overtime_delete_authenticated"
on public.overtime_records for delete to authenticated
using (public.has_overtime_access(region_id, 'delete') and deleted_at is null);

-- Nota Dinas records - update policies untuk mendukung soft delete
drop policy if exists "nota_dinas_select_authenticated" on public.nota_dinas_records;
create policy "nota_dinas_select_authenticated"
on public.nota_dinas_records for select to authenticated
using (public.has_nota_dinas_region_access(region_id, 'select') and deleted_at is null);

drop policy if exists "nota_dinas_insert_authenticated" on public.nota_dinas_records;
create policy "nota_dinas_insert_authenticated"
on public.nota_dinas_records for insert to authenticated
with check (
  public.has_nota_dinas_region_access(region_id, 'insert')
  and created_by = auth.uid()
  and deleted_at is null
);

drop policy if exists "nota_dinas_update_authenticated" on public.nota_dinas_records;
create policy "nota_dinas_update_authenticated"
on public.nota_dinas_records for update to authenticated
using (public.has_nota_dinas_region_access(region_id, 'update') and deleted_at is null)
with check (public.has_nota_dinas_region_access(region_id, 'update') and deleted_at is null);

-- SPJ Oli records - update policies untuk mendukung soft delete
drop policy if exists "spj_oli_select_authenticated" on public.spj_oli_records;
create policy "spj_oli_select_authenticated"
on public.spj_oli_records for select to authenticated
using (public.has_spj_oli_record_access(region_id, 'select') and deleted_at is null);

drop policy if exists "spj_oli_insert_authenticated" on public.spj_oli_records;
create policy "spj_oli_insert_authenticated"
on public.spj_oli_records for insert to authenticated
with check (public.has_spj_oli_record_access(region_id, 'insert') and deleted_at is null);

drop policy if exists "spj_oli_update_authenticated" on public.spj_oli_records;
create policy "spj_oli_update_authenticated"
on public.spj_oli_records for update to authenticated
using (public.has_spj_oli_record_access(region_id, 'update') and deleted_at is null)
with check (public.has_spj_oli_record_access(region_id, 'update') and deleted_at is null);

drop policy if exists "spj_oli_delete_authenticated" on public.spj_oli_records;
create policy "spj_oli_delete_authenticated"
on public.spj_oli_records for delete to authenticated
using (public.has_spj_oli_record_access(region_id, 'delete') and deleted_at is null);
