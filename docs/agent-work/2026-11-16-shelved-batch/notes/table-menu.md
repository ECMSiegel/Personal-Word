# Table right-click menu stays inside the window

Source: REVIEW-4 note 6, REVIEW-7 line 106 (menu ran past the bottom of a short window).

## Cause (measured)
`TableContextMenu` renders `Popover` already open. Popover's placement effect runs once, when
`open` changes, but the popup is only mounted a moment later (usePresence), so the effect finds
no element and never measures again. The menu therefore never flips or clamps. Dump at 900x420,
click y=258: menu y=260, h=202, bottom=462 (window is 420), no `popover-up` class, no scroll
ancestor, anchor is a 0x0 span. Popover works for menus that mount closed and open later; I did
not change it.

## Fix (src/editor/TableContextMenu.tsx only)
A `ref` callback passed to `Popover` (`keepInWindow`) runs when the menu is in the page. It sets
a CSS `translate` that moves the menu up (flip, same 2px gap as `.popover-up`) or left when it
would pass the window edge minus 8px, then clamps to 8px from every edge. No CSS declarations added.
Not fixed: a window resize while the menu is open (Popover's own resize handler is the only
thing that reacts, and it would not undo the translate).

## Evidence
Spec: tests/sb-table-menu-flip.spec.ts (900x420 low click, 520x420 right-edge click, 1280x900 tall).
- First run (before fix, old spec draft): 2 of 3 timed out on setup (spec bug, rewritten).
- Fail first (log test-results/sb-table-logs/before3.log, fix disabled): test 1 `Expected <= 420, Received 462`;
  test 2 `Expected <= 520, Received 607`; tall-window test passed.
- After fix (after1.log): 3 passed. Dump: menu y=56, bottom=258 (opens up from the click); right-edge
  menu x=227..417 (opens left of the click at 417); tall window unchanged at y=260, below the pointer.
- tests/tables-context.spec.ts: 3 passed. tests/sidebar-context-menu.spec.ts: 12 passed, 4 skipped (screenshots).
- `npx tsc -b` clean; `vitest run src/layoutPrimitives.test.ts` 3 passed.

## Other menu
`src/components/ContextMenu.tsx` already flips and clamps itself (useLayoutEffect, 8px margin); no bug,
not edited. Popover's mount-before-measure gap likely affects any other Popover rendered already open
(unchecked); a one-line fix would be adding the mounted state to its effect deps.
