import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import {
  productTourProgressFromServer,
  productTourServerStep,
} from "../src/components/product-tour/tour-state.ts"

test("WhatsApp UI uses the foundation handoff and no tracked QR fixtures", async () => {
  const adapter = await readFile(new URL("../src/components/onboarding/foundation-adapter.ts", import.meta.url), "utf8")
  const landing = await readFile(new URL("../src/components/onboarding/WhatsAppLanding.tsx", import.meta.url), "utf8")

  assert.match(adapter, /issueWhatsAppHandoff as issueFoundationHandoff/)
  assert.match(adapter, /new URL\(handoff\.handoffPath, window\.location\.origin\)/)
  assert.match(adapter, /QRCode\.toDataURL/)
  assert.match(landing, /desktop_qr_scan/)
  assert.match(landing, /matchMedia\("\(max-width: 760px\)"\)/)
  assert.match(landing, /Date\.parse\(target\.expiresAt\) - Date\.now\(\) - 60_000/)
  assert.match(landing, /finally \{\s+setContinuing\(false\)\s+router\.push\("\/dashboard"\)/)
  assert.match(landing, /window\.open\("about:blank", "_blank"\)/)
  assert.match(landing, /handoffWindow\.location\.replace/)
  assert.match(landing, /href=\{selected\.redirectPath\}/)

  for (const slug of ["general", "labs", "conferences"]) {
    await assert.rejects(access(new URL(`../public/onboarding/qr-${slug}.svg`, import.meta.url)))
  }
})

test("community and event actions centralize handoffs while personal contacts remain separate", async () => {
  const community = await readFile(new URL("../src/components/community/WhatsAppCommunityCard.tsx", import.meta.url), "utf8")
  const eventCard = await readFile(new URL("../src/components/events/EventCard.tsx", import.meta.url), "utf8")
  const authActions = await readFile(new URL("../src/lib/auth/actions.ts", import.meta.url), "utf8")

  assert.match(community, /href="\/onboarding\/whatsapp\?motion=editorial"/)
  assert.doesNotMatch(community, /NEXT_PUBLIC_WHATSAPP/)
  assert.match(eventCard, /WhatsAppHandoffAction/)
  assert.doesNotMatch(eventCard, /href=\{eventChat/)
  assert.doesNotMatch(authActions, /completedSteps\.push\("whatsapp"\)/)
})

test("durable product tour state round-trips status and active step", () => {
  const progress = productTourProgressFromServer({
    startedAt: "2026-08-25T12:00:00.000Z",
    currentStep: "active_events",
    completedAt: null,
  })
  assert.equal(progress?.status, "active")
  assert.equal(productTourServerStep(progress), "active_events")

  const completed = productTourProgressFromServer({
    startedAt: "2026-08-25T12:00:00.000Z",
    currentStep: "complete",
    completedAt: "2026-08-25T12:05:00.000Z",
  })
  assert.equal(completed?.status, "completed")
})

test("durable tour state wins over local fallback and core profile actions recover from failures", async () => {
  const tourProvider = await readFile(new URL("../src/components/product-tour/ProductTourProvider.tsx", import.meta.url), "utf8")
  const profileForm = await readFile(new URL("../src/app/dashboard/profile/ProfileForm.tsx", import.meta.url), "utf8")

  assert.match(tourProvider, /if \(serverStateAvailable\) \{\s+window\.localStorage\.removeItem\(storageKey\)\s+setProgress\(durable\)/)
  assert.match(tourProvider, /if \(isEditable\) return/)
  assert.match(tourProvider, /if \(!isActive && tourWasActiveRef\.current\) restoreTourFocus\(\)/)
  assert.match(tourProvider, /target\?\.focus/)
  assert.match(profileForm, /role="dialog"/)
  assert.match(profileForm, /aria-label="Photo zoom"/)
  assert.match(profileForm, /if \(profileUpdateError\)/)
  assert.match(profileForm, /finally \{\s+setSaving\(false\)/)
})
