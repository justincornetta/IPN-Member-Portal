import "server-only"

import snapshot from "./legacy-snapshot.json"
import type { LegacyAnalyticsSnapshot } from "./types"

const CURATED_ZOOM_EVENT_IDS = new Set([
  "MEC+Fc0KR9qN8OCYHNGhSQ==",
  "dHTIVmqoRTiLtisR9GZqGw==",
  "XI9vLPeLSKOMx4VF7xZCiA==",
  "D+TddOtUScuXI5ywbEPisQ==",
  "FjFfAFbgRzSnpi4kB2vfyg==",
  "oj7jfiSkSxmb1P5a6Wgacg==",
  "Lq4FQ0dgS0ix5ARG+p/FwA==",
  "2GRJYuBvShenai9jlupTLQ==",
  "w5q9zBrtTxKq2s+Va2PLDQ==",
  "rmbM8Hc4Snq7H6sSV3fQfA==",
  "Rou4Q15dQcuKsSFxuC3TEg==",
  "xImfgyAlRresYfbr1qlOiQ==",
])

const ZOOM_WORKSHOP_4: LegacyAnalyticsSnapshot["events"]["zoom"]["events"][number] = {
  id: "Rou4Q15dQcuKsSFxuC3TEg==",
  topic: "PsychedelX: Workshop #4 Tech Talk (Optional)",
  date: "2026-05-30T16:01:40Z",
  program: "PsychedelX",
  type: "public",
  inclusionStatus: "included",
  inclusionNote: "Approved participant-facing PsychedelX workshop backfilled from the legacy Zoom export.",
  attendees: 3,
  registrants: null,
  avgDuration: 22.1,
  retentionPct: 37.4,
  repeatPct: 100,
  participantEmails: ["ipnpsychedelics@gmail.com"],
  participants: [
    { name: "IPN", email: "ipnpsychedelics@gmail.com", durationMin: 58.4, eventsAttended: 0 },
    { name: "Omer Syed", email: "", durationMin: 25, eventsAttended: 0 },
    { name: "Mirko Vercelli", email: "", durationMin: 26.6, eventsAttended: 0 },
  ],
  registrations: [],
}

function cloneSnapshot(): LegacyAnalyticsSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as LegacyAnalyticsSnapshot
}

function monthKey(value: string | null | undefined) {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toISOString().slice(0, 7)
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function normalizeZoom(snapshotData: LegacyAnalyticsSnapshot) {
  const zoom = snapshotData.events.zoom
  const byId = new Map(zoom.events.map((event) => [event.id, event]))
  if (!byId.has(ZOOM_WORKSHOP_4.id)) {
    byId.set(ZOOM_WORKSHOP_4.id, ZOOM_WORKSHOP_4)
  }

  const curatedEvents = Array.from(byId.values())
    .filter((event) => CURATED_ZOOM_EVENT_IDS.has(event.id))
    .map((event) => ({
      ...event,
      inclusionStatus: "included" as const,
      inclusionNote: event.id === ZOOM_WORKSHOP_4.id
        ? ZOOM_WORKSHOP_4.inclusionNote
        : "Approved external IPN Labs/PsychedelX event.",
    }))
    .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())

  const attendeeMap = new Map<string, { name: string; email: string; events: number; totalDurationMin: number; lastEventDate: string | null }>()
  for (const event of curatedEvents) {
    for (const participant of event.participants) {
      const key = participant.email || participant.name
      if (!key) continue
      const current = attendeeMap.get(key) ?? {
        name: participant.name || participant.email || "Unknown",
        email: participant.email,
        events: 0,
        totalDurationMin: 0,
        lastEventDate: null,
      }
      current.events += 1
      current.totalDurationMin += participant.durationMin || 0
      if (!current.lastEventDate || new Date(event.date ?? 0) > new Date(current.lastEventDate)) {
        current.lastEventDate = event.date
      }
      attendeeMap.set(key, current)
    }
  }

  const monthly = new Map<string, { month: string; events: number; participants: number; retentionTotal: number }>()
  for (const event of curatedEvents) {
    const key = monthKey(event.date)
    const current = monthly.get(key) ?? { month: key, events: 0, participants: 0, retentionTotal: 0 }
    current.events += 1
    current.participants += event.attendees
    current.retentionTotal += event.retentionPct
    monthly.set(key, current)
  }

  const attendees = Array.from(attendeeMap.values()).sort((a, b) => b.events - a.events || b.totalDurationMin - a.totalDurationMin)
  const totalParticipants = curatedEvents.reduce((sum, event) => sum + event.attendees, 0)
  zoom.events = curatedEvents
  zoom.byMonth = Array.from(monthly.values()).map((item) => ({
    month: item.month,
    events: item.events,
    participants: item.participants,
    avgParticipants: round(item.participants / item.events),
    retentionPct: round(item.retentionTotal / item.events),
  }))
  zoom.topAttendees = attendees.slice(0, 25)
  zoom.stats = {
    ...zoom.stats,
    totalEvents: curatedEvents.length,
    totalParticipants,
    avgParticipants: round(totalParticipants / Math.max(curatedEvents.length, 1)),
    avgRetentionPct: round(average(curatedEvents.map((event) => event.retentionPct))),
    avgDurationMin: round(average(curatedEvents.map((event) => event.avgDuration))),
    repeatRatePct: round(attendees.filter((attendee) => attendee.events > 1).length / Math.max(attendees.length, 1) * 100),
    uniqueAttendees: attendees.length,
  }
}

function normalizeEventbrite(snapshotData: LegacyAnalyticsSnapshot) {
  const eventbrite = snapshotData.events.eventbrite
  eventbrite.events = eventbrite.events.filter((event) => {
    const name = event.name.toLowerCase()
    return name.includes("psychedelx") || name.includes("student & rising professionals mixer")
  })
  eventbrite.summary = {
    ...eventbrite.summary,
    totalEvents: eventbrite.events.length,
    ticketsSold: eventbrite.events.reduce((sum, event) => sum + event.tickets, 0),
    grossRevenue: eventbrite.events.reduce((sum, event) => sum + event.grossRevenue, 0),
    activeEvents: eventbrite.events.filter((event) => event.status === "live" || event.status === "started").length,
    upcomingEvents: eventbrite.events.filter((event) => new Date(event.date ?? 0) > new Date()).length,
  }
}

function normalizeMembership(snapshotData: LegacyAnalyticsSnapshot) {
  snapshotData.members.sourceTotals = snapshotData.members.sourceTotals.filter((source) => source.id !== "eventbrite" && source.id !== "zoom")
  snapshotData.members.sourceCombinations = snapshotData.members.sourceCombinations.filter((source) => {
    const label = source.label.toLowerCase()
    return !label.includes("eventbrite") && !label.includes("zoom")
  })
}

function normalizeSourceStatus(snapshotData: LegacyAnalyticsSnapshot) {
  snapshotData.dataSources = snapshotData.dataSources.map((source) => {
    if (source.id === "zoom") {
      return {
        ...source,
        status: "watch",
        note: "Legacy refresh is stale after May 31, 2026; curated events include the approved May 30 backfill. Future source should be Portal RSVPs plus Zoom attendance.",
      }
    }
    if (source.id === "eventbrite") {
      return {
        ...source,
        note: "Counts include PsychedelX conferences and IPN student/professional mixers; unrelated one-offs are excluded from Analytics totals.",
      }
    }
    return source
  })
}

export async function getLegacyAnalyticsSnapshot(): Promise<LegacyAnalyticsSnapshot> {
  const snapshotData = cloneSnapshot()
  normalizeMembership(snapshotData)
  normalizeZoom(snapshotData)
  normalizeEventbrite(snapshotData)
  normalizeSourceStatus(snapshotData)
  return snapshotData
}
