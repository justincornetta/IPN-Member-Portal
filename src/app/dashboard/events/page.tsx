import { DataReadError } from "@/lib/data-read-error"
import PageLoadError from "@/components/navigation/PageLoadError"
import { redirect } from "next/navigation"
import Link from "next/link"
import EventsHub from "./EventsHub"
import { createClient } from "@/lib/supabase/server"
import { loadEventsHub } from "@/lib/events/load-hub"

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

  const data = await loadEventsHub(supabase, user, showingRecordings).catch(error => {
    if (error instanceof DataReadError) return null
    throw error
  })
  if (!data) return <PageLoadError title="Events" />

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

      <EventsHub {...data} />
    </div>
  )
}
