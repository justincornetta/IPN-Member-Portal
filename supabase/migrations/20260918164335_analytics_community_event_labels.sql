-- Expand the existing superadmin label vocabulary; permissions and rows are unchanged.
alter table public.analytics_event_label_overrides
  drop constraint analytics_event_label_overrides_program_label_check,
  add constraint analytics_event_label_overrides_program_label_check
    check (program_label in ('IPN Labs', 'PsychedelX', 'Community', 'Other'));
