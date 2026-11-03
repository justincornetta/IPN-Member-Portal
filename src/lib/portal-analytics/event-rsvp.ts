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
  session_id: string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
}
export type RsvpJourney = {
  date: string
  eventSlug: string
  path: RsvpPath
  stages: RsvpStage[]
  signupCompleted: boolean
}

export function buildRsvpJourneys(events: Observation[]): RsvpJourney[] {
  const journeys = new Map<string, RsvpJourney>()
  const lastSignupBySession = new Map<string, string>()
  for (const event of [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (!event.session_id) continue
    if (event.event_name === 'registration_success') {
      const signupKey = lastSignupBySession.get(event.session_id)
      const row = signupKey ? journeys.get(signupKey) : undefined
      if (row) row.signupCompleted = true
      continue
    }
    const metadata = event.event_name === 'curated_click' ? rsvpMetadata(event.metadata ?? {}) : null
    if (!metadata) continue
    const key = JSON.stringify([event.session_id, metadata.eventSlug, metadata.path])
    const row = journeys.get(key) ?? {
      date: event.occurred_at.slice(0, 10), eventSlug: metadata.eventSlug,
      path: metadata.path, stages: [], signupCompleted: false,
    }
    if (!row.stages.includes(metadata.stage)) row.stages.push(metadata.stage)
    journeys.set(key, row)
    if (metadata.stage === 'signup') lastSignupBySession.set(event.session_id, key)
  }
  return [...journeys.values()]
}
