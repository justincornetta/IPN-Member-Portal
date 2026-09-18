import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { buildCommunityAnalyticsEvents } from "../src/lib/admin/analytics/community-events.ts"
import { eventLabels, eventLabelCatalog, inventoryProgramMatches } from "../src/lib/admin/analytics/event-labels.ts"
import { isPublicInventoryZoomEvent } from "../src/lib/admin/analytics/event-inventory.ts"
import { fetchCommunityInventoryRows } from "../src/lib/admin/analytics/community-fetch.ts"

test("conferences and meetups have separate stable labels, eligible RSVPs and retained cancelled history", () => {
  const conferences = [{ id: "c1", name: "Conference", starts_at: "2026-10-01", ends_at: "2026-10-03", status: "published", meetups: [{ id: "m1", title: "Meetup", startsAt: "2026-10-02" }] }, { id: "draft", name: "Draft", starts_at: null, ends_at: null, status: "draft", meetups: [] }]
  const profile = (id, overrides = {}) => ({ id, first_name: id, last_name: "Member", email: `${id}@example.test`, ...overrides })
  const row = (user_id, overrides = {}) => ({ conference_id: "c1", user_id, created_at: "2026-09-01T12:00:00Z", ...overrides })
  const events = buildCommunityAnalyticsEvents({ conferences,
    historicalConferences: [{ id: "duplicate", name: "Conference", starts_at: "2026-10-01", ends_at: "2026-10-03" }, { id: "past", name: "Old Conference", starts_at: "2025-01-01", ends_at: "2025-01-02" }],
    conferenceRsvps: [row("a"), row("banned"), row("excluded"), row("deleted")],
    meetupRsvps: [row("a", { meetup_id: "m1" }), row("a", { meetup_id: "different" })],
    profiles: [profile("a"), profile("b", {}), profile("banned", { is_banned: true }), profile("excluded", { exclude_from_analytics: true })],
    participationRows: [{ user_id: "a", activity_type: "conference_rsvp", action: "completed", occurred_at: "2026-09-01T12:00:00Z", metadata: { conference_id: "c1" } }, { user_id: "b", activity_type: "conference_rsvp", action: "completed", occurred_at: "2026-08-01T12:00:00Z", metadata: { conference_id: "c1" } }, { user_id: "b", activity_type: "conference_rsvp", action: "cancelled", occurred_at: "2026-08-02T12:00:00Z", metadata: { conference_id: "c1" } }],
  })
  assert.equal(events.length, 3)
  const conference = events.find((event) => event.id === "conference:c1")
  const meetup = events.find((event) => event.id === "conference-meetup:c1:m1")
  assert.equal(conference.registrationCount, 1)
  assert.equal(conference.totalRegistrationsEver, 2)
  assert.equal(conference.cancellationCount, 1)
  assert.equal(conference.registrations[0].memberEmail, "b@example.test")
  assert.equal(meetup.registrationCount, 1)
  assert.equal(meetup.eventType, "Community")
  assert.equal(events.find((event) => event.id === "past-conference:past").registrationCoverage, "unavailable")
})

test("label catalog retains internal and excluded historical/scheduled records without duplicate IDs", () => {
  const historical = { id: "h", topic: "Historical", date: "2026-08-01", program: "Other", type: "internal", inclusionStatus: "excluded" }
  const scheduled = { id: "s", topic: "Scheduled internal", date: "2026-09-17", program: "Other", type: "internal" }
  const conference = { id: "conference:c", topic: "Conference", date: "2026-10-01", program: "Community", type: "public" }
  const catalog = eventLabelCatalog([historical], [scheduled, historical], [conference])
  assert.equal(catalog.length, 3)
  assert.equal(catalog.some((event) => event.id === "h"), true)
  const override = { event_id: "s", program_label: "Community", event_type: "internal", include_in_analytics: true }
  assert.equal(isPublicInventoryZoomEvent(scheduled, [override]), false)
  assert.deepEqual(eventLabels(scheduled, [override]), { program: "Community", type: "internal", includeInAnalytics: true })
  assert.equal(inventoryProgramMatches("Community", "Community"), true)
  assert.equal(inventoryProgramMatches("Community", "IPN Labs"), false)
  assert.equal(inventoryProgramMatches("Other", "all"), true)
  assert.equal(eventLabels({ ...scheduled, portalExternalEventId: "h" }, [{ ...override, event_id: "h", event_type: "public" }, override]).type, "internal")
})

test("conference fetch paginates every source and reports source errors rather than invented zeros", async () => {
  const calls = []
  const admin = { from(table) { return { select() { return this }, order() { return this }, async range(start, end) { calls.push([table, start, end]); return { data: table === "conference_rsvps" && start === 0 ? Array.from({ length: 1000 }, () => ({})) : [], error: null } } } } }
  const result = await fetchCommunityInventoryRows(admin)
  assert.equal(result.error, null)
  assert.equal(result.conferenceRsvps.rows.length, 1000)
  assert.equal(calls.some(([table, start]) => table === "conference_rsvps" && start === 1000), true)
  const failed = await fetchCommunityInventoryRows({ from() { return { select() { return this }, order() { return this }, async range() { return { data: null, error: { message: "Denied" } } } } } })
  assert.match(failed.error, /conference_meetup_rsvps: Denied/)
})

test("Community migration expands the check without changing RLS or access grants", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260918164335_analytics_community_event_labels.sql", import.meta.url), "utf8")
  assert.match(sql, /'IPN Labs', 'PsychedelX', 'Community', 'Other'/)
  assert.doesNotMatch(sql, /disable row level security|grant |delete from|update public/i)
})
