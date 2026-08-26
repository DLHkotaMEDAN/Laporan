-- Tambahkan kategori/tim Dump Truck untuk setiap wilayah operasional.

insert into public.teams (region_id, name)
select id, 'Dump Truck'
from public.regions
where code in ('wilayah-1', 'wilayah-2', 'wilayah-3', 'wilayah-4', 'wilayah-5')
on conflict (region_id, name) do update set is_active = true;
