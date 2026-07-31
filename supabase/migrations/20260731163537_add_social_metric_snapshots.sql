-- Service-managed daily social metrics used by the Portal analytics history.
create table if not exists public.social_metric_snapshots (
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin')),
  snapshot_date date not null,
  follower_count integer not null check (follower_count >= 0),
  engagement_rate numeric check (engagement_rate is null or engagement_rate >= 0),
  posts_count integer check (posts_count is null or posts_count >= 0),
  source text not null check (source in ('api', 'manual', 'backfill')),
  details jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (platform, snapshot_date)
);

create index if not exists social_metric_snapshots_date_idx
  on public.social_metric_snapshots (snapshot_date desc, platform);

create index if not exists social_metric_snapshots_updated_by_idx
  on public.social_metric_snapshots (updated_by)
  where updated_by is not null;

alter table public.social_metric_snapshots enable row level security;

revoke all on table public.social_metric_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.social_metric_snapshots to service_role;

comment on table public.social_metric_snapshots is
  'Private daily Instagram, Facebook, and LinkedIn analytics snapshots managed by trusted services.';
