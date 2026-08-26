import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  STANDARD_REGISTRATION_DESTINATION,
  registrationDestination,
} from "../src/app/register/registration-destination.ts"
import {
  ACTIVATION_MILESTONE_ORDER,
  activationSummary,
  isProfileMilestoneComplete,
} from "../src/app/dashboard/activation-model.ts"
import {
  PRODUCT_TOUR_STEPS,
  PRODUCT_TOUR_VERSION,
  nextTourProgress,
  parseProductTourProgress,
} from "../src/components/product-tour/tour-state.ts"

test("standard registration starts the progressive onboarding route", () => {
  assert.equal(registrationDestination(""), STANDARD_REGISTRATION_DESTINATION)
  assert.equal(STANDARD_REGISTRATION_DESTINATION, "/onboarding/welcome?motion=editorial")
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

test("continuing past optional WhatsApp keeps profile as the foreground priority", () => {
  const summary = activationSummary({
    whatsapp_current_step: "continued",
    whatsapp_completed_at: null,
    profile_completed_at: null,
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
    invite_completed_at: null,
  })
  assert.equal(summary.completedCount, 0)
  assert.equal(summary.nextMilestone, "profile")
})

test("activation checklist supports explicit WhatsApp self-attestation", async () => {
  const checklist = await readFile(
    new URL("../src/app/dashboard/ActivationChecklist.tsx", import.meta.url),
    "utf8",
  )

  assert.match(checklist, /I’m already in/)
  assert.match(checklist, /currentStep: "self_attested"/)
  assert.match(checklist, /complete: true/)
  assert.match(checklist, /We couldn’t save that confirmation\. Try again\./)
})

test("activation checklist uses one getting-started heading and green completion markers", async () => {
  const checklist = await readFile(
    new URL("../src/app/dashboard/ActivationChecklist.tsx", import.meta.url),
    "utf8",
  )

  assert.equal(checklist.match(/Getting Started/g)?.length, 1)
  assert.doesNotMatch(checklist, /Steps to get started/i)
  assert.match(checklist, /bg-emerald-100 text-emerald-700/)
  assert.match(checklist, /item\.completed \? <CheckIcon \/> : index \+ 1/)
})

test("a semantically complete profile satisfies the activation milestone", () => {
  assert.equal(isProfileMilestoneComplete(null, 7, 7), true)
  assert.equal(isProfileMilestoneComplete(null, 6, 7), false)
  assert.equal(isProfileMilestoneComplete("2026-08-26T12:00:00.000Z", 6, 7), true)
  assert.equal(isProfileMilestoneComplete(null, 0, 0), false)
})

test("dashboard upcoming activity preserves 16:9 event covers and surfaces conference meetups", async () => {
  const upcoming = await readFile(
    new URL("../src/app/dashboard/UpcomingEventsCarousel.tsx", import.meta.url),
    "utf8",
  )
  const dashboard = await readFile(
    new URL("../src/app/dashboard/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(upcoming, /className="relative block aspect-video/)
  assert.match(upcoming, /IPN Events/)
  assert.match(upcoming, /Conferences/)
  assert.match(upcoming, /RSVP to meetup/)
  assert.match(upcoming, /No IPN meetup announced yet/)
  assert.match(dashboard, /from\("conferences"\)/)
  assert.match(dashboard, /conferences=\{/)
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
