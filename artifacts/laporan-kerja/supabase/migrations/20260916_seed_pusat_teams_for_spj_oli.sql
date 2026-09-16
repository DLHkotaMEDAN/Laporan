-- Pastikan pilihan Tim / Operator untuk Wilayah Pusat tersedia di master
-- teams. SPJ Oli menyimpan team_id sebagai foreign key, sehingga pilihan
-- harus berasal dari master dan bukan hanya nama cadangan di sisi aplikasi.
update public.teams team
set name = 'Tim Babat 1'
from public.regions region
where team.region_id = region.id
  and region.code = 'pusat'
  and team.name = 'Tim Babat';

insert into public.teams (region_id, name)
select region.id, seeded_team.name
from public.regions region
cross join (values
  ('Tim Babat 1'),
  ('Tim Babat 2'),
  ('Tim Babat 3'),
  ('Tim Babat 4'),
  ('Dumb Truck'),
  ('Mobil Crane'),
  ('Pickup'),
  ('Mobil Tangga'),
  ('Mobil Tangga 30M'),
  ('Beco Loader')
) as seeded_team(name)
where region.code = 'pusat'
on conflict (region_id, name) do update set is_active = true;
