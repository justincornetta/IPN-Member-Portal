import { redirect } from "next/navigation"
import EventsHub from "./EventsHub"
import { createClient } from "@/lib/supabase/server"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"

export default async function EventsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const now = new Date().toISOString()
  const [{ data: upcoming }, { data: recordings }] = await Promise.all([
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
      .order("starts_at", { ascending: false })
      .order("title", { ascending: true }),
  ])

  const upcomingRecords = (upcoming ?? []) as EventRecord[]
  const eventIds = upcomingRecords.map((event) => event.id)
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

  const upcomingEvents: EventWithRegistration[] = upcomingRecords.map((event) => ({
    ...event,
    is_registered: registeredIds.has(event.id),
  }))

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-medium text-ipn">Events</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Events
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Register for upcoming events and browse past IPN Labs and PsychedelX
          recordings.
        </p>
      </div>

      <EventsHub
        upcomingEvents={upcomingEvents}
        recordings={(recordings ?? []) as EventRecord[]}
      />
    </div>
  )
}
