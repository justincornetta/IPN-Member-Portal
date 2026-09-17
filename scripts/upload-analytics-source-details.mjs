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

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function countSourceRecords(sources) {
  const supabase = createServiceClient()
  const counts = {}
  for (const source of sources) {
    const { count, error } = await supabase
      .from("analytics_source_records")
      .select("source_record_id", { count: "exact", head: true })
      .eq("source", source)
    if (error) throw new Error(`Unable to count cumulative ${source} records: ${error.message}`)
    counts[source] = count ?? 0
  }
  return counts
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

function buildZoomBackfillRecords() {
  const attendeePayload = readJson("zoom_attendee_backfill.json", { events: [] })
  const registrationPayload = readJson("zoom_registration_backfill.json", { events: [] })
  const records = []

  for (const event of Array.isArray(attendeePayload?.events) ? attendeePayload.events : []) {
    const eventId = cleanString(event.eventId) ?? cleanString(event.meetingId) ?? cleanString(event.topic)
    if (!eventId) continue
    for (const [index, participant] of (Array.isArray(event.participants) ? event.participants : []).entries()) {
      const email = cleanString(participant.email)
      const name = cleanString(participant.name) ?? email
      records.push(normalizeRecord({
        source: "zoom",
        recordType: "participant",
        sourceRecordId: recordId("zoom", "participant_backfill", [eventId, email, name, participant.registeredAt, index]),
        eventSourceId: eventId,
        eventName: event.topic,
        eventStartedAt: event.date,
        occurredAt: event.date,
        name,
        email,
        attended: true,
        durationSeconds: participant.durationSec,
        durationMinutes: participant.durationMin,
        sourcePulledAt: attendeePayload.generatedAt ?? attendeePayload.pulled_at,
        details: {
          meetingId: event.meetingId ?? null,
          daysAttended: participant.daysAttended ?? null,
          roles: participant.roles ?? [],
          countries: participant.countries ?? [],
          source: event.source ?? "zoom_attendee_backfill",
        },
      }))
    }
  }

  for (const event of Array.isArray(registrationPayload?.events) ? registrationPayload.events : []) {
    const eventId = cleanString(event.eventId) ?? cleanString(event.meetingId) ?? cleanString(event.topic)
    if (!eventId) continue
    for (const [index, registrant] of (Array.isArray(event.registrations) ? event.registrations : []).entries()) {
      const email = cleanString(registrant.email)
      const name = cleanString(registrant.name) ?? email
      records.push(normalizeRecord({
        source: "zoom",
        recordType: "registrant",
        sourceRecordId: recordId("zoom", "registrant_backfill", [eventId, email, name, registrant.registeredAt, index]),
        eventSourceId: eventId,
        eventName: event.topic,
        eventStartedAt: event.date,
        registeredAt: registrant.registeredAt,
        name,
        email,
        sourcePulledAt: registrationPayload.generatedAt ?? registrationPayload.pulled_at,
        details: {
          meetingId: event.meetingId ?? null,
          source: event.source ?? "zoom_registration_backfill",
        },
      }))
    }
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
  const supabase = createServiceClient()

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

function buildSocialSnapshots() {
  const social = readJson("social_stats.json", {})
  const backfill = readJson("social_history_backfill.json", { history: [] })
  const candidates = [
    ...(Array.isArray(backfill?.history) ? backfill.history : []),
    ...(Array.isArray(social?.history) ? social.history : []),
  ]
  for (const platform of ["instagram", "facebook"]) {
    const current = social?.[platform]
    if (current?.followers != null && current?.updated_at) {
      candidates.push({
        channel: platform,
        followers: current.followers,
        avg_engagement_rate: current.avg_engagement_rate,
        posts_this_month: current.posts_this_month,
        updated_at: current.updated_at,
      })
    }
  }

  const byPlatformDate = new Map()
  for (const row of candidates) {
    const platform = String(row.channel || row.platform || "").toLowerCase()
    if (!['instagram', 'facebook', 'linkedin'].includes(platform)) continue
    const timestamp = isoOrNull(row.updated_at || row.date)
    const followerCount = numberOrNull(row.followers ?? row.follower_count)
    if (!timestamp || followerCount == null || followerCount < 0) continue
    const snapshotDate = timestamp.slice(0, 10)
    byPlatformDate.set(`${platform}:${snapshotDate}`, {
      platform,
      snapshot_date: snapshotDate,
      follower_count: Math.round(followerCount),
      engagement_rate: numberOrNull(row.avg_engagement_rate ?? row.engagement_rate),
      posts_count: numberOrNull(row.posts_this_month ?? row.posts_count),
      source: row.source === "manual" ? "manual" : row.source === "backfill" ? "backfill" : "api",
      details: {},
      captured_at: timestamp,
    })
  }
  return Array.from(byPlatformDate.values())
}

async function upsertSocialSnapshots(rows) {
  if (!rows.length) return 0
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("social_metric_snapshots")
    .upsert(rows, { onConflict: "platform,snapshot_date" })
  if (error) throw new Error(error.message)
  return rows.length
}

function buildMailchimpContacts() {
  const payload = readJson("mailchimp_contacts.json", null)
  if (!payload || !Array.isArray(payload.contacts)) return null
  const pulledAt = isoOrNull(payload.pulled_at) ?? new Date().toISOString()
  const audiences = Array.isArray(payload.audiences) ? payload.audiences : []
  const contacts = payload.contacts
    .map((row) => ({
      audience_id: cleanString(row.audience_id),
      audience_name: cleanString(row.audience_name) ?? "Unnamed audience",
      subscriber_hash: cleanString(row.subscriber_hash)?.toLowerCase() ?? null,
      mailchimp_member_id: cleanString(row.mailchimp_member_id),
      status: cleanString(row.status)?.toLowerCase() ?? "unknown",
      subscribed_at: isoOrNull(row.subscribed_at),
      unsubscribed_at: isoOrNull(row.unsubscribed_at),
      last_changed_at: isoOrNull(row.last_changed_at),
      source_pulled_at: isoOrNull(row.source_pulled_at) ?? pulledAt,
      last_seen_at: pulledAt,
    }))
    .filter((row) => row.audience_id && row.subscriber_hash)
  return { audiences, contacts, pulledAt }
}

async function fetchAllMailchimpContacts(supabase) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("mailchimp_audience_contacts")
      .select("audience_id,audience_name,subscriber_hash,mailchimp_member_id,status,subscribed_at,unsubscribed_at,last_changed_at,source_pulled_at,first_seen_at,last_seen_at")
      .range(start, start + 999)
    if (error) throw new Error(`Unable to read prior Mailchimp contacts: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

function mailchimpEvent({ contact, previousStatus, source, occurredAt }) {
  const timestamp = occurredAt ?? contact.last_changed_at ?? contact.source_pulled_at
  return {
    audience_id: contact.audience_id,
    audience_name: contact.audience_name,
    subscriber_hash: contact.subscriber_hash,
    previous_status: previousStatus,
    new_status: contact.status,
    occurred_at: timestamp,
    observed_at: contact.source_pulled_at,
    source,
    source_event_key: hashId([
      contact.audience_id,
      contact.subscriber_hash,
      previousStatus,
      contact.status,
      timestamp,
      source,
    ]),
    details: {},
  }
}

async function syncMailchimpContacts() {
  const snapshot = buildMailchimpContacts()
  if (!snapshot) {
    return { available: false, contactsUpserted: 0, statusEventsAdded: 0 }
  }

  const supabase = createServiceClient()
  const { data: run, error: runError } = await supabase
    .from("mailchimp_sync_runs")
    .insert({
      audiences_count: snapshot.audiences.length,
      contacts_seen: snapshot.contacts.length,
      details: { sourcePulledAt: snapshot.pulledAt },
    })
    .select("id")
    .single()
  if (runError) throw new Error(`Unable to start Mailchimp sync: ${runError.message}`)

  try {
    const existing = await fetchAllMailchimpContacts(supabase)
    const existingByKey = new Map(existing.map((row) => [`${row.audience_id}:${row.subscriber_hash}`, row]))
    const incomingByKey = new Map(snapshot.contacts.map((row) => [`${row.audience_id}:${row.subscriber_hash}`, row]))
    const includedAudienceIds = new Set(snapshot.audiences.map((row) => cleanString(row.id)).filter(Boolean))
    const events = []

    for (const contact of snapshot.contacts) {
      const prior = existingByKey.get(`${contact.audience_id}:${contact.subscriber_hash}`)
      if (!prior && ["subscribed", "unsubscribed"].includes(contact.status)) {
        events.push(mailchimpEvent({
          contact,
          previousStatus: null,
          source: "initial_backfill",
          occurredAt: contact.status === "subscribed"
            ? contact.subscribed_at ?? contact.last_changed_at
            : contact.unsubscribed_at ?? contact.last_changed_at,
        }))
      } else if (prior && prior.status !== contact.status) {
        events.push(mailchimpEvent({
          contact,
          previousStatus: prior.status,
          source: "daily_reconciliation",
        }))
      }
    }

    for (const prior of existing) {
      const key = `${prior.audience_id}:${prior.subscriber_hash}`
      if (!includedAudienceIds.has(prior.audience_id) || incomingByKey.has(key) || prior.status === "archived") continue
      const archived = {
        ...prior,
        status: "archived",
        source_pulled_at: snapshot.pulledAt,
        last_seen_at: snapshot.pulledAt,
      }
      delete archived.first_seen_at
      incomingByKey.set(key, archived)
      events.push(mailchimpEvent({
        contact: archived,
        previousStatus: prior.status,
        source: "daily_reconciliation",
        occurredAt: snapshot.pulledAt,
      }))
    }

    const contacts = Array.from(incomingByKey.values())
    for (let index = 0; index < contacts.length; index += chunkSize) {
      const { error } = await supabase
        .from("mailchimp_audience_contacts")
        .upsert(contacts.slice(index, index + chunkSize), {
          onConflict: "audience_id,subscriber_hash",
        })
      if (error) throw new Error(`Unable to upsert Mailchimp contacts: ${error.message}`)
    }

    for (let index = 0; index < events.length; index += chunkSize) {
      const { error } = await supabase
        .from("mailchimp_subscription_events")
        .upsert(events.slice(index, index + chunkSize), {
          onConflict: "source_event_key",
          ignoreDuplicates: true,
        })
      if (error) throw new Error(`Unable to append Mailchimp status events: ${error.message}`)
    }

    const { error: finishError } = await supabase
      .from("mailchimp_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "success",
        contacts_upserted: contacts.length,
        status_events_added: events.length,
      })
      .eq("id", run.id)
    if (finishError) throw new Error(`Unable to finish Mailchimp sync: ${finishError.message}`)

    return {
      available: true,
      contactsUpserted: contacts.length,
      statusEventsAdded: events.length,
    }
  } catch (error) {
    await supabase
      .from("mailchimp_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
      })
      .eq("id", run.id)
    throw error
  }
}

async function main() {
  loadEnvFile(resolve(projectDir, ".env"))
  loadEnvFile(resolve(projectDir, ".env.local"))
  mkdirSync(dataDir, { recursive: true })

  const socialOnly = process.argv.includes("--social-only")

  const records = socialOnly ? [] : [
    ...buildZoomRecords(),
    ...buildZoomBackfillRecords(),
    ...buildEventbriteRecords(),
  ]
  const cumulativeSources = socialOnly ? [] : ["zoom", "eventbrite"]
  const previousCumulativeBySource = await countSourceRecords(cumulativeSources)

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: socialOnly ? "social_only" : "all_sources",
    recordsBuilt: records.length,
    bySource: records.reduce((acc, record) => {
      const source = record.source
      acc[source] = (acc[source] ?? 0) + 1
      return acc
    }, {}),
    upserted: 0,
    socialSnapshotsUpserted: 0,
    mailchimpContactsUpserted: 0,
    mailchimpStatusEventsAdded: 0,
    previousCumulativeBySource,
    cumulativeBySource: {},
  }

  summary.upserted = records.length ? await upsertRecords(records) : 0
  summary.socialSnapshotsUpserted = await upsertSocialSnapshots(buildSocialSnapshots())
  if (!socialOnly) {
    const mailchimp = await syncMailchimpContacts()
    summary.mailchimpContactsUpserted = mailchimp.contactsUpserted
    summary.mailchimpStatusEventsAdded = mailchimp.statusEventsAdded
  }
  summary.cumulativeBySource = await countSourceRecords(cumulativeSources)
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(`Built ${summary.recordsBuilt} private source detail record(s).`)
  console.log(`Upserted ${summary.upserted} private source detail record(s) to Supabase.`)
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
