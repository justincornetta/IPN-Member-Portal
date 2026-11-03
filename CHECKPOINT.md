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
- Updating the authorized PR with current release documentation and screenshots; hosted read-only verification follows publication.

## Next steps

1. Finish PR update and verify refreshed deploy preview without submitting forms. Record the commit/deploy result below.
2. Justin reviews/merges when ready; Luke should review auth/schema changes. No merge authorization supplied.
3. After deployment, monitor real guest email jobs and scheduled worker. Live auth/provider delivery remains unexercised; never represent mock testing as inbox delivery verification.

## Open decisions / known issues

- Hosted preview is no longer a sandbox. Normal member auth/RSVP/registration use the connected backend. Guest enrollment is Production-only and absent there. Use local QA for side-effect-free testing.
- Local QA fixture expires after the November 3 event. Update fixture timestamps for future tests. Local signup is intercepted at its final action; no shipped test notices remain.
- Other events stay guest-disabled until individually enabled. Opt-in checkbox permits one post-event membership invitation, not future-event/newsletter subscription.
- Signing-key rotation invalidates guest management links. Disabling flags stops guest enrollment and delivery; preserve the outbox ledger during rollback.
- Existing Next.js middleware deprecation warning remains. Unrelated media worktree/credential files were not changed.
- Tin Can relay unavailable earlier this session; milestone sync will be retried. Notion is not edited directly.

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
