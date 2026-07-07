-- Track transactional event emails sent to RSVP'd members.
create table if not exists public.event_email_deliveries (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references public.events on delete cascade,
  user_id                 uuid not null references auth.users on delete cascade,
  registration_created_at timestamptz not null,
  kind                    text not null
    check (kind in ('rsvp_confirmation', 'reminder_24h', 'reminder_1h')),
  to_email                text not null,
  status                  text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  resend_email_id         text,
  attempt_count           integer not null default 0
    check (attempt_count >= 0),
  last_error              text,
  sent_at                 timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (event_id, user_id, registration_created_at, kind)
);

create index if not exists event_email_deliveries_status_kind_idx
  on public.event_email_deliveries (status, kind, created_at);

create index if not exists event_email_deliveries_event_kind_idx
  on public.event_email_deliveries (event_id, kind);

create index if not exists event_email_deliveries_user_id_idx
  on public.event_email_deliveries (user_id);

alter table public.event_email_deliveries enable row level security;
