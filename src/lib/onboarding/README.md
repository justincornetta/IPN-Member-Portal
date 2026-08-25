# Onboarding foundation contract

## Resumable flows

`member_onboarding_progress` stores independent state for `welcome`, `whatsapp`,
`profile`, and `product_tour`. Each flow has `started_at`, `current_step`, and
`completed_at` fields. `saveOnboardingFlowProgress()` advances one flow without
resetting another flow or replacing a previously recorded completion timestamp.

The legacy connection-request, invite, and event-RSVP milestone timestamps remain
unchanged. Existing profile and WhatsApp timestamps are also preserved.

Profile onboarding is complete only when all five semantic fields are present:
photo, short bio, current role, school/organization, and at least one interest.
UI code should call `isProfileOnboardingComplete()` with those semantic fields;
the current database adapter maps current role to `profiles.role_and_goals` and
school/organization to `profiles.school ?? profiles.affiliation`.

## WhatsApp channels and join intent

Permanent channel metadata is safe to render from
`src/lib/whatsapp/channels.ts`; it contains no invite URLs. General is featured
and recommended. There is deliberately no Announcements channel or invite:
joining any IPN group automatically adds the member to Announcements.

Raw permanent invites must be configured only in server environment variables:

- `WHATSAPP_GENERAL_INVITE_URL`
- `WHATSAPP_LABS_INVITE_URL`
- `WHATSAPP_CONFERENCES_INVITE_URL`

The authenticated first-party endpoint is:

`POST /api/whatsapp/{permanent|event}/{slug}?source={source}&mode={redirect|qr}`

- `mode=redirect` records intent, then responds with a `303` to the validated
  WhatsApp invite.
- `mode=qr` records intent, then returns a private, non-cacheable JSON response
  containing the validated direct invite for client-side QR rendering.
- Permanent slugs are strictly `general`, `labs`, or `conferences`.
- Event slugs resolve only when the event is published, its WhatsApp chat is
  active, the invite uses `https://chat.whatsapp.com`, and the member has RSVP'd.
- The `source` is normalized to a safe analytics identifier; invalid or missing
  values become `unspecified`.

The endpoint is intentionally POST-only so prefetching or merely rendering a link
cannot mark completion. A direct-click UI can submit a same-origin POST form in a
new tab. A QR UI should call `mode=qr` only after an explicit authenticated
“continue/show QR” action.

The QR contains the direct WhatsApp invite, not a portal URL. This is necessary
because the member's phone may not share the desktop browser session. The desktop
action records join intent and completes the WhatsApp onboarding milestone before
the QR is shown; it does not prove that the QR was scanned or that the member
joined WhatsApp. UI copy must not claim either. The raw invite is disclosed only
to the authenticated UI flow at that moment, though any recipient can naturally
copy a WhatsApp invite after disclosure.

`member_whatsapp_join_intents` is the append-only authoritative record of channel
kind/slug, source, user, optional event, and click timestamp. Its insert trigger
atomically marks the WhatsApp onboarding milestone without replacing an earlier
timestamp. The first-party analytics event is `whatsapp_join_intent`; it is
behavioral analytics, not membership verification.
