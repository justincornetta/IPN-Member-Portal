# Analytics dashboard review

## Scope

Consolidates the leadership dashboard into Registration & Membership, Onboarding, Engagement, Reach & Acquisition, and Data & Definitions. Adds eligibility/deletion safeguards, resumable onboarding and participation attribution, total/unique sign-in and participation charts, daily event RSVP series, searchable event inventory, and Mailchimp contact/status ingestion.

## Local verification (2026-09-17)

- Clean local worktree; no macOS dataless files.
- Synced latest main (`f41a64d`) before verification.
- `npm ci` completed from the lockfile.
- `npm test`: 150 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; existing middleware-to-proxy deprecation warning remains.
- `git diff --check`: passed.
- Browser checked synthetic `/analytics-review` Registration & Membership, Onboarding, Engagement overview, Reach/Mailchimp, and Data & Definitions.
- Verified participation total/unique toggle, sign-in series, daily event RSVP series, and event inventory search (21 events reduced to one matching event).
- Browser console warnings/errors: none during these checks.

Screenshots use synthetic identities, not production member data:

![Engagement overview](screenshots/engagement-overview.png)
![Onboarding](screenshots/onboarding.png)
![Mailchimp](screenshots/mailchimp.png)

## Deploy Preview testing

Use `/dashboard/admin?report=engagement&view=overview`, signing in with an existing admin account. `/analytics-review` intentionally returns 404 in production builds.

Netlify Deploy Preview function variables were verified as configured for the Supabase URL, anon key, service-role key, and Mailchimp API key. Secret values were not printed or committed. The service-role key is consumed server-side after admin authorization.

The preview shares production Supabase data and inherited integration credentials. Account creation, profile edits, RSVPs, connections, suspensions, and deletions can change production data and may trigger real notifications. This QA did not create accounts or mutate production data.

Email-based signup/reset callbacks may require the preview URL in the Supabase Auth redirect allowlist. No Auth configuration changes were made here.

## Migration and ingestion caveats

The eligibility/participation and Mailchimp ledger migrations were already applied to the production project through its authorized connection during earlier local implementation. Local SQL filenames and remote migration versions differ; inspect remote migration history before applying them again. Do not reset production.

The Mailchimp tables still require a first successful contact sync. Creating a PR does not run the daily source-refresh ingestion job; that workflow uses the code on main unless explicitly run against this branch. The preview can therefore show unavailable 30-day cards until ingestion runs.

Initial status history is a backfill, not a complete event log. Mailchimp `last_changed` can reflect changes other than an unsubscribe, and daily snapshot polling can miss multiple transitions between pulls. The current implementation must not be treated as independently verified, complete 30-day subscribe/unsubscribe history. Event webhooks plus reconciliation and a clearly stated reliable coverage start are follow-up work for fully trustworthy historical counts.

Current-active RSVP series describes currently active registrations grouped by registration date, not an immutable record of every RSVP ever submitted. Unknown historical active counts are shown as unavailable rather than zero.

## Existing dependency audit risk

`npm audit` reports 9 advisories (1 critical, 6 high, 1 moderate, 1 low) in the existing dependency tree. Dependencies were not changed in this work. Next.js 16.2.6 and its image stack need a separate security update/reverification before production release; see [Next.js middleware bypass advisory](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) and [image processing advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).

This PR is for review and preview testing, not authorization to merge or deploy production.
