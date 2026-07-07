import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultLegacyDir = resolve(projectDir, "..", "ipn-dashboard")

function usage() {
  console.log(`
Usage:
  node scripts/import-zoom-attendee-backfill.mjs --manifest <path> [--legacy-dir <path>]

Manifest shape:
  {
    "events": [
      {
        "eventId": "Zoom past webinar UUID from zoom_events.json",
        "meetingId": "89543551090",
        "topic": "Event title",
        "date": "ISO event date",
        "files": ["/absolute/path/to/zoom-attendee-report-day-1.csv"],
        "excludeEmails": ["ipnpsychedelics@gmail.com"]
      }
    ]
  }
`)
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1] || null
}

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function csvRows(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (char !== "\r") {
      field += char
    }
  }

  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function pick(row, headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate)
    if (index !== -1 && row[index] != null && String(row[index]).trim()) return String(row[index]).trim()
  }
  return ""
}

function parseZoomDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function dateOnly(value) {
  const parsed = parseZoomDate(value)
  return parsed ? parsed.slice(0, 10) : null
}

function addParticipant(participants, row) {
  const email = String(row.email || "").trim().toLowerCase()
  if (!email) return

  const existing = participants.get(email) ?? {
    name: row.name || email,
    email,
    registeredAt: null,
    durationFallbackMin: 0,
    intervals: [],
    roles: new Set(),
    days: new Set(),
    countries: new Set(),
  }

  if (row.name && (!existing.name || existing.name === email)) existing.name = row.name
  if (row.registeredAt && (!existing.registeredAt || row.registeredAt < existing.registeredAt)) existing.registeredAt = row.registeredAt
  if (row.role) existing.roles.add(row.role)
  if (row.country) existing.countries.add(row.country)
  if (row.day) existing.days.add(row.day)

  if (row.joinedAt && row.leftAt && row.leftAt > row.joinedAt) {
    existing.intervals.push([row.joinedAt, row.leftAt])
  } else {
    existing.durationFallbackMin += number(row.durationMin)
  }

  participants.set(email, existing)
}

function mergeParticipant(participants, participant) {
  const email = String(participant.email || "").trim().toLowerCase()
  if (!email) return

  const existing = participants.get(email) ?? {
    name: participant.name || email,
    email,
    registeredAt: null,
    durationFallbackMin: 0,
    intervals: [],
    roles: new Set(),
    days: new Set(),
    countries: new Set(),
  }

  if (participant.name && (!existing.name || existing.name === email)) existing.name = participant.name
  if (participant.registeredAt && (!existing.registeredAt || participant.registeredAt < existing.registeredAt)) existing.registeredAt = participant.registeredAt
  existing.durationFallbackMin += number(participant.durationFallbackMin)
  existing.intervals.push(...(Array.isArray(participant.intervals) ? participant.intervals : []))
  for (const role of participant.roles || []) existing.roles.add(role)
  for (const day of participant.days || []) existing.days.add(day)
  for (const country of participant.countries || []) existing.countries.add(country)

  participants.set(email, existing)
}

function mergedDurationMin(intervals) {
  const sorted = intervals
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort(([a], [b]) => a - b)
  const merged = []
  for (const [start, end] of sorted) {
    const previous = merged.at(-1)
    if (!previous || start > previous[1]) {
      merged.push([start, end])
    } else {
      previous[1] = Math.max(previous[1], end)
    }
  }
  return merged.reduce((sum, [start, end]) => sum + (end - start) / 60000, 0)
}

function parseAttendeeCsv(path, excludedEmails) {
  const rows = csvRows(readFileSync(path, "utf8"))
  const participants = new Map()
  const daySummaries = []
  let currentSection = null
  let currentHeaders = null

  for (const row of rows) {
    const first = String(row[0] || "").replace(/^\uFEFF/, "").trim()
    if (["Host Details", "Panelist Details", "Attendee Details"].includes(first)) {
      currentSection = first
      currentHeaders = null
      continue
    }

    if (first === "Topic") {
      const headers = row.map(normalizeHeader)
      currentHeaders = headers
      continue
    }

    if (currentHeaders?.includes("actual_start_time") && first) {
      const headers = currentHeaders
      daySummaries.push({
        topic: pick(row, headers, ["topic"]),
        webinarId: pick(row, headers, ["webinar_id", "id"]),
        date: dateOnly(pick(row, headers, ["actual_start_time"])),
        actualStartTime: parseZoomDate(pick(row, headers, ["actual_start_time"])),
        actualDurationMin: number(pick(row, headers, ["actual_duration_minutes"])),
        registrants: number(pick(row, headers, ["registrants"])),
        cancelledRegistrants: number(pick(row, headers, ["cancelled_registrants"])),
        uniqueViewers: number(pick(row, headers, ["unique_viewers"])),
        totalUsers: number(pick(row, headers, ["total_users"])),
        maxConcurrentViews: number(pick(row, headers, ["max_concurrent_views"])),
      })
      currentHeaders = null
      continue
    }

    if (first === "Attended") {
      currentHeaders = row.map(normalizeHeader)
      continue
    }

    if (!currentHeaders || currentSection === "Host Details" || !["Panelist Details", "Attendee Details"].includes(currentSection || "")) continue

    const headers = currentHeaders
    const attended = pick(row, headers, ["attended"]).toLowerCase()
    const email = pick(row, headers, ["email"]).toLowerCase()
    if (attended && attended !== "yes") continue
    if (!email || excludedEmails.has(email)) continue

    const approvalStatus = pick(row, headers, ["approval_status"]).toLowerCase()
    if (approvalStatus && !["approved", "approve"].includes(approvalStatus)) continue

    const firstName = pick(row, headers, ["first_name"])
    const lastName = pick(row, headers, ["last_name"])
    const userName = pick(row, headers, ["user_name_original_name", "user_name"])
    const name = `${firstName} ${lastName}`.trim() || userName || email
    const joinIso = parseZoomDate(pick(row, headers, ["join_time"]))
    const leaveIso = parseZoomDate(pick(row, headers, ["leave_time"]))
    addParticipant(participants, {
      name,
      email,
      registeredAt: parseZoomDate(pick(row, headers, ["registration_time"])),
      joinedAt: joinIso ? new Date(joinIso).getTime() : null,
      leftAt: leaveIso ? new Date(leaveIso).getTime() : null,
      durationMin: number(pick(row, headers, ["time_in_session_minutes"])),
      country: pick(row, headers, ["country_region_name"]),
      day: joinIso ? joinIso.slice(0, 10) : null,
      role: currentSection === "Panelist Details" ? "panelist" : "attendee",
    })
  }

  return { participants, daySummaries }
}

function importManifest(path, legacyDir) {
  const manifest = readJson(resolve(path), { events: [] })
  const events = []

  for (const event of manifest.events || []) {
    const files = Array.isArray(event.files) ? event.files : event.file ? [event.file] : []
    if (!files.length) {
      console.warn(`Skipping ${event.topic || event.eventId}: no attendee files set`)
      continue
    }

    const excludedEmails = new Set((event.excludeEmails || ["ipnpsychedelics@gmail.com"]).map((email) => String(email).trim().toLowerCase()).filter(Boolean))
    const participantsByEmail = new Map()
    const daySummaries = []

    for (const file of files) {
      const parsed = parseAttendeeCsv(resolve(file), excludedEmails)
      for (const participant of parsed.participants.values()) mergeParticipant(participantsByEmail, participant)
      daySummaries.push(...parsed.daySummaries)
    }

    const participants = Array.from(participantsByEmail.values()).map((participant) => {
      const durationMin = Math.round((mergedDurationMin(participant.intervals) + participant.durationFallbackMin) * 10) / 10
      return {
        name: participant.name || participant.email,
        email: participant.email,
        registeredAt: participant.registeredAt,
        durationMin,
        durationSec: Math.round(durationMin * 60),
        daysAttended: participant.days.size,
        roles: Array.from(participant.roles).sort(),
        countries: Array.from(participant.countries).sort(),
      }
    }).sort((a, b) => b.durationMin - a.durationMin || a.email.localeCompare(b.email))

    const totalDurationMin = participants.reduce((sum, participant) => sum + participant.durationMin, 0)
    const eventDurationMin = daySummaries.reduce((sum, day) => sum + day.actualDurationMin, 0)
    const avgDurationMin = participants.length ? totalDurationMin / participants.length : 0
    const retentionPct = eventDurationMin ? avgDurationMin / eventDurationMin * 100 : 0
    const uniqueAttendees = participants.length

    events.push({
      eventId: event.eventId || null,
      meetingId: event.meetingId || null,
      topic: event.topic || daySummaries[0]?.topic || "",
      date: event.date || daySummaries.at(-1)?.actualStartTime || null,
      source: "zoom_attendee_csv",
      files: files.map((file) => resolve(file)),
      uniqueAttendees,
      totalDurationMin: Math.round(totalDurationMin * 10) / 10,
      avgDurationMin: Math.round(avgDurationMin * 10) / 10,
      retentionPct: Math.round(retentionPct * 10) / 10,
      eventDurationMin,
      peakConcurrent: Math.max(0, ...daySummaries.map((day) => day.maxConcurrentViews)),
      daySummaries,
      participants,
    })
    console.log(`Imported ${uniqueAttendees} unique attendees for ${event.topic || event.eventId}`)
  }

  const outputPath = resolve(legacyDir, "data", "zoom_attendee_backfill.json")
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2)}\n`)
  console.log(`Wrote ${events.length} attendee backfills to ${outputPath}`)
}

const legacyDir = resolve(argValue("--legacy-dir") || process.env.LEGACY_DASHBOARD_DIR || defaultLegacyDir)
const manifestPath = argValue("--manifest")

if (manifestPath) {
  mkdirSync(resolve(legacyDir, "data"), { recursive: true })
  importManifest(manifestPath, legacyDir)
} else {
  usage()
  process.exit(1)
}
