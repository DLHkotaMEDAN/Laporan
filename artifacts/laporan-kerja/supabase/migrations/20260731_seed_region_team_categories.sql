-- Master kategori/tim per wilayah. Nama ini akan otomatis muncul di form
-- Laporan Harian, Rencana Kerja, dan pilihan kategori akun pengguna.

insert into public.teams (region_id, name)
select region.id, seeded_team.name
from public.regions region
join (values
  ('wilayah-1', 'Taman Labuhan'),
  ('wilayah-1', 'Taman Belawan'),
  ('wilayah-1', 'Taman Deli'),
  ('wilayah-1', 'Tim Babat'),
  ('wilayah-1', 'Tim Siram'),
  ('wilayah-1', 'Tim Pohon'),
  ('wilayah-2', 'Taman Baru'),
  ('wilayah-2', 'Taman Petisah'),
  ('wilayah-2', 'Taman Barat'),
  ('wilayah-2', 'Taman Helvetia'),
  ('wilayah-2', 'Tim Babat regu 1'),
  ('wilayah-2', 'Tim Babat Regu 2'),
  ('wilayah-2', 'Tim Siram'),
  ('wilayah-2', 'Tim Pohon 1'),
  ('wilayah-2', 'Tim Pohon 2'),
  ('wilayah-3', 'Taman Tugu Juang 45'),
  ('wilayah-3', 'Taman Sidodame'),
  ('wilayah-3', 'Taman Tugu KB'),
  ('wilayah-3', 'Taman Bandar Selamat'),
  ('wilayah-3', 'Taman Aksara'),
  ('wilayah-3', 'Tim Pohon'),
  ('wilayah-5', 'Taman Selayang'),
  ('wilayah-5', 'Taman Johor'),
  ('wilayah-5', 'Taman Tuntungan'),
  ('wilayah-5', 'Taman Polonia'),
  ('wilayah-5', 'Taman Maimun'),
  ('wilayah-5', 'Taman Sunggal'),
  ('wilayah-5', 'Tim Siram'),
  ('wilayah-5', 'Tim Pohon 1'),
  ('wilayah-5', 'Tim Pohon 2'),
  ('wilayah-5', 'Tim Babat')
) as seeded_team(region_code, name) on seeded_team.region_code = region.code
on conflict (region_id, name) do update set is_active = true;
