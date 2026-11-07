# Directory option 1 — local design QA

**GO for local review, November 7, 2026. Justin approved publication; review continues in PR #79 before any merge.**

Target: [selected ImageGen option 1](docs/directory-cards/selected-option-1.png). Implementation uses the existing light portal theme and IPN purple, as selected by Justin. The generated board is a visual direction, not a pixel-exact screenshot of the existing navigation shell.

| Comparison | Result | Evidence |
| --- | --- | --- |
| Desktop horizontal cards, three columns, avatar/identity hierarchy | Pass at 1440 and 1280; long content grows naturally | [1440](docs/directory-cards/screenshots/directory-1440.png), [1280](docs/directory-cards/screenshots/directory-1280.png) |
| Mobile compact rows, no badge squeezing names | Pass at 390 and 320; full names wrap | [390](docs/directory-cards/screenshots/directory-390.png), [320](docs/directory-cards/screenshots/directory-320.png) |
| No interests on cards, interests still discoverable | Pass; profiles and filters retain them | [Profile](docs/directory-cards/screenshots/profile-390.png), [filters](docs/directory-cards/screenshots/review-filters-390.png) |
| Realistic long/sparse content | Pass; no clipping or horizontal document overflow | [Long name](docs/directory-cards/screenshots/long-name-390.png) |
| Navigation, footer and role clarity | Pass in simulated admin shell; full-scroll and expanded Admin reviewed | [Admin](docs/directory-cards/screenshots/review-admin-1280.png), [mobile Admin](docs/directory-cards/screenshots/review-mobile-admin.png) |
| Connect continuity and keyboard behavior | Pass; 125 rows retained, scroll/focus restored, modal remains open through action | [Request sent](docs/directory-cards/screenshots/request-sent-390.png) |

Intentional differences from the concept: existing portal shell and tabs retained; List/Map remains available on mobile; initials illustrate members without photos; no fabricated membership totals; complete long names/affiliations can increase row height. Profile interests remain plain readable text. No new production status banners or developer controls were added.

One independent product-design reviewer inspected the actual local browser at all four widths, top/middle/bottom scrolling, card alignment, typography, sparse/long content, Filters, expanded Admin and modal focus. Verdict: GO, no P1/P2 blockers. Functional/browser coverage and fixture limitations are recorded in [the implementation notes](docs/directory-cards/README.md).
