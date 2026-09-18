import assert from "node:assert/strict"
import test from "node:test"
import { isPublicInventoryZoomEvent, mergeInventoryRegistrations, inventoryRegistrationTrend, inventoryRegistrationCount } from "../src/lib/admin/analytics/event-inventory.ts"
import { buildOnboardingAnalyticsData, buildFirstParticipationAttribution } from "../src/lib/admin/analytics/onboarding.ts"

test("inventory only includes classified public, included Zoom events and honors overrides", () => {
  const event = { id: "zoom-1", type: "public", portalExternalEventId: "portal-1" }
  assert.equal(isPublicInventoryZoomEvent(event), true)
  assert.equal(isPublicInventoryZoomEvent({ ...event, type: "internal" }), false)
  assert.equal(isPublicInventoryZoomEvent({ ...event, inclusionStatus: "excluded" }), false)
  assert.equal(isPublicInventoryZoomEvent({ ...event, includeInAnalytics: false }), false)
  assert.equal(isPublicInventoryZoomEvent(event, [{ event_id: "portal-1", event_type: "internal", include_in_analytics: true }]), false)
  assert.equal(isPublicInventoryZoomEvent({ ...event, type: "internal" }, [{ event_id: "zoom-1", event_type: "public", include_in_analytics: true }]), true)
})

test("inventory merges email overlaps without double counting or merging shared names", () => {
  const portal = { name: "Avery", email: "Avery@example.test", registeredAt: "2026-09-01T10:00:00Z" }
  const rows = mergeInventoryRegistrations([portal], [
    { name: "Zoom Avery", email: " avery@EXAMPLE.test ", registeredAt: "2026-09-02T10:00:00Z" },
    { name: "Avery", email: "other@example.test", registeredAt: null },
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], portal)
  assert.deepEqual(inventoryRegistrationTrend(rows), [{ date: "2026-09-01", daily: 1, cumulative: 1 }])
})

test("inventory builds dated daily and cumulative registrations in UTC", () => {
  const rows = [
    { name: "A", email: "a@example.test", registeredAt: "2026-09-02T01:00:00+02:00" },
    { name: "B", email: "b@example.test", registeredAt: "2026-09-02T02:00:00Z" },
    { name: "C", email: "c@example.test", registeredAt: "invalid" },
  ]
  assert.deepEqual(inventoryRegistrationTrend(rows), [
    { date: "2026-09-01", daily: 1, cumulative: 1 },
    { date: "2026-09-02", daily: 1, cumulative: 2 },
  ])
  assert.deepEqual(inventoryRegistrationTrend([], [{ date: "2026-09-02", tickets: 3 }, { date: "2026-09-01", tickets: 2 }, { date: "invalid", tickets: 9 }, { date: "2026-09-03", tickets: -1 }]), [
    { date: "2026-09-01", daily: 2, cumulative: 2 }, { date: "2026-09-02", daily: 3, cumulative: 5 },
  ])
})

test("inventory selects one registration count rather than summing overlapping sources", () => {
  assert.equal(inventoryRegistrationCount({ status: "upcoming", activeRsvps: 13, totalRegistrations: 22 }), 13)
  assert.equal(inventoryRegistrationCount({ status: "past", activeRsvps: 13, totalRegistrations: 22 }), 22)
  assert.equal(inventoryRegistrationCount({ status: "past", activeRsvps: 0, totalRegistrations: null }), 0)
  assert.equal(inventoryRegistrationCount({ status: "live", activeRsvps: null, totalRegistrations: 20 }), 20)
})

test("onboarding attributes each eligible member exclusively to their first completion, before date filtering", () => {
  const profiles = ["member", "excluded", "legacy"].map((id) => ({ id, first_name: id, last_name: null, email: `${id}@example.test`, exclude_from_analytics: id === "excluded" }))
  const activity = (user_id, activity_type, action, occurred_at) => ({ user_id, activity_type, action, occurred_at })
  const data = buildOnboardingAnalyticsData({ profiles, progressRows: [{ user_id: "legacy", whatsapp_completed_at: null, profile_completed_at: null, product_tour_completed_at: null, event_rsvp_completed_at: "2026-08-01T12:00:00Z" }], participationRows: [
    activity("member", "connection_request_sent", "completed", "2026-09-02T12:00:00Z"),
    activity("member", "portal_event_rsvp", "completed", "2026-09-01T12:00:00Z"),
    activity("member", "portal_event_rsvp", "cancelled", "2026-09-03T12:00:00Z"),
    activity("excluded", "conference_rsvp", "completed", "2026-09-01T12:00:00Z"),
    activity("legacy", "conference_rsvp", "completed", "2026-09-01T12:00:00Z"),
  ] })
  assert.equal(data.completedMembers, 0)
  assert.equal(data.participationAttribution.find((row) => row.type === "portal_event_rsvp").members, 1)
  assert.equal(data.participationAttribution.find((row) => row.type === "connection_request_sent").members, 0)
  assert.equal(data.participationAttribution.find((row) => row.type === "conference_rsvp").members, 0)
  assert.equal(data.participationAttribution.find((row) => row.type === "unknown").members, 1)
  assert.equal(data.participationAttribution.reduce((sum, row) => sum + row.members, 0), 2)
  assert.equal(buildFirstParticipationAttribution(data.members, "2026-09-02", "2026-09-03").reduce((sum, row) => sum + row.members, 0), 0)
  assert.equal(buildFirstParticipationAttribution(data.members, "2026-09-01", "2026-09-01").reduce((sum, row) => sum + row.members, 0), 1)
})
