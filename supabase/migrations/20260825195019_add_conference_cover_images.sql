alter table public.conferences
  add column if not exists cover_image_url text;

alter table public.past_conferences
  add column if not exists cover_image_url text;

comment on column public.conferences.cover_image_url is
  'Public URL for the conference cover image, cropped to a 16:9 aspect ratio.';

comment on column public.past_conferences.cover_image_url is
  'Public URL for the past conference cover image, cropped to a 16:9 aspect ratio.';
