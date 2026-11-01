# IPN Member Portal — current checkpoint

## Status

Media intake improvements implemented locally on `feature/media-guided-request`, based on `origin/main` commit `32e47e5`. Awaiting Justin's approval to push and open a PR. No deployment or production writes.

## Last session — November 1, 2026

- Located Luke Strong's October 26 private `#media-space` thread after Justin explicitly authorized private Slack search. Inspected all four steps of Luke's Claude prototype.
- Added a guided new-request form: Idea → When and where → Copy and files → Review, with simpler prompts, native selectable cards/chips, optional reader links, and review edit links.
- Preserved data through backward navigation, validated each step, prevented duplicate in-flight submits, and verified failure/retry retains the request ID. Existing request editing, event prefill, persistence and production workflow remain compatible.
- Applied IPN brand colors and local Poppins/Work Sans fonts to the new form.
- `npm ci`, `npm run qa:install`, lint, production build, all 16 browser QA checks, 18 targeted workflow/domain/database/bootstrap/worker tests and `git diff --check` pass. Screenshots cover 1440, 1280 and 390 px.
- Local preview remains running at `http://127.0.0.1:4327/workflow-preview/media` using sample data and disabled external integrations.
- Independent product-design reviewer returned **GO** after screenshot and live-browser review at 1440, 1280 and 390 px. No material blockers or browser errors found.

## Next steps

1. Show Justin the completed local implementation and request publishing approval under `AGENTS.md`.
2. After explicit approval, push `feature/media-guided-request`, open a PR with the verification notes/screenshots, and add its Netlify deploy-preview URL.
3. Send Cornbot a concise milestone update when Tin Can connectivity is restored.

## Open decisions

- Publishing approval is pending. The new-request form is scoped separately from the existing editing/production screens and sitewide portal styling.

## Known issues and limits

- Existing Next.js middleware deprecation warning remains.
- Production sign-in and real Slack/Sheets delivery were not exercised; local preview delivery is disabled.
- Tin Can inbox and doctor could not reach the configured relay. `tailscale status` reports Tailscale is stopped. Retried the inbox after backoff; relay remains unavailable. No team/Notion milestone update could be delivered. Do not repeat diagnostics more than hourly; retry with the instructed backoff.
- Pre-existing unrelated untracked credential JSON was left untouched and is excluded from this commit.

## References / PRs / commits

- [Implementation, source links, QA and screenshots](docs/media-guided-intake/README.md)
- [Luke's proposal](https://intercollegia-dcd2196.slack.com/archives/C088ZJBM0QY/p1793063310607659?thread_ts=1793034999.165159&cid=C088ZJBM0QY)
- [Luke's interactive prototype](https://claude.ai/artifact/2BMHD6ByWTAUViDf5DKifz)
- Base: `32e47e5`. Implementation commit: this checkpoint's commit. No PR yet.

This committed checkpoint is mirrored into the owning workspace project root for cross-session discovery.
