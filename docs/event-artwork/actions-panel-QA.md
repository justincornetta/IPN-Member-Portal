# Event action-panel cleanup (local follow-up to PR #84)

## Request and scope

Justin annotated the registered Office Hours card's right-hand action panel: clean up the cramped, visually equal button grid. The supplied state is the before-state evidence. The deploy preview redirects to sign-in in the Codex side browser.

Changes are limited to EventCard's actions and their scoped CSS. Artwork, event details, dashboard control sizing, server actions and availability/permission helpers are unchanged.

## Result

- Plain checked registration status replaces the detached teal pill.
- Join event / RSVP / View event is the clear primary action; Add to Calendar is a consistently aligned secondary control.
- Unavailable chat is quiet status text. Available chat and Cancel RSVP use quiet secondary controls.
- The existing cancel confirmation remains a separate explicit confirmation; no cancellation happens on the first click.
- The native disabled Join button and exact 24-hour gate remain. A missing join URL also stays disabled and has an honest hint.
- Main controls have 44px targets. Quiet mobile controls have 44px targets; desktop utilities are compact without the old cramped two-column grid.

## Checks completed

- Rendered real EventCard markup with integration components replaced only at test boundaries: registered/join soon, join at the exact 24-hour boundary and just outside it, join available, missing join URL, unregistered, compact, active chat, attendance count and external ticket registration.
- 32 targeted tests passed (six action-state tests plus existing upload and event/onboarding tests).
- Full regression suite: 282/285 passed; the same three previously confirmed main failures remain (directory-map wording, Instagram snapshot account mismatch, newsletter covers).
- TypeScript, changed-component ESLint and whitespace checks passed.
- Production build passed. Built CSS contains the portal color tokens used by the new action styles.
- Independent code review: GO. Registered/count/join-soon vertical budget was checked and the desktop gaps tightened; no art/details changes were needed.

## Visual/interaction limitations

Actual desktop/mobile screenshots and click-based smoke tests remain pending. The deploy preview is signed out in the Codex side browser. The local fixture server starts, but the side browser cannot reach it through the preview relay (Site Unavailable; alternate relay endpoint blocked). No personal Chrome tabs were used.

A self-contained static review HTML file shows before/after markup and styles from the real components for registered join-soon, join available, unregistered, compact and active-chat/count states. It responds to window width, contains the exact source image, and has no connected live actions. It is a review aid, not proof of browser visual QA.

Before approval to push, review the static file. Before merge, capture and inspect actual desktop/mobile states and check calendar, RSVP, cancel confirmation, active chat and Join behavior against the existing gates.

## Publishing status

Local branch: `fix/event-actions-panel`, based on PR #84's `ce8a4a0` head. No follow-up changes pushed, no PR metadata changed, no merge or production deployment performed. Publishing requires Justin's review and approval under AGENTS.md.
