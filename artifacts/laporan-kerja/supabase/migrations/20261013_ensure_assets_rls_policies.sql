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
