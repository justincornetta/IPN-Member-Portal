# Design QA — guest event RSVP

Status: **passed**. Independent frontend product-design reviewer: **GO**, November 2, 2026 (local date).

## Reference and scope

Reviewed the original live portal screenshot and selected imagegen inline concept alongside rendered implementation screenshots. The user explicitly selected inline RSVP and requested the existing portal appearance. The light surfaces, Geist typography, original artwork, purple controls, constrained content column, existing header and footer are preserved. No new IPN brand treatment was applied.

The implementation deliberately uses native responsive layouts, real event timestamps and provider-neutral “Join event” copy. It adds clear queued-email wording, explicit optional signup, and privacy/consent controls. The concept's example reminder timestamp is not authoritative. Email templates use email-safe table layouts/system fonts rather than screenshot pixels.

## Coverage and findings

- Full-page guest landing, expanded form, confirmation, optional signup, sent state and signed-in member views inspected at 1440, 1280 and 390 px, including content below the fold and the complete footer.
- Actual visible gaps between sign-in/RSVP controls, calendar/join controls and optional signup were inspected. No unintended horizontal scrolling, clipped labels or overlap found.
- Form opening focuses First name; keyboard Tab moves to Last name with a visible ring. Successful RSVP focuses its heading. Errors retain input; optional signup is clearly secondary and comes after the RSVP is complete.
- All four settled email frames inspected individually, including lower 1-hour and membership-invitation cards. Direct event action and opt-out are clear. The initial full-page capture had blank lower iframe frames; replaced with settled evidence.
- Purple/white contrast measured at 6.57:1; muted #71717a on white at 4.83:1. New standalone routes initially inherited light text in dark-system mode; explicit dark text fixed the issue and dark-system screenshots were rechecked.
- Requesting another signup link initially navigated to the current route without resetting the sent state. Replaced with a state-reset button retaining identity; live recheck and browser regression passed.
- A stale browser tab recorded an HMR chunk-load error during build/dev switching. Dev was stopped, generated cache cleared, production build completed, and a fresh browser session verified no errors/warnings. Do not build against a running dev server in this worktree.

## Reviewer result

“GO. No material design or interaction blockers remain.” The reviewer independently checked RSVP → focused confirmation → prefilled optional signup → email-sent state → request another link. Fresh browser console had no errors or warnings. Optional, nonblocking refinement: standalone /join could use an H1 for its form title.

## Preview versus production

The preview uses local memory and simulated member states; real auth, database persistence and delivery are replaced only at the service boundary. The actual RSVP UI and email renderer are shared. Unchanged location details and related events are absent in the fixture and inspected in source. Next's development indicator is preview-only. No production delivery claim is made by this review.

Evidence: `screenshots/{1440,1280,390}-{landing,form,confirmation,optional-signup,signup-sent,member}.png`, `screenshots/email-*.png`, `screenshots/manage-rsvp.png`, `screenshots/join-dark-system.png`, and `screenshots/retry-error.png`.

## Full-description correction — November 2, 2026

Restored both original description paragraphs in the local fixture from Justin’s screenshot. The public renderer already used the complete stored description. Refreshed the existing 1440/1280/390 full-page evidence and checked the final sentence remains visible without clipping. No other layout or email changes in this follow-up.

## Modal revision — November 3, 2026

Status: **passed / GO** from a fresh read-only reviewer. User approved separate “Sign in & RSVP” and “RSVP without an account” dialogs, automatic RSVP only after the explicit member action, and one-click RSVP for signed-in members.

The reviewer inspected settled screenshots at 1440, 1280, 390 px and 390×600, the complete description/footer, and all guest/member/already-registered states. Fresh Chrome tests confirmed login→automatic RSVP, guest→confirmation, guest-disabled member login and partial-success retry without another password prompt. No console warnings/errors or design blockers remained. Entry-action visible gaps measure 12 px; phone controls stack. No production diagnostics were added. Local sample credentials/Next’s badge are development-only.

Functional QA checks native modal containment, explicit Tab wrapping, initial field focus, Escape/backdrop close with opener focus restored, success focus after React commits, retained guest identity, cleared passwords after failed login, and short-phone scrolling. Scrollbar clicks do not dismiss the dialog. The first QA run exposed focus timing/wrapping defects; both were corrected before GO.

The local login fixture does not refresh its header identity because no session is created; actual login uses Supabase cookies. Source inspection confirmed unchanged location/related-event rendering. Real hosted auth, email and database delivery remain outside visual-review coverage. Member actions now remain available independently of guest enrollment. Preview deployment still uses the connected backend for actual member actions, so automated testing stays on the local fixture.

New evidence: `screenshots/{1440,1280,390}-login-modal.png`, `*-login-confirmed.png`, updated `*-form.png` and landing/confirmation captures, `390-short-modal.png`, `member-rsvp-retry.png`. No accepted design exceptions.

## Isolated hosted sandbox — November 3, 2026

Fresh read-only reviewer: **GO**, no material UX blockers. Reviewed full-page 1440/1280/390 screenshots, complete description/footer, signed-in and guest states, optical action spacing and preview banner purpose. Fresh Chrome tests confirmed guest RSVP, simulated signup, personalized inbox, cancellation, member login/automatic RSVP and one-click signed-in RSVP. Keyboard submit, Escape and focus restoration worked; no browser warnings/errors. Phone modal fit and no horizontal overflow were verified.

Evidence: `screenshots/sandbox-{1440,1280,390}-{landing,signup,inbox}.png`; four production-build sandbox browser checks and ten existing browser checks pass. The initial inbox captures had unpainted lower frames despite correct live behavior; QA now scrolls through all four frames and waits for their headings before capture. Test-mode navigation originally retained success state; full-page sandbox navigation now resets it.

Preview-only differences: explicit test banner, fixture event/member credentials, browser-local 24-hour cookies, immediate email templates, simulated signup completion and sample joining link. No production account/email/database is exercised. Backend isolation is covered separately by 47 focused checks, including client refusal, sender suppression and Netlify background-handler boundaries. No accepted design exceptions.

## Direct registration follow-up — November 3, 2026

Fresh read-only reviewer: **GO**. Reviewed 1440/1280/390 full-page registration, checkbox, completion, invitation email and member states. Live CUA review confirmed unchecked guest RSVP → prefilled standard registration → all four steps → simulated completion. The plain invitation-email registration link opens blank fields; the management page offers prefilled registration. Existing signed-in one-click RSVP remains and omits the guest membership offer. Browser warnings/errors were empty.

Optical spacing and full scroll evidence: `screenshots/sandbox-{1440,1280,390}-registration.png`, `*-signup.png`, `*-inbox.png` and `{1440,1280,390}-form.png`. Form controls, progress indicators and navigation remain contained and readable. No irrelevant production diagnostics were introduced; the preview banner and sample-password/city notices explain sandbox behavior. All 14 local browser workflows pass, including registration, prefill, blank generic registration, confirmation persistence through management, cancellation and service isolation. Lint, normal/sandbox production builds and 78 focused plus mobile/onboarding regression checks pass.

Known preview differences: city lookup is replaced by sample text entry, final registration is simulated, and returning to the public landing page shows the ordinary guest entry UI again. The stored RSVP remains confirmed in the preview inbox and management page. Neither live auth/email delivery nor real-device behavior is claimed by this review. No material design blocker or accepted exception.

## Production cleanup — November 3, 2026 (current)

Fresh read-only reviewer: **GO**, no material visual blockers. Manually exercised guest RSVP → confirmation → prefilled standard registration and member login → automatic RSVP in the isolated local app. Reviewed 1440/1280/390px, full page through footer and the 390×600 modal. Full description remains intact, mobile fields stack cleanly, focus moves correctly and optical spacing remains balanced. Member confirmation does not promote signup. Browser warning/error logs were empty.

Sample credentials, test banners and inbox links are absent from shipping UI. Local authentication/data/email boundaries remain substituted in an ignored disposable copy, never in the deployed app. Registration uses the real UI and is intercepted only at the final action. The `*-signup-sent.png` files show that QA interception and must not be presented as production screenshots; use `*-optional-signup.png` for the registration handoff. Historical sandbox sections above are superseded by this entry and the current README.

Current evidence includes `1440-form.png`, `1280-login-modal.png`, `390-optional-signup.png`, `390-short-modal.png` and `member-rsvp-retry.png`. No accepted design exception. Real inbox delivery and provider verification remain outside this visual review.
