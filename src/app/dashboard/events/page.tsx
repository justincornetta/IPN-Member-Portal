import { redirect } from "next/navigation"
import EventsHub from "./EventsHub"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { ConferenceRecord } from "@/lib/conferences/types"

export default async function EventsPage() {
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
  const eventIds = upcomingRecords.map((event) => event.id)
  let registrations: { event_id: string }[] = []
  let tickets: { event_id: string }[] = []

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Events
        </h1>
        <p className="mt-1 line-clamp-1 max-w-2xl text-sm leading-5 text-zinc-500 sm:mt-2 sm:line-clamp-none sm:leading-6">
          Register for upcoming events and browse past IPN Labs and PsychedelX
          recordings.
        </p>
      </div>

      <EventsHub
        upcomingEvents={upcomingEvents}
        conferences={(conferences ?? []) as ConferenceRecord[]}
        recordings={((recordings ?? []) as EventRecord[]).map((event) => ({
          ...event,
          chat_external_url: null,
        }))}
      />
    </div>
  )
}
