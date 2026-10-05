-- Request metadata only. Media assets and receipts remain in Drive/Canva.
create table public.leadership_workflow_settings (
 singleton boolean primary key default true check(singleton),
 expense_approver_id uuid not null references public.profiles(id),
 slack_user_ids jsonb not null default '{}'
);
insert into public.leadership_workflow_settings(singleton, expense_approver_id, slack_user_ids)
values(true, 'a8be2531-9c64-4cd6-b1cd-1a12f8465609', '{"a8be2531-9c64-4cd6-b1cd-1a12f8465609":"U061Z7YC3DX"}');
create table public.leadership_requests (
 id uuid primary key,
 kind text not null check(kind in ('media','expense')),
 requester_id uuid not null references public.profiles(id),
 revision integer not null check(revision > 0),
 data jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((data->>'id')::uuid = id and data->>'kind' = kind and (data->>'requesterId')::uuid = requester_id and (data->>'revision')::integer = revision)
);
create index leadership_requests_owner on public.leadership_requests(requester_id, created_at desc);
create index leadership_requests_kind on public.leadership_requests(kind, created_at desc);
create table public.leadership_request_activity (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.leadership_requests(id),
 actor_id uuid not null references public.profiles(id),
 actor_name text not null,
 event text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
create index leadership_activity_request on public.leadership_request_activity(request_id, created_at);
create table public.leadership_integration_jobs (
 id uuid primary key default gen_random_uuid(),
 dedupe_key text not null unique,
 request_id uuid not null references public.leadership_requests(id),
 target text not null check(target in ('slack_media','slack_expense','slack_dm','sheets')),
 event text not null,
 recipient_id uuid references public.profiles(id),
 payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','working','done')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 last_error text,
 result jsonb,
 created_at timestamptz not null default now()
);
create index leadership_jobs_due on public.leadership_integration_jobs(state, next_attempt_at);
create table public.leadership_bank_activity (
 id text primary key,
 data jsonb not null,
 imported_by uuid not null references public.profiles(id),
 imported_at timestamptz not null default now()
);

alter table public.leadership_workflow_settings enable row level security;
alter table public.leadership_requests enable row level security;
alter table public.leadership_request_activity enable row level security;
alter table public.leadership_integration_jobs enable row level security;
alter table public.leadership_bank_activity enable row level security;
revoke all on public.leadership_workflow_settings, public.leadership_requests, public.leadership_request_activity, public.leadership_integration_jobs, public.leadership_bank_activity from anon, authenticated;
grant select on public.leadership_workflow_settings, public.leadership_requests, public.leadership_request_activity, public.leadership_bank_activity to authenticated;
grant all on public.leadership_workflow_settings, public.leadership_requests, public.leadership_request_activity, public.leadership_integration_jobs, public.leadership_bank_activity to service_role;
create policy leadership_settings_read on public.leadership_workflow_settings for select to authenticated using (
 exists(select 1 from public.profiles p where p.id = (select auth.uid()) and not coalesce(p.is_banned,false) and (p.role='superadmin' or (p.role='admin' and p.team in ('Strategy and Operations','Media','PsychedelX','Community','IPN Labs'))))
);
create policy leadership_requests_read on public.leadership_requests for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and not coalesce(p.is_banned,false) and (p.role='superadmin' or (p.role='admin' and p.team in ('Strategy and Operations','Media','PsychedelX','Community','IPN Labs'))))
 and (kind='media' or requester_id=(select auth.uid()) or exists(select 1 from public.leadership_workflow_settings s where s.expense_approver_id=(select auth.uid())))
);
create policy leadership_activity_read on public.leadership_request_activity for select to authenticated using (exists(select 1 from public.leadership_requests r where r.id=request_id));
create policy leadership_bank_read on public.leadership_bank_activity for select to authenticated using (exists(select 1 from public.leadership_workflow_settings s where s.expense_approver_id=(select auth.uid())));

-- Verified server mutations: snapshot, history and delivery jobs commit together.
create function public.leadership_save_request(p_data jsonb, p_expected_revision integer, p_actor uuid, p_actor_name text, p_event text, p_note text, p_jobs jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare old public.leadership_requests; request_id uuid := (p_data->>'id')::uuid; item jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and not coalesce(is_banned,false) and (role='superadmin' or (role='admin' and team in ('Strategy and Operations','Media','PsychedelX','Community','IPN Labs')))) then raise exception 'Leadership access required' using errcode='42501'; end if;
 select * into old from public.leadership_requests where id=request_id for update;
 if found then
  if old.revision <> p_expected_revision then raise exception 'Request changed; reload before saving' using errcode='40001'; end if;
  if old.kind<>p_data->>'kind' or old.requester_id<>(p_data->>'requesterId')::uuid then raise exception 'Request identity is immutable'; end if;
  if old.kind='expense' then
   if p_actor<>old.requester_id and not exists(select 1 from public.leadership_workflow_settings where expense_approver_id=p_actor) then raise exception 'Expense access denied' using errcode='42501'; end if;
   if p_event in ('approve','reject','reimburse','match','schedule') and not exists(select 1 from public.leadership_workflow_settings where expense_approver_id=p_actor) then raise exception 'Only designated expense approver can perform this action' using errcode='42501'; end if;
  end if;
  update public.leadership_requests set data=p_data, revision=(p_data->>'revision')::integer, updated_at=now() where id=request_id;
 else
  if p_expected_revision<>0 or (p_data->>'requesterId')::uuid<>p_actor then raise exception 'Invalid new request'; end if;
  insert into public.leadership_requests(id,kind,requester_id,revision,data) values(request_id,p_data->>'kind',(p_data->>'requesterId')::uuid,1,p_data);
 end if;
 if (p_data->>'revision')::integer<>p_expected_revision+1 then raise exception 'Invalid revision'; end if;
 insert into public.leadership_request_activity(request_id,actor_id,actor_name,event,note) values(request_id,p_actor,p_actor_name,p_event,coalesce(p_note,''));
 for item in select * from jsonb_array_elements(p_jobs) loop
  insert into public.leadership_integration_jobs(dedupe_key,request_id,target,event,recipient_id,payload)
  values(request_id||':'||(p_data->>'revision')||':'||(item->>'target')||':'||coalesce(item->>'recipientId',''),request_id,item->>'target',p_event,nullif(item->>'recipientId','')::uuid,p_data) on conflict(dedupe_key) do nothing;
 end loop;
 return request_id;
end $$;
revoke all on function public.leadership_save_request(jsonb,integer,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.leadership_save_request(jsonb,integer,uuid,text,text,text,jsonb) to service_role;

create function public.leadership_claim_job(p_id uuid) returns setof public.leadership_integration_jobs language sql security invoker set search_path=public,pg_temp as $$
 update public.leadership_integration_jobs set state='working',attempts=attempts+1,next_attempt_at=now()+interval '2 minutes' where id=p_id and state<>'done' and next_attempt_at<=now() returning *;
$$;
revoke all on function public.leadership_claim_job(uuid) from public,anon,authenticated;
grant execute on function public.leadership_claim_job(uuid) to service_role;

-- A bank debit can settle only one portal request, including concurrent matches.
create unique index leadership_bank_match_unique on public.leadership_requests ((data->'expense'->>'bankTransactionId')) where kind='expense' and coalesce(data->'expense'->>'bankTransactionId','')<>'';
-- Sheets row allocation needs a shared lease across app and scheduled workers.
create table public.leadership_delivery_locks (name text primary key, owner uuid not null, expires_at timestamptz not null);
alter table public.leadership_delivery_locks enable row level security;
revoke all on public.leadership_delivery_locks from anon,authenticated;
grant all on public.leadership_delivery_locks to service_role;
create function public.leadership_acquire_sheet_lock(p_owner uuid) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 insert into public.leadership_delivery_locks(name,owner,expires_at) values('sheets',p_owner,now()+interval '2 minutes')
 on conflict(name) do update set owner=excluded.owner, expires_at=excluded.expires_at where leadership_delivery_locks.expires_at<=now();
 return found;
end $$;
revoke all on function public.leadership_acquire_sheet_lock(uuid) from public,anon,authenticated;
grant execute on function public.leadership_acquire_sheet_lock(uuid) to service_role;
