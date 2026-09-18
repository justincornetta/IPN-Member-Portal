import assert from "node:assert/strict"
import test from "node:test"
import { activeUserIds, activeUserWindowStart, buildActiveUserDetails } from "../src/lib/admin/analytics/active-users.ts"
import { buildPortalUtilizationData } from "../src/lib/admin/analytics/portal-utilization.ts"

const profile = (id) => ({ id, first_name: id, last_name: "Member", email: `${id}@example.test`, role: null, whatsapp_url: null, created_at: "2026-01-01T00:00:00Z", last_sign_in_at: "2026-09-19T12:00:00Z" })
const event = (user, name, time, target = null) => ({ user_id: user, event_name: name, occurred_at: time, session_id: `${user}-${time}`, page_path: "/dashboard/resources", target_id: target, target_label: target ? "Research library" : null, error_code: null, duration_seconds: null, click_count: null, metadata: null })

function fixture() {
  return buildPortalUtilizationData({ profiles: [profile("Ada"), profile("Ben"), profile("Cara")], onboardingRows: [], now: new Date("2026-09-20T12:00:00Z"), analyticsEvents: [
    event("Ada", "curated_click", "2026-08-20T10:00:00Z", "resource-detail-1"),
    event("Ada", "sign_in_success", "2026-09-17T10:00:00Z"),
    event("Ada", "page_view", "2026-09-18T20:00:00Z"),
    event("Ada", "curated_click", "2026-09-19T10:00:00Z", "resource-detail-2"),
    event("Ben", "curated_click", "2026-09-12T23:59:59Z", "newsletter-1"),
    event("Ben", "curated_click", "2026-09-18T23:59:59Z", "resource-detail-1"),
    event("Cara", "sign_in_success", "2026-09-18T09:00:00Z"),
  ] })
}

test("active users use inclusive UTC rolling 30/7 day boundaries", () => {
  const actions = [
    { userId: "monthly-boundary", date: "2026-08-20" },
    { userId: "too-old", date: "2026-08-19" },
    { userId: "weekly-boundary", date: "2026-09-12" },
    { userId: "outside-week", date: "2026-09-11" },
    { userId: "future", date: "2026-09-19" },
  ]
  assert.equal(activeUserWindowStart("2026-09-18", "monthly"), "2026-08-20")
  assert.equal(activeUserWindowStart("2026-09-18", "weekly"), "2026-09-12")
  assert.deepEqual([...activeUserIds(actions, "2026-09-18", "weekly")], ["weekly-boundary"])
  assert.deepEqual([...activeUserIds(actions, "2026-09-18", "monthly")], ["monthly-boundary", "weekly-boundary", "outside-week"])
})

test("drill-down matches monthly/weekly counts, cohort and historical activity", () => {
  const data = fixture(), cohort = new Set(["Ada", "Ben", "Cara"])
  const monthly = buildActiveUserDetails(data, cohort, "2026-09-18", "monthly")
  assert.equal(monthly.length, activeUserIds(data.qualifyingActions, "2026-09-18", "monthly").size)
  assert.deepEqual(monthly.map((row) => row.userId), ["Ada", "Ben"])
  assert.equal(monthly[0].lastSignIn, "2026-09-17T10:00:00Z")
  assert.equal(monthly[0].lastQualifyingActivity.occurredAt, "2026-08-20T10:00:00Z")
  assert.match(monthly[0].lastQualifyingActivity.label, /Resource opened: Research library/)
  const weekly = buildActiveUserDetails(data, cohort, "2026-09-18", "weekly")
  assert.equal(weekly.length, activeUserIds(data.qualifyingActions, "2026-09-18", "weekly").size)
  assert.deepEqual(weekly.map((row) => row.userId), ["Ben"])
  assert.equal(weekly[0].lastSignIn, null)
  assert.equal(buildActiveUserDetails(data, new Set(["Ada"]), "2026-09-18", "weekly").length, 0)
  assert.deepEqual(buildActiveUserDetails(data, cohort, "2025-01-01", "monthly"), [])
})
