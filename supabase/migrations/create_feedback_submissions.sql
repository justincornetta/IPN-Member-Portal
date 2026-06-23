create table if not exists public.feedback_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete set null,
  user_name   text,
  user_email  text,
  page        text,
  type        text not null
    check (type in ('bug', 'feedback', 'suggestion')),
  message     text not null,
  status      text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists feedback_submissions_status_created_at_idx
  on public.feedback_submissions (status, created_at desc);

create index if not exists feedback_submissions_created_at_idx
  on public.feedback_submissions (created_at desc);

alter table public.feedback_submissions enable row level security;

drop policy if exists "Users can submit own feedback" on public.feedback_submissions;
create policy "Users can submit own feedback"
  on public.feedback_submissions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Superadmins can view feedback" on public.feedback_submissions;
create policy "Superadmins can view feedback"
  on public.feedback_submissions for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'superadmin'
    )
  );

drop policy if exists "Superadmins can update feedback" on public.feedback_submissions;
create policy "Superadmins can update feedback"
  on public.feedback_submissions for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'superadmin'
    )
  );

drop policy if exists "Superadmins can delete feedback" on public.feedback_submissions;
create policy "Superadmins can delete feedback"
  on public.feedback_submissions for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'superadmin'
    )
  );

grant select, insert, update, delete on public.feedback_submissions to authenticated;
