import type { LegacyAnalyticsSnapshot } from "./types"

export type PortalEventForAnalytics = {
  id: string
  title: string
  startsAt: string | null
  eventType: string | null
  status: string | null
  externalEventId: string | null
  registrationCount: number
  registrations: { memberName: string; memberEmail: string; registeredAt: string }[]
}

export type AnalyticsSourceRecord = {
  source: string
  record_type: string
  source_record_id: string
  event_source_id: string | null
  event_name: string | null
  event_started_at: string | null
  occurred_at: string | null
  registered_at: string | null
  name: string | null
  email: string | null
  normalized_email: string | null
  attended: boolean | null
  duration_minutes: number | null
  details: Record<string, unknown> | null
}

type ZoomEvent = LegacyAnalyticsSnapshot["events"]["zoom"]["events"][number] & {
  source?: "zoom" | "portal"
  portalEventId?: string
  portalExternalEventId?: string | null
  status?: string | null
}

function normalizedEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase()
}

function personKey(value: { email?: string | null; name?: string | null }) {
  return normalizedEmail(value.email) || String(value.name ?? "").trim().toLowerCase()
}

function dateKey(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function titleWords(value: string | null | undefined) {
  const stopWords = new Set(["with", "seminar", "roundtable", "talk", "workshop", "event", "labs", "psychedelx", "consciousness", "ipn"])
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
}

function titlesLikelyMatch(portalTitle: string, zoomTitle: string) {
  const portalWords = new Set(titleWords(portalTitle))
  const zoomWords = titleWords(zoomTitle)
  const shared = zoomWords.filter((word) => portalWords.has(word)).length
  return shared >= Math.min(3, Math.max(1, Math.min(portalWords.size, zoomWords.length)))
}

function portalProgram(eventType: string | null) {
  const normalized = String(eventType ?? "").toLowerCase()
  if (normalized.includes("psychedelx")) return "PsychedelX"
  if (normalized.includes("lab")) return "IPN Labs"
  return "Other"
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function assembleServerEventAnalytics({
  snapshot,
  portalEvents,
  sourceRecords,
  now = new Date(),
}: {
  snapshot: LegacyAnalyticsSnapshot
  portalEvents: PortalEventForAnalytics[]
  sourceRecords: AnalyticsSourceRecord[]
  now?: Date
}) {
  const result = JSON.parse(JSON.stringify(snapshot)) as LegacyAnalyticsSnapshot
  const zoom = result.events.zoom
  const existingBySourceId = new Map(zoom.events.map((event) => [event.id, event]))
  const recordGroups = new Map<string, AnalyticsSourceRecord[]>()
  for (const record of sourceRecords) {
    if (record.source !== "zoom" || !record.event_source_id) continue
    const group = recordGroups.get(record.event_source_id) ?? []
    group.push(record)
    recordGroups.set(record.event_source_id, group)
  }

  const groups = Array.from(recordGroups.entries()).map(([id, records]) => ({
    id,
    records,
    topic: records.find((record) => record.event_name)?.event_name ?? existingBySourceId.get(id)?.topic ?? "Zoom event",
    date: records.find((record) => record.event_started_at)?.event_started_at ?? existingBySourceId.get(id)?.date ?? null,
  }))
  const consumedGroups = new Set<string>()
  const assembled: ZoomEvent[] = []

  for (const portalEvent of portalEvents) {
    const sameDayGroups = groups.filter((group) => !consumedGroups.has(group.id) && dateKey(group.date) === dateKey(portalEvent.startsAt))
    const group = groups.find((candidate) => (
      !consumedGroups.has(candidate.id)
      && portalEvent.externalEventId
      && candidate.id === portalEvent.externalEventId
    )) ?? sameDayGroups.find((candidate) => titlesLikelyMatch(portalEvent.title, candidate.topic))
      ?? (sameDayGroups.length === 1 ? sameDayGroups[0] : null)

    if (!group) {
      const isFuture = portalEvent.startsAt ? new Date(portalEvent.startsAt) > now : false
      assembled.push({
        id: portalEvent.id,
        topic: portalEvent.title,
        date: portalEvent.startsAt,
        program: portalProgram(portalEvent.eventType),
        type: "public",
        attendees: 0,
        registrants: portalEvent.registrationCount,
        registrationSource: isFuture ? "portal" : "portal_unmatched_ended",
        avgDuration: 0,
        retentionPct: 0,
        repeatPct: 0,
        participantEmails: [],
        participants: [],
        registrations: portalEvent.registrations.map((registration) => ({
          name: registration.memberName,
          email: registration.memberEmail,
          registeredAt: registration.registeredAt,
        })),
        source: isFuture ? "portal" : "zoom",
        portalEventId: portalEvent.id,
        portalExternalEventId: portalEvent.externalEventId,
        status: portalEvent.status,
      })
      continue
    }

    consumedGroups.add(group.id)
    const participantMap = new Map<string, ZoomEvent["participants"][number]>()
    const registrationMap = new Map<string, ZoomEvent["registrations"][number]>()
    for (const record of group.records) {
      const key = personKey(record)
      if (!key) continue
      if (record.record_type.startsWith("participant") || record.attended === true) {
        const current = participantMap.get(key)
        const durationMin = Number(record.duration_minutes ?? 0)
        participantMap.set(key, {
          name: record.name || record.email || current?.name || "Unknown",
          email: record.email || current?.email || "",
          durationMin: Math.max(durationMin, current?.durationMin ?? 0),
          eventsAttended: 0,
          daysAttended: Number(record.details?.daysAttended ?? current?.daysAttended ?? 0) || null,
          roles: Array.isArray(record.details?.roles) ? record.details.roles as string[] : current?.roles ?? [],
          countries: Array.isArray(record.details?.countries) ? record.details.countries as string[] : current?.countries ?? [],
        })
      }
      if (record.record_type === "registrant") {
        registrationMap.set(key, {
          name: record.name || record.email || "Unknown",
          email: record.email || "",
          registeredAt: record.registered_at,
        })
      }
    }
    const zoomRegistrationKeys = new Set(registrationMap.keys())
    for (const registration of portalEvent.registrations) {
      const key = personKey({ email: registration.memberEmail, name: registration.memberName })
      if (!key || registrationMap.has(key)) continue
      registrationMap.set(key, {
        name: registration.memberName,
        email: registration.memberEmail,
        registeredAt: registration.registeredAt,
      })
    }
    const participants = Array.from(participantMap.values())
    const existing = existingBySourceId.get(group.id)
    const portalRegistrationKeys = new Set(
      portalEvent.registrations
        .map((registration) => personKey({ email: registration.memberEmail, name: registration.memberName }))
        .filter(Boolean),
    )
    const knownOverlap = Array.from(portalRegistrationKeys).filter((key) => zoomRegistrationKeys.has(key)).length
    const zoomRegistrantCount = Math.max(
      zoomRegistrationKeys.size,
      Number.isFinite(Number(existing?.registrants)) ? Number(existing?.registrants) : 0,
    )
    const portalRegistrantCount = Math.max(portalEvent.registrationCount, portalRegistrationKeys.size)
    const isPortalZoomTransition = dateKey(portalEvent.startsAt ?? group.date) === "2026-07-07"
    const reconciledRegistrantCount = isPortalZoomTransition
      ? Math.max(registrationMap.size, portalRegistrantCount + zoomRegistrantCount - knownOverlap)
      : Math.max(portalRegistrantCount, registrationMap.size)
    const registrations = Array.from(registrationMap.values())
      .sort((a, b) => String(a.registeredAt ?? "").localeCompare(String(b.registeredAt ?? "")))
    assembled.push({
      id: portalEvent.id,
      topic: portalEvent.title,
      date: portalEvent.startsAt ?? group.date,
      program: portalProgram(portalEvent.eventType),
      type: existing?.type ?? "public",
      attendees: participants.length,
      registrants: reconciledRegistrantCount,
      registrationSource: isPortalZoomTransition ? "portal-zoom-transition" : "portal",
      avgDuration: round(average(participants.map((participant) => participant.durationMin))),
      retentionPct: existing?.retentionPct ?? 0,
      repeatPct: 0,
      participantEmails: participants.map((participant) => participant.email).filter(Boolean),
      participants,
      registrations,
      source: "zoom",
      portalEventId: portalEvent.id,
      portalExternalEventId: group.id,
      status: portalEvent.status,
    })
  }

  for (const event of zoom.events) {
    if (!consumedGroups.has(event.id)) assembled.push(event)
  }

  const attendanceByPerson = new Map<string, number>()
  for (const event of [...assembled].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())) {
    for (const participant of event.participants) {
      const key = personKey(participant)
      participant.eventsAttended = attendanceByPerson.get(key) ?? 0
      attendanceByPerson.set(key, (attendanceByPerson.get(key) ?? 0) + 1)
    }
    event.repeatPct = event.participants.length
      ? event.participants.filter((participant) => participant.eventsAttended > 0).length / event.participants.length * 100
      : 0
  }

  const attendeeSummary = new Map<string, LegacyAnalyticsSnapshot["events"]["zoom"]["topAttendees"][number]>()
  for (const event of assembled) {
    for (const participant of event.participants) {
      const key = personKey(participant)
      if (!key) continue
      const current = attendeeSummary.get(key) ?? {
        name: participant.name,
        email: participant.email,
        events: 0,
        totalDurationMin: 0,
        lastEventDate: null,
      }
      current.events += 1
      current.totalDurationMin += participant.durationMin
      if (!current.lastEventDate || new Date(event.date ?? 0) > new Date(current.lastEventDate)) current.lastEventDate = event.date
      attendeeSummary.set(key, current)
    }
  }
  const topAttendees = Array.from(attendeeSummary.values())
    .sort((a, b) => b.events - a.events || b.totalDurationMin - a.totalDurationMin)

  const includedEvents = assembled.filter((event) => event.source !== "portal")
  const byMonth = new Map<string, { events: number; participants: number; retention: number }>()
  for (const event of includedEvents) {
    const month = dateKey(event.date).slice(0, 7) || "Unknown"
    const current = byMonth.get(month) ?? { events: 0, participants: 0, retention: 0 }
    current.events += 1
    current.participants += event.attendees
    current.retention += event.retentionPct
    byMonth.set(month, current)
  }
  zoom.events = assembled.sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
  zoom.topAttendees = topAttendees.slice(0, 25)
  zoom.byMonth = Array.from(byMonth.entries()).map(([month, value]) => ({
    month,
    events: value.events,
    participants: value.participants,
    avgParticipants: round(value.participants / Math.max(value.events, 1)),
    retentionPct: round(value.retention / Math.max(value.events, 1)),
  }))
  zoom.stats = {
    ...zoom.stats,
    totalEvents: includedEvents.length,
    totalParticipants: includedEvents.reduce((sum, event) => sum + event.attendees, 0),
    avgParticipants: round(average(includedEvents.map((event) => event.attendees))),
    avgRetentionPct: round(average(includedEvents.map((event) => event.retentionPct))),
    avgDurationMin: round(average(includedEvents.map((event) => event.avgDuration))),
    repeatRatePct: topAttendees.length ? topAttendees.filter((attendee) => attendee.events > 1).length / topAttendees.length * 100 : 0,
    uniqueAttendees: topAttendees.length,
  }

  return result
}
