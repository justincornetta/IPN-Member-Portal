# Controlled live workflow test

## Preparation

PR #65 is still unmerged. Keep `WORKFLOW_INTEGRATION_MODE=off` until the deployment and queue review are complete. Justin explicitly waived the optional second review for this rollout. Production credentials are configured; deploy previews do not receive them.

Preflight on October 5, 2026:

- Slack bot authentication passed in the IPN workspace. Bot membership in `#media-space` and `#expense-tracking` passed.
- Google service-account authentication and read access to the finance tracker passed.
- The existing mixer media request is Accepted, with five pending delivery jobs.
- The expense named **Testing** is marked Purchased for $45.00, with eight pending delivery jobs. Justin confirmed it is simulated and authorized its exclusion. Set `WORKFLOW_EXCLUDED_REQUEST_IDS` to its stable ID (`e6e42ae8-9f5e-416d-986e-1bf105f4a222`) in all deployed contexts. This hides it from live workflow reads, denies mutations, and marks delivery jobs skipped while preserving its original history.
- Agnes has no matching portal profile. She needs an eligible leadership account for testing ownership/review herself; Slack tagging uses her configured Slack ID independently.
- Next.js and Sharp runtime dependencies were updated for the recorded security advisories. Verify the updated lockfile and browser QA before publishing.

## Deployment

1. Publish the verified dependency update and merge PR #65 through GitHub under Justin’s rollout authorization.
2. Wait for production deployment. With integrations still off, confirm both signed-in Admin routes load and the Slack expense callback exists.
3. Resolve the simulated expense and inspect every remaining pending job. Older job snapshots may generate multiple historical notifications; retain only the deliveries intended for this test with an explicit audit explanation.
4. Enable `live` only for the production context and redeploy. The scheduled worker can deliver queued jobs automatically; changing the environment is not limited to the request currently open in the browser.

## Media

Use the existing real mixer request rather than resubmitting it. Confirm its notification appears in `#media-space`, tags Agnes, and opens the correct production request. Confirm owner assignment and review/status saves persist together, the scheduled date appears in the calendar, and final-review checks remain enforced. Do not mark the actual request Posted until content has really been published, with its final asset, publication URL/date, and requested destination-link confirmation recorded.

## Expenses

Have a leadership member submit a real intended expense. Verify:

1. `#expense-tracking` receives the details, current dated Relay cash projection, and Approve/Reject actions.
2. Justin clicks Approve in Slack. The portal changes to approved/awaiting purchase, the submitter receives a Slack DM, and exactly one Expense Requests row is synchronized by stable Request ID.
3. Approval leaves actual cash unchanged.
4. After a real purchase, record actual amount/date, Relay as paying account, and a receipt link. Verify exactly one Transactions row, the approved request's updated state, and one corresponding cash reduction.
5. Refresh/retry and verify the tracker still contains one request row and one payment row.

Test rejection with another clearly identified, unpurchased request and verify the reason and submitter notification. Verify another leader cannot approve or see a different member's expense. Validate reimbursement only for an actual preapproved personal payment; simulated purchase/reimbursement tests require a separate test tracker.

## Completion and rollback

Compare the portal, Slack, Expense Requests, Transactions, and activity history. Integration jobs should complete without persistent delivery errors. If delivery is wrong, set production integrations back to `off` and redeploy; saved portal requests remain intact. Investigate external records before retrying. Do not clear or fabricate recorded bank balances to make a test pass.
