import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import EventCard from "@/components/events/EventCard"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"

export default async function EventsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .or(`starts_at.gte.${now},ends_at.gte.${now}`)
    .order("starts_at", { ascending: true })

  const eventRecords = (events ?? []) as EventRecord[]
  const eventIds = eventRecords.map((event) => event.id)
  let registrations: { event_id: string }[] = []

  if (eventIds.length) {
    const { data } = await supabase
      .from("event_registrations")
      .select("event_id")
      .eq("user_id", user.id)
      .in("event_id", eventIds)
    registrations = (data ?? []) as { event_id: string }[]
  }

  const registeredIds = new Set(
    registrations.map((registration) => registration.event_id),
  )

  const eventsWithRegistration: EventWithRegistration[] = eventRecords.map((event) => ({
    ...event,
    is_registered: registeredIds.has(event.id),
  }))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-medium text-ipn">Events</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Upcoming IPN events
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Register for IPN Lab seminars, PsychedelX programming, and future
          member meetups from one place.
        </p>
      </div>

      {eventsWithRegistration.length > 0 ? (
        <div className="flex flex-col gap-4">
          {eventsWithRegistration.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">
            No upcoming events yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            New IPN events will appear here once the leadership team adds them
            to the portal.
          </p>
        </div>
      )}
    </div>
  )
}
