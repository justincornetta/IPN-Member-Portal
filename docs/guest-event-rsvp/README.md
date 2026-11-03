# Guest event RSVP and optional IPN signup

Status: implemented on `feature/guest-event-rsvp`; Justin approved publishing and opening a PR after the full-description correction. No production migration, account creation or real email send has been performed.

## Decision and scope

Justin selected inline RSVP on the existing event page, keeping the current portal styling. The event artwork, Geist typography, light surfaces, purple controls, header, event content and footer remain. The new brand guidelines are not applied.

The current public event page can be viewed without an account, but its RSVP gate directs visitors into login or the longer member registration flow. The revised path is event page → first name, last name and email → confirmed RSVP with calendar/join links. Optional IPN account creation comes after confirmation. Signed-in members keep a one-click RSVP.

The initial [imagegen concept](selected-inline-concept.png), [generation prompt](imagegen-prompt.txt), [original event screenshot](current-event-before.png), and [design review](design-qa.md) are retained. The concept is an illustration: the implementation uses real event timestamps, not the concept's incorrect example reminder date.

## Local review

Run `npm ci`, `npm run qa:install`, then `npm run guest-events:dev`.

- Event: http://127.0.0.1:4331/events/guest-rsvp-preview
- Signed-in state: http://127.0.0.1:4331/events/guest-rsvp-preview?view=member
- Already registered: http://127.0.0.1:4331/events/guest-rsvp-preview?view=registered
- Email sequence: http://127.0.0.1:4331/event-preview/emails
- Optional account signup: http://127.0.0.1:4331/join
- Expired link recovery: http://127.0.0.1:4331/join?expired=1

The development launcher strips integration credentials, uses in-memory registrations, and disables email delivery. The preview join link deliberately goes to example.com. Demo behavior is disabled in production. The fixture includes both complete original event-description paragraphs supplied by Justin. The fixture reproduces the November 3, 2026 event and will stop accepting RSVPs after its end; update fixture dates for future QA sessions. The existing location-details and related-events sections are omitted from the fixture but unchanged in the application.

## Emails and identity

| Message | When | Recipient |
| --- | --- | --- |
| RSVP confirmation | Queued atomically with the RSVP; processing begins after the response | Every new guest RSVP |
| 24-hour reminder | 24 hours before the event; skipped if that window has passed | Active guests |
| 1-hour reminder | 1 hour before the event; skipped if that window has passed | Active guests |
| Membership invitation | 24 hours after event end | Guests who explicitly opted in and have not joined |
| Secure signup/sign-in link | Only when requested | The entered email address |

The existing scheduled worker runs every 10 minutes, so reminders can arrive up to one interval after their due time. Direct event links do not require a portal login. Invitations do not claim that a guest attended or promise recordings. The invitation checkbox starts unchecked. Unsubscribing suppresses the invitation associated with that RSVP; event reminders remain. Cancellation suppresses the whole event email sequence and removes any linked member RSVP atomically.

Guest RSVP does not create an account. Optional signup generates a Supabase email verification link and sends it with Resend. Verified email ownership is required before guest RSVPs are associated with an account. New accounts from this path start with directory discoverability/location sharing off; profile details can be added later. Existing password login and the standard registration page remain available. Expired links return to the new signup form, and requesting another link preserves the typed identity.

Private guest tables use RLS and no anonymous/authenticated table or RPC grants. The server enforces event eligibility, input/origin checks, a honeypot and persistent HMAC-keyed rate limits. Signed RSVP-management links are limited to one RSVP and confer no member access. These routes and auth callbacks are excluded from portal analytics, and the management page uses no-referrer/noindex metadata. Keep management links private. Rotating the signing secret invalidates existing links.

The outbox stores a stable email payload before sending and uses `guest-event/<job-id>` as the Resend idempotency key. Workers lease jobs; retries stop for manual review after five attempts or 23 hours to avoid resending beyond Resend's idempotency window. Rescheduled fresh jobs are postponed; uncertain deliveries with changed timing need review. Converted guests remain on their original delivery ledger, and member confirmation/reminder jobs skip them to prevent double delivery.

## Verification

Locked dependencies and the repo browser runtime installed successfully. Lint, production build and diff checks pass. The focused suite covers 36 domain, SQL, sender and existing event/auth regression checks. The five browser workflows exercise 1440/1280/390 px, guest/member states, first-field and success focus, unselected consent, prefilled signup, duplicate submission, errors/retry with retained input, private management, cancellation, unsubscribe, email rendering, dark-system contrast and requesting another signup link.

The migration was executed against local PGlite with private-role checks, duplicate/consent/outbox assertions, verified-email linking, count preservation, bounded leases and transaction rollback on cancellation failure. Email delivery uses a mock Resend client in tests. Actual hosted Supabase verification and Resend inbox delivery remain deployment-stage checks. No attendance data was collected; RSVP and portal conversion must not be presented as attendance.

## Publishing and rollout

Justin approved pushing/opening a PR on November 2, 2026, after restoring the complete description. Merge and production rollout remain separate decisions. Auth/schema ownership should be flagged for Luke during review. This branch is based on `origin/main` at `c9e0787` and is isolated from the active media-intake worktree.

After publishing approval, review/deploy the additive migration `supabase/migrations/20261103033258_guest_event_rsvp.sql` before deploying the new admin event query. Existing events default to guest RSVP disabled. `supabase/schema.sql` remains the older bootstrap snapshot; this additional migration is required for new installations as well.

Production configuration required:

- `GUEST_EVENT_RSVP_ENABLED=true`
- `GUEST_EVENT_EMAIL_MODE=live` and hosting `CONTEXT=production`
- `GUEST_EVENT_TOKEN_SECRET` with at least 32 random characters, server-only
- `NEXT_PUBLIC_SITE_URL=https://members.intercollegiatepsychedelics.net`
- Existing server-side Supabase credentials and `RESEND_API_KEY`
- A verified `EVENT_EMAIL_FROM` sender and optional `EVENT_EMAIL_REPLY_TO`

Validate the Supabase email-link expiry configuration (copy currently describes one hour), callback allowlist, verified Resend sender and scheduled worker in an isolated environment before enabling an event. Do not submit a test to a deploy preview sharing production storage; preview email delivery is disabled, but shared production workers may still act on stored data from other features. No staging environment was changed in this task.

Enable “Allow guest RSVP without an IPN account” only on the intended event, with the correct direct join URL. Ticket-required events, external-registration events and recordings are excluded. Monitor `guest_event_email_deliveries` for failed/review jobs and reconcile Resend delivery IDs before manually retrying an uncertain send. Cancellation/consent are rechecked at send time. Switching off the feature or an event also stops its guest delivery worker, so account for already registered guests before a rollback. Do not purge the delivery ledger while messages may be retried.

## Evidence

Full-page images are in [screenshots](screenshots). Important views: [desktop form](screenshots/1440-form.png), [phone confirmation](screenshots/390-confirmation.png), [optional signup](screenshots/390-optional-signup.png), [dark-system signup](screenshots/join-dark-system.png), [confirmation email](screenshots/email-rsvp-confirmation.png), [membership invitation](screenshots/email-membership-invitation.png).
