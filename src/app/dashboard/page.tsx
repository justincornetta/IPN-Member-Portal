import Link from "next/link"
import type { ReactNode } from "react"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { DirectoryMapCity, DirectoryMapMember } from "@/lib/directory/types"
import type { ConferenceRecord } from "@/lib/conferences/types"
import { resolveDirectoryMapState } from "@/lib/directory/location"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import UpcomingEventsCarousel from "./UpcomingEventsCarousel"
import ActivationChecklist from "./ActivationChecklist"
import ProductTourLauncher from "@/components/product-tour/ProductTourLauncher"
import { getProfileCompletion } from "./profile/profile-completion"

type MemberProfile = {
  first_name: string | null
  persona: string | null
  affiliation: string | null
  school: string | null
  field: string | null
  avatar_url: string | null
  bio: string | null
  interest_tags: string[] | null
  role_and_goals: string | null
  inspiration: string | null
  linkedin_url: string | null
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
            data-analytics-event="curated_click"
            data-analytics-id={`dashboard-explore-${feature.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
            data-analytics-label={feature.title}
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date().toISOString()
  const [profileResult, educationResult, upcomingResult, conferenceResult, memberCountResult, mapRowsResult, onboardingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, persona, affiliation, school, field, avatar_url, bio, interest_tags, role_and_goals, inspiration, linkedin_url")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("member_education")
      .select("institution")
      .eq("user_id", user!.id),
    supabase
      .from("events")
      .select("*", { count: "exact" })
      .eq("status", "published")
      .eq("is_recording", false)
      .or(`starts_at.gte.${now},ends_at.gte.${now}`)
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("conferences")
      .select("id, slug, name, organizer, category, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status")
      .eq("status", "published")
      .gte("ends_at", now)
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
        "profile_completed_at, whatsapp_current_step, whatsapp_completed_at, connection_request_completed_at, invite_completed_at, event_rsvp_completed_at",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data as MemberProfile | null
  const onboardingProgress = onboardingResult.data as OnboardingProgress | null
  const profileCompletion = getProfileCompletion({
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? "",
    role: profile?.persona ?? "",
    affiliation: profile?.affiliation ?? "",
    legacySchool: profile?.school ?? "",
    educationInstitutions: (educationResult.data ?? []).map((entry) => entry.institution ?? ""),
    interests: profile?.interest_tags ?? [],
    roleAndGoals: profile?.role_and_goals ?? "",
    inspiration: profile?.inspiration ?? "",
    supportNeeds: typeof user?.user_metadata?.support_needs === "string"
      ? user.user_metadata.support_needs
      : "",
    linkedinUrl: profile?.linkedin_url ?? "",
    linkedinOptOut: user?.user_metadata?.linkedin_opt_out === true,
  })
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
  const upcomingEvents: EventWithRegistration[] = rawUpcomingEvents.map((event) => {
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

  const firstName = profile?.first_name ?? user!.email?.split("@")[0] ?? "there"
  const subtitle = [profile?.persona, profile?.affiliation ?? profile?.school]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 data-tour-page="dashboard" className="text-2xl font-semibold text-zinc-900">
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
        <div className="flex flex-wrap items-center gap-2">
          <ProductTourLauncher />
          <div className="hidden sm:block">
            <InviteFriendsCard id="invite-friends" variant="header" trackOnboardingInvite />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.85fr)]">
        <UpcomingEventsCarousel
          className="order-1 h-full"
          events={upcomingEvents}
          conferences={(conferenceResult.data ?? []) as ConferenceRecord[]}
          totalCount={upcomingResult.count ?? upcomingEvents.length}
        />
        <div className="order-2 h-full">
          <ActivationChecklist
            progress={onboardingProgress}
            profileCompletedCount={profileCompletion.completedCount}
            profileTotalCount={profileCompletion.totalCount}
          />
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
