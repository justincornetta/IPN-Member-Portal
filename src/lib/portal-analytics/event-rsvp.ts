// Shared vocabulary for privacy-safe browser observations, not attendance records.
export const RSVP_STAGES = [
  'view', 'open', 'submit', 'confirmed', 'error', 'calendar', 'join', 'signup',
] as const
export type RsvpStage = typeof RSVP_STAGES[number]
export type RsvpPath = 'visitor' | 'guest' | 'member_login' | 'member'

export function rsvpMetadata(value: Record<string, unknown>) {
  if (
    value.flow !== 'event_rsvp' ||
    typeof value.eventSlug !== 'string' ||
    !/^[a-z0-9-]{1,200}$/.test(value.eventSlug) ||
    !RSVP_STAGES.includes(value.stage as RsvpStage) ||
    !['visitor', 'guest', 'member_login', 'member'].includes(String(value.path))
  ) return null

  return {
    flow: 'event_rsvp', eventSlug: value.eventSlug,
    stage: value.stage as RsvpStage, path: value.path as RsvpPath,
  }
}

type Observation = {
  event_name: string
  user_id?: string | null
  session_id: string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
}
export type RsvpMemberActivity = {
  userId: string
  stages: RsvpStage[]
  lastAt: string
  accountCreated: boolean
}
export type RsvpJourney = {
  sessionGroup?: number
  members?: RsvpMemberActivity[]
  date: string
  eventSlug: string
  path: RsvpPath
  stages: RsvpStage[]
  signupCompleted: boolean
}

export function buildRsvpJourneys(events: Observation[]): RsvpJourney[] {
  const journeys = new Map<string, RsvpJourney>()
  const lastSignupBySession = new Map<string, string>()
  const eventSessions = new Map<string, { id: number; date: string }>()
  function recordMember(row: RsvpJourney, event: Observation, stage?: RsvpStage) {
    if (!event.user_id) return
    const members = row.members ??= []
    let member = members.find(m => m.userId === event.user_id)
    if (!member) {
      member = { userId: event.user_id, stages: [], lastAt: event.occurred_at, accountCreated: false }
      members.push(member)
    }
    if (stage && !member.stages.includes(stage)) member.stages.push(stage)
    member.lastAt = event.occurred_at
    if (event.event_name === "registration_success") member.accountCreated = true
  }
  for (const event of [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (!event.session_id) continue
    if (event.event_name === 'registration_success') {
      const signupKey = lastSignupBySession.get(event.session_id)
      const row = signupKey ? journeys.get(signupKey) : undefined
      if (row) { row.signupCompleted = true; recordMember(row, event) }
      continue
    }
    const metadata = event.event_name === 'curated_click' ? rsvpMetadata(event.metadata ?? {}) : null
    if (!metadata) continue
    const key = JSON.stringify([event.session_id, metadata.eventSlug, metadata.path])
    const eventSessionKey = JSON.stringify([event.session_id, metadata.eventSlug])
    const eventSession = eventSessions.get(eventSessionKey) ?? { id: eventSessions.size, date: event.occurred_at.slice(0, 10) }
    eventSessions.set(eventSessionKey, eventSession)
    const row: RsvpJourney = journeys.get(key) ?? {
      sessionGroup: eventSession.id, members: [],
      date: eventSession.date, eventSlug: metadata.eventSlug,
      path: metadata.path, stages: [], signupCompleted: false,
    }
    if (!row.stages.includes(metadata.stage)) row.stages.push(metadata.stage)
    recordMember(row, event, metadata.stage)
    journeys.set(key, row)
    if (metadata.stage === 'signup') lastSignupBySession.set(event.session_id, key)
  }
  return [...journeys.values()]
}

export function summarizeRsvpJourneys(rows: RsvpJourney[]) {
  const sessions = new Map<number, { stages: Set<RsvpStage>; account: boolean }>()
  const members = new Map<string, {
    userId: string; sessions: Set<number>; paths: Set<RsvpPath>;
    stages: Map<RsvpStage, Set<number>>; lastAt: string; accountCreated: boolean
  }>()
  rows.forEach((row, index) => {
    // Fallback supports older fixtures; production rows always carry a group.
    const key = row.sessionGroup ?? -(index + 1)
    const session = sessions.get(key) ?? { stages: new Set<RsvpStage>(), account: false }
    row.stages.forEach(stage => session.stages.add(stage))
    session.account ||= row.signupCompleted
    sessions.set(key, session)
    for (const activity of row.members ?? []) {
      const member = members.get(activity.userId) ?? {
        userId: activity.userId, sessions: new Set<number>(), paths: new Set<RsvpPath>(),
        stages: new Map<RsvpStage, Set<number>>(), lastAt: '', accountCreated: false,
      }
      member.sessions.add(key)
      member.paths.add(row.path)
      for (const stage of activity.stages) {
        const stageSessions = member.stages.get(stage) ?? new Set<number>()
        stageSessions.add(key)
        member.stages.set(stage, stageSessions)
      }
      if (activity.lastAt > member.lastAt) member.lastAt = activity.lastAt
      member.accountCreated ||= activity.accountCreated
      members.set(activity.userId, member)
    }
  })
  const counts = Object.fromEntries(RSVP_STAGES.map(stage => [
    stage, [...sessions.values()].filter(session => session.stages.has(stage)).length,
  ])) as Record<RsvpStage, number>
  const completed = [...sessions.values()].filter(s => s.stages.has('submit') && s.stages.has('confirmed')).length
  return {
    counts, sessions: sessions.size, members: [...members.values()],
    accounts: [...sessions.values()].filter(s => s.account).length,
    success: counts.submit ? Math.round(completed / counts.submit * 100) : null,
  }
}
