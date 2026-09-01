# IPN Member Portal

The web application powering [`members.intercollegiatepsychedelics.net`](https://members.intercollegiatepsychedelics.net) — community discovery, events, and resources for the [Intercollegiate Psychedelics Network](https://intercollegiatepsychedelics.net).

**Status:** v0 scaffold. Auth, profiles, directory, and events are coming. Launch target: PsychedelX 2026 (end-June).

Auth completed

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **Supabase** — Postgres + Auth + Row-Level Security
- **Mapbox GL JS** — interactive directory map
- **Netlify** — hosting, production deploys, and PR deploy previews
- **Mailchimp API** — member audience/newsletter sync
- **Resend** — transactional event RSVP confirmations and reminders

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your Supabase keys
cp .env.example .env.local
# Then edit .env.local with values from your Supabase dashboard

# 3. Run the dev server
npm run dev
```

`npm run dev` checks for the public Supabase URL and key before Next.js starts,
so an incomplete local environment fails with an actionable terminal message
instead of a browser runtime overlay. Because `.env.local` is intentionally
gitignored, every clone or worktree needs its own file. On a trusted development
machine, multiple worktrees can safely symlink `.env.local` to one canonical,
untracked environment file rather than copying secrets between checkouts.

Open [http://localhost:3000](http://localhost:3000).

The landing page shows a Supabase configuration indicator — green if `.env.local` is wired up correctly, amber otherwise.

## Project structure

```
app/
├── src/
│   ├── app/                 Next.js App Router (pages, layouts, route handlers)
│   │   ├── layout.tsx       Root layout
│   │   ├── page.tsx         Landing page
│   │   └── globals.css      Tailwind entry + global styles
│   └── lib/
│       └── supabase/
│           ├── client.ts    Supabase client for Client Components
│           └── server.ts    Supabase client for Server Components / Actions
├── public/                  Static assets
├── .env.example             Env-var template (committed)
├── .env.local               Real env values (gitignored)
└── AGENTS.md                AI-agent guidance for this Next.js version
```

## Planning context

**Start here:** [`docs/PLANNING.md`](docs/PLANNING.md) — what we're building, the stack, the v1.0 build queue, working assumptions, and dependencies. Plus links to the canonical Notion pages and Justin's workspace planning docs.

**Back-end / database:** [`docs/SUPABASE.md`](docs/SUPABASE.md) — schema, auth flow, RLS policies, and setup steps.

If you're a new contributor: read PLANNING.md first, then come back here for the local-dev setup above.

## Deploy

Netlify is the active deployment target. Pull requests get Netlify Deploy Previews, and merges to `main` deploy through the connected Netlify site.

- Netlify config: [`netlify.toml`](netlify.toml)
- Deployment notes: [`docs/NETLIFY.md`](docs/NETLIFY.md)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Netlify project settings.

## Mailchimp newsletter sync

The protected content-sync workflow also triggers a Netlify background function
during the first five days of each month. It imports the newest sent campaign
whose title or subject contains both `IPN` and `newsletter`, fetches the issue
content, creates a one-sentence member-portal summary, and upserts a monthly
`newsletter-<month>-<year>` resource. Repeated runs and Mailchimp resend
shortcuts do not create duplicate portal cards.

Cover creation follows the `ipn-newsletter-cover-photo-generator` system: the
image model creates only a content- and season-specific 3:2 community photo;
the application then adds the exact IPN logo, Geist typography, deep-plum
scrim, title, month, and square crop deterministically. The 900 x 600 cover and
300 x 300 thumbnail are stored at campaign-specific paths in the public
`content-images` Supabase Storage bucket. Existing completed issues and existing
cover exports are reused instead of regenerated.

Required server-only environment variables:

- `MAILCHIMP_API_KEY`
- `MAILCHIMP_AUDIENCE_ID`
- `MAILCHIMP_SERVER_PREFIX` (optional when the API key includes its `-usXX` suffix)
- `MAILCHIMP_NEWSLETTER_FOLDER_ID` (optional but recommended)
- `OPENAI_API_KEY`
- `OPENAI_NEWSLETTER_TEXT_MODEL` (optional; defaults to `gpt-5-mini`)
- `OPENAI_NEWSLETTER_IMAGE_MODEL` (optional; defaults to `gpt-image-1`)
- `CONTENT_SYNC_SECRET`

The GitHub Actions workflow invokes the production content-sync route and the
newsletter background endpoint every six hours. Mailchimp polling is internally
limited to days 1–5; Substack, YouTube, Eventbrite, and event cleanup keep their
existing schedule. Configure the Mailchimp, OpenAI, Supabase, and sync-secret
values in Netlify; GitHub only needs `SITE_URL` and `CONTENT_SYNC_SECRET` to
trigger the deployed functions.

For a protected preview that makes no database changes, call:

```text
GET /api/admin/sync-newsletters?dryRun=true&force=true
Authorization: Bearer <CONTENT_SYNC_SECRET>
```

To queue the full background workflow manually, call:

```text
POST /api/background/sync-newsletters?force=true
Authorization: Bearer <CONTENT_SYNC_SECRET>
```

The endpoint returns `202` when Netlify accepts the job. `force=true` allows a
manual run outside the normal monthly window.
