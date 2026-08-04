import "server-only"

import snapshot from "./legacy-snapshot.json"
import type { LegacyAnalyticsSnapshot } from "./types"
import { CURATED_ZOOM_EVENT_IDS } from "./zoom-curation.js"
import { createAdminClient } from "@/lib/supabase/admin"

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
  snapshotData.dataSources = snapshotData.dataSources
    .filter((source) => source.id !== "donations")
    .map((source) => {
    if (source.id === "zoom") {
      return {
        ...source,
        status: "watch",
        note: "Zoom attendee reports refresh from the API. Historical attendance is supplemented by reviewed backfills, and Portal RSVPs are the registrant source of truth beginning July 1, 2026.",
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

type SocialSnapshotRow = {
  platform: "instagram" | "facebook" | "linkedin"
  snapshot_date: string
  follower_count: number
  engagement_rate: number | null
  posts_count: number | null
  source: "api" | "manual" | "backfill"
  captured_at: string
}

function applyPersistentSocialHistory(
  snapshotData: LegacyAnalyticsSnapshot,
  rows: SocialSnapshotRow[],
) {
  const supportedPlatforms = [
    { id: "instagram", label: "Instagram" },
    { id: "facebook", label: "Facebook" },
    { id: "linkedin", label: "LinkedIn" },
  ] as const
  const latestByPlatform = new Map<string, SocialSnapshotRow>()
  for (const row of rows) {
    const current = latestByPlatform.get(row.platform)
    if (!current || row.snapshot_date > current.snapshot_date) latestByPlatform.set(row.platform, row)
  }
  const baseByPlatform = new Map(snapshotData.social.platforms.map((platform) => [platform.id, platform]))
  snapshotData.social.platforms = supportedPlatforms.map((platform) => {
    const latest = latestByPlatform.get(platform.id)
    const basePlatform = baseByPlatform.get(platform.id)
    return {
      id: platform.id,
      label: platform.label,
      followers: latest?.follower_count ?? basePlatform?.followers ?? null,
      engagementRate: latest?.engagement_rate ?? basePlatform?.engagementRate ?? null,
      postsThisMonth: latest?.posts_count ?? basePlatform?.postsThisMonth ?? null,
      status: platform.id === "linkedin" ? "manual" : latest ? "live" : basePlatform?.status ?? "pending",
      updatedAt: latest?.captured_at ?? basePlatform?.updatedAt ?? null,
    }
  })
  if (rows.length) {
    snapshotData.social.history = rows.map((row) => ({
      date: row.snapshot_date,
      month: row.snapshot_date.slice(0, 7),
      channel: row.platform,
      followers: row.follower_count,
      engagementRate: Number(row.engagement_rate ?? 0),
      posts: Number(row.posts_count ?? 0),
    }))
  } else {
    snapshotData.social.history = snapshotData.social.history.filter((row) => (
      supportedPlatforms.some((platform) => platform.id === row.channel)
    ))
  }
}

export async function getLegacyAnalyticsSnapshot(): Promise<LegacyAnalyticsSnapshot> {
  const snapshotData = cloneSnapshot()
  normalizeMembership(snapshotData)
  normalizeZoom(snapshotData)
  normalizeEventbrite(snapshotData)
  normalizeSourceStatus(snapshotData)
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("social_metric_snapshots")
      .select("platform, snapshot_date, follower_count, engagement_rate, posts_count, source, captured_at")
      .order("snapshot_date", { ascending: true })
    if (error) throw error
    applyPersistentSocialHistory(snapshotData, (data ?? []) as SocialSnapshotRow[])
  } catch (error) {
    console.warn("Unable to load persistent social history; using the committed snapshot.", error)
    applyPersistentSocialHistory(snapshotData, [])
  }
  return snapshotData
}
