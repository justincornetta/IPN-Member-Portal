import assert from "node:assert/strict"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { mergeInstagramSnapshot, buildInstagramArchiveSnapshot } from "../scripts/instagram-snapshot.mjs"
import { validateAndMergeAnalyticsSnapshot } from "../scripts/validate-analytics-snapshot.mjs"
import { readFileSync } from "node:fs"

test("manual Instagram workflow is isolated from refresh publishing and maintenance", () => {
  const workflow = readFileSync(new URL("../.github/workflows/portal-analytics-refresh.yml", import.meta.url), "utf8")
  assert.match(workflow, /github.event_name != 'workflow_dispatch' \|\| !inputs.instagram_backfill/)
  const job = workflow.split("  instagram-backfill:\n")[1]
  assert.match(job, /contents: read/)
  assert.match(job, /inputs.instagram_backfill/)
  assert.match(job, /analytics:instagram-backfill/)
  assert.doesNotMatch(job, /SUPABASE|git push|SLACK|maintenance/)
})

test("Instagram archive backfill pagination, checkpoints and failure safeguards", () => {
  const result = spawnSync("python3", ["-m", "unittest", "discover", "-s", "tests/python", "-p", "test_instagram_archive.py"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test("Instagram-only candidate preserves unrelated sources and percentage units", () => {
  const previous = JSON.parse(readFileSync(new URL("../src/lib/admin/analytics/legacy-snapshot.json", import.meta.url)))
  const pulledAt = "2026-09-18T12:00:00Z"
  const input = { media: { account_id: "123", posts: [], pulled_at: pulledAt, backfill_complete: true },
    pull: { status: "success", last_pull: pulledAt }, stats: { account_id: "123", pulled_at: pulledAt, followers_count: 4685, avg_engagement_rate_30d: 0.54 } }
  const candidate = buildInstagramArchiveSnapshot(previous, input, pulledAt)
  for (const key of ["members", "marketing", "events", "website"]) assert.deepEqual(candidate[key], previous[key])
  assert.deepEqual(candidate.social.history, previous.social.history)
  assert.equal(candidate.social.platforms.find((p) => p.id === "instagram").engagementRate, 0.54)
  assert.deepEqual(candidate.social.platforms.find((p) => p.id === "facebook"), previous.social.platforms.find((p) => p.id === "facebook"))
  assert.throws(() => buildInstagramArchiveSnapshot(previous, { ...input, pull: { status: "error" } }), /must succeed/)
  assert.throws(() => buildInstagramArchiveSnapshot(previous, { ...input, media: { ...input.media, pulled_at: "older" } }), /timestamp/)
})

test("failed Instagram validation restores both archive posts and coverage", () => {
  const previous = JSON.parse(readFileSync(new URL("../src/lib/admin/analytics/legacy-snapshot.json", import.meta.url)))
  previous.social.instagramArchive = { accountId: "123", backfillComplete: false, backfilledAt: null, oldestPostAt: null }
  const candidate = structuredClone(previous)
  candidate.social.instagramPosts = []
  candidate.social.instagramArchive.backfillComplete = true
  const result = validateAndMergeAnalyticsSnapshot({ previous, candidate, pullStatus: { generatedAt: "2026-09-18T12:00:00Z", sources: [{ id: "instagram", status: "error" }] } })
  assert.deepEqual(result.snapshot.social.instagramPosts, previous.social.instagramPosts)
  assert.deepEqual(result.snapshot.social.instagramArchive, previous.social.instagramArchive)
})

test("snapshot retains old Instagram IDs, updates counters and excludes private cursors", () => {
  const old = { id: "old", date: "2020-01-01T12:00:00Z", likes: 1, comments: 0 }
  const previous = { instagramPosts: [old], instagramArchive: { accountId: "123", backfillComplete: true, backfilledAt: "2026-09-01" } }
  const merged = mergeInstagramSnapshot(previous, { account_id: "123", resume_after: "private-cursor", posts: [
    { id: "new", timestamp: "2026-09-01T12:00:00Z", like_count: 10, comments_count: 2 },
    { id: "old", timestamp: old.date, like_count: 5, comments_count: 1 },
  ], pulled_at: "2026-09-18T12:00:00Z" })
  assert.equal(merged.instagramPosts.length, 2)
  assert.equal(merged.instagramPosts[1].likes, 5)
  assert.equal(merged.instagramPosts[1].lastObservedAt, "2026-09-18T12:00:00Z")
  assert.equal(merged.instagramArchive.backfillComplete, true)
  assert.equal(JSON.stringify(merged).includes("private-cursor"), false)
  assert.deepEqual(mergeInstagramSnapshot(previous, {}).instagramPosts, [old])
  assert.throws(() => mergeInstagramSnapshot(previous, { account_id: "different" }), /mismatch/)
  assert.throws(() => mergeInstagramSnapshot(previous, { posts: [{ id: "bad", timestamp: "invalid" }] }), /Invalid/)
})
