alter table public.member_onboarding_progress
  add column if not exists getting_started_completed_at timestamptz,
  add column if not exists getting_started_success_seen_at timestamptz;
