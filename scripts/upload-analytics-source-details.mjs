import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = resolve(projectDir, "data")
const outputPath = resolve(dataDir, "analytics-source-detail-upload.json")
const chunkSize = 100

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const [key, ...rest] = trimmed.split("=")
    if (!key || process.env[key]) continue
    process.env[key] = rest.join("=").replace(/^["']|["']$/g, "")
  }
}

function readJson(filename, fallback = null) {
  try {
    return JSON.parse(readFileSync(resolve(dataDir, filename), "utf8"))
  } catch {
    return fallback
  }
}

function hashId(parts) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex")
    .slice(0, 48)
}

function cleanString(value) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function numberOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoOrNull(value) {
  const text = cleanString(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function recordId(source, recordType, parts) {
  return `${source}:${recordType}:${hashId(parts)}`
}

function normalizeRecord(record) {
  return {
    source: record.source,
    record_type: record.recordType,
    source_record_id: record.sourceRecordId,
    event_source_id: cleanString(record.eventSourceId),
    event_name: cleanString(record.eventName),
    event_started_at: isoOrNull(record.eventStartedAt),
    occurred_at: isoOrNull(record.occurredAt),
    registered_at: isoOrNull(record.registeredAt),
    name: cleanString(record.name),
    email: cleanString(record.email),
    attended: typeof record.attended === "boolean" ? record.attended : null,
    duration_seconds: numberOrNull(record.durationSeconds),
    duration_minutes: numberOrNull(record.durationMinutes),
    details: record.details && typeof record.details === "object" ? record.details : {},
    source_pulled_at: isoOrNull(record.sourcePulledAt),
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function buildZoomRecords() {
  const payload = readJson("zoom_events.json", { events: [] })
  const pulledAt = payload?.pulled_at ?? null
  const records = []

  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const eventId = cleanString(event.event_id) ?? cleanString(event.meeting_id) ?? cleanString(event.topic)
    if (!eventId) continue

    const eventName = cleanString(event.topic)
    const eventStartedAt = event.start_time ?? null

    const participants = Array.isArray(event.participants_detail) ? event.participants_detail : []
    participants.forEach((participant, index) => {
      const email = cleanString(participant.email)
      const name = cleanString(participant.name) ?? email
      records.push(normalizeRecord({
        source: "zoom",
        recordType: "participant",
        sourceRecordId: recordId("zoom", "participant", [eventId, email, name, participant.join_time, index]),
        eventSourceId: eventId,
        eventName,
        eventStartedAt,
        occurredAt: participant.join_time ?? eventStartedAt,
        name,
        email,
        attended: true,
        durationSeconds: participant.duration_sec,
        durationMinutes: numberOrNull(participant.duration_sec) == null ? null : Math.round(numberOrNull(participant.duration_sec) / 60),
        sourcePulledAt: pulledAt,
        details: {
          meetingId: event.meeting_id ?? null,
          eventType: event.event_type ?? null,
          leaveTime: participant.leave_time ?? null,
          program: event.program ?? null,
          type: event.type ?? null,
        },
      }))
    })

    const registrants = Array.isArray(event.registrants_detail) ? event.registrants_detail : []
    registrants.forEach((registrant, index) => {
      const email = cleanString(registrant.email)
      const name = cleanString(registrant.name) ?? email
      const registeredAt = registrant.registered_at ?? registrant.registeredAt ?? registrant.created_at ?? null
      records.push(normalizeRecord({
        source: "zoom",
        recordType: "registrant",
        sourceRecordId: recordId("zoom", "registrant", [eventId, email, name, registeredAt, index]),
        eventSourceId: eventId,
        eventName,
        eventStartedAt,
        registeredAt,
        name,
        email,
        attended: null,
        sourcePulledAt: pulledAt,
        details: {
          meetingId: event.meeting_id ?? null,
          eventType: event.event_type ?? null,
          program: event.program ?? null,
          type: event.type ?? null,
        },
      }))
    })

    const participantEmails = Array.isArray(event.participant_emails) ? event.participant_emails : []
    const participantDetailEmails = new Set(participants.map((participant) => cleanString(participant.email)).filter(Boolean))
    participantEmails
      .map((email) => cleanString(email))
      .filter((email) => email && !participantDetailEmails.has(email))
      .forEach((email) => {
        records.push(normalizeRecord({
          source: "zoom",
          recordType: "participant_email",
          sourceRecordId: recordId("zoom", "participant_email", [eventId, email]),
          eventSourceId: eventId,
          eventName,
          eventStartedAt,
          occurredAt: eventStartedAt,
          email,
          attended: true,
          sourcePulledAt: pulledAt,
          details: {
            meetingId: event.meeting_id ?? null,
            eventType: event.event_type ?? null,
            program: event.program ?? null,
            type: event.type ?? null,
          },
        }))
      })
  }

  return records
}

function buildEventbriteRecords() {
  const payload = readJson("eventbrite_events.json", { events: [] })
  const pulledAt = payload?.pulled_at ?? null
  const records = []

  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const eventId = cleanString(event.id)
    if (!eventId) continue
    const eventName = cleanString(event.name)
    const eventStartedAt = event.start?.utc ?? event.start ?? null
    const attendees = Array.isArray(event.attendance?.attendee_details) ? event.attendance.attendee_details : []

    attendees.forEach((attendee, index) => {
      const email = cleanString(attendee.email)
      const name = cleanString(attendee.name) ?? email
      records.push(normalizeRecord({
        source: "eventbrite",
        recordType: "attendee",
        sourceRecordId: cleanString(attendee.id) ?? recordId("eventbrite", "attendee", [eventId, email, name, attendee.created, index]),
        eventSourceId: eventId,
        eventName,
        eventStartedAt,
        registeredAt: attendee.created,
        name,
        email,
        attended: Boolean(attendee.checked_in),
        sourcePulledAt: pulledAt,
        details: {
          orderId: attendee.order_id ?? null,
          ticketClassId: attendee.ticket_class_id ?? null,
          ticketClassName: attendee.ticket_class_name ?? null,
          status: attendee.status ?? null,
          cancelled: attendee.cancelled ?? null,
          refunded: attendee.refunded ?? null,
          changed: attendee.changed ?? null,
        },
      }))
    })
  }

  return records
}

async function upsertRecords(records) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let upserted = 0
  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize)
    let error = null
    try {
      const result = await supabase
        .from("analytics_source_records")
        .upsert(chunk, {
          onConflict: "source,record_type,source_record_id",
        })
      error = result.error
    } catch (caught) {
      const message = caught instanceof Error
        ? `${caught.message}${caught.cause ? `: ${String(caught.cause)}` : ""}`
        : String(caught)
      throw new Error(`Failed to upsert records ${index + 1}-${index + chunk.length}: ${message}`)
    }
    if (error) throw new Error(error.message)
    upserted += chunk.length
  }

  return upserted
}

async function main() {
  loadEnvFile(resolve(projectDir, ".env"))
  loadEnvFile(resolve(projectDir, ".env.local"))
  mkdirSync(dataDir, { recursive: true })

  const records = [
    ...buildZoomRecords(),
    ...buildEventbriteRecords(),
  ]

  const summary = {
    generatedAt: new Date().toISOString(),
    recordsBuilt: records.length,
    bySource: records.reduce((acc, record) => {
      const source = record.source
      acc[source] = (acc[source] ?? 0) + 1
      return acc
    }, {}),
    upserted: 0,
  }

  summary.upserted = records.length ? await upsertRecords(records) : 0
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(`Built ${summary.recordsBuilt} private source detail record(s).`)
  console.log(`Upserted ${summary.upserted} private source detail record(s) to Supabase.`)
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
