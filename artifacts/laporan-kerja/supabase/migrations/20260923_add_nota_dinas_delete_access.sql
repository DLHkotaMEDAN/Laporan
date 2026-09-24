-- Izinkan penghapusan Nota Dinas dari datasheet sesuai cakupan akses akun.
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
        and action in ('select', 'insert', 'update', 'delete')
      )
    )
$$;

drop policy if exists "nota_dinas_delete_authenticated" on public.nota_dinas_records;

create policy "nota_dinas_delete_authenticated"
on public.nota_dinas_records
for delete to authenticated
using (public.has_nota_dinas_region_access(region_id, 'delete'));
