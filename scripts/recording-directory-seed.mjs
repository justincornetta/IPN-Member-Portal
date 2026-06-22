#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const DEFAULT_MAX_MEMBERS = 650
const DEFAULT_CAP_PER_LOCATION = 5

const COMMANDS = new Set(["summarize", "seed", "create-login", "cleanup"])

function usage(exitCode = 0) {
  const message = `
Usage:
  npm run recording:seed:summary -- --source <sot_dashboard.json> --geocodes <location_geocodes.json>
  npm run recording:seed -- --source <sot_dashboard.json> --geocodes <location_geocodes.json> --yes
  npm run recording:seed:login -- --email media@example.org --password '<temporary-password>' --yes
  npm run recording:seed:cleanup -- --yes

Commands:
  summarize      Preview aggregate location coverage. No Supabase access needed.
  seed           Create placeholder staging auth users/profiles for the directory map.
  create-login   Create one non-discoverable staging login for the media team.
  cleanup        Delete users/profiles marked with the recording seed batch.

Required mutation env:
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  RECORDING_SEED_CONFIRM_STAGING=true

Useful options:
  --batch <id>                 Default: recording_seed_YYYY_MM_DD
  --max-members <n>            Default: ${DEFAULT_MAX_MEMBERS}
  --cap-per-location <n>       Default: ${DEFAULT_CAP_PER_LOCATION}
  --dry-run                    Build the seed plan without mutating Supabase
  --yes                        Required for seed/create-login/cleanup mutations
`
  console.log(message.trim())
  process.exit(exitCode)
}

function parseArgs(argv) {
  const [command = "summarize", ...rest] = argv
  if (!COMMANDS.has(command) || rest.includes("--help") || rest.includes("-h")) {
    usage(COMMANDS.has(command) ? 0 : 1)
  }

  const options = {
    command,
    batch: defaultBatch(),
    maxMembers: DEFAULT_MAX_MEMBERS,
    capPerLocation: DEFAULT_CAP_PER_LOCATION,
    dryRun: false,
    yes: false,
  }

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]
    const next = rest[i + 1]

    if (arg === "--source") {
      options.source = next
      i += 1
    } else if (arg === "--geocodes") {
      options.geocodes = next
      i += 1
    } else if (arg === "--batch") {
      options.batch = next
      i += 1
    } else if (arg === "--max-members") {
      options.maxMembers = positiveInt(next, "--max-members")
      i += 1
    } else if (arg === "--cap-per-location") {
      options.capPerLocation = positiveInt(next, "--cap-per-location")
      i += 1
    } else if (arg === "--email") {
      options.email = next
      i += 1
    } else if (arg === "--password") {
      options.password = next
      i += 1
    } else if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--yes") {
      options.yes = true
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

function positiveInt(value, label) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

function defaultBatch() {
  return `recording_seed_${new Date().toISOString().slice(0, 10).replaceAll("-", "_")}`
}

function readStructuredFile(filePath) {
  if (!filePath) return null

  const absolutePath = path.resolve(filePath)
  const raw = fs.readFileSync(absolutePath, "utf8")
  if (absolutePath.toLowerCase().endsWith(".json")) return JSON.parse(raw)
  if (absolutePath.toLowerCase().endsWith(".csv")) return parseCsv(raw)

  throw new Error(`Unsupported file type for ${absolutePath}. Use JSON or CSV.`)
}

function parseCsv(raw) {
  const rows = []
  const parsedRows = []
  let cell = ""
  let row = []
  let inQuotes = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    const next = raw[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      row.push(cell)
      cell = ""
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1
      row.push(cell)
      parsedRows.push(row)
      cell = ""
      row = []
    } else {
      cell += char
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    parsedRows.push(row)
  }

  const [headers, ...body] = parsedRows.filter((r) => r.some((value) => value.trim()))
  if (!headers) return rows

  for (const values of body) {
    const entry = {}
    for (let i = 0; i < headers.length; i += 1) {
      entry[headers[i].trim()] = values[i]?.trim() ?? ""
    }
    rows.push(entry)
  }

  return rows
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function locationKey({ city, state, country }) {
  return ["city", normalize(city), normalize(state), normalize(country)].join("|")
}

function asRows(source) {
  if (!source) return []
  if (Array.isArray(source)) return source
  if (Array.isArray(source.rows)) return source.rows
  if (source.locations && typeof source.locations === "object") {
    return Object.values(source.locations)
  }
  throw new Error("Source file must be an array, an object with rows[], or a geocode cache with locations{}")
}

function buildGeocodeIndex(geocodes) {
  const exact = new Map()
  const byCityCountry = new Map()

  for (const value of Object.values(geocodes?.locations ?? {})) {
    if (!hasCoordinates(value)) continue
    const exactKey = value.key ?? locationKey(value)
    exact.set(exactKey, value)

    const cityCountryKey = [normalize(value.city), normalize(value.country)].join("|")
    const matches = byCityCountry.get(cityCountryKey) ?? []
    matches.push(value)
    byCityCountry.set(cityCountryKey, matches)
  }

  return { exact, byCityCountry }
}

function hasCoordinates(row) {
  return Number.isFinite(Number(row.city_lat ?? row.lat ?? row.latitude)) &&
    Number.isFinite(Number(row.city_lng ?? row.lng ?? row.longitude))
}

function coordinateFields(row) {
  return {
    lat: Number(row.city_lat ?? row.lat ?? row.latitude),
    lng: Number(row.city_lng ?? row.lng ?? row.longitude),
  }
}

function rowCount(row) {
  const raw = row.member_count ?? row.members ?? row.count ?? row.latest_count ?? 1
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function aggregateLocations(source, geocodes) {
  const rows = asRows(source)
  const geocodeIndex = buildGeocodeIndex(geocodes)
  const locations = new Map()
  const skipped = { missingLocation: 0, missingCoordinates: 0 }

  for (const row of rows) {
    const city = row.city ?? row.City
    const state = row.state ?? row.region ?? row.State ?? row.Region ?? ""
    const country = row.country ?? row.Country

    if (!city || !country) {
      skipped.missingLocation += rowCount(row)
      continue
    }

    const key = locationKey({ city, state, country })
    let geocode = null

    if (hasCoordinates(row)) {
      geocode = {
        city,
        state,
        country,
        ...coordinateFields(row),
      }
    } else {
      geocode = geocodeIndex.exact.get(key) ?? null
      if (!geocode) {
        const cityCountryMatches = geocodeIndex.byCityCountry.get([normalize(city), normalize(country)].join("|")) ?? []
        if (cityCountryMatches.length === 1) geocode = cityCountryMatches[0]
      }
    }

    if (!geocode || !hasCoordinates(geocode)) {
      skipped.missingCoordinates += rowCount(row)
      continue
    }

    const coords = coordinateFields(geocode)
    const display = {
      city: geocode.city ?? city,
      state: geocode.state ?? state ?? null,
      country: geocode.country ?? country,
      lat: coords.lat,
      lng: coords.lng,
    }
    const aggregateKey = locationKey(display)
    const existing = locations.get(aggregateKey)

    if (existing) {
      existing.count += rowCount(row)
    } else {
      locations.set(aggregateKey, {
        ...display,
        count: rowCount(row),
      })
    }
  }

  return {
    locations: [...locations.values()].sort((a, b) => b.count - a.count),
    skipped,
  }
}

function buildSeedPlan(locations, { maxMembers, capPerLocation }) {
  const plan = []

  for (const location of locations) {
    if (plan.length >= maxMembers) break
    plan.push({ location, locationIndex: 1 })
  }

  for (const location of locations) {
    const desired = Math.min(capPerLocation, Math.max(1, Math.ceil(Math.sqrt(location.count))))
    for (let i = 2; i <= desired; i += 1) {
      if (plan.length >= maxMembers) return plan
      plan.push({ location, locationIndex: i })
    }
  }

  return plan
}

function printSummary(locations, skipped, plan) {
  const countryCount = new Map()
  for (const location of locations) {
    countryCount.set(location.country, (countryCount.get(location.country) ?? 0) + location.count)
  }

  console.log(`Geocoded locations: ${locations.length}`)
  console.log(`Seeded placeholder users planned: ${plan.length}`)
  console.log(`Skipped member-count estimate without location: ${skipped.missingLocation}`)
  console.log(`Skipped member-count estimate without coordinates: ${skipped.missingCoordinates}`)
  console.log("")
  console.log("Top countries:")
  for (const [country, count] of [...countryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${country}: ${count}`)
  }
  console.log("")
  console.log("Top cities:")
  for (const location of locations.slice(0, 12)) {
    const state = location.state ? `, ${location.state}` : ""
    console.log(`  ${location.city}${state}, ${location.country}: ${location.count}`)
  }
}

function requireMutationSafety(options) {
  if (options.dryRun) return
  if (!options.yes) {
    throw new Error("Mutation refused. Re-run with --yes after checking the command target.")
  }
  if (process.env.RECORDING_SEED_CONFIRM_STAGING !== "true") {
    throw new Error("Mutation refused. Set RECORDING_SEED_CONFIRM_STAGING=true only for a staging Supabase project.")
  }
}

function supabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function emailBatch(batch) {
  return batch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function placeholderEmail(batch, index) {
  return `recording-seed-${emailBatch(batch)}-${String(index).padStart(4, "0")}@example.invalid`
}

async function ensurePlaceholderUser(supabase, batch, entry, index) {
  const { location, locationIndex } = entry
  const email = placeholderEmail(batch, index)
  const metadata = {
    recording_seed_batch: batch,
    recording_seed_kind: "directory_placeholder",
    first_name: "IPN",
    last_name: `Member ${index}`,
    country: location.country,
    state: location.state,
    city: location.city,
    city_lat: String(location.lat),
    city_lng: String(location.lng),
    persona: "Other",
    field: "IPN community",
    referral_source: batch,
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: {
      recording_seed_batch: batch,
      recording_seed_kind: "directory_placeholder",
    },
  })

  if (error && !error.message.toLowerCase().includes("already")) {
    throw new Error(`Failed creating ${email}: ${error.message}`)
  }

  const userId = data.user?.id
  if (userId) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        email,
        first_name: "IPN",
        last_name: locationIndex === 1 ? "Member" : `Member ${locationIndex}`,
        country: location.country,
        state: location.state,
        city: location.city,
        city_lat: location.lat,
        city_lng: location.lng,
        persona: "Other",
        field: "IPN community",
        referral_source: batch,
        bio: null,
        school: null,
        affiliation: null,
        interest_tags: [],
        linkedin_url: null,
        avatar_url: null,
        is_discoverable: true,
        share_location: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (profileError) throw new Error(`Failed updating profile ${email}: ${profileError.message}`)
  }
}

async function createMediaLogin(supabase, options) {
  const email = options.email ?? process.env.RECORDING_MEDIA_EMAIL
  const password = options.password ?? process.env.RECORDING_MEDIA_PASSWORD

  if (!email || !password) {
    throw new Error("create-login requires --email/--password or RECORDING_MEDIA_EMAIL/RECORDING_MEDIA_PASSWORD")
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      recording_seed_batch: options.batch,
      recording_seed_kind: "media_login",
      first_name: "Media",
      last_name: "Team",
      country: "United States",
      state: "",
      city: "",
      persona: "Other",
      referral_source: `${options.batch}:login`,
    },
    app_metadata: {
      recording_seed_batch: options.batch,
      recording_seed_kind: "media_login",
    },
  })

  if (error) throw new Error(`Failed creating media login: ${error.message}`)

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email,
      first_name: "Media",
      last_name: "Team",
      referral_source: `${options.batch}:login`,
      is_discoverable: false,
      share_location: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id)

  if (profileError) throw new Error(`Failed updating media login profile: ${profileError.message}`)
  console.log(`Created media login: ${email}`)
}

async function listSeedUsers(supabase, batch) {
  const users = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Failed listing users: ${error.message}`)
    const pageUsers = data.users ?? []
    users.push(
      ...pageUsers.filter((user) =>
        user.user_metadata?.recording_seed_batch === batch ||
        user.app_metadata?.recording_seed_batch === batch ||
        user.email?.startsWith(`recording-seed-${emailBatch(batch)}-`),
      ),
    )
    if (pageUsers.length < 1000) break
    page += 1
  }

  return users
}

async function cleanupSeed(supabase, batch, dryRun) {
  const users = await listSeedUsers(supabase, batch)
  const { count: profileCount, error: countError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("referral_source", [batch, `${batch}:login`])

  if (countError) throw new Error(`Failed counting seed profiles: ${countError.message}`)

  console.log(`Seed auth users found: ${users.length}`)
  console.log(`Seed profiles found by marker: ${profileCount ?? 0}`)

  if (dryRun) return

  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Failed deleting ${user.email ?? user.id}: ${error.message}`)
  }

  const { error: deleteProfileError } = await supabase
    .from("profiles")
    .delete()
    .in("referral_source", [batch, `${batch}:login`])

  if (deleteProfileError) throw new Error(`Failed deleting leftover profiles: ${deleteProfileError.message}`)

  const remainingUsers = await listSeedUsers(supabase, batch)
  const { count: remainingProfiles, error: remainingError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("referral_source", [batch, `${batch}:login`])

  if (remainingError) throw new Error(`Failed verifying cleanup: ${remainingError.message}`)

  console.log(`Cleanup complete. Remaining seed users: ${remainingUsers.length}`)
  console.log(`Cleanup complete. Remaining seed profiles: ${remainingProfiles ?? 0}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.command === "summarize" || options.command === "seed") {
    if (!options.source) throw new Error(`${options.command} requires --source`)

    const source = readStructuredFile(options.source)
    const geocodes = readStructuredFile(options.geocodes)
    const { locations, skipped } = aggregateLocations(source, geocodes)
    const plan = buildSeedPlan(locations, options)
    printSummary(locations, skipped, plan)

    if (options.command === "summarize") return
    requireMutationSafety(options)

    if (options.dryRun) {
      console.log("")
      console.log("Dry run complete. No Supabase mutations were made.")
      return
    }

    const supabase = supabaseAdmin()
    await cleanupSeed(supabase, options.batch, false)

    for (let i = 0; i < plan.length; i += 1) {
      await ensurePlaceholderUser(supabase, options.batch, plan[i], i + 1)
      if ((i + 1) % 50 === 0 || i + 1 === plan.length) {
        console.log(`Seeded ${i + 1}/${plan.length} placeholder profiles`)
      }
    }

    if (process.env.RECORDING_MEDIA_EMAIL && process.env.RECORDING_MEDIA_PASSWORD) {
      await createMediaLogin(supabase, options)
    }

    console.log(`Seed complete for batch ${options.batch}`)
    return
  }

  requireMutationSafety(options)
  const supabase = supabaseAdmin()

  if (options.command === "create-login") {
    if (options.dryRun) {
      console.log("Dry run complete. No Supabase mutations were made.")
      return
    }
    await createMediaLogin(supabase, options)
    return
  }

  if (options.command === "cleanup") {
    await cleanupSeed(supabase, options.batch, options.dryRun)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
