# REVIEW-3 -- FB5 (T323): custom order on the Projects page, plus follow-ups (a)-(c)
Reviewer: Claude Opus reviewer (agent-68d0), 2026-11-19. Read-only: no source or test file was edited.
Tree: main @ 3ac28af plus uncommitted work. Only T323's files were judged.
Browser runs used the dev server, under the serial lock, with `--workers=1` and the pinned Node.
Two throwaway probe specs ran from the scratchpad, outside `tests/`, through their own config.

## Verdict: REJECTED (one medium; small fix)

The custom-order feature itself is sound and every requested check passes. The one medium is the
fourth deviation: the `fb-folders` viewport change to 1280x900 hides a real defect, which a real
mouse reproduces in a short window.

## Evidence (run by the reviewer)
- `npx tsc -b`: clean.
- `npx vitest run src/library src/layoutPrimitives.test.ts src/hoverEmphasis.test.ts src/designTokens.test.ts src/libraryPreferences.test.ts`: 6 files, **46 passed**.
- `npx playwright test tests/fb-folder-order.spec.ts tests/fb-folders.spec.ts tests/fb-projects-meta.spec.ts tests/fb-sort-menu.spec.ts tests/projects-screen.spec.ts tests/w9-projects-page.spec.ts --workers=1`: **84 passed, 2 skipped** (the two screenshot cases without FB4_SHOTS), 2.8 m.
- `npx playwright test tests/layout-invariants.spec.ts -g "Projects|T5" --workers=1`: **7 passed**.
- Probe 1 (8 cases ran; 7 count, see below):
  - A failed read (`{not json`) and a version-2 library: Move up and Move down are `aria-disabled`, Option+Down does nothing, a drag marks nothing, the sort is unchanged, the stored value is byte-identical, the page renders.
  - A hand-made order exists, the owner switches to Name, then presses Option+Down: the sort becomes Custom and the container's order becomes Name order plus the move. The earlier hand-made order (Delta, Charlie, Alpha, Bravo) is replaced. See low 3.
  - Card widths: at 1000 and 1280 px every card is 256 x 120. At 840 px the nested card is 256 x 120, but the top-level cards are 243 x 150 (their dates wrap). See low 5.
- Probe 1's keyboard case (D) landed on "Delete folder", because the arrow keys skip disabled items. That case is void; probe 2 replaced it (End, ArrowUp, Enter reaches "Move to folder…" and works at 720 and 560 px).
- Probes 2 and 3 (the menu and scroll question): see Medium 1.

## Owner's rule for custom order
1. Any drag or Move up/down switches the sort to Custom: yes. `toCustom()` runs before every move (menu, Option+arrows, drag, drop into a folder). Spec cases (a), (d), (e), (f), (g), (h).
2. Switching from another sort to Custom shows the hand-made order: yes, spec (b). Caveat: a move made while another sort is showing rebuilds that container from what is on screen (low 3).
3. With no hand-made order, Custom keeps the order of the sort you came from: yes. `changePrefs` records `fallbackSort`, and the reverse flag is kept. Spec (c) also checks that nothing is written.
4. The order survives a reload: yes, spec (a, i) and (h).

## Other checks
- Reordering is off while searching and before the library loads: `canReorder = ready && !needle` gates the menu items, `stepBy`, `applyDrop`, and the hook (`enabled`, which also ends a live drag). Spec plus probe 1.
- A filtered list is never saved: every path is gated, and the search list has no `data-container`, so it has no drop targets.
- A drag never opens a project or toggles a folder. The release click is swallowed on `window` in the capture phase, also after an Escape cancel. Spec (a), (e), (h).
- Escape cancels: spec. Drop onto a heading files the project: spec (e). Cross-folder drop: spec (e). Folders reorder among siblings: spec (h). Keyboard moves keep focus and announce in a polite status region: spec (g), (h).
- Reduce Motion: nothing transitions. The lifted row is only dimmed (opacity 0.5, no transition), and there is no live shifting (spec asserts no transformed row).
- Drop targets: the shared 2 px `--accent` `::after` line, horizontal in lists and vertical in card grids. A heading under a project turns its name and count `--accent`, with a transparent background (spec). No fill.
- Follow-up (a): every folder body is `.indent` (one `--slot` per level). Subfolders and projects are both indented, in list and card view. A top-level chevron's ink lines up with top-level titles within 2 px (spec).
- Follow-up (b): list rows are an even 52-53 px (`expectEvenRows`). Each list container closes with a 1 px `--line` drawn by the container.
- Follow-up (c):
  - `parseLibrary` keeps folders when `placement` or `order` is missing or not an object (unit-tested).
  - A non-1 version (or a missing one) throws `LibraryVersionError`. Its only callers handle the throw:
    - `useLibrary` parses inside the read promise, so the throw becomes the read-error path. `update` stays a no-op for the session.
    - `App.create` calls `parseLibrary(await storage.readLibrary())` inside a try, so a throw means "Folders could not be saved." and no write.
  - `writeLibrary` has only two writers: `useLibrary.update` and that same `App.create` block. A throw cannot crash the page or lose data (spec and probe 1).

## Deviations
1. **`.indent` primitive**: accepted.
   - It is one declaration, `padding-inline-start: var(--slot)`, so it uses tokens only.
   - It is documented in the primitives table of `docs/design-system.md`.
   - It does not collide with any existing class.
   - `src/layoutPrimitives.test.ts` still guards the budget: it passes, and `folders.css` still counts 0 spacing declarations.
2. **parseLibrary throws**: accepted. Every caller handles it (above). The FB3 interface line "never throws" in PLAN.md is now stale. notes/FB5.md records the change; FB14 should update the plan or architecture doc.
3. **Nested card grids capped at 256 px**: accepted. Nested cards match the top level at 1000 px and up. Below about 860 px, the top-level cards (FB1's `minmax(230px, 1fr)`) shrink to 243 px and wrap their dates, while nested cards stay 256 px (low 5). This is not a regression from FB5.
4. **`fb-folders` "Move to folder" test set to 1280x900**: this **hides a real defect** (Medium 1).

## Findings

### Medium
1. **Choosing "Move to folder…" can close its own destination menu.**
   - Steps (Chromium, by mouse coordinates, so Playwright scrolls nothing):
     1. Use a 1280x560 window in card view.
     2. Right-click the Gamma card, whose bottom 6 px are cut off by `main.library`.
     3. Click "Move to folder…".
   - The destination menu is gone at once: a scroll event on `main.library` fired while the menu was focused.
   - Cause:
     1. `ContextMenu.choose` calls `onClose(true)`, then `run()`.
     2. `closeMenu` in `ProjectLibrary.tsx` (line 165) restores focus with a plain `.focus()`.
     3. That focus scrolls the partly hidden row into view.
     4. The new menu's "any scroll closes" listener then fires.
   - Probe 3 confirmed the cause and the fix:
     - Without a patch, the first try fails: `main.library` scrolls 0 -> 5 px, and the menu is gone. A second try on the same card works, because the card is now in view.
     - With `HTMLElement.prototype.focus` patched to always pass `preventScroll: true`, the first try works (scrollTop stays 0, all three destinations show).
   - The same click works at 720 px, where nothing is cut off. The keyboard path works when the row is already in view.
   - The mechanism dates from FB4. This is the likely cause of REVIEW-2 low 6.
   - **Contradiction:** the worker says FB5's indented cards made the page 2 px taller than a 1280x720 window. In this reviewer's runs at 1280x720:
     - nothing scrolled (no overflowing scroller);
     - the old locator-click path of the test kept its menu.
     The 1280x900 change may not be needed on today's tree. Either way, it hides the defect class rather than testing it.
   - User impact: on a long list, the first "Move to folder…" on a half-visible last row silently does nothing, and only a second try works.

### Low (left for the owner or a later pass)
1. **Drop on a folder heading puts the project last.** "Move to folder…" and new projects land first (unlisted ids go first in `orderedProjects`). This is inconsistent, but each is defensible. Dropping just under the heading (first) would match the menu, but this is the owner's call and not needed now.
2. **No drag back to an empty top level.** When every project is in a folder, the root container has no rows and so no drop target. "Move to folder… > Top level" still works, and the gap is documented. A later fix could make the empty root box (or the space after the last folder) a drop zone. Not needed now.
3. **A move made under another sort replaces that container's earlier hand-made order** (probe 1). This follows plan step 1 to the letter (the order on screen plus the move), and other containers keep their hand-made orders. Ask the owner whether that matches "returns to the custom order you set up prior".
4. A version-1 object whose `folders` is not an array still reads as empty and stays writable. This is the remaining edge of REVIEW-2 low 3.
5. At about 840 px or narrower, top-level cards (243 px, dates on two lines) differ from nested cards (256 px, one line). This comes from FB1's top-level grid.
6. Cosmetic, list view: a group's closing rule and the next group's top rule are about 25 px apart and start at different x. Under Drafts this stair-steps. It reads as grouping, not as a defect.
7. Starting a drag on a folder name (a plain `span`) may begin a text selection in WebKit before the 4 px threshold. Unverified; Chromium only.
8. `App.create` re-reads `library.json` while `useLibrary`'s write chain could still be pending, so an in-flight earlier write could land after the filing write. Very unlikely given the create flow's own awaits. From FB4.
9. Native WebKit, a real `library.json` and touch or pen input were not checked.

## Screenshots (`test-results/fb-FB5/`, all six looked at)
- **List, light and dark.** Flat, square, no fills.
  - Essays (purple icon) holds Drafts one slot in, and Delta essay sits one more slot in.
  - Alpha draft (in Essays) is one slot in, clearly separate from the top-level Loose project and Gamma, which sit at the page edge under the top-level chevrons.
  - Rows are an even 52 px, the meta columns line up at every depth, and each group closes with a rule.
  - Grouping is unambiguous. The only oddity is the stair-stepped double rule between groups (low 6).
- **Cards, light and dark.** Every card is 256 px wide with dates on one line. The nested stacks step 24 px per level. Grouping is readable but subtler than in the list: Alpha draft's card sits only 24 px left of Delta essay's. Nothing is cramped or clipped.
- **drag-list-light.** Delta is lifted (dimmed, its title accent from the existing pressed style in `styles.css`). A 2 px accent line sits under Bravo, and nothing else moves.
- **drag-cards-light.** Charlie is dimmed, with a 2 px vertical accent line on Alpha's right edge.

## Fixes required (minimal)
1. In `src/components/ProjectLibrary.tsx` `closeMenu`, restore focus without scrolling: `?.focus({ preventScroll: true })`. Alternatively, skip the restore when the chosen item opens the "Move to folder…" menu.
2. In `tests/fb-folders.spec.ts`:
   - Put back the default viewport for "Move to folder files a project…".
   - Add a short-window regression that drives a real mouse by coordinates: at 1280x560 in card view, right-click a card partly below the fold, click "Move to folder…", then expect the destination rows to be visible.
   - Show it failing on the current tree first.
