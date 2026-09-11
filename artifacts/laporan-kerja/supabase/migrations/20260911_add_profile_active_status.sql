alter table public.profiles
  add column if not exists is_active boolean not null default true;

update public.profiles
set is_active = true
where is_active is null;

create index if not exists profiles_is_active_idx on public.profiles(is_active);
