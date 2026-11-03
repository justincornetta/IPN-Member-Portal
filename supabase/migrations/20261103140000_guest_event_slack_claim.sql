-- Server-only guest table; existing RLS and grants remain unchanged.
-- A claim is retained after an uncertain Slack response to avoid duplicates.
alter table public.guest_event_registrations add column slack_notification_claimed_at timestamptz;
-- Do not announce historical RSVPs when somebody resubmits the form.
update public.guest_event_registrations set slack_notification_claimed_at=now();
