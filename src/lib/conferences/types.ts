// Admin-beta Conferences feature. Backed by real Supabase tables — see
// supabase/migrations/20260710120000_create_conferences.sql for schema + RLS.

export type ConferenceCategory = "Academic" | "Industry" | "Community" | "Harm Reduction"
export type ConferenceStatus = "draft" | "published" | "archived"

export type ConferenceMeetup = {
  title: string
  type: string
  startsAt: string
  location: string | null
  description: string | null
  registrationUrl: string | null
}

export type ConferenceDiscount = {
  label: string
  code: string | null
  url: string | null
  description: string | null
  expiresAt: string | null
}

export type ConferenceRecord = {
  id: string
  slug: string
  name: string
  organizer: string | null
  category: ConferenceCategory
  summary: string | null
  description: string | null
  starts_at: string
  ends_at: string
  timezone: string
  city: string | null
  state: string | null
  country: string | null
  venue: string | null
  website_url: string | null
  registration_url: string | null
  whatsapp_url: string | null
  meetups: ConferenceMeetup[]
  discounts: ConferenceDiscount[]
  rsvp_count: number
  status: ConferenceStatus
}

export type ConferenceAttendee = {
  id: string
  name: string
  avatarUrl: string | null
  school: string | null
  persona: string | null
}
