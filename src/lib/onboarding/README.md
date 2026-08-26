# Onboarding foundation contract

## Resumable flows

`member_onboarding_progress` stores independent state for `welcome`, `whatsapp`,
`profile`, and `product_tour`. Each flow has `started_at`, `current_step`, and
`completed_at` fields. `saveOnboardingFlowProgress()` advances one flow without
resetting another flow or replacing a previously recorded completion timestamp.

The legacy connection-request, invite, and event-RSVP milestone timestamps remain
unchanged. Existing profile and WhatsApp timestamps are also preserved.

Profile onboarding uses the approved seven-item denominator:

1. profile photo;
2. short bio;
3. current role (`profiles.persona`, renamed in the UI);
4. school or organization (nonblank `profiles.affiliation`, legacy
   `profiles.school`, or any nonblank `member_education.institution`);
5. at least one interest;
6. grouped About you (`role_and_goals`, `inspiration`, and `support_needs` must
   all be answered); and
7. LinkedIn (`linkedin_url` is present or the member explicitly selects “I
   don't use LinkedIn”).

WhatsApp is not part of profile completion. UI code may call
`profileCompletionFieldsFromRecord()` and `isProfileOnboardingComplete()`, or
use the profile branch's equivalent authoritative seven-item helper. The record
adapter deliberately maps current role to `profiles.persona`; `role_and_goals`
belongs only to grouped About you. Pass loaded `member_education` rows and the
explicit LinkedIn opt-out state through the adapter options.

Integration requirement: existing auth/ProfileForm completion callers pass
only the legacy photo, bio, and interests fields. Those callers must be rewired
to supply all seven semantic items before they call the milestone writer; the
legacy three-field shape remains accepted only so integration does not break at
compile time, and `missingProfileOnboardingFields()` makes its four missing
items explicit. Until rewired, those saves cannot newly complete the profile
milestone. Already populated `profile_completed_at` values remain authoritative
and are never cleared or replaced. The SQL backfill safely handles members with
a LinkedIn URL; the profile integration must handle the explicit-opt-out branch.

For compatibility, `support_needs` and the LinkedIn opt-out remain in Supabase
Auth user metadata. The profile page, dashboard, authoritative completion
synchronizer, and foundation backfill all read those metadata values and accept
`linkedin_opt_out === true`. A future schema normalization can move both values
to dedicated profile columns after a separate migration/RLS review; this
integration deliberately adds no such production migration.

## WhatsApp channels and join intent

Permanent channel metadata is safe to render from
`src/lib/whatsapp/channels.ts`; it contains no invite URLs. General is featured
and recommended. There is deliberately no Announcements channel or invite:
joining any IPN group automatically adds the member to Announcements.

Raw permanent invites must be configured only in server environment variables:

- `WHATSAPP_GENERAL_INVITE_URL`
- `WHATSAPP_LABS_INVITE_URL`
- `WHATSAPP_CONFERENCES_INVITE_URL`

The authenticated handoff-issuance endpoint is:

`POST /api/whatsapp/handoffs/{permanent|event}/{slug}?source={source}&surface={surface}&sessionId={portalSessionId}`

- The endpoint requires a valid portal session and rechecks channel access.
- It returns `{ handoffPath, expiresAt, channel }`; it never returns a raw invite.
- The handoff is an opaque 256-bit token, stored only as a SHA-256 hash, bound
  to the member, channel, source, surface, analytics session, and optional event.
- Handoffs expire after 10 minutes and can be consumed once.
- Permanent slugs are strictly `general`, `labs`, or `conferences`.
- Event slugs resolve only when the event is published, its WhatsApp chat is
  active, the invite uses `https://chat.whatsapp.com`, and the member has RSVP'd.
- The `source` is normalized to a safe analytics identifier; invalid or missing
  values become `unspecified`.
- Authenticated UI should pass the existing Portal analytics `sessionId` so the
  click stays in the current session journey. The route uses a server-generated
  fallback when the UI cannot provide one.

The definitive redirect endpoint is:

`GET /go/whatsapp/{channel}?handoff={opaqueToken}`

It validates the token and current server-only destination, atomically consumes
the handoff, inserts `member_whatsapp_join_intents`, and then redirects. The
intent insert trigger completes the member's WhatsApp milestone without
replacing an earlier timestamp. A used, expired, invalid, or channel-mismatched
token returns `410` and cannot mark intent.
Event handoffs recheck the originating member's RSVP at consumption time, so a
handoff issued before an RSVP cancellation cannot bypass event-chat gating.

`GET /go/whatsapp/{permanentChannel}?source={source}` without a handoff remains
a compatibility fallback for old/static QR assets. It logs only
`whatsapp_anonymous_redirect`; it never records a member intent or milestone,
even if the browser happens to carry a portal auth cookie. Tokenless event-chat
redirects are not allowed.

## UI adapter

Import `issueWhatsAppHandoff()` from `src/lib/whatsapp/client.ts`. This is the
definitive browser adapter; it validates the issuance response and exposes no raw
invite URL.

Same-device CTA:

1. On the authenticated click, POST a handoff with `surface=desktop_direct` or
   `surface=mobile_direct`.
2. Navigate the current window to the returned `handoffPath`.
3. `/go` consumes intent before redirecting to WhatsApp.

Automatically displayed desktop QR:

1. On initial desktop render and whenever channel selection changes, POST a
   handoff with `surface=desktop_qr_scan`.
2. Render a QR for `new URL(handoffPath, window.location.origin).toString()`.
3. Refresh the QR shortly before `expiresAt` (recommended: 60 seconds early).
4. Issuance and display are not join intent. Only a successful `/go` consume
   records QR join intent and the milestone.

The UI branch's temporary tokenless `/go` implementation must be deleted during
integration. Do not retain static direct-invite QR assets or a second redirect
route.

The QR contains the opaque public handoff URL, not a direct WhatsApp invite and
not an auth-gated portal destination. This works when the phone does not share
the desktop session. Successful consumption records scan/redirect join intent;
it does not prove WhatsApp membership. UI copy must not claim the QR was scanned
before consumption or that the member joined WhatsApp.

`member_whatsapp_join_intents` is the append-only authoritative record of channel
kind/slug, source, user, optional event, and click timestamp. Its insert trigger
atomically marks the WhatsApp onboarding milestone without replacing an earlier
timestamp. The first-party analytics event is `whatsapp_join_intent`; it is
behavioral analytics, not membership verification. Tokenless fallback traffic
uses `whatsapp_anonymous_redirect` and is never attributed to a member.
