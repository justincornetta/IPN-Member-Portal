# Guest event RSVP — active local work

## Status

Implemented locally on `feature/guest-event-rsvp`, based on `origin/main` at `c9e0787`, in `Code/IPN-Member-Portal-guest-rsvp`. Publishing approval pending. No production database migration, live email, push, PR or deployment in this session.

## Last session — November 2, 2026

- Justin selected inline RSVP on the existing event page and explicitly retained the current portal styling, without the new brand guidelines.
- Audited the public event/login/registration path and retained screenshots. Generated and implemented the selected light-style inline concept.
- Added guest RSVP with first name, last name and email; direct join/calendar access after confirmation; optional prefilled email-link IPN signup; expired-link recovery; one-click signed-in RSVP.
- Added per-event admin opt-in (default off), private guest persistence, transactional email outbox, verified-email account linking, cancellation, consent, idempotent delivery and reminder deduplication after conversion.
- Prepared Resend confirmation, 24-hour/1-hour reminders and an opt-in membership invitation 24 hours after event end. Live delivery remains disabled locally.
- Locked dependencies and browser runtime installed. Lint, production build, 36 focused domain/SQL/sender/regression tests and diff checks pass. Browser QA covers 1440/1280/390 px, guest/member states, retries, duplicate submission, signup recovery, dark-system contrast, unsubscribe, cancellation and email templates.
- Independent design reviewer returned GO after full-page and live-flow review. Fixed dark-system inherited foreground and a same-route signup-retry no-op found in review. Cleared generated cache after stale HMR error; fresh browser console clean.
- Detailed architecture, rollout requirements, screenshots and source comparison are in `docs/guest-event-rsvp/README.md` and `design-qa.md` inside the guest-RSVP worktree.

## Next steps

1. Justin reviews the local event and email previews at http://127.0.0.1:4331/events/guest-rsvp-preview and http://127.0.0.1:4331/event-preview/emails .
2. Obtain explicit approval before push/PR. Flag auth/schema changes for Luke during review; follow pr-documentation skill if opening a PR.
3. In an authorized isolated environment, validate Supabase email verification and real Resend inbox delivery. Review migration `20261103033258_guest_event_rsvp.sql`, sender configuration and one-hour auth expiry. Production rollout requires its own authorization, migration before the new admin query, configuration flags and explicit per-event opt-in.

## Open decisions / known limits

- Existing events are not automatically opened to guests. The intended pilot event must be enabled explicitly after rollout approval.
- No production send or hosted auth verification has been exercised. Attendance is not inferred from RSVP or conversion.
- Local fixture event ends November 3, 2026; adjust fixture timestamps for later QA sessions. Tests use no live integrations.
- Existing Next.js middleware deprecation warning remains. No dependency updates were attempted.
- Tin Can relay remained unreachable. A concise milestone request to Cornbot failed to send; retry later. No Notion edit was made.
- Active media-intake worktree and its unrelated credential file were left untouched. Its prior checkpoint is retained below.

## References

- Branch: `feature/guest-event-rsvp`; no PR yet. Local implementation commit is the commit containing this checkpoint.
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
