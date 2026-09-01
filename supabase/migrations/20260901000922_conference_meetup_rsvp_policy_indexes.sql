-- Keep meetup RSVP ownership checks efficient and index the user foreign key
-- used for account deletion and member-level RSVP lookups.

create index if not exists conference_meetup_rsvps_user_id_idx
  on public.conference_meetup_rsvps (user_id);

drop policy if exists "Users can create own meetup RSVP" on public.conference_meetup_rsvps;
create policy "Users can create own meetup RSVP"
  on public.conference_meetup_rsvps for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.conferences
      where conferences.id = conference_meetup_rsvps.conference_id
        and conferences.status = 'published'
    )
  );

drop policy if exists "Users can delete own meetup RSVP" on public.conference_meetup_rsvps;
create policy "Users can delete own meetup RSVP"
  on public.conference_meetup_rsvps for delete
  to authenticated
  using ((select auth.uid()) = user_id);
