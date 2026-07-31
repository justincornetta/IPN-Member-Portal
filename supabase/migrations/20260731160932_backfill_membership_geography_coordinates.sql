-- Backfill the live-shaped membership geography set that postdates the
-- private May 2026 legacy cache. City rows preserve city-accurate markers;
-- country rows cover country-only members and provide an explicit fallback.

-- This migration deliberately creates the cache independently. Production
-- migration history predates the bundled education/analytics-cache migration,
-- and replaying that broader migration would couple this fix to unrelated
-- profile, education, and social-metric schema changes.
create table if not exists public.analytics_location_geocodes (
  location_key text primary key,
  city text,
  state text,
  country text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precision text not null check (precision in ('city', 'country')),
  source text not null default 'legacy_cache',
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_location_geocodes_country_idx
  on public.analytics_location_geocodes (lower(country));

alter table public.analytics_location_geocodes enable row level security;

revoke all on table public.analytics_location_geocodes from anon, authenticated;
grant select, insert, update, delete
  on table public.analytics_location_geocodes
  to service_role;

insert into public.analytics_location_geocodes (
  location_key,
  city,
  state,
  country,
  latitude,
  longitude,
  precision,
  source
) values
  ('city|salzburg||austria', 'Salzburg', null, 'Austria', 47.7981346, 13.0464806, 'city', 'nominatim'),
  ('city|monteverde||costa rica', 'Monteverde', null, 'Costa Rica', 10.2911515, -84.8136439, 'city', 'nominatim'),
  ('city|tehran|tehran province|iran', 'Tehran', 'Tehran Province', 'Iran', 35.6892523, 51.3896004, 'city', 'nominatim'),
  ('city|zarqa|zarqa governorate|jordan', 'Zarqa', 'Zarqa Governorate', 'Jordan', 32.0668425, 36.0885771, 'city', 'nominatim'),
  ('city|maputo|maputo|mozambique', 'Maputo', 'Maputo', 'Mozambique', -25.966213, 32.56745, 'city', 'nominatim'),
  ('city|nguruka|kigoma region|tanzania', 'Nguruka', 'Kigoma Region', 'Tanzania', -5.1112184, 31.0443477, 'city', 'nominatim'),
  ('city|tunis|tunis governorate|tunisia', 'Tunis', 'Tunis Governorate', 'Tunisia', 36.8002068, 10.1857757, 'city', 'nominatim'),
  ('city|dubai|dubai|united arab emirates', 'Dubai', 'Dubai', 'United Arab Emirates', 25.0742823, 55.1885624, 'city', 'nominatim'),
  ('country|austria', null, null, 'Austria', 47.59397, 14.12456, 'country', 'nominatim'),
  ('country|costa rica', null, null, 'Costa Rica', 10.2735633, -84.0739102, 'country', 'nominatim'),
  ('country|iran', null, null, 'Iran', 32.6475314, 54.5643516, 'country', 'nominatim'),
  ('country|jordan', null, null, 'Jordan', 31.1667049, 36.941628, 'country', 'nominatim'),
  ('country|mozambique', null, null, 'Mozambique', -19.302233, 34.9144977, 'country', 'nominatim'),
  ('country|tanzania', null, null, 'Tanzania', -6.5247123, 35.7878438, 'country', 'nominatim'),
  ('country|tunisia', null, null, 'Tunisia', 33.8439408, 9.400138, 'country', 'nominatim'),
  ('country|united arab emirates', null, null, 'United Arab Emirates', 24.0002488, 53.9994829, 'country', 'nominatim'),
  ('country|bangladesh', null, null, 'Bangladesh', 24.4769288, 90.2934413, 'country', 'nominatim'),
  ('country|iceland', null, null, 'Iceland', 64.9841821, -18.1059013, 'country', 'nominatim'),
  ('country|oman', null, null, 'Oman', 21.0000287, 57.0036901, 'country', 'nominatim'),
  ('country|palestine', null, null, 'Palestine', 32.2591449, 35.3015948, 'country', 'nominatim')
on conflict (location_key) do update set
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  precision = excluded.precision,
  source = excluded.source,
  resolved_at = now(),
  updated_at = now();
