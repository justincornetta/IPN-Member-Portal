import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import AddToCalendarButton from "@/components/events/AddToCalendarButton"
import WhatsAppCommunityCard from "@/components/community/WhatsAppCommunityCard"
import { formatEventDateTime, registrationBand } from "@/lib/events/calendar"
import { protectTicketedJoinUrl } from "@/lib/events/tickets"
import type { EventRecord } from "@/lib/events/types"
import WelcomeModal from "./WelcomeModal"

const RESOURCES = [
  {
    id: 1,
    title: "Zendo Project Sitting and Integration Training",
    type: "benefit",
    source: "Member benefit",
  },
  { id: 2, title: "IPN Blog articles", type: "article", source: "IPN Blog" },
  { id: 3, title: "Partners and sponsors", type: "partner", source: "IPN network" },
]

const TYPE_ICON: Record<string, React.ReactNode> = {
  video: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  article: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
    </svg>
  ),
  benefit: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.091-3.091L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.091-3.091L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.091 3.091L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.091 3.091ZM18.25 8.25 18 9.25l-.25-1a2.25 2.25 0 0 0-1.5-1.5l-1-.25 1-.25a2.25 2.25 0 0 0 1.5-1.5l.25-1 .25 1a2.25 2.25 0 0 0 1.5 1.5l1 .25-1 .25a2.25 2.25 0 0 0-1.5 1.5ZM18.25 19.25 18 20.25l-.25-1a2.25 2.25 0 0 0-1.5-1.5l-1-.25 1-.25a2.25 2.25 0 0 0 1.5-1.5l.25-1 .25 1a2.25 2.25 0 0 0 1.5 1.5l1 .25-1 .25a2.25 2.25 0 0 0-1.5 1.5Z" />
    </svg>
  ),
  partner: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a8.25 8.25 0 0 0 3-6.36 8.25 8.25 0 1 0-16.5 0 8.25 8.25 0 0 0 3 6.36m10.5 0A8.217 8.217 0 0 1 12 20.25a8.217 8.217 0 0 1-6-1.53m12 0a5.25 5.25 0 0 0-12 0m12 0a8.198 8.198 0 0 1-6 2.28 8.198 8.198 0 0 1-6-2.28M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  ),
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <p className="text-xs text-zinc-400">{sub}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, persona, affiliation")
    .eq("id", user!.id)
    .single()

  const now = new Date().toISOString()
  const { data: events, count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("is_recording", false)
    .or(`starts_at.gte.${now},ends_at.gte.${now}`)
    .order("starts_at", { ascending: true })
    .limit(3)

  const rawUpcomingEvents = (events ?? []) as EventRecord[]
  let ticketIds = new Set<string>()
  if (rawUpcomingEvents.length && user?.email) {
    const { data: ticketRows } = await supabase
      .from("event_ticket_access")
      .select("event_id")
      .in("event_id", rawUpcomingEvents.map((event) => event.id))
      .eq("attendee_email_normalized", user.email.trim().toLowerCase())

    ticketIds = new Set(
      ((ticketRows ?? []) as { event_id: string }[]).map((ticket) => ticket.event_id),
    )
  }
  const upcomingEvents = rawUpcomingEvents.map((event) =>
    protectTicketedJoinUrl(event, ticketIds.has(event.id)),
  )

  const firstName = profile?.first_name ?? user!.email?.split("@")[0] ?? "there"
  const subtitle = [profile?.persona, profile?.affiliation].filter(Boolean).join(" · ")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-8">
      <WelcomeModal userId={user!.id} />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {greeting}, {firstName}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
        </div>
        <button className="relative rounded-lg border border-zinc-200 bg-white p-2 text-zinc-400 hover:text-zinc-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Upcoming Events"
          value={String(eventCount ?? upcomingEvents.length)}
          sub={
            upcomingEvents[0]
              ? `Next: ${formatEventDateTime(
                  upcomingEvents[0].starts_at,
                  null,
                  upcomingEvents[0].timezone,
                )}`
              : "New events coming soon"
          }
        />
        <StatCard label="Members" value="1,200+" sub="Across 80+ schools" />
        <StatCard
          label="Resources"
          value="20"
          sub="Benefits, writing, and partners"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Events — spans 2 cols on large screens */}
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Upcoming Events</h2>
            <Link
              href="/dashboard/events"
              className="text-xs font-medium text-ipn hover:underline"
            >
              All events →
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <Link
                    href={`/dashboard/events/${event.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                      {event.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-[radial-gradient(circle_at_25%_25%,#a78bfa_0,#664fa1_35%,#18181b_75%)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {event.title}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {formatEventDateTime(event.starts_at, event.ends_at, event.timezone)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex flex-shrink-0 items-center gap-2 sm:ml-2">
                    <span className="text-xs font-medium text-zinc-400">
                      {registrationBand(event.registration_count)}
                    </span>
                    <AddToCalendarButton event={event} compact />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-zinc-400">
                No upcoming events have been added yet.
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <WhatsAppCommunityCard />

          {/* Resources */}
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">Resources</h2>
              <Link
                href="/dashboard/resources"
                className="text-xs font-medium text-ipn hover:underline"
              >
                Browse →
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {RESOURCES.map((r) => (
                <div key={r.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-zinc-400">{TYPE_ICON[r.type]}</span>
                  <div>
                    <p className="text-sm text-zinc-800 leading-snug">{r.title}</p>
                    <p className="text-xs text-zinc-400">{r.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Directory */}
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-800">Member Directory</h2>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-400">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search members…
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-zinc-400">Filter by</p>
              <div className="flex flex-wrap gap-2">
                {["Field", "School", "Location"].map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/dashboard/directory"
              className="text-center rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
            >
              Browse all members →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
