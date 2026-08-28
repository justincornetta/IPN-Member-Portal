import Link from "next/link"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { DirectoryMapCity, DirectoryMapMember } from "@/lib/directory/types"
import type { ConferenceRecord } from "@/lib/conferences/types"
import { STUDENT_BACKGROUNDS } from "@/lib/constants/registration"
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

function memberSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function selectFeaturedMembers(
  members: DirectoryMapMember[],
  currentUserId: string,
) {
  const day = new Date().toISOString().slice(0, 10)
  const eligibleMembers = members
    .filter((member) => member.id !== currentUserId && member.first_name)
    .sort(
      (a, b) =>
        memberSeed(`${day}:${currentUserId}:${a.id}`) -
        memberSeed(`${day}:${currentUserId}:${b.id}`),
    )
  const membersWithPhotos = eligibleMembers.filter((member) => member.avatar_url)
  const featured = membersWithPhotos.slice(0, 3)

  if (featured.length < 3) {
    featured.push(
      ...eligibleMembers
        .filter((member) => !featured.some((item) => item.id === member.id))
        .slice(0, 3 - featured.length),
    )
  }

  return featured
}

function FeaturedMember({ member }: { member: DirectoryMapMember }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ")
  const location = [member.city, member.state ?? member.country]
    .filter(Boolean)
    .join(", ")
  const focus = member.persona ?? member.field ?? member.affiliation ?? member.school
  const interest = member.interest_tags?.[0]
  const initials = [member.first_name?.[0], member.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase()

  return (
    <Link
      href="/dashboard/directory"
      className="group flex min-w-0 items-center gap-3 rounded-lg p-2 transition hover:bg-ipn-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ipn/30"
    >
      <span className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-ipn-light">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-ipn">
            {initials}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-900 group-hover:text-ipn">
          {name}
        </span>
        {focus && (
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {focus}
          </span>
        )}
        {(location || interest) && (
          <span className="mt-1 block truncate text-[11px] text-zinc-400">
            {[location, interest].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </Link>
  )
}

function DirectoryPreview({
  memberCount,
  mapCities,
  featuredMembers,
}: {
  memberCount: number | null
  mapCities: DirectoryMapCity[]
  featuredMembers: DirectoryMapMember[]
}) {
  const countryCount = new Set(
    mapCities.map((city) => city.country).filter(Boolean),
  ).size

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Meet members across IPN
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Connect with students and professionals across our global network.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:divide-x sm:divide-zinc-100">
        {featuredMembers.map((member) => (
          <FeaturedMember key={member.id} member={member} />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-8 sm:min-w-[28rem]">
          <span>
            <span className="block text-2xl font-semibold text-ipn">
              {memberCount?.toLocaleString() ?? "-"}
            </span>
            <span className="text-xs text-zinc-500">Members</span>
          </span>
          <span>
            <span className="block text-2xl font-semibold text-ipn">
              {mapCities.length.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">Cities</span>
          </span>
          <span>
            <span className="block text-2xl font-semibold text-ipn">
              {countryCount.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500">Countries</span>
          </span>
        </div>
        <Link
          href="/dashboard/directory"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ipn/30 px-4 py-2 text-sm font-semibold text-ipn transition hover:bg-ipn-light"
        >
          Explore community
        </Link>
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
        "profile_completed_at, whatsapp_completed_at, connection_request_completed_at, invite_completed_at, event_rsvp_completed_at",
      )
      .eq("user_id", user!.id)
      .maybeSingle()

    return {
      ...legacyResult,
      data: legacyResult.data
        ? {
            ...legacyResult.data,
            whatsapp_current_step: null,
            product_tour_completed_at: null,
            getting_started_completed_at: null,
            getting_started_success_seen_at: null,
          }
        : null,
    }
  })()
  const [
    profileResult,
    educationResult,
    upcomingResult,
    conferenceResult,
    memberCountResult,
    mapRowsResult,
    onboardingResult,
    eventParticipationResult,
    conferenceParticipationResult,
    connectionParticipationResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, persona, affiliation, school, field, avatar_url, bio, interest_tags, role_and_goals, inspiration, linkedin_url")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("member_education")
      .select("institution, degree_credential, area_of_study")
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
    supabase
      .from("event_registrations")
      .select("event_id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("conference_rsvps")
      .select("conference_id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", user!.id),
  ])

  const profile = profileResult.data as MemberProfile | null
  const onboardingProgress = onboardingResult.data as OnboardingProgress | null
  const profileCompletion = getProfileCompletion({
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? "",
    role: profile?.persona ?? "",
    requiresEducation: STUDENT_BACKGROUNDS.has(profile?.persona ?? ""),
    affiliation: profile?.affiliation ?? "",
    education: (educationResult.data ?? []).map((entry) => ({
      institution: entry.institution ?? "",
      degreeCredential: entry.degree_credential ?? "",
      areaOfStudy: entry.area_of_study ?? "",
    })),
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
  const participationCompleted = [
    eventParticipationResult.count,
    conferenceParticipationResult.count,
    connectionParticipationResult.count,
  ].some((count) => (count ?? 0) > 0)
  const gettingStartedSummary = activationSummary({
    whatsapp_completed_at: onboardingProgress?.whatsapp_completed_at ?? null,
    whatsapp_current_step: onboardingProgress?.whatsapp_current_step ?? null,
    profile_completed_at: profileMilestoneComplete ? "complete" : null,
    product_tour_completed_at: onboardingProgress?.product_tour_completed_at ?? null,
    event_rsvp_completed_at: onboardingProgress?.event_rsvp_completed_at ?? null,
    connection_request_completed_at: onboardingProgress?.connection_request_completed_at ?? null,
    participation_completed: participationCompleted,
  })
  const gettingStartedComplete = gettingStartedSummary.completedCount === gettingStartedSummary.totalCount
  const showGettingStarted = !gettingStartedComplete || !onboardingProgress?.getting_started_success_seen_at
  const mapCities = buildDirectoryMapCities(
    (mapRowsResult.data ?? []) as DirectoryMapMember[],
  )
  const featuredMembers = selectFeaturedMembers(
    (mapRowsResult.data ?? []) as DirectoryMapMember[],
    user!.id,
  )
  const rawUpcomingEvents = (upcomingResult.data ?? []) as EventRecord[]
  const conferenceRecords = (conferenceResult.data ?? []) as ConferenceRecord[]
  const eventIds = rawUpcomingEvents.map((event) => event.id)
  const conferenceIds = conferenceRecords.map((conference) => conference.id)
  let registrations: { event_id: string }[] = []
  let tickets: { event_id: string }[] = []
  let registeredMeetupIds: string[] = []

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

  if (conferenceIds.length) {
    const { data: meetupRsvps } = await supabase
      .from("conference_meetup_rsvps")
      .select("meetup_id")
      .eq("user_id", user!.id)
      .in("conference_id", conferenceIds)

    registeredMeetupIds = (meetupRsvps ?? []).map((row) => row.meetup_id)
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
          <div className="hidden sm:block">
            <ProductTourLauncher />
          </div>
          <div className="hidden sm:block">
            <InviteFriendsCard id="invite-friends" variant="header" trackOnboardingInvite />
          </div>
        </div>
      </div>

      {showGettingStarted && (
        <ActivationChecklist
          userId={user!.id}
          progress={onboardingProgress}
          profileCompletedCount={profileCompletion.completedCount}
          profileTotalCount={profileCompletion.totalCount}
          participationCompleted={participationCompleted}
        />
      )}

      <UpcomingEventsCarousel
        events={upcomingEvents}
        conferences={conferenceRecords}
        totalCount={upcomingResult.count ?? upcomingEvents.length}
        registeredMeetupIds={registeredMeetupIds}
      />

      <DirectoryPreview
        memberCount={memberCountResult.count}
        mapCities={mapCities}
        featuredMembers={featuredMembers}
      />
    </div>
  )
}
