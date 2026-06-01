export type EventSpeakerPaper = {
  title: string
  url?: string | null
  citation?: string | null
  note?: string | null
}

export type EventSpeakerResource = {
  title: string
  url?: string | null
  source?: string | null
  note?: string | null
}

export type EventSpeakerLinkType =
  | "website"
  | "email"
  | "profile"
  | "social"
  | "other"

export type EventSpeakerLink = {
  label: string
  url?: string | null
  type?: EventSpeakerLinkType | null
}

export type EventSpeakerResources = {
  papers?: EventSpeakerPaper[] | null
  resources?: EventSpeakerResource[] | null
  speakerLinks?: EventSpeakerLink[] | null
}

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
  speaker_resources: EventSpeakerResources | null
  status: string
  registration_count: number
}

export type EventWithRegistration = EventRecord & {
  is_registered: boolean
}
