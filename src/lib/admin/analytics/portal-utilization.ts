export type UtilizationAudience = "all" | "leadership" | "member"
export type UtilizationMemberAudience = Exclude<UtilizationAudience, "all"> | "unknown"
export type UtilizationDevice = "all" | "desktop" | "mobile" | "tablet" | "unknown"

export type PortalUtilizationEventInput = {
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

export type PortalUtilizationProfileInput = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
  whatsapp_url: string | null
  created_at?: string | null
  mailchimp_status?: string | null
  last_sign_in_at?: string | null
}

export type PortalUtilizationOnboardingInput = {
  user_id: string
  whatsapp_completed_at: string | null
}

export type PortalUtilizationConnectionInput = {
  requester_id: string
  addressee_id: string
  status: string
}

export const REGISTRATION_FLOW_STAGES = [
  { id: "home", label: "Home page" },
  { id: "account", label: "Step 1 · Account" },
  { id: "location", label: "Step 2 · Location" },
  { id: "background", label: "Step 3 · Background" },
  { id: "about", label: "Step 4 · About You" },
  { id: "completed", label: "Registration completed" },
] as const

export type RegistrationFlowStageId = (typeof REGISTRATION_FLOW_STAGES)[number]["id"]
export type RegistrationFlowCounts = Record<RegistrationFlowStageId, number>

export type PortalJourneyStep = {
  occurredAt: string
  eventName: string
  label: string
  page: string
  durationSeconds: number | null
}

export type PortalUtilizationData = {
  generatedAt: string
  rawRetentionDays: number
  trackingAvailable: boolean
  trackingError: string | null
  dateRange: {
    first: string | null
    last: string | null
  }
  funnel: {
    date: string
    device: UtilizationDevice
    audience: UtilizationAudience
    registrationTraffic: number
    registrationCompleted: number
    registrationConversion: number
    signInTraffic: number
    signInCompleted: number
    signInConversion: number
  }[]
  registrationFlow: {
    trackingStartedAt: string | null
    rows: ({
      date: string
      device: UtilizationDevice
      audience: UtilizationAudience
    } & RegistrationFlowCounts)[]
  }
  monthlyActiveUsers: {
    date: string
    device: UtilizationDevice
    audience: UtilizationAudience
    users: number
    members: {
      userId: string
      fullName: string
      email: string
      uniqueSessions: number
    }[]
  }[]
  errors: {
    date: string
    device: UtilizationDevice
    audience: UtilizationAudience
    page: string
    errorCode: string
    count: number
  }[]
  pageViews: {
    date: string
    device: UtilizationDevice
    audience: UtilizationAudience
    page: PortalPageCategory
    views: number
  }[]
  trafficDevices: {
    label: Exclude<UtilizationDevice, "all">
    sessions: number
    users: number
  }[]
  journeys: {
    sessionId: string
    memberName: string
    memberEmail: string
    audience: UtilizationMemberAudience
    device: Exclude<UtilizationDevice, "all">
    startType: "registration" | "sign_in"
    startedAt: string
    lastSeenAt: string
    durationSeconds: number
    steps: PortalJourneyStep[]
  }[]
  members: {
    userId: string
    fullName: string
    email: string
    audience: Exclude<UtilizationAudience, "all">
    firstRegisteredAt: string | null
    connectionCount: number
    whatsappConnected: boolean
    mailchimpStatus: string
    signInActivity: Record<UtilizationDevice, {
      lastSignedInAt: string | null
      signInsLast30Days: number
    }>
  }[]
  whatsapp: {
    linkedProfiles: number
    onboardingComplete: number
    totalMembers: number
  }
}

export const PORTAL_PAGE_CATEGORIES = [
  "Dashboard",
  "Community",
  "Events",
  "Conferences",
  "Profile",
  "Feedback",
] as const

export type PortalPageCategory = (typeof PORTAL_PAGE_CATEGORIES)[number]

type FunnelAccumulator = {
  date: string
  device: UtilizationDevice
  audience: UtilizationAudience
  registrationTraffic: Set<string>
  registrationCompleted: Set<string>
  signInTraffic: Set<string>
  signInCompleted: Set<string>
}

type RegistrationFlowAccumulator = {
  date: string
  device: UtilizationDevice
  audience: UtilizationAudience
  stages: Record<RegistrationFlowStageId, Set<string>>
}

type ActivityAccumulator = {
  signIns: Map<string, Set<string>>
  engagements: Map<string, Set<string>>
  sessions: Map<string, Map<string, Set<string>>>
}

type PageViewAccumulator = {
  date: string
  device: UtilizationDevice
  audience: UtilizationAudience
  page: PortalPageCategory
  sessions: Set<string>
}

type SessionAccumulator = {
  sessionId: string
  userId: string | null
  audience: UtilizationMemberAudience
  device: Exclude<UtilizationDevice, "all">
  startedAt: string
  lastSeenAt: string
  events: PortalUtilizationEventInput[]
}

const RAW_RETENTION_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(value: string | null | undefined) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0
}

function analyticsDevice(metadata: Record<string, unknown> | null): Exclude<UtilizationDevice, "all"> {
  const deviceType = typeof metadata?.deviceType === "string" ? metadata.deviceType.toLowerCase() : ""
  if (deviceType === "desktop" || deviceType === "mobile" || deviceType === "tablet") return deviceType
  return "unknown"
}

function cleanPagePath(value: string | null | undefined) {
  if (!value) return "Unknown"
  return value.split("?")[0] || "Unknown"
}

export function portalPageCategory(pagePath: string | null | undefined): PortalPageCategory | null {
  const page = cleanPagePath(pagePath)
  if (page === "/dashboard") return "Dashboard"
  if (page === "/dashboard/directory" || page.startsWith("/dashboard/directory/") || page === "/dashboard/community") return "Community"
  if (page === "/dashboard/events" || page.startsWith("/dashboard/events/")) return "Events"
  if (page === "/dashboard/conferences" || page.startsWith("/dashboard/conferences/")) return "Conferences"
  if (page === "/dashboard/profile" || page.startsWith("/dashboard/profile/")) return "Profile"
  return null
}

function isFeedbackOpen(event: PortalUtilizationEventInput) {
  if (event.event_name !== "curated_click") return false
  const target = `${event.target_id ?? ""} ${event.target_label ?? ""}`.toLowerCase()
  return target.includes("feedback") && !target.includes("submitted")
}

function memberName(profile: PortalUtilizationProfileInput | undefined) {
  if (!profile) return "Unknown member"
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
  return name || profile.email || "Unknown member"
}

function sessionKey(event: PortalUtilizationEventInput) {
  return event.session_id || `${event.user_id ?? "anonymous"}:${dayKey(event.occurred_at) ?? "unknown"}`
}

function registrationStep(event: PortalUtilizationEventInput) {
  if (event.event_name !== "registration_step_view") return null
  const step = event.metadata?.step
  if (typeof step === "number" && Number.isInteger(step) && step >= 1 && step <= 4) return step
  if (typeof step === "string" && /^[1-4]$/.test(step)) return Number(step)
  return null
}

function emptyRegistrationStages(): Record<RegistrationFlowStageId, Set<string>> {
  return {
    home: new Set<string>(),
    account: new Set<string>(),
    location: new Set<string>(),
    background: new Set<string>(),
    about: new Set<string>(),
    completed: new Set<string>(),
  }
}

function eventLabel(event: PortalUtilizationEventInput) {
  if (event.event_name === "page_view") {
    const page = cleanPagePath(event.page_path)
    if (page === "/dashboard/admin" || page.startsWith("/dashboard/admin/")) return "Admin"
    if (page === "/dashboard/resources" || page.startsWith("/dashboard/resources/")) return "Resources"
    return portalPageCategory(event.page_path) ?? page
  }
  if (event.event_name === "curated_click") {
    return event.target_label || event.target_id || "Link clicked"
  }
  if (event.event_name === "registration_success") return "Registration completed"
  if (event.event_name === "sign_in_success") return "Signed in"
  if (event.event_name === "registration_error") return event.error_code || "Registration error"
  if (event.event_name === "sign_in_error") return event.error_code || "Sign-in error"
  if (event.event_name === "event_rsvp_created") return "Event RSVP created"
  if (event.event_name === "event_rsvp_cancelled") return "Event RSVP cancelled"
  if (event.event_name === "whatsapp_cta_clicked") return "WhatsApp opened"
  return event.event_name
    .split("_")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ")
}

function meaningfulJourneyEvent(event: PortalUtilizationEventInput) {
  return event.event_name !== "page_duration" &&
    event.event_name !== "session_summary" &&
    event.event_name !== "registration_view" &&
    event.event_name !== "registration_submit" &&
    event.event_name !== "sign_in_view" &&
    event.event_name !== "sign_in_submit"
}

function buildJourneySteps(
  events: PortalUtilizationEventInput[],
  startIndex: number,
) {
  const durationByPageViewIndex = new Map<number, number>()
  const visits: { page: string; eventIndex: number }[] = []
  let activeVisit: { page: string; eventIndex: number } | null = null

  for (let eventIndex = startIndex; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex]
    const page = cleanPagePath(event.page_path)
    if (event.event_name === "page_view") {
      if (!activeVisit || activeVisit.page !== page) {
        activeVisit = { page, eventIndex }
        visits.push(activeVisit)
      }
      continue
    }
    if (
      (event.event_name === "page_duration" || event.event_name === "session_summary") &&
      event.duration_seconds != null
    ) {
      let matchingVisit = activeVisit?.page === page ? activeVisit : null
      if (!matchingVisit) {
        for (let visitIndex = visits.length - 1; visitIndex >= 0; visitIndex -= 1) {
          if (visits[visitIndex].page === page) {
            matchingVisit = visits[visitIndex]
            break
          }
        }
      }
      if (!matchingVisit) continue
      const current = durationByPageViewIndex.get(matchingVisit.eventIndex) ?? 0
      durationByPageViewIndex.set(
        matchingVisit.eventIndex,
        Math.max(current, Math.max(0, Math.round(event.duration_seconds))),
      )
    }
  }

  const steps: PortalJourneyStep[] = []
  let lastPageViewPage: string | null = null
  for (let eventIndex = startIndex; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex]
    if (!meaningfulJourneyEvent(event)) continue
    const page = cleanPagePath(event.page_path)
    if (event.event_name === "page_view") {
      if (page === lastPageViewPage) continue
      lastPageViewPage = page
    }
    steps.push({
      occurredAt: event.occurred_at,
      eventName: event.event_name,
      label: eventLabel(event),
      page,
      durationSeconds: event.event_name === "page_view"
        ? durationByPageViewIndex.get(eventIndex) ?? null
        : null,
    })
  }

  return {
    steps: steps.slice(0, 80),
    durationSeconds: Array.from(durationByPageViewIndex.values())
      .reduce((sum, duration) => sum + duration, 0),
  }
}

function dateSequence(first: string, last: string) {
  const dates: string[] = []
  const cursor = new Date(`${first}T00:00:00.000Z`)
  const end = new Date(`${last}T00:00:00.000Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function addUserDate(map: Map<string, Set<string>>, userId: string, date: string) {
  const dates = map.get(userId) ?? new Set<string>()
  dates.add(date)
  map.set(userId, dates)
}

function addUserSessionDate(
  map: Map<string, Map<string, Set<string>>>,
  userId: string,
  sessionId: string,
  date: string,
) {
  const sessions = map.get(userId) ?? new Map<string, Set<string>>()
  const dates = sessions.get(sessionId) ?? new Set<string>()
  dates.add(date)
  sessions.set(sessionId, dates)
  map.set(userId, sessions)
}

function hasDateInWindow(dates: Set<string> | undefined, start: string, end: string) {
  if (!dates) return false
  for (const date of dates) {
    if (date >= start && date <= end) return true
  }
  return false
}

function sessionCountInWindow(
  sessions: Map<string, Set<string>> | undefined,
  start: string,
  end: string,
) {
  if (!sessions) return 0
  let count = 0
  for (const dates of sessions.values()) {
    if (hasDateInWindow(dates, start, end)) count += 1
  }
  return count
}

function isEngagement(event: PortalUtilizationEventInput) {
  const page = cleanPagePath(event.page_path)
  if (!page.startsWith("/dashboard")) return false
  if (event.event_name === "curated_click" ||
      event.event_name === "event_rsvp_created" ||
      event.event_name === "event_rsvp_cancelled" ||
      event.event_name === "whatsapp_cta_clicked") {
    return true
  }
  return (event.event_name === "page_duration" || event.event_name === "session_summary") &&
    (event.click_count ?? 0) > 0
}

export function buildPortalUtilizationData({
  analyticsEvents,
  analyticsError,
  profiles,
  onboardingRows,
  connections = [],
  now = new Date(),
}: {
  analyticsEvents: PortalUtilizationEventInput[]
  analyticsError: string | null
  profiles: PortalUtilizationProfileInput[]
  onboardingRows: PortalUtilizationOnboardingInput[]
  connections?: PortalUtilizationConnectionInput[]
  now?: Date
}): PortalUtilizationData {
  const sortedEvents = analyticsEvents
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const sessionUserIds = new Map<string, string>()
  const sessionAudiences = new Map<string, UtilizationMemberAudience>()
  const sessionDevices = new Map<string, Exclude<UtilizationDevice, "all">>()

  for (const event of sortedEvents) {
    const key = sessionKey(event)
    const device = analyticsDevice(event.metadata)
    if (!sessionDevices.has(key) || sessionDevices.get(key) === "unknown") sessionDevices.set(key, device)
    if (!event.user_id) continue
    sessionUserIds.set(key, event.user_id)
    const profile = profilesById.get(event.user_id)
    sessionAudiences.set(key, profile?.role ? "leadership" : "member")
  }

  const funnelByKey = new Map<string, FunnelAccumulator>()
  const errorsByKey = new Map<string, PortalUtilizationData["errors"][number]>()
  const pageViewsByKey = new Map<string, PageViewAccumulator>()
  const deviceStats = new Map<Exclude<UtilizationDevice, "all">, { sessions: Set<string>; users: Set<string> }>()
  const activityByKey = new Map<string, ActivityAccumulator>()
  const sessions = new Map<string, SessionAccumulator>()

  const getFunnel = (date: string, device: UtilizationDevice, audience: UtilizationAudience) => {
    const key = `${date}|${device}|${audience}`
    const existing = funnelByKey.get(key)
    if (existing) return existing
    const created: FunnelAccumulator = {
      date,
      device,
      audience,
      registrationTraffic: new Set<string>(),
      registrationCompleted: new Set<string>(),
      signInTraffic: new Set<string>(),
      signInCompleted: new Set<string>(),
    }
    funnelByKey.set(key, created)
    return created
  }

  for (const event of sortedEvents) {
    const date = dayKey(event.occurred_at)
    if (!date) continue
    const key = sessionKey(event)
    const audience = sessionAudiences.get(key) ?? "unknown"
    const device = sessionDevices.get(key) ?? analyticsDevice(event.metadata)
    const userId = event.user_id ?? sessionUserIds.get(key) ?? null
    const audiences: UtilizationAudience[] = audience === "unknown" ? ["all"] : ["all", audience]
    const devices: UtilizationDevice[] = ["all", device]
    const page = cleanPagePath(event.page_path)

    const currentDevice = deviceStats.get(device) ?? { sessions: new Set<string>(), users: new Set<string>() }
    currentDevice.sessions.add(key)
    if (userId) currentDevice.users.add(userId)
    deviceStats.set(device, currentDevice)

    const existingSession = sessions.get(key) ?? {
      sessionId: key,
      userId,
      audience,
      device,
      startedAt: event.occurred_at,
      lastSeenAt: event.occurred_at,
      events: [],
    }
    if (userId) existingSession.userId = userId
    if (audience !== "unknown") existingSession.audience = audience
    if (existingSession.device === "unknown" && device !== "unknown") existingSession.device = device
    existingSession.startedAt = event.occurred_at < existingSession.startedAt ? event.occurred_at : existingSession.startedAt
    existingSession.lastSeenAt = event.occurred_at > existingSession.lastSeenAt ? event.occurred_at : existingSession.lastSeenAt
    existingSession.events.push(event)
    sessions.set(key, existingSession)

    for (const audienceValue of audiences) {
      for (const deviceValue of devices) {
        const funnel = getFunnel(date, deviceValue, audienceValue)
        if (event.event_name === "page_view" && page === "/register") funnel.registrationTraffic.add(key)
        if (event.event_name === "registration_success") funnel.registrationCompleted.add(key)
        if (event.event_name === "page_view" && page === "/login") funnel.signInTraffic.add(key)
        if (event.event_name === "sign_in_success") funnel.signInCompleted.add(key)

        if (event.event_name === "registration_error" || event.event_name === "sign_in_error") {
          const errorCode = event.error_code || event.event_name
          const errorKey = `${date}|${deviceValue}|${audienceValue}|${page}|${errorCode}`
          const current = errorsByKey.get(errorKey) ?? {
            date,
            device: deviceValue,
            audience: audienceValue,
            page,
            errorCode,
            count: 0,
          }
          current.count += 1
          errorsByKey.set(errorKey, current)
        }

        const pageCategory = event.event_name === "page_view"
          ? portalPageCategory(event.page_path)
          : isFeedbackOpen(event)
            ? "Feedback"
            : null
        if (pageCategory) {
          const pageKey = `${date}|${deviceValue}|${audienceValue}|${pageCategory}`
          const current = pageViewsByKey.get(pageKey) ?? {
            date,
            device: deviceValue,
            audience: audienceValue,
            page: pageCategory,
            sessions: new Set<string>(),
          }
          current.sessions.add(key)
          pageViewsByKey.set(pageKey, current)
        }

        if (userId) {
          const activityKey = `${deviceValue}|${audienceValue}`
          const activity = activityByKey.get(activityKey) ?? {
            signIns: new Map<string, Set<string>>(),
            engagements: new Map<string, Set<string>>(),
            sessions: new Map<string, Map<string, Set<string>>>(),
          }
          if (event.event_name === "sign_in_success") addUserDate(activity.signIns, userId, date)
          if (isEngagement(event)) addUserDate(activity.engagements, userId, date)
          addUserSessionDate(activity.sessions, userId, key, date)
          activityByKey.set(activityKey, activity)
        }
      }
    }
  }

  const eventDates = sortedEvents
    .map((event) => dayKey(event.occurred_at))
    .filter((date): date is string => Boolean(date))
  const firstDate = eventDates[0] ?? null
  const currentDate = dayKey(now.toISOString())
  const lastEventDate = eventDates.at(-1) ?? null
  const lastDate = currentDate && lastEventDate
    ? (currentDate > lastEventDate ? currentDate : lastEventDate)
    : currentDate ?? lastEventDate

  const monthlyActiveUsers: PortalUtilizationData["monthlyActiveUsers"] = []
  if (firstDate && lastDate) {
    for (const [key, activity] of activityByKey.entries()) {
      const [device, audience] = key.split("|") as [UtilizationDevice, UtilizationAudience]
      const users = new Set([...activity.signIns.keys(), ...activity.engagements.keys()])
      for (const date of dateSequence(firstDate, lastDate)) {
        const end = new Date(`${date}T00:00:00.000Z`)
        const start = new Date(end.getTime() - 29 * DAY_MS).toISOString().slice(0, 10)
        const members: PortalUtilizationData["monthlyActiveUsers"][number]["members"] = []
        for (const userId of users) {
          if (hasDateInWindow(activity.signIns.get(userId), start, date) &&
              hasDateInWindow(activity.engagements.get(userId), start, date)) {
            const profile = profilesById.get(userId)
            members.push({
              userId,
              fullName: memberName(profile),
              email: profile?.email ?? "",
              uniqueSessions: sessionCountInWindow(activity.sessions.get(userId), start, date),
            })
          }
        }
        members.sort((a, b) => (
          b.uniqueSessions - a.uniqueSessions ||
          a.fullName.localeCompare(b.fullName) ||
          a.email.localeCompare(b.email)
        ))
        monthlyActiveUsers.push({ date, device, audience, users: members.length, members })
      }
    }
  }

  const funnel = Array.from(funnelByKey.values())
    .map((row) => {
      const registrationTraffic = row.registrationTraffic.size
      const registrationCompleted = row.registrationCompleted.size
      const signInTraffic = row.signInTraffic.size
      const signInCompleted = row.signInCompleted.size
      return {
        date: row.date,
        device: row.device,
        audience: row.audience,
        registrationTraffic,
        registrationCompleted,
        registrationConversion: percent(registrationCompleted, registrationTraffic),
        signInTraffic,
        signInCompleted,
        signInConversion: percent(signInCompleted, signInTraffic),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const registrationFlowByKey = new Map<string, RegistrationFlowAccumulator>()
  const registrationFlowTrackingStartedAt = sortedEvents.find(
    (event) => (
      event.event_name === "registration_step_view"
      || event.event_name === "registration_submit"
    ),
  )?.occurred_at ?? null
  const registrationStageIds = REGISTRATION_FLOW_STAGES.map((stage) => stage.id)

  for (const session of sessions.values()) {
    const hasStepTracking = session.events.some((event) => registrationStep(event) != null)

    const homeIndex = session.events.findIndex((event) => (
      event.event_name === "page_view" && cleanPagePath(event.page_path) === "/"
    ))
    if (homeIndex < 0) continue

    const submittedIndex = session.events.findIndex((event, index) => (
      index > homeIndex && event.event_name === "registration_submit"
    ))
    if (!hasStepTracking && submittedIndex < 0) continue

    const reached: RegistrationFlowStageId[] = ["home"]
    let cursor = homeIndex
    const stepStageIds: RegistrationFlowStageId[] = ["account", "location", "background", "about"]
    if (submittedIndex >= 0) {
      // Submission is only possible after all four client-side steps validate,
      // so it safely reconstructs pre-fix sessions whose step events were
      // rejected by the database event-name constraint.
      reached.push(...stepStageIds)
      cursor = submittedIndex
    } else {
      for (let step = 1; step <= 4; step += 1) {
        const stepIndex = session.events.findIndex((event, index) => (
          index > cursor && registrationStep(event) === step
        ))
        if (stepIndex < 0) break
        reached.push(stepStageIds[step - 1])
        cursor = stepIndex
      }
    }
    if (reached.includes("about")) {
      const completedIndex = session.events.findIndex((event, index) => (
        index > cursor && event.event_name === "registration_success"
      ))
      if (completedIndex >= 0) reached.push("completed")
    }

    const date = dayKey(session.events[homeIndex].occurred_at)
    if (!date) continue
    const audiences: UtilizationAudience[] = session.audience === "unknown"
      ? ["all"]
      : ["all", session.audience]
    const devices: UtilizationDevice[] = ["all", session.device]
    for (const audience of audiences) {
      for (const device of devices) {
        const key = `${date}|${device}|${audience}`
        const row = registrationFlowByKey.get(key) ?? {
          date,
          device,
          audience,
          stages: emptyRegistrationStages(),
        }
        for (const stage of reached) row.stages[stage].add(session.sessionId)
        registrationFlowByKey.set(key, row)
      }
    }
  }

  const journeys = Array.from(sessions.values())
    .map((session) => {
      const startEvent = session.events.find((event) => (
        event.event_name === "registration_success" || event.event_name === "sign_in_success"
      ))
      if (!startEvent) return null
      const startType: "registration" | "sign_in" = startEvent.event_name === "registration_success" ? "registration" : "sign_in"
      const startIndex = session.events.indexOf(startEvent)
      const journeyDetail = buildJourneySteps(session.events, startIndex)
      const profile = session.userId ? profilesById.get(session.userId) : undefined
      return {
        sessionId: session.sessionId,
        memberName: memberName(profile),
        memberEmail: profile?.email ?? "",
        audience: session.audience,
        device: session.device,
        startType,
        startedAt: startEvent.occurred_at,
        lastSeenAt: session.lastSeenAt,
        durationSeconds: journeyDetail.durationSeconds,
        steps: journeyDetail.steps,
      }
    })
    .filter((journey): journey is NonNullable<typeof journey> => Boolean(journey))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const connectionCounts = new Map<string, number>()
  for (const connection of connections) {
    if (connection.status !== "accepted") continue
    connectionCounts.set(
      connection.requester_id,
      (connectionCounts.get(connection.requester_id) ?? 0) + 1,
    )
    connectionCounts.set(
      connection.addressee_id,
      (connectionCounts.get(connection.addressee_id) ?? 0) + 1,
    )
  }

  const signInsByUser = new Map<string, Map<Exclude<UtilizationDevice, "all">, {
    sessions: Map<string, string>
    lastSignedInAt: string | null
  }>>()
  for (const event of sortedEvents) {
    if (event.event_name !== "sign_in_success") continue
    const key = sessionKey(event)
    const userId = event.user_id ?? sessionUserIds.get(key)
    if (!userId) continue
    const eventDevice = sessionDevices.get(key) ?? analyticsDevice(event.metadata)
    const byDevice = signInsByUser.get(userId) ?? new Map()
    const activity = byDevice.get(eventDevice) ?? {
      sessions: new Map<string, string>(),
      lastSignedInAt: null,
    }
    activity.sessions.set(key, event.occurred_at)
    if (!activity.lastSignedInAt || event.occurred_at > activity.lastSignedInAt) {
      activity.lastSignedInAt = event.occurred_at
    }
    byDevice.set(eventDevice, activity)
    signInsByUser.set(userId, byDevice)
  }
  const signInWindowStart = new Date(now.getTime() - 29 * DAY_MS).toISOString()
  const deviceLabels: Exclude<UtilizationDevice, "all">[] = ["desktop", "mobile", "tablet", "unknown"]

  const members: PortalUtilizationData["members"] = profiles
    .map((profile) => {
      const byDevice = signInsByUser.get(profile.id)
      const signInActivity = {} as PortalUtilizationData["members"][number]["signInActivity"]
      let allLastSignedInAt = profile.last_sign_in_at ?? null
      const allRecentSessions = new Set<string>()

      for (const device of deviceLabels) {
        const activity = byDevice?.get(device)
        const recentSessions = Array.from(activity?.sessions.entries() ?? [])
          .filter(([, occurredAt]) => occurredAt >= signInWindowStart)
        signInActivity[device] = {
          lastSignedInAt: activity?.lastSignedInAt ?? null,
          signInsLast30Days: recentSessions.length,
        }
        for (const [sessionId] of recentSessions) allRecentSessions.add(sessionId)
        if (activity?.lastSignedInAt && (!allLastSignedInAt || activity.lastSignedInAt > allLastSignedInAt)) {
          allLastSignedInAt = activity.lastSignedInAt
        }
      }
      signInActivity.all = {
        lastSignedInAt: allLastSignedInAt,
        signInsLast30Days: allRecentSessions.size,
      }

      return {
        userId: profile.id,
        fullName: memberName(profile),
        email: profile.email ?? "",
        audience: profile.role ? "leadership" as const : "member" as const,
        firstRegisteredAt: profile.created_at ?? null,
        connectionCount: connectionCounts.get(profile.id) ?? 0,
        whatsappConnected: Boolean(profile.whatsapp_url?.trim()),
        mailchimpStatus: profile.mailchimp_status ?? "unknown",
        signInActivity,
      }
    })
    .sort((a, b) => (
      (b.signInActivity.all.lastSignedInAt ?? "").localeCompare(a.signInActivity.all.lastSignedInAt ?? "") ||
      (b.firstRegisteredAt ?? "").localeCompare(a.firstRegisteredAt ?? "") ||
      a.fullName.localeCompare(b.fullName)
    ))

  return {
    generatedAt: now.toISOString(),
    rawRetentionDays: RAW_RETENTION_DAYS,
    trackingAvailable: !analyticsError,
    trackingError: analyticsError,
    dateRange: { first: firstDate, last: lastDate },
    funnel,
    registrationFlow: {
      trackingStartedAt: registrationFlowTrackingStartedAt,
      rows: Array.from(registrationFlowByKey.values())
        .map((row) => ({
          date: row.date,
          device: row.device,
          audience: row.audience,
          ...Object.fromEntries(
            registrationStageIds.map((stage) => [stage, row.stages[stage].size]),
          ) as RegistrationFlowCounts,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
    monthlyActiveUsers,
    errors: Array.from(errorsByKey.values()).sort((a, b) => (
      a.date.localeCompare(b.date) || b.count - a.count
    )),
    pageViews: Array.from(pageViewsByKey.values())
      .map((row) => ({
        date: row.date,
        device: row.device,
        audience: row.audience,
        page: row.page,
        views: row.sessions.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.page.localeCompare(b.page)),
    trafficDevices: Array.from(deviceStats.entries())
      .map(([label, stats]) => ({
        label,
        sessions: stats.sessions.size,
        users: stats.users.size,
      }))
      .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label)),
    journeys,
    members,
    whatsapp: {
      linkedProfiles: profiles.filter((profile) => Boolean(profile.whatsapp_url?.trim())).length,
      onboardingComplete: onboardingRows.filter((row) => Boolean(row.whatsapp_completed_at)).length,
      totalMembers: profiles.length,
    },
  }
}

export type PortalJourneyFlowNode = {
  id: string
  parentId: string | null
  name: string
  label: string
  step: number
  sessions: number
  percentOfPrior: number
  selected?: boolean
  hasChildren?: boolean
}

export type PortalJourneyFlowData = {
  nodes: PortalJourneyFlowNode[]
  links: {
    source: number
    target: number
    value: number
  }[]
  maxStep: number
  maxNodesInStep: number
  totalSteps: number
  truncatedSessions: number
}

export function buildFocusedPortalJourneyFlow(
  flow: PortalJourneyFlowData,
  selectedNodeIds: Record<number, string> = {},
): PortalJourneyFlowData {
  if (!flow.nodes.length) return flow

  const childrenByParent = new Map<string, PortalJourneyFlowNode[]>()
  for (const node of flow.nodes) {
    if (!node.parentId) continue
    const children = childrenByParent.get(node.parentId) ?? []
    children.push(node)
    childrenByParent.set(node.parentId, children)
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))
  }

  const root = flow.nodes
    .filter((node) => node.parentId === null)
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))[0]
  if (!root) return flow

  const focusedNodes: PortalJourneyFlowNode[] = [{
    ...root,
    selected: true,
    hasChildren: Boolean(childrenByParent.get(root.id)?.length),
  }]
  const focusedLinksById: { sourceId: string; targetId: string; value: number }[] = []
  let selectedParent = root

  while (selectedParent.step < flow.maxStep) {
    const children = childrenByParent.get(selectedParent.id) ?? []
    if (!children.length) break

    const requestedId = selectedNodeIds[selectedParent.step + 1]
    const requestedChild = children.find((child) => child.id === requestedId)
    const defaultChild = children.find((child) => (
      child.label !== "End session" && Boolean(childrenByParent.get(child.id)?.length)
    )) ?? children.find((child) => child.label !== "End session") ?? children[0]
    const selectedChild = requestedChild ?? defaultChild

    for (const child of children) {
      focusedNodes.push({
        ...child,
        selected: child.id === selectedChild.id,
        hasChildren: Boolean(childrenByParent.get(child.id)?.length),
      })
      focusedLinksById.push({
        sourceId: selectedParent.id,
        targetId: child.id,
        value: child.sessions,
      })
    }
    selectedParent = selectedChild
  }

  const nodeIndex = new Map(focusedNodes.map((node, index) => [node.id, index]))
  const links = focusedLinksById.flatMap(({ sourceId, targetId, value }) => {
    const source = nodeIndex.get(sourceId)
    const target = nodeIndex.get(targetId)
    return source == null || target == null ? [] : [{ source, target, value }]
  })
  const focusedMaxStep = Math.max(...focusedNodes.map((node) => node.step), 0)
  const maxNodesInStep = Math.max(
    ...Array.from({ length: focusedMaxStep + 1 }, (_, step) => (
      focusedNodes.filter((node) => node.step === step).length
    )),
    0,
  )

  return {
    ...flow,
    nodes: focusedNodes,
    links,
    maxStep: flow.maxStep,
    maxNodesInStep,
  }
}

const JOURNEY_FLOW_EVENT_NAMES = new Set([
  "page_view",
  "curated_click",
  "event_rsvp_created",
  "event_rsvp_cancelled",
  "whatsapp_cta_clicked",
])

function journeyFlowPath(journey: PortalUtilizationData["journeys"][number]) {
  const actions = journey.steps
    .slice(1)
    .filter((step) => JOURNEY_FLOW_EVENT_NAMES.has(step.eventName))
    .map((step) => step.label)
    .filter((label, index, labels) => index === 0 || label !== labels[index - 1])
  return [
    journey.startType === "registration" ? "Registration" : "Sign-in",
    ...actions,
    "End session",
  ]
}

export function buildPortalJourneyFlow(
  journeys: PortalUtilizationData["journeys"],
  maxLabelsPerStep = 6,
  maxSteps = 5,
): PortalJourneyFlowData {
  if (!journeys.length) {
    return { nodes: [], links: [], maxStep: 0, maxNodesInStep: 0, totalSteps: 0, truncatedSessions: 0 }
  }

  const fullPaths = journeys.map(journeyFlowPath)
  const totalSteps = Math.max(...fullPaths.map((path) => path.length), 0)
  const visibleStepLimit = Math.max(1, maxSteps)
  const rawPaths = fullPaths.map((path) => path.slice(0, visibleStepLimit))
  const truncatedSessions = fullPaths.filter((path) => path.length > visibleStepLimit).length
  const labelCountsByStep = new Map<number, Map<string, number>>()
  for (const path of rawPaths) {
    path.forEach((label, step) => {
      const counts = labelCountsByStep.get(step) ?? new Map<string, number>()
      counts.set(label, (counts.get(label) ?? 0) + 1)
      labelCountsByStep.set(step, counts)
    })
  }

  const retainedLabelsByStep = new Map<number, Set<string>>()
  for (const [step, counts] of labelCountsByStep.entries()) {
    if (step === 0) {
      retainedLabelsByStep.set(step, new Set(counts.keys()))
      continue
    }
    const labels = Array.from(counts.entries())
      .filter(([label]) => label !== "End session")
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, maxLabelsPerStep)
      .map(([label]) => label)
    if (counts.has("End session")) labels.push("End session")
    retainedLabelsByStep.set(step, new Set(labels))
  }

  const paths = rawPaths.map((path) => path.map((label, step) => (
    retainedLabelsByStep.get(step)?.has(label) ? label : "Other"
  )))
  const nodeCounts = new Map<string, number>()
  const nodeMetadata = new Map<string, { label: string; step: number; parentId: string | null }>()
  const linkCounts = new Map<string, { sourceKey: string; targetKey: string; value: number }>()
  for (const path of paths) {
    const prefix: string[] = []
    path.forEach((label, step) => {
      const parentId = prefix.length ? JSON.stringify(prefix) : null
      prefix.push(label)
      const nodeKey = JSON.stringify(prefix)
      nodeCounts.set(nodeKey, (nodeCounts.get(nodeKey) ?? 0) + 1)
      if (!nodeMetadata.has(nodeKey)) {
        nodeMetadata.set(nodeKey, { label, step, parentId })
      }
      if (step === 0) return
      if (!parentId) return
      const linkKey = JSON.stringify([parentId, nodeKey])
      const link = linkCounts.get(linkKey) ?? { sourceKey: parentId, targetKey: nodeKey, value: 0 }
      link.value += 1
      linkCounts.set(linkKey, link)
    })
  }

  const nodeEntries = Array.from(nodeCounts.entries()).sort(([aKey, aCount], [bKey, bCount]) => {
    const aMetadata = nodeMetadata.get(aKey)
    const bMetadata = nodeMetadata.get(bKey)
    return (aMetadata?.step ?? 0) - (bMetadata?.step ?? 0) ||
      bCount - aCount ||
      (aMetadata?.label ?? "").localeCompare(bMetadata?.label ?? "")
  })
  const nodeIndex = new Map(nodeEntries.map(([key], index) => [key, index]))
  const nodes = nodeEntries.map(([key, sessions]) => {
    const metadata = nodeMetadata.get(key)
    const step = metadata?.step ?? 0
    const label = metadata?.label ?? "Unknown"
    const parentId = metadata?.parentId ?? null
    const priorTotal = parentId ? nodeCounts.get(parentId) ?? 0 : sessions
    return {
      id: key,
      parentId,
      name: label,
      label,
      step,
      sessions,
      percentOfPrior: priorTotal ? Math.round((sessions / priorTotal) * 1000) / 10 : 0,
    }
  })
  const links = Array.from(linkCounts.values()).flatMap(({ sourceKey, targetKey, value }) => {
    const source = nodeIndex.get(sourceKey)
    const target = nodeIndex.get(targetKey)
    return source == null || target == null ? [] : [{ source, target, value }]
  })
  const maxStep = Math.max(...nodes.map((node) => node.step), 0)
  const maxNodesInStep = Math.max(
    ...Array.from({ length: maxStep + 1 }, (_, step) => nodes.filter((node) => node.step === step).length),
    0,
  )

  return { nodes, links, maxStep, maxNodesInStep, totalSteps, truncatedSessions }
}

export function buildRegistrationStepFlow(
  counts: RegistrationFlowCounts,
): PortalJourneyFlowData {
  if (!counts.home) {
    return { nodes: [], links: [], maxStep: 0, maxNodesInStep: 0, totalSteps: 0, truncatedSessions: 0 }
  }

  const nodes: PortalJourneyFlowNode[] = []
  const links: PortalJourneyFlowData["links"] = []
  const mainNodeIndexes = new Map<RegistrationFlowStageId, number>()
  const visibleStages = REGISTRATION_FLOW_STAGES.filter((stage, index) => (
    index === 0 || counts[stage.id] > 0
  ))

  for (let index = 0; index < visibleStages.length; index += 1) {
    const stage = visibleStages[index]
    const sessions = counts[stage.id]
    const priorSessions = index === 0
      ? sessions
      : counts[visibleStages[index - 1].id]
    mainNodeIndexes.set(stage.id, nodes.length)
    nodes.push({
      id: `registration:${stage.id}`,
      parentId: index > 0 ? `registration:${visibleStages[index - 1].id}` : null,
      name: stage.label,
      label: stage.label,
      step: index,
      sessions,
      percentOfPrior: priorSessions ? Math.round((sessions / priorSessions) * 1000) / 10 : 0,
    })
  }

  for (let index = 0; index < REGISTRATION_FLOW_STAGES.length - 1; index += 1) {
    const current = REGISTRATION_FLOW_STAGES[index]
    const next = REGISTRATION_FLOW_STAGES[index + 1]
    const currentCount = counts[current.id]
    const nextCount = counts[next.id]
    if (!currentCount) break
    const sourceIndex = mainNodeIndexes.get(current.id)
    if (sourceIndex == null) break
    if (nextCount > 0) {
      const targetIndex = mainNodeIndexes.get(next.id)
      if (targetIndex == null) break
      links.push({
        source: sourceIndex,
        target: targetIndex,
        value: nextCount,
      })
    }

    const dropOff = Math.max(0, currentCount - nextCount)
    if (!dropOff) continue
    const exitIndex = nodes.length
    const exitLabel = index === 0
      ? `Exited before ${next.label}`
      : `Exited after ${current.label}`
    nodes.push({
      id: `registration:exit:${current.id}`,
      parentId: `registration:${current.id}`,
      name: exitLabel,
      label: exitLabel,
      step: index + 1,
      sessions: dropOff,
      percentOfPrior: currentCount ? Math.round((dropOff / currentCount) * 1000) / 10 : 0,
    })
    links.push({
      source: sourceIndex,
      target: exitIndex,
      value: dropOff,
    })
  }

  return {
    nodes,
    links,
    maxStep: Math.max(...nodes.map((node) => node.step), 0),
    maxNodesInStep: 2,
    totalSteps: visibleStages.length,
    truncatedSessions: 0,
  }
}
