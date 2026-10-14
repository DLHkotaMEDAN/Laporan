-- Add is_active check to RLS helper functions
-- This ensures inactive accounts cannot access data via database level

-- Update current_access_role to check is_active
create or replace function public.current_access_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles 
  where id = auth.uid() 
    and is_active = true
$$;

-- Update current_access_region to check is_active
create or replace function public.current_access_region()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select region_id from public.profiles 
  where id = auth.uid() 
    and is_active = true
$$;

-- Update current_access_team to check is_active
create or replace function public.current_access_team()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles 
  where id = auth.uid() 
    and is_active = true
$$;

-- Update has_record_access to check is_active via current_access_role
create or replace function public.has_record_access(
  target_region uuid,
  target_team uuid,
  resource text,
  action text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role() = 'admin' then true
    when public.current_access_role() = 'pimpinan' then action in ('select', 'update')
    when public.current_access_role() = 'admin_laporan' then action in ('select', 'insert', 'update')
    when public.current_access_role() = 'admin_rencana_kerja' then action in ('select', 'insert', 'update')
    when public.current_access_role() = 'admin_bbm' then action in ('select', 'insert', 'update')
    when public.current_access_role() = 'admin_spj_oli' then action in ('select', 'insert', 'update')
    when public.current_access_role() = 'laporan' then action = 'select'
    when public.current_access_role() = 'rencana_kerja' then action = 'select'
    when public.current_access_role() = 'bbm' then action = 'select'
    when public.current_access_role() = 'spj_oli' then action = 'select'
    when public.current_access_role() = 'operator' then action in ('select', 'insert', 'update')
    else false
  end
$$;

-- Note: All existing RLS policies that use these helper functions
-- will automatically enforce the is_active check
