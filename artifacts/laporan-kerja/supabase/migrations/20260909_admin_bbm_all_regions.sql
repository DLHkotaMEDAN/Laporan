-- Admin BBM is a global fuel administrator; keep its profile unscoped.
update public.profiles
set region_id = null,
    team_id = null,
    updated_at = now()
where role = 'admin_bbm'
  and (region_id is not null or team_id is not null);
