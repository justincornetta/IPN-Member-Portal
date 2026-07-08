import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = resolve(projectDir, "data")
const statusPath = resolve(dataDir, "analytics-source-status.json")

const nowIso = () => new Date().toISOString()

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

loadEnvFile(resolve(projectDir, ".env"))
loadEnvFile(resolve(projectDir, ".env.local"))

const sourceGroups = [
  {
    id: "mailchimp",
    label: "Mailchimp",
    command: ["python3", "scripts/mailchimp_pull.py"],
    timeoutSeconds: 300,
    requiredEnv: ["MAILCHIMP_API_KEY"],
    lastPullFiles: ["mailchimp_last_pull.json", "mailchimp_campaigns.json", "mailchimp_lists.json", "mailchimp_account.json"],
  },
  {
    id: "meta",
    label: "Instagram / Facebook",
    command: ["python3", "scripts/instagram_pull.py"],
    timeoutSeconds: 90,
    requiredEnv: ["INSTAGRAM_ACCESS_TOKEN"],
    lastPullFiles: ["instagram_last_pull.json", "facebook_last_pull.json", "social_stats.json"],
    expandsTo: [
      { id: "instagram", label: "Instagram", lastPullFiles: ["instagram_last_pull.json", "social_stats.json"] },
      { id: "facebook", label: "Facebook", lastPullFiles: ["facebook_last_pull.json", "social_stats.json"] },
    ],
  },
  {
    id: "website",
    label: "GA4",
    command: ["python3", "scripts/google_analytics_pull.py"],
    timeoutSeconds: 90,
    requiredEnv: ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_KEY_PATH"],
    lastPullFiles: ["website_last_pull.json", "website_stats.json"],
  },
  {
    id: "zoom",
    label: "Zoom",
    command: ["python3", "scripts/zoom_pull.py"],
    timeoutSeconds: 180,
    requiredEnv: ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
    lastPullFiles: ["zoom_last_pull.json", "zoom_stats.json", "zoom_events.json"],
  },
  {
    id: "eventbrite",
    label: "Eventbrite",
    command: ["python3", "scripts/eventbrite_pull.py"],
    timeoutSeconds: 240,
    requiredEnv: ["EVENTBRITE_API_TOKEN"],
    lastPullFiles: ["eventbrite_last_pull.json", "eventbrite_events.json"],
  },
  {
    id: "donations",
    label: "Donations",
    command: ["python3", "scripts/squarespace_pull.py"],
    timeoutSeconds: 90,
    requiredEnv: ["SQUARESPACE_API_KEY"],
    lastPullFiles: ["donations_last_pull.json", "donations_stats.json"],
  },
]

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

function firstLastPull(files) {
  for (const file of files) {
    const payload = readJson(resolve(dataDir, file))
    const value = payload?.last_pull ?? payload?.pulled_at ?? payload?.lastPull ?? payload?.timestamp ?? payload?.updated_at
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

function missingEnv(requiredEnv) {
  return requiredEnv.filter((name) => !process.env[name] || !String(process.env[name]).trim())
}

function runCommand(command, timeoutSeconds = 120) {
  return new Promise((resolveCommand) => {
    const startedAt = Date.now()
    let settled = false
    const child = spawn(command[0], command.slice(1), {
      cwd: projectDir,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    const timeout = setTimeout(() => {
      if (settled) return
      output += `\nTimed out after ${timeoutSeconds}s.`
      child.kill("SIGTERM")
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL")
      }, 5000).unref()
    }, timeoutSeconds * 1000)
    timeout.unref()

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk)
      output += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk)
      output += chunk.toString()
    })
    child.on("close", (code) => {
      settled = true
      clearTimeout(timeout)
      resolveCommand({
        code: output.includes(`Timed out after ${timeoutSeconds}s.`) ? 124 : code,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        output: output.trim().slice(-1200),
      })
    })
  })
}

function sourceStatus({ id, label, status, lastRefreshedAt, records = null, note }) {
  return {
    id,
    label,
    status,
    lastRefreshedAt,
    records,
    note,
  }
}

function expandedStatuses(group, status, note) {
  const targets = group.expandsTo ?? [group]
  return targets.map((target) => sourceStatus({
    id: target.id,
    label: target.label,
    status,
    lastRefreshedAt: status === "success" ? firstLastPull(target.lastPullFiles ?? group.lastPullFiles) ?? nowIso() : null,
    note,
  }))
}

async function runGroup(group) {
  const missing = missingEnv(group.requiredEnv)
  if (missing.length > 0) {
    return expandedStatuses(group, "error", `Missing GitHub secret(s): ${missing.join(", ")}`)
  }

  if (group.preflightCommand && process.env.META_APP_ID && process.env.META_APP_SECRET) {
    const preflight = await runCommand(group.preflightCommand, group.timeoutSeconds)
    if (preflight.code !== 0) {
      return expandedStatuses(group, "error", `Preflight failed: ${preflight.output || `exit ${preflight.code}`}`)
    }
  }

  const result = await runCommand(group.command, group.timeoutSeconds)
  if (result.code !== 0) {
    if (result.code === 124) {
      return expandedStatuses(group, "error", `${group.label} timed out after ${group.timeoutSeconds}s`)
    }
    return expandedStatuses(group, "error", result.output || `Exited with status ${result.code}`)
  }

  return expandedStatuses(group, "success", `Pulled in ${result.durationSeconds}s`)
}

async function main() {
  mkdirSync(dataDir, { recursive: true })

  const statuses = []
  for (const group of sourceGroups) {
    console.log(`\n=== ${group.label} ===`)
    statuses.push(...await runGroup(group))
  }

  const failed = statuses.filter((status) => status.status === "error")
  const payload = {
    generatedAt: nowIso(),
    status: failed.length > 0 ? "partial_failure" : "success",
    sources: statuses,
  }

  writeFileSync(statusPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`\nWrote ${statusPath}`)
  console.log(`Source refresh status: ${payload.status}`)
  for (const status of statuses) {
    console.log(`- ${status.label}: ${status.status}${status.note ? ` (${status.note})` : ""}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
