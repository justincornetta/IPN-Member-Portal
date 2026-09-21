-- Move the Horizons NYC IPN mixer to Partiful while preserving every other
-- meetup field and the array's display order. The application treats these
-- optional JSONB keys as the reusable external-registration configuration.
update public.conferences as conference
set meetups = (
  select jsonb_agg(
    case
      when meetup ->> 'id' = 'horizons-2026-meetup-1' then
        meetup || jsonb_build_object(
          'registrationUrl', 'https://partiful.com/e/1iyPTemwzvjkRBdCfpj0?c=-Gg-omcv',
          'registrationProvider', 'Partiful'
        )
      else meetup
    end
    order by meetup_ordinality
  )
  from jsonb_array_elements(conference.meetups)
    with ordinality as meetup_rows(meetup, meetup_ordinality)
)
where conference.slug = 'horizons-2026'
  and exists (
    select 1
    from jsonb_array_elements(conference.meetups) as meetup_rows(meetup)
    where meetup ->> 'id' = 'horizons-2026-meetup-1'
  );
