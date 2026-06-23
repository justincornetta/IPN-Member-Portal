create table if not exists public.member_onboarding_progress (
  user_id                         uuid primary key references auth.users on delete cascade,
  profile_completed_at            timestamptz,
  whatsapp_completed_at           timestamptz,
  connection_request_completed_at timestamptz,
  invite_completed_at             timestamptz,
  event_rsvp_completed_at         timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.member_onboarding_progress enable row level security;

drop policy if exists "Users can view own onboarding progress" on public.member_onboarding_progress;
create policy "Users can view own onboarding progress"
  on public.member_onboarding_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own onboarding progress" on public.member_onboarding_progress;
create policy "Users can insert own onboarding progress"
  on public.member_onboarding_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own onboarding progress" on public.member_onboarding_progress;
create policy "Users can update own onboarding progress"
  on public.member_onboarding_progress for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.member_onboarding_progress to authenticated;

insert into public.member_onboarding_progress (
  user_id,
  profile_completed_at,
  whatsapp_completed_at,
  connection_request_completed_at,
  event_rsvp_completed_at
)
select
  profiles.id,
  case
    when profiles.avatar_url is not null
      and nullif(btrim(profiles.bio), '') is not null
      and cardinality(coalesce(profiles.interest_tags, '{}'::text[])) > 0
      then now()
    else null
  end,
  case
    when nullif(btrim(to_jsonb(profiles)->>'whatsapp_url'), '') is not null
      then now()
    else null
  end,
  case
    when exists (
      select 1
      from public.connections
      where connections.requester_id = profiles.id
    )
      then now()
    else null
  end,
  case
    when exists (
      select 1
      from public.event_registrations
      where event_registrations.user_id = profiles.id
    )
      then now()
    else null
  end
from public.profiles
on conflict (user_id) do update
set profile_completed_at = coalesce(
      public.member_onboarding_progress.profile_completed_at,
      excluded.profile_completed_at
    ),
    whatsapp_completed_at = coalesce(
      public.member_onboarding_progress.whatsapp_completed_at,
      excluded.whatsapp_completed_at
    ),
    connection_request_completed_at = coalesce(
      public.member_onboarding_progress.connection_request_completed_at,
      excluded.connection_request_completed_at
    ),
    event_rsvp_completed_at = coalesce(
      public.member_onboarding_progress.event_rsvp_completed_at,
      excluded.event_rsvp_completed_at
    ),
    updated_at = now();
