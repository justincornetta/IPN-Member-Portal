import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  externalRegistrationLabel,
  externalRegistrationStatus,
} from "../src/lib/events/external-registration.ts"

test("external registration labels are provider-aware with a safe fallback", () => {
  assert.equal(externalRegistrationLabel("Partiful"), "RSVP on Partiful")
  assert.equal(externalRegistrationLabel("Eventbrite"), "Register on Eventbrite")
  assert.equal(externalRegistrationLabel("Lu.ma"), "Register on Lu.ma")
  assert.equal(externalRegistrationLabel("Other"), "Register externally")
  assert.equal(externalRegistrationStatus("Partiful"), "Registration on Partiful")
  assert.equal(externalRegistrationStatus(null), "External registration")
})

test("conference meetups support reusable external registration configuration", () => {
  const conferenceTypes = readFileSync(
    new URL("../src/lib/conferences/types.ts", import.meta.url),
    "utf8",
  )
  const conferenceActions = readFileSync(
    new URL("../src/lib/admin/conference-actions.ts", import.meta.url),
    "utf8",
  )
  const conferenceUi = readFileSync(
    new URL("../src/components/conferences/ConferenceInteractive.tsx", import.meta.url),
    "utf8",
  )

  assert.match(conferenceTypes, /registrationUrl\?: string \| null/)
  assert.match(conferenceTypes, /registrationProvider\?: string \| null/)
  assert.match(conferenceActions, /registrationUrl: clean\(meetup\.registrationUrl\)/)
  assert.match(conferenceActions, /registrationProvider: clean\(meetup\.registrationProvider\)/)
  assert.match(conferenceUi, /meetup\.registrationUrl \? \(/)
  assert.match(conferenceUi, /ExternalRegistrationAction/)
})

test("Horizons mixer migration adds the Partiful link without replacing the meetup array", () => {
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/20260921191655_add_horizons_partiful_registration.sql",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(sql, /horizons-2026-meetup-1/)
  assert.match(sql, /https:\/\/partiful\.com\/e\/1iyPTemwzvjkRBdCfpj0\?c=-Gg-omcv/)
  assert.match(sql, /jsonb_array_elements\(conference\.meetups\)/)
  assert.match(sql, /meetup \|\| jsonb_build_object/)
})
