-- Add attendee-list privacy to conference meetup RSVPs while preserving
-- aggregate headcounts for every authenticated member.

alter table public.conference_meetup_rsvps
  add column if not exists is_visible boolean not null default true;

-- Data API grants are explicit so this migration also works for projects
-- created after Supabase stopped auto-exposing new public tables.
grant select, insert, update, delete
  on table public.conference_meetup_rsvps
  to authenticated;

drop policy if exists "Users can view own meetup RSVPs" on public.conference_meetup_rsvps;
drop policy if exists "Members can view visible meetup RSVPs" on public.conference_meetup_rsvps;
create policy "Members can view visible meetup RSVPs"
  on public.conference_meetup_rsvps for select
  to authenticated
  using ((select auth.uid()) = user_id or is_visible = true);

drop policy if exists "Users can update own meetup RSVP visibility" on public.conference_meetup_rsvps;
create policy "Users can update own meetup RSVP visibility"
  on public.conference_meetup_rsvps for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.get_conference_meetup_attendance_counts(
  target_conference_id uuid
)
returns table (
  meetup_id text,
  total_count bigint,
  visible_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.meetup_id,
    count(*) as total_count,
    count(*) filter (where r.is_visible) as visible_count
  from public.conference_meetup_rsvps r
  join public.conferences c on c.id = r.conference_id
  where r.conference_id = target_conference_id
    and (select auth.uid()) is not null
    and c.status = 'published'
  group by r.meetup_id;
$$;

revoke all on function private.get_conference_meetup_attendance_counts(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.get_conference_meetup_attendance_counts(uuid) to authenticated;

-- Keep the Data API entry point security-invoker. The privileged aggregate
-- helper stays in the unexposed private schema and returns counts only.
create or replace function public.get_conference_meetup_attendance_counts(
  target_conference_id uuid
)
returns table (
  meetup_id text,
  total_count bigint,
  visible_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.get_conference_meetup_attendance_counts(target_conference_id);
$$;

revoke all on function public.get_conference_meetup_attendance_counts(uuid) from public;
grant execute on function public.get_conference_meetup_attendance_counts(uuid) to authenticated;
