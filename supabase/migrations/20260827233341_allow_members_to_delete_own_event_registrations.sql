drop policy if exists "Users can delete own event registrations"
  on public.event_registrations;

create policy "Users can delete own event registrations"
  on public.event_registrations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
