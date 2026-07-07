import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const defaultLegacyPath = "/Users/jcornetta/Code/ipn-dashboard/data/sot/master.json"
const defaultOldappSupplementPath = "/Users/jcornetta/Code/ipn-dashboard/data/sot/oldapp_supplement.json"

function usage() {
  console.log(`
Usage:
  node scripts/import-legacy-member-sot.mjs [--source <path>] [--oldapp-supplement <path>]

Env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`)
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1] || null
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
    // Optional in CI; Netlify/local shells may already provide env vars.
  }
}

function normalizeEmail(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw || !raw.includes("@")) return ""
  const [localPart, domain] = raw.split("@")
  if (!domain) return raw
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${localPart.split("+")[0].replaceAll(".", "")}@gmail.com`
  }
  return raw
}

function text(value) {
  const trimmed = String(value ?? "").trim()
  return trimmed || null
}

function bool(value) {
  if (typeof value === "boolean") return value
  return ["true", "t", "yes", "1"].includes(String(value ?? "").trim().toLowerCase())
}

function integer(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isoOrNull(value) {
  const trimmed = text(value)
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function earliestIso(...values) {
  const dates = values
    .map(isoOrNull)
    .filter(Boolean)
    .map((value) => new Date(value))
    .sort((a, b) => a.getTime() - b.getTime())
  return dates[0]?.toISOString() ?? null
}

function latestIso(...values) {
  const dates = values
    .map(isoOrNull)
    .filter(Boolean)
    .map((value) => new Date(value))
    .sort((a, b) => b.getTime() - a.getTime())
  return dates[0]?.toISOString() ?? null
}

function stripDiscord(row) {
  const output = {}
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase().includes("discord")) continue
    output[key] = value
  }
  return output
}

function sourceList(row) {
  const sources = []
  if (bool(row.in_form)) sources.push("form")
  if (bool(row.in_mailchimp)) sources.push("mailchimp")
  if (bool(row.in_oldapp)) sources.push("oldapp")
  return sources
}

function loadOldappSupplement(path) {
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"))
    const rows = Array.isArray(payload.oldapp_rows) ? payload.oldapp_rows : []
    const byPersonId = new Map()
    for (const row of rows) {
      const personId = text(row.person_id)
      if (personId) byPersonId.set(personId, row)
    }
    return {
      path,
      rows,
      byPersonId,
      total: integer(payload.oldapp_total ?? rows.length),
      demographics: payload.demographics && typeof payload.demographics === "object" ? payload.demographics : {},
      generatedAt: isoOrNull(payload.generated_at),
    }
  } catch (error) {
    console.warn(`IPN App supplement unavailable at ${path}: ${error instanceof Error ? error.message : String(error)}`)
    return {
      path,
      rows: [],
      byPersonId: new Map(),
      total: 0,
      demographics: {},
      generatedAt: null,
    }
  }
}

function enrichWithOldapp(row, supplementRow) {
  if (!supplementRow) return row
  return {
    ...row,
    in_oldapp: true,
    country: text(row.country) ?? text(supplementRow.country),
    state: text(row.state) ?? text(supplementRow.state),
    city: text(row.city) ?? text(supplementRow.city),
    self_description: text(row.self_description) ?? text(supplementRow.self_description),
    primary_field: text(row.primary_field) ?? text(supplementRow.primary_field),
    psychedelic_field_status: text(row.psychedelic_field_status) ?? text(supplementRow.psychedelic_field_status),
    referral_source: text(row.referral_source) ?? text(supplementRow.referral_source),
    engagement_status: text(row.engagement_status) ?? text(supplementRow.engagement_status),
    first_seen_at: earliestIso(row.first_seen_at, supplementRow.first_seen_at) ?? row.first_seen_at,
    last_seen_at: latestIso(row.last_seen_at, supplementRow.last_seen_at) ?? row.last_seen_at,
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function upsertChunkWithRetry(supabase, chunk, attempt = 1) {
  const { error } = await supabase
    .from("legacy_member_sot_rows")
    .upsert(chunk, { onConflict: "normalized_email" })
  if (!error) return
  if (attempt >= 5) throw error
  await sleep(750 * attempt)
  return upsertChunkWithRetry(supabase, chunk, attempt + 1)
}

function mapRow(row, importId) {
  const normalizedEmail = normalizeEmail(row.email || row.original_email)
  if (!normalizedEmail) return null
  const sources = sourceList(row)
  const rawLegacy = stripDiscord(row)

  return {
    import_id: importId,
    legacy_person_id: text(row.person_id),
    normalized_email: normalizedEmail,
    original_email: text(row.original_email || row.email),
    first_name: text(row.first_name),
    last_name: text(row.last_name),
    full_name: text(row.full_name),
    affiliation: text(row.affiliation),
    country: text(row.country),
    state: text(row.state),
    city: text(row.city),
    self_description: text(row.self_description),
    primary_field: text(row.primary_field),
    psychedelic_field_status: text(row.psychedelic_field_status),
    psychedelic_field_barriers: text(row.psychedelic_field_barriers),
    current_role_and_goals: text(row.current_role_and_goals),
    ipn_inspiration: text(row.ipn_inspiration),
    referral_source: text(row.referral_source),
    channels_present: sources.join(", "),
    channel_count: sources.length,
    in_form: bool(row.in_form),
    in_mailchimp: bool(row.in_mailchimp),
    in_eventbrite: bool(row.in_eventbrite),
    in_zoom: bool(row.in_zoom),
    in_oldapp: bool(row.in_oldapp),
    in_drive_historical: bool(row.in_drive_historical),
    first_seen_at: isoOrNull(row.first_seen_at),
    last_seen_at: isoOrNull(row.last_seen_at),
    mailchimp_id: text(row.mailchimp_id),
    mailchimp_audiences: text(row.mailchimp_audiences),
    mailchimp_status: text(row.mailchimp_status),
    eventbrite_event_count: integer(row.eventbrite_event_count),
    eventbrite_last_event_date: text(row.eventbrite_last_event_date),
    zoom_registrations: integer(row.zoom_registrations),
    zoom_attended: integer(row.zoom_attended),
    zoom_last_event_date: text(row.zoom_last_event_date),
    zoom_total_minutes: numeric(row.zoom_total_minutes),
    zoom_attendance_status: text(row.zoom_attendance_status),
    oldapp_user_id: text(row.oldapp_user_id),
    date_of_birth: text(row.date_of_birth),
    gender: text(row.gender),
    race: text(row.race),
    oldapp_signup_location: text(row.oldapp_signup_location),
    engagement_status: text(row.engagement_status),
    notes: text(row.notes),
    raw_legacy: rawLegacy,
    imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    usage()
    return
  }

  loadEnvFile(resolve(process.cwd(), ".env.local"))
  const sourcePath = resolve(argValue("--source") || process.env.LEGACY_MEMBER_SOT_PATH || defaultLegacyPath)
  const oldappSupplementPath = resolve(argValue("--oldapp-supplement") || process.env.LEGACY_MEMBER_OLDAPP_SUPPLEMENT_PATH || defaultOldappSupplementPath)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

  const payload = JSON.parse(readFileSync(sourcePath, "utf8"))
  const sourceRows = Array.isArray(payload.rows) ? payload.rows : []
  const oldappSupplement = loadOldappSupplement(oldappSupplementPath)
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const matchedOldappPersonIds = sourceRows.reduce((count, row) => {
    const personId = text(row.person_id)
    return count + (personId && oldappSupplement.byPersonId.has(personId) ? 1 : 0)
  }, 0)

  const { data: importRow, error: importError } = await supabase
    .from("legacy_member_sot_imports")
    .insert({
      source_path: sourcePath,
      source_pulled_at: isoOrNull(payload.pulled_at),
      source_row_count: sourceRows.length,
      imported_row_count: 0,
      imported_by: process.env.USER || process.env.LOGNAME || "local-import",
      metadata: {
        source_row_count: payload.row_count ?? sourceRows.length,
        source_multi_source_count: payload.multi_source_count ?? null,
        discord_removed: true,
        excluded_member_sources: ["zoom", "eventbrite", "drive_historical"],
        oldapp_label: "IPN App",
        oldapp_supplement_path: oldappSupplement.path,
        oldapp_total: oldappSupplement.total,
        oldapp_matched_rows: matchedOldappPersonIds,
        oldapp_unmatched_rows: Math.max(0, oldappSupplement.total - matchedOldappPersonIds),
        oldapp_supplement_generated_at: oldappSupplement.generatedAt,
        oldapp_demographics: oldappSupplement.demographics,
      },
    })
    .select("id")
    .single()

  if (importError) throw importError
  const importId = importRow.id
  const rows = sourceRows
    .map((row) => enrichWithOldapp(row, oldappSupplement.byPersonId.get(text(row.person_id))))
    .map((row) => mapRow(row, importId))
    .filter(Boolean)

  const chunkSize = 25
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    await upsertChunkWithRetry(supabase, chunk)
    console.log(`Upserted ${Math.min(index + chunk.length, rows.length)} / ${rows.length}`)
  }

  const { error: updateError } = await supabase
    .from("legacy_member_sot_imports")
    .update({ imported_row_count: rows.length })
    .eq("id", importId)
  if (updateError) throw updateError

  console.log(`Imported ${rows.length} legacy SoT rows from ${sourcePath}`)
  console.log(`IPN App supplement matched ${matchedOldappPersonIds} / ${oldappSupplement.total} rows from ${oldappSupplement.path}`)
  console.log(`Import id: ${importId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
