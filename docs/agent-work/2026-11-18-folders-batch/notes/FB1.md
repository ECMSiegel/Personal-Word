# FB1 -- Projects meta layout: fixed columns in list, two-by-two in cards

Board: T319. Owner: agent-2f5c (OpenCode). Date: 2026-11-19. Status: done, awaiting review.
Nothing committed.

## What changed

- `src/components/ProjectLibrary.tsx` (the `span.project-dates` block only): gave the Added span the
  class `project-added` and moved it in front of the counts, so the DOM order inside
  `span.project-dates` is now `project-edited`, `project-added`, `project-words`,
  `project-sections` -- the contract FB2/FB4 keep.
- `src/styles.css` (three regions only, by the Edit tool):
  - base `.project-row > button:first-child > .project-dates`: `display: flex` -> `display: grid`
    (gap, justification, flex, font size and colour unchanged).
  - list: new `.project-list--list .project-row > button:first-child > .project-dates` with four
    fixed tracks `10.5em 7em 7em 10.5em`, `white-space: nowrap`, `text-align: right`. Each span is
    placed by its own class (`grid-row: 1; grid-column: 1..4`) so a project with no counts leaves
    its two tracks empty instead of pulling Added into the words column. Visual order is edited,
    words, sections, added even though the DOM order differs.
  - cards: `.project-list--cards .project-row > button:first-child > .project-dates` with
    `grid-auto-flow: column; grid-template-rows: auto auto; grid-template-columns: 1fr 7.5em`:
    column 1 is Edited over Added, column 2 is words over sections, and the fixed 7.5em track puts
    every card's numbers in the same place. The old `flex-wrap` rule and both `!important`s are
    gone.
  - `@media (max-width: 700px)`: both views become two columns x two rows (edited|words on line 1,
    added|sections on line 2), still inside `max-width: 160px`; `gap: 3px !important` kept.
- `src/components/library.css`: registered on the task, no change needed -- its
  `.library .project-dates .project-edited { color: var(--text) }` rule still applies.
- Tests:
  - `tests/fb-projects-meta.spec.ts` (new, 2 cases): seed three projects with very different titles,
    dates and counts; list view asserts each of the four spans has the same left edge (+-1 px) on
    every row, the visual order left to right is edited < words < sections < added, all rows are the
    same height, and each cell's text fits inside its own column; card view asserts Added sits
    directly below Edited and sections directly below words, the two line pairs line up, and every
    card has identical field offsets.
  - `tests/w9-projects-page.spec.ts`: the counts case now asserts the visual order per view instead
    of DOM order (nth(1) used to be words; Added is now second in the DOM).
  - `src/projectLibraryCounts.test.ts` (added to the task with `files add`; unowned before): asserts
    the new DOM order and the `project-added` class.
  - `tests/layout-invariants.spec.ts` (region edit only, never registered): the rightmost dates cell
    in list view is now `.project-added`, not `:last-child` (which is now sections).

## Fail-first

Run with `src/styles.css` and `src/components/ProjectLibrary.tsx` temporarily restored from
`HEAD` (scratch copies kept under `node_modules/.cache/personal-word-beta/fb1/`, restored
immediately afterwards; sha256 checked equal to the working copy).

```
npx playwright test tests/fb-projects-meta.spec.ts --workers=1
  ✘ list view: the four fields sit in fixed columns on every row and no row wraps
    Error: project-edited left edge 549.140625, 544, 582.1875
  ✘ card view: Edited over Added and words over sections, the same offsets on every card
    TypeError: Cannot read properties of undefined (reading 'left')   // no project-added class yet
  2 failed
```

Log: `node_modules/.cache/personal-word-beta/fb1/failfirst3.log`.

## Passing

```
npx playwright test tests/fb-projects-meta.spec.ts tests/w9-projects-page.spec.ts tests/projects-screen.spec.ts --workers=1
  57 passed (1.7m)          # log: node_modules/.cache/personal-word-beta/fb1/pass3.log

npx playwright test tests/projects-screen.spec.ts -g "drop outline does not flicker" --workers=1
  1 passed (3.7s)           # ran alone: it failed once inside the 3-file run with
                            # "JSHandles can be evaluated only in the context they were created!",
                            # a race in the test, not the dates layout. Log: fb1/drop.log

npx playwright test tests/layout-invariants.spec.ts -g "Projects page" --workers=1
  6 passed (33.3s)          # log: fb1/layout.log

npx vitest run src/projectLibraryCounts.test.ts src/layoutPrimitives.test.ts
  6 passed, 2 files         # layout budget unchanged (only properties it counts were kept equal
                            # or removed: cards lost one gap declaration, base kept one, media
                            # query kept one)
```

## Not verified / limits

- The no-counts case (`wordCount`/`sectionCount` undefined) cannot be produced in the browser
  preview: `storage.list()` always fills both through `projectCounts`, so only the native app can
  reach it. Fixed tracks make a collapse impossible, but no running app proved it.
- Chromium only; nothing checked in native WebKit.
- `npx tsc -b` currently fails on another live task's files (`src/storage.test.ts` -- FB3 in
  progress). No error names a file of this task; re-run it after FB3 lands.

## Deviations from the plan text

- Placed the four spans with explicit `grid-row`/`grid-column` per class instead of relying on
  `order`/auto-placement: with auto-placement, a project without counts would slide Added into the
  words column. Cards keep `grid-auto-flow: column` exactly as written.
- Words and sections both use a 7em track (the plan started from 7em / 6.5em): at 12 px
  "999 sections" did not fit 6.5em.
- Kept `flex: 1` on `.project-dates` as it was; only `display` changed on the base rule.
