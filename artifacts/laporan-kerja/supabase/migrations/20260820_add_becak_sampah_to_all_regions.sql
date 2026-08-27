-- Pastikan kategori Becak Sampah tersedia pada seluruh wilayah operasional.
-- Aman dijalankan berulang: tim yang sudah ada akan diaktifkan kembali.
insert into public.teams (region_id, name)
select region.id, 'Becak Sampah'
from public.regions as region
where region.code in ('wilayah-1', 'wilayah-2', 'wilayah-3', 'wilayah-4', 'wilayah-5')
on conflict (region_id, name) do update
set is_active = true;
