# Map summary aligned with List — November 7, 2026

## Status
Updated the approved PR #79 revision: removed the boxed “Live membership map” label/card and reused List's plain gray members/cities/countries summary. Map controls and count calculation are unchanged. No merge.

## Last session
Local lint and production build pass. Browser QA at 1440, 390 and 320 px verified settled Map/List switching, identical summary text and computed typography, no horizontal overflow, no page/console errors or framework overlays. Reviewed desktop/phone screenshots. Local fixtures use 125 fictional members across two cities/countries and the existing no-token map fallback; hosted map rendering will be checked after deployment. Evidence is under docs/navigation-performance/screenshots/map-summary-*.png. Kit: existing IPN portal light styling, as explicitly requested in Justin's screenshots (exception to the general dark-plum brand default).

## Next steps / open decisions / known issues
Update the same authorized PR preview, verify the actual map and leave the PR unmerged for Justin. Prior Home performance results/limits remain below. Tin Can relay is unreachable despite Tailscale running/online; doctor found no local version/config problem, so Notion milestone routing is pending. Directory chat coordinated and left this branch unchanged.

---

# Home full loads verified — November 7, 2026

## Status
PR #79 updated with `be3269e` and fixture correction `4affed8`. Netlify deploy `6aefb6b20b64ffad83ed5e30` ready; header/redirect checks pass. No merge. Five subsequent full Home reloads all below one second; first request after deployment still slower.

## Last session
Implemented per-request verified user/profile sharing, removed unused Home private-contact prefetch, and replaced five exact participation counts with existence probes. Middleware/auth/role/suspension validation remains, with no persistent private-data cache or database changes. Local production build/lint and 45 focused tests pass; 11 browser scenarios cover account changes, sign-out/suspension redirects, missing contacts, navigation and retry states without browser errors. New fixture type issue caught by deploy build was corrected and checked locally before the ready revision.

Hosted full Home reloads: first 2390 ms; subsequent 734/723/858/705/780 ms (median 734 ms, range 705–858 ms). All six requests returned 200. Home/Community/Events navigation remains working, with no browser errors. Prior baseline was 7428/675/910/3053/841 ms; server logs show startup/variable server latency. Timings include browser-control overhead; this is a small uncontrolled series, not a guaranteed speedup percentage or universal cold-load promise.

## Next steps / open decisions / known issues
Review https://deploy-preview-79--ipn-member-portal.netlify.app/dashboard and PR https://github.com/justincornetta/IPN-Member-Portal/pull/79 . Typical warmed full reloads now meet the target in this session; consistent sub-second first loads require further startup/hosting work. No hosting-plan change or spend authorized/performed. Optional contact store is still absent. Existing unrelated base test failures remain. Raw evidence: docs/navigation-performance/hosted-measurements.json. Cornbot milestone request b169bbd41bc2f4d789fa was accepted for Notion routing.

---

# PR 79 access repair verified on hosted preview — November 7, 2026

## Status
Repaired and pushed as `80cf845`; Netlify deploy `6aefb098665214227bd93a14` ready. Signed-in hosted access now works. PR #79 remains open and unmerged; Justin reviews before merge.

## Last session
Confirmed real Home, Community, Events and Recordings content plus the connected-profile contact-unavailable warning. Five repeated click-to-visible-content measurements per route: medians Community0.515s, Events0.390s, Home0.602s; slowest switch1.044s. First full Home load2.1s; later direct loads Home1.572s, Community0.753s, Events0.470s. Recordings heading1.410s with167items rendered. Timings include browser-control overhead and reflect this signed-in desktop session. No new browser errors after the repair; no connection/RSVP mutation tests on hosted data. Missing optional contacts remain unavailable without blocking browsing; no database or auth changes.

## Next steps / open decisions
Review https://deploy-preview-79--ipn-member-portal.netlify.app/dashboard . Target of roughly one second is met for repeated page switches in this session; initial Home loads can still be slower. No claim of a universal cold-load guarantee. Await Justin's merge decision. Details/raw samples: `docs/navigation-performance/hosted-measurements.json`. Local lint/build,45focused tests and9performance browser scenarios passed (new Home regression rerun after selector correction). Existing unrelated full-suite failures remain. Tin Can unavailable.

---

# PR 79 signed-in access repair — November 7, 2026

## Status
Justin reported the hosted Home server error and authorized diagnosis, fixes and continued testing toward roughly one-second navigation. Updating the same approved PR; no merge.

## Last session
Netlify logs confirmed Home's new strict enrichment read threw “Directory data could not be loaded.” Read-only schema inspection confirmed `member_contacts` is absent; no contact RPC exists. Added a narrowly scoped fallback for missing-table codes PGRST205/42P01 in optional contact enrichment, leaving contacts null and keeping all other failures strict. No contact lookup fallback to less-restricted data and no database/auth/RLS changes. Accepted-profile contact lookup still reports its unavailable state. Home now validates a missing user explicitly and starts independent featured-member and event/meetup reads together.

Lint/build and 45 focused data/connection/onboarding checks pass. Eight prior performance browser flows passed; new real Home → Community → Events → Home regression with a missing contacts table passed after correcting the desktop Dashboard link selector. Local QA used the deployed schema's missing-table response. Hosted signed-in verification and timing measurement follow deployment; do not confuse earlier synthetic timings with observed user latency.

## Next steps / open decisions
Deploy this PR revision, verify Home/Community/Events under Justin's existing signed-in session and measure repeated content-ready transitions. Keep PR unmerged for Justin's review. Existing full-suite unrelated failures and middleware warning remain. Optional private contacts remain unavailable until a separately reviewed contact-store rollout; no migration made here. Tin Can remains unavailable.

---

# Combined directory and performance PR — November 7, 2026

## Status
Justin approved publishing the combined changes. PR [#79](https://github.com/justincornetta/IPN-Member-Portal/pull/79) is open from `fix/directory-cards-connections`, including performance `7b287a9` and directory `f18a876`. No merge authorized or performed.

## Last session
Confirmed clean local clone, no cloud placeholders, and unchanged base main `209730a`. Published the previously reviewed and tested combined implementation. PR includes user-visible changes, three before/after screenshots, calculation methodology, relevant checks and known gaps. Previous local QA remains applicable: lint/build, focused data/connection checks, directory and performance browser workflows, and independent design GO. No application code changed during publication.

## Next steps / open decisions
Verify Netlify's latest deploy for this branch and review https://deploy-preview-79--ipn-member-portal.netlify.app/dashboard/directory (requires sign-in). Justin reviews the hosted preview before deciding whether to merge. Local fixture preview remains http://127.0.0.1:4342/dashboard/directory.

## Known issues / references
Live auth/RLS, notification delivery and production latency are not established by local fixture checks. Existing Instagram fixture mismatch and Node 24 newsletter JSON-import test failures remain; relevant tests pass. Existing middleware warning remains. Tin Can relay unavailable. Details: `docs/directory-cards/README.md`, `docs/navigation-performance/README.md`, `design-qa.md`.

---

# Directory option 1 and Logan's fixes — November 7, 2026

## Status
Implemented and locally verified in `Code/IPN-Member-Portal-directory`, branch `fix/directory-cards-connections`. Integrated performance commit `0ef4407` locally as `7b287a9` from base main `209730a`. Local review only; no push, PR, merge or deployment.

## Last session
Justin selected option 1 for desktop/mobile. Built compact horizontal directory cards with complete names, current affiliation, subdued stage/location and no card interest tags. Interests remain in profiles and search/filters. Explicit affiliation now takes precedence over historical education. Connect preserves the expanded list and scroll/focus after Next revalidation, returns authoritative state/contact data, and shows pending/failure/retry feedback. Contact access is rechecked on reopening accepted profiles. Load-more errors preserve rows and allow retry. Full-result summary consumption is integrated with the performance chat's loaders.

Locked dependency/browser install completed. Lint and production build pass; 22 focused tests pass, ten directory browser scenarios pass, and all eight integrated performance scenarios are verified (one test-port assertion fixed and rerun). Independent design GO at 1440/1280/390/320 with no P1/P2 blockers. No console/page errors or overlays in final directory checks. Details/screenshots: `docs/directory-cards/README.md` and `design-qa.md`.

## Next steps / open decisions
Justin reviews http://127.0.0.1:4342/dashboard/directory. The local server remains running with fictional members and simulated connection writes; no live notifications or member mutations occurred. Await explicit publishing approval before push/PR; apply pr-documentation then. No PR exists for this work.

## Known issues / limits
Fixture QA does not establish production authentication/RLS, notification delivery, actual live latency or physical-device behavior. The performance chat reproduced two unrelated base-suite failures (Instagram account fixture mismatch and Node24 newsletter JSON import); relevant checks pass. Existing middleware deprecation remains. Tin Can relay unavailable; milestone summary delivery to Cornbot failed. Chrome deliverable tab shows a Grammarly body-attribute hydration warning; clean-browser QA passed. Older dirty clone and the performance clone remain untouched.

---

# Community and Events performance — November 7, 2026

## Status
Implemented and locally verified in `Code/IPN-Member-Portal-performance`, branch `fix/community-events-performance`, base main `209730a`. Local preview only; no push, PR or deployment authorized/performed.

## Last session
Parallelized independent Community data reads and Events registration lookups; Events fetches only the selected section. Added full-population directory summary with matching map eligibility and complete database pagination, expected-error retry UI, route skeletons and sidebar pending feedback. All data stays in the existing authenticated RLS context. Coordinated ownership with the directory chat: only optional summary type/prop added to DirectoryClient here; cards, summary consumption and connection/page-state fixes remain there.

Locked install/browser runtime, lint and production build passed. Eight focused loader tests and eight browser scenarios passed at 1440/1280/390, including slow/failure/retry states with no page/console errors or overlays. Independent design review GO after fixing mobile label width and local preview redirect. Controlled 150 ms/read benchmark (median of three): Community 1215→304 ms, Events 606→303 ms; synthetic server-data path, not production click latency. Full suite: 232 passed, two unrelated base failures reproduced (Instagram account fixture mismatch; newsletter JSON import attribute under Node 24).

## Next steps / open decisions
Justin reviews http://127.0.0.1:4341/performance-preview (server left running, fictional data, normal/slow/error/reset modes). Directory chat integrates the local performance commit before combined QA, consumes the summary and handles load-more error/retry without dropping rows. Await explicit publication approval; use pr-documentation when opening a PR. No PR yet.

## Known issues / references
Actual production signed-in latency, RLS and external mutations are not verified by fixture QA. Search/map work still scales with matching population. Existing middleware deprecation warning and two unrelated full-suite failures remain. Tin Can relay unavailable; Notion milestone summary pending. Methodology, benchmark and screenshots: `docs/navigation-performance/README.md`. Directory chat: `01a1b7e1-3e2b-7613-9fde-f1b8146b1ae9`.

---

# RSVP analytics moved into Zoom — November 3, 2026

## Status
Justin requested this revision to published PR [#78](https://github.com/justincornetta/IPN-Member-Portal/pull/78). Completed and locally verified; publishing to the same approved feature branch. No merge or production data changes.

## Last session
Moved Event RSVP journey from Member Portal Activity into Engagement → Zoom, directly above Zoom event detail. Removed its independent date controls. The report consumes the same final Zoom event selection after shared From/To event dates, Program, Type and saved label/exclusion overrides. Matches portal IDs including historical linked rows; no guessed title matching. Counts include retained observations for matching events, even before event date. Granularity continues to control time charts, while both event tables retain one row per event. Member search remains local to the drill-down.

Locked dependencies/browser runtime installed; lint/build and 37 focused tests pass. All 15 browser scenarios verified (12 unchanged flows plus 3 integrated viewport checks after correcting test selectors for nested Zoom rows and native selects). Browser checks cover placement, absence of duplicate date inputs, both event lists under date/program/type, exclusions, URL/reload persistence, member search/empty states and removal from Member Portal Activity. Fresh design-review follow-up GO at 1440/1280/390 with no material blockers or console errors. Test fixture now renders the full existing analytics shell; it remains disposable/local-only. Screenshots and methodology refreshed.

## Next steps / open decisions
Publish revision to PR #78; confirm latest preview deploy. Preview: https://deploy-preview-78--ipn-member-portal.netlify.app/dashboard/admin?report=engagement&view=zoom . Local populated review: http://localhost:4331/rsvp-analytics-review?report=engagement&view=zoom . Admin sign-in required on hosted preview. Await separate merge decision.

## Known limits
Observed session analytics, not current RSVP roster/attendance. Existing 90-day retention, anonymous identity and same-session conversion limits remain. Granularity does not regroup per-event tables (same behavior as Zoom detail). Events not in the filtered Zoom inventory are omitted. No live RSVP/auth forms submitted. Existing middleware warning; Tin Can relay unavailable. Reference: `docs/guest-event-rsvp/analytics.md`.

---

# RSVP analytics PR published — November 3, 2026

## Status
Justin explicitly approved push and PR publication. PR [#78](https://github.com/justincornetta/IPN-Member-Portal/pull/78) is open on `feature/event-rsvp-analytics`. No merge authorized or performed; production unchanged.

## Last session
Confirmed the report is integrated into the existing Analytics → Engagement → Member Portal Activity panel, using current analytics collection, profiles and admin access controls. The standalone sample-data page exists only in the disposable local QA copy. Synced current main `b6a3a3d`; resolved the checkpoint-only merge conflict by preserving both histories. Final lint and production build passed after sync. Prior 36 calculation checks, 15 browser scenarios and independent design GO remain applicable; no application code changed in publication. GitHub connector returned integration 403 for PR creation, so used already-authenticated GitHub CLI.

## Next steps / open decisions
Review PR and its Netlify checks. Admin preview: https://deploy-preview-78--ipn-member-portal.netlify.app/dashboard/admin?report=engagement&view=portal-activity . Admin authentication required; do not submit test RSVP/account forms against its connected backend. Read-only hosted verification is recorded in the PR body and root checkpoint after deployment. Await separate merge decision.

## Known limits / references
Observed analytics, not current RSVP roster; anonymous guests remain aggregate, same-session account attribution and 90-day retention limits apply. No migration, new provider, live RSVP test, email or Slack send. Local fixture review remains available on port 4331. Methodology/screenshots: `docs/guest-event-rsvp/analytics.md`. Existing middleware warning; Tin Can relay unavailable. Implementation commits `4fb60e8`, `fd66d0b`; current-main sync `0d0ddde`.

---

# Event totals and member analytics drill-down — November 3, 2026

## Status
Completed locally on `feature/event-rsvp-analytics`, extending the unpublished RSVP analytics feature. User requested event aggregates with member-level detail; no publication approval supplied. No push, PR, merge or production data writes. Base main remains current at `0e95438`.

## Last session
Report now defaults to one row per event with display titles from existing event records. Each session/stage counts once across RSVP paths; expandable path rows may overlap. Selecting an event reveals path breakdown and searchable member activity (existing profile name/email, sessions, paths, per-stage counts, account creation, last UTC activity). Member attribution uses only the server's user ID on each observation or registration success; anonymous/guest activity is never assigned by email or shared session inference. New account creation does not relabel earlier guest actions. Raw session IDs stay server-side; response-local groups allow deduplication. Date cohorts use the first retained session observation per event across paths. Report is hidden when the analytics query fails, alongside the existing analytics-unavailable message.

Locked dependencies/browser runtime installed; lint, production build, 36 focused analytics tests and all 15 browser scenarios passed. Final table-only desktop/mobile rerun passed after copy clarification. Tests include cross-path deduplication, multi-account shared sessions, repeat actions, account creation attribution, date cohorts, member search/empty results and guest-only events. Independent product-design review GO at 1440/1280/390 plus full admin integration; no material blockers or console errors. Screenshots/docs refreshed. Production identity attribution and collection are not claimed as live-verified.

## Next steps / open decisions
Review http://localhost:4331/rsvp-analytics-review (local isolated fixtures, server left running). Click View members & paths for the two-member event. Await explicit publication approval under AGENTS.md, then push/open PR with pr-documentation. Merge is separate.

## Known limits / references
This is observed product analytics, not the current RSVP roster or an authoritative attendee count. Anonymous guest activity remains in event totals without identified member rows. Existing 90-day retention and same-session conversion limits apply. Existing Next middleware deprecation warning remains. Tin Can relay remains unavailable; concise milestone handoff to Cornbot pending. Docs/calculations/screenshots: `docs/guest-event-rsvp/analytics.md`. Prior local analytics commits `4fb60e8`, `1300156`, `860e58f` remain unpublished.

---

# Event RSVP analytics — November 3, 2026

## Status
Implemented locally on `feature/event-rsvp-analytics` in `Code/IPN-Member-Portal-guest-rsvp`; implementation commit `4fb60e8`, latest main `0e95438` synced in merge `1300156`. Awaiting Justin's explicit approval to publish this new feature under repository AGENTS.md. No push, PR, merge or production analytics writes performed.

## Last session
Added first-party public event RSVP observations and an Event RSVP journey report under Admin → Analytics → Engagement → Member Portal Activity. Separates visitor, guest, member sign-in and signed-in paths; counts session-deduplicated form stages, confirmations/errors, calendar/join clicks and same-session account creation after optional signup. Fixed metadata sanitization strips form identity, passwords, raw errors, private tokens and referrers. Existing analytics user/session association remains; no new provider or schema migration. Official combined RSVP/Slack total unchanged.

Locked dependencies and browser runtime installed. Lint, production build and 32 focused analytics checks pass, including after syncing latest main. All 15 browser scenarios pass (14 in final full run; the remaining guest case passed on rerun after increasing its assertion wait for observed six-second cold compilation). Browser checks cover desktop/phone flows, privacy-safe payloads, sign-in failures/retry, post-login click attribution, filters and horizontal table scrolling. Fresh independent design review GO at 1440/1280/390, including full admin context, no material blockers. Local tests use isolated fixture boundaries and never write production data or send messages.

## Next steps / open decisions
Justin reviews http://localhost:4331/rsvp-analytics-review and approves publication. Then push branch, open PR following pr-documentation, link deploy preview and verify read-only. Merge remains separate. Local server session is intentionally left running at port 4331.

## Known limits
Counts are observed browser sessions, not unique attendees or official RSVP totals. Confirmation may describe an existing RSVP; join click is not attendance. Attribution is same-session account creation, not verified email or later-session conversion. Uses existing 90-day retained raw events and excludes earlier/backfilled RSVPs. Production-mode deploy previews use existing analytics behavior; use local fixtures for safe tests. Detailed calculations/gaps and screenshots: `docs/guest-event-rsvp/analytics.md`. No production collection verified before deployment. Existing middleware deprecation warning remains. Tin Can milestone notification to Cornbot failed because relay was unavailable; Notion summary pending.

---

# Daily sync Slack failure alerts — November 3, 2026

Status: implemented locally with user authorization to notify #portal-analytics and tag Justin. Independent workflow_run notifier covers failed, cancelled, timed-out and abnormal completed Content sync runs on main; successful runs remain quiet. Uses existing SLACK_ANALYTICS_WEBHOOK_URL; Justin U061Z7YC3DX confirmed through Slack. Manual dispatch sends a clearly labeled delivery test without imports. No checkout/artifacts, permissions empty, bounded delivery retries. Daily sync now has a five-minute job limit and 60-second content request limit.

Validation: parsed workflow YAML, exercised actual shell payload with mock curl for failure/cancel/timeout, mention/link, manual test, missing secret and rejected delivery; all pass. Daily cron unchanged. Independent review GO. Workflow-only change; no web application or UI changes. Next: publish PR, send labeled delivery test, verify channel message. Known limit: no detection of a schedule that never starts or alerts blocked by GitHub/Slack outage.

---

# Daily publication sync — November 3, 2026

Status: implemented and verified locally; publishing with owner authorization. GitHub workflow runs at 11:17 UTC daily (06:17 EST / 07:17 EDT) for Substack and newsletters. Existing hourly Netlify job now runs only YouTube/Eventbrite/ended-event operations, preserving timely ticket access. Website refresh unchanged. Lockfile install, browser runtime, lint, production build, seven focused tests and eight desktop/mobile browser routes pass; no page/console errors. Independent review GO. Next: merge PR, verify production schedule and run workflow once. No open decisions; existing framework middleware warning remains.

---

# Newsletter and Substack sync — November 3, 2026

## Status
Prepared and tested locally on `fix/automatic-newsletter-import`, checkout `Code/IPN-Member-Portal-content-sync`. Awaiting owner review before any push, PR, deployment or live import. Companion website checkout `website-redesign/Code/ipn-website-news-sync`, branch `fix/automatic-news-feeds`.

## Last session
Replaced credential/AI-dependent monthly import with public Mailchimp RSS ingestion, all available member issues, idempotent upsert and read-back verification. Six-hour job now waits for completion, runs all month and surfaces failures. Added November/October public-source fallback. Verified all four live Substack feed items already exist in production portal; improved internal failure reporting. Website now loads both public feeds via a cached same-origin endpoint, preserves static content on failure, and ships November in HTML.

Portal locked dependencies/browser runtime, lint, production build and 12 focused tests pass. Website build, two endpoint tests, four Python tests and 1,803-reference audit pass. Eight desktop/phone browser routes plus three future-publication/outage scenarios pass. No browser errors. Persistence uses a test client; live writes/scheduler/CDN remain release verification, not completed tests.

## Next steps / open decisions
Owner reviews http://127.0.0.1:4341/dashboard , /dashboard/resources?tab=newsletters and http://127.0.0.1:8041/news/ . Publish only after approval. Then run/verify live import and scheduled completion, and check deployed website endpoint/cache behavior. No schema/auth changes.

## Known issues / references
Existing Next.js middleware deprecation warning. Website dynamic refresh needs JavaScript; no-JS sees saved November snapshot. Public feeds contain recent entries; static historical entries and newsletter archive link retained. November uses the actual email's animated website artwork. Tin Can relay unavailable; concise Notion milestone request attempted, no direct Notion edit. Full implementation, release limits and screenshots: `docs/news-sync/README.md`. No PR yet.


---

# Combined RSVP counts and test cleanup — November 3, 2026

Status: implemented on fix/combined-rsvp-slack-total from origin/main538bd27; Justin requests new PR and removal of his confirmed tests. Member event Slack now reads events.registration_count, matching guest alerts. Cleanup migration generated via Supabase CLI:20261103160122_remove_event_test_rsvps.sql. Exact +1,+5,+8 addresses and pilot event only; converted records untouched. Cascades email jobs, existing trigger decrements count, stops if targeted email is sending, safe to rerun. Production untouched. Historical Slack messages unchanged. Local dependencies/browser runtime installed. Build/lint,27 targeted checks and10 browser workflows passed. PR #73 open: https://github.com/justincornetta/IPN-Member-Portal/pull/73 . Commit457c07a. Next: review PR and apply cleanup during authorized rollout; no merge performed.

# Guest RSVP Slack notifications — November 3, 2026

Status: implemented on feature/guest-rsvp-slack from origin/main 7e17e2d; PR #72 open: https://github.com/justincornetta/IPN-Member-Portal/pull/72 . Guest RSVP now schedules a server-only Slack alert after response, parallel with email processing. Uses existing event RSVP webhook; labels guest status and includes name/email/event/type plus combined count. Atomic row claim prevents concurrent/retry duplicates; old rows are marked during migration to avoid backfill. Missing webhook/nonproduction disables sends. Slack failures are logged without identity/webhook and never block the RSVP; delivery is best-effort without automatic retry after uncertain results.

Validation: locked dependencies/browser runtime installed; lint/build and 25 targeted tests pass. All ten desktop/mobile browser workflows passed. No live Slack message or production migration performed. Requires migration 20261103140000_guest_event_slack_claim.sql before production deployment; release check enforces its column. No UI changes/design review required. Next: review new PR, apply migration and merge when approved. Existing root history follows.

# Production RSVP verified — November 3, 2026

Authorized guest test caught service_role lacking auth.users SELECT. Applied migration 20261103130712_guest_event_verified_email_permissions: only the two existing service-only verified-email functions use SECURITY DEFINER with pinned search_path; anon/member EXECUTE remains revoked. No broad auth table grant. Transactional rollback probe passed, then real browser retry saved one RSVP. Confirmation sent via Resend and verified in recipient Gmail inbox at 13:07:20 UTC. Invitation consent false; one-hour reminder pending, no invitation job. Live test remains active as authorized. Regression fixture now denies direct auth.users access to reproduce production permissions. Fix recorded on fix/guest-rsvp-auth-permissions for follow-up PR.

# Production release — November 3, 2026

PR #70 merged with Justin's explicit approval at 13:02:59 UTC, merge commit `b8d234d47971106629e8f847fbc51a530243cd5f`. Production event now exposes member and guest RSVP dialogs, with full description, unchecked invitation consent and no test UI. Live browser warning/error logs empty. No form submitted yet: awaiting Justin's test recipient for actual RSVP/email delivery verification. Do not claim end-to-end delivery passed. Next: submit one authorized test RSVP, verify persisted record and delivery, then update this checkpoint. Prior release preparation follows.

# Event RSVP — production-ready PR #70

## Status

Justin approved removing test-specific features and updating PR #70 so the approved flow works after merge. Production prerequisites are prepared. PR https://github.com/justincornetta/IPN-Member-Portal/pull/70 remains open; no merge performed. Working branch `feature/guest-event-rsvp`, worktree `Code/IPN-Member-Portal-guest-rsvp`.

## Last session — November 3, 2026, production preparation

- Removed hosted sandbox detection, fake authentication/sessions, fixture routes, sample credentials/banners, preview inbox, simulated registration and the superseded email-link signup flow. Real member authentication and direct standard registration remain. Full event description/current portal styling retained.
- Moved fixtures entirely into a disposable ignored local QA copy; production source imports no test modules. Removed `/event-preview/emails`, `/join` and `/api/events/membership`.
- Applied additive migration to production Supabase project `plgzakxecjlzepzeqiio`; local filename reconciled to recorded remote version `20261103123749_guest_event_rsvp.sql`. Do not apply it again. Verified RLS and no anonymous/authenticated access on all guest tables.
- Saved Production-only Netlify guest enable/email-live flags and random signing secret. Plan-supported scopes required Builds/Functions/Runtime for secrets, all scopes for flags. Verified existing sender/Supabase/Resend settings present. No preview guest configuration.
- Enabled guest RSVP only for the published Global Psychedelic Week pilot. Read-only checks found zero guest registrations and zero email jobs. No live test account, RSVP or email was created. Current production code stays unchanged until merge/deploy.
- Added a production build prerequisite check for configuration/schema. Read-only production schema check passed; live email/provider authentication was not tested.
- Locked dependencies/browser runtime installed. Lint, production build, 73 focused checks and ten desktop/phone browser workflows passed. Fresh independent design review: GO, no warnings/errors or material blockers. Test counts are passing automated cases, not conversion/attendance metrics.
- Published cleanup commit `30ea3c2` to PR #70 and rewrote the PR description/screenshots for production. Netlify deploy `6ae9d800fe34d14f80327fa5` is ready. Read-only hosted checks: event loads with full description and real member state, no test banner/credentials, removed routes return 404, guest button absent in the logged-out preview as expected. Browser warning/error logs empty; no live forms submitted.

## Next steps

1. Review the updated PR and current deployment evidence; code and configuration are ready for the merge decision.
2. Justin reviews/merges when ready; Luke should review auth/schema changes. No merge authorization supplied.
3. After deployment, monitor real guest email jobs and scheduled worker. Live auth/provider delivery remains unexercised; never represent mock testing as inbox delivery verification.

## Open decisions / known issues

- Hosted preview is no longer a sandbox. Normal member auth/RSVP/registration use the connected backend. Guest enrollment is Production-only and absent there. Use local QA for side-effect-free testing.
- Local QA fixture expires after the November 3 event. Update fixture timestamps for future tests. Local signup is intercepted at its final action; no shipped test notices remain.
- Other events stay guest-disabled until individually enabled. Opt-in checkbox permits one post-event membership invitation, not future-event/newsletter subscription.
- Signing-key rotation invalidates guest management links. Disabling flags stops guest enrollment and delivery; preserve the outbox ledger during rollback.
- Existing Next.js middleware deprecation warning remains. Unrelated media worktree/credential files were not changed.
- Tin Can milestone update to Cornbot failed with relay timeout. Notion sync remains pending; no direct Notion edit.

## References

- PR: https://github.com/justincornetta/IPN-Member-Portal/pull/70
- Preview: https://deploy-preview-70--ipn-member-portal.netlify.app/events/global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional
- Current implementation/rollout/QA: `docs/guest-event-rsvp/README.md`; current design review is the final entry in `design-qa.md`.

---

# Historical checkpoints (superseded by current status above)

# Event RSVP — member login and guest modals

## Status

Implemented locally on `feature/guest-event-rsvp`, based on `origin/main` at `c9e0787`, in `Code/IPN-Member-Portal-guest-rsvp`. Justin approved publishing after the full-description correction. PR #70 is open: https://github.com/justincornetta/IPN-Member-Portal/pull/70 . No merge, production migration or live email authorized.

## Last session — November 3, 2026

- Latest requested revision: **Join IPN free** now opens the existing standard registration page directly. Immediate RSVP/management links prefill name/email through a 30-minute tab-local handoff; no personal details enter the URL. Invitation emails also link straight to registration. The guest RSVP stays saved independently.
- Clarified the unchecked checkbox to “Email me an invitation to join IPN after this event.” Confirmation and eligible reminders are automatic; only the post-event membership invitation needs opt-in. Guest RSVP does not subscribe to future portal event notifications; full membership retains its existing newsletter sync.
- Sandbox registration walks the same four steps with sample city input and simulated completion. A server-side guard refuses preview account creation before auth/newsletter/Slack side effects. Production signup flow remains unchanged. Legacy /join recovery still works.
- Lint, normal/sandbox production builds, 49 guest/auth/notification checks, 29 mobile/onboarding regressions and all 14 browser workflows pass. Fresh read-only visual/live-browser review returned GO at 1440/1280/390 px. Returning to the landing page resets its displayed guest state; the saved RSVP remains available in its inbox/management page.
- Revision is being published to the already-authorized PR #70; no merge or production writes/email. Update the root checkpoint with hosted verification after the build finishes.

- Justin explicitly authorized enabling the hosted guest preview with no production data changes or real email. PR #70 now has a build-scoped sandbox at the original event landing-page URL, plus `/event-preview/emails` as a preview inbox. This supersedes the earlier hosted-live-backend limitation below.
- Hosted verification found the sandbox disabled; no test submission was made. Build-log inspection showed Netlify checks out `pull/70/head`, so the selector now uses deploy-preview context and PR identity, not the feature branch name. A literal module generated before build also removes runtime dependence on build variables. Rechecked sandbox flows with build-context variables absent at runtime.
- Activation requires deploy-preview context and PR 70 identity. It uses fixture event data and browser-specific 24-hour test cookies; no Supabase project/migration, production event flag or hosting credential was changed. Real login cookies are ignored; sample credentials remain `member@example.com` / `preview-password`.
- Guest RSVP, cancellation/unsubscribe and optional signup are simulated. Inbox templates are immediately available and personalized from the browser’s latest test RSVP; real verification, scheduling and delivery remain integration-stage gaps. Signup explicitly confirms that no account/email was created.
- Database/auth client factories refuse sandbox access; route allowlist blocks generic portal/auth/API writes; analytics is disabled; guest sender remains off even with inherited live flags. Netlify background functions independently reject deploy-preview invocations using platform context.
- Normal production build and the sandbox production build pass. All 47 focused checks, four sandbox browser workflows at 1440/1280/390 px and ten existing browser workflows pass; lint/diff checks pass. Fixed test-mode switching retaining prior client state by making sandbox navigation reload the page. Fresh read-only design review returned GO after complete-page desktop/phone and live interaction review.

- Implemented Justin’s approved revision: separate member sign-in/RSVP and guest RSVP dialogs. Successful event-specific login automatically saves the RSVP on the same page; signed-in members use one click. Generic sign-in does not enroll anyone.
- Preserved the complete description and existing styling. Member RSVP works independently of the guest enrollment flag. Server actions resolve the event, recheck eligibility/session/account restrictions and reuse the idempotent member registration service.
- Added invalid-login feedback, signed-in retry after RSVP failure, session-expiry recovery, focus containment/restoration, Escape/backdrop dismissal, password clearing and short-phone scrolling.
- Final lint, production build and 41 focused checks pass. All ten browser workflows pass, covering desktop/phone modal interactions and existing guest/email/management flows. Fresh read-only design review returned GO with no material blockers.
- Local demo login: `member@example.com` / `preview-password`; partial-success retry: `rsvp-retry@example.com` with the same demo password. No real accounts or messages are used locally.
- PR #70 includes this modal revision on the existing approved branch. Guest enrollment remains disabled on the hosted preview pending rollout configuration/migration; hosted member actions use its connected backend. Use the isolated local demo for testing both paths.

## Earlier session — November 2, 2026

- Follow-up: restored both full original event-description paragraphs from Justin’s screenshot. The public renderer already preserved stored descriptions; the local fixture was abbreviated. Rechecked full text and wrapping at desktop and phone widths.
- Justin selected inline RSVP on the existing event page and explicitly retained the current portal styling, without the new brand guidelines.
- Audited the public event/login/registration path and retained screenshots. Generated and implemented the selected light-style inline concept.
- Added guest RSVP with first name, last name and email; direct join/calendar access after confirmation; optional prefilled email-link IPN signup; expired-link recovery; one-click signed-in RSVP.
- Added per-event admin opt-in (default off), private guest persistence, transactional email outbox, verified-email account linking, cancellation, consent, idempotent delivery and reminder deduplication after conversion.
- Prepared Resend confirmation, 24-hour/1-hour reminders and an opt-in membership invitation 24 hours after event end. Live delivery remains disabled locally.
- Locked dependencies and browser runtime installed. Lint, production build, 36 focused domain/SQL/sender/regression tests and diff checks pass. Browser QA covers 1440/1280/390 px, guest/member states, retries, duplicate submission, signup recovery, dark-system contrast, unsubscribe, cancellation and email templates.
- Independent design reviewer returned GO after full-page and live-flow review. Fixed dark-system inherited foreground and a same-route signup-retry no-op found in review. Cleared generated cache after stale HMR error; fresh browser console clean.
- Detailed architecture, rollout requirements, screenshots and source comparison are in `docs/guest-event-rsvp/README.md` and `design-qa.md` inside the guest-RSVP worktree.

## Next steps

1. Review PR #70 and its isolated hosted sandbox, including the preview inbox. The complete local event/email previews remain available at http://127.0.0.1:4331/events/guest-rsvp-preview and http://127.0.0.1:4331/event-preview/emails .
2. Flag auth/schema changes for Luke in the PR; no merge without Justin’s separate approval.
3. In an authorized isolated environment, validate Supabase email verification and real Resend inbox delivery. Review migration `20261103033258_guest_event_rsvp.sql`, sender configuration and one-hour auth expiry. Production rollout requires its own authorization, migration before the new admin query, configuration flags and explicit per-event opt-in.

## Open decisions / known limits

- Existing events are not automatically opened to guests. The intended pilot event must be enabled explicitly after rollout approval.
- No production send or hosted auth verification has been exercised. Attendance is not inferred from RSVP or conversion.
- Local fixture event ends November 3, 2026; adjust fixture timestamps for later QA sessions. Tests use no live integrations.
- Existing Next.js middleware deprecation warning remains. No dependency updates were attempted.
- Tin Can relay remained unreachable. A concise milestone request to Cornbot failed to send; retry later. No Notion edit was made.
- Active media-intake worktree and its unrelated credential file were left untouched. Its prior checkpoint is retained below.

## References

- Branch: `feature/guest-event-rsvp`; PR: https://github.com/justincornetta/IPN-Member-Portal/pull/70 . Implementation `bbea351`; full-description correction `b555de6`.
- Owning worktree: `Code/IPN-Member-Portal-guest-rsvp`.
- Documentation: `docs/guest-event-rsvp/README.md`.

---

# IPN Member Portal — current checkpoint

## Status

Media intake improvements implemented locally on `feature/media-guided-request`, based on `origin/main` commit `32e47e5`. Justin approved pushing and opening a PR on November 1, 2026. [PR #68](https://github.com/justincornetta/IPN-Member-Portal/pull/68) is open; no production writes or merge authorized.

## Last session — November 1, 2026

Follow-up after Justin's screenshots:
- Replaced equal-width step columns with content-sized controls and consistent visible gaps; compact wrapping on phones.
- Removed integration diagnostics from Media and all forms/details, retaining them on the expense admin queue. Removed the demo-only visibility difference that hid the issue during the initial review.
- Added a browser regression check for admin/member and queue/form visibility; screenshots now include the bottom of the page at all three viewports.
- Reinstalled locked dependencies/browser runtime; lint, production build, all 17 workflow browser checks and diff checks pass. The earlier 18 workflow/domain tests remain unchanged and passed in the initial implementation session.
- The same design reviewer returned GO after rechecking optical spacing, mobile grouping, complete Media footers and live admin/leadership diagnostic visibility. The initial GO missed optical whitespace and a production-only condition; both are explicitly documented as review regressions.
- Cornbot routed a shared review-skill update to Notion Organizer, request `42747ac64fc19a1efb9f`. Focus: actual visible gaps, full scroll-path/role coverage, explicit preview-production differences, and relevance of diagnostic UI. Read-back of the canonical skill confirmed these checks, an evidence requirement, and both PR #68 examples are now present.

- Located Luke Strong's October 26 private `#media-space` thread after Justin explicitly authorized private Slack search. Inspected all four steps of Luke's Claude prototype.
- Added a guided new-request form: Idea → When and where → Copy and files → Review, with simpler prompts, native selectable cards/chips, optional reader links, and review edit links.
- Preserved data through backward navigation, validated each step, prevented duplicate in-flight submits, and verified failure/retry retains the request ID. Existing request editing, event prefill, persistence and production workflow remain compatible.
- Applied IPN brand colors and local Poppins/Work Sans fonts to the new form.
- `npm ci`, `npm run qa:install`, lint, production build, all 17 browser QA checks, 18 targeted workflow/domain/database/bootstrap/worker tests and `git diff --check` pass. Screenshots cover 1440, 1280 and 390 px.
- Local preview remains running at `http://127.0.0.1:4327/workflow-preview/media` using sample data and disabled external integrations.
- Independent product-design reviewer returned **GO** after screenshot and live-browser review at 1440, 1280 and 390 px. No material blockers or browser errors found.

## Next steps

1. Check the refreshed Netlify preview for the spacing/footer correction commit published to the already-approved PR #68.
2. Await a separate merge decision. The PR includes verification notes and screenshots; no merge has been performed.

## Open decisions

- Publishing approval received; merge approval remains pending. The new-request form is scoped separately from the existing editing/production screens and sitewide portal styling.

## Known issues and limits

- Existing Next.js middleware deprecation warning remains.
- Production sign-in and real Slack/Sheets delivery were not exercised; local preview delivery is disabled.
- Tin Can connectivity recovered during PR publication; the inbox check succeeded with no requests waiting. Cornbot received milestone notification `1c07fd2f9c10320e020d` for concise Notion routing.
- Pre-existing unrelated untracked credential JSON was left untouched and is excluded from this commit.

## References / PRs / commits

- [Implementation, source links, QA and screenshots](docs/media-guided-intake/README.md)
- [Luke's proposal](https://intercollegia-dcd2196.slack.com/archives/C088ZJBM0QY/p1793063310607659?thread_ts=1793034999.165159&cid=C088ZJBM0QY)
- [Luke's interactive prototype](https://claude.ai/artifact/2BMHD6ByWTAUViDf5DKifz)
- Base: `32e47e5`. Implementation commit: `601b37a`. Publication approval recorded in `bdb33d6`. [PR #68](https://github.com/justincornetta/IPN-Member-Portal/pull/68) is open; Initial Netlify preview passed. Spacing/footer corrections and updated screenshots are included in this checkpoint commit for the same PR.

This committed checkpoint is mirrored into the owning workspace project root for cross-session discovery.
