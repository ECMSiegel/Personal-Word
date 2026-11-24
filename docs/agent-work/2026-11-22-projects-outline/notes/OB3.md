# OB3 notes (T337, agent-16c8)

## Built
- `src/library/columnMenu.ts`: `columnMenuItems(columns, toggle): ContextMenuItem[]`, plus two extras OB4 needs: `toggleColumn(columns, column)` (returns the new list in `LIBRARY_COLUMNS` order) and `COLUMN_LABELS`.
- `src/library/columnMenu.test.ts`: 4 tests, written first (failed: module missing), now pass.
- `src/library/SortMenu.tsx`: also exports `directionLabels(sort)`. No new CSS file; it reuses `components/dropdown.css` classes (`dropdown`, `dropdown-button`, `dropdown-menu menu`, `dropdown-option row`, `dropdown-check`, `dropdown-heading`, `menu-rule`).

## ContextMenuItem support
`{label, run, disabled?, danger?}` or a swatches row. No checked state, so ticked columns are labelled `"✓ Edited"` (OB3 default). The context menu closes after a row runs, so the column chooser closes on each toggle (SortMenu is the one that stays open).

## As-built props
`SortMenu({sort: LibrarySort, reverse: boolean, foldersFirst: boolean, onChange(change: Partial<LibraryPreferences>): void})`.
onChange payloads: `{sort}`, `{reverse: boolean}`, `{foldersFirst: boolean}`. Clicking the row that is already checked does nothing.

## Mounting (OB4)
Replace the sort Dropdown and the reverse button with
`<SortMenu sort={prefs.sort} reverse={prefs.reverse} foldersFirst={prefs.foldersFirst} onChange={(c) => changePrefs(c)} />`.
It renders its own `div.dropdown` wrapper (position context for the popover). Trigger: button, accessible name/title "Sort projects", visible text = current sort label. For the column chooser:
`openContextMenu(..., columnMenuItems(prefs.columns, (c) => changePrefs({columns: toggleColumn(prefs.columns, c)})))`.

## DOM / keyboard
Popover `role="menu"` labelled "Sort projects"; three `role="group"` (aria-label Sort by / Direction / Folders), `menu-rule` separators between; rows `role="menuitemradio"` with `aria-checked`, check mark on the checked row. Direction rows `aria-disabled` and unchecked under Custom. Menu is focused on open; aria-activedescendant follows. Trigger: ArrowDown/ArrowUp/Enter/Space opens (highlight starts on the current sort). In the menu: Arrow Up/Down (clamped, skip disabled), Home/End, Enter/Space pick (menu stays open), Escape closes and refocuses the trigger, Tab closes. Outside click closes (Popover). The trigger forwards the same keys while open.

## Differences / unverified
- `tests/ob-sort-menu.spec.ts` not created (no story-free mount); OB4 writes it.
- Nothing seen in a browser: layout/width of the menu, highlight styling, focus return, and disabled-row look (uses `.dropdown-option[aria-disabled]` opacity) are unverified.
- Direction check is on the row matching `reverse` with the label for the current sort; labels assume OB1's default order (newest/biggest first, A to Z).
- tsc: no errors in the new files; only the two known ProjectLibrary.tsx `view` errors remain.
