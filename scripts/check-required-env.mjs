import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const nodeEnv = process.env.NODE_ENV || "development"
const envFiles = [
  `.env.${nodeEnv}.local`,
  ".env.local",
  `.env.${nodeEnv}`,
  ".env",
]

const values = { ...process.env }

for (const filename of envFiles) {
  const filepath = resolve(process.cwd(), filename)
  if (!existsSync(filepath)) continue

  for (const rawLine of readFileSync(filepath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "")
    if (!line || line.startsWith("#")) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match || Object.hasOwn(values, match[1])) continue

    values[match[1]] = match[2].trim().replace(/^(?:"(.*)"|'(.*)')$/, "$1$2")
  }
}
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]
const missing = required.filter((key) => !values[key]?.trim())

if (missing.length > 0) {
  console.error([
    "[env] The IPN Member Portal cannot start.",
    "Missing required environment variables:",
    ...missing.map((key) => `  - ${key}`),
    "Add them to .env.local (see .env.example), then restart the dev server.",
  ].join("\n"))
  process.exit(1)
}
