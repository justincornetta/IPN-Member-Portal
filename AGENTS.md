<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GitHub collaboration rules

This repo deploys from `main`; Vercel remains active while Netlify is tested as a parallel host. Never commit directly to `main`; all work should happen on a descriptive branch and return through a PR.

Before starting new work:

```bash
git checkout main
git pull
git checkout -b feature/your-feature-name
```

Use readable branch prefixes:

- `feature/` for new functionality
- `fix/` for bug fixes
- `update/` for content or copy changes
- `chore/` for config, dependencies, cleanup

Commit in small, focused chunks with messages that describe what changed, such as `add member profile page with Supabase fetch`, `fix auth redirect loop on login`, or `update homepage hero copy`. Avoid vague messages like `changes`, `wip`, or `fix stuff`.

Push the branch, open a PR, include a short description of what changed and why, and link the deploy preview URL when available. Get a quick second review before merging.

Loose ownership boundaries:

- Luke: overall architecture, Supabase schema, auth, core layout.
- Justin: to be defined based on what Justin is actively building.

Flag work first if it needs to touch the other person's area. If production breaks, still use a `fix/` branch and PR; flag Luke first if the issue is urgent and genuinely production-breaking.

If `main` changes while a branch is active, sync it into the branch:

```bash
git fetch origin
git merge origin/main
```
