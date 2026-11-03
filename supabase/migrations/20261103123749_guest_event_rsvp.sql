-- Guest event records stay private; public forms write only through the server.
alter table public.events add column if not exists guest_rsvp_enabled boolean not null default false;

create table public.guest_event_registrations (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events on delete cascade,
 first_name text not null check (length(first_name) between 1 and 80),
 last_name text not null check (length(last_name) between 1 and 80),
 email text not null check (email = lower(trim(email)) and length(email) <= 254),
 marketing_opt_in boolean not null default false,
 consent_at timestamptz,
 consent_version text not null default 'guest-events-v1',
 converted_user_id uuid references auth.users on delete cascade,
 cancelled_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index guest_event_active_email on public.guest_event_registrations(event_id,email) where cancelled_at is null;
create index guest_event_conversion on public.guest_event_registrations(email,converted_user_id);
alter table public.guest_event_registrations enable row level security;
revoke all on public.guest_event_registrations from anon, authenticated;
grant all on public.guest_event_registrations to service_role;

create table public.guest_event_email_deliveries (
 id uuid primary key default gen_random_uuid(),
 registration_id uuid not null references public.guest_event_registrations on delete cascade,
 kind text not null check(kind in ('rsvp_confirmation','reminder_24h','reminder_1h','membership_invitation')),
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped','review')),
 payload jsonb,
 attempt_count integer not null default 0,
 first_attempt_at timestamptz,
 locked_at timestamptz,
 resend_email_id text,
 last_error text,
 sent_at timestamptz,
 unique(registration_id,kind)
);
create index guest_event_due_mail on public.guest_event_email_deliveries(status,due_at);
alter table public.guest_event_email_deliveries enable row level security;
revoke all on public.guest_event_email_deliveries from anon,authenticated;
grant all on public.guest_event_email_deliveries to service_role;

create table public.guest_event_rate_limits (
 bucket text not null,
 window_start timestamptz not null,
 hits integer not null default 1,
 primary key(bucket,window_start)
);
alter table public.guest_event_rate_limits enable row level security;
revoke all on public.guest_event_rate_limits from anon,authenticated;
grant all on public.guest_event_rate_limits to service_role;

create function public.guest_event_rate_limit(p_bucket text,p_limit integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
 delete from guest_event_rate_limits where window_start < now() - interval '2 hours';
 insert into guest_event_rate_limits(bucket,window_start) values(p_bucket,date_trunc('hour',now()))
 on conflict(bucket,window_start) do update set hits=guest_event_rate_limits.hits+1 returning hits into n;
 return n <= p_limit;
end $$;
revoke all on function public.guest_event_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.guest_event_rate_limit(text,integer) to service_role;

-- Atomic RSVP + outbox, with event eligibility checked again under a lock.
create function public.register_guest_event(p_event_id uuid,p_first_name text,p_last_name text,p_email text,p_opt_in boolean)
returns uuid language plpgsql security invoker set search_path=public as $$
declare e public.events; r uuid; t timestamptz := now();
begin
 select * into e from events where id=p_event_id for share;
 if not found or not e.guest_rsvp_enabled or e.status <> 'published' or e.is_recording
   or coalesce(e.requires_verified_ticket,false) or nullif(e.registration_url,'') is not null
   or coalesce(e.ends_at,e.starts_at) <= t then raise exception 'Event unavailable'; end if;
 -- A signed-out existing attendee receives the same public result, without a second RSVP.
 if exists(select 1 from event_registrations er join auth.users u on u.id=er.user_id
   where er.event_id=p_event_id and lower(u.email)=lower(trim(p_email)) and u.email_confirmed_at is not null)
 then return null; end if;
 insert into guest_event_registrations(event_id,first_name,last_name,email,marketing_opt_in,consent_at)
 values(p_event_id,p_first_name,p_last_name,lower(trim(p_email)),p_opt_in,case when p_opt_in then t end)
 on conflict(event_id,email) where cancelled_at is null do nothing returning id into r;
 if r is null then
   select id into r from guest_event_registrations where event_id=p_event_id and email=lower(trim(p_email)) and cancelled_at is null;
   return r; -- Preserve original name, consent and delivery history on duplicate submissions.
 end if;
 insert into guest_event_email_deliveries(registration_id,kind,due_at) values(r,'rsvp_confirmation',t);
 if e.starts_at-interval '24 hours' > t then
   insert into guest_event_email_deliveries(registration_id,kind,due_at) values(r,'reminder_24h',e.starts_at-interval '24 hours');
 end if;
 if e.starts_at-interval '1 hour' > t then
   insert into guest_event_email_deliveries(registration_id,kind,due_at) values(r,'reminder_1h',e.starts_at-interval '1 hour');
 end if;
 if p_opt_in then
   insert into guest_event_email_deliveries(registration_id,kind,due_at)
   values(r,'membership_invitation',coalesce(e.ends_at,e.starts_at)+interval '24 hours');
 end if;
 return r;
end $$;
revoke all on function public.register_guest_event(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.register_guest_event(uuid,text,text,text,boolean) to service_role;

-- A lease prevents concurrent workers from delivering the same job.
-- Uncertain sends are never automatically retried beyond Resend's 24h idempotency window.
create function public.claim_guest_event_emails(p_limit integer default 25)
returns setof public.guest_event_email_deliveries language plpgsql security invoker set search_path=public as $$
begin
 update guest_event_email_deliveries set status='review',last_error='Delivery needs review before retry'
 where status in ('sending','failed') and (first_attempt_at < now()-interval '23 hours' or attempt_count>=5)
   and (locked_at is null or locked_at < now()-interval '10 minutes');
 return query
 with candidates as (
   select id from guest_event_email_deliveries
   where due_at<=now() and (status in ('pending','failed') or (status='sending' and locked_at<now()-interval '10 minutes'))
   order by due_at limit greatest(1,least(p_limit,50)) for update skip locked
 )
 update guest_event_email_deliveries d set status='sending',locked_at=now(),
   first_attempt_at=coalesce(first_attempt_at,now()),attempt_count=attempt_count+1
 from candidates c where d.id=c.id returning d.*;
end $$;
revoke all on function public.claim_guest_event_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_guest_event_emails(integer) to service_role;

-- Service-only operation; email ownership is verified against auth.users, never client metadata.
create function public.claim_guest_event_registrations(p_user_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare owner_email text; g record; n integer:=0;
begin
 select lower(email) into owner_email from auth.users where id=p_user_id and email_confirmed_at is not null;
 if owner_email is null then return 0; end if;
 for g in select * from guest_event_registrations where email=owner_email
   and converted_user_id is null and cancelled_at is null for update loop
   update guest_event_registrations set converted_user_id=p_user_id where id=g.id;
   insert into event_registrations(event_id,user_id) values(g.event_id,p_user_id) on conflict do nothing;
   n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.claim_guest_event_registrations(uuid) from public,anon,authenticated;
grant execute on function public.claim_guest_event_registrations(uuid) to service_role;

-- Guest registrations contribute until their corresponding member RSVP takes over.
create function public.sync_guest_event_count() returns trigger language plpgsql security invoker set search_path=public as $$
declare old_count integer:=0; new_count integer:=0;
begin
 if tg_op<>'INSERT' then old_count:=case when old.cancelled_at is null and old.converted_user_id is null then 1 else 0 end; end if;
 if tg_op<>'DELETE' then new_count:=case when new.cancelled_at is null and new.converted_user_id is null then 1 else 0 end; end if;
 update events set registration_count=greatest(0,registration_count+new_count-old_count) where id=coalesce(new.event_id,old.event_id);
 return coalesce(new,old);
end $$;
revoke all on function public.sync_guest_event_count() from public,anon,authenticated;
create trigger guest_event_count_changed after insert or update or delete on public.guest_event_registrations for each row execute function public.sync_guest_event_count();

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

-- Keep cancellation in sync when a converted guest cancels from their member account.
create function private.cancel_converted_guest_rsvp() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update guest_event_registrations set cancelled_at=now() where event_id=old.event_id and converted_user_id=old.user_id and cancelled_at is null;
 return old;
end $$;
revoke all on function private.cancel_converted_guest_rsvp() from public,anon,authenticated;
create trigger cancel_converted_guest after delete on public.event_registrations for each row execute function private.cancel_converted_guest_rsvp();

-- Cancellation and its member RSVP are changed in one transaction.
create function public.update_guest_event_preference(p_id uuid,p_action text)
returns void language plpgsql security invoker set search_path=public as $$
declare g public.guest_event_registrations;
begin
 if p_action not in ('cancel','unsubscribe') then raise exception 'Invalid preference'; end if;
 select * into g from guest_event_registrations where id=p_id for update;
 if not found then raise exception 'Registration not found'; end if;
 update guest_event_registrations set marketing_opt_in=false,
   cancelled_at=case when p_action='cancel' then coalesce(cancelled_at,now()) else cancelled_at end
 where id=p_id;
 if p_action='cancel' and g.converted_user_id is not null then
   delete from event_registrations where event_id=g.event_id and user_id=g.converted_user_id;
 end if;
end $$;
revoke all on function public.update_guest_event_preference(uuid,text) from public,anon,authenticated;
grant execute on function public.update_guest_event_preference(uuid,text) to service_role;
