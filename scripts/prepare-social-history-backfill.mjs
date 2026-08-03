import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ref = process.env.SOCIAL_HISTORY_BACKFILL_REF || "125a300"
const snapshotPath = "src/lib/admin/analytics/legacy-snapshot.json"
const outputPath = resolve(projectDir, "data/social_history_backfill.json")
const lastKnownGoodPath = resolve(projectDir, "data/analytics-last-known-good.json")

try {
  const snapshot = JSON.parse(execFileSync("git", ["show", `${ref}:${snapshotPath}`], {
    cwd: projectDir,
    encoding: "utf8",
  }))
  const history = (Array.isArray(snapshot?.social?.history) ? snapshot.social.history : [])
    .filter((row) => ["instagram", "facebook", "linkedin"].includes(String(row.channel).toLowerCase()))
    .map((row) => ({
      channel: String(row.channel).toLowerCase(),
      followers: Number(row.followers),
      avg_engagement_rate: Number(row.engagementRate ?? 0),
      posts_this_month: Number(row.posts ?? 0),
      updated_at: row.date,
      source: "backfill",
    }))
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify({ ref, history }, null, 2)}\n`)
  writeFileSync(lastKnownGoodPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Prepared ${history.length} social history rows from ${ref}.`)
} catch (error) {
  console.warn(`Could not prepare social history from ${ref}; continuing with persisted database history.`)
  console.warn(error instanceof Error ? error.message : String(error))
}
