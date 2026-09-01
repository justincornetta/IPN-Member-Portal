import { createClient } from "@/lib/supabase/server"
import type {
  ConferenceAttendee,
  ConferenceMeetupAttendanceState,
  ConferenceRecord,
  PastConferenceRecord,
} from "./types"

const CONFERENCE_SELECT =
  "id, slug, name, organizer, category, cover_image_url, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status"

export async function listPublishedConferences(): Promise<ConferenceRecord[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conferences")
    .select(CONFERENCE_SELECT)
    .eq("status", "published")
    .order("starts_at", { ascending: true })

  return (data ?? []) as ConferenceRecord[]
}

export async function listPastConferences(): Promise<PastConferenceRecord[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("past_conferences")
    .select("id, name, organizer, category, cover_image_url, starts_at, ends_at, city, state, country, summary, drive_folder_url")
    .order("starts_at", { ascending: false })

  return (data ?? []) as PastConferenceRecord[]
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
      .select(
        "id, first_name, last_name, avatar_url, school, affiliation, field, city, state, country, bio, interest_tags, linkedin_url, persona, admin_role, team",
      )
      .in("id", visibleIds)

    visibleAttendees = (profiles ?? []) as ConferenceAttendee[]
  }

  return {
    isGoing: Boolean(own),
    isVisible: own?.is_visible ?? true,
    visibleAttendees,
  }
}

export async function getMeetupAttendeeStates(
  conferenceId: string,
  userId: string,
  meetupIds: string[],
): Promise<Record<string, ConferenceMeetupAttendanceState>> {
  if (meetupIds.length === 0) return {}

  const supabase = await createClient()
  const [{ data: rsvpRows }, { data: countRows }] = await Promise.all([
    supabase
    .from("conference_meetup_rsvps")
      .select("meetup_id, user_id, is_visible")
    .eq("conference_id", conferenceId)
      .in("meetup_id", meetupIds),
    supabase.rpc("get_conference_meetup_attendance_counts", {
      target_conference_id: conferenceId,
    }),
  ])

  const rows = rsvpRows ?? []
  const visibleIds = [...new Set(
    rows.filter((row) => row.is_visible).map((row) => row.user_id),
  )]

  let visibleAttendees: ConferenceAttendee[] = []
  if (visibleIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, avatar_url, school, affiliation, field, city, state, country, bio, interest_tags, linkedin_url, persona, admin_role, team",
      )
      .in("id", visibleIds)

    visibleAttendees = (profiles ?? []) as ConferenceAttendee[]
  }

  const profileMap = new Map(visibleAttendees.map((attendee) => [attendee.id, attendee]))
  const typedCountRows = (countRows ?? []) as Array<{ meetup_id: string; total_count: number | string | null }>
  const countMap = new Map<string, number>(
    typedCountRows.map((row) => [
      row.meetup_id,
      Number(row.total_count ?? 0),
    ]),
  )

  return Object.fromEntries(meetupIds.map((meetupId): [string, ConferenceMeetupAttendanceState] => {
    const meetupRows = rows.filter((row) => row.meetup_id === meetupId)
    const own = meetupRows.find((row) => row.user_id === userId)
    const attendees = meetupRows
      .filter((row) => row.is_visible)
      .map((row) => profileMap.get(row.user_id))
      .filter((attendee): attendee is ConferenceAttendee => Boolean(attendee))

    return [meetupId, {
      isGoing: Boolean(own),
      isVisible: own?.is_visible ?? true,
      totalCount: countMap.get(meetupId) ?? meetupRows.length,
      visibleAttendees: attendees,
    }]
  }))
}
