-- Private audit trail for portal-owned Analytics refresh runs.
-- The Admin Analytics page reads this through service-role server code only.

create table if not exists public.portal_analytics_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (
    status in ('running', 'success', 'partial_failure', 'failed')
  ),
  trigger text not null default 'manual',
  sources jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists portal_analytics_refresh_runs_started_at_idx
  on public.portal_analytics_refresh_runs (started_at desc);

create index if not exists portal_analytics_refresh_runs_finished_at_idx
  on public.portal_analytics_refresh_runs (finished_at desc);

alter table public.portal_analytics_refresh_runs enable row level security;

revoke all on table public.portal_analytics_refresh_runs from anon, authenticated;

grant select, insert, update, delete on public.portal_analytics_refresh_runs to service_role;
