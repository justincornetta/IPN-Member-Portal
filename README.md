# IPN Member Portal

The web application powering [`members.ipn.org`](https://members.ipn.org) — community discovery, events, and resources for the [Intercollegiate Psychedelics Network](https://intercollegiatepsychedelics.net).

**Status:** v0 scaffold. Auth, profiles, directory, and events are coming. Launch target: PsychedelX 2026 (end-June).

Auth completed

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **Supabase** — Postgres + Auth + Row-Level Security
- **Vercel** — current hosting + rollback path during Netlify trial
- **Netlify** — parallel deployment trial for PR previews and collaboration
- **Mailchimp API** — member email integration (planned)

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

Vercel remains active while Netlify is tested as a parallel deployment target. Do not move `members.ipn.org` until Netlify passes the trial checklist.

- Vercel: current production/rollback deployment path.
- Netlify: configured by [`netlify.toml`](netlify.toml); setup checklist lives in [`docs/NETLIFY.md`](docs/NETLIFY.md).

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in whichever host is being tested.
