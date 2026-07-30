-- Conference enhancements: in-app RSVP for IPN meetups (no more redirecting
-- out to Google Forms), a lightweight "Past Conferences" tab with photo
-- links, and "how to apply" instructions on member discounts.

-- ── Meetup RSVPs ──
--
-- Unlike conference_rsvps, this is intentionally personal-only (no
-- visibility toggle, no "who's going" list) — nobody asked for an attendee
-- list per meetup, just a working RSVP button that doesn't leave the app.
-- Mirrors the simplicity of event_ticket_access rather than the
-- visibility-toggle complexity of conference_rsvps.

create table if not exists public.conference_meetup_rsvps (
  conference_id uuid not null references public.conferences on delete cascade,
  meetup_id     text not null,
  user_id       uuid not null references auth.users on delete cascade,
  created_at    timestamptz default now(),
  primary key (conference_id, meetup_id, user_id)
);

alter table public.conference_meetup_rsvps enable row level security;

drop policy if exists "Users can view own meetup RSVPs" on public.conference_meetup_rsvps;
create policy "Users can view own meetup RSVPs"
  on public.conference_meetup_rsvps for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own meetup RSVP" on public.conference_meetup_rsvps;
create policy "Users can create own meetup RSVP"
  on public.conference_meetup_rsvps for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conferences
      where conferences.id = conference_meetup_rsvps.conference_id
        and conferences.status = 'published'
    )
  );

drop policy if exists "Users can delete own meetup RSVP" on public.conference_meetup_rsvps;
create policy "Users can delete own meetup RSVP"
  on public.conference_meetup_rsvps for delete
  using (auth.uid() = user_id);


-- ── Past Conferences ──
--
-- Separate, deliberately lighter table — past events don't need RSVPs,
-- registration links, meetups, or discounts, so this isn't just
-- conferences.status = 'archived'. drive_folder_url is left null on the
-- seed rows below until Luke/Taylor share the actual Google Drive links.

create table if not exists public.past_conferences (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  organizer        text,
  category         text,
  starts_at        date,
  ends_at          date,
  city             text,
  state            text,
  country          text,
  summary          text,
  drive_folder_url text,
  created_at       timestamptz default now()
);

alter table public.past_conferences enable row level security;

drop policy if exists "Authenticated users can view past conferences" on public.past_conferences;
create policy "Authenticated users can view past conferences"
  on public.past_conferences for select
  using (auth.role() = 'authenticated');

insert into public.past_conferences (
  name, organizer, category, starts_at, ends_at, city, state, country, summary, drive_folder_url
) values
  (
    $$Psychedelic Science 2025$$, $$MAPS$$, $$Community$$,
    $$2025-06-16$$, $$2025-06-20$$, $$Denver$$, $$CO$$, $$USA$$,
    $$The largest psychedelics conference in the world — IPN sent a delegation of student leaders for a week of talks, exhibits, and community meetups.$$,
    null
  ),
  (
    $$Philadelic$$, null, $$Community$$,
    $$2025-04-11$$, $$2025-04-12$$, $$Philadelphia$$, $$PA$$, $$USA$$,
    $$A regional community gathering IPN chapters attended for a weekend of talks and networking.$$,
    null
  )
on conflict do nothing;


-- ── Backfill: stable ids on existing meetups, drop registrationUrl ──
--
-- registrationUrl pointed at external Google Forms for headcount — now
-- superseded by conference_meetup_rsvps above, so it's dropped here rather
-- than left dangling and unused. meetup_id needs something stable to
-- reference, hence the added id per meetup.

update public.conferences set meetups = $$[
  {"id": "horizons-2026-meetup-1", "title": "IPN Member Meetup — Friday Happy Hour", "type": "IPN Meetup", "startsAt": "2026-10-23T23:00:00Z", "location": "Lobby bar, Cooper Union", "description": "Casual meetup for IPN members attending the conference. Look for the purple lanyard."},
  {"id": "horizons-2026-meetup-2", "title": "IPN Booth — Student Research Office Hours", "type": "IPN Booth", "startsAt": "2026-10-24T15:00:00Z", "location": "Exhibit hall, table 12", "description": "Drop by to chat with IPN leadership about ongoing student research opportunities and chapter support."}
]$$::jsonb
where slug = 'horizons-2026';

update public.conferences set meetups = $$[
  {"id": "wonderland-miami-2026-meetup-1", "title": "IPN Careers-in-Industry Meetup", "type": "IPN Meetup", "startsAt": "2026-11-11T21:30:00Z", "location": "Hotel poolside bar", "description": "For members interested in biotech, clinic operations, or investment roles in the psychedelic space. Space is limited — please reserve a spot."}
]$$::jsonb
where slug = 'wonderland-miami-2026';

update public.conferences set meetups = $$[
  {"id": "atps-2026-meetup-1", "title": "IPN Research Roundtable", "type": "IPN Meetup", "startsAt": "2026-09-19T12:00:00Z", "location": "Room 203B", "description": "Informal roundtable for IPN members presenting posters or papers — bring questions and feedback for each other's work."},
  {"id": "atps-2026-meetup-2", "title": "IPN Dinner", "type": "IPN Meetup", "startsAt": "2026-09-19T23:30:00Z", "location": "Off-site — TBD, watch the event chat", "description": "Group dinner — we need a headcount for the reservation, please RSVP."}
]$$::jsonb
where slug = 'atps-2026';


-- ── Backfill: how-to-apply instructions on existing discounts ──

update public.conferences set discounts = $$[
  {"label": "IPN member registration discount", "code": "IPN15", "url": "https://horizonsnyc.com/register", "description": "15% off any ticket tier.", "howToApply": "Enter code IPN15 at checkout on the Payment step.", "expiresAt": "2026-10-01T00:00:00Z"},
  {"label": "Student ticket rate", "code": null, "url": "https://horizonsnyc.com/student-tickets", "description": "Apply directly on the Horizons site with a valid .edu email — no code needed.", "howToApply": "No code needed — register directly with a valid .edu email address.", "expiresAt": null}
]$$::jsonb
where slug = 'horizons-2026';

update public.conferences set discounts = $$[
  {"label": "IPN member registration discount", "code": "IPNWONDER26", "url": "https://wonderland.miami/tickets", "description": "20% off General Admission and Investor passes.", "howToApply": "Enter code IPNWONDER26 in the discount code field at checkout.", "expiresAt": "2026-10-15T00:00:00Z"}
]$$::jsonb
where slug = 'wonderland-miami-2026';

update public.conferences set discounts = $$[
  {"label": "Early-bird student rate", "code": null, "url": "https://icpr-conference.com/tickets", "description": "No IPN-specific code yet — student pricing is available directly through ICPR while early-bird tickets last.", "howToApply": "No code yet — student pricing is applied automatically when you select the student ticket tier.", "expiresAt": null}
]$$::jsonb
where slug = 'icpr-2027';
