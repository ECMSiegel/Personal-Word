# OB4 notes (T338, agent-0bed, Claude Sonnet)

Status: CLAIMED (Chromium preview build only).

## Changed
- `src/components/ProjectLibrary.tsx`: toolbar sort Dropdown and reverse arrow replaced by `<SortMenu sort reverse foldersFirst onChange={changePrefs} />`; `onHeaderMenu` opens the existing context menu ("Columns") with `columnMenuItems` / `toggleColumn`; two imports added, `Dropdown` import removed (no other use in that file). Header Shift+F10 / ContextMenu key already calls `onHeaderMenu` (Outline).
- `tests/ob-sort-menu.spec.ts` (new, 5 tests + 2 screenshot tests behind `OB4_SHOTS=1`), `tests/fb-sort-menu.spec.ts` (rewritten to the new menu; deleted the cover-style cases: text-on-trigger, no tick column, four plain rows, near-top shift; reverse-arrow assertion became a Direction-disabled check), `tests/t10-dropdown-label.spec.ts` (Projects-page case now: pick shows on trigger, menu stays open, Escape closes).
- SortMenu.tsx and columnMenu.ts: unchanged (nothing visibly wrong).

## Results
- Fail-first: `node_modules/.cache/personal-word-beta/ob4-failfirst.log` (built untouched tree): 5 failed, 2 skipped.
- Final: `ob4-run3.log`: 13 passed, 2 skipped (screenshots), exit 0. tsc clean. `vitest run src/library`: 81 passed. No budget number touched.
- Header arrow and menu Direction agree (tested: Words most first = down arrow, Fewest first = up, Name reversed = down).

## Screenshots (looked at) `notes/ob4-shots/`
sort-menu-{light,dark}.png, sort-menu-custom-{light,dark}.png, columns-{light,dark}.png. Menu is ~157px wide, sits just under the trigger inside the window, group labels are small caps, checks line up in one column and labels line up in one column, checked rows are bold, separators between groups, Custom greys both Direction rows. Column chooser: four rows with a leading check mark, opens at the pointer, readable in both themes. Nothing needed fixing. Minor: the chooser opens over the header cells it was clicked on (normal for a context menu).

## Differences from plan
- Column chooser closes after each toggle (accepted). Focus returns to the first header button.
- Short-window bound in fb-sort-menu uses 520px height (the menu is ~430px tall; 230px cannot hold it).
- `Dropdown`'s `cover`/`plain` props are now unused by the Projects page; left in place.
