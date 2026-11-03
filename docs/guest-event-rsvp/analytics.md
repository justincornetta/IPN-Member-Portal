# Event RSVP analytics

## What this answers

Admin → Analytics → Engagement → Member Portal Activity includes an **Event RSVP journey** report. It measures use of the public event landing-page flow while retaining existing portal styling. It helps compare guest RSVP, sign-in plus RSVP, and already signed-in RSVP; identify submission failures; and see whether guests continue to account registration.

The report is separate from the official combined RSVP total used in Slack and event records. A successful response can confirm an existing RSVP, so browser confirmations are not new attendee counts. Calendar and join-link clicks are intent signals, not attendance.

## Collection and reporting

1. The public event component records a landing view, form open, submission, confirmation or error. Post-confirmation calendar/join links and the optional membership signup link record clicks.
2. The existing first-party analytics endpoint accepts the fixed `event_rsvp` metadata vocabulary in a `curated_click` envelope. This reuses the current event-name allowlist; no migration or provider is added.
3. Server sanitization allows only event slug, stage and path in RSVP metadata. It discards form names/email/passwords, arbitrary metadata, raw error text, referrers, private URLs and query strings. Existing random session/anonymous identifiers and authenticated user association remain governed by the existing analytics pipeline; this is not anonymous telemetry.
4. The existing admin data loader feeds the report. Each stage counts once per browser session, event and path, even after retries. Admin summaries contain no session identifiers. Landing views for logged-out visitors appear on a Visitor row; subsequent guest or member sign-in activity appears in its own path row. Calendar/join actions immediately after sign-in retain that sign-in path.
5. A recorded account-creation success is attributed to the latest preceding event signup click in the same browser session. Clicking signup alone is not account creation. Analytics failures never block RSVP, login or navigation.

## Calculations and limits

- **Submission success:** session/event/path groups containing both `submit` and `confirmed`, divided by groups containing `submit`, rounded to a whole percent. Retries are deduplicated, so a session can appear in both Errors and Confirmations.
- **Account creations:** groups with an attributed `registration_success`. This is account creation, not verified email, subsequent onboarding or later-session conversion.
- **Date filters:** independent of the rest of Member Portal Activity. Filter the UTC date of the first retained observation for each session/event/path group, not each individual click. Later stages remain in that cohort. Data is limited to the portal's existing raw-event retention window (90 days); older observations may roll out, and existing RSVPs are not backfilled.
- **Coverage:** public event landing pages and the shared signup handoff (also available from a guest access page). That signup click is recorded under the canonical public event URL; private tokens are discarded. Existing portal/RSVP reports remain available. Other guest access-page actions, email delivery/open rates, later-session attribution, cancellations and actual attendance are outside this report.
- **Collection gaps:** browser blocking, disabled storage, closing a page, failed requests and user/profile exclusions in the existing loader can undercount. Production-mode deploy previews follow the existing analytics collection behavior; use the isolated local QA runner for tests, not live credentials or public test submissions.
- This report is directional product analytics, not a reconciliation ledger or proof of delivered email.

## Validation and local review

Run `npm ci`, `npm run qa:install`, `npm run lint`, `npm run build`, and the focused analytics tests:

```
node --test --experimental-strip-types tests/event-rsvp-analytics.test.mjs tests/analytics-reliability.test.mjs
npm run guest-events:dev
npm run qa:guest-events
```

The local runner copies the app into ignored `.qa-guest` and replaces integration boundaries. Its observation capture and `/rsvp-analytics-review` fixture are added only to that disposable copy. No analytics database writes, real RSVP records, Slack posts or emails occur. The normal app ships no new test route.

- Populated report: http://localhost:4331/rsvp-analytics-review
- Integrated admin fixture: http://localhost:4331/analytics-review?report=engagement&view=portal-activity
- RSVP flow: http://localhost:4331/events/guest-rsvp-preview
- Screenshots: `analytics-1440.png`, `analytics-1280.png`, `analytics-390.png`.

Independent product-design review: **GO** at 1440, 1280 and 390 px, including full admin context, keyboard/date filtering, mobile table scrolling and empty states. No observed browser warnings/errors or material blockers. Populated data is synthetic; production collection and attribution have not been exercised.

## Rollout and undo

No migration, production configuration change or backfill is required. Review and publish the feature PR, then separately approve merge. Collection starts after deployment; inspect real organic observations and the report after rollout. Revert the feature commit to remove new collection/reporting; existing analytics records and official RSVP records remain intact.
