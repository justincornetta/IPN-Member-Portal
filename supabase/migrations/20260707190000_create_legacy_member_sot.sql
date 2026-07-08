-- Private legacy Source-of-Truth member directory for admin Analytics.
-- Rows are imported from the legacy dashboard's local data/sot/master.json.

create table if not exists public.legacy_member_sot_imports (
  id uuid primary key default gen_random_uuid(),
  source_path text not null,
  source_pulled_at timestamptz,
  source_row_count integer not null default 0 check (source_row_count >= 0),
  imported_row_count integer not null default 0 check (imported_row_count >= 0),
  imported_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.legacy_member_sot_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.legacy_member_sot_imports(id) on delete set null,
  legacy_person_id text,
  normalized_email text not null,
  original_email text,
  first_name text,
  last_name text,
  full_name text,
  affiliation text,
  country text,
  state text,
  city text,
  self_description text,
  primary_field text,
  psychedelic_field_status text,
  psychedelic_field_barriers text,
  current_role_and_goals text,
  ipn_inspiration text,
  referral_source text,
  channels_present text,
  channel_count integer not null default 0 check (channel_count >= 0),
  in_form boolean not null default false,
  in_mailchimp boolean not null default false,
  in_eventbrite boolean not null default false,
  in_zoom boolean not null default false,
  in_oldapp boolean not null default false,
  in_drive_historical boolean not null default false,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  mailchimp_id text,
  mailchimp_audiences text,
  mailchimp_status text,
  eventbrite_event_count integer not null default 0 check (eventbrite_event_count >= 0),
  eventbrite_last_event_date text,
  zoom_registrations integer not null default 0 check (zoom_registrations >= 0),
  zoom_attended integer not null default 0 check (zoom_attended >= 0),
  zoom_last_event_date text,
  zoom_total_minutes numeric not null default 0 check (zoom_total_minutes >= 0),
  zoom_attendance_status text,
  oldapp_user_id text,
  date_of_birth text,
  gender text,
  race text,
  oldapp_signup_location text,
  engagement_status text,
  notes text,
  raw_legacy jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_member_sot_rows_normalized_email_key unique (normalized_email)
);

create index if not exists legacy_member_sot_rows_person_id_idx
  on public.legacy_member_sot_rows (legacy_person_id);

create index if not exists legacy_member_sot_rows_first_seen_idx
  on public.legacy_member_sot_rows (first_seen_at desc);

create index if not exists legacy_member_sot_rows_last_seen_idx
  on public.legacy_member_sot_rows (last_seen_at desc);

create index if not exists legacy_member_sot_rows_country_idx
  on public.legacy_member_sot_rows (country);

create index if not exists legacy_member_sot_rows_state_idx
  on public.legacy_member_sot_rows (state);

create index if not exists legacy_member_sot_rows_primary_field_idx
  on public.legacy_member_sot_rows (primary_field);

create index if not exists legacy_member_sot_rows_mailchimp_status_idx
  on public.legacy_member_sot_rows (mailchimp_status);

create index if not exists legacy_member_sot_rows_import_id_idx
  on public.legacy_member_sot_rows (import_id);

create index if not exists legacy_member_sot_rows_source_flags_idx
  on public.legacy_member_sot_rows (in_form, in_mailchimp, in_oldapp, in_zoom, in_eventbrite, in_drive_historical);

alter table public.legacy_member_sot_imports enable row level security;
alter table public.legacy_member_sot_rows enable row level security;

revoke all on table public.legacy_member_sot_imports from anon, authenticated;
revoke all on table public.legacy_member_sot_rows from anon, authenticated;

grant select, insert, update, delete on public.legacy_member_sot_imports to service_role;
grant select, insert, update, delete on public.legacy_member_sot_rows to service_role;
