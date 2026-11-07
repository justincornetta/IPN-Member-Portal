# Community and Events performance — local review, November 7, 2026

Status: implemented locally on `fix/community-events-performance`, based on main `209730a`. No push, PR or deployment. The directory chat owns compact cards, connection reconciliation and consumption of the server summary prop.

## What changed

Community launches independent metadata/member reads together, then loads education and authorized contacts in parallel for ordinary browsing. Reuses connection data for the pending badge. Paginates complete metadata/search/map populations instead of assuming the first database page contains everyone; contact/education ID batches stay bounded to 100 IDs per request. Data remains per-request, authenticated and subject to existing RLS, without cross-user caching or auth changes.

Events loads only Upcoming or Recordings, according to the selected URL tab. Registration, ticket and meetup state are independent parallel reads. Existing ticket gates and chat-link masking remain.

Dashboard navigation now has route loading feedback, reduced-motion-aware skeletons and a pending indicator. Expected Community/Events read failures show a retry state instead of false empty results; unexpected failures use route error boundaries. Mobile pending dots sit outside label flow, preserving full navigation labels.

## Summary contract for the directory chat

Optional `directorySummary: {totalMembers, mappedMembers, cities, countries}` is calculated from the full committed search/filter/tab population. Geographic counts include only discoverable members sharing location, with nonempty city and finite coordinates within latitude/longitude bounds. City identity uses normalized city/country plus coordinates rounded to two decimals; countries use trimmed case-normalized nonempty values. Blank countries do not add a country. List and map use the same population; only eligible members appear on the map. Failures render an error, never zero-filled counts. The existing client only declares this optional prop in this commit; the sibling chat consumes it. Its connection/pagination work must catch load-more failures and preserve existing rows.

## Preview and reproduction

Run `npm ci`, `npm run qa:install`, then `npm run performance:dev`. Open http://127.0.0.1:4341/performance-preview . Choose Community or Events, slower reads, error state, or reset. Slow mode adds 800 ms per read; switching from Events to Community shows loading feedback before content. Reset clears the simulated failure.

The preview runs real page/layout components in `.qa-performance`, with 125 fictional members and sample events. Fixture factories replace database/auth integrations only in that disposable tree. No environment files are copied; API/integration mutations are disabled. Preview routes are absent from the production build. Member and event actions are outside this preview's scope.

## Measurements

Controlled server-data benchmark in `benchmark.json`: 125 members, 150 ms per simulated database read, zero auth latency, median of three runs. Before uses the actual page source at `209730a`; after uses the extracted loaders. Both use current enrichment helpers with identical request counts for the 60-row browse fixture.

| Route | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Community | 1215 ms | 304 ms | 75% |
| Events | 606 ms | 303 ms | 50% |

Reduction = (before − after) / before. Reproduce with `node --experimental-strip-types qa/performance/benchmark.mjs`. These timings demonstrate fewer sequential waits; they do not measure production database execution, auth, network, server cold starts, browser rendering, or click-to-content time. Real signed-in latency needs measurement after an approved release. Full search and maps still scale with the matching population.

## Verification

- Locked dependency install and repository Chromium installation passed.
- ESLint and optimized production build passed with placeholder public Supabase configuration.
- Eight focused loader tests passed: full-result geography, privacy, search beyond 1,000 rows, combined filters, parallel stages, failures, connection counts and ticket/recording behavior.
- Eight browser scenarios passed at 1440, 1280 and 390 px: both routes, recordings, load-more, late-member search, slow navigation, both retry states, and preview control links. No console/page errors or framework overlays in these flows.
- Full `npm test`: 232 passed, two unrelated failures reproduced from unchanged base files: Instagram archive fixture account ID conflicts with current snapshot; newsletter JSON import lacks Node 24's required import attribute. No changes made to those unrelated files.
- Existing Next middleware deprecation warning remains. No live authentication, production RLS or external mutation verification is claimed.

Independent product-design review: GO for local preview after correcting mobile label space and the preview redirect. Reviewer verified loading/error states at 1440/1280/390, reduced-motion animation disabled, bottom controls clear of mobile navigation, successful retry/reset and no page/console errors. Screenshots are in `screenshots/` (desktop/tablet/phone, loading and error). Existing card presentation belongs to the directory chat; the focused navigation feedback follows the current light portal appearance.
