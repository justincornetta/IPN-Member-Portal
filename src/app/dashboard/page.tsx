import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import { WhatsAppIcon } from "@/components/community/WhatsAppCommunityCard"
import { createClient } from "@/lib/supabase/server"
import { withTicketRegistrationState } from "@/lib/events/tickets"
import type { EventRecord, EventWithRegistration } from "@/lib/events/types"
import type { ConnectionEntry, DirectoryMapMember } from "@/lib/directory/types"
import {
  getContactMapForMembers,
  getEducationMapForMembers,
} from "@/lib/directory/queries"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { ResourceRecord } from "@/lib/resources/types"
import {
  latestPublishedDefaultNewsletter,
  withNewsletterCoverImage,
} from "@/lib/resources/newsletters"
import { STUDENT_BACKGROUNDS } from "@/lib/constants/registration"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary, isProfileMilestoneComplete } from "./activation-model"
import UpcomingEventsCarousel from "./UpcomingEventsCarousel"
import ActivationChecklist from "./ActivationChecklist"
import FeaturedMembersPreview from "./FeaturedMembersPreview"
import { recommendFeaturedMembers } from "./featured-member-recommendations"
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
  whatsapp_url: string | null
}

function formatConferenceDate(conference: ConferenceRecord) {
  const startsAt = new Date(conference.starts_at)
  const endsAt = new Date(conference.ends_at)
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(startsAt)
  const startDay = startsAt.getDate()
  const endDay = endsAt.getDate()
  const year = endsAt.getFullYear()

  if (startsAt.toDateString() === endsAt.toDateString()) {
    return `${month} ${startDay}, ${year}`
  }

  return `${month} ${startDay} – ${endDay}, ${year}`
}

function ConferencesPreview({ conferences }: { conferences: ConferenceRecord[] }) {
  return (
    <section className="border-b border-zinc-200 pb-4" aria-labelledby="conferences-to-plan-for">
      <div className="flex items-center justify-between gap-4">
        <h2 id="conferences-to-plan-for" className="text-lg font-semibold text-ipn sm:text-xl">
          Conferences to plan for
        </h2>
        <Link
          href="/dashboard/conferences"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline"
        >
          <span className="sm:hidden">View all</span>
          <span className="hidden sm:inline">View all conferences</span>
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {conferences.length ? (
        <div className="mt-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:mt-2 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-zinc-200 sm:rounded-none sm:border-x-0 sm:border-b-0 sm:border-t-0">
          {conferences.slice(0, 2).map((conference) => {
            const location = [conference.city, conference.state ?? conference.country]
              .filter(Boolean)
              .join(", ")

            return (
              <Link
                key={conference.id}
                href={`/dashboard/conferences/${conference.slug}`}
                className="group flex min-h-24 items-center gap-4 border-b border-zinc-100 px-4 py-3 last:border-b-0 hover:bg-ipn-light/30 sm:border-b-0 sm:px-0 sm:first:pr-7 sm:last:pl-7"
              >
                <span className="h-14 w-14 flex-none overflow-hidden rounded-full bg-ipn-light sm:h-16 sm:w-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={conference.cover_image_url || "/purple_icon.png"}
                    alt=""
                    className={`h-full w-full ${conference.cover_image_url ? "object-cover" : "object-contain p-2"}`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-950 group-hover:text-ipn">
                    {conference.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 sm:text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />
                      {formatConferenceDate(conference)}
                    </span>
                    {location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon className="h-4 w-4" aria-hidden="true" />
                        {location}
                      </span>
                    )}
                  </span>
                </span>
                <ArrowRightIcon className="h-5 w-5 flex-none text-ipn" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500">
          New conference listings are coming soon.
        </p>
      )}
    </section>
  )
}

function LatestFromIpn({ resource }: { resource: ResourceRecord | null }) {
  const published = resource?.published_at
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(resource.published_at))
    : null
  const href = resource?.url ?? "/dashboard/resources?tab=newsletters"
  const externalLinkProps = resource
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {}

  return (
    <section aria-labelledby="latest-from-ipn">
      <div className="flex items-center justify-between gap-4">
        <h2 id="latest-from-ipn" className="text-lg font-semibold text-ipn sm:text-xl">
          Latest from IPN
        </h2>
        <Link
          href="/dashboard/resources?tab=newsletters"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline sm:hidden"
        >
          Browse all
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-[8rem_minmax(0,1fr)] gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <a
          href={href}
          {...externalLinkProps}
          className="relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-[#122271] to-[#8f2792]"
        >
          {resource?.thumbnail_url || resource?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resource.thumbnail_url || resource.image_url || ""}
              alt={resource.image_alt || ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-3 text-center text-base font-semibold text-white">
              IPN INSIGHTS
            </span>
          )}
        </a>
        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-md bg-ipn-light px-2 py-1 font-semibold text-ipn">Newsletter</span>
            {published && <span>{published}</span>}
          </div>
          <a href={href} {...externalLinkProps} className="group mt-3 block">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-950 group-hover:text-ipn sm:text-lg">
              {resource?.title ?? "Discover the latest news and insights from IPN"}
            </h3>
          </a>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
            {resource?.description ?? "Research, community updates, and new opportunities for members."}
          </p>
        </div>
      </div>

      <div className="mt-3 hidden items-center gap-8 sm:flex">
        <a
          href={href}
          {...externalLinkProps}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline"
        >
          Read latest
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </a>
        <Link
          href="/dashboard/resources?tab=newsletters"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline"
        >
          Browse archive
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

function greetingForDate(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }).format(date),
  )
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
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
    latestResourceResult,
    mapRowsResult,
    onboardingResult,
    eventParticipationResult,
    ticketParticipationResult,
    conferenceParticipationResult,
    meetupParticipationResult,
    connectionParticipationResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, persona, affiliation, school, field, avatar_url, bio, interest_tags, role_and_goals, inspiration, linkedin_url, whatsapp_url")
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
      .select("id, slug, name, organizer, category, cover_image_url, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status")
      .eq("status", "published")
      .gte("ends_at", now)
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("resources")
      .select("*")
      .eq("status", "published")
      .eq("resource_type", "newsletter")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, persona, school, affiliation, field, city, state, country, city_lat, city_lng, bio, interest_tags, linkedin_url, avatar_url, admin_role, team",
      )
      .eq("is_discoverable", true)
      .order("first_name", { ascending: true })
      .limit(500),
    onboardingResultPromise,
    supabase
      .from("event_registrations")
      .select("event_id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    user?.email
      ? supabase
          .from("event_ticket_access")
          .select("event_id", { count: "exact", head: true })
          .eq("attendee_email_normalized", user.email.trim().toLowerCase())
      : Promise.resolve({ count: 0 }),
    supabase
      .from("conference_rsvps")
      .select("conference_id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("conference_meetup_rsvps")
      .select("meetup_id", { count: "exact", head: true })
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
    whatsappUrl: profile?.whatsapp_url ?? null,
    whatsappOptOut: user?.user_metadata?.whatsapp_opt_out === true,
  })
  const profileMilestoneComplete = isProfileMilestoneComplete(
    onboardingProgress?.profile_completed_at,
    profileCompletion.completedCount,
    profileCompletion.totalCount,
  )
  const participationCompleted = [
    eventParticipationResult.count,
    ticketParticipationResult.count,
    conferenceParticipationResult.count,
    meetupParticipationResult.count,
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
  const { data: featuredConnectionRows } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
  const acceptedConnectionIds = new Set(
    (featuredConnectionRows ?? [])
      .filter((connection) => connection.status === "accepted")
      .map((connection) =>
        connection.requester_id === user!.id
          ? connection.addressee_id
          : connection.requester_id,
      ),
  )
  const featuredMembers = recommendFeaturedMembers(
    (mapRowsResult.data ?? []) as DirectoryMapMember[],
    user!.id,
    {
      persona: profile?.persona ?? null,
      school: profile?.school ?? null,
      affiliation: profile?.affiliation ?? null,
      field: profile?.field ?? null,
      interest_tags: profile?.interest_tags ?? null,
      educationInstitutions: (educationResult.data ?? [])
        .map((entry) => entry.institution)
        .filter((institution): institution is string => Boolean(institution)),
    },
    acceptedConnectionIds,
  )
  const featuredMemberIds = featuredMembers.map((member) => member.id)
  const [featuredEducationMap, featuredContactMap] = await Promise.all([
      getEducationMapForMembers(supabase, featuredMemberIds),
      getContactMapForMembers(supabase, featuredMemberIds),
    ])
  const featuredMembersWithDetails = featuredMembers.map((member) => ({
    ...member,
    education: featuredEducationMap.get(member.id) ?? [],
    contact: featuredContactMap.get(member.id) ?? null,
  }))
  const featuredConnectionMap: Record<string, ConnectionEntry> = {}
  for (const connection of featuredConnectionRows ?? []) {
    const otherId = connection.requester_id === user!.id
      ? connection.addressee_id
      : connection.requester_id
    if (!featuredMemberIds.includes(otherId)) continue
    featuredConnectionMap[otherId] = {
      status: connection.status as ConnectionEntry["status"],
      amRequester: connection.requester_id === user!.id,
    }
  }
  const rawUpcomingEvents = (upcomingResult.data ?? []) as EventRecord[]
  const conferenceRecords = (conferenceResult.data ?? []) as ConferenceRecord[]
  const latestResource = withNewsletterCoverImage(
    (latestResourceResult.data as ResourceRecord | null) ??
      latestPublishedDefaultNewsletter(),
  )
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
  const today = new Date()
  const briefingDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(today)

  return (
    <div className="shrink-0 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-7 sm:py-7 lg:gap-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1
              data-tour-page="dashboard"
              className="text-3xl font-semibold tracking-tight text-[#11142D] sm:text-4xl"
            >
              {greetingForDate(today)}, {firstName}
            </h1>
            <p className="mt-2 text-base text-zinc-600">
              Here&apos;s your weekly briefing for{" "}
              <span className="font-semibold text-ipn">{briefingDate}.</span>
            </p>
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-3 md:flex">
            <Link
              href="/onboarding/whatsapp?motion=editorial"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ipn/20 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-ipn/40 hover:bg-ipn-light"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Join IPN on WhatsApp
            </Link>
            <ProductTourLauncher />
            <InviteFriendsCard id="invite-friends" variant="header" trackOnboardingInvite />
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
          registeredMeetupIds={registeredMeetupIds}
        />

        <ConferencesPreview conferences={conferenceRecords} />

        <div className="grid gap-7 lg:grid-cols-[0.92fr_1.08fr] lg:divide-x lg:divide-zinc-200">
          <LatestFromIpn resource={latestResource} />
          <div className="border-t border-zinc-200 pt-6 lg:border-t-0 lg:pl-7 lg:pt-0">
            <FeaturedMembersPreview
              featuredMembers={featuredMembersWithDetails}
              currentUserId={user!.id}
              connectionMap={featuredConnectionMap}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
