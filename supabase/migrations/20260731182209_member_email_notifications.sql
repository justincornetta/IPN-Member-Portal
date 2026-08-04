-- Queue and audit member-engagement emails sent through Resend.
-- Member clients have no policies on this table; only service-role server code
-- can read or mutate delivery records.
create table if not exists public.member_notification_deliveries (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null
    check (kind in (
      'new_event',
      'connection_request_received',
      'connection_request_accepted'
    )),
  recipient_user_id uuid not null references auth.users on delete cascade,
  actor_user_id     uuid references auth.users on delete cascade,
  event_id          uuid references public.events on delete cascade,
  connection_id     uuid references public.connections on delete cascade,
  dedupe_key        text not null unique,
  to_email          text not null,
  status            text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  resend_email_id   text,
  attempt_count     integer not null default 0
    check (attempt_count >= 0),
  last_error        text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint member_notification_source_check check (
    (
      kind = 'new_event'
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
  )
);

create index if not exists member_notification_deliveries_queue_idx
  on public.member_notification_deliveries (status, attempt_count, created_at);

create index if not exists member_notification_deliveries_recipient_idx
  on public.member_notification_deliveries (recipient_user_id, created_at desc);

create index if not exists member_notification_deliveries_event_idx
  on public.member_notification_deliveries (event_id, kind);

create index if not exists member_notification_deliveries_connection_idx
  on public.member_notification_deliveries (connection_id, kind);

alter table public.member_notification_deliveries enable row level security;
revoke all on public.member_notification_deliveries from anon, authenticated, public;
