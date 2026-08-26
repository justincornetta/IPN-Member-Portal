import Link from "next/link"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { DirectoryMapCity, DirectoryMapMember } from "@/lib/directory/types"
import type { ConferenceRecord } from "@/lib/conferences/types"
import { resolveDirectoryMapState } from "@/lib/directory/location"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary, isProfileMilestoneComplete } from "./activation-model"
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
  compact = false,
}: {
  memberCount: number | null
  mapCities: DirectoryMapCity[]
  compact?: boolean
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

      <div className={`mt-3 grid gap-4 ${compact ? "" : "md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]"}`}>
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
          {compact && (
            <Link href="/dashboard/directory" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline sm:min-h-0">
              Browse member directory
            </Link>
          )}
        </div>
        {!compact && (
          <Link href="/dashboard/directory?view=map" className="block">
            <MiniDirectoryMapPreview cities={mapCities} />
          </Link>
        )}
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
  const onboardingResultPromise = (async () => {
    const fullResult = await supabase
      .from("member_onboarding_progress")
      .select(
        "profile_completed_at, whatsapp_current_step, whatsapp_completed_at, product_tour_completed_at, connection_request_completed_at, invite_completed_at, event_rsvp_completed_at, getting_started_completed_at, getting_started_success_seen_at",
      )
      .eq("user_id", user!.id)
      .maybeSingle()

    if (!fullResult.error || (fullResult.error.code !== "42703" && !fullResult.error.message.includes("does not exist"))) {
      return fullResult
    }

    const legacyResult = await supabase
      .from("member_onboarding_progress")
      .select(
        "profile_completed_at, whatsapp_current_step, whatsapp_completed_at, product_tour_completed_at, connection_request_completed_at, invite_completed_at, event_rsvp_completed_at",
      )
      .eq("user_id", user!.id)
      .maybeSingle()

    return {
      ...legacyResult,
      data: legacyResult.data
        ? { ...legacyResult.data, getting_started_completed_at: null, getting_started_success_seen_at: null }
        : null,
    }
  })()
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
    onboardingResultPromise,
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
  const profileMilestoneComplete = isProfileMilestoneComplete(
    onboardingProgress?.profile_completed_at,
    profileCompletion.completedCount,
    profileCompletion.totalCount,
  )
  const gettingStartedSummary = activationSummary({
    whatsapp_completed_at: onboardingProgress?.whatsapp_completed_at ?? null,
    whatsapp_current_step: onboardingProgress?.whatsapp_current_step ?? null,
    profile_completed_at: profileMilestoneComplete ? "complete" : null,
    product_tour_completed_at: onboardingProgress?.product_tour_completed_at ?? null,
    event_rsvp_completed_at: onboardingProgress?.event_rsvp_completed_at ?? null,
    connection_request_completed_at: onboardingProgress?.connection_request_completed_at ?? null,
  })
  const gettingStartedComplete = gettingStartedSummary.completedCount === gettingStartedSummary.totalCount
  const showGettingStarted = !gettingStartedComplete || !onboardingProgress?.getting_started_success_seen_at
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

      <UpcomingEventsCarousel
        events={upcomingEvents}
        conferences={(conferenceResult.data ?? []) as ConferenceRecord[]}
        totalCount={upcomingResult.count ?? upcomingEvents.length}
      />

      <div className={`grid grid-cols-1 items-stretch gap-4 ${showGettingStarted ? "xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]" : ""}`}>
        {showGettingStarted && (
          <ActivationChecklist
            progress={onboardingProgress}
            profileCompletedCount={profileCompletion.completedCount}
            profileTotalCount={profileCompletion.totalCount}
          />
        )}
        <DirectoryPreview
          memberCount={memberCountResult.count}
          mapCities={mapCities}
          compact={showGettingStarted}
        />
      </div>
    </div>
  )
}
