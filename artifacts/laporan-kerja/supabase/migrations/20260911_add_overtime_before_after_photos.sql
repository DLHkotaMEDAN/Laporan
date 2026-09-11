alter table public.overtime_records
  add column if not exists photo_before_url text not null default '',
  add column if not exists photo_after_url text not null default '';

-- Preserve existing single-photo records as the "Sebelum" photo.
update public.overtime_records
set photo_before_url = photo_url
where photo_before_url = '' and photo_url <> '';
