-- Keep two separate documentation photos for overtime records.
-- photo_url remains as the legacy alias for the "before" photo.
alter table public.overtime_records
  add column if not exists photo_before_url text not null default '',
  add column if not exists photo_after_url text not null default '';

-- Preserve existing records created before the two-photo fields were introduced.
update public.overtime_records
set photo_before_url = photo_url
where coalesce(photo_before_url, '') = ''
  and coalesce(photo_url, '') <> '';
