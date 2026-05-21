import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import EventCard from "@/components/events/EventCard"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"

type Props = {
  params: Promise<{ slug: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (!event) notFound()

  const eventRecord = event as EventRecord
  const { data: registration } = await supabase
    .from("event_registrations")
    .select("event_id")
    .eq("event_id", eventRecord.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const eventWithRegistration: EventWithRegistration = {
    ...eventRecord,
    is_registered: Boolean(registration),
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/dashboard/events"
        className="text-sm font-medium text-ipn hover:underline"
      >
        Back to events
      </Link>

      <EventCard event={eventWithRegistration} />

      {(eventRecord.description || eventRecord.location_details) && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          {eventRecord.description && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                About this event
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-600">
                {eventRecord.description.split("\n").map((paragraph, index) => (
                  <p key={`${index}-${paragraph}`}>{paragraph}</p>
                ))}
              </div>
            </>
          )}

          {eventRecord.location_details && (
            <div className={eventRecord.description ? "mt-6" : ""}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Location
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {eventRecord.location_details}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
