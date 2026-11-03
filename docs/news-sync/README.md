# Automatic newsletter and article updates

Prepared locally November 3, 2026. Nothing pushed, deployed or written to production.

## Portal

The homepage and Resources already share the resources table. Production had zero newsletter rows and fell back to September. The old import required Mailchimp audience configuration and successful paid AI image generation; its GitHub job checked only background-request acceptance.

The importer now reads IPN's public Mailchimp RSS archive, selects member newsletters, imports every available issue, upserts by monthly slug, preserves saved covers, and reads back published links before reporting success. The six-hour GitHub schedule calls the synchronous protected endpoint throughout the month. Feed, parse, database and verification failures return an error. Content-sync also returns a failing HTTP status if Substack or another source fails internally. No schema/auth changes.

A verified public-source snapshot includes May–November 2026 for first deployment and upstream-outage fallback. November was sent November 1 at 23:28:42 UTC; its actual link is https://mailchi.mp/intercollegiatepsychedelics/49osd6lrav-13887420 . Artwork is from the published email (November uses its animated website preview), with no new AI calls. The importer preserves older saved issues when they leave the RSS window.

## Public website

Companion checkout: `/Users/jcornetta/IPN Workspace/Projects/website-redesign/Code/ipn-website-news-sync`, branch `fix/automatic-news-feeds`.

The website was a manually generated static snapshot. A same-origin Netlify endpoint now retrieves the public Mailchimp and Substack feeds with a 15-minute CDN freshness interval. The News and full blog archive progressively add recent content while retaining existing static entries and curated copy. November is also in the built HTML, including when JavaScript is disabled. During feed failure, the successful source still updates; saved HTML remains available. Feed refresh requires JavaScript; non-JavaScript clients see the build snapshot. Future entries available in the public RSS feed appear without a rebuild. RSS is a recent-items feed, not a complete historical archive; existing static entries and the Mailchimp archive link remain.

The exact same public-news parser is copied in both checkouts; keep the two files in sync when changing source rules. URLs are restricted to the expected publication domains; no email HTML is rendered into the website.

## Substack audit

All four entries in the live Substack feed match the production portal resources by link and publication date. Latest: September 27, “DEA Proposes Schedule I Classification for Five Research Tryptamines.” The portal has both hourly Netlify content sync and six-hour GitHub content sync. Website previously required manual refresh and now has the runtime feed endpoint.

## Local verification

- Locked portal dependencies and Chromium installed; lint and production build pass (existing Next.js middleware deprecation warning).
- 12 focused parsing, mapping, persistence, retry/duplicate and failure checks pass. Website's two endpoint failure tests, four Python tests and production build/link audit pass.
- Browser passes at 1440 and 390 CSS pixels for portal homepage, Resources News tab, website News, and full blog archive. No page/console errors or horizontal overflow. Screenshots are in `screenshots/`.
- Browser simulation verifies a December issue replaces November and places November in Past issues; a new article appears in both website locations; a total feed outage retains the static November page.
- Portal browser QA replaces authentication/database boundaries in an ignored disposable copy. Persistence tests use an in-memory client, not production Postgres. Public feeds were fetched live. Production import writes, deployed function routing/CDN caching and scheduled completion remain release verification steps.
- The first browser fixture lacked Tailwind's source directive; visual inspection caught it and the fixture was corrected. Final screenshots/checks use normal production styling.

Run `node scripts/news-dev.mjs` in each checkout. Portal: http://127.0.0.1:4341/dashboard and /dashboard/resources?tab=newsletters. Website: http://127.0.0.1:8041/news/ and /news/posts/ . Tests: `node qa/news/browser.mjs` and `node qa/news/updates.mjs` in the portal checkout.

## Release after owner approval

1. Publish the portal branch through a PR and deploy the approved website checkout. Website baseline commit captures the existing uncommitted production source from the original checkout; the next commit is this task's changes. Do not replace production with remote master, which lacks that source.
2. Invoke the protected portal newsletter endpoint, confirm seven published rows/latest November and both real authenticated views. Verify the next scheduled job completes, not merely accepts a background request.
3. Check deployed website `/api/public-news`, cache headers, News and blog archive on phone/desktop. Verify retained fallback during an upstream outage. No additional API/AI credentials are needed for newsletters.
