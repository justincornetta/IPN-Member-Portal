import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const SLACK_SOURCE = readFileSync(
  new URL("../src/lib/slack/event-rsvp.ts", import.meta.url),
  "utf8",
)
const EVENT_ACTIONS_SOURCE = readFileSync(
  new URL("../src/lib/events/actions.ts", import.meta.url),
  "utf8",
)
const CONFERENCE_ACTIONS_SOURCE = readFileSync(
  new URL("../src/lib/conferences/actions.ts", import.meta.url),
  "utf8",
)

test("event RSVP notifications include the requested Slack fields", () => {
  assert.match(SLACK_SOURCE, /SLACK_EVENT_RSVPS_WEBHOOK_URL/)
  for (const label of [
    "Event",
    "Notification detail",
    "Member",
    "Email",
    "Cumulative RSVPs",
  ]) {
    assert.match(SLACK_SOURCE, new RegExp(`field\\(\"${label}\"`))
  }
})

test("all three RSVP creation paths schedule non-blocking notifications", () => {
  assert.match(EVENT_ACTIONS_SOURCE, /kind: "event"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /kind: "conference"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /kind: "meetup"/)
  assert.match(EVENT_ACTIONS_SOURCE, /after\(\(\) => sendEventRsvpSlackNotification/)
  assert.equal(
    CONFERENCE_ACTIONS_SOURCE.match(/after\(\(\) => sendEventRsvpSlackNotification/g)?.length,
    2,
  )
})

test("duplicate RSVP retries do not schedule duplicate Slack alerts", () => {
  assert.match(EVENT_ACTIONS_SOURCE, /error\.code !== "23505"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /error\?\.code === "23505"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /error\.code !== "23505"/)
  assert.equal(
    [EVENT_ACTIONS_SOURCE, CONFERENCE_ACTIONS_SOURCE]
      .reduce((total, source) => total + (source.match(/if \(isNewRsvp\)/g)?.length ?? 0), 0),
    3,
  )
})
