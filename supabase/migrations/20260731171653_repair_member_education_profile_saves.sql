-- Repair the member education schema that the profile UI already depends on.
-- This migration is intentionally idempotent because the original education
-- migrations were skipped in production while later analytics migrations ran.

alter table public.profiles
  add column if not exists referral_source_other text;

create table if not exists public.member_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null check (length(btrim(institution)) > 0),
  education_level text check (
    education_level is null or education_level in (
      'high_school',
      'undergraduate',
      'graduate',
      'professional_degree',
      'certificate',
      'other'
    )
  ),
  degree_credential text,
  area_of_study text,
  status text check (status is null or status in ('currently_enrolled', 'completed')),
  graduation_year integer check (
    graduation_year is null or graduation_year between 1900 and 2200
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.member_education is
  'Repeatable education records owned by members and visible through discoverable profiles.';

create index if not exists member_education_user_sort_idx
  on public.member_education (user_id, sort_order, created_at);

create index if not exists member_education_institution_idx
  on public.member_education (lower(institution));

insert into public.member_education (user_id, institution, education_level, sort_order)
select
  profile.id,
  btrim(profile.school),
  case profile.persona
    when 'High school / pre-college' then 'high_school'
    when 'Undergraduate student' then 'undergraduate'
    when 'Graduate student (Master''s or PhD)' then 'graduate'
    when 'Professional degree student (MD, JD, MBA, etc.)' then 'professional_degree'
    else null
  end,
  0
from public.profiles profile
where nullif(btrim(profile.school), '') is not null
  and not exists (
    select 1
    from public.member_education education
    where education.user_id = profile.id
  );

alter table public.member_education enable row level security;

revoke all on table public.member_education from anon, authenticated;
grant select, insert, update, delete on table public.member_education to authenticated;
grant select, insert, update, delete on table public.member_education to service_role;

drop policy if exists "Members can view permitted education records"
  on public.member_education;
create policy "Members can view permitted education records"
  on public.member_education
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.profiles member_profile
      where member_profile.id = member_education.user_id
        and member_profile.is_discoverable = true
    )
  );

drop policy if exists "Members can insert their own education records"
  on public.member_education;
create policy "Members can insert their own education records"
  on public.member_education
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Members can update their own education records"
  on public.member_education;
create policy "Members can update their own education records"
  on public.member_education
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Members can delete their own education records"
  on public.member_education;
create policy "Members can delete their own education records"
  on public.member_education
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
