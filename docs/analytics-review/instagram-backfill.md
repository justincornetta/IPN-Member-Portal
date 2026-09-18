# Instagram archive backfill

This archives accessible feed-post metadata only: post ID, publication timestamp, caption (up to 280 characters), type, permalink, current likes/comments, and when counts were observed. No images/videos, comment bodies, tokens, or token-bearing pagination URLs are stored. It does not post to Instagram or change member/Supabase data.

## One-time run

Use the existing server-side Instagram credentials in the trusted analytics runtime (`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`). Install the locked Python requirements first: `python3 -m pip install -r scripts/analytics-requirements.txt`.

Run `npm run analytics:instagram-backfill`. This invokes an Instagram-only backfill with a 200-page safety budget (50 posts/page), then generates `data/instagram-snapshot-candidate.json`. It does not replace the published snapshot, push a branch, run other source loaders, or invoke production maintenance. Review the candidate and publish it through the normal branch/PR approval process.

The existing Portal analytics refresh workflow also has an optional manual `instagram_backfill` input. Once this code is published, dispatch it against the approved branch with that input set to true. Only the isolated backfill job runs: it uses the existing GitHub Instagram secrets, has read-only repository permissions, and uploads the candidate/checkpoint as seven-day artifacts. It does not execute the normal refresh job, push commits, run Supabase maintenance, or send Slack updates. Download/review the candidate before a separately approved publication. A failed pull still retains any successful-page checkpoint artifact; restore that JSON in the same trusted runtime to resume.

For smaller resumable batches, use `python3 scripts/instagram_pull.py --platform instagram --backfill --max-pages 20`, then `node scripts/build-instagram-archive-snapshot.mjs`. The ignored local `data/instagram_media.json` checkpoints each successful page; repeating the command in the same runtime continues from its private cursor. A fresh runtime seeds posts from the published snapshot but restarts pagination, since private cursors are deliberately not committed. An exhausted budget explicitly reports incomplete coverage; it never asserts all-time completeness. Rerunning after completion performs a new full reconciliation.

Later-page failures are reported rather than silently returning success. Previously retained posts survive, and successful backfill pages remain locally checkpointed. API retries are bounded for transient transport/429/5xx failures; requests and diagnostics omit credentials. Errors, malformed timestamps, repeated/missing cursors, and account mismatches stop publication. The command is read-only toward Meta; it writes only local archive/candidate files.

## Routine refresh

The normal daily Instagram pull continues to fetch the recent publication window for the headline metrics, without the former 100-post truncation. It merges by Instagram post ID and does not erase old archived posts. CI seeds the ignored archive from the committed snapshot, and snapshot generation independently preserves old IDs if only a recent file is available. Date-filtered dashboard tables paginate at 25 rows; the post chart uses the same publication-date subset.

The recent discovery path retains the existing feed's reverse-chronological cutoff assumption; the full backfill never relies on that assumption. Periodically rerun full reconciliation to discover older posts missed by routine refresh and refresh their counters. Missing posts are not automatically classified as deleted. A feed reaching its end proves only accessible feed coverage at that pull, not recovery of deleted posts, expired Stories, or every historical insight.

## Metric and storage boundaries

The 30-day engagement metric remains based on posts *published* in the last 30 days: current likes plus comments divided by the current follower count, averaged per post. It is not a measure of interactions occurring during those 30 days. Older counts are latest observed totals, not reconstructed publication-day totals, and are not refreshed daily. Unknown observation dates are shown as Unknown.

The current dashboard archive remains JSON metadata in the existing snapshot, not a new Supabase table or Storage bucket. It therefore introduces no new Supabase allocation. It increases snapshot/repository size and dashboard payload; measure the actual candidate bytes/post count after the live pull. Very large archives should move to paginated server-side storage before continued growth.

## Local verification

Regression tests cover backfills beyond 100 posts, cursor continuation, incomplete page budgets, mid-pagination failure, missing/repeated cursors, ID upserts, recent-window filtering, account mismatch, retention from published snapshots, and removal of private cursors from published metadata. Synthetic browser fixture contains 32 historical posts to exercise two-page pagination, date filtering, and empty ranges. Live ingestion requires the trusted runtime credentials; synthetic QA does not assert that production history has already been backfilled.
