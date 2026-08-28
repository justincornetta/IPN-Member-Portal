import assert from "node:assert/strict"
import test from "node:test"
import {
  mergeCompletedAndHistoricalConferences,
  splitConferencesByEndDate,
} from "../src/lib/conferences/lifecycle.ts"

function conference(id, name, startsAt, endsAt) {
  return {
    id,
    slug: id,
    name,
    organizer: null,
    category: "Community",
    cover_image_url: null,
    summary: null,
    description: null,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone: "America/New_York",
    city: null,
    state: null,
    country: null,
    venue: null,
    website_url: null,
    registration_url: null,
    whatsapp_url: null,
    meetups: [],
    discounts: [],
    rsvp_count: 0,
    status: "published",
  }
}

test("published conferences leave Upcoming after their end time", () => {
  const completed = conference("completed", "Completed", "2026-08-20T13:00:00Z", "2026-08-20T20:00:00Z")
  const upcoming = conference("upcoming", "Upcoming", "2026-09-20T13:00:00Z", "2026-09-20T20:00:00Z")

  const result = splitConferencesByEndDate(
    [completed, upcoming],
    new Date("2026-08-25T12:00:00Z"),
  )

  assert.deepEqual(result.upcoming.map(({ id }) => id), ["upcoming"])
  assert.deepEqual(result.completed.map(({ id }) => id), ["completed"])
})

test("completed conferences join the past list and retain a detail link", () => {
  const completed = conference("completed", "Completed", "2026-08-20T13:00:00Z", "2026-08-20T20:00:00Z")
  const result = mergeCompletedAndHistoricalConferences([completed], [])

  assert.equal(result[0].slug, "completed")
  assert.equal(result[0].name, "Completed")
})

test("curated historical entries replace matching automatic past entries", () => {
  const completed = conference("completed", "Completed", "2026-08-20T13:00:00Z", "2026-08-20T20:00:00Z")
  const historical = {
    id: "historical",
    name: "Completed",
    organizer: null,
    category: "Community",
    cover_image_url: null,
    starts_at: "2026-08-20T09:00:00Z",
    ends_at: "2026-08-20T20:00:00Z",
    city: null,
    state: null,
    country: null,
    summary: "Retrospective copy",
    drive_folder_url: "https://example.com/photos",
  }

  const result = mergeCompletedAndHistoricalConferences([completed], [historical])

  assert.equal(result.length, 1)
  assert.equal(result[0].id, "historical")
  assert.equal(result[0].drive_folder_url, "https://example.com/photos")
})
