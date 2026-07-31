import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"
import { getLegacyAnalyticsSnapshot } from "@/lib/admin/analytics/data"
import { buildMemberDirectoryData } from "@/lib/admin/analytics/member-directory"
import { buildPortalUtilizationData } from "@/lib/admin/analytics/portal-utilization"
import { getLatestPortalAnalyticsRefresh } from "@/lib/portal-analytics/rollup"
import {
  assembleServerEventAnalytics,
  type AnalyticsSourceRecord,
} from "@/lib/admin/analytics/events"
import AdminClient from "./AdminClient"
import type { MemberInsightsData, PortalAnalyticsEvent } from "./AnalyticsDashboardShell"
import type {
  AnalyticsLocationGeocodeRow,
  LegacyMemberSotImportRow,
  LegacyMemberSotRow,
  PortalDirectoryProfileRow,
  PortalEducationRow,
} from "@/lib/admin/analytics/member-directory"
import type { AdminMemberProfile } from "@/lib/admin/actions"
import { getTeamPermissions, listFeedbackSubmissions, listBannedMembers, listAnalyticsEventLabelOverrides } from "@/lib/admin/actions"
import type { TeamPermissionsMap, FeedbackSubmission } from "@/lib/admin/actions"

type PortalProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  persona: string | null
  affiliation: string | null
  field: string | null
  interest_tags: string[] | null
  school: string | null
  country: string | null
  state: string | null
  city: string | null
  city_lat: number | null
  city_lng: number | null
  is_discoverable: boolean | null
  whatsapp_url: string | null
  linkedin_url: string | null
  bio: string | null
  psychedelic_field_status: string | null
  psychedelic_field_barriers: string[] | null
  role_and_goals: string | null
  inspiration: string | null
  referral_source: string | null
  referral_source_other?: string | null
  mailchimp_status: string | null
  role: string | null
  created_at: string | null
  education?: PortalEducationRow[]
}

type PortalAnalyticsEventRow = {
  event_name: string
  user_id: string | null
  session_id: string | null
  page_path: string | null
  target_id: string | null
  target_label: string | null
  error_code: string | null
  duration_seconds: number | null
  click_count: number | null
  metadata: Record<string, unknown> | null
  occurred_at: string
}

type EventRegistrationRow = {
  event_id: string
  user_id: string
  created_at: string
}

type EventLookupRow = {
  id: string
  title: string | null
  slug: string | null
  starts_at: string | null
  event_type: string | null
  status: string | null
  external_event_id: string | null
  registration_count: number | null
}

const PORTAL_EVENT_REGISTRATION_SOURCE_START = new Date("2026-07-01T00:00:00.000Z")

type OnboardingProgressRow = {
  user_id: string
  whatsapp_completed_at: string | null
}

type PortalAuthUserRow = {
  id: string
  created_at: string | null
  last_sign_in_at: string | null
}

type PortalConnectionRow = {
  requester_id: string
  addressee_id: string
  status: string
}

const LEGACY_MEMBER_SOT_SELECT =
  "id, import_id, legacy_person_id, normalized_email, original_email, first_name, last_name, full_name, affiliation, country, state, city, self_description, primary_field, psychedelic_field_status, psychedelic_field_barriers, current_role_and_goals, ipn_inspiration, referral_source, channels_present, channel_count, in_form, in_mailchimp, in_eventbrite, in_zoom, in_oldapp, in_drive_historical, first_seen_at, last_seen_at, mailchimp_id, mailchimp_audiences, mailchimp_status, eventbrite_event_count, eventbrite_last_event_date, zoom_registrations, zoom_attended, zoom_last_event_date, zoom_total_minutes, zoom_attendance_status, oldapp_user_id, date_of_birth, gender, race, oldapp_signup_location, engagement_status, notes, raw_legacy, imported_at"

const PORTAL_PROFILE_SELECT =
  "id, first_name, last_name, email, persona, affiliation, field, interest_tags, school, country, state, city, city_lat, city_lng, is_discoverable, whatsapp_url, linkedin_url, bio, psychedelic_field_status, psychedelic_field_barriers, role_and_goals, inspiration, referral_source, mailchimp_status, role, created_at"

async function fetchPortalProfiles(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("profiles")
    .select(PORTAL_PROFILE_SELECT)

  if (error) {
    console.error("Unable to load Portal profiles for admin analytics.", {
      code: error.code,
      message: error.message,
    })
    return [] as PortalProfileRow[]
  }

  const profiles = (data ?? []) as PortalProfileRow[]
  const { data: referralDetails, error: referralDetailsError } = await admin
    .from("profiles")
    .select("id, referral_source_other")

  if (referralDetailsError) {
    console.warn("Optional referral detail data is unavailable; continuing with core Portal analytics.", {
      code: referralDetailsError.code,
      message: referralDetailsError.message,
    })
    return profiles
  }

  const referralDetailsById = new Map(
    (referralDetails ?? []).map((profile) => [
      profile.id as string,
      (profile.referral_source_other as string | null) ?? null,
    ]),
  )

  return profiles.map((profile) => ({
    ...profile,
    referral_source_other: referralDetailsById.get(profile.id) ?? null,
  }))
}

function monthKey(value: string | null | undefined) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 7) : null
}

function retentionCutoffIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function memberName(profile: PortalProfileRow | undefined) {
  if (!profile) return "Unknown member"
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
  return name || profile.email || "Unknown member"
}

function buildRegistrationTrend(profiles: PortalProfileRow[]): MemberInsightsData["registrationTrend"] {
  const counts = profiles.reduce<Record<string, number>>((acc, profile) => {
    const key = monthKey(profile.created_at)
    if (key) acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  let cumulative = 0
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, registrations]) => {
      cumulative += registrations
      return { month, registrations, cumulative }
    })
}

function buildPortalAnalyticsEvents({
  eventRows,
  eventRegistrations,
  profiles,
}: {
  eventRows: EventLookupRow[]
  eventRegistrations: EventRegistrationRow[]
  profiles: PortalProfileRow[]
}): PortalAnalyticsEvent[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const registrationsByEvent = new Map<string, PortalAnalyticsEvent["registrations"]>()

  for (const registration of eventRegistrations) {
    const profile = profilesById.get(registration.user_id)
    const current = registrationsByEvent.get(registration.event_id) ?? []
    current.push({
      memberName: memberName(profile),
      memberEmail: profile?.email ?? "",
      registeredAt: registration.created_at,
    })
    registrationsByEvent.set(registration.event_id, current)
  }

  return eventRows
    .filter((event) => {
      if (!event.starts_at) return false
      const startsAt = new Date(event.starts_at)
      return !Number.isNaN(startsAt.getTime()) && startsAt >= PORTAL_EVENT_REGISTRATION_SOURCE_START
    })
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime())
    .map((event) => {
      const registrations = (registrationsByEvent.get(event.id) ?? [])
        .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
      return {
        id: event.id,
        title: event.title ?? event.slug ?? "Untitled event",
        slug: event.slug,
        startsAt: event.starts_at,
        eventType: event.event_type,
        status: event.status,
        externalEventId: event.external_event_id,
        registrationCount: event.registration_count ?? registrations.length,
        registrations,
      }
    })
}

async function fetchLegacyMemberSotRows(admin: ReturnType<typeof createAdminClient>) {
  const pageSize = 1000
  const rows: LegacyMemberSotRow[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("legacy_member_sot_rows")
      .select(LEGACY_MEMBER_SOT_SELECT)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1)

    if (error) return { rows, error }
    const pageRows = (data ?? []) as LegacyMemberSotRow[]
    rows.push(...pageRows)
    if (pageRows.length < pageSize) return { rows, error: null }
  }
}

async function fetchPortalAnalyticsEvents(
  admin: ReturnType<typeof createAdminClient>,
  cutoff: string,
) {
  const pageSize = 1000
  const rows: PortalAnalyticsEventRow[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("portal_analytics_events")
      .select("event_name, user_id, session_id, page_path, target_id, target_label, error_code, duration_seconds, click_count, metadata, occurred_at")
      .gte("occurred_at", cutoff)
      .order("occurred_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) return { rows, error }
    const pageRows = (data ?? []) as PortalAnalyticsEventRow[]
    rows.push(...pageRows)
    if (pageRows.length < pageSize) return { rows, error: null }
  }
}

async function fetchPortalAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const perPage = 1000
  const users: PortalAuthUserRow[] = []

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return { users, error }
    const pageUsers = data.users.map((user) => ({
      id: user.id,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    }))
    users.push(...pageUsers)
    if (pageUsers.length < perPage) return { users, error: null }
  }
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const userRole = currentProfile?.role
  if (userRole !== "superadmin" && userRole !== "admin") redirect("/dashboard")

  const isSuperadmin = userRole === "superadmin"
  const admin = createAdminClient()

  // Leadership roster
  const { data: leadershipRows } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email, avatar_url, role, admin_role, team, persona, bio, whatsapp_url")
    .not("role", "is", null)
    .order("first_name", { ascending: true })

  const leadership = (leadershipRows ?? []) as AdminMemberProfile[]

  // Member insights (all admin tiers — recent signups only for superadmin)
  const [profileRows, educationRowsResult, geocodesRowsResult, authUsersResult] = await Promise.all([
    fetchPortalProfiles(admin),
    admin
      .from("member_education")
      .select("id, user_id, institution, education_level, degree_credential, area_of_study, status, graduation_year, sort_order")
      .order("sort_order", { ascending: true }),
    admin
      .from("analytics_location_geocodes")
      .select("location_key, city, state, country, latitude, longitude, precision"),
    fetchPortalAuthUsers(admin),
  ])
  if (educationRowsResult.error) {
    console.warn("Member education data is unavailable in admin analytics; continuing with legacy school fields.", {
      code: educationRowsResult.error.code,
      message: educationRowsResult.error.message,
    })
  }
  if (geocodesRowsResult.error) {
    console.warn("Analytics geocode cache is unavailable; continuing with profile coordinates and country centroids.", {
      code: geocodesRowsResult.error.code,
      message: geocodesRowsResult.error.message,
    })
  }
  const educationByUser = new Map<string, PortalEducationRow[]>()
  for (const education of (educationRowsResult.data ?? []) as PortalEducationRow[]) {
    const current = educationByUser.get(education.user_id) ?? []
    current.push(education)
    educationByUser.set(education.user_id, current)
  }
  if (authUsersResult.error) {
    console.warn("Supabase Auth activity is unavailable in admin analytics; falling back to tracked sign-in events.", {
      message: authUsersResult.error.message,
    })
  }
  const authUsersById = new Map(authUsersResult.users.map((user) => [user.id, user]))
  const allProfiles = profileRows.map((profile) => ({
    ...profile,
    created_at: authUsersById.get(profile.id)?.created_at ?? profile.created_at,
    last_sign_in_at: authUsersById.get(profile.id)?.last_sign_in_at ?? null,
    education: educationByUser.get(profile.id) ?? [],
  }))
  const total = allProfiles.length
  const discoverable = allProfiles.filter((p) => p.is_discoverable).length

  const personaCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.persona) personaCount[p.persona] = (personaCount[p.persona] ?? 0) + 1
  }

  const fieldCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.field) fieldCount[p.field] = (fieldCount[p.field] ?? 0) + 1
  }

  const tagCount: Record<string, number> = {}
  for (const p of allProfiles) {
    for (const tag of (p.interest_tags ?? [])) {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1
    }
  }

  const schoolCount: Record<string, number> = {}
  for (const p of allProfiles) {
    const schools = p.education?.length ? p.education.map((entry) => entry.institution) : [p.school]
    for (const school of new Set(schools.filter((value): value is string => Boolean(value)))) {
      schoolCount[school] = (schoolCount[school] ?? 0) + 1
    }
  }

  const countryCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.country) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1
  }

  let recent = null
  if (isSuperadmin) {
    const { data } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, persona, created_at, mailchimp_status, mailchimp_last_error_raw, mailchimp_last_error_description")
      .order("created_at", { ascending: false })
      .limit(25)
    recent = await Promise.all((data ?? []).map(async (profile) => {
      if (profile.mailchimp_status !== "unknown" || !profile.email) {
        return profile
      }

      const result = await lookupMailchimpSubscription(profile.email)
      const fields = profileMailchimpFields(result)
      await admin.from("profiles").update(fields).eq("id", profile.id)
      return { ...profile, ...fields }
    }))
  }

  const teamPermissions: TeamPermissionsMap = isSuperadmin ? await getTeamPermissions() : {}
  const feedback: FeedbackSubmission[] = isSuperadmin ? await listFeedbackSubmissions() : []
  const bannedMembers = isSuperadmin ? await listBannedMembers() : []
  const analyticsSnapshot = await getLegacyAnalyticsSnapshot()
  const analyticsRefresh = await getLatestPortalAnalyticsRefresh()
  const eventLabelOverrides = await listAnalyticsEventLabelOverrides()
  const [legacyRowsResult, legacyImportResult] = await Promise.all([
    fetchLegacyMemberSotRows(admin),
    admin
      .from("legacy_member_sot_imports")
      .select("created_at, source_pulled_at, imported_row_count, metadata")
      .order("created_at", { ascending: false })
      .limit(1),
  ])
  const latestLegacyImport = ((legacyImportResult.data ?? [])[0] ?? null) as LegacyMemberSotImportRow | null
  const memberDirectory = buildMemberDirectoryData({
    profiles: allProfiles as PortalDirectoryProfileRow[],
    legacyRows: legacyRowsResult.rows,
    latestImport: latestLegacyImport,
    geocodes: (geocodesRowsResult.data ?? []) as AnalyticsLocationGeocodeRow[],
  })
  const ninetyDaysAgo = retentionCutoffIso(90)
  const [
    analyticsEventsResult,
    onboardingResult,
    eventRegistrationsResult,
    eventRowsResult,
    analyticsSourceRecordsResult,
    connectionsResult,
  ] = await Promise.all([
    fetchPortalAnalyticsEvents(admin, ninetyDaysAgo),
    admin
      .from("member_onboarding_progress")
      .select("user_id, whatsapp_completed_at"),
    admin
      .from("event_registrations")
      .select("event_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("events")
      .select("id, title, slug, starts_at, event_type, status, external_event_id, registration_count")
      .eq("is_recording", false)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true }),
    admin
      .from("analytics_source_records")
      .select("source, record_type, source_record_id, event_source_id, event_name, event_started_at, occurred_at, registered_at, name, email, normalized_email, attended, duration_minutes, details")
      .eq("source", "zoom")
      .limit(10000),
    admin
      .from("connections")
      .select("requester_id, addressee_id, status"),
  ])
  const eventRegistrations = (eventRegistrationsResult.data ?? []) as EventRegistrationRow[]
  const eventRows = (eventRowsResult.data ?? []) as EventLookupRow[]
  if (connectionsResult.error) {
    console.warn("Member connection counts are unavailable in admin analytics.", {
      code: connectionsResult.error.code,
      message: connectionsResult.error.message,
    })
  }

  const portalUtilization = buildPortalUtilizationData({
    analyticsEvents: analyticsEventsResult.rows,
    analyticsError: analyticsEventsResult.error?.message ?? null,
    profiles: allProfiles,
    onboardingRows: (onboardingResult.data ?? []) as OnboardingProgressRow[],
    connections: (connectionsResult.data ?? []) as PortalConnectionRow[],
  })
  const portalEvents = buildPortalAnalyticsEvents({
    eventRows,
    eventRegistrations,
    profiles: allProfiles,
  })
  const assembledAnalyticsSnapshot = assembleServerEventAnalytics({
    snapshot: analyticsSnapshot,
    portalEvents,
    sourceRecords: (analyticsSourceRecordsResult.data ?? []) as AnalyticsSourceRecord[],
  })

  const memberInsights: MemberInsightsData = {
    total,
    discoverable,
    withTags: allProfiles.filter((p) => (p.interest_tags?.length ?? 0) > 0).length,
    whatsappLinked: portalUtilization.whatsapp.linkedProfiles,
    whatsappOnboardingComplete: portalUtilization.whatsapp.onboardingComplete,
    registrationTrend: buildRegistrationTrend(allProfiles),
    personaItems: Object.entries(personaCount).sort((a, b) => b[1] - a[1]),
    fieldItems: Object.entries(fieldCount).sort((a, b) => b[1] - a[1]),
    topTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topSchools: Object.entries(schoolCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topCountries: Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    profiles: allProfiles,
    recent,
    memberDirectory,
  }

  return (
    <AdminClient
      isSuperadmin={isSuperadmin}
      leadership={leadership}
      memberInsights={memberInsights}
      portalUtilization={portalUtilization}
      analyticsSnapshot={assembledAnalyticsSnapshot}
      analyticsRefresh={analyticsRefresh}
      eventLabelOverrides={eventLabelOverrides}
      portalEvents={portalEvents}
      teamPermissions={teamPermissions}
      feedback={feedback}
      bannedMembers={bannedMembers}
    />
  )
}
