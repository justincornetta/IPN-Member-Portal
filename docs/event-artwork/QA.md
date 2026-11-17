# Event artwork: implementation and verification

Implements Justin's approved flush artwork concept: event art meets the module's left, top and bottom edges on wide desktop cards, with the title and actions beside it. Smaller cards stack the complete image above the details and controls.

## Scope

- Shared 2:1 event artwork frame: dashboard, full/featured/compact event cards, member detail (which reuses EventCard), public detail and related thumbnails.
- Desktop composition starts at a card width of 68rem. Its artwork column is 28rem wide, yielding a 14rem-tall 2:1 frame. Extra-long registration explanations, errors and cancellation confirmation use the stacked layout rather than squeezing controls.
- Event uploads preserve the original bytes and supported image format. JPEG, PNG, WebP and GIF are supported up to 900KB, below the default Server Action request limit including multipart overhead. Other aspect ratios fit on a neutral background.
- Recording, resource and conference upload/crop settings remain 16:9. Recording detail and recording cards are unchanged.
- No event records, live artwork, database schema, permissions or Mailchimp campaigns are changed.

Reference image used in the approved design: https://mcusercontent.com/7c3bc2754f93c026395a7a78e/images/2b610b9b-43f7-d344-c207-3bd9f98bf20b.jpg

## Completed checks

- Production build with placeholder integration settings: passed.
- TypeScript checking: passed.
- ESLint on changed application files: passed.
- `git diff --check`: passed.
- Targeted event-artwork upload and existing onboarding/event tests: 26/26 passed. Tests cover original upload bytes, matching MIME/extension, unchanged non-event JPEG uploads, authorization/storage errors and file validation.
- Full Node regression suite: 276/279 passed. The three failures also reproduce on an unchanged `main` worktree: directory-map toolbar wording, Instagram snapshot account mismatch and newsletter-cover tests.
- Independent code review: GO after fixing secondary action groups, long dashboard locations, fallback thumbnail padding and upload size validation.

## Pending visual and interaction gate

Browser rendering is blocked in this execution environment. System Chromium cannot create the required Unix socket; Playwright's headless-shell download returned an invalid archive. No production UI screenshots are claimed as evidence.

Before merge, verify in the deploy preview or a normal development browser using fictional content:

- Dashboard and Events at 390, 768, 1024 and 1440px; no horizontal overflow and readable/tappable actions.
- Original 1200×600 artwork, portrait/square legacy art and missing-image fallback; no crop or stretch. Normal desktop artwork must meet all three card borders, including registered/chat-enabled states and long titles.
- Member/public detail, related thumbnails and featured/compact cards.
- RSVP confirmation, calendar picker, cancellation confirmation, external registration and join controls; dialogs must cover the viewport normally.
- Event upload and pasted-URL preview; the original source remains intact, oversized/unsupported uploads show useful errors, and failed uploads retain the previous image.
- Recording/resource uploads still open the 16:9 cropper.

**Status: code review passed; rendered visual/interaction QA pending. Keep this PR unmerged until that gate is complete.**
