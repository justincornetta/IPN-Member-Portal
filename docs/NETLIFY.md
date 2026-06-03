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
| `NEXT_PUBLIC_SITE_URL` | Leave unset until the production domain moves | Leave unset | Netlify provides the active deploy URL through `URL` / `DEPLOY_PRIME_URL`; set this to `https://members.ipn.org` only after the production domain moves |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID | Same value | Required for Discord account linking |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret | Same value | Secret; required for OAuth token exchange |
| `DISCORD_BOT_TOKEN` | Discord bot token | Same value | Secret; required for automatic server join |
| `DISCORD_GUILD_ID` | Discord server ID | Same value | Required for automatic server join |
| `NEXT_PUBLIC_WIDGETBOT_SERVER_ID` | Discord server ID | Same value | Public WidgetBot server ID |
| `NEXT_PUBLIC_WIDGETBOT_JOIN_EVENTS_CHANNEL_ID` | Discord channel ID | Same value | Public WidgetBot dashboard channel |

Do not add service-role keys, Mailchimp keys, or webhook secrets until a feature needs them.

## Supabase auth URLs

In Supabase, go to Authentication -> URL Configuration.

| Setting | Value |
|---|---|
| Site URL | `https://ipn-member-portal.netlify.app` until the production domain moves |
| Redirect URL | `http://localhost:3000/**` |
| Redirect URL | `https://members.ipn.org/**` |
| Redirect URL | `https://<netlify-site-name>.netlify.app/**` |
| Redirect URL | `https://deploy-preview-*--<netlify-site-name>.netlify.app/**` |

Replace `<netlify-site-name>` with the real Netlify site subdomain. Supabase supports wildcard redirect patterns for Netlify preview URLs.

## Validation checklist

- Netlify production URL loads `/`, `/login`, `/register`, and `/dashboard`.
- Registration sends a Supabase confirmation email with a Netlify callback URL on deploy previews.
- Justin-created PRs get Netlify Deploy Previews.
- Luke-created PRs get Netlify Deploy Previews.
- Justin and Luke can open Deploy Previews from GitHub or Slack.

## Production domain cutover

1. Move `members.ipn.org` DNS to Netlify.
2. Set Supabase Site URL to `https://members.ipn.org`.
3. Set Netlify `NEXT_PUBLIC_SITE_URL` to `https://members.ipn.org`.
4. Verify signup/login callbacks on the production domain.

## Vercel deprecation

Vercel is no longer the active deployment target. Keep the old Vercel project paused or disconnected to avoid duplicate public links and deploy confusion.
