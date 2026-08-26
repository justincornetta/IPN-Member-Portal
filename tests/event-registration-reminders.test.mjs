import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  NEW_EVENT_FATIGUE_GUARD_HOURS,
  registrationReminderDedupeKey,
  registrationReminderEventIsDue,
  registrationReminderFeatureEnabled,
  registrationReminderRecipientIsEnabled,
  registrationReminderSuppressionReason,
  registrationReminderWindow,
} from "../src/lib/member-notifications/registration-reminders.ts"

const NOW = new Date("2026-08-25T16:00:00.000Z")

function dueEvent(overrides = {}) {
  return {
    id: "event-1",
    status: "published",
    is_recording: false,
    registration_reminder_enabled: true,
    starts_at: "2026-08-28T16:00:00.000Z",
    ...overrides,
  }
}

test("eligible non-registrants are due and receive one durable business key", () => {
  assert.equal(registrationReminderEventIsDue(dueEvent(), NOW), true)
  assert.equal(
    registrationReminderSuppressionReason({
      hasPortalRegistration: false,
      hasVerifiedExternalTicket: false,
      now: NOW,
    }),
    null,
  )

  const firstRun = registrationReminderDedupeKey("event-1", "member-1")
  const overlappingRun = registrationReminderDedupeKey("event-1", "member-1")
  assert.equal(firstRun, overlappingRun)
  assert.equal(new Set([firstRun, overlappingRun]).size, 1)
})

test("members registered before queuing are suppressed", () => {
  assert.equal(
    registrationReminderSuppressionReason({
      hasPortalRegistration: true,
      hasVerifiedExternalTicket: false,
      now: NOW,
    }),
    "recipient has already RSVP'd",
  )
})

test("a member who RSVPs after queuing is suppressed by the send-time re-check", () => {
  const queuedState = registrationReminderSuppressionReason({
    hasPortalRegistration: false,
    hasVerifiedExternalTicket: false,
    now: NOW,
  })
  const sendTimeState = registrationReminderSuppressionReason({
    hasPortalRegistration: true,
    hasVerifiedExternalTicket: false,
    now: new Date(NOW.getTime() + 5 * 60 * 1000),
  })
  assert.equal(queuedState, null)
  assert.equal(sendTimeState, "recipient has already RSVP'd")
})

test("cancelled, unpublished, recording, past, and out-of-window events are ineligible", () => {
  assert.equal(registrationReminderEventIsDue(dueEvent({ status: "cancelled" }), NOW), false)
  assert.equal(registrationReminderEventIsDue(dueEvent({ status: "draft" }), NOW), false)
  assert.equal(registrationReminderEventIsDue(dueEvent({ is_recording: true }), NOW), false)
  assert.equal(
    registrationReminderEventIsDue(
      dueEvent({ starts_at: "2026-08-25T15:59:59.999Z" }),
      NOW,
    ),
    false,
  )
  assert.equal(
    registrationReminderEventIsDue(
      dueEvent({ starts_at: "2026-08-28T09:59:59.999Z" }),
      NOW,
    ),
    false,
  )
})

test("new-event announcements sent in the preceding 48 hours trigger fatigue suppression", () => {
  const withinWindow = new Date(
    NOW.getTime() - (NEW_EVENT_FATIGUE_GUARD_HOURS * 60 - 1) * 60 * 1000,
  ).toISOString()
  const outsideWindow = new Date(
    NOW.getTime() - (NEW_EVENT_FATIGUE_GUARD_HOURS * 60 + 1) * 60 * 1000,
  ).toISOString()

  assert.match(
    registrationReminderSuppressionReason({
      hasPortalRegistration: false,
      hasVerifiedExternalTicket: false,
      newEventAnnouncementSentAt: withinWindow,
      now: NOW,
    }),
    /fatigue window/,
  )
  assert.equal(
    registrationReminderSuppressionReason({
      hasPortalRegistration: false,
      hasVerifiedExternalTicket: false,
      newEventAnnouncementSentAt: outsideWindow,
      now: NOW,
    }),
    null,
  )
})

test("test mode targets only the approved allowlist", () => {
  const allowlist = ["approved@example.org"]
  assert.equal(
    registrationReminderRecipientIsEnabled("test", "APPROVED@example.org", allowlist),
    true,
  )
  assert.equal(
    registrationReminderRecipientIsEnabled("test", "member@example.org", allowlist),
    false,
  )
  assert.equal(
    registrationReminderRecipientIsEnabled("off", "approved@example.org", allowlist),
    false,
  )
})

test("the rollout feature flag is fail-closed and per-event opt-out prevents eligibility", () => {
  assert.equal(registrationReminderFeatureEnabled(undefined), false)
  assert.equal(registrationReminderFeatureEnabled("false"), false)
  assert.equal(registrationReminderFeatureEnabled("true"), true)
  assert.equal(
    registrationReminderEventIsDue(
      dueEvent({ registration_reminder_enabled: false }),
      NOW,
    ),
    false,
  )
})

test("synced external ticket holders are suppressed", () => {
  assert.equal(
    registrationReminderSuppressionReason({
      hasPortalRegistration: false,
      hasVerifiedExternalTicket: true,
      now: NOW,
    }),
    "recipient has a verified external ticket",
  )
})

test("the deterministic recovery window is exclusive at 66 hours and inclusive at 72 hours", () => {
  const { windowStart, windowEnd } = registrationReminderWindow(NOW)
  assert.equal(windowStart.toISOString(), "2026-08-28T10:00:00.000Z")
  assert.equal(windowEnd.toISOString(), "2026-08-28T16:00:00.000Z")
  assert.equal(
    registrationReminderEventIsDue(
      dueEvent({ starts_at: windowStart.toISOString() }),
      NOW,
    ),
    false,
  )
  assert.equal(
    registrationReminderEventIsDue(
      dueEvent({ starts_at: new Date(windowStart.getTime() + 1).toISOString() }),
      NOW,
    ),
    true,
  )
  assert.equal(
    registrationReminderEventIsDue(dueEvent({ starts_at: windowEnd.toISOString() }), NOW),
    true,
  )
})

test("delivery code preserves send-time gates and per-recipient Resend idempotency", () => {
  const source = readFileSync(
    new URL("../src/lib/member-notifications/email-service.ts", import.meta.url),
    "utf8",
  )
  assert.match(source, /from\("event_registrations"\)/)
  assert.match(source, /from\("event_ticket_access"\)/)
  assert.match(source, /registrationReminderSuppressionReason/)
  assert.match(source, /\.update\(\{ status: "processing"/)
  assert.match(source, /\.update\(delivery\.dedupe_key\)/)
  assert.doesNotMatch(source, /eventRegistrationReminderEmail[\s\S]*join_url/)
})
