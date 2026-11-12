# OF4 (T287): Sort, reverse and the view toggle back on the toolbar row

## What changed
- `src/components/ProjectLibrary.tsx`: the Sort dropdown, reverse button and view toggle moved back into the toolbar's right-hand group (`.library-display`), before the settings gear, as at HEAD. The `.library-caption` row is gone.
- `src/components/library.css`: the `.library-caption` rules are removed. The row-title, date and empty-state rules from wave 9 stay.
- Kept from wave 9: remembered sort/direction/view (`libraryPreferences.ts`), `icon-grow` classes, reverse arrow in a span, "Edited" then "Added" row order, the empty state.
- `tests/w9-projects-page.spec.ts`: the toolbar test now expects 7 buttons in order (Start, Import writing, Search, Sort, Reverse, View, Settings) and no caption row. The caption test became a toolbar test (icon-button class, no hover stroke). New test: Sort's vertical centre is within 4 px of "Start new project".

## What a user sees
Sort, the reverse arrow and the list/cards toggle sit at the right end of the top bar, on the same line as Start new project, Import writing and search. No row sits above the project list.

## Limitations
- Only the placement and its tests were restored; the 12 px muted caption styling is gone, so the three controls use the normal toolbar styling.
- `npx tsc -b` reports one error in `src/App.tsx(3021,19)` (research panel props). It is not in a file this task owns; it appeared after the earlier clean run.

## Fail-first
`notes/OF4-fail-first.txt`: before the source change, the new same-row test failed (Sort centre 55.5 px from Start new project; expected at most 4).

## Hand check
1. `npm run dev` or the test server on port 1454, open Projects.
2. Sort, the reverse arrow and the list/cards icon sit on the top bar's right side, level with "Start new project".
3. Pick Name in Sort, click the arrow, switch to cards, reload: the choices stay.
4. With no projects, the empty-state sentence and text links show, with no Sort-related row above them.

## Test results
- `npx vitest run src/libraryPreferences.test.ts`: 6/6 pass.
- Playwright (port 1454, serial lock): `tests/w9-projects-page.spec.ts tests/projects-screen.spec.ts tests/motion.spec.ts tests/w9-icon-magnify.spec.ts tests/hover-emphasis.spec.ts`: 64 passed, 0 failed.
