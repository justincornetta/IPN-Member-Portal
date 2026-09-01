import { redirect } from "next/navigation"
import Link from "next/link"
import EventsHub from "./EventsHub"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { ConferenceRecord } from "@/lib/conferences/types"

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const showingRecordings = tab === "recordings"
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const now = new Date().toISOString()
  const [{ data: upcoming }, { data: recordings }, { data: conferences }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("is_recording", false)
      .or(`starts_at.gte.${now},ends_at.gte.${now}`)
      .order("starts_at", { ascending: true }),
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("is_recording", true)
      .order("recording_published_at", { ascending: false, nullsFirst: false })
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true }),
    supabase
      .from("conferences")
      .select("id, slug, name, organizer, category, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status")
      .eq("status", "published")
      .gte("ends_at", now)
      .order("starts_at", { ascending: true }),
  ])

  const upcomingRecords = (upcoming ?? []) as EventRecord[]
  const conferenceRecords = (conferences ?? []) as ConferenceRecord[]
  const eventIds = upcomingRecords.map((event) => event.id)
  const conferenceIds = conferenceRecords.map((conference) => conference.id)
  let registrations: { event_id: string }[] = []
  let tickets: { event_id: string }[] = []
  let registeredMeetupIds: string[] = []

  if (eventIds.length) {
    const { data } = await supabase
      .from("event_registrations")
      .select("event_id")
      .eq("user_id", user.id)
      .in("event_id", eventIds)
    registrations = (data ?? []) as { event_id: string }[]

    if (user.email) {
      const { data: ticketRows } = await supabase
        .from("event_ticket_access")
        .select("event_id")
        .in("event_id", eventIds)
        .eq("attendee_email_normalized", user.email.trim().toLowerCase())
      tickets = (ticketRows ?? []) as { event_id: string }[]
    }
  }

  if (conferenceIds.length) {
    const { data: meetupRsvps } = await supabase
      .from("conference_meetup_rsvps")
      .select("meetup_id")
      .eq("user_id", user.id)
      .in("conference_id", conferenceIds)

    registeredMeetupIds = (meetupRsvps ?? []).map((row) => row.meetup_id)
  }

  const registeredIds = new Set(
    registrations.map((registration) => registration.event_id),
  )
  const ticketIds = new Set(tickets.map((ticket) => ticket.event_id))

  const upcomingEvents: EventWithRegistration[] = upcomingRecords.map((event) => {
    const withRegistration = withTicketRegistrationState(
      event,
      registeredIds.has(event.id),
      ticketIds.has(event.id),
    )
    return {
      ...withRegistration,
      chat_external_url:
        withRegistration.chat_platform === "whatsapp"
        && withRegistration.chat_status === "active"
        && withRegistration.chat_external_url
          ? "available"
          : null,
    }
  })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-zinc-900">
            {showingRecordings ? "Recordings" : "Events"}
          </h1>
          <Link
            href={showingRecordings ? "/dashboard/events" : "/dashboard/events?tab=recordings"}
            className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-ipn hover:underline sm:min-h-0 sm:text-sm"
          >
            {showingRecordings ? "Upcoming events" : "Browse past recordings"}
            <span aria-hidden="true" className="ml-2 text-lg leading-none">→</span>
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {showingRecordings
            ? "Watch past IPN Labs and PsychedelX sessions from the member portal."
            : "Browse, RSVP to, and join upcoming IPN Labs and community events, or explore past events."}
        </p>
      </div>

      <EventsHub
        upcomingEvents={upcomingEvents}
        conferences={conferenceRecords}
        registeredMeetupIds={registeredMeetupIds}
        recordings={((recordings ?? []) as EventRecord[]).map((event) => ({
          ...event,
          chat_external_url: null,
        }))}
      />
    </div>
  )
}
