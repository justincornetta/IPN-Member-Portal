import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"
import { getLegacyAnalyticsSnapshot } from "@/lib/admin/analytics/data"
import { buildMemberDirectoryData } from "@/lib/admin/analytics/member-directory"
import AdminClient from "./AdminClient"
import type { MemberInsightsData, PortalAnalyticsEvent, PortalUtilizationData } from "./AnalyticsDashboardShell"
import type {
  LegacyMemberSotImportRow,
  LegacyMemberSotRow,
  PortalDirectoryProfileRow,
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
  mailchimp_status: string | null
  created_at: string | null
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

const LEGACY_MEMBER_SOT_SELECT =
  "id, import_id, legacy_person_id, normalized_email, original_email, first_name, last_name, full_name, affiliation, country, state, city, self_description, primary_field, psychedelic_field_status, psychedelic_field_barriers, current_role_and_goals, ipn_inspiration, referral_source, channels_present, channel_count, in_form, in_mailchimp, in_eventbrite, in_zoom, in_oldapp, in_drive_historical, first_seen_at, last_seen_at, mailchimp_id, mailchimp_audiences, mailchimp_status, eventbrite_event_count, eventbrite_last_event_date, zoom_registrations, zoom_attended, zoom_last_event_date, zoom_total_minutes, zoom_attendance_status, oldapp_user_id, date_of_birth, gender, race, oldapp_signup_location, engagement_status, notes, raw_legacy, imported_at"

function dayKey(value: string | null | undefined) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

function monthKey(value: string | null | undefined) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 7) : null
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0
}

function retentionCutoffIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function memberName(profile: PortalProfileRow | undefined) {
  if (!profile) return "Unknown member"
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
  return name || profile.email || "Unknown member"
}

function analyticsDevice(metadata: Record<string, unknown> | null) {
  const deviceType = typeof metadata?.deviceType === "string" ? metadata.deviceType.toLowerCase() : ""
  if (deviceType === "desktop" || deviceType === "mobile" || deviceType === "tablet") return deviceType
  return "unknown"
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

function buildPortalUtilizationData({
  analyticsEvents,
  analyticsError,
  profiles,
  onboardingRows,
  eventRegistrations,
  eventRows,
}: {
  analyticsEvents: PortalAnalyticsEventRow[]
  analyticsError: string | null
  profiles: PortalProfileRow[]
  onboardingRows: OnboardingProgressRow[]
  eventRegistrations: EventRegistrationRow[]
  eventRows: EventLookupRow[]
}): PortalUtilizationData {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const eventsById = new Map(eventRows.map((event) => [event.id, event]))
  const funnelByDay = new Map<string, PortalUtilizationData["funnel"][number]>()
  const errorsByKey = new Map<string, PortalUtilizationData["errors"][number]>()
  const deviceStats = new Map<string, { sessions: Set<string>; users: Set<string> }>()
  const pageStats = new Map<string, {
    sessions: Set<string>
    users: Set<string>
    duration: number
    durationSamples: number
    clicks: number
    device: string
  }>()
  const pageDurationByVisit = new Map<string, {
    page: string
    device: string
    sessionKey: string
    userId: string | null
    durationSeconds: number
    clickCount: number
  }>()
  const clickStats = new Map<string, {
    clickName: string
    page: string
    device: string
    clicks: number
    users: Set<string>
    sessions: Set<string>
  }>()
  const sessionSummaryByVisit = new Map<string, {
    sessionKey: string
    page: string
    durationSeconds: number
    clickCount: number
  }>()
  const sessions = new Map<string, {
    sessionId: string
    userId: string | null
    startedAt: string
    lastSeenAt: string
    pages: Set<string>
    clicks: number
    durationSeconds: number
    lastPage: string
  }>()

  const getFunnelDay = (date: string, device: string) => {
    const key = `${date}:${device}`
    const existing = funnelByDay.get(key)
    if (existing) return existing
    const created = {
      date,
      device,
      registrationTraffic: 0,
      registrationCompleted: 0,
      registrationConversion: 0,
      signInTraffic: 0,
      signInCompleted: 0,
      signInConversion: 0,
    }
    funnelByDay.set(key, created)
    return created
  }

  for (const event of analyticsEvents) {
    const date = dayKey(event.occurred_at)
    if (!date) continue
    const page = event.page_path || "Unknown"
    const sessionKey = event.session_id || `${event.user_id ?? "anonymous"}:${date}:${page}`
    const visitKey = `${sessionKey}:${page}`
    const device = analyticsDevice(event.metadata)
    const allDevicesFunnelDay = getFunnelDay(date, "all")
    const deviceFunnelDay = getFunnelDay(date, device)

    const currentDevice = deviceStats.get(device) ?? { sessions: new Set<string>(), users: new Set<string>() }
    currentDevice.sessions.add(sessionKey)
    if (event.user_id) currentDevice.users.add(event.user_id)
    deviceStats.set(device, currentDevice)

    if (event.event_name === "page_view" && page.startsWith("/register")) {
      allDevicesFunnelDay.registrationTraffic += 1
      deviceFunnelDay.registrationTraffic += 1
    }
    if (event.event_name === "registration_success") {
      allDevicesFunnelDay.registrationCompleted += 1
      deviceFunnelDay.registrationCompleted += 1
    }
    if (event.event_name === "page_view" && page.startsWith("/login")) {
      allDevicesFunnelDay.signInTraffic += 1
      deviceFunnelDay.signInTraffic += 1
    }
    if (event.event_name === "sign_in_success") {
      allDevicesFunnelDay.signInCompleted += 1
      deviceFunnelDay.signInCompleted += 1
    }

    if (event.event_name === "registration_error" || event.event_name === "sign_in_error") {
      const errorCode = event.error_code || event.event_name
      const key = `${page}:${errorCode}`
      const existing = errorsByKey.get(key) ?? { page, errorCode, count: 0 }
      existing.count += 1
      errorsByKey.set(key, existing)
    }

    if (event.event_name === "page_duration" || event.event_name === "session_summary" || event.event_name === "page_view") {
      const pageKey = `${page}:${device}`
      const existingPage = pageStats.get(pageKey) ?? {
        sessions: new Set<string>(),
        users: new Set<string>(),
        duration: 0,
        durationSamples: 0,
        clicks: 0,
        device,
      }
      existingPage.sessions.add(sessionKey)
      if (event.user_id) existingPage.users.add(event.user_id)
      pageStats.set(pageKey, existingPage)
    }

    if (event.event_name === "page_duration") {
      const existingVisit = pageDurationByVisit.get(visitKey)
      pageDurationByVisit.set(visitKey, {
        page,
        device,
        sessionKey,
        userId: event.user_id,
        durationSeconds: Math.max(existingVisit?.durationSeconds ?? 0, event.duration_seconds ?? 0),
        clickCount: Math.max(existingVisit?.clickCount ?? 0, event.click_count ?? 0),
      })
    }

    if (event.event_name === "curated_click" || event.event_name === "whatsapp_cta_clicked") {
      const clickName = event.target_label || event.target_id || event.event_name
      const key = `${page}:${clickName}:${device}`
      const existingClick = clickStats.get(key) ?? {
        clickName,
        page,
        device,
        clicks: 0,
        users: new Set<string>(),
        sessions: new Set<string>(),
      }
      existingClick.clicks += 1
      existingClick.sessions.add(sessionKey)
      if (event.user_id) existingClick.users.add(event.user_id)
      clickStats.set(key, existingClick)
    }

    if (event.event_name === "session_summary") {
      const existingSummary = sessionSummaryByVisit.get(visitKey)
      sessionSummaryByVisit.set(visitKey, {
        sessionKey,
        page,
        durationSeconds: Math.max(existingSummary?.durationSeconds ?? 0, event.duration_seconds ?? 0),
        clickCount: Math.max(existingSummary?.clickCount ?? 0, event.click_count ?? 0),
      })
    }

    const existingSession = sessions.get(sessionKey) ?? {
      sessionId: sessionKey,
      userId: event.user_id,
      startedAt: event.occurred_at,
      lastSeenAt: event.occurred_at,
      pages: new Set<string>(),
      clicks: 0,
      durationSeconds: 0,
      lastPage: page,
    }
    if (event.user_id) existingSession.userId = event.user_id
    if (event.occurred_at < existingSession.startedAt) existingSession.startedAt = event.occurred_at
    if (event.occurred_at >= existingSession.lastSeenAt) {
      existingSession.lastSeenAt = event.occurred_at
      existingSession.lastPage = page
    }
    existingSession.pages.add(page)
    sessions.set(sessionKey, existingSession)
  }

  for (const visit of pageDurationByVisit.values()) {
    const pageKey = `${visit.page}:${visit.device}`
    const existingPage = pageStats.get(pageKey) ?? {
      sessions: new Set<string>(),
      users: new Set<string>(),
      duration: 0,
      durationSamples: 0,
      clicks: 0,
      device: visit.device,
    }
    existingPage.sessions.add(visit.sessionKey)
    if (visit.userId) existingPage.users.add(visit.userId)
    if (visit.durationSeconds) {
      existingPage.duration += visit.durationSeconds
      existingPage.durationSamples += 1
    }
    existingPage.clicks += visit.clickCount
    pageStats.set(pageKey, existingPage)
  }

  for (const summary of sessionSummaryByVisit.values()) {
    const existingSession = sessions.get(summary.sessionKey)
    if (!existingSession) continue
    existingSession.durationSeconds += summary.durationSeconds
    existingSession.clicks += summary.clickCount
  }

  const funnel = Array.from(funnelByDay.values())
    .map((row) => ({
      ...row,
      registrationConversion: percent(row.registrationCompleted, row.registrationTraffic),
      signInConversion: percent(row.signInCompleted, row.signInTraffic),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const topPages = Array.from(pageStats.entries())
    .map(([key, stats]) => ({
      page: key.slice(0, -(stats.device.length + 1)),
      device: stats.device,
      sessions: stats.sessions.size,
      users: stats.users.size,
      avgDurationSeconds: stats.durationSamples ? Math.round(stats.duration / stats.durationSamples) : 0,
      clicks: stats.clicks,
      clicksPerSession: stats.sessions.size ? Math.round((stats.clicks / stats.sessions.size) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.clicks - a.clicks)

  const topClicks = Array.from(clickStats.values())
    .map((stats) => ({
      clickName: stats.clickName,
      page: stats.page,
      device: stats.device,
      clicks: stats.clicks,
      users: stats.users.size,
      sessions: stats.sessions.size,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.users - a.users || a.clickName.localeCompare(b.clickName))

  const rsvpsByDay = eventRegistrations.reduce<Record<string, number>>((acc, row) => {
    const date = dayKey(row.created_at)
    if (date) acc[date] = (acc[date] ?? 0) + 1
    return acc
  }, {})

  return {
    generatedAt: new Date().toISOString(),
    rawRetentionDays: 90,
    trackingAvailable: !analyticsError,
    trackingError: analyticsError,
    funnel,
    errors: Array.from(errorsByKey.values()).sort((a, b) => b.count - a.count),
    topPages,
    topClicks,
    recentSessions: Array.from(sessions.values())
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, 50)
      .map((session) => {
        const profile = session.userId ? profilesById.get(session.userId) : undefined
        return {
          sessionId: session.sessionId,
          memberName: memberName(profile),
          memberEmail: profile?.email ?? "",
          startedAt: session.startedAt,
          lastSeenAt: session.lastSeenAt,
          pages: session.pages.size,
          clicks: session.clicks,
          durationSeconds: session.durationSeconds,
          lastPage: session.lastPage,
        }
      }),
    rsvpTrend: Object.entries(rsvpsByDay)
      .map(([date, rsvps]) => ({ date, rsvps }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    trafficDevices: Array.from(deviceStats.entries())
      .map(([label, stats]) => ({
        label,
        sessions: stats.sessions.size,
        users: stats.users.size,
      }))
      .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label)),
    recentRsvps: eventRegistrations
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50)
      .map((registration) => {
        const profile = profilesById.get(registration.user_id)
        const event = eventsById.get(registration.event_id)
        return {
          memberName: memberName(profile),
          memberEmail: profile?.email ?? "",
          eventTitle: event?.title ?? event?.slug ?? registration.event_id,
          createdAt: registration.created_at,
        }
      }),
    whatsapp: {
      linkedProfiles: profiles.filter((profile) => Boolean(profile.whatsapp_url?.trim())).length,
      onboardingComplete: onboardingRows.filter((row) => Boolean(row.whatsapp_completed_at)).length,
      totalMembers: profiles.length,
    },
  }
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
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email, persona, affiliation, field, interest_tags, school, country, state, city, city_lat, city_lng, is_discoverable, whatsapp_url, linkedin_url, bio, psychedelic_field_status, psychedelic_field_barriers, role_and_goals, inspiration, referral_source, mailchimp_status, created_at")

  const allProfiles = (profileRows ?? []) as PortalProfileRow[]
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
    if (p.school) schoolCount[p.school] = (schoolCount[p.school] ?? 0) + 1
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
  })
  const ninetyDaysAgo = retentionCutoffIso(90)
  const [
    analyticsEventsResult,
    onboardingResult,
    eventRegistrationsResult,
    eventRowsResult,
  ] = await Promise.all([
    admin
      .from("portal_analytics_events")
      .select("event_name, user_id, session_id, page_path, target_id, target_label, error_code, duration_seconds, click_count, metadata, occurred_at")
      .gte("occurred_at", ninetyDaysAgo)
      .order("occurred_at", { ascending: true })
      .limit(10000),
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
  ])
  const eventRegistrations = (eventRegistrationsResult.data ?? []) as EventRegistrationRow[]
  const eventRows = (eventRowsResult.data ?? []) as EventLookupRow[]

  const portalUtilization = buildPortalUtilizationData({
    analyticsEvents: (analyticsEventsResult.data ?? []) as PortalAnalyticsEventRow[],
    analyticsError: analyticsEventsResult.error?.message ?? null,
    profiles: allProfiles,
    onboardingRows: (onboardingResult.data ?? []) as OnboardingProgressRow[],
    eventRegistrations,
    eventRows,
  })
  const portalEvents = buildPortalAnalyticsEvents({
    eventRows,
    eventRegistrations,
    profiles: allProfiles,
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
      analyticsSnapshot={analyticsSnapshot}
      eventLabelOverrides={eventLabelOverrides}
      portalEvents={portalEvents}
      teamPermissions={teamPermissions}
      feedback={feedback}
      bannedMembers={bannedMembers}
    />
  )
}
