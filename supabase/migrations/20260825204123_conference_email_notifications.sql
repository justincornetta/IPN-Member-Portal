-- Extend the private Resend delivery ledger to cover new conferences and
-- full-audience follow-ups when admins add an IPN meetup or member discount.

alter table public.member_notification_deliveries
  add column if not exists conference_id uuid references public.conferences on delete cascade,
  add column if not exists source_key text;

alter table public.member_notification_deliveries
  drop constraint if exists member_notification_deliveries_kind_check;

alter table public.member_notification_deliveries
  add constraint member_notification_deliveries_kind_check
  check (kind in (
    'new_event',
    'new_conference',
    'conference_meetup_added',
    'conference_discount_added',
    'connection_request_received',
    'connection_request_accepted'
  ));

alter table public.member_notification_deliveries
  drop constraint if exists member_notification_source_check;

alter table public.member_notification_deliveries
  add constraint member_notification_source_check check (
    (
      kind = 'new_event'
      and event_id is not null
      and conference_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is null
    )
    or
    (
      kind = 'new_conference'
      and conference_id is not null
      and event_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is null
    )
    or
    (
      kind in ('conference_meetup_added', 'conference_discount_added')
      and conference_id is not null
      and event_id is null
      and connection_id is null
      and actor_user_id is null
      and source_key is not null
    )
    or
    (
      kind in ('connection_request_received', 'connection_request_accepted')
      and connection_id is not null
      and actor_user_id is not null
      and event_id is null
      and conference_id is null
      and source_key is null
    )
  );

create index if not exists member_notification_deliveries_conference_idx
  on public.member_notification_deliveries (conference_id, kind);

-- Meetups already use stable ids. Backfill any legacy rows that predate that
-- convention so later edits cannot be mistaken for newly added meetups.
update public.conferences as conference
set meetups = (
  select jsonb_agg(
    case
      when meetup ? 'id' then meetup
      else jsonb_set(
        meetup,
        '{id}',
        to_jsonb(conference.slug || '-meetup-' || meetup_ordinality),
        true
      )
    end
    order by meetup_ordinality
  )
  from jsonb_array_elements(conference.meetups)
    with ordinality as meetup_rows(meetup, meetup_ordinality)
)
where jsonb_array_length(conference.meetups) > 0
  and exists (
    select 1
    from jsonb_array_elements(conference.meetups) as meetup_rows(meetup)
    where not (meetup ? 'id')
  );

-- Discounts previously had no identity separate from their display copy.
-- Stable ids let copy/code corrections remain edits while genuinely new
-- discounts produce one follow-up notification.
update public.conferences as conference
set discounts = (
  select jsonb_agg(
    case
      when discount ? 'id' then discount
      else jsonb_set(
        discount,
        '{id}',
        to_jsonb(conference.slug || '-discount-' || discount_ordinality),
        true
      )
    end
    order by discount_ordinality
  )
  from jsonb_array_elements(conference.discounts)
    with ordinality as discount_rows(discount, discount_ordinality)
)
where jsonb_array_length(conference.discounts) > 0
  and exists (
    select 1
    from jsonb_array_elements(conference.discounts) as discount_rows(discount)
    where not (discount ? 'id')
  );
