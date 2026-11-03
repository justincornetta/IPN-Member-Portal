-- Keep verified-email lookup inside narrowly scoped, service-only functions.
-- Existing pinned search paths and EXECUTE grants are preserved.
alter function public.register_guest_event(uuid,text,text,text,boolean) security definer;
alter function public.claim_guest_event_registrations(uuid) security definer;
revoke all on function public.register_guest_event(uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.claim_guest_event_registrations(uuid) from public,anon,authenticated;
