import { DataReadError } from "../data-read-error.ts"
import type { createClient } from "@/lib/supabase/server"
import type { ConferenceRecord } from "../conferences/types"
import type { EventRecord } from "./types"
import { withTicketRegistrationState } from "./tickets.ts"

type Client = Awaited<ReturnType<typeof createClient>>
function rows<T>(result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error || !result.data) throw new DataReadError("Events could not be loaded")
  return result.data
}

export async function loadEventsHub(supabase: Client, user: { id: string; email?: string }, showingRecordings: boolean, now = new Date().toISOString()) {
  if (showingRecordings) {
    const result = await supabase.from("events").select("*")
      .eq("status", "published").eq("is_recording", true)
      .order("recording_published_at", { ascending: false, nullsFirst: false })
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
    return { upcomingEvents: [], conferences: [], registeredMeetupIds: [],
      recordings: (rows(result) as EventRecord[]).map(event => ({ ...event, chat_external_url: null })) }
  }

  const [upcomingResult, conferenceResult] = await Promise.all([
    supabase.from("events").select("*").eq("status", "published").eq("is_recording", false)
      .or(`starts_at.gte.${now},ends_at.gte.${now}`).order("starts_at", { ascending: true }),
    supabase.from("conferences")
      .select("id, slug, name, organizer, category, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status")
      .eq("status", "published").gte("ends_at", now).order("starts_at", { ascending: true }),
  ])
  const upcoming = rows(upcomingResult) as EventRecord[]
  const conferences = rows(conferenceResult) as ConferenceRecord[]
  const eventIds = upcoming.map(event => event.id), conferenceIds = conferences.map(conference => conference.id)
  // None of these reads depend on another registration lookup.
  const [registrations, tickets, meetups] = await Promise.all([
    eventIds.length ? supabase.from("event_registrations").select("event_id").eq("user_id", user.id).in("event_id", eventIds).then(rows) : [],
    eventIds.length && user.email ? supabase.from("event_ticket_access").select("event_id").in("event_id", eventIds)
      .eq("attendee_email_normalized", user.email.trim().toLowerCase()).then(rows) : [],
    conferenceIds.length ? supabase.from("conference_meetup_rsvps").select("meetup_id").eq("user_id", user.id).in("conference_id", conferenceIds).then(rows) : [],
  ])
  const registeredIds = new Set(registrations.map(row => row.event_id))
  const ticketIds = new Set(tickets.map(row => row.event_id))
  return {
    upcomingEvents: upcoming.map(event => {
      const registered = withTicketRegistrationState(event, registeredIds.has(event.id), ticketIds.has(event.id))
      return { ...registered, chat_external_url: registered.chat_platform === "whatsapp" && registered.chat_status === "active" && registered.chat_external_url ? "available" : null }
    }),
    conferences, registeredMeetupIds: meetups.map(row => row.meetup_id), recordings: [],
  }
}
