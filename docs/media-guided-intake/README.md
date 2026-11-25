# Guided Media intake

Implemented locally on November 1, 2026, on `feature/media-guided-request`.

## Request and scope

Luke Strong proposed splitting the long Media form into smaller steps and reducing repetitive labels/helpers in his [October 26 Slack thread](https://intercollegia-dcd2196.slack.com/archives/C088ZJBM0QY/p1793063310607659?thread_ts=1793034999.165159&cid=C088ZJBM0QY). His [working prototype](https://claude.ai/artifact/2BMHD6ByWTAUViDf5DKifz) was inspected through all four steps, including self-written copy, reader links, and review/edit controls.

New requests at `/dashboard/admin/media` now use:

1. **What's the idea?** Request-type cards, automatic submitter, event prefill, name, team, and brief.
2. **When and where?** Posting deadline, channel and format choices, and urgency.
3. **Copy and files.** Self-written copy or Media help, optional Drive/Canva links, and an optional reader destination with placement instructions.
4. **Anything else?** Internal notes and a complete summary with links back to the relevant step before sending.

Back and review edits retain entries. Fields validate before continuing; final submission rechecks all steps. Failed saves preserve the brief and reuse the request ID for retry. Busy controls prevent repeated submission. Cancel creates no request. Native radio/checkbox controls, explicit field labels, linked helper/error text, step announcements through heading focus, and visible keyboard focus remain available.

The saved request shape, API, database schema, notification logic, existing request editing, queue/calendar, and production/review/publication workflows remain compatible. Local validation uses the existing domain validation helpers. Event details, multi-format requests, reader-link placement, and legacy body/caption editing remain supported.

**Kit: IPN Brand Guidelines (October 13 dark-plum decision).** The new form uses dark plum, Sunflower headings, Poppins Bold, Work Sans, and white pill primary actions. The pre-existing portal shell and submitted-request screens retain their current styling; a sitewide restyle is outside this intake change. Fonts come from the local IPN brand kit.

## Verification

- `npm ci`
- `npm run qa:install`
- `npm run lint`
- `npm run build`
- `npm run qa:local` — 17 checks across the existing workflows, guided navigation/validation, save retry, cancellation, diagnostic visibility, and 1440/1280/390 px layouts.
- `node --test --experimental-strip-types tests/leadership-bootstrap.test.mjs tests/leadership-workflows.test.mjs tests/leadership-worker.test.mjs` — 18 passing tests, including database/RLS and publication/notification protections.
- `git diff --check`

Browser tests use the repository's localhost-only preview at `http://127.0.0.1:4327/workflow-preview/media`, plus the existing expense preview for regressions. They check console/page errors and framework overlays. Requests use ignored local JSON fixtures; Slack and Sheets delivery are off. Production sign-in and live notifications were not exercised. The existing Next.js middleware-to-proxy deprecation warning remains.

Screenshots for all four steps are in [screenshots](screenshots/), at desktop widths 1440 and 1280, and mobile width 390. The preview shell scrolls within its content pane, so viewport screenshots show the corresponding visible portion of each step.

Initial independent product-design review: **GO**, with no material blockers reported at that time (see the misses and follow-up below). The reviewer inspected all 12 screenshots and drove the local preview at 1440, 1280 and 390 px, checking keyboard focus/tab order, radio selection, required-date feedback, event prefill, review editing, mobile scrolling and footer controls. No browser warnings/errors or framework overlays were observed. React review also checked state ownership, hook dependencies, semantic controls and preserved error descriptions. These checks are desktop-browser viewport simulations, not physical-device testing.

## Follow-up from Justin's review

The first design review missed two issues: equal-width step columns left a large visible gap after the short “Idea” label, and the signed-in approver saw an unrelated Integration status panel below Media. The local preview hid that panel with a demo-only condition, so the initial review did not cover the same visible page.

Steps now size to their content with consistent visible gaps, wrapping into compact rows on small screens. Integration diagnostics remain available only on the expense admin queue, outside request forms and details. Their visibility now uses the same page/role conditions in local preview and signed-in views. Automated browser coverage checks that placement, and captures the final Media footer at each viewport width.

For subsequent reviews in this project:

- Inspect spacing between visible text/control edges, especially short and long labels. Equal column widths alone do not establish visual balance.
- Inspect the entire top, middle and bottom of each flow in the relevant user roles. Record preview/production visibility differences and inspect or recreate omitted controls before approving.
- Check whether administrative, diagnostic or status controls help the current user make a meaningful decision. Keep them in the relevant administrative view.
- Recheck user-reported visual defects against the original screenshots; record evidence for the correction. Before captures and new footer captures are included in the screenshot folder.

Focused re-review: **GO** after comparing the before/after screenshots at 1440, 1280 and 390 px, inspecting complete Media footers, and checking admin/leadership visibility in the live local browser. The reviewer confirmed consistent visible gaps, readable mobile wrapping, clean form actions, and no browser warnings/errors. Production visibility is supported by the shared source condition and local role fixtures; production itself was not opened.

The [shared design-review skill](https://app.notion.com/p/3f22386c248f81bb8420f03e467a78e8) was updated by Notion Organizer through Cornbot (request `42747ac64fc19a1efb9f`). Read-back confirmed all three checks, the screenshot/recorded-evidence requirement, and both PR #68 regression examples. The “About 3 minutes” label is an estimate inherited from the prototype, not a measured completion time.

## Publication

Justin approved pushing the reviewed branch and opening a PR on November 1, 2026. [PR #68](https://github.com/justincornetta/IPN-Member-Portal/pull/68) includes these verification results and screenshots; its Netlify preview will be linked in the PR once available. Production has not been changed. Merge remains a separate decision.

## TBD dates and asset-only requests (November 25, 2026)

Requested by Rosie (IPN assistant) with Justin's approval (Nov 25, 9:57 AM ET: "Send the Forge request with the extras"). Three media requests (a partner media kit, a Vital placeholder and an Office Hours update) were waiting on it.

**A. Post by accepts TBD.** Step 2 has a "Date is TBD" checkbox under the date. A request needs a date or TBD, never neither and never both. TBD is stored explicitly as `postedByTbd: true` with `postedBy: ""`; dated requests keep `postedByTbd: false` and older records without the field read as dated. Review, request detail, queue and the #media-space post show "TBD".

**B. Asset-only requests.** A new toggle, "Asset for partner/internal use, not posted", is stored as `assetOnly: true`. When it is on:

- the date reads "Needed by" with the hint "The day the asset should be ready, not a posting date.";
- platforms are N/A, "For partners: Instagram" and "For partners: LinkedIn" (regular requests keep today's list; the API rejects mixing the two lists);
- Slack says "Needed by", adds "Asset for partner/internal use, not posted by IPN", and labels the Media team's date "Planned delivery date";
- the queue labels the date "Needed by" and tags the row "Asset only, not posted by IPN"; the calendar does not show it as an IPN post.

**C. Extras.**

1. New status "Delivered: Ready for partner use" (`delivered`), only for asset-only requests. It needs a Media owner and a final Drive/Canva link. Asset-only requests can't be marked Published or given a published link; regular requests can't be marked Delivered.
2. For asset-only requests, step 3 becomes "Partner captions and usage notes". Copy is optional; partner captions are stored in `caption` and usage notes in `usageNotes`.
3. "Placeholder, not ready for production" checkbox (`placeholder: true`), shown on the request, in the queue and at the top of the Slack post.
4. The calendar lists TBD and asset-only requests under "TBD and needed-by requests" below the grid instead of hiding them. Delivered, Published and cancelled requests drop off that list.
5. Editing a submitted request uses the same rules and controls. As before, edits don't post to Slack; the Slack post refreshes on the next status, owner or planned-date change.

No database migration: the request body is JSON and the new fields are optional, so existing requests are unchanged.

Verification: `tests/leadership-media-tbd-asset.test.mjs` (domain and Slack formatting for A, B and C) and `qa/leadership/media-tbd-asset.spec.ts` (local browser flow at 1440 and 390 px). Screenshots are in [screenshots/tbd-asset](screenshots/tbd-asset/).

## Save as draft (November 25, 2026)

Requested by Rosie (IPN assistant) from Justin (Nov 25, 12:09 PM ET). Built from `main` after #86 and #87, because the PR number Justin mentioned (#88) did not exist on GitHub when work began.

**Where it shows up.** Every step of the new request wizard (Idea, When and where, Copy and files, Review) has a **Save draft** button next to Continue or Send request. It saves whatever is filled in, including empty required fields, and stays on the same step with "Draft saved at …". Required-field checks run on Continue (per step, as before) and on **Send request**, never on Save draft. Leaving with unsaved changes asks whether to save the draft, discard the changes, or keep editing.

**My drafts.** A third view on the Media Requests page, next to Request queue and Media calendar, lists the signed-in person's own drafts (newest first). **Continue editing** reopens the draft in the same wizard with every step reachable; save it again or send it from Review. **Delete** asks first and soft-deletes the draft.

**What a draft is.** A normal request record with status `draft` and no schema change. It has no fake date: an unset date stays empty, "Date is TBD" stays a real choice. It is private to its creator (not even the approver can open it), is left out of the queue, calendar, status filter, Slack, DMs and request history, and counts toward nothing in analytics. Saves are checked for type and size only (for example, text over a field's limit is refused); links are not validated until the request is sent.

**Sending.** Send request on a draft runs today's submit path: full validation, then the #media-space parent post tagging the Media director. The request keeps its id, moves to Submitted and its submitted date becomes the send time. It cannot be saved as a draft again.

**Kept from #86.** Date is TBD, the asset-only toggle (Needed by, N/A or partner platforms), the placeholder checkbox and the Delivered status all work in drafts and after sending.

Verification: `tests/leadership-media-drafts.test.mjs` (domain, Slack job and privacy rules) and `qa/leadership/media-drafts.spec.ts` (local browser flow at 1440 and 390 px, no Slack). Screenshots are in [screenshots/drafts](screenshots/drafts/). The cancel prompt changed the existing cancellation test in `qa/leadership/media-intake.spec.ts` to choose Discard changes.
