-- Aman dijalankan setelah migration awal SPJ Oli sudah diterapkan.
alter table public.spj_oli_records
  add column if not exists vehicle_name text,
  add column if not exists receiver_name text,
  add column if not exists operator_name text;
