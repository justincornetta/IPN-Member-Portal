# WhatsApp onboarding continuation repair

## Diagnosis — November 20, 2026

The member's supplied email screenshot shows the Conferences channel after account creation, with the Join button cut off at the panel's bottom and no visible portal continuation. The email reports that signing out and back in worked around it. No account record was inspected or changed.

Reproduced the same layout on main `4e80e78` using the real onboarding components and CSS. At a 1440 × 1080 CSS-pixel viewport, the desktop panel was 495 px high but its QR column needed 570 px. The Continue link occupied y=846–890, beyond the panel's clipping boundary. Browser hit testing could not reach it. At 800 × 600, the original fixed minimum column widths put the link's right edge at x=928, outside the window and clipped by the frame. This is a layout dead end, not evidence of failed account creation.

## Repair

- Let content determine the channel panel height, retaining the original minimum size.
- Allow the page to grow and scroll with its content; prevent the flex parent from shrinking the background to one screen.
- Fit the three desktop columns into narrow desktop/tablet windows without clipping the QR column or continuation.
- Keep space between Join and Continue, including when error messages appear.

Production changes are CSS only. Authentication, account creation, onboarding persistence, channel URLs and the existing mobile structure are unchanged. Kit: IPN Brand, preserving the shipped onboarding palette/type as a maintenance-scope exception rather than restyling the portal.

## Verification

Installed dependencies from the lockfile (`npm ci`) and the repository browser runtime (`npm run qa:install`). Lint and production build pass. A pre-existing lint error in the event-card test used the forbidden variable name `module`; renamed that local harness variable without changing the test's behavior, and all six event-card checks pass.

All 29 focused checks pass across onboarding foundation/integration, mobile onboarding regressions and event-card actions. All 20 browser scenarios pass across the final matrix run and the corrected error-scenario rerun. The error test was corrected to wait for the entrance animation and target the visible error message. No console/page errors or framework error overlays in the successful runs.

Browser matrix: 1440×1080, 1440×900, 1280×800, 1024×768, 800×600, 761×600, 760×600, 390×844 and 320×568. Each tests all three channels with editorial animation enabled and disabled, actual click navigation, full link containment and horizontal overflow. Additional scenarios cover QR failure plus popup blocking, Welcome → WhatsApp → portal, keyboard channel selection/continuation, reduced motion and a local same-device handoff. Screenshots include the full scrollable page.

Commands:

```sh
npm run lint
NEXT_PUBLIC_SUPABASE_URL=https://qa.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-placeholder WORKFLOW_INTEGRATION_MODE=off npm run build
node --test --experimental-strip-types tests/onboarding-foundation.test.mjs tests/onboarding-integration.test.mjs tests/mobile-onboarding-regressions.test.mjs tests/event-card-actions.test.mjs
npx playwright test -c playwright.onboarding.config.ts
```

Start the isolated local preview with `node scripts/onboarding-dev.mjs`; open `http://127.0.0.1:4360/onboarding/whatsapp?motion=editorial`. The script uses a disposable `.qa-onboarding` copy and never copies `.env` files or inherits integration credentials. It replaces authenticated-user lookup, progress saves, analytics, QR endpoint, channel handoff destination and dashboard with fixtures. The onboarding pages/components/styles remain the production versions. No role-specific onboarding UI is omitted. This verifies layout/navigation, not live authentication, persistence, email delivery or real WhatsApp joining.

An initial build failed because the Mac ran out of disk space. Removed only generated `.next` directories from four inactive project clones, recovered about 2.4 GB and reran successfully. No source or user data was removed. Existing Next middleware deprecation warning remains.

## Evidence and release

- [Before: missing Continue](screenshots/before-1440x1080.png)
- [After: full Join and Continue controls](screenshots/after-1440x1080.png)
- [Narrow desktop](screenshots/after-800x600.png)
- [Phone](screenshots/after-390x844.png)
- [QR and popup error state](screenshots/after-errors.png)

Independent visual review is recorded in `design-review.md`. Local branch: `fix/signup-whatsapp-navigation`. Publication requires Justin's explicit approval under AGENTS.md; nothing pushed, no PR opened and no production change made in this session.
