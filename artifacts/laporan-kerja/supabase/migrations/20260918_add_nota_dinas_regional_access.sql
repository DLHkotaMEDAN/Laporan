-- Admin Nota Dinas memakai wilayah yang ditetapkan pada profil akunnya.
alter table public.nota_dinas_records
  add column if not exists region_id uuid references public.regions(id) on delete restrict;

-- Hubungkan dokumen lama yang nama wilayahnya masih tersimpan di JSON form.
update public.nota_dinas_records as record
set region_id = region.id
from public.regions as region
where record.region_id is null
  and lower(trim(record.form ->> 'wilayah')) = lower(trim(region.name));

create index if not exists nota_dinas_records_region_updated_at_idx
  on public.nota_dinas_records(region_id, updated_at desc);

create or replace function public.has_nota_dinas_region_access(target_region uuid, action text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_access_role() = 'admin'
      or (
        public.current_access_role() = 'admin_nota_dinas'
        and target_region is not null
        and target_region = public.current_access_region()
        and action in ('select', 'insert', 'update')
      )
    )
$$;

create or replace function public.assign_nota_dinas_region_from_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_access_role() = 'admin_nota_dinas' then
    if public.current_access_region() is null then
      raise exception 'Akun Admin Nota Dinas belum memiliki wilayah.';
    end if;
    new.region_id := public.current_access_region();
  end if;
  return new;
end;
$$;

drop trigger if exists nota_dinas_assign_region on public.nota_dinas_records;
create trigger nota_dinas_assign_region
before insert or update on public.nota_dinas_records
for each row execute function public.assign_nota_dinas_region_from_profile();

drop policy if exists "nota_dinas_select_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_insert_authenticated" on public.nota_dinas_records;
drop policy if exists "nota_dinas_update_authenticated" on public.nota_dinas_records;

create policy "nota_dinas_select_authenticated"
on public.nota_dinas_records
for select to authenticated
using (public.has_nota_dinas_region_access(region_id, 'select'));

create policy "nota_dinas_insert_authenticated"
on public.nota_dinas_records
for insert to authenticated
with check (
  public.has_nota_dinas_region_access(region_id, 'insert')
  and created_by = auth.uid()
);

create policy "nota_dinas_update_authenticated"
on public.nota_dinas_records
for update to authenticated
using (public.has_nota_dinas_region_access(region_id, 'update'))
with check (public.has_nota_dinas_region_access(region_id, 'update'));
