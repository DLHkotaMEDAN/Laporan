-- Jalankan sekali melalui Supabase SQL Editor atau migration runner.
-- Memastikan perubahan Nota Dinas dikirim ke perangkat lain yang sedang membuka tab ini.
do $$
begin
  alter publication supabase_realtime add table public.nota_dinas_records;
exception
  when duplicate_object then null;
end;
$$;
