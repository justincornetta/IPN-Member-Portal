import Link from "next/link"
import type { ReactNode } from "react"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
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

type ChecklistItemProps = {
  number: number
  title: string
  body: string
  href: string
  icon: ReactNode
  status?: string
  external?: boolean
}

type PortalFeature = {
  title: string
  body: string
  href: string
  icon: ReactNode
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

function CalendarIcon() {
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
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.8 9.8 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.9-7.01ZM12.04 20.15h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.54 3.69-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.23 8.24Z" />
    </svg>
  )
}

function InviteIcon() {
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
        d="M18 18.72a8.25 8.25 0 1 0-12 0m12 0a8.217 8.217 0 0 1-6 1.53 8.217 8.217 0 0 1-6-1.53m12 0a5.25 5.25 0 0 0-12 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
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

function ChecklistItem({
  number,
  title,
  body,
  href,
  icon,
  status,
  external = false,
}: ChecklistItemProps) {
  const content = (
    <>
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ipn-light text-xs font-semibold text-ipn">
        {number}
      </span>
      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900">{title}</span>
          {status && <span className="text-xs text-zinc-400">{status}</span>}
        </span>
        <span className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{body}</span>
      </span>
      <ArrowIcon />
    </>
  )

  const className =
    "flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 transition hover:border-ipn/30 hover:bg-zinc-50"

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

function MemberOnboarding({
  completion,
  nextEvent,
}: {
  completion: ReturnType<typeof profileCompletion>
  nextEvent: EventWithRegistration | null
}) {
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim()

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-ipn">Member setup</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">
          Make the portal useful
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <ChecklistItem
          number={1}
          title="Review profile"
          body={
            completion.isComplete
              ? "Keep your member details current."
              : "Add details so members can find you."
          }
          href="/dashboard/profile"
          icon={<ProfileIcon />}
          status={completion.isComplete ? "Done" : `${completion.percent}%`}
        />
        <ChecklistItem
          number={2}
          title="Join WhatsApp"
          body="Connect with members and updates."
          href={whatsappUrl || "/dashboard/community"}
          icon={<WhatsAppIcon />}
          status={whatsappUrl ? "Open" : "Soon"}
          external={Boolean(whatsappUrl)}
        />
        <ChecklistItem
          number={3}
          title="Register for an event"
          body="Start with the next IPN event."
          href={nextEvent ? `/dashboard/events/${nextEvent.slug}` : "/dashboard/events"}
          icon={<CalendarIcon />}
          status={nextEvent ? "Next" : "Browse"}
        />
        <ChecklistItem
          number={4}
          title="Invite friends"
          body="Share IPN with peers who should join."
          href="#invite-friends"
          icon={<InviteIcon />}
          status="Share"
        />
      </div>
    </section>
  )
}

function DirectoryPreview({ memberCount }: { memberCount: number | null }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ipn">Directory</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">
            Find IPN members
          </h2>
        </div>
        <Link href="/dashboard/directory" className="text-sm font-medium text-ipn hover:underline">
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

      <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
        <span>
          <span className="block text-2xl font-semibold text-zinc-900">
            {memberCount?.toLocaleString() ?? "Members"}
          </span>
          <span className="text-xs text-zinc-400">Discoverable profiles</span>
        </span>
        <DirectoryIcon />
      </div>
    </section>
  )
}

function ExplorePortal() {
  const features: PortalFeature[] = [
    {
      title: "Member Benefits",
      body: "Training discounts and member-only resources.",
      href: "/dashboard/resources",
      icon: <ResourceIcon />,
    },
    {
      title: "Event Recordings",
      body: "Past IPN Labs and PsychedelX sessions.",
      href: "/dashboard/events",
      icon: <CalendarIcon />,
    },
    {
      title: "IPN Blog",
      body: "Writing from the IPN network.",
      href: "/dashboard/resources",
      icon: <ResourceIcon />,
    },
    {
      title: "IPN Partners",
      body: "Organizations connected to the network.",
      href: "/dashboard/resources",
      icon: <DirectoryIcon />,
    },
  ]

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-ipn">Portal</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">
          Explore the member portal
        </h2>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {features.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="flex items-start gap-3 rounded-lg border border-zinc-200 px-3 py-3 transition hover:border-ipn/30 hover:bg-zinc-50"
          >
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ipn-light text-ipn">
              {feature.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-900">
                {feature.title}
              </span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500">
                {feature.body}
              </span>
            </span>
          </Link>
        ))}
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
  const [profileResult, upcomingResult, memberCountResult] = await Promise.all([
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

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
      <WelcomeModal userId={user!.id} show={showOnboarding} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
        <InviteFriendsCard id="invite-friends" variant="header" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.85fr)]">
        <UpcomingEventsCarousel
          events={upcomingEvents}
          totalCount={upcomingResult.count ?? upcomingEvents.length}
        />
        <MemberOnboarding
          completion={completion}
          nextEvent={upcomingEvents[0] ?? null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DirectoryPreview memberCount={memberCountResult.count} />
        <ExplorePortal />
      </div>
    </div>
  )
}
