import assert from "node:assert/strict"
import test from "node:test"
import { conferenceNotificationChanges } from "../src/lib/conferences/notification-diff.ts"
import { conferenceNotificationMessage } from "../src/lib/conferences/notification-copy.ts"
import { formatMeetupDateTime } from "../src/lib/conferences/format.ts"

const meetup = (id, title = id) => ({ id, title })
const discount = (id, label = id) => ({ id, label })

test("a newly published conference produces one conference announcement only", () => {
  const changes = conferenceNotificationChanges(null, {
    status: "published",
    meetups: [meetup("meetup-1")],
    discounts: [discount("discount-1")],
  })

  assert.equal(changes.announceConference, true)
  assert.deepEqual(changes.addedMeetups, [])
  assert.deepEqual(changes.addedDiscounts, [])
})

test("publishing a draft does not duplicate its existing meetup and discount", () => {
  const changes = conferenceNotificationChanges(
    {
      status: "draft",
      meetups: [meetup("meetup-1")],
      discounts: [discount("discount-1")],
    },
    {
      status: "published",
      meetups: [meetup("meetup-1")],
      discounts: [discount("discount-1")],
    },
  )

  assert.equal(changes.announceConference, true)
  assert.deepEqual(changes.addedMeetups, [])
  assert.deepEqual(changes.addedDiscounts, [])
})

test("new items on a published conference produce follow-up announcements", () => {
  const addedMeetup = meetup("meetup-2")
  const addedDiscount = discount("discount-2")
  const changes = conferenceNotificationChanges(
    {
      status: "published",
      meetups: [meetup("meetup-1")],
      discounts: [discount("discount-1")],
    },
    {
      status: "published",
      meetups: [meetup("meetup-1"), addedMeetup],
      discounts: [discount("discount-1"), addedDiscount],
    },
  )

  assert.equal(changes.announceConference, false)
  assert.deepEqual(changes.addedMeetups, [addedMeetup])
  assert.deepEqual(changes.addedDiscounts, [addedDiscount])
})

test("copy edits with stable ids do not look like new conference items", () => {
  const changes = conferenceNotificationChanges(
    {
      status: "published",
      meetups: [meetup("meetup-1", "Original title")],
      discounts: [discount("discount-1", "Original offer")],
    },
    {
      status: "published",
      meetups: [meetup("meetup-1", "Corrected title")],
      discounts: [discount("discount-1", "Corrected offer")],
    },
  )

  assert.equal(changes.announceConference, false)
  assert.deepEqual(changes.addedMeetups, [])
  assert.deepEqual(changes.addedDiscounts, [])
})

test("draft and archived saves never queue member announcements", () => {
  for (const status of ["draft", "archived"]) {
    const changes = conferenceNotificationChanges(
      {
        status: "published",
        meetups: [],
        discounts: [],
      },
      {
        status,
        meetups: [meetup("meetup-1")],
        discounts: [discount("discount-1")],
      },
    )

    assert.equal(changes.announceConference, false)
    assert.deepEqual(changes.addedMeetups, [])
    assert.deepEqual(changes.addedDiscounts, [])
  }
})

test("custom alert copy overrides the portal description", () => {
  assert.equal(
    conferenceNotificationMessage(
      "  Look for the purple lanyard.  ",
      "Portal meetup description",
    ),
    "Look for the purple lanyard.",
  )
})

test("the portal description is the fallback when custom alert copy is blank", () => {
  assert.equal(
    conferenceNotificationMessage("   ", "  Portal meetup description  "),
    "Portal meetup description",
  )
  assert.equal(conferenceNotificationMessage(null, null), null)
})

test("meetup times show a same-day start and end range in the conference timezone", () => {
  assert.equal(
    formatMeetupDateTime(
      "2026-10-23T23:00:00Z",
      "America/New_York",
      "2026-10-24T01:00:00Z",
    ),
    "Fri, Oct 23, 7:00 PM–9:00 PM",
  )
})

test("legacy meetups without an end time retain their start-time display", () => {
  assert.equal(
    formatMeetupDateTime("2026-10-23T23:00:00Z", "America/New_York"),
    "Fri, Oct 23, 7:00 PM",
  )
})
