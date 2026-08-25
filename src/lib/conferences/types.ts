// Admin-beta Conferences feature. Backed by real Supabase tables — see
// supabase/migrations/20260710120000_create_conferences.sql for schema + RLS.

import type { DirectoryMember } from "@/lib/directory/types"

export type ConferenceCategory = "Academic" | "Industry" | "Community" | "Harm Reduction"
export type ConferenceStatus = "draft" | "published" | "archived"

export type ConferenceMeetup = {
  id: string
  title: string
  type: string
  startsAt: string
  endsAt?: string | null
  location: string | null
  description: string | null
  notificationMessage?: string | null
}

export type ConferenceDiscount = {
  id: string
  label: string
  code: string | null
  url: string | null
  description: string | null
  notificationMessage?: string | null
  howToApply: string | null
  expiresAt: string | null
}

export type ConferenceRecord = {
  id: string
  slug: string
  name: string
  organizer: string | null
  category: ConferenceCategory
  cover_image_url: string | null
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

// Attendees are rendered through the same profile modal as the member
// directory (see components/directory/MemberProfileModal.tsx), so this is
// the full directory member shape rather than a conference-specific subset.
export type ConferenceAttendee = DirectoryMember

export type PastConferenceRecord = {
  id: string
  name: string
  organizer: string | null
  category: string | null
  cover_image_url: string | null
  starts_at: string | null
  ends_at: string | null
  city: string | null
  state: string | null
  country: string | null
  summary: string | null
  drive_folder_url: string | null
}
