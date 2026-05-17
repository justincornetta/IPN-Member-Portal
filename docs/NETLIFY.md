# Netlify Parallel Deploy Trial

This project can run on Netlify alongside Vercel while IPN decides which host to keep. Do not move `members.ipn.org` to Netlify until the trial passes.

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
3. Keep the generated `*.netlify.app` site URL for testing. Do not add `members.ipn.org` yet.
4. Enable Deploy Previews for pull requests.
5. If Netlify asks for a site name, prefer `ipn-member-portal` if available. If it is not available, choose a stable readable name and set the GitHub repository variable `NETLIFY_SITE_NAME` to that exact Netlify subdomain prefix so Slack PR notifications can link to deploy previews.

## Environment variables

Add these in Netlify project settings:

| Variable | Production | Deploy Previews | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Same value | Public anon client config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Same value | Public anon client config |
| `NEXT_PUBLIC_SITE_URL` | `https://members.ipn.org` | Leave unset unless testing a fixed URL | Preview auth redirects use Netlify deploy URLs when this is unset |

Do not add service-role keys, Mailchimp keys, or webhook secrets until a feature needs them.

## Supabase auth URLs

In Supabase, go to Authentication -> URL Configuration.

Keep existing Vercel/local URLs during the trial. Add Netlify URLs after the Netlify site is created:

| Setting | Value |
|---|---|
| Site URL | Keep `https://members.ipn.org` until the production domain moves |
| Redirect URL | `http://localhost:3000/**` |
| Redirect URL | `https://members.ipn.org/**` |
| Redirect URL | `https://ipn-member-portal.vercel.app/**` |
| Redirect URL | `https://*-ipn-s-projects.vercel.app/**` |
| Redirect URL | `https://<netlify-site-name>.netlify.app/**` |
| Redirect URL | `https://deploy-preview-*--<netlify-site-name>.netlify.app/**` |

Replace `<netlify-site-name>` with the real Netlify site subdomain. Supabase supports wildcard redirect patterns for Netlify preview URLs.

## Trial checklist

- Netlify production test URL loads `/`, `/login`, `/register`, and `/dashboard`.
- Registration sends a Supabase confirmation email with a Netlify callback URL on deploy previews.
- Luke opens a small PR and Netlify creates a Deploy Preview without Justin manually redeploying.
- Justin can open the Deploy Preview from GitHub or Slack.
- Vercel remains available as rollback during the trial.

## If Netlify wins

1. Move `members.ipn.org` DNS to Netlify.
2. Set Supabase Site URL to `https://members.ipn.org`.
3. Disable or remove the Vercel GitHub Actions deploy workflow.
4. Disconnect/pause Vercel auto-deploys.
5. Update `README.md`, `docs/PLANNING.md`, and this file to mark Netlify as the primary host.

## If Netlify loses

1. Leave `members.ipn.org` on Vercel.
2. Keep or remove `netlify.toml` depending on whether it creates noise.
3. Continue with the Vercel workflow and revisit hosting later only if cost or collaboration becomes a blocker again.

