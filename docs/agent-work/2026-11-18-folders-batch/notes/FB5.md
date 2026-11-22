# FB5 -- Custom order: Move up/down, dragging, auto-switch to Custom (board T323)

Worker: agent-acbd (Claude Opus), 2026-11-19. Status: CLAIMED (Chromium browser preview only; nothing native, no WebKit).

## Follow-ups done first (coordinator)
- **(a) Grouping.** A folder's body is indented one `--slot` per nesting level (subfolders AND projects, list rows and card grids). New layout primitive `.indent` in `src/components/layout.css` (`padding-inline-start: var(--slot)`, start side only, nests additively) -- no existing primitive gave a one-sided container inset and `folders.css` has budget 0. Documented as a row in the primitives table of `docs/design-system.md`. Headings no longer carry their own `--depth` inset (`--edge: 0px`; the `depth` prop and `--depth` are removed), so nothing is indented twice; the old 24 px subfolder assertion still holds. Nested cards were 240-248 px at depth 1-2 (1100 px window) and wrapped their dates onto two lines, so `folders.css` caps a folder's card grid only: `.folder-body .project-list--cards { grid-template-columns: repeat(auto-fill, minmax(230px, 256px)) }` -- its cards keep the top level's 256 px and a narrower grid holds fewer of them. The top-level grid (`styles.css`, FB1) is unchanged (an earlier global cap was reverted: it would have dropped the top level to two fixed cards below an 800 px page).
- **(b) Row rhythm.** A list container that has rows closes with a 1 px `--line` bottom border (`folders.css`, `.project-list--list.folder-projects:has(> .project-row)`), drawn by the container so every row keeps the same height. Root, folder and search lists alike.
- **(c) Loading safety.** `parseLibrary` keeps the folders when `placement` / `order` is missing or not an object (those read as empty). A library object whose `version` is not `1` (including a missing version) now THROWS the exported `LibraryVersionError`. This changes FB3's "never throws" contract: `null` and non-objects still read as empty. Callers: `useLibrary` parses inside the read promise, so an unknown version takes the existing read-error path ("Folders could not be loaded.", `update` a no-op, nothing written). `App.tsx` `create` needs no edit: its existing try/catch turns the throw into "Folders could not be saved." and no write.

## FB5 files changed
- `src/library/libraryDrag.ts` (new, pure): `dropTarget(point, rects, view, dragged)` per plan step 3. A project over its own folder's heading returns null.
- `src/library/libraryDrag.test.ts` (new): one test per rule.
- `src/library/useLibraryDrag.ts` (new): delegated `onPointerDown` on the tree, 4 px threshold, window pointer listeners, rows re-measured on every move, Escape / pointercancel cancel, the release click swallowed (also after an Escape cancel). No live shifting; the lifted row stays put at 50 % opacity. Presses on `.delete-entry`, `.folder-chevron`, inputs never start a drag.
- `src/components/ProjectLibrary.tsx`: `canReorder = ready && !needle` gates every path (menu items disabled, chord no-op, drag disabled). `toCustom()` then one `update()` per move (file + place in one write). Move up / Move down in both menus (disabled at the ends); Option+Up/Down on a row or heading (focus kept, polite `role="status"` announcement as in the sidebar: "Moved X to position n of m", "X is already first|last"). Drop into a folder appends at the end of that folder's on-screen order. Drag attributes: `data-drag-state="lifted"` on the source row / heading, `data-drag-edge="start|end"` on the target row or on a target folder's whole `section` (so "after" reads as after its contents), `data-drop-into` on a target heading, `data-drag-axis="x"` on card grids, `data-dragging` on the tree. `folder-body` gets `.indent`.
- `src/library/LibraryFolders.tsx`: `lifted` / `dropInto` props; imports `drag-reorder.css`; `depth` removed.
- `src/library/folders.css`: drop-line edges (reusing drag-reorder.css's 2 px `::after`), lifted opacity, grabbing cursor, drop-into name/count in `--accent` (no fill), list closing rule; still 0 spacing declarations.
- `src/library/folders.ts`, `src/library/folders.test.ts`, `src/library/useLibrary.ts`: follow-up (c).
- `src/components/layout.css`: `.indent` (registered on T323). `docs/design-system.md` (region): `.indent` row.
- `tests/fb-folder-order.spec.ts` (new): plan cases (a)-(i) plus Escape cancel and "off while searching"; `FB4_SHOTS=1` list-drag screenshot. `tests/fb-folders.spec.ts`: three new cases (unknown version, indentation, closing rule); the Move-up assertion restated as "disabled at the ends"; the Move to folder case sets a 1280 x 900 viewport (see below); screenshot dir follows `FB_SHOTS_DIR`.

## Fail-first
- `npx vitest run src/library/folders.test.ts` before (c): `FAIL keeps the folders when placement or order is missing or not an object -- expected [] to equal [folder f]`; `FAIL refuses a library of an unknown version ... -- expected [Function] to throw an error`; `Tests 2 failed | 9 passed (11)`.
- `tests/fb-folders.spec.ts` new cases before the fixes: indentation `✘ list: a project in a folder starts right of a top-level project. Expected: > 260 Received: 240`; closing rule `✘ <folder id>: closing rule. Expected: 1 Received: 0`; unknown version (throw temporarily disabled) `✘ toContainText "Folders could not be loaded." -- element(s) not found`.
- `npx vitest run src/library/libraryDrag.test.ts` before `libraryDrag.ts` existed: `Error: Cannot find module './libraryDrag'`.
- `tests/fb-folder-order.spec.ts` case (a) with reordering switched off (`canReorder` temporarily forced false): `✘ (a, i) ... expect(locator).toHaveAttribute Expected: "lifted" Received: ""` -- the row never lifts and nothing moves.

## Passing
- `npx tsc -b` clean. `npx vitest run src/library/libraryDrag.test.ts src/library/folders.test.ts src/layoutPrimitives.test.ts src/hoverEmphasis.test.ts src/motion.test.ts src/designTokens.test.ts src/libraryPreferences.test.ts` -> 7 files, 63 passed.
- `tests/fb-folder-order.spec.ts` -> 10 passed, 1 skipped (screenshot case without FB4_SHOTS).
- One locked run (`--workers=1`), with the global card cap still in: `fb-folder-order fb-folders projects-screen fb-projects-meta fb-sort-menu sb-motion-projects w9-projects-page alignment w9-icon-magnify drop-target layout-invariants` -> `152 passed, 8 skipped (5.5m)` (layout-invariants T5 included, passing).
- After moving the card cap to nested grids only: `npx vitest run src/layoutPrimitives.test.ts src/motion.test.ts` -> 20 passed; `fb-folders fb-folder-order fb-projects-meta` (FB4_SHOTS=1) -> `28 passed (1.3m)`.

## Screenshots (Color palette for the folder shots; 1100 x 900; drag shots light, Plain)
`test-results/fb-FB5/projects-folders-{list,cards}-{light,dark}.png`, `test-results/fb-FB5/drag-list-light.png` (Delta dragged to the bottom of Bravo: 2 px accent line under Bravo, Delta dimmed), `test-results/fb-FB5/drag-cards-light.png` (Charlie dragged to the right half of Alpha: vertical accent line on Alpha's right edge). Made with `FB4_SHOTS=1 FB_SHOTS_DIR=test-results/fb-FB5 npx playwright test tests/fb-folders.spec.ts tests/fb-folder-order.spec.ts -g "screenshots|\(f\)" --output test-results/fb-FB5-run`.
Looked at: nested cards wrapped their dates onto two lines and had three different widths -> fixed by the 256 px card track. List view now reads: heading, its indented rows closed by a rule, a gap, the next group.

## Not verified / notes
- Native app and macOS WebKit not run; pointer drag only through Playwright's mouse in Chromium. Touch / pen not tried.
- `fb-folders` "Move to folder files a project": at 1280 x 720 the indented cards make the page 2 px taller than the window; Playwright scrolls a menu row into view before clicking, and ContextMenu closes on any list scroll, so the second menu vanished. Not a product change: the test now uses a 1280 x 900 viewport. A real scroll while a context menu is open still closes it (FB4 behaviour).
- The pageMotion "stop and ask" did not arise: the Projects <-> document animation starts only from a row click, and a drag swallows that click.
- "Into" a folder switches the sort to Custom too (DoD: dragging switches) and appends the project at the end of that folder.
- Gap: a project cannot be dragged back to the top level when the top level has no rows (no drop target); Move to folder… -> Top level does it.
- Full browser suite not run (FB14).

## Review repair (agent-2fc2, Claude Sonnet, 2026-11-19; REVIEW-3)
- **Fix 1:** `ProjectLibrary.tsx` `closeMenu` restores focus with `focus({ preventScroll: true })`. The only other focus-restores in the menu flow (`focusLater`, rename/search/create) run after a move or a close that is not followed by a menu opening, so they were left alone.
- **Fix 2:** `tests/fb-folders.spec.ts`: removed the 1280x900 viewport from "Move to folder files a project...". New test "Move to folder works on the first mouse try when the card is partly below the fold": 1280x560, cards view, window resized so the Gamma card is cut off 6 px by `main.library`, then a real mouse by coordinates: right-click, "Move to folder...", destination, and Gamma lands in Essays.
- **Fix 3:** a drop onto a folder heading now only files the project (`fileProject`, like "Move to folder..."), so it appears first in that folder; it still switches the sort to Custom. `fb-folder-order` case (e) gained a check: Bravo dropped on the Essays heading gives `["Bravo", "Delta", "Alpha"]`.
- **Fail-first (before Fix 1):** `✘ Move to folder works on the first mouse try ... expect(getByRole('menu')).toBeVisible() failed ... element(s) not found` at the line after clicking "Move to folder...".
- **Passing:** `npx tsc -b` clean; `npx vitest run src/library` passed; `npx playwright test tests/fb-folders.spec.ts tests/fb-folder-order.spec.ts tests/projects-screen.spec.ts --workers=1` -> 68 passed, 2 skipped (screenshot cases without FB4_SHOTS).
- Fix 3's new assertion in (e) was not run separately against the old append-last code (the old code would give `["Delta", "Alpha", "Bravo"]`).
