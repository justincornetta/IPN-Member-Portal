import type { PortalAnalyticsEvent } from "../../../app/dashboard/admin/AnalyticsDashboardShell"
import type { AnalyticsEligibilityProfile, ParticipationActivityInput } from "./onboarding"

export type CommunityConferenceInput = {
  id: string; name: string; starts_at: string | null; ends_at: string | null; status: string
  meetups: { id: string; title: string; startsAt: string; endsAt?: string | null }[] | null
}
export type CommunityRsvpInput = { conference_id: string; user_id: string; created_at: string; meetup_id?: string }
export type CommunityAnalyticsEvent = PortalAnalyticsEvent & {
  kind: "conference" | "meetup"; conferenceName: string; endsAt: string | null
  registrationCoverage: "portal" | "unavailable"
}

export function buildCommunityAnalyticsEvents({ conferences, historicalConferences = [], conferenceRsvps, meetupRsvps, profiles, participationRows = [] }: {
  conferences: CommunityConferenceInput[]
  historicalConferences?: { id: string; name: string; starts_at: string | null; ends_at: string | null }[]
  conferenceRsvps: CommunityRsvpInput[]; meetupRsvps: CommunityRsvpInput[]
  profiles: AnalyticsEligibilityProfile[]; participationRows?: ParticipationActivityInput[]
}): CommunityAnalyticsEvent[] {
  const profileById = new Map(profiles.filter((profile) => profile.is_banned !== true && profile.exclude_from_analytics !== true).map((profile) => [profile.id, profile]))
  function build(conference: CommunityConferenceInput, meetup?: NonNullable<CommunityConferenceInput["meetups"]>[number]): CommunityAnalyticsEvent {
    const current = (meetup ? meetupRsvps : conferenceRsvps).filter((row) => row.conference_id === conference.id
      && (!meetup || row.meetup_id === meetup.id) && profileById.has(row.user_id))
    const facts = participationRows.filter((row) => row.activity_type === (meetup ? "conference_meetup_rsvp" : "conference_rsvp")
      && row.metadata?.conference_id === conference.id && (!meetup || row.metadata?.meetup_id === meetup.id) && profileById.has(row.user_id))
    const history = new Map<string, { userId: string; registeredAt: string }>()
    for (const row of current) history.set(`${row.user_id}:${Date.parse(row.created_at)}`, { userId: row.user_id, registeredAt: row.created_at })
    for (const fact of facts) if (fact.action === "completed" && Number.isFinite(Date.parse(fact.occurred_at))) {
      history.set(`${fact.user_id}:${Date.parse(fact.occurred_at)}`, { userId: fact.user_id, registeredAt: fact.occurred_at })
    }
    const registrations = [...history.values()].map((row) => {
      const profile = profileById.get(row.userId)!
      return { ...row, memberName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Unknown member", memberEmail: profile.email ?? "" }
    }).sort((a, b) => Date.parse(a.registeredAt) - Date.parse(b.registeredAt))
    return {
      id: meetup ? `conference-meetup:${conference.id}:${meetup.id}` : `conference:${conference.id}`,
      title: meetup ? `${meetup.title} · ${conference.name}` : conference.name,
      slug: null, startsAt: meetup?.startsAt ?? conference.starts_at, endsAt: meetup?.endsAt ?? (meetup ? null : conference.ends_at),
      eventType: "Community", status: conference.status, externalEventId: null,
      kind: meetup ? "meetup" : "conference", conferenceName: conference.name, registrationCoverage: "portal",
      registrationCount: new Set(current.map((row) => row.user_id)).size,
      totalRegistrationsEver: registrations.length,
      cancellationCount: new Set(facts.filter((row) => row.action === "cancelled").map((row) => row.source_record_id ?? row.id ?? `${row.user_id}:${row.occurred_at}`)).size,
      lastRsvpAt: registrations.at(-1)?.registeredAt ?? null, registrations,
    }
  }
  const visible = conferences.filter((conference) => conference.status !== "draft")
  const events = visible.flatMap((conference) => [build(conference), ...(conference.meetups ?? []).map((meetup) => build(conference, meetup))])
  const key = (row: { name: string; starts_at: string | null }) => `${row.name.trim().toLowerCase()}:${row.starts_at?.slice(0, 10) ?? ""}`
  const known = new Set(conferences.map(key))
  for (const conference of historicalConferences) {
    if (known.has(key(conference))) continue
    events.push({ ...build({ ...conference, status: "archived", meetups: [] }), id: `past-conference:${conference.id}`, registrationCoverage: "unavailable" })
  }
  return events
}
