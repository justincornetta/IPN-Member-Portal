create index if not exists events_recordings_published_at_idx
  on public.events (status, is_recording, recording_published_at desc, starts_at desc);
