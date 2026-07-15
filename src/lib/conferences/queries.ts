import { createClient } from "@/lib/supabase/server"
import type { ConferenceAttendee, ConferenceRecord } from "./types"

const CONFERENCE_SELECT =
  "id, slug, name, organizer, category, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status"

export async function listPublishedConferences(): Promise<ConferenceRecord[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conferences")
    .select(CONFERENCE_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: true })

  return (data ?? []) as ConferenceRecord[]
}

export async function getConferenceBySlug(slug: string): Promise<ConferenceRecord | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conferences")
    .select(CONFERENCE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  return (data as ConferenceRecord | null) ?? null
}

/**
 * RLS on conference_rsvps only returns rows that are visible to everyone
 * plus the caller's own row, so this never sees the true total — use
 * conferences.rsvp_count (trigger-maintained) for the headcount instead.
 */
export async function getConferenceAttendeeState(
  conferenceId: string,
  currentUserId: string,
): Promise<{ isGoing: boolean; isVisible: boolean; visibleAttendees: ConferenceAttendee[] }> {
  const supabase = await createClient()

  const { data: rsvpRows } = await supabase
    .from("conference_rsvps")
    .select("user_id, is_visible")
    .eq("conference_id", conferenceId)

  const rows = rsvpRows ?? []
  const own = rows.find((row) => row.user_id === currentUserId)
  const visibleIds = rows.filter((row) => row.is_visible).map((row) => row.user_id)

  let visibleAttendees: ConferenceAttendee[] = []
  if (visibleIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, school, persona")
      .in("id", visibleIds)

    visibleAttendees = (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "IPN member",
      avatarUrl: profile.avatar_url,
      school: profile.school,
      persona: profile.persona,
    }))
  }

  return {
    isGoing: Boolean(own),
    isVisible: own?.is_visible ?? true,
    visibleAttendees,
  }
}
