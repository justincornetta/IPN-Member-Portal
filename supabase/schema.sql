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
-- Past IPN Labs and PsychedelX recordings also live here with is_recording.

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
  is_recording        boolean not null default false,
  recording_url       text,
  recording_provider  text,
  recording_category  text,
  recording_source_id text,
  recording_published_at timestamptz,
  speaker_resources   jsonb,
  status              text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),
  registration_count  integer not null default 0
    check (registration_count >= 0),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.events add column if not exists speaker_resources jsonb;

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at);

alter table public.events add column if not exists is_recording boolean not null default false;
alter table public.events add column if not exists recording_url text;
alter table public.events add column if not exists recording_provider text;
alter table public.events add column if not exists recording_category text;
alter table public.events add column if not exists recording_source_id text;
alter table public.events add column if not exists recording_published_at timestamptz;
alter table public.events add column if not exists speaker_resources jsonb;

create index if not exists events_recordings_type_starts_at_idx
  on public.events (status, is_recording, event_type, starts_at desc);

create index if not exists events_recordings_category_starts_at_idx
  on public.events (status, is_recording, event_type, recording_category, starts_at desc);

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


-- ── 8. Resources ────────────────────────────────────────────
--
-- Member-only resource library: approved benefits, blog posts, and
-- partner/sponsor visibility. Admin editing will come through the Admin Portal;
-- until then, rows are managed directly in Supabase.

insert into storage.buckets (id, name, public)
values ('resource-assets', 'resource-assets', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.resources (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  resource_type  text not null,
  title          text not null,
  description    text,
  url            text not null,
  category       text not null,
  image_url      text,
  image_alt      text,
  thumbnail_url  text,
  benefit_note   text,
  detail_body    text,
  author         text,
  published_at   timestamptz,
  source_id      text,
  source_name    text,
  featured       boolean not null default false,
  sort_order     integer not null default 0,
  status         text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.resources add column if not exists thumbnail_url text;
alter table public.resources add column if not exists detail_body text;
alter table public.resources add column if not exists author text;
alter table public.resources add column if not exists published_at timestamptz;
alter table public.resources add column if not exists source_id text;
alter table public.resources add column if not exists source_name text;

alter table public.resources drop constraint if exists resources_resource_type_check;
delete from public.resources where resource_type = 'content';
alter table public.resources add constraint resources_resource_type_check
  check (resource_type in (
    'affiliate_benefit',
    'ipn_lab_recording',
    'psychedelx_recording',
    'blog_post',
    'partner'
  ));

create index if not exists resources_status_type_sort_idx
  on public.resources (status, resource_type, featured desc, sort_order, title);

alter table public.resources enable row level security;

drop policy if exists "Authenticated users can view published resources" on public.resources;
create policy "Authenticated users can view published resources"
  on public.resources for select
  using (auth.role() = 'authenticated' and status = 'published');

insert into public.resources (
  slug,
  resource_type,
  title,
  description,
  url,
  category,
  image_url,
  image_alt,
  thumbnail_url,
  benefit_note,
  detail_body,
  author,
  published_at,
  source_id,
  source_name,
  featured,
  sort_order,
  status
) values
  ($$zendo-project-sit$$, $$affiliate_benefit$$, $$Zendo Project Sitting and Integration Training (SIT)$$, $$Live online training in psychedelic harm reduction, peer support, trauma-attuned care, difficult experiences, integration, and ethical sitter boundaries.$$, $$https://zendoproject.org/sit/$$, $$Member benefits$$, $$https://plgzakxecjlzepzeqiio.supabase.co/storage/v1/object/public/resource-assets/zendo/social_option_1_zendosit.png$$, $$Zendo SIT weekend intensive program graphic.$$, null, $$50% off with member code IPN50, bringing the course to $298.50.$$, $$IPN recommends Zendo SIT for members exploring psychedelic care, clinical pathways, harm reduction, or community support roles. It offers a structured bridge between interest and practice, with live training in peer support, trauma-attuned care, difficult experiences, integration, and ethical sitter boundaries.$$, null, null, null, $$Zendo Project$$, true, 10, $$published$$),
  ($$psychedelx-robert-earth-a-story-about-the-third-magical-fungi$$, $$psychedelx_recording$$, $$Robert Earth - A Story About The Third Magical Fungi$$, $$Robert Earth - A Story about The Third Magical Fungi Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=ztzr90dp6nc$$, $$PsychedelX recordings$$, null, $$Robert Earth - A Story About The Third Magical Fungi thumbnail$$, $$https://i.ytimg.com/vi/ztzr90dp6nc/hqdefault.jpg$$, null, $$Robert Earth - A Story about The Third Magical Fungi Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-08-01T17:07:01+00:00$$, $$ztzr90dp6nc$$, $$YouTube$$, false, 100, $$published$$),
  ($$psychedelx-psychedelx-2025-closing-ceremony-and-talk-competition-awards$$, $$psychedelx_recording$$, $$PsychedelX 2025: Closing Ceremony and Talk Competition Awards$$, $$PsychedelX 2025: Closing Ceremony and Talk Competition Awards IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, $$https://www.youtube.com/watch?v=VrDTfc8OFk4$$, $$PsychedelX recordings$$, null, $$PsychedelX 2025: Closing Ceremony and Talk Competition Awards thumbnail$$, $$https://i.ytimg.com/vi/VrDTfc8OFk4/hqdefault.jpg$$, null, $$PsychedelX 2025: Closing Ceremony and Talk Competition Awards IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, null, $$2025-07-20T19:40:29+00:00$$, $$VrDTfc8OFk4$$, $$YouTube$$, false, 110, $$published$$),
  ($$psychedelx-psychedelx-2025-psychology-public-health-and-policy-day-3-q-a$$, $$psychedelx_recording$$, $$PsychedelX 2025: Psychology, Public Health and Policy Day 3 Q&A$$, $$PsychedelX 2025: Psychology, Public Health and Policy Virtual Conference Day 3 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, $$https://www.youtube.com/watch?v=D-l3wuoC6r4$$, $$PsychedelX recordings$$, null, $$PsychedelX 2025: Psychology, Public Health and Policy Day 3 Q&A thumbnail$$, $$https://i.ytimg.com/vi/D-l3wuoC6r4/hqdefault.jpg$$, null, $$PsychedelX 2025: Psychology, Public Health and Policy Virtual Conference Day 3 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, null, $$2025-07-20T19:19:31+00:00$$, $$D-l3wuoC6r4$$, $$YouTube$$, false, 120, $$published$$),
  ($$psychedelx-psychedelx-2025-culture-anthropology-and-sociology-day-2-q-a$$, $$psychedelx_recording$$, $$PsychedelX 2025: Culture, Anthropology and Sociology Day 2 Q&A$$, $$PsychedelX 2025: Culture, Anthropology and Sociology Virtual Conference Day 2 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, $$https://www.youtube.com/watch?v=pKcShPqRDKw$$, $$PsychedelX recordings$$, null, $$PsychedelX 2025: Culture, Anthropology and Sociology Day 2 Q&A thumbnail$$, $$https://i.ytimg.com/vi/pKcShPqRDKw/hqdefault.jpg$$, null, $$PsychedelX 2025: Culture, Anthropology and Sociology Virtual Conference Day 2 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, null, $$2025-07-20T19:11:24+00:00$$, $$pKcShPqRDKw$$, $$YouTube$$, false, 130, $$published$$),
  ($$psychedelx-psychedelx-2025-clinical-applications-and-psychology-day-1-q-a$$, $$psychedelx_recording$$, $$PsychedelX 2025: Clinical Applications and Psychology Day 1 Q&A$$, $$PsychedelX 2025: Clinical Applications and Psychology Virtual Conference Day 1 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, $$https://www.youtube.com/watch?v=OubLd22QRZg$$, $$PsychedelX recordings$$, null, $$PsychedelX 2025: Clinical Applications and Psychology Day 1 Q&A thumbnail$$, $$https://i.ytimg.com/vi/OubLd22QRZg/hqdefault.jpg$$, null, $$PsychedelX 2025: Clinical Applications and Psychology Virtual Conference Day 1 Q&A Session IPN PsychedelX: https://www.intercollegiatepsychedelics.net/psychedelx$$, null, $$2025-07-20T19:00:05+00:00$$, $$OubLd22QRZg$$, $$YouTube$$, false, 140, $$published$$),
  ($$psychedelx-joelle-delprete-this-is-your-brain-on-headlines-the-framing-of-pat-in-th$$, $$psychedelx_recording$$, $$Joelle DelPrete - This Is Your Brain on Headlines: The Framing of PAT in the Media$$, $$Joelle DelPrete - This Is Your Brain on Headlines: The Framing of Psychedelic-Assisted-Therapy in the Media Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network. Full Documentary Link: https://www.youtube.com/playlist?list=PLrIWa0PqV4T17iokVbaaBAZYZOl-zFO1q$$, $$https://www.youtube.com/watch?v=QdSQaC0_xNQ$$, $$PsychedelX recordings$$, null, $$Joelle DelPrete - This Is Your Brain on Headlines: The Framing of PAT in the Media thumbnail$$, $$https://i.ytimg.com/vi/QdSQaC0_xNQ/hqdefault.jpg$$, null, $$Joelle DelPrete - This Is Your Brain on Headlines: The Framing of Psychedelic-Assisted-Therapy in the Media Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network. Full Documentary Link: https://www.youtube.com/playlist?list=PLrIWa0PqV4T17iokVbaaBAZYZOl-zFO1q$$, null, $$2025-07-17T06:13:36+00:00$$, $$QdSQaC0_xNQ$$, $$YouTube$$, false, 150, $$published$$),
  ($$psychedelx-aerik-kunju-reconnecting-the-self-convergently-healing-trauma-addiction$$, $$psychedelx_recording$$, $$Aerik Kunju - Reconnecting the Self: Convergently Healing Trauma, Addiction, Spiritual Disconnect...$$, $$Aerik Kunju - Reconnecting the Self: Convergently Healing Trauma, Addiction, and Spiritual Disconnection with Psychedelics Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=Upky4rErjcM$$, $$PsychedelX recordings$$, null, $$Aerik Kunju - Reconnecting the Self: Convergently Healing Trauma, Addiction, Spiritual Disconnect... thumbnail$$, $$https://i.ytimg.com/vi/Upky4rErjcM/hqdefault.jpg$$, null, $$Aerik Kunju - Reconnecting the Self: Convergently Healing Trauma, Addiction, and Spiritual Disconnection with Psychedelics Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T06:08:48+00:00$$, $$Upky4rErjcM$$, $$YouTube$$, false, 160, $$published$$),
  ($$psychedelx-eugenio-rossi-beyond-empty-bliss-exploring-pap-for-existential-distress$$, $$psychedelx_recording$$, $$Eugenio Rossi - Beyond Empty Bliss: Exploring PAP for Existential Distress in Atypical Parkinsonism$$, $$Eugenio Rossi - Beyond Empty Bliss: Exploring Psilocybin-Assisted Therapy for Existential Distress in Atypical Parkinsonism Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=ILX_3XN2c4g$$, $$PsychedelX recordings$$, null, $$Eugenio Rossi - Beyond Empty Bliss: Exploring PAP for Existential Distress in Atypical Parkinsonism thumbnail$$, $$https://i.ytimg.com/vi/ILX_3XN2c4g/hqdefault.jpg$$, null, $$Eugenio Rossi - Beyond Empty Bliss: Exploring Psilocybin-Assisted Therapy for Existential Distress in Atypical Parkinsonism Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T06:06:17+00:00$$, $$ILX_3XN2c4g$$, $$YouTube$$, false, 170, $$published$$),
  ($$psychedelx-liam-martin-bridging-the-gap-for-the-psychedelically-naive$$, $$psychedelx_recording$$, $$Liam Martin - Bridging the Gap for the Psychedelically-Naïve$$, $$Liam Martin - Bridging the Gap for the Psychedelically-Naïve Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=IpMitqC8o98$$, $$PsychedelX recordings$$, null, $$Liam Martin - Bridging the Gap for the Psychedelically-Naïve thumbnail$$, $$https://i.ytimg.com/vi/IpMitqC8o98/hqdefault.jpg$$, null, $$Liam Martin - Bridging the Gap for the Psychedelically-Naïve Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T06:01:51+00:00$$, $$IpMitqC8o98$$, $$YouTube$$, false, 180, $$published$$),
  ($$psychedelx-cameron-hornung-a-pragmatic-framework-for-integration$$, $$psychedelx_recording$$, $$Cameron Hornung - A Pragmatic Framework for Integration$$, $$Cameron Hornung - A Pragmatic Framework for Integration Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=9eFfYF0T2ck$$, $$PsychedelX recordings$$, null, $$Cameron Hornung - A Pragmatic Framework for Integration thumbnail$$, $$https://i.ytimg.com/vi/9eFfYF0T2ck/hqdefault.jpg$$, null, $$Cameron Hornung - A Pragmatic Framework for Integration Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:58:17+00:00$$, $$9eFfYF0T2ck$$, $$YouTube$$, false, 190, $$published$$),
  ($$psychedelx-naomi-shifman-the-field-of-psychedelics-gaps-and-directions-forward$$, $$psychedelx_recording$$, $$Naomi Shifman - The Field of Psychedelics: Gaps and Directions Forward$$, $$Naomi Shifman - The Field of Psychedelics: Gaps and Directions Forward Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=2oa3RgTXyFA$$, $$PsychedelX recordings$$, null, $$Naomi Shifman - The Field of Psychedelics: Gaps and Directions Forward thumbnail$$, $$https://i.ytimg.com/vi/2oa3RgTXyFA/hqdefault.jpg$$, null, $$Naomi Shifman - The Field of Psychedelics: Gaps and Directions Forward Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:53:49+00:00$$, $$2oa3RgTXyFA$$, $$YouTube$$, false, 200, $$published$$),
  ($$psychedelx-leandre-sabourin-subjective-experience-of-classic-psychedelic-use-impact$$, $$psychedelx_recording$$, $$Léandre Sabourin - Subjective Experience of Classic Psychedelic Use Impact on Alcohol Consumption...$$, $$Léandre Sabourin - The Subjective Experience of a Classic Psychedelic Use and its Impact on Alcohol Consumption: An Interpretative Phenomenological Analysis Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=66UD04rv5U8$$, $$PsychedelX recordings$$, null, $$Léandre Sabourin - Subjective Experience of Classic Psychedelic Use Impact on Alcohol Consumption... thumbnail$$, $$https://i.ytimg.com/vi/66UD04rv5U8/hqdefault.jpg$$, null, $$Léandre Sabourin - The Subjective Experience of a Classic Psychedelic Use and its Impact on Alcohol Consumption: An Interpretative Phenomenological Analysis Day 3 – Psychology, Public Health and Policy category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:50:49+00:00$$, $$66UD04rv5U8$$, $$YouTube$$, false, 210, $$published$$),
  ($$psychedelx-lynsey-gibson-biophilia-psychedelia-regenerative-psychedelic-settings$$, $$psychedelx_recording$$, $$Lynsey Gibson - Biophilia Psychedelia: Regenerative Psychedelic Settings$$, $$Lynsey Gibson - Biophilia Psychedelia: Regenerative Psychedelic Settings Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=TeSWHheefyg$$, $$PsychedelX recordings$$, null, $$Lynsey Gibson - Biophilia Psychedelia: Regenerative Psychedelic Settings thumbnail$$, $$https://i.ytimg.com/vi/TeSWHheefyg/hqdefault.jpg$$, null, $$Lynsey Gibson - Biophilia Psychedelia: Regenerative Psychedelic Settings Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:47:52+00:00$$, $$TeSWHheefyg$$, $$YouTube$$, false, 220, $$published$$),
  ($$psychedelx-cece-trezza-spiritual-awakening-the-musical-a-patient-s-lived-experience$$, $$psychedelx_recording$$, $$Cece Trezza - Spiritual Awakening the Musical: A Patient’s Lived Experience with KAP$$, $$Cece Trezza - Spiritual Awakening the Musical: A Patient’s Lived Experience with Ketamine-Assisted Psychotherapy Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=edSGdjGB_hg$$, $$PsychedelX recordings$$, null, $$Cece Trezza - Spiritual Awakening the Musical: A Patient’s Lived Experience with KAP thumbnail$$, $$https://i.ytimg.com/vi/edSGdjGB_hg/hqdefault.jpg$$, null, $$Cece Trezza - Spiritual Awakening the Musical: A Patient’s Lived Experience with Ketamine-Assisted Psychotherapy Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:40:37+00:00$$, $$edSGdjGB_hg$$, $$YouTube$$, false, 230, $$published$$),
  ($$psychedelx-angel-cox-reclaiming-softness-how-plant-medicine-can-illuminate-the-path$$, $$psychedelx_recording$$, $$Angel Cox - Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing...$$, $$Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing from the Strong Black Woman Schema Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$https://www.youtube.com/watch?v=trQZ_O2JmOE$$, $$PsychedelX recordings$$, null, $$Angel Cox - Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing... thumbnail$$, $$https://i.ytimg.com/vi/trQZ_O2JmOE/hqdefault.jpg$$, null, $$Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing from the Strong Black Woman Schema Day 2 – Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$2025-07-17T05:32:21+00:00$$, $$trQZ_O2JmOE$$, $$YouTube$$, false, 240, $$published$$),
  ($$blog-why-different-psychedelics-feel-different$$, $$blog_post$$, $$Why Different Psychedelics Feel Different$$, $$People often refer to psychedelics as if they are a unified category of drug that produces one type of experience. While molecules in this family may have more in common with each other than they do with drugs in other categories (such as opioids or benzodiazepines), anyone familiar with LSD, psilocybin, DMT or mescaline knows that the differences are striking. Seasoned users report consistent themes. LSD experiences tend to feel bright, crisp, hyper-detailed, and mentally energetic. Psilocybin (converted to active psilocin in the body) often feels softer, emotional, introspective, and bodily. DMT can feel instantaneous, immersive, and alien, while mescaline has its own distinctly warm, som…$$, $$https://www.intercollegiatepsychedelics.net/blog/why-different-psychedelics-feel-different$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/3e70ee4c-eaec-4f20-b267-f2b60658164f/94bb6f26-186e-483c-834a-df9d1400f13a.jfif?format=1000w$$, $$Why Different Psychedelics Feel Different article image$$, null, null, $$People often refer to psychedelics as if they are a unified category of drug that produces one type of experience. While molecules in this family may have more in common with each other than they do with drugs in other categories (such as opioids or benzodiazepines), anyone familiar with LSD, psilocybin, DMT or mescaline knows that the differences are striking. Seasoned users report consistent themes. LSD experiences tend to feel bright, crisp, hyper-detailed, and mentally energetic. Psilocybin (converted to active psilocin in the body) often feels softer, emotional, introspective, and bodily. DMT can feel instantaneous, immersive, and alien, while mescaline has its own distinctly warm, som…$$, $$Intercollegiate Psychedelics Network (IPN)$$, $$2026-03-31T18:58:37.000Z$$, null, $$IPN Blog$$, false, 300, $$published$$),
  ($$blog-ancient-medicine-in-modern-practice$$, $$blog_post$$, $$Ancient Medicine in Modern Practice$$, $$Rain gently patters the leaves outside of the forest hut deep within the forest of the ancient Amazon. A shaman humming an alien yet familiar tune hands you a wooden cup containing a deep maroon liquid, a light steam coming off its surface. The smell of wet earth fills your nostrils as the shaman gently places his hand underneath, urging you to drink until your cup is empty. This is your third helping, and you hand it back to him and he begins to fill it again. Your family shakes and rattles bundles of leaves called chakapas, which rhythmically accompany the shaman’s deep encaptivating melody. As you continue to drink, a euphoric sensation blossoms across your body, your abdomen filling wit…$$, $$https://www.intercollegiatepsychedelics.net/blog/2024/08/02/ancient-medicine-in-modern-practice$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567259199-UA9Y8ZI74RHK70QYR03U/Ancient-Medicine-in-Modern-Practice-Header-Image.png?format=1000w$$, $$Ancient Medicine in Modern Practice article image$$, null, null, $$Rain gently patters the leaves outside of the forest hut deep within the forest of the ancient Amazon. A shaman humming an alien yet familiar tune hands you a wooden cup containing a deep maroon liquid, a light steam coming off its surface. The smell of wet earth fills your nostrils as the shaman gently places his hand underneath, urging you to drink until your cup is empty. This is your third helping, and you hand it back to him and he begins to fill it again. Your family shakes and rattles bundles of leaves called chakapas, which rhythmically accompany the shaman’s deep encaptivating melody. As you continue to drink, a euphoric sensation blossoms across your body, your abdomen filling wit…$$, null, $$2024-08-02T05:01:57.000Z$$, null, $$IPN Blog$$, false, 310, $$published$$),
  ($$blog-interview-of-psychedelx-co-founder-haley-dourron$$, $$blog_post$$, $$Interview of PsychedelX Co-Founder, Haley Dourron$$, $$Haley Dourron is a Ph.D. candidate in the Drug Use and Behavior Lab at the University of Alabama at Birmingham. Her research focuses on the neurophenomenological effects of psychedelics and their potential for inducing lasting behavioral changes. Haley pioneered the creation of IPN’s PsychedelX program in 2020 and 2021 along with the rest of IPN’s Research and Professional Development team (now called IPN Labs). Currently, she is working on a pioneering psilocybin-assisted therapy trial for cocaine dependence. Haley's work also delves into the parallels between psychedelic-induced states and psychosis, contributing to innovative approaches in mental health treatment. Explore her research pu…$$, $$https://www.intercollegiatepsychedelics.net/blog/2024/05/31/interview-of-psychedelx-co-founder-haley-dourron$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567258984-PLXJ6K2IVD7FQ9SJ9C28/Interview-of-Haley-Dourron-Blog-Post-Cover-Image.png?format=1000w$$, $$Interview of PsychedelX Co-Founder, Haley Dourron article image$$, null, null, $$Haley Dourron is a Ph.D. candidate in the Drug Use and Behavior Lab at the University of Alabama at Birmingham. Her research focuses on the neurophenomenological effects of psychedelics and their potential for inducing lasting behavioral changes. Haley pioneered the creation of IPN’s PsychedelX program in 2020 and 2021 along with the rest of IPN’s Research and Professional Development team (now called IPN Labs). Currently, she is working on a pioneering psilocybin-assisted therapy trial for cocaine dependence. Haley's work also delves into the parallels between psychedelic-induced states and psychosis, contributing to innovative approaches in mental health treatment. Explore her research pu…$$, null, $$2024-05-31T17:22:59.000Z$$, null, $$IPN Blog$$, false, 320, $$published$$),
  ($$blog-bridging-the-gap-between-the-past-and-present-in-the-psychedelic-renaiss$$, $$blog_post$$, $$Bridging the Gap Between the Past and Present in the Psychedelic Renaissance$$, $$“It was my destiny to join a great experience”- This quote by Herman Hesse welcomed attendees to the 2023 biannual Psychedelic Science Conference hosted by MAPS in Denver, Colorado. Like hundreds of others in the crowd, I was filled with excitement and awe at being present for the world’s largest gathering of psychedelic enthusiasts.$$, $$https://www.intercollegiatepsychedelics.net/blog/2024/03/29/bridging-the-gap-between-the-past-and-present-in-the-psychedelic-renaissance$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746568446493-1I0YG777SM093WMB6BHL/Bridging-the-gap-DALL%C2%B7E-2024-03-19-14.26.43-.png?format=1000w$$, $$Bridging the Gap Between the Past and Present in the Psychedelic Renaissance article image$$, null, null, $$“It was my destiny to join a great experience”- This quote by Herman Hesse welcomed attendees to the 2023 biannual Psychedelic Science Conference hosted by MAPS in Denver, Colorado. Like hundreds of others in the crowd, I was filled with excitement and awe at being present for the world’s largest gathering of psychedelic enthusiasts.$$, null, $$2024-03-29T19:33:42.000Z$$, null, $$IPN Blog$$, false, 330, $$published$$),
  ($$blog-integrating-psychedelics-and-paralysis-understanding-non-obvious-risks-b$$, $$blog_post$$, $$Integrating Psychedelics and Paralysis: Understanding Non-Obvious Risks Before Pursuing Likely Rewards$$, $$A setting sun paints the San Diegan marine clouds a pastel palette as onlookers atop a coastal bluff wait for the famous green flash. Down below on the beach two gentlemen anticipate a different flash. Both have exited their wheelchairs for seats on the sand, the beach a purposeful setting for a ritual they’ve practiced before. They’ve ingested psilocybin-containing mushrooms and, while the Pacific Southwest is surely a beautiful natural setting they might aim to reflect into the mindset they’re about to occupy, there is a more profane reason they’ve come to the beach.$$, $$https://www.intercollegiatepsychedelics.net/blog/2024/01/05/integrating-psychedelics-and-paralysis$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567258774-HVT3XA2BZJLVZ9L3FUJ2/SCI-IPN-Blog-post-Cover-image.png?format=1000w$$, $$Integrating Psychedelics and Paralysis: Understanding Non-Obvious Risks Before Pursuing Likely Rewards article image$$, null, null, $$A setting sun paints the San Diegan marine clouds a pastel palette as onlookers atop a coastal bluff wait for the famous green flash. Down below on the beach two gentlemen anticipate a different flash. Both have exited their wheelchairs for seats on the sand, the beach a purposeful setting for a ritual they’ve practiced before. They’ve ingested psilocybin-containing mushrooms and, while the Pacific Southwest is surely a beautiful natural setting they might aim to reflect into the mindset they’re about to occupy, there is a more profane reason they’ve come to the beach.$$, null, $$2024-01-05T08:41:47.000Z$$, null, $$IPN Blog$$, false, 340, $$published$$),
  ($$blog-honoring-the-legacy-of-dr-roland-griffiths-exploring-the-mystical-world$$, $$blog_post$$, $$Honoring the Legacy of Dr. Roland Griffiths: Exploring the Mystical World of Psilocybin$$, $$Image Source: The Chronicle of Higher Education The world lost a true pioneer and visionary when Dr. Roland Griffiths, a renowned figure in the field of psychopharmacology, passed away from cancer. Dr. Griffiths dedicated his life to studying the profound effects of psychoactive substances, especially psychedelics—with a special focus on psilocybin— a naturally occurring psychedelic compound found in certain species of mushrooms. Dr. Griffith’s research has left an indelible mark on the scientific community, offering invaluable insights into the human mind and the potential for psychedelics to foster mental well-being, personal growth, spiritual significance, and therapeutic benefits. In ho…$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/11/08/honoring-the-legacy-of-dr-roland-griffiths-exploring-the-mystical-world-of-psilocybin$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746568494202-83GJSEKJNM8YKQYRVNWR/download+%282%29.jpeg?format=1000w$$, $$Honoring the Legacy of Dr. Roland Griffiths: Exploring the Mystical World of Psilocybin article image$$, null, null, $$Image Source: The Chronicle of Higher Education The world lost a true pioneer and visionary when Dr. Roland Griffiths, a renowned figure in the field of psychopharmacology, passed away from cancer. Dr. Griffiths dedicated his life to studying the profound effects of psychoactive substances, especially psychedelics—with a special focus on psilocybin— a naturally occurring psychedelic compound found in certain species of mushrooms. Dr. Griffith’s research has left an indelible mark on the scientific community, offering invaluable insights into the human mind and the potential for psychedelics to foster mental well-being, personal growth, spiritual significance, and therapeutic benefits. In ho…$$, null, $$2023-11-08T17:10:18.000Z$$, null, $$IPN Blog$$, false, 350, $$published$$),
  ($$blog-ipn-blog-halloween-special-the-dark-side-of-psychedelic-use$$, $$blog_post$$, $$IPN Blog Halloween Special: The Dark Side of Psychedelic Use$$, $$In this spooky Halloween-themed blog post, we explore some of the most disturbing and shocking cases of psychedelic use gone wrong. From cults to MKUltra, these stories will make you think twice about psychedelic stereotypes!$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/10/31/ipn-blog-halloween-special$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255475-T8GKYSWGH42BUDVX9B2A/Temporary-Cover-Image-For-Halloween-Blog-Post.png?format=1000w$$, $$IPN Blog Halloween Special: The Dark Side of Psychedelic Use article image$$, null, null, $$In this spooky Halloween-themed blog post, we explore some of the most disturbing and shocking cases of psychedelic use gone wrong. From cults to MKUltra, these stories will make you think twice about psychedelic stereotypes!$$, null, $$2023-10-31T12:49:58.000Z$$, null, $$IPN Blog$$, false, 360, $$published$$),
  ($$blog-the-story-of-my-psychedelic-book-collection$$, $$blog_post$$, $$The Story of My Psychedelic Book Collection$$, $$In the corner of the dark, cold storage room of my family’s basement, a collection of fascinating books awaits. Broadly about altered states of consciousness, but mostly about psychedelics, this collection covers the history, science, and cultural impact of psychedelics and altered states. Almost entirely non-fiction – with the exception of the semi-fictional narrative portions of PIHKAL and TIHKAL – the collection contains diverse formats, including hardcopies, paperbacks, digital copies, a signed copy, and limited-edition publications. Stacked precariously on top of a dresser, they await their next psychedelic-curious reader. This is their story.$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/08/04/the-story-of-my-psychedelic-book-collection$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567256201-VY2K3CYCAVKTJY3E2DOY/Cover-Image-For-Lukes-Blog-Post.png?format=1000w$$, $$The Story of My Psychedelic Book Collection article image$$, null, null, $$In the corner of the dark, cold storage room of my family’s basement, a collection of fascinating books awaits. Broadly about altered states of consciousness, but mostly about psychedelics, this collection covers the history, science, and cultural impact of psychedelics and altered states. Almost entirely non-fiction – with the exception of the semi-fictional narrative portions of PIHKAL and TIHKAL – the collection contains diverse formats, including hardcopies, paperbacks, digital copies, a signed copy, and limited-edition publications. Stacked precariously on top of a dresser, they await their next psychedelic-curious reader. This is their story.$$, null, $$2023-08-04T09:10:00.000Z$$, null, $$IPN Blog$$, false, 370, $$published$$),
  ($$blog-what-is-it$$, $$blog_post$$, $$What is IT?$$, $$Psychedelics allow us to move away from this three-dimensional world – a place where we usually only believe what our five senses can perceive, where time plays out in chronological order, where our logical minds usually lead us to answers, and where we usually rely on proof and data over intuition – to a place of logical fallacy, mystery, wonder, magic, dreams, oneness, fullness, and more fantastical ideas.$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/07/12/what-is-it$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255611-ANN93TJB98OQMSDNEECJ/Cover-Photo-for-Leslie-Avila-Blog-Post.jpeg?format=1000w$$, $$What is IT? article image$$, null, null, $$Psychedelics allow us to move away from this three-dimensional world – a place where we usually only believe what our five senses can perceive, where time plays out in chronological order, where our logical minds usually lead us to answers, and where we usually rely on proof and data over intuition – to a place of logical fallacy, mystery, wonder, magic, dreams, oneness, fullness, and more fantastical ideas.$$, null, $$2023-07-12T18:44:00.000Z$$, null, $$IPN Blog$$, false, 380, $$published$$),
  ($$blog-more-thyme-part-ii$$, $$blog_post$$, $$More Thyme part II$$, $$As I continued deeper into NIO-5, my direct experience became akin to watching the falling of leaves. Just as my gaze cannot dictate the spin of falling leaves, I could not dictate movements of my body – yet, I moved forward.$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/05/26/more-thyme-part-ii$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567256102-3AAG9AMPCYNFLK7XNHM8/edited-trippy-mushroom-village.png?format=1000w$$, $$More Thyme part II article image$$, null, null, $$As I continued deeper into NIO-5, my direct experience became akin to watching the falling of leaves. Just as my gaze cannot dictate the spin of falling leaves, I could not dictate movements of my body – yet, I moved forward.$$, null, $$2023-05-26T19:37:32.000Z$$, null, $$IPN Blog$$, false, 390, $$published$$),
  ($$blog-more-thyme-part-i$$, $$blog_post$$, $$More Thyme part I$$, $$As the ship approached NIO-5, the engine was turned off, allowing the ship’s inertia to carry it to the destination on the surface. Despite my best efforts to cultivate psychological poise in the face of this journey, I was occupied with a nervous habit of clicking my teeth together in a repeating pattern: twice on the left, once on the right, and three times altogether.$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/05/17/more-thyme-part-i$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567068016-2DI4TNCP3287JPBW34HI/edited-trippy-mushroom-village.png?format=1000w$$, $$More Thyme part I article image$$, null, null, $$As the ship approached NIO-5, the engine was turned off, allowing the ship’s inertia to carry it to the destination on the surface. Despite my best efforts to cultivate psychological poise in the face of this journey, I was occupied with a nervous habit of clicking my teeth together in a repeating pattern: twice on the left, once on the right, and three times altogether.$$, null, $$2023-05-17T23:28:17.000Z$$, null, $$IPN Blog$$, false, 400, $$published$$),
  ($$blog-can-we-heal-without-tripping$$, $$blog_post$$, $$Can We Heal Without Tripping?$$, $$By Evan LaughlinWe know psychedelics can be helpful, but do we need to trip to get the benefits?$$, $$https://www.intercollegiatepsychedelics.net/blog/2023/04/01/can-we-heal-without-tripping$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255384-DNZNS2OHXH10W0S838DW/MidjourneyGenerated-human_brain._with_flowers._black_background_-1.png?format=1000w$$, $$Can We Heal Without Tripping? article image$$, null, null, $$By Evan LaughlinWe know psychedelics can be helpful, but do we need to trip to get the benefits?$$, null, $$2023-04-01T08:30:23.000Z$$, null, $$IPN Blog$$, false, 410, $$published$$),
  ($$blog-how-do-you-measure-a-wall-that-breathes-and-placebo-research$$, $$blog_post$$, $$How Do You Measure A Wall That Breathes And Placebo Research$$, $$Psychedelic consciousness: that strange, artistic state of affairs in which it seems the structure of reality around us can melt and recrystallize into different universes. This state of consciousness has been the bedrock of many epistemologies and societies throughout history (Carod-Artal, 2015), but it is now becoming the novel focus of psychiatry and western science, a tradition I find myself - sometimes begrudgingly - couched in. Some elements of our western scientific tradition could not synergize more perfectly with psychedelia. Chemistry, for example, allows us to change, mass produce, and distribute psychedelic experiences. You would not be reading this article today if Albert Hoffm…$$, $$https://www.intercollegiatepsychedelics.net/blog/2022/12/04/how-do-you-measure-a-wall-that-breathes-and-placebo-research$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255801-705Z9Z1PG51H7VV0SGXJ/unsplash-image-azwRXQgJvUI.jpg?format=1000w$$, $$How Do You Measure A Wall That Breathes And Placebo Research article image$$, null, null, $$Psychedelic consciousness: that strange, artistic state of affairs in which it seems the structure of reality around us can melt and recrystallize into different universes. This state of consciousness has been the bedrock of many epistemologies and societies throughout history (Carod-Artal, 2015), but it is now becoming the novel focus of psychiatry and western science, a tradition I find myself - sometimes begrudgingly - couched in. Some elements of our western scientific tradition could not synergize more perfectly with psychedelia. Chemistry, for example, allows us to change, mass produce, and distribute psychedelic experiences. You would not be reading this article today if Albert Hoffm…$$, null, $$2022-12-04T14:51:00.000Z$$, null, $$IPN Blog$$, false, 420, $$published$$),
  ($$blog-psychedelic-substances-are-forcing-scientists-to-go-beyond-science$$, $$blog_post$$, $$Psychedelic Substances Are Forcing Scientists To Go Beyond Science$$, $$The West is currently in the middle of a “psychedelic renaissance,” a movement characterized by a reemerging academic, medical, and cultural interest in psychedelic substances, accompanied by efforts to decriminalize and legalize these substances. As a philosophy student, the element that fascinates me most about these developments is that they seem to be forcing scientists outside of their territory. Study subjects inside fMRIs report becoming one with the Universe. Psychedelic therapy patients attribute their miraculous recovery to an encounter with an ultimate reality, perhaps with God (however one might define “God”). In surveys, people report their psychedelic experience was more real…$$, $$https://www.intercollegiatepsychedelics.net/blog/2022/05/27/psychedelic-substances-are-forcing-scientists-to-go-beyond-science$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255693-RIU6YHIYZNDFJLKW144L/unsplash-image-cr6u8XFA0-k.jpg?format=1000w$$, $$Psychedelic Substances Are Forcing Scientists To Go Beyond Science article image$$, null, null, $$The West is currently in the middle of a “psychedelic renaissance,” a movement characterized by a reemerging academic, medical, and cultural interest in psychedelic substances, accompanied by efforts to decriminalize and legalize these substances. As a philosophy student, the element that fascinates me most about these developments is that they seem to be forcing scientists outside of their territory. Study subjects inside fMRIs report becoming one with the Universe. Psychedelic therapy patients attribute their miraculous recovery to an encounter with an ultimate reality, perhaps with God (however one might define “God”). In surveys, people report their psychedelic experience was more real…$$, null, $$2022-05-27T15:28:00.000Z$$, null, $$IPN Blog$$, false, 430, $$published$$),
  ($$blog-explosion$$, $$blog_post$$, $$Explosion$$, $$by Adam Amrani , PALA Switzerland Noetic explosion, implosion, explosion, implosion, pulsing wildly in an arrhythmic dance. As it beats, the aware heart rejoices of its ever growing movement, guiding the dance or giving the world the lead. In the eternal choreography, each limb has to love its chaotic gestures, for they all fall in the beauty of Dance itself. It can never stop. Rest is in acceptance, not in stillness. Insight is the most precise, most self-recognizable feeling. It is at the crossroad of the many paths. Be it from in or out, it can decay or lead the next charge. For the metalhead, each particle making the world holds the potential to travel the alloy, effortlessly. In the fe…$$, $$https://www.intercollegiatepsychedelics.net/blog/2020/11/23/explosion$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567255282-GCS1RF9MGJU2XH2OKUDZ/explosion.jpg?format=1000w$$, $$Explosion article image$$, null, null, $$by Adam Amrani , PALA Switzerland Noetic explosion, implosion, explosion, implosion, pulsing wildly in an arrhythmic dance. As it beats, the aware heart rejoices of its ever growing movement, guiding the dance or giving the world the lead. In the eternal choreography, each limb has to love its chaotic gestures, for they all fall in the beauty of Dance itself. It can never stop. Rest is in acceptance, not in stillness. Insight is the most precise, most self-recognizable feeling. It is at the crossroad of the many paths. Be it from in or out, it can decay or lead the next charge. For the metalhead, each particle making the world holds the potential to travel the alloy, effortlessly. In the fe…$$, null, $$2020-11-23T15:38:00.000Z$$, null, $$IPN Blog$$, false, 440, $$published$$),
  ($$blog-challenges-and-preparation-towards-creating-a-new-paradigm$$, $$blog_post$$, $$Challenges And Preparation Towards Creating A New Paradigm$$, $$Amidst times of war, the ancient Chinese masters retreated to philosophy to develop a science of action. The way of effortless action. Wu Wei. Action rarefied like the air, unfettered by the resistance of thought and selfhood. How do we act responsibly as leaders in this Psychedelic Renaissance? How do we rebirth psychedelic medicine accounting past karma while inculcating future hope? How do we balance action with thought, old with new, ordered change with dismantling chaos? The chasm of opportunity is deep. On one side unfurls a psychedelic utopia. Perhaps a society transformed will emerge. Joe the Plumber living an examined life alongside Bob the Wallstreet Banker. A society in which a j…$$, $$https://www.intercollegiatepsychedelics.net/blog/2020/08/30/challenges-and-preparation-towards-creating-a-new-paradigm$$, $$IPN Blog$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/1746567254884-GTPQSQFA7VF99LZDOHI5/wuwei.jpg?format=1000w$$, $$Challenges And Preparation Towards Creating A New Paradigm article image$$, null, null, $$Amidst times of war, the ancient Chinese masters retreated to philosophy to develop a science of action. The way of effortless action. Wu Wei. Action rarefied like the air, unfettered by the resistance of thought and selfhood. How do we act responsibly as leaders in this Psychedelic Renaissance? How do we rebirth psychedelic medicine accounting past karma while inculcating future hope? How do we balance action with thought, old with new, ordered change with dismantling chaos? The chasm of opportunity is deep. On one side unfurls a psychedelic utopia. Perhaps a society transformed will emerge. Joe the Plumber living an examined life alongside Bob the Wallstreet Banker. A society in which a j…$$, null, $$2020-08-30T15:45:00.000Z$$, null, $$IPN Blog$$, false, 450, $$published$$),
  ($$maps$$, $$partner$$, $$Multidisciplinary Association for Psychedelic Studies (MAPS)$$, $$A nonprofit research and educational organization advancing psychedelic and marijuana research, policy, education, and culture.$$, $$https://maps.org/$$, $$Partner organizations$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/b8d83611-cfe4-4930-9429-7b9b242d961e/download-e1718575604706.jpeg$$, $$Logo of the Multidisciplinary Association for Psychedelic Studies with hands and spiral design.$$, null, null, $$A nonprofit research and educational organization advancing psychedelic and marijuana research, policy, education, and culture.$$, null, null, null, $$MAPS$$, false, 500, $$published$$),
  ($$reconsider$$, $$partner$$, $$Reconsider$$, $$A nonprofit creating media, experiences, and community spaces that invite reflection, connection, and more compassionate ways of living.$$, $$https://www.reconsider.org/$$, $$Partner organizations$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/b89a661f-5eaf-4cf6-bb59-34c16680fd09/images+%281%29.png$$, $$Black circle with white text RE upside down and CONSIDER below it.$$, null, null, $$A nonprofit creating media, experiences, and community spaces that invite reflection, connection, and more compassionate ways of living.$$, null, null, null, $$Reconsider$$, false, 510, $$published$$),
  ($$uw-madison-ppi$$, $$partner$$, $$University of Wisconsin-Madison PPI$$, $$An online graduate program in psychoactive pharmaceutical investigation for students and professionals studying psychoactive drugs, drug development, and therapeutic applications.$$, $$https://pdc.wisc.edu/degrees/ms-psychoactive-pharmaceutical-investigation/$$, $$Partner organizations$$, $$https://images.squarespace-cdn.com/content/v1/6818fd40c887dc63e296d115/585c14e0-f75d-4aeb-b40b-6817c20d6524/PSYCPHARIN_color-flush-1-1-1.jpg$$, $$Logo of Psychoactive Pharmaceutical Investigation program at University of Wisconsin-Madison School of Pharmacy.$$, null, null, $$An online graduate program in psychoactive pharmaceutical investigation for students and professionals studying psychoactive drugs, drug development, and therapeutic applications.$$, null, null, null, $$UW-Madison PPI$$, false, 520, $$published$$)
on conflict (slug) do update
set resource_type = excluded.resource_type,
    title = excluded.title,
    description = excluded.description,
    url = excluded.url,
    category = excluded.category,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    thumbnail_url = excluded.thumbnail_url,
    benefit_note = excluded.benefit_note,
    detail_body = excluded.detail_body,
    author = excluded.author,
    published_at = excluded.published_at,
    source_id = excluded.source_id,
    source_name = excluded.source_name,
    featured = excluded.featured,
    sort_order = excluded.sort_order,
    status = excluded.status,
    updated_at = now();

insert into public.events (
  slug,
  title,
  event_type,
  starts_at,
  ends_at,
  timezone,
  summary,
  description,
  speakers,
  location_label,
  location_details,
  join_url,
  thumbnail_url,
  is_recording,
  recording_url,
  recording_provider,
  recording_category,
  recording_source_id,
  recording_published_at,
  status,
  registration_count
)
select
  resources.slug,
  resources.title,
  case
    when resources.resource_type = 'ipn_lab_recording' then 'IPN Lab'
    else 'PsychedelX'
  end,
  coalesce(resources.published_at, now()),
  null,
  'America/New_York',
  resources.description,
  coalesce(resources.detail_body, resources.description),
  resources.author,
  resources.source_name,
  null,
  null,
  coalesce(resources.thumbnail_url, resources.image_url),
  true,
  resources.url,
  resources.source_name,
  case
    when resources.resource_type = 'ipn_lab_recording' then null
    when resources.title ilike '%Q&A%' then 'Q&A'
    when resources.title ilike '%Closing Ceremony%' then 'Closing Ceremony'
    when resources.title ilike '%Keynote%' then 'Keynote Speech'
    when resources.title ilike '%Panel%' then 'Panel'
    else 'Participant Talk'
  end,
  resources.source_id,
  resources.published_at,
  resources.status,
  0
from public.resources
where resources.resource_type in ('ipn_lab_recording', 'psychedelx_recording')
on conflict (slug) do update
set title = excluded.title,
    event_type = excluded.event_type,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    timezone = excluded.timezone,
    summary = excluded.summary,
    description = excluded.description,
    speakers = excluded.speakers,
    location_label = excluded.location_label,
    location_details = excluded.location_details,
    join_url = excluded.join_url,
    thumbnail_url = excluded.thumbnail_url,
    is_recording = excluded.is_recording,
    recording_url = excluded.recording_url,
    recording_provider = excluded.recording_provider,
    recording_category = excluded.recording_category,
    recording_source_id = excluded.recording_source_id,
    recording_published_at = excluded.recording_published_at,
    status = excluded.status,
    updated_at = now();

insert into public.events (
  slug,
  title,
  event_type,
  starts_at,
  timezone,
  summary,
  description,
  speakers,
  location_label,
  thumbnail_url,
  is_recording,
  recording_url,
  recording_provider,
  recording_category,
  recording_source_id,
  recording_published_at,
  status,
  registration_count
) values
  ($$psychedelx-robert-earth-a-story-about-the-third-magical-fungi$$, $$Robert Earth - A Story About The Third Magical Fungi$$, $$PsychedelX$$, $$2025-08-01T17:07:01+00:00$$, $$America/New_York$$, $$Robert Earth presents A Story About The Third Magical Fungi in the Culture, Anthropology and Sociology category of PsychedelX 2025.$$, $$Robert Earth presents A Story About The Third Magical Fungi in the Culture, Anthropology and Sociology category of PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, $$Robert Earth$$, $$YouTube$$, $$https://i.ytimg.com/vi/ztzr90dp6nc/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=ztzr90dp6nc$$, $$YouTube$$, $$Participant Talk$$, $$ztzr90dp6nc$$, $$2025-08-01T17:07:01+00:00$$, $$published$$, 0),
  ($$psychedelx-psychedelx-2025-closing-ceremony-and-talk-competition-awards$$, $$PsychedelX 2025: Closing Ceremony and Talk Competition Awards$$, $$PsychedelX$$, $$2025-07-20T19:40:29+00:00$$, $$America/New_York$$, $$Closing ceremony and talk competition awards from PsychedelX 2025.$$, $$Closing ceremony and talk competition awards from PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$YouTube$$, $$https://i.ytimg.com/vi/VrDTfc8OFk4/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=VrDTfc8OFk4$$, $$YouTube$$, $$Closing Ceremony$$, $$VrDTfc8OFk4$$, $$2025-07-20T19:40:29+00:00$$, $$published$$, 0),
  ($$psychedelx-psychedelx-2025-psychology-public-health-and-policy-day-3-q-a$$, $$PsychedelX 2025: Psychology, Public Health and Policy Day 3 Q&A$$, $$PsychedelX$$, $$2025-07-20T19:19:31+00:00$$, $$America/New_York$$, $$Day 3 Q&A session for PsychedelX 2025 Psychology, Public Health and Policy programming.$$, $$PsychedelX 2025 Psychology, Public Health and Policy Day 3 Q&A session, hosted by the Intercollegiate Psychedelics Network.$$, null, $$YouTube$$, $$https://i.ytimg.com/vi/D-l3wuoC6r4/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=D-l3wuoC6r4$$, $$YouTube$$, $$Q&A$$, $$D-l3wuoC6r4$$, $$2025-07-20T19:19:31+00:00$$, $$published$$, 0),
  ($$psychedelx-psychedelx-2025-culture-anthropology-and-sociology-day-2-q-a$$, $$PsychedelX 2025: Culture, Anthropology and Sociology Day 2 Q&A$$, $$PsychedelX$$, $$2025-07-20T19:11:24+00:00$$, $$America/New_York$$, $$Day 2 Q&A session for PsychedelX 2025 Culture, Anthropology and Sociology programming.$$, $$PsychedelX 2025 Culture, Anthropology and Sociology Day 2 Q&A session, hosted by the Intercollegiate Psychedelics Network.$$, null, $$YouTube$$, $$https://i.ytimg.com/vi/pKcShPqRDKw/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=pKcShPqRDKw$$, $$YouTube$$, $$Q&A$$, $$pKcShPqRDKw$$, $$2025-07-20T19:11:24+00:00$$, $$published$$, 0),
  ($$psychedelx-psychedelx-2025-clinical-applications-and-psychology-day-1-q-a$$, $$PsychedelX 2025: Clinical Applications and Psychology Day 1 Q&A$$, $$PsychedelX$$, $$2025-07-20T19:00:05+00:00$$, $$America/New_York$$, $$Day 1 Q&A session for PsychedelX 2025 Clinical Applications and Psychology programming.$$, $$PsychedelX 2025 Clinical Applications and Psychology Day 1 Q&A session, hosted by the Intercollegiate Psychedelics Network.$$, null, $$YouTube$$, $$https://i.ytimg.com/vi/OubLd22QRZg/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=OubLd22QRZg$$, $$YouTube$$, $$Q&A$$, $$OubLd22QRZg$$, $$2025-07-20T19:00:05+00:00$$, $$published$$, 0),
  ($$psychedelx-joelle-delprete-this-is-your-brain-on-headlines-the-framing-of-pat-in-th$$, $$Joelle DelPrete - This Is Your Brain on Headlines: The Framing of PAT in the Media$$, $$PsychedelX$$, $$2025-07-17T06:13:36+00:00$$, $$America/New_York$$, $$Joelle DelPrete presents on media framing of psychedelic-assisted therapy in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Joelle DelPrete presents This Is Your Brain on Headlines: The Framing of Psychedelic-Assisted-Therapy in the Media in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Joelle DelPrete$$, $$YouTube$$, $$https://i.ytimg.com/vi/QdSQaC0_xNQ/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=QdSQaC0_xNQ$$, $$YouTube$$, $$Participant Talk$$, $$QdSQaC0_xNQ$$, $$2025-07-17T06:13:36+00:00$$, $$published$$, 0),
  ($$psychedelx-aerik-kunju-reconnecting-the-self-convergently-healing-trauma-addiction$$, $$Aerik Kunju - Reconnecting the Self: Convergently Healing Trauma, Addiction, Spiritual Disconnect...$$, $$PsychedelX$$, $$2025-07-17T06:08:48+00:00$$, $$America/New_York$$, $$Aerik Kunju presents on convergently healing trauma, addiction, and spiritual disconnection with psychedelics.$$, $$Aerik Kunju presents Reconnecting the Self: Convergently Healing Trauma, Addiction, and Spiritual Disconnection with Psychedelics in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Aerik Kunju$$, $$YouTube$$, $$https://i.ytimg.com/vi/Upky4rErjcM/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=Upky4rErjcM$$, $$YouTube$$, $$Participant Talk$$, $$Upky4rErjcM$$, $$2025-07-17T06:08:48+00:00$$, $$published$$, 0),
  ($$psychedelx-eugenio-rossi-beyond-empty-bliss-exploring-pap-for-existential-distress$$, $$Eugenio Rossi - Beyond Empty Bliss: Exploring PAP for Existential Distress in Atypical Parkinsonism$$, $$PsychedelX$$, $$2025-07-17T06:06:17+00:00$$, $$America/New_York$$, $$Eugenio Rossi presents on psilocybin-assisted therapy for existential distress in atypical Parkinsonism.$$, $$Eugenio Rossi presents Beyond Empty Bliss: Exploring Psilocybin-Assisted Therapy for Existential Distress in Atypical Parkinsonism in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Eugenio Rossi$$, $$YouTube$$, $$https://i.ytimg.com/vi/ILX_3XN2c4g/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=ILX_3XN2c4g$$, $$YouTube$$, $$Participant Talk$$, $$ILX_3XN2c4g$$, $$2025-07-17T06:06:17+00:00$$, $$published$$, 0),
  ($$psychedelx-liam-martin-bridging-the-gap-for-the-psychedelically-naive$$, $$Liam Martin - Bridging the Gap for the Psychedelically-Naïve$$, $$PsychedelX$$, $$2025-07-17T06:01:51+00:00$$, $$America/New_York$$, $$Liam Martin presents on bridging the gap for psychedelic-naïve audiences.$$, $$Liam Martin presents Bridging the Gap for the Psychedelically-Naïve in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Liam Martin$$, $$YouTube$$, $$https://i.ytimg.com/vi/IpMitqC8o98/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=IpMitqC8o98$$, $$YouTube$$, $$Participant Talk$$, $$IpMitqC8o98$$, $$2025-07-17T06:01:51+00:00$$, $$published$$, 0),
  ($$psychedelx-cameron-hornung-a-pragmatic-framework-for-integration$$, $$Cameron Hornung - A Pragmatic Framework for Integration$$, $$PsychedelX$$, $$2025-07-17T05:58:17+00:00$$, $$America/New_York$$, $$Cameron Hornung presents a pragmatic framework for integration.$$, $$Cameron Hornung presents A Pragmatic Framework for Integration in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Cameron Hornung$$, $$YouTube$$, $$https://i.ytimg.com/vi/9eFfYF0T2ck/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=9eFfYF0T2ck$$, $$YouTube$$, $$Participant Talk$$, $$9eFfYF0T2ck$$, $$2025-07-17T05:58:17+00:00$$, $$published$$, 0),
  ($$psychedelx-naomi-shifman-the-field-of-psychedelics-gaps-and-directions-forward$$, $$Naomi Shifman - The Field of Psychedelics: Gaps and Directions Forward$$, $$PsychedelX$$, $$2025-07-17T05:53:49+00:00$$, $$America/New_York$$, $$Naomi Shifman presents on gaps and directions forward in the field of psychedelics.$$, $$Naomi Shifman presents The Field of Psychedelics: Gaps and Directions Forward in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Naomi Shifman$$, $$YouTube$$, $$https://i.ytimg.com/vi/2oa3RgTXyFA/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=2oa3RgTXyFA$$, $$YouTube$$, $$Participant Talk$$, $$2oa3RgTXyFA$$, $$2025-07-17T05:53:49+00:00$$, $$published$$, 0),
  ($$psychedelx-leandre-sabourin-subjective-experience-of-classic-psychedelic-use-impact$$, $$Léandre Sabourin - Subjective Experience of Classic Psychedelic Use Impact on Alcohol Consumption...$$, $$PsychedelX$$, $$2025-07-17T05:50:49+00:00$$, $$America/New_York$$, $$Léandre Sabourin presents on classic psychedelic use and its impact on alcohol consumption.$$, $$Léandre Sabourin presents The Subjective Experience of a Classic Psychedelic Use and its Impact on Alcohol Consumption in the Psychology, Public Health and Policy category of PsychedelX 2025.$$, $$Léandre Sabourin$$, $$YouTube$$, $$https://i.ytimg.com/vi/66UD04rv5U8/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=66UD04rv5U8$$, $$YouTube$$, $$Participant Talk$$, $$66UD04rv5U8$$, $$2025-07-17T05:50:49+00:00$$, $$published$$, 0),
  ($$psychedelx-lynsey-gibson-biophilia-psychedelia-regenerative-psychedelic-settings$$, $$Lynsey Gibson - Biophilia Psychedelia: Regenerative Psychedelic Settings$$, $$PsychedelX$$, $$2025-07-17T05:47:52+00:00$$, $$America/New_York$$, $$Lynsey Gibson presents on regenerative psychedelic settings.$$, $$Lynsey Gibson presents Biophilia Psychedelia: Regenerative Psychedelic Settings in the Culture, Anthropology and Sociology category of PsychedelX 2025.$$, $$Lynsey Gibson$$, $$YouTube$$, $$https://i.ytimg.com/vi/TeSWHheefyg/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=TeSWHheefyg$$, $$YouTube$$, $$Participant Talk$$, $$TeSWHheefyg$$, $$2025-07-17T05:47:52+00:00$$, $$published$$, 0),
  ($$psychedelx-cece-trezza-spiritual-awakening-the-musical-a-patient-s-lived-experience$$, $$Cece Trezza - Spiritual Awakening the Musical: A Patient's Lived Experience with KAP$$, $$PsychedelX$$, $$2025-07-17T05:40:37+00:00$$, $$America/New_York$$, $$Cece Trezza presents on a patient's lived experience with ketamine-assisted psychotherapy.$$, $$Cece Trezza presents Spiritual Awakening the Musical: A Patient's Lived Experience with Ketamine-Assisted Psychotherapy in the Culture, Anthropology and Sociology category of PsychedelX 2025.$$, $$Cece Trezza$$, $$YouTube$$, $$https://i.ytimg.com/vi/edSGdjGB_hg/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=edSGdjGB_hg$$, $$YouTube$$, $$Participant Talk$$, $$edSGdjGB_hg$$, $$2025-07-17T05:40:37+00:00$$, $$published$$, 0),
  ($$psychedelx-angel-cox-reclaiming-softness-how-plant-medicine-can-illuminate-the-path$$, $$Angel Cox - Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing...$$, $$PsychedelX$$, $$2025-07-17T05:32:21+00:00$$, $$America/New_York$$, $$Angel Cox presents on plant medicine and healing from the Strong Black Woman schema.$$, $$Angel Cox presents Reclaiming Softness: How Plant Medicine Can Illuminate the Path to Healing from the Strong Black Woman Schema in the Culture, Anthropology and Sociology category of PsychedelX 2025.$$, $$Angel Cox$$, $$YouTube$$, $$https://i.ytimg.com/vi/trQZ_O2JmOE/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=trQZ_O2JmOE$$, $$YouTube$$, $$Participant Talk$$, $$trQZ_O2JmOE$$, $$2025-07-17T05:32:21+00:00$$, $$published$$, 0),
  ($$psychedelx-megan-mclaughlin-no-self-new-self-psychedelics-birth-and-the-practice-of-presence$$, $$Megan McLaughlin - No-Self, New Self: Psychedelics, Birth, and the Practice of Presence$$, $$PsychedelX$$, $$2025-07-17T05:28:00+00:00$$, $$America/New_York$$, $$Megan McLaughlin presents on psychedelics, birth, and the practice of presence.$$, $$Megan McLaughlin presents No-Self, New Self: Psychedelics, Birth, and the Practice of Presence as part of PsychedelX 2025.$$, $$Megan McLaughlin$$, $$YouTube$$, $$https://i.ytimg.com/vi/aZuw3I61mXo/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=aZuw3I61mXo$$, $$YouTube$$, $$Participant Talk$$, $$aZuw3I61mXo$$, $$2025-07-17T05:28:00+00:00$$, $$published$$, 0),
  ($$psychedelx-andrei-popa-reanimating-history-exploring-the-memory-of-place-through-psychedelic-experience$$, $$Andrei Popa - Reanimating History: Exploring the Memory of Place through Psychedelic Experience$$, $$PsychedelX$$, $$2025-07-17T05:24:00+00:00$$, $$America/New_York$$, $$Andrei Popa presents on memory of place and psychedelic experience.$$, $$Andrei Popa presents Reanimating History: Exploring the Memory of Place through Psychedelic Experience as part of PsychedelX 2025.$$, $$Andrei Popa$$, $$YouTube$$, $$https://i.ytimg.com/vi/OF6249olH-0/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=OF6249olH-0$$, $$YouTube$$, $$Participant Talk$$, $$OF6249olH-0$$, $$2025-07-17T05:24:00+00:00$$, $$published$$, 0),
  ($$psychedelx-david-schwinn-the-case-of-qualitative-data-in-psychedelic-sciences$$, $$David Schwinn - The Case of Qualitative Data in Psychedelic Sciences$$, $$PsychedelX$$, $$2025-07-17T05:20:00+00:00$$, $$America/New_York$$, $$David Schwinn presents on qualitative data in psychedelic sciences.$$, $$David Schwinn presents The Case of Qualitative Data in Psychedelic Sciences as part of PsychedelX 2025.$$, $$David Schwinn$$, $$YouTube$$, $$https://i.ytimg.com/vi/4luHVNU5FAc/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=4luHVNU5FAc$$, $$YouTube$$, $$Participant Talk$$, $$4luHVNU5FAc$$, $$2025-07-17T05:20:00+00:00$$, $$published$$, 0),
  ($$psychedelx-luke-strong-the-psychedelic-experience-as-a-sublime-aesthetic$$, $$Luke Strong - The Psychedelic Experience as a Sublime Aesthetic$$, $$PsychedelX$$, $$2025-07-17T05:16:00+00:00$$, $$America/New_York$$, $$Luke Strong presents on the psychedelic experience as a sublime aesthetic.$$, $$Luke Strong presents The Psychedelic Experience as a Sublime Aesthetic as part of PsychedelX 2025.$$, $$Luke Strong$$, $$YouTube$$, $$https://i.ytimg.com/vi/IZuRVESFqMg/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=IZuRVESFqMg$$, $$YouTube$$, $$Participant Talk$$, $$IZuRVESFqMg$$, $$2025-07-17T05:16:00+00:00$$, $$published$$, 0),
  ($$psychedelx-evelyn-eddy-shoop-beyond-the-data-the-lived-experience$$, $$Evelyn (Eddy) Shoop - Beyond the Data: The Lived Experience$$, $$PsychedelX$$, $$2025-07-17T05:12:00+00:00$$, $$America/New_York$$, $$Evelyn Shoop presents on lived experience beyond the data.$$, $$Evelyn (Eddy) Shoop presents Beyond the Data: The Lived Experience as part of PsychedelX 2025.$$, $$Evelyn Shoop$$, $$YouTube$$, $$https://i.ytimg.com/vi/b5xYpjj91_o/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=b5xYpjj91_o$$, $$YouTube$$, $$Participant Talk$$, $$b5xYpjj91_o$$, $$2025-07-17T05:12:00+00:00$$, $$published$$, 0),
  ($$psychedelx-tyler-king-the-rainbow-wave-research-equity-queer-identity-and-the-need-for-culturally-informed-pat$$, $$Tyler King - The Rainbow Wave: Research Equity Queer Identity & the Need for Culturally Informed PAT$$, $$PsychedelX$$, $$2025-07-17T05:08:00+00:00$$, $$America/New_York$$, $$Tyler King presents on research equity, queer identity, and culturally informed psychedelic-assisted therapy.$$, $$Tyler King presents The Rainbow Wave: Research Equity, Queer Identity, and the Need for Culturally Informed Psychedelic-Assisted Therapy as part of PsychedelX 2025.$$, $$Tyler King$$, $$YouTube$$, $$https://i.ytimg.com/vi/67Pz49EWxec/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=67Pz49EWxec$$, $$YouTube$$, $$Participant Talk$$, $$67Pz49EWxec$$, $$2025-07-17T05:08:00+00:00$$, $$published$$, 0),
  ($$psychedelx-philip-bouleh-interpersonal-dimension-of-healing-in-ptsd-attachment-security-and-epistemic-trust$$, $$Philip Bouleh - Interpersonal Dimension of Healing in PTSD: Attachment Security & Epistemic Trust...$$, $$PsychedelX$$, $$2025-07-17T05:04:00+00:00$$, $$America/New_York$$, $$Philip Bouleh presents on attachment security, epistemic trust, and healing in PTSD.$$, $$Philip Bouleh presents Interpersonal Dimension of Healing in PTSD: Attachment Security and Epistemic Trust as part of PsychedelX 2025.$$, $$Philip Bouleh$$, $$YouTube$$, $$https://i.ytimg.com/vi/gpf9F8mDB-Y/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=gpf9F8mDB-Y$$, $$YouTube$$, $$Participant Talk$$, $$gpf9F8mDB-Y$$, $$2025-07-17T05:04:00+00:00$$, $$published$$, 0),
  ($$psychedelx-megan-portnoy-no-such-thing-as-just-a-room-understanding-the-feedback-loop-of-set-and-setting$$, $$Megan Portnoy - No Such Thing as Just a Room: Understanding the Feedback Loop of Set and Setting...$$, $$PsychedelX$$, $$2025-07-17T05:00:00+00:00$$, $$America/New_York$$, $$Megan Portnoy presents on set, setting, and the therapeutic environment.$$, $$Megan Portnoy presents No Such Thing as Just a Room: Understanding the Feedback Loop of Set and Setting as part of PsychedelX 2025.$$, $$Megan Portnoy$$, $$YouTube$$, $$https://i.ytimg.com/vi/7ET2fABlEoI/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=7ET2fABlEoI$$, $$YouTube$$, $$Participant Talk$$, $$7ET2fABlEoI$$, $$2025-07-17T05:00:00+00:00$$, $$published$$, 0),
  ($$psychedelx-justin-serwinski-revisiting-depth-psychology-and-psychedelics$$, $$Justin Serwinski - Revisiting Depth Psychology & Psychedelics$$, $$PsychedelX$$, $$2025-07-17T04:56:00+00:00$$, $$America/New_York$$, $$Justin Serwinski presents on depth psychology and psychedelics.$$, $$Justin Serwinski presents Revisiting Depth Psychology and Psychedelics as part of PsychedelX 2025.$$, $$Justin Serwinski$$, $$YouTube$$, $$https://i.ytimg.com/vi/nJr78YTKDq8/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=nJr78YTKDq8$$, $$YouTube$$, $$Participant Talk$$, $$nJr78YTKDq8$$, $$2025-07-17T04:56:00+00:00$$, $$published$$, 0),
  ($$psychedelx-izzy-bermudez-an-epidemic-opportunity-working-memory-deficits-in-tbi-as-a-poc-model-for-pat$$, $$Izzy Bermudez - An Epidemic Opportunity: Working Memory Deficits in TBI as a PoC Model for PAT$$, $$PsychedelX$$, $$2025-07-17T04:52:00+00:00$$, $$America/New_York$$, $$Izzy Bermudez presents on working memory deficits in traumatic brain injury as a proof-of-concept model for psychedelic-assisted therapy.$$, $$Izzy Bermudez presents An Epidemic Opportunity: Working Memory Deficits in TBI as a Proof-of-Concept Model for Psychedelic-Assisted Therapy as part of PsychedelX 2025.$$, $$Izzy Bermudez$$, $$YouTube$$, $$https://i.ytimg.com/vi/jW0hZbwipzs/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=jW0hZbwipzs$$, $$YouTube$$, $$Participant Talk$$, $$jW0hZbwipzs$$, $$2025-07-17T04:52:00+00:00$$, $$published$$, 0),
  ($$psychedelx-jack-howell-heart-focused-biofeedback-and-psychedelic-assisted-therapy-exploring-the-synergy$$, $$Jack Howell - Heart-Focused Biofeedback & Psychedelic-Assisted Therapy: Exploring the Synergy...$$, $$PsychedelX$$, $$2025-07-17T04:48:00+00:00$$, $$America/New_York$$, $$Jack Howell presents on heart-focused biofeedback and psychedelic-assisted therapy.$$, $$Jack Howell presents Heart-Focused Biofeedback and Psychedelic-Assisted Therapy: Exploring the Synergy as part of PsychedelX 2025.$$, $$Jack Howell$$, $$YouTube$$, $$https://i.ytimg.com/vi/U7gah_Y1r2s/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=U7gah_Y1r2s$$, $$YouTube$$, $$Participant Talk$$, $$U7gah_Y1r2s$$, $$2025-07-17T04:48:00+00:00$$, $$published$$, 0),
  ($$psychedelx-rajiv-rangan-can-psychedelic-monoamines-chemically-modify-proteins$$, $$Rajiv Rangan - Can Psychedelic Monoamines Chemically Modify Proteins?$$, $$PsychedelX$$, $$2025-07-17T04:44:00+00:00$$, $$America/New_York$$, $$Rajiv Rangan presents on whether psychedelic monoamines can chemically modify proteins.$$, $$Rajiv Rangan presents Can Psychedelic Monoamines Chemically Modify Proteins? as part of PsychedelX 2025.$$, $$Rajiv Rangan$$, $$YouTube$$, $$https://i.ytimg.com/vi/aUfEPQ_3ijY/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=aUfEPQ_3ijY$$, $$YouTube$$, $$Participant Talk$$, $$aUfEPQ_3ijY$$, $$2025-07-17T04:44:00+00:00$$, $$published$$, 0),
  ($$psychedelx-2025-ipn-members-panel$$, $$PsychedelX 2025 IPN Members Panel$$, $$PsychedelX$$, $$2025-07-17T04:40:00+00:00$$, $$America/New_York$$, $$IPN members panel from PsychedelX 2025.$$, $$IPN members panel from PsychedelX 2025, hosted by the Intercollegiate Psychedelics Network.$$, null, $$YouTube$$, $$https://i.ytimg.com/vi/PVrGQPXYwKM/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=PVrGQPXYwKM$$, $$YouTube$$, $$Panel$$, $$PVrGQPXYwKM$$, $$2025-07-17T04:40:00+00:00$$, $$published$$, 0),
  ($$psychedelx-ben-halper-lnmf-zendo-project-psychedelx-2025-keynote-four-principles-of-psychedelic-care$$, $$Ben Halper, LNMF Zendo Project PsychedelX 2025 Keynote - Four Principles of Psychedelic Care$$, $$PsychedelX$$, $$2025-07-17T04:36:00+00:00$$, $$America/New_York$$, $$Ben Halper of Zendo Project presents a PsychedelX 2025 keynote on four principles of psychedelic care.$$, $$Ben Halper of Zendo Project presents Four Principles of Psychedelic Care as a PsychedelX 2025 keynote.$$, $$Ben Halper$$, $$YouTube$$, $$https://i.ytimg.com/vi/RaHmQVM52P8/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=RaHmQVM52P8$$, $$YouTube$$, $$Keynote Speech$$, $$RaHmQVM52P8$$, $$2025-07-17T04:36:00+00:00$$, $$published$$, 0),
  ($$psychedelx-gina-giorgio-ma-psychedelx-2025-keynote-psychedelic-law-starts-here-how-you-can-impact$$, $$Gina Giorgio, MA PsychedelX 2025 Keynote - Psychedelic Law Starts Here: How You Can Impact...$$, $$PsychedelX$$, $$2025-07-17T04:32:00+00:00$$, $$America/New_York$$, $$Gina Giorgio presents a PsychedelX 2025 keynote on psychedelic law and opportunities for impact.$$, $$Gina Giorgio presents Psychedelic Law Starts Here: How You Can Impact as a PsychedelX 2025 keynote.$$, $$Gina Giorgio$$, $$YouTube$$, $$https://i.ytimg.com/vi/DriF45bTK2I/hqdefault.jpg$$, true, $$https://www.youtube.com/watch?v=DriF45bTK2I$$, $$YouTube$$, $$Keynote Speech$$, $$DriF45bTK2I$$, $$2025-07-17T04:32:00+00:00$$, $$published$$, 0)
on conflict (slug) do update
set title = excluded.title,
    event_type = excluded.event_type,
    starts_at = excluded.starts_at,
    timezone = excluded.timezone,
    summary = excluded.summary,
    description = excluded.description,
    speakers = excluded.speakers,
    location_label = excluded.location_label,
    thumbnail_url = excluded.thumbnail_url,
    is_recording = excluded.is_recording,
    recording_url = excluded.recording_url,
    recording_provider = excluded.recording_provider,
    recording_category = excluded.recording_category,
    recording_source_id = excluded.recording_source_id,
    recording_published_at = excluded.recording_published_at,
    status = excluded.status,
    updated_at = now();

insert into public.events (
  slug,
  title,
  event_type,
  starts_at,
  ends_at,
  timezone,
  summary,
  description,
  speakers,
  location_label,
  location_details,
  join_url,
  thumbnail_url,
  is_recording,
  recording_url,
  recording_provider,
  recording_category,
  recording_source_id,
  recording_published_at,
  status,
  registration_count
) values
  ($$ipn-labs-recording-placeholder-1$$, $$IPN Labs recording placeholder$$, $$IPN Lab$$, $$2026-01-01T17:00:00+00:00$$, null, $$America/New_York$$, $$Draft placeholder for a future IPN Labs recording.$$, $$Draft placeholder for a future IPN Labs recording. Replace this row with a real recording URL, thumbnail, speakers, and description before publishing.$$, null, $$Video$$, null, null, null, true, null, null, null, null, null, $$draft$$, 0),
  ($$ipn-labs-recording-placeholder-2$$, $$IPN Labs recording placeholder 2$$, $$IPN Lab$$, $$2026-01-02T17:00:00+00:00$$, null, $$America/New_York$$, $$Draft placeholder for a future IPN Labs recording.$$, $$Draft placeholder for a future IPN Labs recording. Replace this row with a real recording URL, thumbnail, speakers, and description before publishing.$$, null, $$Video$$, null, null, null, true, null, null, null, null, null, $$draft$$, 0)
on conflict (slug) do update
set title = excluded.title,
    event_type = excluded.event_type,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    timezone = excluded.timezone,
    summary = excluded.summary,
    description = excluded.description,
    speakers = excluded.speakers,
    location_label = excluded.location_label,
    location_details = excluded.location_details,
    join_url = excluded.join_url,
    thumbnail_url = excluded.thumbnail_url,
    is_recording = excluded.is_recording,
    recording_url = excluded.recording_url,
    recording_provider = excluded.recording_provider,
    recording_category = excluded.recording_category,
    recording_source_id = excluded.recording_source_id,
    recording_published_at = excluded.recording_published_at,
    status = excluded.status,
    updated_at = now();

delete from public.resources
where resource_type in ('ipn_lab_recording', 'psychedelx_recording');

alter table public.resources drop constraint if exists resources_resource_type_check;
alter table public.resources add constraint resources_resource_type_check
  check (resource_type in (
    'affiliate_benefit',
    'blog_post',
    'partner'
  ));
