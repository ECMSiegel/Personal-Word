# OB5 notes (T339, agent-1be2, Claude Opus)

Status: CLAIMED (Chromium preview build only; not checked in the Mac app's WebKit).

## Changed
- `src/library/useLibraryDrag.ts`: rewritten. It now measures `.outline-row[data-key]` and calls `outlineDropTarget` (OB5a). `listBottom` is the bottom of the lowest drawn row. The `view` parameter is gone. The new parameter `info(key) => DragRowInfo` (OB5a's `RowRect` without `rect`) comes from `ProjectLibrary`, so the DOM supplies only boxes; container, depth, ancestors, expanded-with-rows and pinned-band facts come from the model. A press on a pinned band row never starts a drag. Threshold, Escape, pointercancel and the click swallow are unchanged.
- `src/library/libraryDrag.ts` and `libraryDrag.test.ts`: deleted with plain `rm` (nothing imported them any more).
- `src/components/ProjectLibrary.tsx` (only the agreed regions):
  - `stepBy` is gone. `stepItem`, `stepProject`, `stepFolder` and `stepItems` now use `placeBeside` with the neighbouring on-screen sibling (folders and projects together).
  - `applyDrop` is rewritten.
  - `useLibraryDrag` is called with `enabled: canReorder` (ready and not searching).
  - `dragAttrs` is spread into `renderRowProps` `attrs`.
  - Two helpers were added inside the region: `opened`/`layout`/`shownIn`, and `containerOfKey`.
  - The `toCustom` comment now states rule A.
  - Imports: `moveProject` and `reorderFolder` are no longer imported (still exported by folders.ts, unused by the page). Added `itemKey`, `parseKey`, `placeBeside`, `ItemKey` and `LibraryState`.
- `src/library/outline.css`: rows `position: relative`. The drop line starts at `calc(var(--depth) * var(--slot))`. The end line starts at 0. `[data-drop-into] .folder-name` uses the accent colour. No spacing declarations, budget untouched (still 0).
- `Outline.tsx` was not changed: everything goes through `attrs`.
- `tests/ob-drag.spec.ts` (new, 15 tests + 1 screenshot test behind `OB5_SHOTS=1`).
- `tests/fb-folder-order.spec.ts` (rewritten).

## How it works
- **"Shown"** (`shownIn(container)`): the container's order in the current sort, as `buildOutline` draws it, with every folder treated as open. A collapsed folder therefore has a would-be order, so "into" lands first and does not land last. Rows lifted into the pinned band are left out (`pinned` rows with depth 0); the children of a pinned folder, deeper in the band, are counted.
- **Drop** (Decision 4):
  - before/after: target container = the target row's container, neighbour = that row.
  - into: target = the folder, side before, neighbour = the head of the list `placeBeside` will save (rows not yet saved first, then the saved ones, minus the dragged row; null in an empty folder). That makes it first in the saved order. Anchoring on the first row in the current sort (the plan's "first sibling") put it second when the folder's saved order differed from the sort.
  - end: target = root, neighbour null, side after.
  - When the container changes, `fileProject` or `moveFolder` runs first, then `placeBeside`, inside one `update`. `toCustom()` follows.
  - Only the target container's `items:` key is written. `fileProject` (OB1) also strips the project from other order lists, as it always has.
- **No-op**: same container, and the row's index in shown equals where it would land (before its own next sibling, after its own previous sibling, into its folder when it is already first, end when it is already last at the top level). Nothing is written and the sort stays. Tested.
- **Steps**:
  - The neighbour is `shown[i ± 1]`. Under Folders on top a step that would pass the other kind is refused: a project cannot go above a folder, and a folder cannot go below a project. Both announce "already first/last" and the menu item is disabled.
  - Band rows: `shown` does not contain them, so the step does nothing and both menu items are disabled.
  - The announcement position comes from the result in Custom order, not from the old screen index.
- **Visuals** (attributes on the rows, via `attrs`):
  - `data-drag-state="lifted"` on the dragged row (dimmed by folders.css).
  - `data-drag-edge="start|end"` on the before/after target.
  - `data-drop-into` on the folder row.
  - For "end", `data-drag-edge="end"` + `data-drop-end` on the last drawn row.
  - The root keeps `data-dragging`.

## For OB6 (pins)
- A row counts as a **pinned top row** when it is in `outline.pinned` at depth 0 (`pinnedTop` in `dragInfo`, built in `ProjectLibrary`).
- `data-pinned` is NOT the test: it is also set on a pinned project shown inside a pinned folder, which is an ordinary draggable row there.
- Pinned top rows:
  - cannot be pressed into a drag (hook);
  - never give before/after; a pinned folder gives "into" over its whole height (OB5a);
  - are left out of every container's "shown" order, so Move up/down is disabled on them (already what OB6 step 3 wants).
- The children of a pinned folder in the band are normal rows in that folder: they drag and step.
- If OB6 draws the band differently, keep "in `pinned`, depth 0" true, or change the `pinnedTop` line in `ProjectLibrary`.
- **Side effect:** with no saved order, a drop in a container that holds a pinned row saves the shown order without that row. Unpinned later, it shows first (rows not in the saved order come first, Decision 3).

## Test results
- **Fail-first** (spec written first, untouched tree, fresh build): `node_modules/.cache/personal-word-beta/ob5-failfirst.log`, 10 failed / 2 passed / 1 skipped.
  - Rule A failed (drag inert: no `lifted`).
  - The Move up case shows the old rule's real symptom: Name order with one move, "Alpha, Bravo, Delta, Charlie", instead of the saved order "Delta, Charlie, Bravo, Alpha".
  - The 2 that passed (search off; "already first" for a project under a folder) were already true of the old code.
- **"Into" fix, fail-first**: two "into a folder with a saved order" cases run on the pre-fix build both failed (Alpha landed second), `ob5-into-failfirst.log`.
- **After** (fresh `npm run build`, serial lock, pinned Node, port 1465): `ob5-run2.log`, `ob-drag` + `fb-folder-order` + `ob-outline` + `ob-sort-menu` gave 44 passed, 4 skipped (screenshot tests), exit 0. An earlier run before the "into" fix was `ob5-run1.log` (41 passed).
- `npx tsc --noEmit`: exit 0.
- `npx vitest run` (whole unit suite, before the "into" fix, which touched only ProjectLibrary.tsx): 99 files, 1429 passed. One file fewer because `libraryDrag.test.ts` is gone. Includes the layout budget test. After the fix: `npx vitest run src/library` gave 76 passed.

## Screenshots (looked at): `notes/ob5-shots/`
`before-{light,dark}.png`, `into-{light,dark}.png`, `end-{light,dark}.png`, all at 1100x900.
- **Before**: a 2 px accent line on the top edge of "Essay two", starting at depth 1, so it clearly reads as inside Essays.
- **Into**: "Fiction" in accent, no fill.
- **End**: a full-width line at the top level under the last row (Delta), although the dragged row is nested. In these shots the last row is itself at depth 0; the depth-0 override for a nested last row is checked by a computed-style assertion in the spec (`::after` left 0px).
- The dragged row is dimmed in all of them. Readable in both themes.
- Seen, not changed:
  - The row under the pointer shows the shared hover faux bold and its trash icon (visible in the "before" shots). Hiding them would need a new hover rule, which AGENTS.md forbids, so I left it for the reviewer.
  - The lifted row also shows its own trash icon (it is still hovered or pressed), and its content sits about 4 px right of its siblings while held (the shared press scale on the open button).
  - In the "into" shots, Delta has a focus ring. That comes from the previous Escape in the same test: the key press switches to keyboard focus on the pressed row. A real cancel does the same.

## Differs from the plan / gaps to report
- **Folders on top, cross-kind drops.** A project dropped before or after a folder row (or a folder beside a project) is saved in that place, but the display partitions folders first, so the row shows at the edge of its own block, not where the line was. That is the plan followed literally. Steps refuse the same move, as the plan asks.
- **Rule A can look like nothing happened.**
  - Example: under Name, the saved order is C, B, A and you drag B above A. B already sits before A in the saved order, so the save is unchanged, yet the sort switches to Custom.
  - The no-op rule applies only to drops that are visually in place, as the brief says ("same place"), so this case still switches to Custom and shows C, B, A.
- **A spot you cannot drag to.** "After B, inside folder A" cannot be reached by drag when B is A's last child and B is an expanded folder with rows, because its whole lower part is "into". Workarounds: collapse B first, or use Move down. Decision 10 as written; I did not count it as a stop condition, because the place is reachable.
- **Stale key left by `moveFolder`.** `moveFolder` (OB1, unchanged) does not remove `f:<id>` from the old parent's `items:` list. A moved folder leaves a stale key there; it is harmless, because only children are drawn. I did not clean it, since "never rebuild another container's order".
- **"Into" anchor.** The plan says `placeBeside(..., neighbour = first sibling, "before")`. I anchor on the head of the saved list instead, so "into" really lands first (see Drop above).
- **No `fb-folder-order` case asserted the old "screen order replaces saved order" rule** directly (it seeded no saved order). The stop condition was not met, and no case needed rewriting for that reason.
- **Stale comment in `folders.css`.** Its comment "off until OB5 rebuilds it" is now out of date. It is not my file; OB7 can fix it.
- **Spec cases removed from `fb-folder-order.spec.ts`:**
  - the card case (f);
  - the old `FB4_SHOTS` list-drag screenshot, superseded by the OB5 shots.
- **Spec cases changed in `fb-folder-order.spec.ts`:**
  - case (d) now expects `order["items:root"]` with `p:` keys instead of `order.root`;
  - case (h) now expects the drop line on the Fiction row (there is no section element any more).

## Existing specs I expect may break (for OB7; not edited)
- `tests/fb-folders.spec.ts`: Move up/down disabled states on folder rows now follow Folders on top (a folder above projects has Move down disabled), plus the OB2 selector issues it already has.
- `tests/drag-reorder.spec.ts` and `tests/drop-target.spec.ts`: any Projects-page case built on the old nested drag DOM (already listed by OB2).
- Anything asserting `order.root` / `order["folders:..."]` after a hand reorder: those writes are now `items:` keys.
