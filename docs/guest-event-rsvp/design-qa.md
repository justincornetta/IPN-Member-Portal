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
