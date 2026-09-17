create table if not exists public.mailchimp_audience_contacts (
  audience_id text not null,
  audience_name text not null,
  subscriber_hash text not null,
  mailchimp_member_id text,
  status text not null
    check (status in ('subscribed', 'unsubscribed', 'cleaned', 'pending', 'transactional', 'archived', 'unknown')),
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  last_changed_at timestamptz,
  source_pulled_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (audience_id, subscriber_hash)
);

create index if not exists mailchimp_audience_contacts_status_idx
  on public.mailchimp_audience_contacts (audience_id, status);

create index if not exists mailchimp_audience_contacts_subscriber_idx
  on public.mailchimp_audience_contacts (subscriber_hash)
  where status = 'subscribed';

create table if not exists public.mailchimp_subscription_events (
  id uuid primary key default gen_random_uuid(),
  audience_id text not null,
  audience_name text not null,
  subscriber_hash text not null,
  previous_status text,
  new_status text not null
    check (new_status in ('subscribed', 'unsubscribed', 'cleaned', 'pending', 'transactional', 'archived', 'unknown')),
  occurred_at timestamptz not null,
  observed_at timestamptz not null default now(),
  source text not null
    check (source in ('initial_backfill', 'daily_reconciliation', 'webhook')),
  source_event_key text not null unique,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object')
);

create index if not exists mailchimp_subscription_events_status_time_idx
  on public.mailchimp_subscription_events (new_status, occurred_at desc);

create index if not exists mailchimp_subscription_events_audience_time_idx
  on public.mailchimp_subscription_events (audience_id, occurred_at desc, new_status);

create table if not exists public.mailchimp_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  audiences_count integer not null default 0 check (audiences_count >= 0),
  contacts_seen integer not null default 0 check (contacts_seen >= 0),
  contacts_upserted integer not null default 0 check (contacts_upserted >= 0),
  status_events_added integer not null default 0 check (status_events_added >= 0),
  error_message text,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object')
);

create index if not exists mailchimp_sync_runs_started_at_idx
  on public.mailchimp_sync_runs (started_at desc);

alter table public.mailchimp_audience_contacts enable row level security;
alter table public.mailchimp_subscription_events enable row level security;
alter table public.mailchimp_sync_runs enable row level security;

revoke all on table public.mailchimp_audience_contacts from anon, authenticated;
revoke all on table public.mailchimp_subscription_events from anon, authenticated;
revoke all on table public.mailchimp_sync_runs from anon, authenticated;

grant select, insert, update, delete on table public.mailchimp_audience_contacts to service_role;
grant select, insert, update, delete on table public.mailchimp_subscription_events to service_role;
grant select, insert, update, delete on table public.mailchimp_sync_runs to service_role;
