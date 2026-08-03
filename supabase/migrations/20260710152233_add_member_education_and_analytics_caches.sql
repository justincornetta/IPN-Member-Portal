-- Repeatable member education and durable analytics caches.

alter table public.profiles
  add column if not exists referral_source_other text;

create table if not exists public.member_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null check (length(btrim(institution)) > 0),
  degree_credential text,
  status text check (status is null or status in ('currently_enrolled', 'completed')),
  graduation_year integer check (
    graduation_year is null or graduation_year between 1900 and 2200
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_education_user_sort_idx
  on public.member_education (user_id, sort_order, created_at);

create index if not exists member_education_institution_idx
  on public.member_education (lower(institution));

insert into public.member_education (user_id, institution, sort_order)
select id, btrim(school), 0
from public.profiles
where nullif(btrim(school), '') is not null
  and not exists (
    select 1 from public.member_education education
    where education.user_id = profiles.id
  );

create table if not exists public.social_metric_snapshots (
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin')),
  snapshot_date date not null,
  follower_count integer not null check (follower_count >= 0),
  engagement_rate numeric check (engagement_rate is null or engagement_rate >= 0),
  posts_count integer check (posts_count is null or posts_count >= 0),
  source text not null check (source in ('api', 'manual', 'backfill')),
  details jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (platform, snapshot_date)
);

create index if not exists social_metric_snapshots_date_idx
  on public.social_metric_snapshots (snapshot_date desc, platform);

create index if not exists social_metric_snapshots_updated_by_idx
  on public.social_metric_snapshots (updated_by)
  where updated_by is not null;

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

-- Seed the known missing country immediately; the refresh importer adds the
-- complete legacy city/country cache after this migration is deployed.
insert into public.analytics_location_geocodes (
  location_key, city, state, country, latitude, longitude, precision, source
) values (
  'country|germany', null, null, 'Germany', 51.1657, 10.4515, 'country', 'country_centroid'
) on conflict (location_key) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

alter table public.member_education enable row level security;
alter table public.social_metric_snapshots enable row level security;
alter table public.analytics_location_geocodes enable row level security;

revoke all on table public.member_education from anon, authenticated;
revoke all on table public.social_metric_snapshots from anon, authenticated;
revoke all on table public.analytics_location_geocodes from anon, authenticated;

grant select, insert, update, delete on table public.member_education to authenticated;
grant select, insert, update, delete on table public.member_education to service_role;
grant select, insert, update, delete on table public.social_metric_snapshots to service_role;
grant select, insert, update, delete on table public.analytics_location_geocodes to service_role;

create policy "Members can view permitted education records"
  on public.member_education for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles member_profile
      where member_profile.id = member_education.user_id
        and member_profile.is_discoverable = true
    )
  );

create policy "Members can insert their own education records"
  on public.member_education for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Members can update their own education records"
  on public.member_education for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Members can delete their own education records"
  on public.member_education for delete
  to authenticated
  using ((select auth.uid()) = user_id);
