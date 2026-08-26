-- Per-event editorial control. Runtime delivery remains gated separately by
-- EVENT_REGISTRATION_REMINDERS_ENABLED, which defaults off in application config.
alter table public.events
  add column if not exists registration_reminder_enabled boolean not null default true;

alter table public.member_notification_deliveries
  drop constraint if exists member_notification_deliveries_kind_check;

alter table public.member_notification_deliveries
  add constraint member_notification_deliveries_kind_check
  check (kind in (
    'new_event',
    'event_registration_reminder',
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
      and connection_id is null
      and actor_user_id is null
    )
    or
    (
      kind in ('connection_request_received', 'connection_request_accepted')
      and connection_id is not null
      and actor_user_id is not null
      and event_id is null
    )
  );

comment on column public.events.registration_reminder_enabled is
  'Whether this event may queue the approximately 72-hour non-registrant reminder.';
