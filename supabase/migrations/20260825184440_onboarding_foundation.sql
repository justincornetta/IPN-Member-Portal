-- Resumable onboarding foundation and authoritative WhatsApp join-intent log.
-- Existing milestone timestamps are never reset or overwritten.

alter table public.member_onboarding_progress
  add column if not exists welcome_started_at timestamptz,
  add column if not exists welcome_current_step text,
  add column if not exists welcome_completed_at timestamptz,
  add column if not exists profile_started_at timestamptz,
  add column if not exists profile_current_step text,
  add column if not exists whatsapp_started_at timestamptz,
  add column if not exists whatsapp_current_step text,
  add column if not exists product_tour_started_at timestamptz,
  add column if not exists product_tour_current_step text,
  add column if not exists product_tour_completed_at timestamptz;

alter table public.member_onboarding_progress
  add constraint member_onboarding_welcome_current_step_check
    check (welcome_current_step is null or welcome_current_step ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add constraint member_onboarding_profile_current_step_check
    check (profile_current_step is null or profile_current_step ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add constraint member_onboarding_whatsapp_current_step_check
    check (whatsapp_current_step is null or whatsapp_current_step ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  add constraint member_onboarding_product_tour_current_step_check
    check (product_tour_current_step is null or product_tour_current_step ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

-- Existing completion timestamps predate resumable flow state. Treat those
-- flows as started without changing the original completion timestamp.
update public.member_onboarding_progress
set profile_started_at = coalesce(profile_started_at, profile_completed_at),
    whatsapp_started_at = coalesce(whatsapp_started_at, whatsapp_completed_at),
    updated_at = now()
where (profile_completed_at is not null and profile_started_at is null)
   or (whatsapp_completed_at is not null and whatsapp_started_at is null);

-- Backfill only members who have not already reached the profile milestone.
-- The approved definition has seven items: photo; short bio; current role
-- (persona); school/organization; interests; the grouped About you answers;
-- and LinkedIn URL or an explicit opt-out. This safe backfill covers the URL
-- branch only because the explicit opt-out is owned by the profile integration.
insert into public.member_onboarding_progress (
  user_id,
  profile_started_at,
  profile_completed_at
)
select
  profiles.id,
  now(),
  now()
from public.profiles
where nullif(btrim(profiles.avatar_url), '') is not null
  and nullif(btrim(profiles.bio), '') is not null
  and nullif(btrim(profiles.persona), '') is not null
  and (
    nullif(btrim(profiles.affiliation), '') is not null
    or nullif(btrim(profiles.school), '') is not null
    or exists (
      select 1
      from public.member_education
      where member_education.user_id = profiles.id
        and nullif(btrim(member_education.institution), '') is not null
    )
  )
  and exists (
    select 1
    from unnest(coalesce(profiles.interest_tags, '{}'::text[])) as interest(value)
    where nullif(btrim(interest.value), '') is not null
  )
  and nullif(btrim(profiles.role_and_goals), '') is not null
  and nullif(btrim(profiles.inspiration), '') is not null
  and nullif(btrim(profiles.support_needs), '') is not null
  and nullif(btrim(profiles.linkedin_url), '') is not null
on conflict (user_id) do update
set profile_started_at = coalesce(
      public.member_onboarding_progress.profile_started_at,
      excluded.profile_started_at
    ),
    profile_completed_at = coalesce(
      public.member_onboarding_progress.profile_completed_at,
      excluded.profile_completed_at
    ),
    updated_at = now();
