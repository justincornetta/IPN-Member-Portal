-- Run this in Supabase SQL Editor if the member_contacts table is missing.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.

create table if not exists public.member_contacts (
  user_id      uuid primary key references auth.users on delete cascade,
  email        text,
  whatsapp_url text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.member_contacts enable row level security;

drop policy if exists "Users can view own contact details" on public.member_contacts;
create policy "Users can view own contact details"
  on public.member_contacts for select
  using (auth.uid() = user_id);

drop policy if exists "Accepted connections can view contact details" on public.member_contacts;
create policy "Accepted connections can view contact details"
  on public.member_contacts for select
  using (
    exists (
      select 1
      from public.connections
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = member_contacts.user_id)
          or (addressee_id = auth.uid() and requester_id = member_contacts.user_id)
        )
    )
  );

drop policy if exists "Users can insert own contact details" on public.member_contacts;
create policy "Users can insert own contact details"
  on public.member_contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own contact details" on public.member_contacts;
create policy "Users can update own contact details"
  on public.member_contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.member_contacts to authenticated;

-- Backfill existing members
insert into public.member_contacts (user_id, email)
select id, email
from public.profiles
where email is not null
on conflict (user_id) do update
set email = excluded.email,
    updated_at = now();
