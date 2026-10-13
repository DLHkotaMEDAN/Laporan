-- ============================================================================
-- COMPLETE DATABASE FIX (Includes Table Creation)
-- ============================================================================
-- File ini menjalankan semua migration yang diperlukan dari awal
-- Copy seluruh isi dan paste ke Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Create Overtime Records Table
-- ============================================================================
create table if not exists public.overtime_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  nip text not null,
  position text not null,
  work_location text not null,
  photo_url text not null default '',
  start_time text not null,
  end_time text not null,
  attendance_count integer not null default 0 check (attendance_count >= 0),
  region_id uuid references public.regions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overtime_records enable row level security;

-- Add team_id column
alter table public.overtime_records
add column if not exists team_id uuid references public.teams(id) on delete restrict;

-- Add photo columns
alter table public.overtime_records
add column if not exists photo_before_url text not null default '',
add column if not exists photo_after_url text not null default '';

-- Update existing records
update public.overtime_records
set photo_before_url = photo_url
where photo_before_url = '' and photo_url <> '';

-- Create indexes
create index if not exists overtime_records_team_id_idx on public.overtime_records(team_id);
create index if not exists overtime_records_nip_idx on public.overtime_records(nip);

-- ============================================================================
-- PART 2: Create SPJ Oli Records Table
-- ============================================================================
create table if not exists public.spj_oli_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  region_id uuid not null references public.regions(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  spj_number text not null,
  vehicle_name text,
  receiver_name text,
  operator_name text,
  oil_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'Liter',
  location text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spj_oli_records_date_idx on public.spj_oli_records(date);
create index if not exists spj_oli_records_region_team_idx on public.spj_oli_records(region_id, team_id);

alter table public.spj_oli_records enable row level security;

-- ============================================================================
-- PART 3: Create Nota Dinas Records Table
-- ============================================================================
create table if not exists public.nota_dinas_records (
  id uuid primary key default gen_random_uuid(),
  form jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nota_dinas_records_updated_at_idx
on public.nota_dinas_records(updated_at desc);

alter table public.nota_dinas_records enable row level security;

-- Add region_id column
alter table public.nota_dinas_records
add column if not exists region_id uuid references public.regions(id) on delete restrict;

-- Link old records
update public.nota_dinas_records as record
set region_id = region.id
from public.regions as region
where record.region_id is null
  and lower(trim(record.form ->> 'wilayah')) = lower(trim(region.name));

create index if not exists nota_dinas_records_region_updated_at_idx
on public.nota_dinas_records(region_id, updated_at desc);

-- ============================================================================
-- PART 4: Create Access Functions
-- ============================================================================
create or replace function public.has_overtime_access(target_region uuid, action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role() in ('admin', 'pimpinan') then action in ('select', 'update') or public.current_access_role() = 'admin'
    when public.current_access_role() = 'admin_rekap_lembur' then
      target_region = public.current_access_region()
    when public.current_access_role() in ('admin_wilayah', 'admin_wilayah_bbm', 'admin_rencana_kerja', 'admin_rencana_kerja_bbm') then
      target_region = public.current_access_region()
    else false
  end
$$;

create or replace function public.has_spj_oli_record_access(target_region uuid, action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and case
    when public.current_access_role() = 'admin' then true
    when public.current_access_role() = 'admin_spj_bbm' then action in ('select', 'insert', 'update', 'delete')
    when public.current_access_role() = 'admin_spj_oli' then
      public.current_access_region() is null
      or target_region = public.current_access_region()
    when public.current_access_role() = 'pimpinan' then action in ('select', 'update')
    else false
  end
$$;

create or replace function public.has_nota_dinas_region_access(target_region uuid, action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_access_role() = 'admin'
      or (
        public.current_access_role() = 'admin_nota_dinas'
        and target_region is not null
        and target_region = public.current_access_region()
        and action in ('select', 'insert', 'update')
      )
    )
$$;

-- ============================================================================
-- PART 5: Create Assets Bucket
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- PART 6: Setup Assets RLS Policies
-- ============================================================================
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
-- PART 7: Add deleted_at Column to All Tables
-- ============================================================================
alter table public.overtime_records
add column if not exists deleted_at timestamptz;

alter table public.nota_dinas_records
add column if not exists deleted_at timestamptz;

alter table public.spj_oli_records
add column if not exists deleted_at timestamptz;

-- Create indexes
create index if not exists overtime_records_deleted_at_idx on public.overtime_records(deleted_at);
create index if not exists nota_dinas_records_deleted_at_idx on public.nota_dinas_records(deleted_at);
create index if not exists spj_oli_records_deleted_at_idx on public.spj_oli_records(deleted_at);

-- ============================================================================
-- PART 8: Update RLS Policies with Soft Delete Support
-- ============================================================================
-- Overtime records
drop policy if exists "overtime_select_authenticated" on public.overtime_records;
drop policy if exists "overtime_insert_authenticated" on public.overtime_records;
drop policy if exists "overtime_update_authenticated" on public.overtime_records;
drop policy if exists "overtime_delete_authenticated" on public.overtime_records;

create policy "overtime_select_authenticated"
on public.overtime_records for select to authenticated
using (public.has_overtime_access(region_id, 'select') and deleted_at is null);

create policy "overtime_insert_authenticated"
on public.overtime_records for insert to authenticated
with check (public.has_overtime_access(region_id, 'insert') and deleted_at is null);

create policy "overtime_update_authenticated"
on public.overtime_records for update to authenticated
using (public.has_overtime_access(region_id, 'update') and deleted_at is null)
with check (public.has_overtime_access(region_id, 'update') and deleted_at is null);

create policy "overtime_delete_authenticated"
on public.overtime_records for delete to authenticated
using (public.has_overtime_access(region_id, 'delete') and deleted_at is null);

-- SPJ Oli records
drop policy if exists "spj_oli_select_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_insert_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_update_authenticated" on public.spj_oli_records;
drop policy if exists "spj_oli_delete_authenticated" on public.spj_oli_records;

create policy "spj_oli_select_authenticated"
on public.spj_oli_records for select to authenticated
using (public.has_spj_oli_record_access(region_id, 'select') and deleted_at is null);

create policy "spj_oli_insert_authenticated"
on public.spj_oli_records for insert to authenticated
with check (public.has_spj_oli_record_access(region_id, 'insert') and deleted_at is null);

create policy "spj_oli_update_authenticated"
on public.spj_oli_records for update to authenticated
using (public.has_spj_oli_record_access(region_id, 'update') and deleted_at is null)
with check (public.has_spj_oli_record_access(region_id, 'update') and deleted_at is null);

create policy "spj_oli_delete_authenticated"
on public.spj_oli_records for delete to authenticated
using (public.has_spj_oli_record_access(region_id, 'delete') and deleted_at is null);

-- Nota Dinas records
drop policy if exists "nota_dinas_select_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_insert_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_update_authenticated" on public.nota_dinas_records;

create policy "nota_dinas_select_authenticated"
on public.nota_dinas_records for select to authenticated
using (public.has_nota_dinas_region_access(region_id, 'select') and deleted_at is null);

create policy "nota_dinas_insert_authenticated"
on public.nota_dinas_records for insert to authenticated
with check (
  public.has_nota_dinas_region_access(region_id, 'insert')
  and created_by = auth.uid()
  and deleted_at is null
);

create policy "nota_dinas_update_authenticated"
on public.nota_dinas_records for update to authenticated
using (public.has_nota_dinas_region_access(region_id, 'update') and deleted_at is null)
with check (public.has_nota_dinas_region_access(region_id, 'update') and deleted_at is null);

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
