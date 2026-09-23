-- Samakan data lama BBM dan SPJ dengan master wilayah/tim yang dipakai
-- Laporan Harian dan Rencana Kerja.

update public.teams team
set name = case team.name
  when 'Dump Truck' then 'Dumb Truck'
  when 'PickUp' then 'Pickup'
  when 'Mobil Tangga 30m' then 'Mobil Tangga 30M'
  else team.name
end
from public.regions region
where team.region_id = region.id
  and region.code = 'pusat'
  and team.name in ('Dump Truck', 'PickUp', 'Mobil Tangga 30m');

insert into public.teams (region_id, name)
select region.id, seeded_team.name
from public.regions region
cross join (values
  ('Tim Babat'),
  ('Dumb Truck'),
  ('Mobil Crane'),
  ('Mobil Tangga'),
  ('Mobil Tangga 30M'),
  ('Beco Loader'),
  ('Pickup')
) as seeded_team(name)
where region.code = 'pusat'
on conflict (region_id, name) do update set is_active = true;

update public.fuel_reports fuel
set region_id = region.id,
    region = region.name,
    team_id = team.id
from public.regions region
left join public.teams team on team.region_id = region.id and team.name = fuel.team
where region.code = case fuel.region
  when 'Pusat' then 'pusat'
  when 'Wilayah 1 Utara' then 'wilayah-1'
  when 'Wilayah 1 Medan Utara' then 'wilayah-1'
  when 'Wilayah 2 Barat' then 'wilayah-2'
  when 'Wilayah 2 Medan Barat' then 'wilayah-2'
  when 'Wilayah 3 Timur' then 'wilayah-3'
  when 'Wilayah 3 Medan Timur' then 'wilayah-3'
  when 'Wilayah 4 Kota' then 'wilayah-4'
  when 'Wilayah 4 Medan Kota' then 'wilayah-4'
  when 'Wilayah 5 Selatan' then 'wilayah-5'
  when 'Wilayah 5 Medan Selatan' then 'wilayah-5'
end;
