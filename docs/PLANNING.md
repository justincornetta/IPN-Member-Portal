# Planning Context

This file gives anyone working in the codebase enough context to know **what we're building, why, and in what order** without having to leave the repo.

The full planning materials (long-form requirements, platform tradeoff matrix, meeting transcripts, journey-mapping research) live in two places:

- **Notion (canonical, edited frequently)**
  - [Member Portal — Platform Decision](https://www.notion.so/Member-Portal-Platform-Decision-3569c4a2baaa81e6853dd2c00ba99ca7) — stack rationale, Plan A/B/C effort tiers
  - [Member Portal — Requirements Prioritization](https://www.notion.so/Member-Portal-Requirements-Prioritization-3579c4a2baaa81f682e2eeb8f7062ff1) — 23 features ranked, workshop decisions
  - [IPN Member Portal Project Brief](https://www.notion.so/3559c4a2baaa8108abadccfc2d890254) — overview + status
- **Justin's local workspace (point-in-time copies)** — `requirements.md`, `discovery-questions.md`, `platform-decision.md`, May 7 meeting transcript. Not in this repo to avoid duplication drift; ask Justin if you need them.

When the inlined summaries below diverge from Notion, **Notion wins**. Refresh this file periodically.

---

## What we're building

A vibe-coded web app at `members.ipn.org` (PWA, no native app stores in v1) that gives IPN members a single home for:

- Discovering each other (searchable directory by persona, school, area of study, location)
- Finding and registering for events (replaces scattered Zoom/Google Calendar embed)
- Accessing the resource library (links to YouTube, PsychedelX, blog content)
- A community chat surface (platform TBD — see Stack section)

Replaces today's scattered experience across Mailchimp, Discord, Zoom, and the public Squarespace site. The Squarespace marketing site stays; this is a separate subdomain that the homepage CTA funnels users into.

**Launch target:** PsychedelX 2026 (end-June).

---

## Stack (locked except where noted)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js 16 + React 19 + TypeScript** | App Router, `src/` layout, Turbopack |
| Styling | **Tailwind CSS v4** | |
| Hosting | **Vercel** | Free Hobby tier; auto-deploys on push to `main` |
| Auth + DB | **Supabase** | Postgres 17, Row-Level Security, free tier |
| Email | **Mailchimp API** | Single audience post-SoT-consolidation |
| Mobile | **PWA wrap** | Manifest + service worker; no app stores in v1 |
| In-portal chat platform | **TBD** | Discord embed/SSO, Stream, custom build, or another vendor — pending Community Task Force input |
| AI tooling for development | Claude Code primary, v0/Lovable for occasional UI scaffolding | |

**Explicitly NOT in v1:** Stream API for activity feed, native app store presence, Google SSO, push notifications, paid membership infrastructure.

The stack is locked but not religious. If something genuinely better surfaces, route changes through the Notion platform-decision page first.

---

## v1.0 build queue (the MUST list)

From the Notion Requirements Prioritization page. Build in roughly this order:

| # | Feature | Notes |
|---|---|---|
| 1 | Email + password auth | Supabase Auth. Foundation for everything else. |
| 3 | Member profile | Role, school, area of study/interest, location, bio, LinkedIn. |
| 4 | Searchable member directory | List view in v1.0; map view in v1.1. Acceptance test: find a researcher in <30s. |
| 5 | Events list + detail | Replaces scattered Zoom emails / IG / Google Calendar embed. |
| 6 | One-click event registration | Captured in-portal; no Eventbrite handoff for v1. |
| 7 | Add-to-calendar buttons | Per-event: Google / Apple / Outlook. |
| 10 | Resource library (links only) | YouTube / PsychedelX / blog hub; no native content yet. |
| 12 | Mailchimp ID spine | Auto-tag Mailchimp records with portal user ID. **Depends on Membership Single Source of Truth project.** |
| 13 | Mobile-responsive UI | Bundled with the build (Tailwind defaults). Instagram is the primary acquisition channel. |
| 19 | In-portal community chat | Workshop bumped from v2 → v1.0. **Platform TBD** (see Stack). |
| 27 | Admin portal | Workshop-added. Admins upload resources, edit text, role-based access. |

**On hold** (need more info before building): #8 calendar subscription (.ics), #11 career-pipeline placeholder, #14 career-pipeline full content.

**Moved to v1.1** (build after launch): #21 affiliate program links, #22 partnership / sponsor pages, #24 conference carousel, #25 job board embed (workinpsychedelics.com), #26 grants curation.

---

## Working assumptions

- **Pace:** 10 hrs/wk on this project.
- **Build estimate:** 4–7 weeks @ 10 hrs/wk for full v1.0 (Plan A in the platform-decision doc).
- **Fallback if Week 2 gate slips:** Plan B Waitlist MMP — branded landing + auth + signup + "you're on the waitlist" page (~10–16 hrs total). Continue building post-launch on the same codebase, no rework.
- **Last resort:** Plan C — pivot to Circle.so ($1,068/yr). Only if Plans A and B both fail.

---

## Cross-project dependencies

- **Website redesign** (separate sibling project) — homepage CTA → portal signup funnel. Ask Justin for the latest if working on the handoff.
- **Membership Single Source of Truth** (separate Notion project) — the Mailchimp ID spine (#12) depends on the SoT pipeline being live.
- **Member Registration Form Redesign** (separate Notion project) — entry point that funnels members into the portal signup.

---

## Slack notifications

Two GitHub Actions workflows post to the private `#github-updates` Slack channel (`C0AQX8U0V0W`):

| Workflow | Trigger | What it does |
|---|---|---|
| [`.github/workflows/slack-notify.yml`](../.github/workflows/slack-notify.yml) | Push to `main` | Posts a "IPN Member Portal Updated" message with the commit SHA, message, and author. Mirrors the same pattern used in `justincornetta/ipn-dashboard`. |
| [`.github/workflows/slack-pr-review.yml`](../.github/workflows/slack-pr-review.yml) | PR `review_requested` | Posts a "PR Review Requested" message that **@-mentions the reviewer in Slack** so they get a real notification. Includes PR title, author, size (files / lines changed), a 2–4 sentence summary pulled from the PR description, and two action buttons: open the PR on GitHub, and open the Vercel preview deployment for the branch. |

**Setup requirements:**

- Repo secret `SLACK_WEBHOOK_URL` must be set. Find the existing webhook value in the Slack app at https://api.slack.com/apps (under the app that owns it → Incoming Webhooks). Set it via:
  ```bash
  gh secret set SLACK_WEBHOOK_URL -R justincornetta/IPN-Member-Portal
  ```

**Adding new contributors to the @-mention mapping:**

Edit `.github/workflows/slack-pr-review.yml` and add to the `SLACK_USER_MAP` associative array:

```bash
declare -A SLACK_USER_MAP=(
  ["justincornetta"]="U061Z7YC3DX"
  ["lukestrong47"]="U0A9VJCD3AT"
  ["new-github-username"]="U0XXXXXXXX"  # ← add new entry
)
```

Find a Slack user ID by clicking their profile in Slack → "View full profile" → "..." menu → "Copy member ID".

**PR description tip for reviewers' sake:** the first paragraph of your PR description becomes the Slack notification summary. Aim for 2–4 sentences describing what the PR does, what it touches, and any caveats. That's enough for the reviewer to decide whether to context-switch right away or batch the review later.

**Skipped events** (workflow exits early without posting):
- Draft PRs (lets you open drafts to get the Vercel preview without spamming Slack)
- Self-review requests (when the PR author requests their own review)
- Team-review requests (we only handle individual reviewers; teams not used here yet)

---

## Source citations

This file synthesizes:

- The Member Experience Workshop transcripts (Apr 23 + Apr 30, 2026) and the synthesis [`workshop-outcomes-april-2026.md`](https://github.com/justincornetta/IPN-Member-Portal) (in Justin's workspace, not this repo)
- Luke Strong's Apr 7 platform survey (Slack group DM `C0AKCF5D1AP`, ts `1775576990.412989`)
- The May 7 Justin + Luke stack-decision call (transcript in Justin's workspace)
- The 2025 member survey (n=35) for persona definitions
