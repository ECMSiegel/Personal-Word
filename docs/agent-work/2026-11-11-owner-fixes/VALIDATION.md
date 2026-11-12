# Owner fixes (T284-T291) validation

Runner: agent-49a5 (Sonnet), 2026-11-11. Nothing was fixed or edited. Pinned Node 22.23.3. Serial lock taken once, held for all steps, released.
Logs: notes/VAL-build.log, VAL-unit.log, VAL-cargo.log, VAL-e2e.log (script: notes/VAL-run.sh).

| Step | Command | Result | Wave 9 for comparison |
|---|---|---|---|
| 1 | `npx tsc -b` then `npm run build` | exit 0, vite built in 9.8 s | clean |
| 2 | `npm test` | 83 files, 1277 tests, all passed | 1250 passed |
| 3 | `cd src-tauri && cargo test` | exit 0, lib 70 passed, 0 failed, 1 ignored | 70 |
| 4 | `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/OF-final` | exit 0: **583 passed, 0 failed, 16 skipped** (26.1 min) | 551 passed, 1 failed |
| 5 | reruns of failures | none needed (no failures) | |

## Failures
None. The known suspects all passed in the full run: command-palette.spec.ts:147, popover-bounds.spec.ts (all five, including the re-recorded
"toolbar popovers keep their recorded untouched-tree placement" at :178), and w9-fonts.spec.ts:72.
Because nothing failed, no intermittent or real failure was found; the earlier w9-fonts failure seen during review did not reproduce.

## Still needs the real app (from notes/OF*.md, BLUR.md, REVIEW-r1.md, REVIEW-r2.md)
All browser results above are Chromium only; native WebKit and the built Mac app were not run (no tauri build, no native scripts).
- T291 / BLUR (most important): in the rebuilt app on the external monitor, hover and Tab to a sidebar row, a Projects row title, the project title,
  a tab and the zoom menu. Text should be bolder and as sharp as at rest, nothing beside it moves. Native blur probe
  (`blur-check.py` must print RESULT PASS on a fresh 1x build, plus the 2x look). If too light or soft: fallback in BLUR-DIAGNOSIS.md section 10.
- T290 / OF7: native app at 125/150 percent: right-click in a table cell opens the table menu; a click just under page 1's last line (page gap low in the
  window) keeps the caret on page 1. The native S4/S6 probes (`w9-native.py zoom`) must be run on a rebuilt app.
- T286 / OF3 (rulers): page view at 100, 125, 150 percent, narrow and wide window: top ruler stays pinned while scrolling, ticks line up with the sheet,
  dragging a marker works, caret never hidden under the strip at the top of page 2 or 3; Page setup has two buttons (Ruler, Side ruler), each on/off alone, then reload;
  clicking the grey strip does nothing; with the floating sidebar on its title and pin still work; Page setup panel width with the third button.
- T288 / OF5: Settings strip has one grey line, Interface font and Add font... share a row; Add font... opens the native file picker in both places
  (Projects page gear dialog and project Settings; also Tab then Space); no "Choose Files"; Remove is red at rest, hover and Tab focus.
- T285 / OF2: Settings > floating sidebar on, page view, open a fragment: the area behind the title and "Kept from" line is the same grey as beside the page;
  title does not jump between a section and a fragment.
- T284 / OF1: Research > Notes, Delete footnote on a note in a section that is not open: dialog names the section, Cancel and Escape change nothing,
  confirm removes row and marker, remaining notes renumber, Snapshots & history lists "Before deleting a footnote", reload keeps it gone; also with the
  section open in the editor. On the Sources tab no stray digits beside "Unlink source".
- T287 / OF4: Projects page: Sort, reverse arrow and list/cards icon sit at the right end of the top bar level with "Start new project"; choices survive reload;
  empty state shows no Sort row.
- T289 / OF6: pick Georgia then Arial in Font family, reopen: RECENT, Arial, Georgia, grey line, full list; arrow keys never stop on the label or line.
- Note for coordinator (not a validation issue): docs/design-system.md "Projects page (T274)" paragraph still describes the caption row T287 removed.
