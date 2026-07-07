-- Superadmin-controlled labels for migrated analytics events.
-- Analytics reads these server-side and applies overrides before filtering,
-- counting, and rendering event tables.

create table if not exists public.analytics_event_label_overrides (
  event_id text primary key,
  event_topic text,
  event_date timestamptz,
  program_label text not null default 'Other'
    check (program_label in ('IPN Labs', 'PsychedelX', 'Other')),
  event_type text not null default 'public'
    check (event_type in ('public', 'internal')),
  include_in_analytics boolean not null default true,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analytics_event_label_overrides_event_date_idx
  on public.analytics_event_label_overrides (event_date desc);

alter table public.analytics_event_label_overrides enable row level security;

revoke all on table public.analytics_event_label_overrides from anon, authenticated;
grant select, insert, update, delete on public.analytics_event_label_overrides to service_role;
