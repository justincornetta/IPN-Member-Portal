# Registration barriers audit — September 18, 2026

All production operations were SELECT-only. No accounts, notifications, data restores, updates, or deletions were performed. Reports contain aggregate counts rather than member identities.

## Dashboard reconciliation

Analytics PR #63 was inspected read-only at `e25c4214c47e5847a934c87cba62fc30ea4f74e0`. Its Barriers card uses the filtered, email-deduplicated member directory. The numerator is **members with at least one effective nonblank barrier**, not selections or all historical submissions. Its denominator includes only current effective statuses **No — I don't plan to work in the field** and **I'm not sure**.

| Effective merged status | Unique members | Nonblank barriers | Preview treats as applicable |
|---|---:|---:|---|
| No — I don't plan to work in the field | 4 | 2 | Yes |
| I'm not sure | 5 | 5 | Yes |
| Not yet — I'm interested in working in the field | 130 | 128 | No |
| Yes — I currently work in the field | 108 | 10 | No |
| Missing status | 1,884 | 0 | No |
| Total | 2,131 | 145 | |

**7 / 9 = 77.8%**, precisely reproducing the screenshot. Four of the seven effective answers come from Portal; three come from legacy forms. The seven comprise five not-sure members and two No members.

The registration question applies to all three non-Yes choices, including Not yet. If the preview used that same applicability rule, the all-source card would show **135 / 139 = 97.1%**. The 128 answered Not yet members are present but excluded by the preview's status predicate, not missing from production. PR #63's `member-directory.ts` removes their barriers from merged display rows, and `AnalyticsDashboardShell.tsx` independently excludes their status from numerator and denominator. This task does not modify either analytics file or PR #63.

The ten merged Yes members with legacy barrier text are historical answers made inapplicable by their current status. Their text is still stored. Do not delete it just because the card excludes it.

## Counts by source

### Raw/current records

| Source | Records | Nonblank barrier records | Evidence |
|---|---:|---:|---|
| Current Portal profiles | 83 | 35 | 31 Not yet; 4 not sure; 47 Yes with no barriers; one Not yet blank |
| Original Google Form submissions | 196 | 120 | 105 Not yet; 2 not sure; 2 No; 11 Yes |
| Form mirror (`src_form`) | 196 | 120 | Same status and answer distribution as original form |
| Legacy imported master | 2,088 | 115 | 101 Not yet; 2 not sure; 2 No; 10 Yes |
| Imported master tagged Form | 186 | 115 | Actual source of all legacy barrier answers |
| Imported master tagged Mailchimp | 2,069 | 106 | Membership overlaps Form; these are not independent Mailchimp barrier responses |
| Imported master tagged old app | 1,099 | 3 | Membership overlaps Form; these are not independent old-app barrier responses |
| Live old-app tab (`src_oldapp`) | 1,100 | Not collected | Schema has no field-status/barrier question; master membership differs by one from this tab |
| Live Mailchimp tab (`src_mailchimp`) | 2,104 | Not collected | Schema has no barrier question; master remains at its earlier 2,069-member import |
| Eventbrite imported attendee details | 1,407 | Not collected | No barrier/field/question/custom-response keys in stored details |
| Zoom imported participants | 524 | Not collected | Same stored-details limitation |
| Zoom imported registrants | 441 | Not collected | Same stored-details limitation |
| Imported Drive historical channel | 0 | 0 | No tagged master records and no historical Drive tab in the workbook |

The old-app supplemental snapshot contains 1,100 rows and nine nonblank field statuses but no barrier field. It is not evidence of additional barrier responses. Historical Drive snapshots advertised in the workbook README are a planned channel, not an imported response dataset accessible through this master.

The live `_meta` tab dates the master build to July 6, while Form and Mailchimp source tabs refreshed on September 18; the imported master is not automatically a fresh union of those tabs. The form refresh still contains the same responses. Current Mailchimp source rows have no barrier field, so its growth does not establish additional missing barrier answers. The old-app import enriches existing master identities by `person_id` rather than adding unmatched supplement identities; one of the 1,100 supplemental identities does not match the master and has no field status or barrier field. This explains 1,099 imported old-app memberships without asserting deletion.

### Effective, deduplicated directory by selected source

These source cohorts overlap and must not be summed. Mailchimp membership follows the preview's actual source rule: legacy Mailchimp membership **or** a Portal Mailchimp status that is nonblank and not `unknown`.

| Selected source | Unique members | Preview eligible | Preview answered | Registration-rule eligible | Registration-rule answered |
|---|---:|---:|---:|---:|---:|
| All | 2,131 | 9 | 7 | 139 | 135 |
| Portal | 83 | 4 | 4 | 36 | 35 |
| Form | 186 | 6 | 4 | 110 | 107 |
| Mailchimp | 2,112 | 7 | 5 | 131 | 127 |
| Old app | 1,099 | 1 | 0 | 5 | 4 |

## Identity, mappings, and precedence

- Portal and legacy records join on trimmed, lowercased email. There are 40 cross-source matches: `2,088 + 83 - 40 = 2,131`. Neither current table has missing identity emails or duplicate normalized emails. This is deterministic email identity, not guaranteed human identity across different email addresses.
- The 196 original form submissions represent 186 emails: ten duplicate pairs. Five pairs have barrier answers on both submissions; collapsing those explains `120 - 5 = 115` legacy answered identities. Three duplicate groups contain different nonblank barrier text, so the latest nonblank response replaces the earlier text in the master; the original submissions retain that history.
- The form builder sorts submissions by timestamp and only replaces a field with a nonblank value. One duplicate pair has an earlier barrier answer and a later blank answer/status; its earlier answer remains in the master. No answered form identity is absent from the master.
- Portal nonblank field status and barriers take precedence independently over legacy values. Five matched identities have nonblank answers in both sources and count once. One Portal profile has blank barriers but a nonblank legacy answer; fallback retains that answer, which is inapplicable under its current Yes status. No matched Portal status differs from a nonblank legacy status in this dataset.
- `115 legacy + 35 Portal - 5 answered overlaps = 145` merged nonblank barrier identities. Of those, 128 Not yet are excluded incorrectly by the preview predicate, ten Yes are correctly inapplicable, and seven are shown.
- The original form question headings match the mirror's prefix-based mappings for field status and barriers. Fourteen raw-versus-imported text differences are curly-apostrophe normalization only; after that normalization there are **zero** mismatches. No nonblank answer was dropped by that import mapping.
- The signup database trigger extracts `psychedelic_field_barriers` from auth metadata into the profile array. All 83 profile arrays exactly match their auth metadata arrays. No metadata-only answer was found.
- Suspended/banned or explicitly analytics-excluded profiles: **0**. Deleted-subject tombstones: **0**. Those filters do not explain the seven. There is a deleted-subject trigger but no profile field-change history trigger.

## Missing-answer and history evidence

The intended 139-member cohort has four unanswered members:

| Evidence category | Members | Interpretation |
|---|---:|---|
| Legacy No; one original submission each, blank barriers | 2 | Observably unanswered in available source evidence |
| Legacy Not yet; one original submission, blank barriers | 1 | Observably unanswered in available source evidence |
| Portal Not yet; blank signup metadata/profile, no matching form submission or legacy answer | 1 | Observably unanswered in available signup evidence |

The two legacy No members explain the preview's missing `9 - 7 = 2` answers. None of these four has an earlier nonblank answer in the accessible evidence. Do not invent answers or restore records.

Read-only checks also covered:

- Live original form, form mirror, and master, compared with July local artifacts: 196 original submissions / 186 emails; no changed barrier histories or newly added form emails since that snapshot.
- Four legacy import-run metadata entries on July 7: successful imports of 2,088 rows, two intervening zero-row runs, and a final 2,088-row import. Run metadata is not a row-version archive.
- Google Drive revision listing and previous revision **1871**, September 17, compared with live September 18 workbook: previous raw form has 196 submissions / 120 answers, previous mirror has the same distribution, previous master has 2,088 rows / 115 answers. No aggregate loss is evident across that revision boundary. The revision is retrievable, not merely a timestamp entry.
- Auth audit log: zero accessible entries. No application profile/legacy row-version audit table was found. Local master pull history contains aggregate run counts, not prior versions of each response.

**Limit:** This is not a proof that no deletion ever occurred. Complete historical database backups, WAL/PITR history, and a full revision-by-revision longitudinal comparison were not available through the audited sources. Current-row absence alone is not deletion evidence. There is no basis here for a deletion allegation or a production restoration.

## Implementation and validation

Separate worktree: `/Users/jcornetta/Code/IPN-Member-Portal-registration-barriers`, branch `fix/registration-required-barriers`, based on `origin/main` at `7deedda`. Analytics PR #63 remains untouched.

Registration now shares applicability, nonblank-answer validation, and hidden-answer normalization between step 3 and the signup server action. Every displayed non-Yes path requires one choice. Yes skips that requirement and submits an empty barrier array even if a caller supplies stale hidden text. Changing to Yes clears local selected choices and Other text; returning to a non-Yes answer requires a fresh selection. The exact new choice **I'm not interested in the field** appears immediately above Other, and the shared category canonicalizer recognizes it.

The existing profile editor uses the shared status options, does not expose barrier editing, and does not submit or overwrite the barrier column. It remains unrestricted for existing members. There is no database constraint or migration that imposes a new requirement on historical accounts. Existing historical text remains stored; analytics must apply current-status eligibility.

Validation: lockfile install (`npm ci`); all **150 tests** passed, including mocked tests of the real signup action before auth side effects and metadata payload persistence; ESLint; production build; localhost browser QA on `/register` for Yes/No/Not yet/not-sure, empty-required blocking, new-option ordering and submitted payload, and answer changes. Browser QA intercepted signup requests and used a dummy local Supabase URL, so it created no production accounts and sent no notifications. No console/page errors or framework overlays occurred. Screenshot: `background.png`.

Browser QA reproduction (Playwright installed outside the application lockfile):

```sh
npm install --prefix /tmp/ipn-barriers-browser-qa playwright
node /tmp/ipn-barriers-browser-qa/node_modules/playwright/cli.js install chromium
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:45999 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-fixture npm run dev -- --port 3147
# In another terminal:
IPN_QA_PLAYWRIGHT_MODULE=/tmp/ipn-barriers-browser-qa/node_modules/playwright/index.mjs node docs/registration-barriers/browser-qa.mjs
```

Caveats: production build reports the existing Next.js middleware deprecation. Lockfile installation reports nine existing dependency vulnerabilities; this change does not modify dependencies. Actual external signup/database writes were intentionally replaced by fixtures, with the production trigger inspected read-only. Authenticated profile editing was inspected in code rather than browser-tested against a production account. No push, PR, merge, or deployment was performed.
