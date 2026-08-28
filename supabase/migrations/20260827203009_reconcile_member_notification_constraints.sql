-- Reconcile the conference-notification and event-reminder extensions. Each
-- feature originally replaced the same delivery-ledger constraints, so the
-- final migration must preserve both sets of notification kinds and sources.

alter table public.member_notification_deliveries
  add column if not exists conference_id uuid references public.conferences on delete cascade,
  add column if not exists source_key text;

alter table public.member_notification_deliveries
  drop constraint if exists member_notification_deliveries_kind_check;

alter table public.member_notification_deliveries
  add constraint member_notification_deliveries_kind_check
  check (kind in (
    'new_event',
    'event_registration_reminder',
    'new_conference',
    'conference_meetup_added',
    'conference_discount_added',
    'connection_request_received',
    'connection_request_accepted'
  ));

alter table public.member_notification_deliveries
  drop constraint if exists member_notification_source_check;

alter table public.member_notification_deliveries
  add constraint member_notification_source_check check (
    (
      kind in ('new_event', 'event_registration_reminder')
      and event_id is not null
      and conference_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is null
    )
    or
    (
      kind = 'new_conference'
      and conference_id is not null
      and event_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is null
    )
    or
    (
      kind in ('conference_meetup_added', 'conference_discount_added')
      and conference_id is not null
      and event_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is not null
    )
    or
    (
      kind in ('connection_request_received', 'connection_request_accepted')
      and connection_id is not null
      and actor_user_id is not null
      and event_id is null
      and conference_id is null
      and source_key is null
    )
  );

create index if not exists member_notification_deliveries_conference_idx
  on public.member_notification_deliveries (conference_id, kind);
