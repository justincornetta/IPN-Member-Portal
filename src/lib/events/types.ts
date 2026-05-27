export type EventRecord = {
  id: string
  slug: string
  title: string
  event_type: string
  starts_at: string
  ends_at: string | null
  timezone: string
  summary: string | null
  description: string | null
  speakers: string | null
  location_label: string | null
  location_details: string | null
  join_url: string | null
  thumbnail_url: string | null
  is_recording: boolean
  recording_url: string | null
  recording_provider: string | null
  recording_category: string | null
  recording_source_id: string | null
  recording_published_at: string | null
  status: string
  registration_count: number
}

export type EventWithRegistration = EventRecord & {
  is_registered: boolean
}
