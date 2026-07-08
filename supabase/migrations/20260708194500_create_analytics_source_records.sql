-- Private row-level analytics records pulled from external sources.
-- Aggregate metrics stay in legacy-snapshot.json; person-level detail stays here.

create table if not exists public.analytics_source_records (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  record_type text not null,
  source_record_id text not null,
  event_source_id text,
  event_name text,
  event_started_at timestamptz,
  occurred_at timestamptz,
  registered_at timestamptz,
  name text,
  email text,
  normalized_email text generated always as (nullif(lower(btrim(email)), '')) stored,
  attended boolean,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  duration_minutes numeric check (duration_minutes is null or duration_minutes >= 0),
  details jsonb not null default '{}'::jsonb,
  source_pulled_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analytics_source_records_source_record_key unique (source, record_type, source_record_id)
);

create index if not exists analytics_source_records_source_type_idx
  on public.analytics_source_records (source, record_type);

create index if not exists analytics_source_records_event_source_id_idx
  on public.analytics_source_records (event_source_id);

create index if not exists analytics_source_records_event_started_at_idx
  on public.analytics_source_records (event_started_at desc);

create index if not exists analytics_source_records_registered_at_idx
  on public.analytics_source_records (registered_at desc);

create index if not exists analytics_source_records_occurred_at_idx
  on public.analytics_source_records (occurred_at desc);

create index if not exists analytics_source_records_normalized_email_idx
  on public.analytics_source_records (normalized_email);

create index if not exists analytics_source_records_last_seen_at_idx
  on public.analytics_source_records (last_seen_at desc);

alter table public.analytics_source_records enable row level security;

revoke all on table public.analytics_source_records from anon, authenticated;

grant select, insert, update, delete on public.analytics_source_records to service_role;
