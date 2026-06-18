import Link from "next/link"
import type { ReactNode } from "react"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import WhatsAppCommunityCard from "@/components/community/WhatsAppCommunityCard"
import { createClient } from "@/lib/supabase/server"
import { formatEventDateTime } from "@/lib/events/calendar"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { ResourceRecord } from "@/lib/resources/types"
import WelcomeModal from "./WelcomeModal"
import UpcomingEventsCarousel from "./UpcomingEventsCarousel"

type MemberProfile = {
  first_name: string | null
  persona: string | null
  affiliation: string | null
  school: string | null
  field: string | null
  bio: string | null
}

type QuickActionCardProps = {
  title: string
  body: string
  href: string
  icon: ReactNode
  cta: string
}

function profileCompletion(profile: MemberProfile | null) {
  const checks = [
    Boolean(profile?.first_name),
    Boolean(profile?.persona),
    Boolean(profile?.affiliation ?? profile?.school),
    Boolean(profile?.field),
    Boolean(profile?.bio),
  ]
  const completeCount = checks.filter(Boolean).length
  const percent = Math.round((completeCount / checks.length) * 100)

  return {
    completeCount,
    percent,
    isComplete: completeCount === checks.length,
  }
}

function ResourceIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  )
}

function DirectoryIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M8 5.14v13.72c0 .6.67.96 1.16.62l10.04-6.86a.75.75 0 0 0 0-1.24L9.16 4.52A.75.75 0 0 0 8 5.14Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
      />
    </svg>
  )
}

function QuickActionCard({ title, body, href, icon, cta }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-ipn/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ipn-light text-ipn">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">
            {title}
          </span>
          <span className="mt-1 block text-sm leading-6 text-zinc-500">
            {body}
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ipn">
            {cta}
            <ArrowIcon />
          </span>
        </span>
      </div>
    </Link>
  )
}

function ResourcePreview({ resources }: { resources: ResourceRecord[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ipn">Resources</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-900">
            Member resources
          </h2>
        </div>
        <Link
          href="/dashboard/resources"
          className="text-sm font-medium text-ipn hover:underline"
        >
          Browse
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {resources.length > 0 ? (
          resources.map((resource) => {
            const href =
              resource.resource_type === "partner"
                ? resource.url
                : `/dashboard/resources/${resource.slug}`
            const content = (
              <span className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                  <ResourceIcon />
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-1 block text-sm font-medium text-zinc-900">
                    {resource.title}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-400">
                    {resource.category}
                  </span>
                </span>
              </span>
            )

            return resource.resource_type === "partner" ? (
              <a
                key={resource.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 transition hover:bg-zinc-50"
              >
                {content}
              </a>
            ) : (
              <Link
                key={resource.id}
                href={href}
                className="rounded-lg p-2 transition hover:bg-zinc-50"
              >
                {content}
              </Link>
            )
          })
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm leading-6 text-zinc-500">
            Benefits, writing, partners, and recordings will appear here as
            they are published.
          </p>
        )}
      </div>
    </section>
  )
}

function DirectoryPreview({ memberCount }: { memberCount: number | null }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ipn">Directory</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-900">
            Find IPN members
          </h2>
        </div>
        <Link
          href="/dashboard/directory"
          className="text-sm font-medium text-ipn hover:underline"
        >
          Search
        </Link>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-500">
        Search by school, field, location, and interests to find collaborators
        and peers across the network.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Field", "School", "Location", "Interests"].map((label) => (
          <span
            key={label}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3">
        <p className="text-2xl font-semibold text-zinc-900">
          {memberCount?.toLocaleString() ?? "Members"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Discoverable member profiles
        </p>
      </div>
    </section>
  )
}

function RecordingsPreview({ recordings }: { recordings: EventRecord[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ipn">Recordings</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-900">
            Watch past sessions
          </h2>
        </div>
        <Link
          href="/dashboard/events"
          className="text-sm font-medium text-ipn hover:underline"
        >
          View
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {recordings.length > 0 ? (
          recordings.map((recording) => (
            <Link
              key={recording.id}
              href={`/dashboard/events/${recording.slug}`}
              className="flex items-start gap-3 rounded-lg p-2 transition hover:bg-zinc-50"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <PlayIcon />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm font-medium leading-snug text-zinc-900">
                  {recording.title}
                </span>
                <span className="mt-1 line-clamp-1 block text-xs text-zinc-400">
                  {recording.event_type} ·{" "}
                  {formatEventDateTime(
                    recording.recording_published_at ?? recording.starts_at,
                    null,
                    recording.timezone,
                  )}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm leading-6 text-zinc-500">
            Past IPN Labs and PsychedelX recordings will appear here once they
            are published.
          </p>
        )}
      </div>
    </section>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const showOnboarding = params.onboarding === "1"
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date().toISOString()
  const [
    profileResult,
    upcomingResult,
    resourcesResult,
    recordingsResult,
    memberCountResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, persona, affiliation, school, field, bio")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("events")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .eq("is_recording", false)
      .or(`starts_at.gte.${now},ends_at.gte.${now}`)
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("resources")
      .select("*")
      .eq("status", "published")
      .in("resource_type", ["affiliate_benefit", "blog_post", "partner"])
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true })
      .limit(3),
    supabase
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("is_recording", true)
      .order("starts_at", { ascending: false })
      .limit(2),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_discoverable", true),
  ])

  const profile = profileResult.data as MemberProfile | null
  const rawUpcomingEvents = (upcomingResult.data ?? []) as EventRecord[]
  const eventIds = rawUpcomingEvents.map((event) => event.id)
  let registrations: { event_id: string }[] = []
  let tickets: { event_id: string }[] = []

  if (eventIds.length) {
    const [registrationResult, ticketResult] = await Promise.all([
      supabase
        .from("event_registrations")
        .select("event_id")
        .eq("user_id", user!.id)
        .in("event_id", eventIds),
      user?.email
        ? supabase
            .from("event_ticket_access")
            .select("event_id")
            .in("event_id", eventIds)
            .eq("attendee_email_normalized", user.email.trim().toLowerCase())
        : Promise.resolve({ data: [] }),
    ])

    registrations = (registrationResult.data ?? []) as { event_id: string }[]
    tickets = (ticketResult.data ?? []) as { event_id: string }[]
  }

  const registeredIds = new Set(
    registrations.map((registration) => registration.event_id),
  )
  const ticketIds = new Set(tickets.map((ticket) => ticket.event_id))
  const upcomingEvents: EventWithRegistration[] = rawUpcomingEvents.map((event) =>
    withTicketRegistrationState(
      event,
      registeredIds.has(event.id),
      ticketIds.has(event.id),
    ),
  )

  const firstName = profile?.first_name ?? user!.email?.split("@")[0] ?? "there"
  const subtitle = [profile?.persona, profile?.affiliation ?? profile?.school]
    .filter(Boolean)
    .join(" · ")
  const completion = profileCompletion(profile)
  const profileActionBody = completion.isComplete
    ? "Keep your role, interests, and contact preferences up to date."
    : `${completion.percent}% complete · add a few details so members can find you.`

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <WelcomeModal userId={user!.id} show={showOnboarding} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {greeting}, {firstName}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Welcome to your IPN member home.
            </p>
          )}
        </div>
        <Link
          href="/dashboard/events"
          className="inline-flex w-fit items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
        >
          See upcoming events
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <UpcomingEventsCarousel
          events={upcomingEvents}
          totalCount={upcomingResult.count ?? upcomingEvents.length}
        />

        <div className="flex flex-col gap-4">
          <WhatsAppCommunityCard compact />
          <QuickActionCard
            title={completion.isComplete ? "Review your profile" : "Complete your profile"}
            body={profileActionBody}
            href="/dashboard/profile"
            icon={<ProfileIcon />}
            cta={completion.isComplete ? "Review profile" : "Finish profile"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InviteFriendsCard variant="compact" />
        <QuickActionCard
          title="Find members"
          body="Search the directory by school, field, location, and interests."
          href="/dashboard/directory"
          icon={<DirectoryIcon />}
          cta="Open directory"
        />
        <QuickActionCard
          title="Browse resources"
          body="Find benefits, partner links, articles, and member-only materials."
          href="/dashboard/resources"
          icon={<ResourceIcon />}
          cta="Browse resources"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ResourcePreview resources={(resourcesResult.data ?? []) as ResourceRecord[]} />
        <DirectoryPreview memberCount={memberCountResult.count} />
        <RecordingsPreview recordings={(recordingsResult.data ?? []) as EventRecord[]} />
      </div>
    </div>
  )
}
