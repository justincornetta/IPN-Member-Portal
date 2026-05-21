-- ============================================================
-- IPN Member Portal — Supabase schema
-- Run this in the Supabase SQL Editor (project → SQL Editor → New query)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS throughout
-- ============================================================


-- ── 1. Profiles table ───────────────────────────────────────

create table if not exists public.profiles (
  id                        uuid primary key references auth.users on delete cascade,
  first_name                text,
  last_name                 text,
  country                   text,
  state                     text,
  city                      text,
  city_lat                  float8,
  city_lng                  float8,
  persona                   text,
  affiliation               text,
  school                    text,
  field                     text,
  psychedelic_field_status  text,
  psychedelic_field_barriers text[],
  role_and_goals            text,
  inspiration               text,
  referral_source           text,
  bio                       text,
  area_of_interest          text,
  linkedin_url              text,
  is_discoverable           boolean not null default true,
  share_location            boolean not null default true,
  avatar_url                text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Migration: run this against any existing database created before this change
-- alter table public.profiles add column if not exists school text;
-- alter table public.profiles drop column if exists education_status;
-- alter table public.profiles add column if not exists city_lat float8;
-- alter table public.profiles add column if not exists city_lng float8;
-- alter table public.profiles add column if not exists bio text;
-- alter table public.profiles add column if not exists area_of_interest text;
-- alter table public.profiles add column if not exists linkedin_url text;
-- alter table public.profiles add column if not exists is_discoverable boolean not null default true;
-- alter table public.profiles add column if not exists share_location boolean not null default true;
-- alter table public.profiles add column if not exists avatar_url text;


-- ── 2. Row-Level Security ────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ── 3. Auto-create profile on signup ────────────────────────
--
-- When a user registers, signUp() passes all form fields into
-- user_metadata. This trigger copies them into profiles so the
-- data is queryable as a proper table row from day one.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    country,
    state,
    city,
    city_lat,
    city_lng,
    persona,
    affiliation,
    school,
    field,
    psychedelic_field_status,
    psychedelic_field_barriers,
    role_and_goals,
    inspiration,
    referral_source
  ) values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'city',
    (new.raw_user_meta_data->>'city_lat')::float8,
    (new.raw_user_meta_data->>'city_lng')::float8,
    new.raw_user_meta_data->>'persona',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'school',
    new.raw_user_meta_data->>'field',
    new.raw_user_meta_data->>'psychedelic_field_status',
    case
      when new.raw_user_meta_data ? 'psychedelic_field_barriers'
      then array(
        select jsonb_array_elements_text(
          new.raw_user_meta_data->'psychedelic_field_barriers'
        )
      )
      else null
    end,
    new.raw_user_meta_data->>'role_and_goals',
    new.raw_user_meta_data->>'inspiration',
    new.raw_user_meta_data->>'referral_source'
  );
  return new;
end;
$$;

-- Drop and recreate trigger so re-running this file is safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();


-- ── 4. Avatar storage ────────────────────────────────────────
--
-- Public bucket — avatars are readable by anyone.
-- Each user's avatar is stored at path = their user ID (no extension).
-- RLS restricts uploads/updates to the owning user.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = name);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = name);

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');


-- ── 5. Events ───────────────────────────────────────────────
--
-- Events are authored in Supabase for v1. The Admin Portal will add a
-- friendlier editor later. `thumbnail_url` supports custom event graphics.

create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  title               text not null,
  event_type          text not null default 'IPN Lab',
  starts_at           timestamptz not null,
  ends_at             timestamptz,
  timezone            text not null default 'America/New_York',
  summary             text,
  description         text,
  speakers            text,
  location_label      text,
  location_details    text,
  join_url            text,
  thumbnail_url       text,
  status              text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),
  registration_count  integer not null default 0
    check (registration_count >= 0),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at);

alter table public.events enable row level security;

drop policy if exists "Authenticated users can view published events" on public.events;
create policy "Authenticated users can view published events"
  on public.events for select
  using (auth.role() = 'authenticated' and status = 'published');


-- ── 6. Event registrations ──────────────────────────────────
--
-- One row per member RSVP. The visible social-proof count lives on
-- events.registration_count so members do not need access to other members'
-- registration rows.

create table if not exists public.event_registrations (
  event_id       uuid not null references public.events on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  created_at     timestamptz default now(),
  reminder_state text not null default 'not_configured',
  primary key (event_id, user_id)
);

create index if not exists event_registrations_user_id_idx
  on public.event_registrations (user_id);

alter table public.event_registrations enable row level security;

drop policy if exists "Users can view own event registrations" on public.event_registrations;
create policy "Users can view own event registrations"
  on public.event_registrations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own event registrations" on public.event_registrations;
create policy "Users can create own event registrations"
  on public.event_registrations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.events
      where events.id = event_registrations.event_id
        and events.status = 'published'
    )
  );


-- ── 7. Event registration counts ────────────────────────────

create or replace function public.sync_event_registration_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.events
    set registration_count = registration_count + 1,
        updated_at = now()
    where id = new.event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.events
    set registration_count = greatest(registration_count - 1, 0),
        updated_at = now()
    where id = old.event_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists event_registration_count_changed on public.event_registrations;

create trigger event_registration_count_changed
  after insert or delete on public.event_registrations
  for each row
  execute procedure public.sync_event_registration_count();
