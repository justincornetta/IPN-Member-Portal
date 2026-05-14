-- ============================================================
-- IPN Member Portal — Supabase schema
-- Run this in the Supabase SQL Editor (project → SQL Editor → New query)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible
-- ============================================================


-- ── 1. Profiles table ───────────────────────────────────────

create table if not exists public.profiles (
  id                        uuid primary key references auth.users on delete cascade,
  first_name                text,
  last_name                 text,
  affiliation               text,
  country                   text,
  state                     text,
  city                      text,
  persona                   text,
  field                     text,
  psychedelic_field_status  text,
  psychedelic_field_barriers text[],
  role_and_goals            text,
  inspiration               text,
  referral_source           text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);


-- ── 2. Row-Level Security ────────────────────────────────────

alter table public.profiles enable row level security;

-- Users can only read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can only edit their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Needed so the trigger (which runs as the user) can insert
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ── 3. Auto-create profile on signup ────────────────────────
--
-- When a user registers, signUp() passes all form fields into
-- user_metadata. This trigger copies them into profiles so the
-- data is queryable as a proper table row from day one.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    affiliation,
    country,
    state,
    city,
    persona,
    field,
    psychedelic_field_status,
    psychedelic_field_barriers,
    role_and_goals,
    inspiration,
    referral_source
  ) values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'persona',
    new.raw_user_meta_data->>'field',
    new.raw_user_meta_data->>'psychedelic_field_status',
    case
      when new.raw_user_meta_data ? 'psychedelic_field_barriers'
      then array(
        select jsonb_array_elements_text(
          new.raw_user_meta_data->'psychedelic_field_barriers'
        )
      )
      else null
    end,
    new.raw_user_meta_data->>'role_and_goals',
    new.raw_user_meta_data->>'inspiration',
    new.raw_user_meta_data->>'referral_source'
  );
  return new;
end;
$$;

-- Drop and recreate trigger so re-running this file is safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
