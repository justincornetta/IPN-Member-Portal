-- Analytics eligibility and the durable source-of-truth for onboarding
-- milestone 4 ("Participate in IPN"). The ledger is append-only: a later
-- cancellation is a new fact and never erases the original completion.

alter table public.profiles
  add column if not exists exclude_from_analytics boolean not null default false;

comment on column public.profiles.exclude_from_analytics is
  'Superadmin-controlled exclusion for test, QA, duplicate, or otherwise nonrepresentative accounts.';

create index if not exists profiles_analytics_eligible_idx
  on public.profiles (created_at)
  where is_banned is not true and exclude_from_analytics is not true;

create table if not exists public.member_participation_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null check (activity_type in (
    'portal_event_rsvp',
    'conference_rsvp',
    'conference_meetup_rsvp',
    'eventbrite_ticket',
    'connection_request_sent'
  )),
  action text not null check (action in ('completed', 'cancelled')),
  source_system text not null,
  source_record_id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint member_participation_activity_source_event_unique
    unique (source_system, source_record_id, action, occurred_at)
);

comment on table public.member_participation_activities is
  'Append-only facts that prove participation for onboarding milestone 4. Consumers use the earliest completed row; cancelled rows preserve lifecycle history.';

create index if not exists member_participation_activities_user_occurred_idx
  on public.member_participation_activities (user_id, occurred_at);

create index if not exists member_participation_activities_type_occurred_idx
  on public.member_participation_activities (activity_type, occurred_at);

alter table public.member_participation_activities enable row level security;
revoke all on table public.member_participation_activities from anon, authenticated, public;
grant select, insert on table public.member_participation_activities to service_role;
revoke update, delete, truncate on table public.member_participation_activities from service_role;

-- A one-way identity hash lets future rollups suppress deleted test accounts
-- without retaining their profile, name, or email address.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.analytics_excluded_subjects (
  subject_hash text primary key,
  reason text not null check (reason in ('deleted_account')),
  excluded_at timestamptz not null default now()
);

comment on table public.analytics_excluded_subjects is
  'Privacy-safe deletion tombstones used only to prevent deleted identities from re-entering member-level analytics.';

alter table public.analytics_excluded_subjects enable row level security;
revoke all on table public.analytics_excluded_subjects from anon, authenticated, public;
grant select on table public.analytics_excluded_subjects to service_role;
revoke insert, update, delete, truncate on table public.analytics_excluded_subjects from service_role;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.record_member_participation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_user_id uuid;
  activity_kind text;
  activity_action text;
  activity_source text := tg_table_name;
  activity_source_id text;
  activity_occurred_at timestamptz;
  activity_metadata jsonb := '{}'::jsonb;
begin
  activity_action := case when tg_op = 'DELETE' then 'cancelled' else 'completed' end;

  if tg_table_name = 'event_registrations' then
    activity_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    activity_kind := 'portal_event_rsvp';
    activity_source_id := concat(
      case when tg_op = 'DELETE' then old.event_id else new.event_id end,
      ':',
      activity_user_id
    );
    activity_occurred_at := case
      when tg_op = 'DELETE' then clock_timestamp()
      else coalesce(new.created_at, clock_timestamp())
    end;
    activity_metadata := jsonb_build_object(
      'event_id', case when tg_op = 'DELETE' then old.event_id else new.event_id end
    );
  elsif tg_table_name = 'conference_rsvps' then
    activity_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    activity_kind := 'conference_rsvp';
    activity_source_id := concat(
      case when tg_op = 'DELETE' then old.conference_id else new.conference_id end,
      ':',
      activity_user_id
    );
    activity_occurred_at := case
      when tg_op = 'DELETE' then clock_timestamp()
      else coalesce(new.created_at, clock_timestamp())
    end;
    activity_metadata := jsonb_build_object(
      'conference_id', case when tg_op = 'DELETE' then old.conference_id else new.conference_id end
    );
  elsif tg_table_name = 'conference_meetup_rsvps' then
    activity_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    activity_kind := 'conference_meetup_rsvp';
    activity_source_id := concat(
      case when tg_op = 'DELETE' then old.conference_id else new.conference_id end,
      ':',
      case when tg_op = 'DELETE' then old.meetup_id else new.meetup_id end,
      ':',
      activity_user_id
    );
    activity_occurred_at := case
      when tg_op = 'DELETE' then clock_timestamp()
      else coalesce(new.created_at, clock_timestamp())
    end;
    activity_metadata := jsonb_build_object(
      'conference_id', case when tg_op = 'DELETE' then old.conference_id else new.conference_id end,
      'meetup_id', case when tg_op = 'DELETE' then old.meetup_id else new.meetup_id end
    );
  elsif tg_table_name = 'connections' then
    activity_user_id := case when tg_op = 'DELETE' then old.requester_id else new.requester_id end;
    activity_kind := 'connection_request_sent';
    activity_source_id := (case when tg_op = 'DELETE' then old.id else new.id end)::text;
    activity_occurred_at := case
      when tg_op = 'DELETE' then clock_timestamp()
      else coalesce(new.created_at, clock_timestamp())
    end;
    activity_metadata := jsonb_build_object(
      'addressee_id', case when tg_op = 'DELETE' then old.addressee_id else new.addressee_id end
    );
  elsif tg_table_name = 'event_ticket_access' then
    if tg_op = 'DELETE' then
      select p.id into activity_user_id
      from public.profiles p
      where lower(btrim(p.email)) = old.attendee_email_normalized
      order by p.created_at asc nulls last
      limit 1;
      activity_source_id := old.id::text;
      activity_occurred_at := clock_timestamp();
      activity_metadata := jsonb_build_object('event_id', old.event_id);
    else
      select p.id into activity_user_id
      from public.profiles p
      where lower(btrim(p.email)) = new.attendee_email_normalized
      order by p.created_at asc nulls last
      limit 1;
      activity_source_id := new.id::text;
      activity_occurred_at := coalesce(new.created_at, new.synced_at, clock_timestamp());
      activity_metadata := jsonb_build_object('event_id', new.event_id);
    end if;
    activity_kind := 'eventbrite_ticket';
  else
    raise exception 'Unsupported participation source table: %', tg_table_name;
  end if;

  -- External tickets that cannot be deterministically matched by normalized
  -- email remain factual event totals but do not become member activity.
  if activity_user_id is not null then
    insert into public.member_participation_activities (
      user_id,
      activity_type,
      action,
      source_system,
      source_record_id,
      occurred_at,
      metadata
    ) values (
      activity_user_id,
      activity_kind,
      activity_action,
      activity_source,
      activity_source_id,
      activity_occurred_at,
      activity_metadata
    ) on conflict do nothing;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.record_member_participation_activity() from public;

create or replace function private.record_deleted_analytics_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
begin
  normalized_email := nullif(lower(btrim(old.email)), '');
  if normalized_email is not null then
    insert into public.analytics_excluded_subjects (subject_hash, reason, excluded_at)
    values (
      encode(extensions.digest(normalized_email, 'sha256'), 'hex'),
      'deleted_account',
      clock_timestamp()
    )
    on conflict (subject_hash) do update
      set reason = excluded.reason,
          excluded_at = excluded.excluded_at;

    if split_part(normalized_email, '@', 2) in ('gmail.com', 'googlemail.com') then
      normalized_email := concat(
        replace(regexp_replace(split_part(normalized_email, '@', 1), '\+.*$', ''), '.', ''),
        '@gmail.com'
      );
      insert into public.analytics_excluded_subjects (subject_hash, reason, excluded_at)
      values (
        encode(extensions.digest(normalized_email, 'sha256'), 'hex'),
        'deleted_account',
        clock_timestamp()
      )
      on conflict (subject_hash) do update
        set reason = excluded.reason,
            excluded_at = excluded.excluded_at;
    end if;
  end if;
  return old;
end;
$$;

revoke all on function private.record_deleted_analytics_subject() from public;

drop trigger if exists record_deleted_analytics_subject on public.profiles;
create trigger record_deleted_analytics_subject
  before delete on public.profiles
  for each row execute function private.record_deleted_analytics_subject();

drop trigger if exists record_event_registration_participation on public.event_registrations;
create trigger record_event_registration_participation
  after insert or delete on public.event_registrations
  for each row execute function private.record_member_participation_activity();

drop trigger if exists record_conference_rsvp_participation on public.conference_rsvps;
create trigger record_conference_rsvp_participation
  after insert or delete on public.conference_rsvps
  for each row execute function private.record_member_participation_activity();

drop trigger if exists record_conference_meetup_rsvp_participation on public.conference_meetup_rsvps;
create trigger record_conference_meetup_rsvp_participation
  after insert or delete on public.conference_meetup_rsvps
  for each row execute function private.record_member_participation_activity();

drop trigger if exists record_connection_request_participation on public.connections;
create trigger record_connection_request_participation
  after insert or delete on public.connections
  for each row execute function private.record_member_participation_activity();

drop trigger if exists record_event_ticket_participation on public.event_ticket_access;
create trigger record_event_ticket_participation
  after insert or delete on public.event_ticket_access
  for each row execute function private.record_member_participation_activity();

-- Conservative backfill: every row below directly proves the member action
-- and preserves the original occurrence timestamp.
insert into public.member_participation_activities (
  user_id, activity_type, action, source_system, source_record_id, occurred_at, metadata
)
select
  r.user_id,
  'portal_event_rsvp',
  'completed',
  'event_registrations',
  concat(r.event_id, ':', r.user_id),
  coalesce(r.created_at, now()),
  jsonb_build_object('event_id', r.event_id)
from public.event_registrations r
on conflict do nothing;

insert into public.member_participation_activities (
  user_id, activity_type, action, source_system, source_record_id, occurred_at, metadata
)
select
  r.user_id,
  'conference_rsvp',
  'completed',
  'conference_rsvps',
  concat(r.conference_id, ':', r.user_id),
  coalesce(r.created_at, now()),
  jsonb_build_object('conference_id', r.conference_id)
from public.conference_rsvps r
on conflict do nothing;

insert into public.member_participation_activities (
  user_id, activity_type, action, source_system, source_record_id, occurred_at, metadata
)
select
  r.user_id,
  'conference_meetup_rsvp',
  'completed',
  'conference_meetup_rsvps',
  concat(r.conference_id, ':', r.meetup_id, ':', r.user_id),
  coalesce(r.created_at, now()),
  jsonb_build_object('conference_id', r.conference_id, 'meetup_id', r.meetup_id)
from public.conference_meetup_rsvps r
on conflict do nothing;

insert into public.member_participation_activities (
  user_id, activity_type, action, source_system, source_record_id, occurred_at, metadata
)
select
  c.requester_id,
  'connection_request_sent',
  'completed',
  'connections',
  c.id::text,
  coalesce(c.created_at, now()),
  jsonb_build_object('addressee_id', c.addressee_id)
from public.connections c
on conflict do nothing;

insert into public.member_participation_activities (
  user_id, activity_type, action, source_system, source_record_id, occurred_at, metadata
)
select
  p.id,
  'eventbrite_ticket',
  'completed',
  'event_ticket_access',
  t.id::text,
  coalesce(t.created_at, t.synced_at, now()),
  jsonb_build_object('event_id', t.event_id)
from public.event_ticket_access t
join public.profiles p
  on lower(btrim(p.email)) = t.attendee_email_normalized
on conflict do nothing;
