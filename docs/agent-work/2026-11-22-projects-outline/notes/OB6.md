# OB6 notes (T340, agent-4d1b, Claude Sonnet)

Status: CLAIMED (Chromium preview build only; not checked in the Mac app's WebKit).

## Built
- `src/library/Outline.tsx`: the list is now `div.stack.gap-5` holding `div.outline-body.outline-band` (only when something is pinned) and `div.outline-body` (the rest; omitted when every row is pinned). The gap is the existing `.stack` + `.gap-5` primitive: no new CSS rule for spacing, budget untouched (outline.css still 0). Pinned TOP rows (in `pinned` at depth 0) get a 14px `Pin` icon (`role="img"`, name "Pinned") after the name, and "-- <path>" muted after the name when the row came from a folder (projects and, since OB1 sets `path` on them, nested folders too). Rows inside a pinned folder (depth > 0), including a pinned project there, get no icon and no path.
- `src/library/outline.css`: `.outline-pin` (muted colour, `vertical-align`). No spacing.
- `src/components/ProjectLibrary.tsx`: `pinItem` (new, beside `folderItems`), used in `folderItems` (after Expand/Collapse) and `projectItems` (after Open): "Pin to top" / "Unpin"; at 3 pins on an unpinned row it is disabled and reads "Pin to top (3 of 3 used)". Imports `PIN_LIMIT`, `togglePin`. Follow-up: passes `foldersFirst` to `useLibraryDrag`.
- Drag follow-up: `outlineDropTarget(point, rects, dragged, listBottom, foldersFirst = false)` in `src/library/outlineDrag.ts`: with it on, a project over a folder row gets "into" over the whole row; a folder over a project row gets null. `useLibraryDrag.ts` takes a `foldersFirst` option and passes it (this file was outside the stated file list; the hook was the only way to reach the pure function). Mixed with projects unchanged.
- Tests: 6 new unit cases in `outlineDrag.test.ts`; `tests/ob-pins.spec.ts` (10 + 1 screenshot case behind `OB6_SHOTS=1`); 1 new case in `tests/ob-drag.spec.ts`.

## Decisions (plan silent)
- A pinned project inside a pinned folder: shown once, inside the folder, no pin icon; menu says "Unpin"; unpinning keeps it in the folder.
- Pin mark and path only on band top rows; path also shown on a pinned nested folder.
- The pin icon sits inside the name span (after a space), so a very long name ellipsizes the icon away; accepted.
- Move up/down on pinned top rows are already disabled by OB5 (tested here).

## Tests
- Fail-first: spec written first, tree without the pin code: `node_modules/.cache/personal-word-beta/ob6-failfirst.log`, 9 failed (8 pins cases + the drag case; the drag case's first failure was a mistake in the test itself, releasing instead of Escape, fixed). The new drag unit tests failed first (3 failed) before the `outlineDropTarget` change. The browser drag case was not run against the old code (the build already had the fix); only the unit tests are fail-first for it.
- After: fresh `npm run build`, serial lock, pinned Node, `ob6-run1.log`: `ob-pins` + `ob-drag` + `ob-outline`: 42 passed, 2 skipped (screenshot cases of OB2/OB5), exit 0. `npx tsc --noEmit` clean; `npx vitest run src/library` 82 passed; `layoutPrimitives.test.ts` 3 passed.

## Screenshots (looked at)
`notes/ob6-shots/band-light.png`, `band-dark.png` (1100x900): band holds Essays (expanded, pin icon after the name, Drafts / Essay one / Essay two under it with no icon) and "Novel -- Fiction" with a pin icon; then one gap, then the normal list (Fiction, Alpha..Delta). No heading, no fill, rules intact, both themes readable; the folder's "2 projects" is unchanged.
