import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  getOnboardingFlowState,
  isProfileOnboardingComplete,
  profileCompletionFieldsFromRecord,
} from "../src/lib/onboarding/progress.ts"
import {
  PERMANENT_WHATSAPP_CHANNELS,
  WHATSAPP_ANNOUNCEMENTS_NOTE,
  isPermanentWhatsAppChannelSlug,
  normalizeWhatsAppSource,
  validateEventWhatsAppAccess,
  validateWhatsAppInviteUrl,
} from "../src/lib/whatsapp/channels.ts"

test("profile completion requires all five approved semantic fields", () => {
  const complete = {
    photoUrl: "https://example.test/photo.jpg",
    shortBio: "Short bio",
    currentRole: "Graduate researcher",
    schoolOrOrganization: "Example University",
    interests: ["Harm reduction"],
  }

  assert.equal(isProfileOnboardingComplete(complete), true)
  for (const key of Object.keys(complete)) {
    const incomplete = { ...complete, [key]: key === "interests" ? [] : "" }
    assert.equal(isProfileOnboardingComplete(incomplete), false, `${key} must be required`)
  }
})

test("legacy three-field profile calls cannot mark the stricter milestone", () => {
  assert.equal(isProfileOnboardingComplete({
    avatar_url: "https://example.test/photo.jpg",
    bio: "Short bio",
    interest_tags: ["Policy"],
  }), false)
})

test("profile records map onto the semantic completion contract", () => {
  const fields = profileCompletionFieldsFromRecord({
    avatar_url: "https://example.test/photo.jpg",
    bio: "Short bio",
    role_and_goals: "Research coordinator",
    school: null,
    affiliation: "Example Institute",
    interest_tags: ["Research"],
  })
  assert.equal(fields.schoolOrOrganization, "Example Institute")
  assert.equal(isProfileOnboardingComplete(fields), true)
})

test("each resumable flow derives state independently", () => {
  const progress = {
    welcome_started_at: "2026-08-25T12:00:00.000Z",
    welcome_current_step: "intro",
    welcome_completed_at: null,
    product_tour_started_at: "2026-08-25T12:01:00.000Z",
    product_tour_current_step: "events",
    product_tour_completed_at: "2026-08-25T12:02:00.000Z",
  }

  assert.deepEqual(getOnboardingFlowState(progress, "welcome"), {
    status: "in_progress",
    currentStep: "intro",
    startedAt: "2026-08-25T12:00:00.000Z",
    completedAt: null,
  })
  assert.equal(getOnboardingFlowState(progress, "product_tour").status, "completed")
  assert.equal(getOnboardingFlowState(progress, "profile").status, "not_started")
})

test("permanent channel metadata is strict and contains no raw invites", () => {
  assert.deepEqual(Object.keys(PERMANENT_WHATSAPP_CHANNELS), ["general", "labs", "conferences"])
  assert.equal(PERMANENT_WHATSAPP_CHANNELS.general.featured, true)
  assert.equal(isPermanentWhatsAppChannelSlug("announcements"), false)
  assert.match(WHATSAPP_ANNOUNCEMENTS_NOTE, /automatically adds/i)
  assert.match(WHATSAPP_ANNOUNCEMENTS_NOTE, /does not publish/i)
  assert.doesNotMatch(JSON.stringify(PERMANENT_WHATSAPP_CHANNELS), /chat\.whatsapp\.com/)
})

test("WhatsApp invites require the HTTPS group-invite host", () => {
  assert.equal(
    validateWhatsAppInviteUrl("https://chat.whatsapp.com/TestInviteCode123?mode=gi_t")?.hostname,
    "chat.whatsapp.com",
  )
  for (const unsafe of [
    "http://chat.whatsapp.com/code",
    "https://evil.test/code",
    "https://chat.whatsapp.com.evil.test/code",
    "https://chat.whatsapp.com/",
    "https://user@chat.whatsapp.com/code",
    "https://chat.whatsapp.com/code#fragment",
  ]) {
    assert.equal(validateWhatsAppInviteUrl(unsafe), null, unsafe)
  }
})

test("event chats require publication, active WhatsApp configuration, and RSVP", () => {
  const event = {
    id: "event-id",
    slug: "event-slug",
    title: "Event",
    status: "published",
    chat_platform: "whatsapp",
    chat_status: "active",
    chat_external_url: "https://chat.whatsapp.com/EventInvite123",
  }
  assert.equal(validateEventWhatsAppAccess(event, false).reason, "rsvp_required")
  assert.equal(validateEventWhatsAppAccess(event, true).allowed, true)
  assert.equal(validateEventWhatsAppAccess({ ...event, chat_status: "draft" }, true).reason, "inactive")
  assert.equal(validateEventWhatsAppAccess({ ...event, chat_external_url: "https://evil.test/x" }, true).reason, "invalid_invite")
})

test("source normalization is bounded", () => {
  assert.equal(normalizeWhatsAppSource(" Welcome-Modal "), "welcome-modal")
  assert.equal(normalizeWhatsAppSource("../../unsafe"), "unspecified")
})

test("migration preserves milestone timestamps and locks the intent ledger", async () => {
  const onboardingSql = await readFile(
    new URL("../supabase/migrations/20260825184440_onboarding_foundation.sql", import.meta.url),
    "utf8",
  )
  const whatsappSql = await readFile(
    new URL("../supabase/migrations/20260825191317_whatsapp_join_intents.sql", import.meta.url),
    "utf8",
  )
  assert.match(onboardingSql, /profile_completed_at = coalesce\(/)
  assert.match(onboardingSql, /whatsapp_started_at = coalesce\(whatsapp_started_at, whatsapp_completed_at\)/)
  assert.match(whatsappSql, /enable row level security/)
  assert.match(whatsappSql, /revoke all on table public\.member_whatsapp_join_intents from anon, authenticated, public/)
  assert.match(whatsappSql, /grant select, insert on public\.member_whatsapp_join_intents to service_role/)
  assert.match(whatsappSql, /revoke update, delete, truncate on table public\.member_whatsapp_join_intents from service_role/)
  assert.match(whatsappSql, /after insert on public\.member_whatsapp_join_intents/)
  assert.match(whatsappSql, /whatsapp_completed_at = coalesce\(/)
  assert.match(whatsappSql, /'whatsapp_join_intent'/)

  const analyticsSource = await readFile(
    new URL("../src/lib/portal-analytics/events.ts", import.meta.url),
    "utf8",
  )
  assert.match(analyticsSource, /"whatsapp_join_intent"/)
})
