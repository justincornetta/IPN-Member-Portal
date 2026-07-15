-- Conferences (admin beta): external psychedelics conferences with IPN
-- meetups, discount codes, and member RSVPs. The /dashboard/conferences page
-- is gated to admin/superadmin in the app layer while in beta. RLS below
-- already allows any authenticated member to read published rows, so no
-- backend change is needed when the page graduates out of beta — only the
-- app-layer redirect needs to be removed.
--
-- meetups/discounts are stored as jsonb on the conference row (not child
-- tables) — they are only ever read or written together with their parent,
-- same as events.speaker_resources.

create table if not exists public.conferences (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  organizer        text,
  category         text not null default 'Community'
    check (category in ('Academic', 'Industry', 'Community', 'Harm Reduction')),
  summary          text,
  description      text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  timezone         text not null default 'America/New_York',
  city             text,
  state            text,
  country          text,
  venue            text,
  website_url      text,
  registration_url text,
  whatsapp_url     text,
  meetups          jsonb not null default '[]'::jsonb,
  discounts        jsonb not null default '[]'::jsonb,
  rsvp_count       integer not null default 0
    check (rsvp_count >= 0),
  status           text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists conferences_status_starts_at_idx
  on public.conferences (status, starts_at);

alter table public.conferences enable row level security;

drop policy if exists "Authenticated users can view published conferences" on public.conferences;
create policy "Authenticated users can view published conferences"
  on public.conferences for select
  using (auth.role() = 'authenticated' and status = 'published');


-- ── RSVPs ──
--
-- Unlike event_registrations (where members can only read their own row),
-- conference_rsvps intentionally lets other authenticated members read rows
-- so the "who's going" list can render. is_visible is a per-RSVP privacy
-- toggle enforced at the RLS layer (not just in the app) — a member can RSVP
-- and still not appear in anyone else's attendee list. This is independent
-- of profiles.is_discoverable, which controls directory visibility, not
-- conference attendance visibility.

create table if not exists public.conference_rsvps (
  conference_id  uuid not null references public.conferences on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  is_visible     boolean not null default true,
  created_at     timestamptz default now(),
  primary key (conference_id, user_id)
);

create index if not exists conference_rsvps_user_id_idx
  on public.conference_rsvps (user_id);

alter table public.conference_rsvps enable row level security;

drop policy if exists "Authenticated users can view visible conference RSVPs" on public.conference_rsvps;
create policy "Authenticated users can view visible conference RSVPs"
  on public.conference_rsvps for select
  using (
    auth.role() = 'authenticated'
    and (is_visible = true or auth.uid() = user_id)
  );

drop policy if exists "Users can create own conference RSVP" on public.conference_rsvps;
create policy "Users can create own conference RSVP"
  on public.conference_rsvps for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conferences
      where conferences.id = conference_rsvps.conference_id
        and conferences.status = 'published'
    )
  );

drop policy if exists "Users can update own conference RSVP" on public.conference_rsvps;
create policy "Users can update own conference RSVP"
  on public.conference_rsvps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own conference RSVP" on public.conference_rsvps;
create policy "Users can delete own conference RSVP"
  on public.conference_rsvps for delete
  using (auth.uid() = user_id);


-- Keep conferences.rsvp_count in sync (total RSVPs, including hidden ones —
-- mirrors sync_event_registration_count for events.registration_count).
create or replace function public.sync_conference_rsvp_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.conferences
    set rsvp_count = rsvp_count + 1,
        updated_at = now()
    where id = new.conference_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.conferences
    set rsvp_count = greatest(rsvp_count - 1, 0),
        updated_at = now()
    where id = old.conference_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists conference_rsvp_count_changed on public.conference_rsvps;

create trigger conference_rsvp_count_changed
  after insert or delete on public.conference_rsvps
  for each row
  execute procedure public.sync_conference_rsvp_count();


-- ── Seed: example conferences (admin beta placeholder content) ──
-- Safe to re-run: upserts by slug.

insert into public.conferences (
  slug, name, organizer, category, summary, description,
  starts_at, ends_at, timezone, city, state, country, venue,
  website_url, registration_url, whatsapp_url, meetups, discounts, status
) values
  (
    $$horizons-2026$$, $$Horizons: Perspectives on Psychedelics$$, $$Horizons Media$$, $$Community$$,
    $$One of the longest-running psychedelics conferences, bringing together researchers, clinicians, and community members for three days of talks in New York City.$$,
    $$Horizons is a longstanding gathering point for the psychedelics field, mixing academic research updates with policy, harm reduction, and culture programming. IPN has sent a delegation the last two years and is organizing a member meetup again this year.

Expect talks from leading researchers alongside community-oriented programming in the evenings. Good conference for members who are newer to the field as well as seasoned researchers.$$,
    $$2026-10-23T13:00:00Z$$, $$2026-10-25T22:00:00Z$$, $$America/New_York$$, $$New York$$, $$NY$$, $$USA$$, $$Cooper Union, The Great Hall$$,
    $$https://horizonsnyc.com$$, $$https://horizonsnyc.com/register$$, $$https://chat.whatsapp.com/example-horizons-2026$$,
    $$[
      {"title": "IPN Member Meetup — Friday Happy Hour", "type": "IPN Meetup", "startsAt": "2026-10-23T23:00:00Z", "location": "Lobby bar, Cooper Union", "description": "Casual meetup for IPN members attending the conference. Look for the purple lanyard.", "registrationUrl": null},
      {"title": "IPN Booth — Student Research Office Hours", "type": "IPN Booth", "startsAt": "2026-10-24T15:00:00Z", "location": "Exhibit hall, table 12", "description": "Drop by to chat with IPN leadership about ongoing student research opportunities and chapter support.", "registrationUrl": null}
    ]$$::jsonb,
    $$[
      {"label": "IPN member registration discount", "code": "IPN15", "url": "https://horizonsnyc.com/register", "description": "15% off any ticket tier.", "expiresAt": "2026-10-01T00:00:00Z"},
      {"label": "Student ticket rate", "code": null, "url": "https://horizonsnyc.com/student-tickets", "description": "Apply directly on the Horizons site with a valid .edu email — no code needed.", "expiresAt": null}
    ]$$::jsonb,
    $$published$$
  ),
  (
    $$wonderland-miami-2026$$, $$Wonderland Miami$$, $$Microdose$$, $$Industry$$,
    $$The largest industry and investment conference in psychedelics, focused on business, policy, and the clinical pipeline.$$,
    $$Wonderland is the go-to conference for members interested in the business and policy side of psychedelics — biotech, VC, clinic operations, and regulatory strategy. Less academic than Horizons or ICPR, more useful for members exploring industry career paths.

IPN typically sends a smaller delegation focused on students exploring the professional/industry track.$$,
    $$2026-11-10T14:00:00Z$$, $$2026-11-12T23:00:00Z$$, $$America/New_York$$, $$Miami$$, $$FL$$, $$USA$$, $$Loews Miami Beach Hotel$$,
    $$https://wonderland.miami$$, $$https://wonderland.miami/tickets$$, null,
    $$[
      {"title": "IPN Careers-in-Industry Meetup", "type": "IPN Meetup", "startsAt": "2026-11-11T21:30:00Z", "location": "Hotel poolside bar", "description": "For members interested in biotech, clinic operations, or investment roles in the psychedelic space. Space is limited — please reserve a spot.", "registrationUrl": "https://forms.gle/example-wonderland-meetup-rsvp"}
    ]$$::jsonb,
    $$[
      {"label": "IPN member registration discount", "code": "IPNWONDER26", "url": "https://wonderland.miami/tickets", "description": "20% off General Admission and Investor passes.", "expiresAt": "2026-10-15T00:00:00Z"}
    ]$$::jsonb,
    $$published$$
  ),
  (
    $$atps-2026$$, $$ATPS Annual Conference$$, $$Association for Transformative Psychedelic Studies$$, $$Academic$$,
    $$A research-focused conference centered on clinical trial data, mechanism-of-action research, and training standards for facilitators.$$,
    $$ATPS skews academic and clinical — expect dense poster sessions and workshop tracks on facilitator training standards. Good fit for graduate students and members doing lab-based research.

IPN is coordinating group registration this year; reach out in the event chat if you want to split a hotel room.$$,
    $$2026-09-18T15:00:00Z$$, $$2026-09-20T22:00:00Z$$, $$America/Denver$$, $$Denver$$, $$CO$$, $$USA$$, $$Colorado Convention Center$$,
    $$https://atps.org/conference$$, $$https://atps.org/conference/register$$, $$https://chat.whatsapp.com/example-atps-2026$$,
    $$[
      {"title": "IPN Research Roundtable", "type": "IPN Meetup", "startsAt": "2026-09-19T12:00:00Z", "location": "Room 203B", "description": "Informal roundtable for IPN members presenting posters or papers — bring questions and feedback for each other's work.", "registrationUrl": null},
      {"title": "IPN Dinner", "type": "IPN Meetup", "startsAt": "2026-09-19T23:30:00Z", "location": "Off-site — TBD, watch the event chat", "description": "Group dinner — we need a headcount for the reservation, please RSVP.", "registrationUrl": "https://forms.gle/example-atps-dinner-rsvp"}
    ]$$::jsonb,
    $$[]$$::jsonb,
    $$published$$
  ),
  (
    $$icpr-2027$$, $$Interdisciplinary Conference on Psychedelic Research (ICPR)$$, $$OPEN Foundation$$, $$Academic$$,
    $$Europe's leading academic psychedelics conference, held biennially in the Netherlands.$$,
    $$ICPR draws top researchers from across Europe and is a strong option for members studying or doing exchange programs abroad. Registration typically opens several months out and sells through capacity — worth booking early.$$,
    $$2027-06-16T08:00:00Z$$, $$2027-06-18T18:00:00Z$$, $$Europe/Amsterdam$$, $$Haarlem$$, null, $$Netherlands$$, $$Philharmonie Haarlem$$,
    $$https://icpr-conference.com$$, $$https://icpr-conference.com/tickets$$, null,
    $$[]$$::jsonb,
    $$[
      {"label": "Early-bird student rate", "code": null, "url": "https://icpr-conference.com/tickets", "description": "No IPN-specific code yet — student pricing is available directly through ICPR while early-bird tickets last.", "expiresAt": null}
    ]$$::jsonb,
    $$published$$
  )
on conflict (slug) do nothing;
