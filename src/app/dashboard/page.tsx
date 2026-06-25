import Link from "next/link"
import type { ReactNode } from "react"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { DirectoryMapCity, DirectoryMapMember } from "@/lib/directory/types"
import { resolveDirectoryMapState } from "@/lib/directory/location"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import WelcomeModal from "./WelcomeModal"
import UpcomingEventsCarousel from "./UpcomingEventsCarousel"

type MemberProfile = {
  first_name: string | null
  persona: string | null
  affiliation: string | null
  school: string | null
  field: string | null
  avatar_url: string | null
  bio: string | null
  interest_tags: string[] | null
}

type ChecklistItemProps = {
  number: number
  title: string
  body: string
  href: string
  icon: ReactNode
  completed?: boolean
  external?: boolean
}

type PortalFeature = {
  title: string
  body: string
  href: string
  icon: ReactNode
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

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.4}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function ChecklistItem({
  number,
  title,
  body,
  href,
  icon,
  completed = false,
  external = false,
}: ChecklistItemProps) {
  const content = (
    <>
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          completed ? "bg-emerald-100 text-emerald-700" : "bg-ipn-light text-ipn"
        }`}
        aria-label={completed ? "Completed" : `Step ${number}`}
      >
        {completed ? <CheckIcon /> : number}
      </span>
      <span className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 sm:inline-flex">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold leading-tight text-zinc-900">{title}</span>
        </span>
        <span className="mt-0.5 hidden line-clamp-2 text-xs leading-snug text-zinc-500 sm:block">{body}</span>
      </span>
      <ArrowIcon />
    </>
  )

  const className =
    "flex min-h-9 items-center gap-3 rounded-lg border border-transparent bg-white px-0 py-1 transition hover:border-ipn/30 hover:bg-zinc-50 sm:min-h-0 sm:border-zinc-200 sm:px-3 sm:py-2"

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

function MemberOnboarding({ progress }: { progress: OnboardingProgress | null }) {
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim()
    || (process.env.NEXT_PUBLIC_WHATSAPP_PHONE?.trim()
      ? `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE!.trim().replace(/\D/g, "")}`
      : undefined)
  const nextStep = [
    {
      title: "Complete your profile",
      href: "/dashboard/profile",
      completed: Boolean(progress?.profile_completed_at),
    },
    {
      title: "Join IPN WhatsApp Community",
      href: whatsappUrl || "/dashboard/community",
      completed: Boolean(progress?.whatsapp_completed_at),
      external: Boolean(whatsappUrl),
    },
    {
      title: "Register for an event",
      href: "/dashboard/events",
      completed: Boolean(progress?.event_rsvp_completed_at),
    },
    {
      title: "Connect with a member",
      href: "/dashboard/directory",
      completed: Boolean(progress?.connection_request_completed_at),
    },
  ].find((step) => !step.completed)
  const completedCount = [
    progress?.profile_completed_at,
    progress?.whatsapp_completed_at,
    progress?.event_rsvp_completed_at,
    progress?.connection_request_completed_at,
    progress?.invite_completed_at,
  ].filter(Boolean).length
  const totalCount = 5

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hidden text-sm font-medium text-ipn sm:block">Get involved</p>
          <h2 className="text-base font-semibold text-zinc-900 sm:mt-1 sm:text-lg">
          Make the most of your membership
          </h2>
        </div>
        <p className="text-xs font-medium text-zinc-500 sm:hidden">
          {completedCount} of {totalCount} completed
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:hidden">
        <div
          className="h-full rounded-full bg-ipn"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {nextStep && (
        <div className="mt-4 hidden rounded-lg border border-ipn/20 bg-ipn/5 p-3 sm:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-ipn">
            Start here
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-900">{nextStep.title}</p>
            {nextStep.external ? (
              <a
                href={nextStep.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-lg bg-ipn px-3 py-2 text-xs font-medium text-white"
              >
                Open
              </a>
            ) : (
              <Link
                href={nextStep.href}
                className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-lg bg-ipn px-3 py-2 text-xs font-medium text-white"
              >
                Continue
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5 sm:mt-4 sm:gap-2">
        <ChecklistItem
          number={1}
          title="Complete your profile"
          body="Add profile picture, bio, and interests."
          href="/dashboard/profile"
          icon={<ProfileIcon />}
          completed={Boolean(progress?.profile_completed_at)}
        />
        <ChecklistItem
          number={2}
          title="Join IPN WhatsApp Community"
          body="Stay updated and connect with members."
          href={whatsappUrl || "/dashboard/community"}
          icon={<WhatsAppIcon />}
          completed={Boolean(progress?.whatsapp_completed_at)}
          external={Boolean(whatsappUrl)}
        />
        <ChecklistItem
          number={3}
          title="Register for an event"
          body="Join the next IPN gathering or webinar."
          href="/dashboard/events"
          icon={<CalendarIcon />}
          completed={Boolean(progress?.event_rsvp_completed_at)}
        />
        <ChecklistItem
          number={4}
          title="Connect with a member"
          body="Send a request to start a connection."
          href="/dashboard/directory"
          icon={<DirectoryIcon />}
          completed={Boolean(progress?.connection_request_completed_at)}
        />
        <InviteFriendsCard
          variant="checklist"
          checklistNumber={5}
          checklistCompleted={Boolean(progress?.invite_completed_at)}
          trackOnboardingInvite
        />
      </div>
    </section>
  )
}

function MiniDirectoryMapPreview({ cities }: { cities: DirectoryMapCity[] }) {
  const projectCity = (city: DirectoryMapCity) => {
    const lng = Math.max(-180, Math.min(180, city.lng))
    const lat = Math.max(-70, Math.min(70, city.lat))
    const rawX = 110 + (lng / 180) * 56
    const rawY = 76 - (lat / 70) * 44
    const dx = rawX - 110
    const dy = rawY - 76
    const distance = Math.hypot(dx, dy)
    const maxDistance = 52
    const scale = distance > maxDistance ? maxDistance / distance : 1

    return {
      x: 110 + dx * scale,
      y: 76 + dy * scale,
      memberCount: city.memberCount,
      cityCount: 1,
      label: city.city,
    }
  }

  const clusters = cities
    .map(projectCity)
    .reduce<Array<ReturnType<typeof projectCity>>>((grouped, point) => {
      const nearby = grouped.find(
        (cluster) => Math.hypot(cluster.x - point.x, cluster.y - point.y) < 18,
      )

      if (!nearby) {
        grouped.push(point)
        return grouped
      }

      const nextMemberCount = nearby.memberCount + point.memberCount
      nearby.x =
        (nearby.x * nearby.memberCount + point.x * point.memberCount) /
        nextMemberCount
      nearby.y =
        (nearby.y * nearby.memberCount + point.y * point.memberCount) /
        nextMemberCount
      nearby.memberCount = nextMemberCount
      nearby.cityCount += 1
      nearby.label = `${nearby.cityCount} cities`

      return grouped
    }, [])
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 8)

  return (
    <div className="relative flex min-h-36 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 220 150"
        role="img"
        aria-label="IPN member locations preview"
      >
        <defs>
          <radialGradient id="mini-directory-globe" cx="40%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="58%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#dfe5ee" />
          </radialGradient>
          <clipPath id="mini-directory-globe-clip">
            <circle cx="110" cy="76" r="60" />
          </clipPath>
        </defs>
        <rect width="220" height="150" fill="#fafafa" />
        <circle
          cx="110"
          cy="76"
          r="60"
          fill="url(#mini-directory-globe)"
          stroke="#d7dce5"
          strokeWidth="1"
        />
        <g clipPath="url(#mini-directory-globe-clip)">
          <ellipse
            cx="110"
            cy="76"
            rx="60"
            ry="20"
            fill="none"
            stroke="#cfd6e1"
            strokeWidth="1"
            opacity="0.72"
          />
          <ellipse
            cx="110"
            cy="76"
            rx="60"
            ry="40"
            fill="none"
            stroke="#d8dee8"
            strokeWidth="1"
            opacity="0.72"
          />
          <ellipse
            cx="110"
            cy="76"
            rx="40"
            ry="60"
            fill="none"
            stroke="#d8dee8"
            strokeWidth="1"
            opacity="0.72"
          />
          <ellipse
            cx="110"
            cy="76"
            rx="20"
            ry="60"
            fill="none"
            stroke="#d8dee8"
            strokeWidth="1"
            opacity="0.72"
          />
          <path d="M50 76h120M110 16v120" stroke="#cfd6e1" strokeWidth="1" opacity="0.7" />
          <g fill="#dce2eb" stroke="#ffffff" strokeLinejoin="round" strokeWidth="0.9">
            <path
              d="M53 55c3-11 12-18 25-21 11-3 25-1 33 6 5 5 3 12-5 15-7 3-11 8-17 13-7 6-17 6-27 1-7-4-11-8-9-14Z"
              opacity="0.9"
            />
            <path
              d="M79 75c8 0 16 4 19 11 3 8-1 16-6 24-4 6-6 13-9 19-8-6-11-15-9-25 2-8-4-16 0-23 1-3 2-5 5-6Z"
              opacity="0.82"
            />
            <path
              d="M114 46c7-6 18-8 29-5 5 1 9 4 13 8-8 6-19 6-29 5-6-1-10-2-13-8Z"
              opacity="0.86"
            />
            <path
              d="M122 60c10-4 22 0 29 9 8 11 5 25-2 37-7 2-17-3-22-11-5-7-11-13-9-23 1-5 1-9 4-12Z"
              opacity="0.82"
            />
            <path
              d="M145 50c11-14 30-17 46-8 14 8 19 21 13 35-12 3-24-1-36-8-10-6-18-5-28-4-1-6 0-11 5-15Z"
              opacity="0.8"
            />
            <path
              d="M159 103c8-5 21-4 28 2 3 3 2 7-2 10-8 5-19 5-28 1-5-3-4-9 2-13Z"
              opacity="0.8"
            />
            <path
              d="M191 111c3-2 7-1 9 1-1 4-4 6-8 5-3-1-3-4-1-6Z"
              opacity="0.75"
            />
          </g>
          <g fill="none" stroke="#c6cedb" strokeWidth="0.8" opacity="0.55">
            <path d="M92 41c-5 7-5 14 0 21" />
            <path d="M134 56c-4 15-2 29 8 42" />
            <path d="M166 48c4 9 4 16-1 23" />
          </g>
        </g>
        {clusters.map((cluster) => {
          const radius = Math.min(13, 7 + Math.sqrt(cluster.memberCount) * 1.8)
          const label = `${cluster.label}: ${cluster.memberCount} member${cluster.memberCount === 1 ? "" : "s"}`
          return (
            <g
              key={`${cluster.x}-${cluster.y}`}
              transform={`translate(${cluster.x} ${cluster.y})`}
              role="img"
              aria-label={label}
            >
              <circle r={radius + 4} fill="rgba(102,79,161,0.22)" />
              <circle r={radius} fill="#664fa1" stroke="white" strokeWidth="2" />
              <text
                y="4"
                textAnchor="middle"
                className="select-none fill-white text-[9px] font-bold"
              >
                {cluster.memberCount}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function buildDirectoryMapCities(rows: DirectoryMapMember[]) {
  const cityMap = new Map<string, DirectoryMapCity>()

  for (const row of rows) {
    if (!row.city || row.city_lat == null || row.city_lng == null) continue

    const lat = Number(row.city_lat)
    const lng = Number(row.city_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const member = {
      ...row,
      city_lat: lat,
      city_lng: lng,
    }
    const displayState = resolveDirectoryMapState(member)

    const id = [
      row.city.trim().toLowerCase(),
      row.country?.trim().toLowerCase() ?? "",
      lat.toFixed(2),
      lng.toFixed(2),
    ].join(":")

    const existing = cityMap.get(id)
    if (existing) {
      existing.members.push({ ...member, state: existing.state })
      existing.memberCount += 1
    } else {
      cityMap.set(id, {
        id,
        city: row.city,
        state: displayState,
        country: row.country,
        lat,
        lng,
        memberCount: 1,
        members: [{ ...member, state: displayState }],
      })
    }
  }

  return [...cityMap.values()].sort((a, b) => b.memberCount - a.memberCount)
}

function DirectoryPreview({
  memberCount,
  mapCities,
}: {
  memberCount: number | null
  mapCities: DirectoryMapCity[]
}) {
  const countryCount = new Set(
    mapCities.map((city) => city.country).filter(Boolean),
  ).size

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ipn">Directory</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">
            Find IPN members
          </h2>
        </div>
        <Link
          href="/dashboard/directory?view=map"
          className="inline-flex min-h-11 items-center text-sm font-medium text-ipn hover:underline sm:min-h-0"
        >
          Search
        </Link>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
        <div className="min-w-0">
          <p className="text-sm leading-6 text-zinc-500">
            Search by school, field, location, and interests to find collaborators
            and peers across the network.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 px-3 py-3">
            <span>
              <span className="block text-lg font-semibold text-zinc-900">
                {memberCount?.toLocaleString() ?? "-"}
              </span>
              <span className="text-[11px] text-zinc-400">Members</span>
            </span>
            <span>
              <span className="block text-lg font-semibold text-zinc-900">
                {mapCities.length.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-400">Cities</span>
            </span>
            <span>
              <span className="block text-lg font-semibold text-zinc-900">
                {countryCount.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-400">Countries</span>
            </span>
          </div>
        </div>
        <Link href="/dashboard/directory?view=map" className="block">
          <MiniDirectoryMapPreview cities={mapCities} />
        </Link>
      </div>
    </section>
  )
}

function ExplorePortal() {
  const features: PortalFeature[] = [
    {
      title: "Member Benefits",
      body: "Training discounts and member-only resources.",
      href: "/dashboard/resources?tab=benefits",
      icon: <ResourceIcon />,
    },
    {
      title: "Event Recordings",
      body: "Past IPN Labs and PsychedelX sessions.",
      href: "/dashboard/events?tab=recordings",
      icon: <CalendarIcon />,
    },
    {
      title: "IPN Blog",
      body: "Writing from the IPN network.",
      href: "/dashboard/resources?tab=blog",
      icon: <ResourceIcon />,
    },
    {
      title: "IPN Partners",
      body: "Organizations connected to the network.",
      href: "/dashboard/resources?tab=partners",
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
  const [profileResult, upcomingResult, memberCountResult, mapRowsResult, onboardingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, persona, affiliation, school, field, avatar_url, bio, interest_tags")
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
    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, persona, school, affiliation, field, city, state, country, city_lat, city_lng, bio, interest_tags, linkedin_url, avatar_url, admin_role, team",
      )
      .eq("is_discoverable", true)
      .eq("share_location", true)
      .not("city", "is", null)
      .not("city_lat", "is", null)
      .not("city_lng", "is", null)
      .order("first_name", { ascending: true })
      .limit(500),
    supabase
      .from("member_onboarding_progress")
      .select(
        "profile_completed_at, whatsapp_completed_at, connection_request_completed_at, invite_completed_at, event_rsvp_completed_at",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data as MemberProfile | null
  const onboardingProgress = onboardingResult.data as OnboardingProgress | null
  const mapCities = buildDirectoryMapCities(
    (mapRowsResult.data ?? []) as DirectoryMapMember[],
  )
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
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
      <WelcomeModal userId={user!.id} show={showOnboarding} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Welcome, {firstName}
          </h1>
          {subtitle ? (
            <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{subtitle}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Thanks for being part of IPN.
            </p>
          )}
        </div>
        <div className="hidden sm:block">
          <InviteFriendsCard id="invite-friends" variant="header" trackOnboardingInvite />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.85fr)]">
        <UpcomingEventsCarousel
          className="order-1 self-start"
          events={upcomingEvents}
          totalCount={upcomingResult.count ?? upcomingEvents.length}
        />
        <div className="order-2">
          <MemberOnboarding progress={onboardingProgress} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DirectoryPreview
          memberCount={memberCountResult.count}
          mapCities={mapCities}
        />
        <ExplorePortal />
      </div>
    </div>
  )
}
