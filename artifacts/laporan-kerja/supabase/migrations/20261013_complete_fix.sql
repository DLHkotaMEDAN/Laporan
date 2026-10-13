-- ============================================================================
-- COMPLETE DATABASE FIX FOR SUPABASE ERRORS
-- ============================================================================
-- Copy seluruh isi file ini dan paste ke Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Create Assets Bucket
-- ============================================================================
-- Membuat bucket assets untuk menyimpan file statis seperti gambar landing page
-- Bucket ini dibuat public-read karena gambar ditampilkan langsung di halaman publik

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- PART 2: Setup Assets RLS Policies
-- ============================================================================
-- Memastikan RLS policies untuk bucket assets sudah terpasang
-- Public bisa membaca (untuk gambar landing page)
-- Admin bisa manage (insert, update, delete)

drop policy if exists "assets_public_read" on storage.objects;
drop policy if exists "assets_manage_admin" on storage.objects;

create policy "assets_public_read"
on storage.objects
for select
to public
using (bucket_id = 'assets');

create policy "assets_manage_admin"
on storage.objects
for all
to authenticated
using (bucket_id = 'assets' and public.has_admin_access())
with check (bucket_id = 'assets' and public.has_admin_access());

-- ============================================================================
-- PART 3: Add deleted_at Column and Update RLS Policies
-- ============================================================================
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

-- ============================================================================
-- DONE
-- ============================================================================
-- Setelah menjalankan script ini:
-- 1. Upload gambar ke bucket assets/landing/:
--    - mayor.jpg
--    - deputyMayor.jpg
--    - hero.jpg
--    - environmentHead.jpg
-- 2. Refresh browser untuk memverifikasi error sudah hilang
-- ============================================================================
