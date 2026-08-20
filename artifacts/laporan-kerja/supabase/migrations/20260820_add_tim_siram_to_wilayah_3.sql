-- Pastikan Tim Siram tersedia pada Wilayah 3 Medan Timur.
-- Aman dijalankan berulang: tim yang sudah ada akan diaktifkan kembali.
insert into public.teams (region_id, name)
select region.id, 'Tim Siram'
from public.regions as region
where region.code = 'wilayah-3'
on conflict (region_id, name) do update
set is_active = true;
