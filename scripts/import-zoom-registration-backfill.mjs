import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const defaultLegacyDir = resolve(projectDir, "..", "ipn-dashboard")

function usage() {
  console.log(`
Usage:
  node scripts/import-zoom-registration-backfill.mjs --init-manifest <path> [--legacy-dir <path>]
  node scripts/import-zoom-registration-backfill.mjs --manifest <path> [--legacy-dir <path>]
  node scripts/import-zoom-registration-backfill.mjs --pull-zoom-participant-registrants <path> [--legacy-dir <path>]

Manifest shape:
  {
    "events": [
      {
        "eventId": "Zoom past meeting UUID from zoom_events.json",
        "meetingId": "Numeric Zoom meeting ID",
        "topic": "Event title",
        "date": "ISO event date",
        "registrants": 123,
        "file": "/absolute/path/to/zoom-registration-report.csv"
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

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
      const [key, ...rest] = trimmed.split("=")
      if (!process.env[key]) process.env[key] = rest.join("=").trim()
    }
  } catch {
    // Optional env files are allowed to be absent.
  }
}

let zoomAccessToken = null
let zoomTokenExpiresAt = 0

async function zoomToken() {
  if (zoomAccessToken && Date.now() < zoomTokenExpiresAt) return zoomAccessToken

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Missing ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET")
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "account_credentials", account_id: accountId }),
  })

  if (!response.ok) throw new Error(`Zoom OAuth error ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const data = await response.json()
  zoomAccessToken = data.access_token
  zoomTokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000
  return zoomAccessToken
}

async function zoomGet(endpoint, params = {}) {
  const token = await zoomToken()
  const url = new URL(`https://api.zoom.us/v2${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (response.status === 404) return null
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") || 5)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
    return zoomGet(endpoint, params)
  }
  if (!response.ok) throw new Error(`Zoom API error ${response.status} for ${endpoint}: ${(await response.text()).slice(0, 300)}`)
  return response.json()
}

async function zoomGetAllPages(endpoint, dataKey, params = {}) {
  const rows = []
  const pageParams = { page_size: 300, ...params }
  while (true) {
    const data = await zoomGet(endpoint, pageParams)
    if (!data) break
    rows.push(...(Array.isArray(data[dataKey]) ? data[dataKey] : []))
    if (!data.next_page_token) break
    pageParams.next_page_token = data.next_page_token
  }
  return rows
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

function findHeaderIndex(rows) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader)
    return headers.some((header) => header === "email" || header === "email_address") &&
      headers.some((header) => header.includes("first_name") || header === "name" || header === "full_name")
  })
}

function pick(row, headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate)
    if (index !== -1 && row[index] != null && String(row[index]).trim()) return String(row[index]).trim()
  }
  return ""
}

function parseRegistrationCsv(path) {
  const rows = csvRows(readFileSync(path, "utf8"))
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex === -1) throw new Error(`Could not find a Zoom registration header row in ${path}`)

  const headers = rows[headerIndex].map(normalizeHeader)
  const registrations = []
  const seenEmails = new Set()

  for (const row of rows.slice(headerIndex + 1)) {
    const email = pick(row, headers, ["email", "email_address"]).toLowerCase()
    if (!email || seenEmails.has(email)) continue
    seenEmails.add(email)

    const firstName = pick(row, headers, ["first_name", "firstname"])
    const lastName = pick(row, headers, ["last_name", "lastname"])
    const fullName = pick(row, headers, ["name", "full_name", "registrant_name"]) || `${firstName} ${lastName}`.trim()
    const approvalStatus = pick(row, headers, ["approval_status", "status"]).toLowerCase()
    if (approvalStatus && !["approved", "approve"].includes(approvalStatus)) continue
    registrations.push({
      name: fullName || email,
      email,
      registeredAt: pick(row, headers, ["registration_time", "registration_date", "create_time", "created_at", "registered_at"]) || null,
    })
  }

  return registrations
}

function isMissingIpnLabsRegistration(event) {
  const topic = String(event.topic || "")
  const publicLabs = /IPN Labs Seminar|IPN Labs Roundtable|Psychedelic Phenomenology/i.test(topic)
  const internal = /Coordinator|Onboarding|Task Force|TF|Biweekly/i.test(topic)
  const hasRegistrations = event.registrants != null || (Array.isArray(event.registrants_detail) && event.registrants_detail.length > 0)
  return publicLabs && !internal && !hasRegistrations
}

function initManifest(path, legacyDir) {
  const zoomEvents = readJson(resolve(legacyDir, "data", "zoom_events.json"), { events: [] })
  const events = (Array.isArray(zoomEvents.events) ? zoomEvents.events : [])
    .filter(isMissingIpnLabsRegistration)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    .map((event) => ({
      eventId: event.event_id || "",
      meetingId: String(event.meeting_id || ""),
      topic: event.topic || "",
      date: event.start_time || null,
      registrants: null,
      file: "",
    }))

  mkdirSync(dirname(resolve(path)), { recursive: true })
  writeFileSync(resolve(path), `${JSON.stringify({ events }, null, 2)}\n`)
  console.log(`Wrote ${events.length} IPN Labs backfill manifest rows to ${resolve(path)}`)
}

function importManifest(path, legacyDir) {
  const manifest = readJson(resolve(path), { events: [] })
  const events = []

  for (const event of manifest.events || []) {
    if (!event.file) {
      if (event.registrants == null || !Number.isFinite(Number(event.registrants))) {
        console.warn(`Skipping ${event.topic || event.eventId}: no file or manual registrants count set`)
        continue
      }
      events.push({
        eventId: event.eventId || null,
        meetingId: event.meetingId || null,
        topic: event.topic || "",
        date: event.date || null,
        source: "manual_zoom_registration_count",
        registrations: [],
        registrants: Number(event.registrants),
      })
      console.log(`Imported manual count of ${Number(event.registrants)} registrants for ${event.topic || event.eventId}`)
      continue
    }
    const registrations = parseRegistrationCsv(resolve(event.file))
    const manualRegistrantCount = event.registrants == null ? null : Number(event.registrants)
    events.push({
      eventId: event.eventId || null,
      meetingId: event.meetingId || null,
      topic: event.topic || "",
      date: event.date || null,
      source: Number.isFinite(manualRegistrantCount) ? "manual_zoom_registration_count_with_csv_rows" : "zoom_registration_csv",
      sourceFile: resolve(event.file),
      registrations,
      registrants: Number.isFinite(manualRegistrantCount) ? manualRegistrantCount : registrations.length,
    })
    console.log(
      `Imported ${Number.isFinite(manualRegistrantCount) ? manualRegistrantCount : registrations.length} registrants for ${event.topic || event.eventId}`,
    )
  }

  const outputPath = resolve(legacyDir, "data", "zoom_registration_backfill.json")
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2)}\n`)
  console.log(`Wrote ${events.length} event backfills to ${outputPath}`)
}

async function pullZoomParticipantRegistrants(path, legacyDir) {
  loadEnvFile(resolve(projectDir, ".env.local"))
  loadEnvFile(resolve(legacyDir, ".env"))

  const manifest = readJson(resolve(path), { events: [] })
  const events = []

  for (const event of manifest.events || []) {
    if (!event.meetingId) {
      console.warn(`Skipping ${event.topic || event.eventId}: no meetingId set`)
      continue
    }

    const participants = await zoomGetAllPages(
      `/report/meetings/${event.meetingId}/participants`,
      "participants",
      { include_fields: "registrant_id" },
    )
    const seenKeys = new Set()
    const registrations = []

    for (const participant of participants) {
      const registrantId = String(participant.registrant_id || "").trim()
      if (!registrantId) continue

      const email = String(participant.user_email || participant.email || "").trim().toLowerCase()
      const key = email || registrantId
      if (!key || seenKeys.has(key)) continue
      seenKeys.add(key)

      registrations.push({
        name: String(participant.name || email || registrantId).trim(),
        email,
        registeredAt: null,
        registrantId,
      })
    }

    const manualRegistrantCount = event.registrants == null ? null : Number(event.registrants)
    events.push({
      eventId: event.eventId || null,
      meetingId: event.meetingId || null,
      topic: event.topic || "",
      date: event.date || null,
      source: Number.isFinite(manualRegistrantCount)
        ? "manual_zoom_registration_count_with_zoom_report_rows"
        : "zoom_report_participants_include_fields_registrant_id",
      registrants: Number.isFinite(manualRegistrantCount) ? manualRegistrantCount : registrations.length,
      registrations,
    })
    console.log(
      `Pulled ${registrations.length} report-derived rows for ${event.topic || event.eventId}` +
        (Number.isFinite(manualRegistrantCount) ? `; using manual total ${manualRegistrantCount}` : ""),
    )
  }

  const outputPath = resolve(legacyDir, "data", "zoom_registration_backfill.json")
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2)}\n`)
  console.log(`Wrote ${events.length} event backfills to ${outputPath}`)
}

const legacyDir = resolve(argValue("--legacy-dir") || process.env.LEGACY_DASHBOARD_DIR || defaultLegacyDir)
const initManifestPath = argValue("--init-manifest")
const manifestPath = argValue("--manifest")
const pullZoomParticipantRegistrantsPath = argValue("--pull-zoom-participant-registrants")

if (initManifestPath) {
  initManifest(initManifestPath, legacyDir)
} else if (manifestPath) {
  importManifest(manifestPath, legacyDir)
} else if (pullZoomParticipantRegistrantsPath) {
  await pullZoomParticipantRegistrants(pullZoomParticipantRegistrantsPath, legacyDir)
} else {
  usage()
  process.exit(1)
}
