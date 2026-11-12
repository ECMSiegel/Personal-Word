# OF7 -- two WebKit zoom bugs (T290)

Cause for both: native WebKit reports rects inside the CSS-zoomed page in drawn / zoom, while pointer coordinates are drawn px.

## What changed
- `src/editor/pagination.ts` `clickSpacer` (now exported): under `reportsUnzoomedRects()` the spacer's top and height are multiplied by `totalZoom(spacer)` before comparing with `clientY` (same rule as blankClick.ts). Chromium and zoom 1: scale is 1, arithmetic unchanged. The ArrowUp/ArrowDown code is untouched.
- `src/editor/pagination.ts` new `menuPositionInCell`: under WebKit zoom (`reportsUnzoomedRects()` and `totalZoom(cell) !== 1`), if `posAtCoords` lands outside a cell, use `view.posAtDOM(cell, 0)` of the clicked cell. Otherwise exactly the old rule (posAtCoords, else the cell).
- `src/Writer.tsx` table `contextmenu` handler: the 5 lines that computed `position` now call `menuPositionInCell(...)`; import line extended. Nothing else; file not registered.
- `src/editor/pagination.test.ts`: 7 new tests (mocking ../components/floating as in blankClick.test.ts), including Chromium and WebKit-at-zoom-1 tests proving the old path is unchanged.

## What a user sees
Native app at 125/150 percent: right-click in a table cell opens the table menu; a click just under a page's last line (page gap low in the window) keeps the caret on that page. Nothing changes at 100 percent or in the browser.

## Evidence
- Fail first: `OF7-fail-first.txt` (2 failed: S6 150 percent above-edge click, S4 outside-cell fallback; the 5 pin tests passed on the old code, as intended).
- `npx vitest run src/editor`: 10 files, 139 passed. `npx tsc -b`: clean.
- Browser: `OF7-browser.log`, pages-gap + w9-blank-click: 12 passed, EXIT 0. No Playwright spec right-clicks a table cell (only sidebar-context-menu does), so S4 has unit proof only.

## Limitations / still to run
The native proof is NOT run: the existing S4 and S6 probes (`node_modules/.cache/personal-word-beta/w9-n/w9-native.py zoom`, which fail today) must be run by the native runner on a rebuilt app. Unit tests use mocks, so they prove the decision logic, not WebKit itself.

## Hand check (native app)
Set view zoom 150 percent, insert a table, right-click a cell: the table menu opens. Type enough text to fill page 1, put the page gap low in the window, click just under page 1's last line: the caret stays on page 1.
