# Event RSVP and optional IPN registration

[PR #70](https://github.com/justincornetta/IPN-Member-Portal/pull/70) is prepared for production. Justin approved removing the hosted test experience on November 3, 2026. The PR is not merged. Existing portal styling and the complete event description are retained.

## How it works

1. Visitors choose **Sign in & RSVP** or **RSVP without an account** on the event page. Signed-in members RSVP with one click; existing registrants see confirmation.
2. Event-specific sign-in verifies the member and saves the RSVP automatically. Generic login does not enroll anyone. If login succeeds but saving fails, the member stays signed in and can retry.
3. Guests provide first name, last name and email. Saving queues confirmation and eligible reminders atomically, then shows joining/calendar links. Retries do not duplicate registrations.
4. **Join IPN free** opens existing four-step registration. A 30-minute tab-local handoff prefills editable name/email without placing personal details in the URL. Membership is optional; the RSVP remains saved independently. Verified email ownership is required before linking guest RSVPs to an account.
5. The unchecked **Email me an invitation to join IPN after this event** checkbox permits one post-event invitation. It does not subscribe guests to future-event alerts or a newsletter. Standard membership retains its existing newsletter behavior.

## Email behavior

| Message | Timing | Audience |
| --- | --- | --- |
| Confirmation | Queued with RSVP; processing starts after the response | Every new guest RSVP |
| 24-hour reminder | 24 hours before the event; skipped if already passed | Active guests |
| 1-hour reminder | 1 hour before the event; skipped if already passed | Active guests |
| Membership invitation | 24 hours after event end | Opted-in guests who have not joined |

The worker runs every ten minutes, so due messages may arrive up to one interval later. Signed management links allow viewing/canceling an RSVP and opting out of the invitation. Cancellation suppresses remaining event messages; invitation unsubscribe leaves transactional reminders active. Invitations do not imply attendance or promise recordings.

The outbox persists an immutable payload and Resend idempotency key before sending. Leases prevent concurrent delivery; five failed attempts or 23 hours after first attempt require manual review. Converted guests retain their original ledger so member reminders do not double-send. Review uncertain deliveries in Resend before retrying; do not purge their ledger.

## Production preparation completed November 3

- Applied the additive migration to Supabase project `plgzakxecjlzepzeqiio`. The repository filename matches its recorded remote version: `supabase/migrations/20261103123749_guest_event_rsvp.sql`. Do not reapply it to this project. New installations still need this migration; the older `supabase/schema.sql` bootstrap does not contain it.
- Verified RLS on all three guest tables and no anonymous/authenticated table access. Server-only RPCs, origin/input checks, a honeypot, persistent rate limits and signed management links protect the guest path. Rotating the signing key invalidates existing links.
- Saved `GUEST_EVENT_RSVP_ENABLED=true`, `GUEST_EVENT_EMAIL_MODE=live` and a random server signing secret in Netlify's **Production context only**. The secret uses plan-supported Builds/Functions/Runtime scopes; non-secret flags use all scopes. No deploy-preview values were added.
- Verified existing Supabase/Resend variables, canonical HTTPS site URL and event sender settings are present. The sender remains `IPN Events <events@members.intercollegiatepsychedelics.net>` with the IPN reply-to address.
- Enabled guest RSVP only for the published Global Psychedelic Week event. Other events remain opt-in. Recordings, ticket-required and external-registration events are excluded.
- Read-only checks found zero guest registrations and zero email jobs. No live RSVP, test account or email was created. The current production build lacks this feature; it activates after merge and deployment.

Production builds run `npm run release:check` before building. It checks required configuration and reads the required schema without changing data. Missing prerequisites stop publication. Netlify's `CONTEXT` may be absent inside functions, so delivery uses the Production-scoped email setting; explicitly non-production contexts still refuse guest sends. Background handlers retain the platform's deploy-preview guard.

## Hosted preview after cleanup

[Event landing page](https://deploy-preview-70--ipn-member-portal.netlify.app/events/global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional)

The preview no longer has fixture events, sample passwords, fake sessions, test banners, simulated signup, an email inbox or special view query parameters. `/event-preview/emails`, `/join` and `/api/events/membership` are removed. Optional signup uses ordinary `/register`.

Guest enrollment is enabled only in Production, so its button is absent on the deploy preview. Ordinary member login, RSVP and registration use the connected backend. **The hosted preview is no longer a safe sandbox for test submissions.** Use local QA to exercise guest/member flows without side effects.

## Isolated local QA

```sh
npm ci
npm run qa:install
npm run qa:guest-events
```

For manual review run `npm run guest-events:dev`, then open http://localhost:4331/events/guest-rsvp-preview . Use `localhost`, matching the server's request origin. The runner creates an ignored `.qa-guest/` copy with fixture Supabase/action boundaries. It strips integration credentials, never copies `.env` files, intercepts account creation and never queues real email. Shipping code imports no mock modules.

Only in this local copy: `member@example.com` / `preview-password` exercises sign-in; `rsvp-retry@example.com` with the same password exercises partial-success retry. Browser tests set isolated cookies for other states. Query parameters cannot impersonate members. Registration uses the real UI; location lookup returns no candidates and final account creation is intercepted with a QA error. These substitutions are not deployed.

The fixture reproduces the November 3, 2026 event and expires after its end. Update timestamps for future QA. Location details and related events remain in production but are absent from the fixture.

## Verification and limits

Locked dependencies and browser runtime installed. Lint and production build pass. Seventy-three focused checks cover validation, transactional SQL, consent, verified-email linking, counts, cancellation rollback, leases, delivery deduplication, auth restrictions and existing registration/onboarding. Ten browser workflows cover 1440/1280/390px, full content, guest/member flows, focus/keyboard behavior, retries, duplicate submission, direct registration, short-phone scrolling and removed routes.

The migration passed PGlite tests before application. The release checker successfully read production schema using existing Supabase credentials; local placeholder email/signing values were used for that read-only exercise. Actual Production variable presence/scopes were verified separately through Netlify. Mock email tests do not establish inbox delivery, provider verification or live auth success. No live account/email test was performed. RSVP and conversion are not attendance measurements.

Fresh read-only visual review returned **GO** at all three widths, with local guest/member interaction and no browser warnings/errors. See [design review](design-qa.md). Historical concept/sandbox images remain as design history, not current instructions. Current evidence: [guest dialog](screenshots/1440-form.png), [member login](screenshots/1280-login-modal.png), [direct registration](screenshots/390-optional-signup.png).

## Release and undo

Merge remains Justin's decision. Auth/schema changes warrant Luke's review. Monitor failed/review email jobs and the scheduled function after release. Disabling global/per-event guest flags stops enrollment and guest delivery, so account for existing registrants first. Keep additive tables and the ledger during rollback. New production builds require enabled flags by design; roll back to the prior deployment if the feature must be withdrawn completely.
