# Compact directory cards and connection continuity

Justin selected ImageGen option 1 for desktop and mobile on November 7, 2026. The directory now uses horizontal cards with a circular avatar, complete name, current affiliation, and subdued stage/location. Interest tags remain searchable and visible in profiles and filters.

Logan's two reports:
- [Connect collapses the expanded directory and returns to the top](https://intercollegia-dcd2196.slack.com/archives/C0BCFEF587L/p1793997595559719).
- [Current affiliation is displaced by historical education](https://intercollegia-dcd2196.slack.com/archives/C0BCFEF587L/p1793998372707939).

Affiliation now prefers the explicit profile affiliation, then currently enrolled education. Only legacy student profiles without structured education fall back to the legacy school field. Completed education remains in the profile's education section.

Same-query server revalidation merges the fresh first page by member ID while retaining later loaded pages. A genuine account/query/filter/view change resets the list. Connection actions return authoritative status and authorized contact details; the modal no longer requests a redundant router refresh. Pending/error states prevent misleading success, retained contacts are cleared when no longer accepted, and accepted profiles recheck contact access on reopening. Existing authenticated Supabase/RLS and notification paths remain in use. Expected load-more failures return a retryable result without erasing rows.

## Performance integration

Integrated the performance chat's local commit `0ef4407` as `7b287a9`. The client consumes full-result geographic summaries for the committed URL query; temporary local search results retain local counts until the server response settles. City/country counts cover members sharing valid mapped locations; the total includes all matching members. [Performance methodology and limitations](../navigation-performance/README.md).

## Local preview and verification

Run `npm ci`, `npm run qa:install`, and `npm run directory:dev`. Open http://127.0.0.1:4342/dashboard/directory. The disposable `.qa-directory` copy uses 125 fictional members, simulated auth/database responses and disabled connection notifications. It exercises the real directory client, modal, connection server actions and Next revalidation. No environment files or live credentials are copied. Preview writes affect only in-memory sample connections, which reset when its server restarts.

- `npm run lint` and `npm run build`: pass.
- `node --test tests/directory-connections.test.mjs tests/navigation-performance.test.mjs`: 22 pass.
- `npm run qa:directory`: 10 browser scenarios pass at 1440, 1280, 390 and 320 px. Includes complete names, affiliation precedence, profile interests, 60→120→125 pagination, Connect retaining modal/pages/scroll/focus, cancellation, failure/retry, incoming autoaccept, contact access/removal, search reset, failed page read/retry and failed contact read/reopen.
- `PERFORMANCE_PORT=4343 npm run qa:performance`: all eight integrated scenarios verified. Seven passed initially; the preview-host assertion was corrected to use the configured port and the eighth then passed. No application failure occurred in that assertion.
- No browser console/page errors or framework overlays in final directory checks. Independent product-design review: **GO**, no P1/P2 blockers at all four widths, including full-scroll, expanded Admin, Filters, keyboard focus and sparse/long-content cards.

Opening the deliverable in Justin’s Chrome produced a development hydration warning from Grammarly-injected body attributes (`data-new-gr-c-s-check-loaded` / `data-gr-ext-installed`). Clean Chromium QA passed without this warning. No extension settings or global hydration suppression were changed.

This fixture QA does not validate production authentication, RLS configuration, actual network latency, delivery of notifications, or physical devices. The performance chat reproduced two unrelated existing full-suite failures (Instagram account fixture mismatch and Node 24 newsletter JSON import attributes); the focused checks above pass. Existing Next middleware deprecation warning remains. No migration, push, PR or deployment is part of this local handoff.

## Review evidence

- [Selected option 1](selected-option-1.png)
- [Desktop 1440](screenshots/directory-1440.png), [desktop 1280](screenshots/directory-1280.png), [mobile 390](screenshots/directory-390.png), [narrow mobile 320](screenshots/directory-320.png)
- [Long name on mobile](screenshots/long-name-390.png), [profile](screenshots/profile-390.png), [Connect after page three](screenshots/request-sent-390.png), [accepted contact](screenshots/accepted-contact.png)
- Independent reviewer screenshots use the `review-` prefix. [Design comparison](../../design-qa.md).
