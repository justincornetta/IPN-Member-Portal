# Guided Media intake

Implemented locally on November 1, 2026, on `feature/media-guided-request`.

## Request and scope

Luke Strong proposed splitting the long Media form into smaller steps and reducing repetitive labels/helpers in his [October 26 Slack thread](https://intercollegia-dcd2196.slack.com/archives/C088ZJBM0QY/p1793063310607659?thread_ts=1793034999.165159&cid=C088ZJBM0QY). His [working prototype](https://claude.ai/artifact/2BMHD6ByWTAUViDf5DKifz) was inspected through all four steps, including self-written copy, reader links, and review/edit controls.

New requests at `/dashboard/admin/media` now use:

1. **What's the idea?** Request-type cards, automatic submitter, event prefill, name, team, and brief.
2. **When and where?** Posting deadline, channel and format choices, and urgency.
3. **Copy and files.** Self-written copy or Media help, optional Drive/Canva links, and an optional reader destination with placement instructions.
4. **Anything else?** Internal notes and a complete summary with links back to the relevant step before sending.

Back and review edits retain entries. Fields validate before continuing; final submission rechecks all steps. Failed saves preserve the brief and reuse the request ID for retry. Busy controls prevent repeated submission. Cancel creates no request. Native radio/checkbox controls, explicit field labels, linked helper/error text, step announcements through heading focus, and visible keyboard focus remain available.

The saved request shape, API, database schema, notification logic, existing request editing, queue/calendar, and production/review/publication workflows remain compatible. Local validation uses the existing domain validation helpers. Event details, multi-format requests, reader-link placement, and legacy body/caption editing remain supported.

**Kit: IPN Brand Guidelines (October 13 dark-plum decision).** The new form uses dark plum, Sunflower headings, Poppins Bold, Work Sans, and white pill primary actions. The pre-existing portal shell and submitted-request screens retain their current styling; a sitewide restyle is outside this intake change. Fonts come from the local IPN brand kit.

## Verification

- `npm ci`
- `npm run qa:install`
- `npm run lint`
- `npm run build`
- `npm run qa:local` — 16 checks across the existing workflows, guided navigation/validation, save retry, cancellation, and 1440/1280/390 px layouts.
- `node --test --experimental-strip-types tests/leadership-bootstrap.test.mjs tests/leadership-workflows.test.mjs tests/leadership-worker.test.mjs` — 18 passing tests, including database/RLS and publication/notification protections.
- `git diff --check`

Browser tests use the repository's localhost-only preview at `http://127.0.0.1:4327/workflow-preview/media`, plus the existing expense preview for regressions. They check console/page errors and framework overlays. Requests use ignored local JSON fixtures; Slack and Sheets delivery are off. Production sign-in and live notifications were not exercised. The existing Next.js middleware-to-proxy deprecation warning remains.

Screenshots for all four steps are in [screenshots](screenshots/), at desktop widths 1440 and 1280, and mobile width 390. The preview shell scrolls within its content pane, so viewport screenshots show the corresponding visible portion of each step.

Independent product-design review: **GO**, with no material blockers. The reviewer inspected all 12 screenshots and drove the local preview at 1440, 1280 and 390 px, checking keyboard focus/tab order, radio selection, required-date feedback, event prefill, review editing, mobile scrolling and footer controls. No browser warnings/errors or framework overlays were observed. React review also checked state ownership, hook dependencies, semantic controls and preserved error descriptions. These checks are desktop-browser viewport simulations, not physical-device testing.

## Publication

Justin approved pushing the reviewed branch and opening a PR on November 1, 2026. The PR will include these verification results and screenshots; its Netlify preview will be linked once available. Production has not been changed. Merge remains a separate decision.
