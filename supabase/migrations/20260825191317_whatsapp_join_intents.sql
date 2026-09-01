-- Authoritative, append-only WhatsApp join intent and analytics contract.

create table if not exists public.member_whatsapp_join_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_kind text not null check (channel_kind in ('permanent', 'event')),
  channel_slug text not null check (channel_slug ~ '^[a-z0-9][a-z0-9_-]{0,127}$'),
  source text not null check (source ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  event_id uuid references public.events(id) on delete set null,
  clicked_at timestamptz not null default now(),
  constraint member_whatsapp_join_intents_event_shape check (
    (channel_kind = 'permanent' and event_id is null)
    or (channel_kind = 'event' and event_id is not null)
  )
);

create index if not exists member_whatsapp_join_intents_user_clicked_idx
  on public.member_whatsapp_join_intents (user_id, clicked_at desc);

create index if not exists member_whatsapp_join_intents_channel_clicked_idx
  on public.member_whatsapp_join_intents (channel_kind, channel_slug, clicked_at desc);

alter table public.member_whatsapp_join_intents enable row level security;
revoke all on table public.member_whatsapp_join_intents from anon, authenticated, public;
revoke update, delete, truncate on table public.member_whatsapp_join_intents from service_role;
grant select, insert on public.member_whatsapp_join_intents to service_role;

create or replace function public.mark_whatsapp_onboarding_from_join_intent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.member_onboarding_progress (
    user_id,
    whatsapp_started_at,
    whatsapp_current_step,
    whatsapp_completed_at,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    new.clicked_at,
    'join-intent-recorded',
    new.clicked_at,
    new.clicked_at,
    new.clicked_at
  )
  on conflict (user_id) do update
  set whatsapp_started_at = coalesce(
        public.member_onboarding_progress.whatsapp_started_at,
        excluded.whatsapp_started_at
      ),
      whatsapp_current_step = excluded.whatsapp_current_step,
      whatsapp_completed_at = coalesce(
        public.member_onboarding_progress.whatsapp_completed_at,
        excluded.whatsapp_completed_at
      ),
      updated_at = excluded.updated_at;
  return new;
end;
$$;

revoke all on function public.mark_whatsapp_onboarding_from_join_intent() from public;
grant execute on function public.mark_whatsapp_onboarding_from_join_intent() to service_role;

drop trigger if exists member_whatsapp_join_intent_marks_onboarding
  on public.member_whatsapp_join_intents;
create trigger member_whatsapp_join_intent_marks_onboarding
  after insert on public.member_whatsapp_join_intents
  for each row execute function public.mark_whatsapp_onboarding_from_join_intent();

alter table public.portal_analytics_events
  drop constraint if exists portal_analytics_events_event_name_check;

alter table public.portal_analytics_events
  add constraint portal_analytics_events_event_name_check check (
    event_name in (
      'page_view',
      'page_duration',
      'session_summary',
      'curated_click',
      'registration_view',
      'registration_step_view',
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
      'whatsapp_cta_clicked',
      'whatsapp_join_intent'
    )
  );
