import test from "node:test"
import assert from "node:assert/strict"

import {
  STANDARD_REGISTRATION_DESTINATION,
  registrationDestination,
} from "../src/app/register/registration-destination.ts"
import {
  ACTIVATION_MILESTONE_ORDER,
  activationSummary,
} from "../src/app/dashboard/activation-model.ts"
import {
  PRODUCT_TOUR_STEPS,
  PRODUCT_TOUR_VERSION,
  nextTourProgress,
  parseProductTourProgress,
} from "../src/components/product-tour/tour-state.ts"

test("standard registration starts the progressive onboarding route", () => {
  assert.equal(registrationDestination(""), STANDARD_REGISTRATION_DESTINATION)
  assert.equal(STANDARD_REGISTRATION_DESTINATION, "/dashboard/welcome")
})

test("event-first registration preserves the complete next destination", () => {
  const destination = "/events/psychedelx-opening?source=public#rsvp"
  assert.equal(registrationDestination(destination), destination)
})

test("activation summary follows durable milestone priority without counting exploration suggestions", () => {
  const summary = activationSummary({
    whatsapp_completed_at: "2026-08-25T12:00:00.000Z",
    profile_completed_at: null,
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
    invite_completed_at: null,
  })

  assert.deepEqual(ACTIVATION_MILESTONE_ORDER, ["whatsapp", "profile", "event", "community", "invite"])
  assert.deepEqual(summary, {
    completedCount: 1,
    totalCount: 5,
    nextMilestone: "profile",
  })
})

test("activation summary uses authoritative profile progress and advances to events", () => {
  const summary = activationSummary({
    whatsapp_completed_at: "done",
    profile_completed_at: "done",
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
    invite_completed_at: null,
  })

  assert.equal(summary.nextMilestone, "event")
})

test("product tour visits only active portal routes in the required sequence", () => {
  assert.deepEqual(
    PRODUCT_TOUR_STEPS.map((step) => step.route),
    [
      "/dashboard",
      "/dashboard/profile",
      "/dashboard/events",
      "/dashboard/directory",
      "/dashboard/conferences",
      "/dashboard/resources",
      "/dashboard",
    ],
  )
})

test("product tour progress parses safely and remains resumable", () => {
  const stored = JSON.stringify({
    version: PRODUCT_TOUR_VERSION,
    status: "paused",
    stepIndex: 3,
  })
  const progress = parseProductTourProgress(stored)
  assert.deepEqual(progress, {
    version: PRODUCT_TOUR_VERSION,
    status: "paused",
    stepIndex: 3,
  })
  assert.deepEqual(nextTourProgress(progress, 1), {
    version: PRODUCT_TOUR_VERSION,
    status: "active",
    stepIndex: 4,
  })
  assert.equal(parseProductTourProgress('{"status":"active"}'), null)
})
