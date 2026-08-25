import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import test from "node:test"

import {
  getOnboardingFlowState,
  isProfileOnboardingComplete,
  missingProfileOnboardingFields,
  profileCompletionFieldsFromRecord,
} from "../src/lib/onboarding/progress.ts"
import {
  PERMANENT_WHATSAPP_CHANNELS,
  WHATSAPP_ANNOUNCEMENTS_NOTE,
  isPermanentWhatsAppChannelSlug,
  isWhatsAppHandoffToken,
  normalizeWhatsAppAnalyticsSessionId,
  normalizeWhatsAppSource,
  normalizeWhatsAppSurface,
  validateEventWhatsAppAccess,
  validateWhatsAppInviteUrl,
} from "../src/lib/whatsapp/channels.ts"
import { issueWhatsAppHandoff } from "../src/lib/whatsapp/client.ts"

test("profile completion requires all seven approved semantic items", () => {
  const complete = {
    photoUrl: "https://example.test/photo.jpg",
    shortBio: "Short bio",
    currentRole: "Graduate researcher",
    schoolOrOrganization: "Example University",
    interests: ["Harm reduction"],
    aboutYou: {
      roleAndGoals: "Build community programs",
      inspiration: "Peer support",
      supportNeeds: "Mentorship",
    },
    linkedIn: { url: "https://linkedin.com/in/member", optedOut: false },
  }

  assert.equal(isProfileOnboardingComplete(complete), true)
  for (const key of Object.keys(complete)) {
    const incomplete = { ...complete, [key]: key === "interests" ? [] : "" }
    assert.equal(isProfileOnboardingComplete(incomplete), false, `${key} must be required`)
  }

  for (const key of Object.keys(complete.aboutYou)) {
    const incomplete = {
      ...complete,
      aboutYou: { ...complete.aboutYou, [key]: "" },
    }
    assert.equal(isProfileOnboardingComplete(incomplete), false, `aboutYou.${key} must be answered`)
  }

  assert.equal(isProfileOnboardingComplete({
    ...complete,
    linkedIn: { url: null, optedOut: true },
  }), true)
})

test("legacy three-field profile calls cannot mark the stricter milestone", () => {
  const legacy = {
    avatar_url: "https://example.test/photo.jpg",
    bio: "Short bio",
    interest_tags: ["Policy"],
  }
  assert.equal(isProfileOnboardingComplete(legacy), false)
  assert.deepEqual(missingProfileOnboardingFields(legacy), [
    "currentRole",
    "schoolOrOrganization",
    "aboutYou",
    "linkedIn",
  ])
})

test("profile records map onto the semantic completion contract", () => {
  const fields = profileCompletionFieldsFromRecord({
    avatar_url: "https://example.test/photo.jpg",
    bio: "Short bio",
    persona: "Research coordinator",
    affiliation: null,
    school: null,
    interest_tags: ["Research"],
    role_and_goals: "Research coordinator",
    inspiration: "Community research",
    support_needs: "Collaborators",
    linkedin_url: null,
  }, {
    education: [{ institution: "Example Institute" }],
    linkedInOptOut: true,
  })
  assert.equal(fields.schoolOrOrganization, "Example Institute")
  assert.equal(fields.currentRole, "Research coordinator")
  assert.equal(fields.linkedIn.optedOut, true)
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
  assert.equal(normalizeWhatsAppAnalyticsSessionId("session_123"), "session_123")
  assert.equal(normalizeWhatsAppAnalyticsSessionId("session/unsafe"), null)
  assert.equal(normalizeWhatsAppSurface(" desktop_qr_scan "), "desktop_qr_scan")
  assert.equal(normalizeWhatsAppSurface("../../unsafe"), "unspecified")
  assert.equal(isWhatsAppHandoffToken("a".repeat(43)), true)
  assert.equal(isWhatsAppHandoffToken("a".repeat(42)), false)
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
  const handoffSql = await readFile(
    new URL("../supabase/migrations/20260825203017_whatsapp_qr_handoffs.sql", import.meta.url),
    "utf8",
  )
  assert.match(onboardingSql, /profile_completed_at = coalesce\(/)
  assert.match(onboardingSql, /btrim\(profiles\.persona\)/)
  assert.match(onboardingSql, /from public\.member_education/)
  assert.match(onboardingSql, /btrim\(profiles\.support_needs\)/)
  assert.match(onboardingSql, /btrim\(profiles\.linkedin_url\)/)
  assert.match(onboardingSql, /whatsapp_started_at = coalesce\(whatsapp_started_at, whatsapp_completed_at\)/)
  assert.match(whatsappSql, /enable row level security/)
  assert.match(whatsappSql, /revoke all on table public\.member_whatsapp_join_intents from anon, authenticated, public/)
  assert.match(whatsappSql, /grant select, insert on public\.member_whatsapp_join_intents to service_role/)
  assert.match(whatsappSql, /revoke update, delete, truncate on table public\.member_whatsapp_join_intents from service_role/)
  assert.match(whatsappSql, /after insert on public\.member_whatsapp_join_intents/)
  assert.match(whatsappSql, /whatsapp_completed_at = coalesce\(/)
  assert.match(whatsappSql, /'whatsapp_join_intent'/)
  assert.match(handoffSql, /create table if not exists public\.member_whatsapp_handoffs/)
  assert.match(handoffSql, /token_hash text not null unique/)
  assert.match(handoffSql, /for update/)
  assert.match(handoffSql, /create or replace function public\.consume_whatsapp_handoff/)
  assert.match(handoffSql, /insert into public\.member_whatsapp_join_intents/)
  assert.match(handoffSql, /'whatsapp_anonymous_redirect'/)

  const analyticsSource = await readFile(
    new URL("../src/lib/portal-analytics/events.ts", import.meta.url),
    "utf8",
  )
  assert.match(analyticsSource, /"whatsapp_join_intent"/)
  assert.match(analyticsSource, /"whatsapp_anonymous_redirect"/)
})

test("one redirect authority separates tokenized member intent from anonymous fallback", async () => {
  const goRoute = await readFile(
    new URL("../src/app/go/whatsapp/[channel]/route.ts", import.meta.url),
    "utf8",
  )
  const issuanceRoute = await readFile(
    new URL("../src/app/api/whatsapp/handoffs/[kind]/[slug]/route.ts", import.meta.url),
    "utf8",
  )

  assert.match(goRoute, /consume_whatsapp_handoff/)
  assert.match(goRoute, /whatsapp_anonymous_redirect/)
  assert.match(goRoute, /Tokenless GETs are a compatibility fallback/)
  assert.doesNotMatch(issuanceRoute, /member_whatsapp_join_intents/)
  assert.match(issuanceRoute, /member_whatsapp_handoffs/)
  assert.match(issuanceRoute, /handoffPath/)

  await assert.rejects(
    access(new URL("../src/app/api/whatsapp/[kind]/[slug]/route.ts", import.meta.url)),
  )
})

test("browser adapter requests an authenticated handoff and returns a minimal DTO", async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ""
  let requestedInit
  globalThis.fetch = async (url, init) => {
    requestedUrl = String(url)
    requestedInit = init
    return new Response(JSON.stringify({
      handoffPath: `/go/whatsapp/general?handoff=${"a".repeat(43)}`,
      expiresAt: "2026-08-25T21:00:00.000Z",
      channel: { kind: "permanent", slug: "general", label: "General", featured: true },
      inviteUrl: "https://chat.whatsapp.com/should-not-pass-through",
    }), { headers: { "Content-Type": "application/json" } })
  }

  try {
    const result = await issueWhatsAppHandoff({
      kind: "permanent",
      slug: "general",
      source: "onboarding",
      surface: "desktop_qr_scan",
      sessionId: "session_123",
    })
    assert.match(requestedUrl, /^\/api\/whatsapp\/handoffs\/permanent\/general\?/)
    assert.match(requestedUrl, /surface=desktop_qr_scan/)
    assert.equal(requestedInit.method, "POST")
    assert.equal(requestedInit.credentials, "same-origin")
    assert.equal("inviteUrl" in result, false)
    assert.equal(result.channel.slug, "general")
  } finally {
    globalThis.fetch = originalFetch
  }
})
