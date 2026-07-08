-- First-party Member Portal analytics for admin-only utilization reporting.
-- Raw events are written only by server-side service-role code and retained
-- for a short investigation window. Daily rollups support long-term trends.

create table if not exists public.portal_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (
    event_name in (
      'page_view',
      'page_duration',
      'session_summary',
      'curated_click',
      'registration_view',
      'registration_submit',
      'registration_success',
      'registration_error',
      'sign_in_view',
      'sign_in_submit',
      'sign_in_success',
      'sign_in_error',
      'event_rsvp_created',
      'event_rsvp_cancelled',
      'whatsapp_profile_linked',
      'whatsapp_cta_clicked'
    )
  ),
  user_id uuid references auth.users on delete set null,
  session_id text not null,
  anonymous_id text,
  page_path text,
  page_title text,
  referrer text,
  target_id text,
  target_label text,
  error_code text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  click_count integer check (click_count is null or click_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists portal_analytics_events_occurred_at_idx
  on public.portal_analytics_events (occurred_at desc);

create index if not exists portal_analytics_events_event_name_idx
  on public.portal_analytics_events (event_name, occurred_at desc);

create index if not exists portal_analytics_events_user_id_idx
  on public.portal_analytics_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists portal_analytics_events_session_id_idx
  on public.portal_analytics_events (session_id, occurred_at desc);

create table if not exists public.portal_analytics_daily_rollups (
  rollup_date date not null,
  event_name text not null,
  page_path text not null default '',
  dimension text not null default '',
  event_count integer not null default 0,
  unique_users integer not null default 0,
  unique_sessions integer not null default 0,
  total_duration_seconds bigint not null default 0,
  total_clicks bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (rollup_date, event_name, page_path, dimension)
);

create index if not exists portal_analytics_daily_rollups_event_date_idx
  on public.portal_analytics_daily_rollups (event_name, rollup_date desc);

alter table public.portal_analytics_events enable row level security;
alter table public.portal_analytics_daily_rollups enable row level security;

revoke all on table public.portal_analytics_events from anon, authenticated;
revoke all on table public.portal_analytics_daily_rollups from anon, authenticated;

grant select, insert, update, delete on public.portal_analytics_events to service_role;
grant select, insert, update, delete on public.portal_analytics_daily_rollups to service_role;
