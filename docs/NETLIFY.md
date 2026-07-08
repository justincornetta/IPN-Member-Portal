# Netlify Deployment

Netlify is the active deployment target for the IPN Member Portal. The GitHub repo is public during the build so Justin and Luke can collaborate with free deploy previews.

## Why Netlify

Netlify supports modern Next.js, including App Router, middleware, route handlers, and Next.js 16 through OpenNext. Deploy Previews are created for pull requests in connected Git repositories.

- Next.js support: https://docs.netlify.com/frameworks/next-js/overview/
- Deploy Previews: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls

## Site setup

1. In Netlify, create a new site from `justincornetta/IPN-Member-Portal`.
2. Use these build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Node version: `22`
3. Use `https://ipn-member-portal.netlify.app` while the production domain is not connected.
4. Enable Deploy Previews for pull requests.
5. Keep the GitHub repository variable `NETLIFY_SITE_NAME` set to the Netlify subdomain prefix so Slack PR notifications can link to deploy previews.

## Environment variables

Add these in Netlify project settings:

| Variable | Production | Deploy Previews | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Same value | Public anon client config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Same value | Public anon client config |
| `NEXT_PUBLIC_SITE_URL` | `https://members.intercollegiatepsychedelics.net` | Leave unset | Netlify provides the active deploy URL through `URL` / `DEPLOY_PRIME_URL`; set this only for production so deploy previews keep their own callback URL |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public access token | Same value | Public token for the Directory Map; restrict by domain in Mapbox |
| `NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL` | WhatsApp Community invite link | Optional / same value when available | Public link used by dashboard, welcome modal, and Community page CTAs |
| `CONTENT_SYNC_SECRET` | Random long secret | Optional / same value when testing automation | Server-only shared secret for GitHub scheduled automation calls, including content sync and Portal analytics refresh when no dedicated analytics secret is set |
| `PORTAL_ANALYTICS_MAINTENANCE_SECRET` | Optional random long secret | Optional / same value when manually testing | Server-only bearer/header secret for invoking the Portal analytics rollup and 90-day raw-event retention function. If unset, the function accepts `CONTENT_SYNC_SECRET` so the GitHub scheduled workflow can use the existing automation secret |
| `SLACK_FEEDBACK_WEBHOOK_URL` | Feedback webhook URL | Optional / same value when testing feedback notifications | Server-only incoming webhook for portal feedback submissions |
| `SLACK_MEMBER_REGISTRATIONS_WEBHOOK_URL` | Registration webhook URL for `#member-portal-registrations` | Optional / same value when testing registration notifications | Server-only incoming webhook for new member registration notifications |
| `RESEND_API_KEY` | Resend API key | Same value only when testing reminder sends | Server-only key for event RSVP confirmation and reminder emails |
| `EVENT_EMAIL_FROM` | `IPN Events <events@members.intercollegiatepsychedelics.net>` | Same or sandbox sender | Sender used for event transactional emails; use the already verified `members.intercollegiatepsychedelics.net` Resend domain |
| `EVENT_EMAIL_REPLY_TO` | `info@intercollegiatepsychedelics.net` | Same or test inbox | Reply-to address for event transactional emails |

Do not add service-role keys, Mailchimp keys, Resend keys, or other webhook secrets until a feature needs them.

Resend is currently configured on the existing plan with one verified domain:
`members.intercollegiatepsychedelics.net`. Event emails should send from
`IPN Events <events@members.intercollegiatepsychedelics.net>` and use
`info@intercollegiatepsychedelics.net` as the reply-to address. Do not upgrade
Resend or attempt to verify the root domain unless the email strategy changes.

## Scheduled event reminders

Event RSVP reminders run through the Netlify Scheduled Function at
`netlify/functions/send-event-reminders.mts`. It runs every 10 minutes on
published deploys and sends due 24-hour and 1-hour reminders through Resend.
Deploy Previews do not run the cron schedule automatically; use the Netlify
Functions UI "Run now" action for preview/manual smoke tests.

## Scheduled analytics refresh

Portal Analytics refreshes from the Member Portal repository only. The old IPN
Operations dashboard is not part of the production refresh path.

GitHub Actions runs `.github/workflows/portal-analytics-refresh.yml` at
**10:30 UTC daily** and on manual dispatch. The workflow pulls external source
data directly from the Member Portal repo, rebuilds the privacy-safe analytics
snapshot, commits `src/lib/admin/analytics/legacy-snapshot.json` when the
snapshot changes, and then calls the production Netlify function at
`/.netlify/functions/portal-analytics-maintenance`. The function rolls raw
`portal_analytics_events` into `portal_analytics_daily_rollups`, deletes raw
events older than 90 days, records the refresh and per-source statuses in
`portal_analytics_refresh_runs`, and sends a Slack confirmation to the webhook
stored in the repo secret `SLACK_WEBHOOK_URL`.

The workflow uses `SITE_URL` and `CONTENT_SYNC_SECRET`, which are already used
by the content-sync workflow. If a dedicated
`PORTAL_ANALYTICS_MAINTENANCE_SECRET` exists in both GitHub and Netlify, the
function accepts that too.

The external source pullers require these GitHub repository secrets:

| Source | Required GitHub secrets |
|---|---|
| Mailchimp | `MAILCHIMP_API_KEY` |
| Instagram / Facebook | `INSTAGRAM_ACCESS_TOKEN`, plus `INSTAGRAM_BUSINESS_ACCOUNT_ID` and `FACEBOOK_PAGE_ID` when auto-discovery is not sufficient |
| GA4 | `GA4_PROPERTY_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` |
| Zoom | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Eventbrite | `EVENTBRITE_API_TOKEN` |
| Donations / Squarespace | `SQUARESPACE_API_KEY` |

When a source credential is missing or an API pull fails, the workflow keeps the
last good dashboard data for that source, records that source as failed, and
includes the failure in the Slack message.

To turn the daily refresh on in production:

1. Apply the Supabase migration that creates `portal_analytics_refresh_runs`.
2. Confirm GitHub has `SITE_URL`, `CONTENT_SYNC_SECRET`, and
   `SLACK_WEBHOOK_URL` secrets.
3. Add the external source secrets listed above to GitHub.
4. Confirm Netlify has `CONTENT_SYNC_SECRET`, or set the same
   `PORTAL_ANALYTICS_MAINTENANCE_SECRET` value in GitHub and Netlify.
5. Merge the workflow into the default branch. GitHub scheduled workflows only
   run from the default branch.
6. Manually run **Portal analytics refresh** once from GitHub Actions and
   confirm the Admin Analytics page shows the new last refreshed timestamp.

## Supabase auth URLs

In Supabase, go to Authentication -> URL Configuration.

| Setting | Value |
|---|---|
| Site URL | `https://members.intercollegiatepsychedelics.net` |
| Redirect URL | `http://localhost:3000/**` |
| Redirect URL | `https://members.intercollegiatepsychedelics.net/**` |
| Redirect URL | `https://ipn-member-portal.netlify.app/**` |
| Redirect URL | `https://deploy-preview-*--ipn-member-portal.netlify.app/**` |

Supabase supports wildcard redirect patterns for Netlify Deploy Preview URLs.

## Validation checklist

- Netlify production URL loads `/`, `/login`, `/register`, and `/dashboard`.
- Registration sends a Supabase confirmation email with a Netlify callback URL on deploy previews.
- Justin-created PRs get Netlify Deploy Previews.
- Luke-created PRs get Netlify Deploy Previews.
- Justin and Luke can open Deploy Previews from GitHub or Slack.

## Production domain cutover

Use the existing Squarespace-managed `intercollegiatepsychedelics.net` domain. Do not buy a new domain and do not move DNS authority to Netlify.

1. In Netlify, add `members.intercollegiatepsychedelics.net` as a custom domain for this site.
2. In Squarespace DNS for `intercollegiatepsychedelics.net`, add one custom record:
   - Type: `CNAME`
   - Host: `members`
   - Value: `ipn-member-portal.netlify.app`
3. Leave the existing apex, `www`, MX, TXT, and Squarespace records unchanged.
4. Wait for Netlify DNS verification and HTTPS certificate provisioning.
5. Set `members.intercollegiatepsychedelics.net` as the primary domain in Netlify.
6. Set Supabase Site URL to `https://members.intercollegiatepsychedelics.net`.
7. Set Netlify production `NEXT_PUBLIC_SITE_URL` to `https://members.intercollegiatepsychedelics.net`.
8. Verify signup/login callbacks on the production domain.

## Vercel deprecation

Vercel is no longer the active deployment target. Keep the old Vercel project paused or disconnected to avoid duplicate public links and deploy confusion.
