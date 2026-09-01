-- Short-lived opaque WhatsApp handoffs for cross-device QR and same-device
-- redirects. Only token hashes are persisted; raw invite URLs remain server-only.

alter table public.member_whatsapp_join_intents
  add column if not exists surface text not null default 'unspecified'
    check (surface ~ '^[a-z0-9][a-z0-9_-]{0,63}$');

-- Preserve historical event intent rows if an event is later deleted and the
-- existing foreign key sets event_id to null.
alter table public.member_whatsapp_join_intents
  drop constraint if exists member_whatsapp_join_intents_event_shape;
alter table public.member_whatsapp_join_intents
  add constraint member_whatsapp_join_intents_event_shape check (
    (channel_kind = 'permanent' and event_id is null)
    or channel_kind = 'event'
  );

create table if not exists public.member_whatsapp_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_kind text not null check (channel_kind in ('permanent', 'event')),
  channel_slug text not null check (channel_slug ~ '^[a-z0-9][a-z0-9_-]{0,127}$'),
  source text not null check (source ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  surface text not null check (surface ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  analytics_session_id text
    check (analytics_session_id is null or analytics_session_id ~ '^[A-Za-z0-9_-]{1,120}$'),
  event_id uuid references public.events(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_intent_id uuid references public.member_whatsapp_join_intents(id),
  constraint member_whatsapp_handoffs_expiry_check check (expires_at > issued_at),
  constraint member_whatsapp_handoffs_event_shape check (
    (channel_kind = 'permanent' and event_id is null)
    or (channel_kind = 'event' and event_id is not null)
  ),
  constraint member_whatsapp_handoffs_consumption_shape check (
    (consumed_at is null and consumed_intent_id is null)
    or (consumed_at is not null and consumed_intent_id is not null)
  )
);

create index if not exists member_whatsapp_handoffs_active_idx
  on public.member_whatsapp_handoffs (token_hash, expires_at)
  where consumed_at is null;

create index if not exists member_whatsapp_handoffs_user_issued_idx
  on public.member_whatsapp_handoffs (user_id, issued_at desc);

alter table public.member_whatsapp_handoffs enable row level security;
revoke all on table public.member_whatsapp_handoffs from anon, authenticated, public;
revoke delete, truncate on table public.member_whatsapp_handoffs from service_role;
grant select, insert, update on public.member_whatsapp_handoffs to service_role;

create or replace function public.consume_whatsapp_handoff(
  p_token_hash text,
  p_channel_slug text
)
returns table (
  handoff_id uuid,
  intent_id uuid,
  member_user_id uuid,
  handoff_channel_kind text,
  handoff_channel_slug text,
  handoff_source text,
  handoff_surface text,
  handoff_event_id uuid,
  handoff_consumed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed public.member_whatsapp_handoffs%rowtype;
  created_intent_id uuid;
begin
  select handoffs.*
  into claimed
  from public.member_whatsapp_handoffs as handoffs
  where handoffs.token_hash = p_token_hash
    and handoffs.channel_slug = p_channel_slug
    and handoffs.consumed_at is null
    and handoffs.expires_at > now()
  for update;

  if not found then
    return;
  end if;

  if claimed.channel_kind = 'event' and not exists (
    select 1
    from public.event_registrations as registrations
    where registrations.event_id = claimed.event_id
      and registrations.user_id = claimed.user_id
  ) then
    return;
  end if;

  insert into public.member_whatsapp_join_intents (
    user_id,
    channel_kind,
    channel_slug,
    source,
    surface,
    event_id,
    clicked_at
  )
  values (
    claimed.user_id,
    claimed.channel_kind,
    claimed.channel_slug,
    claimed.source,
    claimed.surface,
    claimed.event_id,
    now()
  )
  returning id into created_intent_id;

  update public.member_whatsapp_handoffs as handoffs
  set consumed_at = now(),
      consumed_intent_id = created_intent_id
  where handoffs.id = claimed.id
  returning handoffs.consumed_at into claimed.consumed_at;

  return query
  select
    claimed.id,
    created_intent_id,
    claimed.user_id,
    claimed.channel_kind,
    claimed.channel_slug,
    claimed.source,
    claimed.surface,
    claimed.event_id,
    claimed.consumed_at;
end;
$$;

revoke all on function public.consume_whatsapp_handoff(text, text) from public;
grant execute on function public.consume_whatsapp_handoff(text, text) to service_role;

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
      'whatsapp_join_intent',
      'whatsapp_anonymous_redirect'
    )
  );
