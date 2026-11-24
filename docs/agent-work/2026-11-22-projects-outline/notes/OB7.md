# OB7 notes (T341, agent-5c63, Claude Sonnet)

Status: CLAIMED (Chromium preview build only).

## Before the full run
- `npx tsc --noEmit` clean. `npm test`: one unit failure, `src/designTokens.test.ts` "sizes every icon at 16 px": OB6's `<Pin size={14}>` in `Outline.tsx`. The icon rule (design-system.md, and the test) is 16 px for every Lucide icon, 14 px only for chevrons, and the plan's "14px" was wrong against it. Changed the pin to 16 and `tests/ob-pins.spec.ts` (14 -> 16 in its three places). After that: 99 files, 1435 tests passed.

## Full run 1 (`node_modules/.cache/personal-word-beta/ob-full1.log`, fresh build, 3 workers, 25.5 min)
39 failed, 752 passed, 80 skipped. Every failure, one label each:

| Spec | Label | What was done |
|---|---|---|
| fb-projects-meta:93 list columns | b | `.project-dates > span` -> `.outline-cell.col-*`; same assertions |
| fb-projects-meta:134 card view | a | deleted |
| fb-projects-meta:175 narrow 680 | b | rewritten: Edited shares one edge, nothing wraps, rows even, Words/Added hidden under 700 px (Decision 11) |
| fb-projects-meta:190 800 px cards, :206 folder cards, :225 cards fit widths | a/b | cards deleted; the "nothing wraps or clips at 680-1440, top level and in a folder" intent kept as one outline test |
| fb-projects-meta:251 longest counts | b | now "999,999" and "999 projects" in `.col-words` / `.col-sections` |
| fb-folders:70 new folder beside view toggle | b | toggle assertion becomes "New folder present, no card toggle"; `section.library-folder` -> `[data-folder-heading]` |
| fb-folders:88 subfolder nests | b | uses `data-container`, `data-depth`, 24 px step; chevron-ink check became folder name = project name edge |
| fb-folders:102 Move to folder (list and card) | b | cards loop removed; menu rows now include "Pin to top"; rows found by `data-container` |
| fb-folders:137 first mouse try, card below the fold | b | card toggle removed, row below the fold kept |
| fb-folders:202, 275, 311(183), 288 | b | `section.library-folder` / `[data-container="root"] > .project-row` -> flat selectors; keyboard test: second menu row is now "Pin to top" |
| fb-folders:332 indent one slot | b | rewritten for names at one edge per level (+24 px per depth), cards loop gone |
| fb-folders:358 even rows and closing rule | b | rewritten: `.outline-row` equal heights, 1 px rule above every row, 1 px under the last (`.outline-body`) |
| drop-target:41 | b | `.project-list` -> `.outline` |
| alignment:254 hit-area (cards trash + sidebar open-beside) | a/b | cards-trash half deleted, sidebar half kept |
| projects-screen:477 trash vs dates | b | `.project-dates` -> `.col-added` |
| w9-fonts:72 Sort dropdown font | b | `option` -> `menuitemradio` (menu is a `menu` now) |
| w9-projects-page:33 toolbar | b | six buttons (no reverse, no view toggle) |
| w9-projects-page:60 icon-sized buttons | a/b | reverse and view toggle gone; kept for New folder and Settings |
| w9-projects-page:76 row titles 15 px | b | names are `--type-body` 13 px now (Decision 8); Edited text colour, Added muted, order kept; cards half deleted |
| w9-projects-page:100 sort/direction/view reload | b | menu rows; stored shape now `{sort, fallbackSort, reverse, foldersFirst, columns}`, no `view` |
| w9-projects-page:119 bad prefs | b | no card button; Sort reads "Edited" |
| w9-projects-page:126 icon-grow | b | reverse and view buttons removed from the list |
| w9-projects-page:169 and :241 cards long title / counts | a | deleted |
| w9-projects-page:184 counts beside Edited and Added | b | outline cells, cards half deleted |
| layout-invariants T5 toolbar | b | icons are New folder and Settings |
| layout-invariants T5 cards grid, T13 card trash | a | deleted |
| layout-invariants T13 list trash | b | `.project-added` -> `.col-added` |
| motion (d)(e)(f) | b | listbox -> menu; (d) item count 10 (6+2+2); (e) role "menu" |
| motion (g) | **c** | see below; only the selector (listbox -> menu) was changed |
| performance:171 page-view 90 pages | d (not on HANDOFF's list) | median 27.4 ms vs 25 ms budget, an editor timing test unrelated to this batch; re-run alone, see below |

Kind (c) -- real regression, test not weakened:
- **`tests/motion.spec.ts` (g)** "the highlighted item is the active descendant ... inside a bordered, scrolled popover". Failing assertion: `expect(state.scrollTop).toBeGreaterThan(0)` (received 0) after the Sort menu's max-height is forced to 60 px and End, ArrowUp are pressed. The new `SortMenu.tsx` never scrolls the highlighted row into view (no `scrollIntoView`; the old `Dropdown.tsx` line 86 does `scrollIntoView({block: "nearest"})`). `.dropdown-menu` caps height at min(320px, 100vh - 16px) and the menu is about 430 px tall, so it scrolls at normal window sizes: with the keyboard the highlight can move to Direction or Folders rows that are out of sight. Fix belongs in `SortMenu.tsx` (scroll the highlighted row into view when `highlight` changes), not in the test.

## Housekeeping
- `src/library/folders.css` comment about drag being off: updated.
- `.project-list strong/small` in `src/styles.css`: grep showed no user in `src/`; removed; `layoutBudget.json` styles.css 107 -> 106 (the unit test demands the exact number).
- `src/research/pageMotion.ts` stagger: switched to `.outline-row` and tested; it **broke** `tests/fb-folders.spec.ts:241` (Color swatch click: "element is not stable", then the page intercepts the click; failed twice, passed on the rebuilt tree with `.project-row`). Reverted to `.project-row`. Folder rows are not staggered on a pointer return to Projects. Left for the coordinator: the stagger leaves something on folder rows that disturbs the menu opened from them.
- `tests/native-screens.js`: `.project-dates` -> `.outline-cell`; `.project-row`, `.project-name`, `.delete-entry` still exist. Not run.

## Docs re-check
- design-system.md: added a `.depth` row to the primitives table; stated the 40 px row height (`.outline` sets `--row-height` to `--bar-height`), the column chooser (check marks, closes after each toggle), the sort menu's three groups, the pinned band (no heading, `--space-5` gap, 16 px pin icon, folder path); restored "the gear" in the toolbar sentence; removed "reverse, view" from the standalone-icon list.
- architecture.md: `Outline.tsx` must be imported with its extension (case-insensitive disk resolves `./Outline` to `outline.ts`).
- AGENTS.md: re-read, already matches (one list, header, no cards, Folders on top/Mixed, Custom, pins band, `items:` keys). No change.
- README.md: the Projects sentence "as a list or as cards" -> one outline list with folders, sortable columns, up to three pins.

## Run 2 (`ob-full2.log`, fresh build, 3 workers, 15.3 min)
782 passed, 2 failed, 80 skipped. Failures: motion (g) (kind c, above) and performance:171 (timing; passed alone at one worker, 26.6 s, `ob7-perf.log`). tsc clean and unit 99 files / 1435 passed before the run.
Specs I changed were also run together on a fresh build (`ob7-changed1.log`, `ob7-changed2.log`, `ob7-bisect.log`).
