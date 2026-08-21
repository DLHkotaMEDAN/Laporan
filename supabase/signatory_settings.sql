-- Aman dijalankan ulang di Supabase SQL Editor.
create table if not exists public.signatory_settings (
  id uuid primary key default gen_random_uuid(),
  position text not null check (position in ('kabid_tata_lingkungan', 'ketua_tim_pemeliharaan_lingkungan', 'pengawas_taman_penghijauan', 'kepala_koordinator_taman', 'kepala_koordinator_pohon')),
  name text not null,
  nip text not null default '',
  all_regions boolean not null default false,
  region_ids uuid[] not null default '{}',
  categories text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jika tabel dibuat dari versi awal, tambahkan kolom konfigurasi terbaru.
alter table public.signatory_settings add column if not exists all_regions boolean not null default false;
alter table public.signatory_settings add column if not exists region_ids uuid[] not null default '{}';
alter table public.signatory_settings add column if not exists categories text[] not null default '{}';

alter table public.signatory_settings enable row level security;

-- Hapus policy lama terlebih dahulu supaya skrip dapat dijalankan ulang.
drop policy if exists "signed in users can read signatories" on public.signatory_settings;
drop policy if exists "admins manage signatories" on public.signatory_settings;

create policy "signed in users can read signatories" on public.signatory_settings for select to authenticated using (true);
create policy "admins manage signatories" on public.signatory_settings for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
