-- Owner-authorized cleanup: only the three confirmed guest tests on this event.
-- Preserve real members, other aliases and the same addresses on other events.
lock table public.guest_event_email_deliveries in share row exclusive mode;
do $$
begin
 if exists (
   select 1 from public.guest_event_registrations g
   join public.events e on e.id=g.event_id
   join public.guest_event_email_deliveries d on d.registration_id=g.id
   where e.slug='global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional'
   and g.email in ('justin.cornetta+1@gmail.com','justin.cornetta+5@gmail.com','justin.cornetta+8@gmail.com')
   and g.converted_user_id is null and d.status='sending'
 ) then raise exception 'A test email is being delivered; retry cleanup after delivery finishes'; end if;
 delete from public.guest_event_registrations g using public.events e
 where e.id=g.event_id
 and e.slug='global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional'
 and g.email in ('justin.cornetta+1@gmail.com','justin.cornetta+5@gmail.com','justin.cornetta+8@gmail.com')
 and g.converted_user_id is null;
 -- Existing trigger decrements the count; dependent email jobs cascade-delete.
end $$;
