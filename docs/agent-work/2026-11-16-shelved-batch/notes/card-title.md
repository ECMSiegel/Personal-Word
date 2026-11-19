# Cards view: long project title overflow

Cause (verified): in src/styles.css `.project-list--cards .project-row > button:first-child` had
`align-items: flex-start` in a column flex, so `.project-name` was sized to its text and its
existing ellipsis never fired. After stretch alone the title stayed inside the card but still ran
under the trash button (button padding-right 24px; trash spans 8..40px from the card edge), so a
second line was needed.

## Change (src/styles.css, card rules only)
1. `.project-list--cards .project-row > button:first-child`: `align-items: flex-start` -> `stretch`.
2. New rule after it:
   `.project-list--cards .project-name { max-width: calc(100% - var(--space-5)); }`
No margin/padding/gap/height added; layoutPrimitives passes (3/3). Dates line unchanged
(it already wrapped and was flex-start justified; w9 "row titles ... cards keep the order" passes).

## Test
tests/w9-projects-page.spec.ts: "in cards view a very long title stays inside its card and clear of the trash button" (110-char title, cards view, card hovered).

Fail-first (before any CSS change):
  Expected: <= 496   Received: 913.390625   (title right edge vs card right edge)
After step 1 only: card edge check passed, trash overlap check failed (overlapsTrash true).
After step 1 + 2: w9-projects-page 10 passed; projects-screen 43 passed; layoutPrimitives 3 passed.

Note: one earlier projects-screen run (after step 1 only) had 2 failures in the create-menu morph
tests (192, 311); they passed on the rerun with the final CSS, so they look timing/load related, not card related.
