import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const cliArgs = process.argv.slice(2)
const dryRun = cliArgs.includes("--dry-run")
const sourceArgument = cliArgs.find((argument) => !argument.startsWith("--"))
const sourcePath = resolve(
  sourceArgument
    || process.env.LEGACY_LOCATION_GEOCODES_PATH
    || "data/location_geocodes.json",
)

if (!existsSync(sourcePath)) {
  console.log(`No legacy geocode cache found at ${sourcePath}; keeping existing database cache.`)
  process.exit(0)
}

const payload = JSON.parse(readFileSync(sourcePath, "utf8"))
const entries = Object.values(payload.locations ?? {})
const rows = entries
  .filter((entry) => (
    entry
    && typeof entry === "object"
    && Number.isFinite(Number(entry.lat))
    && Number.isFinite(Number(entry.lng))
    && entry.country
  ))
  .map((entry) => ({
    location_key: String(entry.key),
    city: String(entry.city || "").trim() || null,
    state: String(entry.state || "").trim() || null,
    country: String(entry.country).trim(),
    latitude: Number(entry.lat),
    longitude: Number(entry.lng),
    precision: entry.precision === "country" ? "country" : "city",
    source: String(entry.source || "legacy_cache"),
    resolved_at: entry.updated_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

if (rows.length !== entries.length) {
  throw new Error(`Geocode cache contains ${entries.length - rows.length} invalid rows.`)
}

const locationKeys = new Set(rows.map((row) => row.location_key))
if (locationKeys.size !== rows.length) {
  throw new Error(`Geocode cache contains ${rows.length - locationKeys.size} duplicate location keys.`)
}

const cityRows = rows.filter((row) => row.precision === "city").length
const countryRows = rows.length - cityRows
console.log(`Validated ${rows.length} location geocodes (${cityRows} city, ${countryRows} country) from ${sourcePath}.`)

if (dryRun) process.exit(0)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

for (let index = 0; index < rows.length; index += 500) {
  const { error } = await supabase
    .from("analytics_location_geocodes")
    .upsert(rows.slice(index, index + 500), { onConflict: "location_key" })
  if (error) throw new Error(error.message)
}

console.log(`Imported ${rows.length} location geocodes from ${sourcePath}.`)
