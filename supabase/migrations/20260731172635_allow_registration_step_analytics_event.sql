-- The registration UI emits this event as soon as each step is displayed.
-- Keep the database allowlist aligned so step-level funnel events are stored.

alter table public.portal_analytics_events
  drop constraint if exists portal_analytics_events_event_name_check;

alter table public.portal_analytics_events
  add constraint portal_analytics_events_event_name_check check (
    event_name in (
      'page_view',
      'page_duration',
      'session_summary',
      'curated_click',
      'registration_view',
      'registration_step_view',
      'registration_submit',
      'registration_success',
      'registration_error',
      'sign_in_view',
      'sign_in_submit',
      'sign_in_success',
      'sign_in_error',
      'event_rsvp_created',
      'event_rsvp_cancelled',
      'whatsapp_profile_linked',
      'whatsapp_cta_clicked'
    )
  );
