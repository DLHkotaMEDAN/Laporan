-- Jalankan sekali di Supabase SQL Editor.
create table if not exists public.signatory_settings (
  id uuid primary key default gen_random_uuid(),
  position text not null check (position in ('kabid_tata_lingkungan', 'ketua_tim_pemeliharaan_lingkungan', 'pengawas_taman_penghijauan', 'kepala_koordinator_taman', 'kepala_koordinator_pohon')),
  name text not null,
  nip text not null default '',
  region_id uuid references public.regions(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists signatory_settings_global_position_unique
  on public.signatory_settings(position) where region_id is null and is_active;
create unique index if not exists signatory_settings_regional_position_unique
  on public.signatory_settings(position, region_id) where region_id is not null and is_active;

alter table public.signatory_settings enable row level security;
create policy "signed in users can read signatories" on public.signatory_settings for select to authenticated using (true);
create policy "admins manage signatories" on public.signatory_settings for all to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
