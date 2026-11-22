# PLAN -- Projects page outline rebuild
Date: 2026-11-22 | Architect: Claude Code / Fable 5.2 | Project: Project 13 - Word Processor | Status: APPROVED (owner said "go" 2026-11-22; open questions below have defaults, OB6 is held on Q1)

## Goal
The Projects page is one outline list in which folders and projects are the same kind of row, so nesting always reads correctly, and it can be sorted from column headers or one menu, reordered by hand under any sort, and have up to three things pinned to the top.

## Request
Owner, 2026-11-22, after hand-testing the folders batch: "So the folders work. Needs more work though." (1) "a drag made under another sort [should] apply to your saved hand-made order"; (2) Arc and Drive nest folders and indent better; (3) he likes Drive's menu that shows several sort settings at once; (4) "something in a folder is currently shown below a subfolder, even though it is supposed to be the level above it"; "I think we need a somewhat new approach to the project page ... we tacked on new changes instead of a ground up approach."
Answers since: go on the row-list rebuild; scrap cards on the Projects page; clickable column headers yes; indent only, no guide lines; do folder totals and chosen columns; keep the full Drive-style menu too; "the ability to have 3 pinned projects or folders but I don't want them to always be there if they are not pinned -- we would need a way to show they are pinned -- and I don't want ... duplicates."

## Definition of done
- The Projects page has no card view and no view toggle. Folders and projects are rows of one height in one list.
- At every depth, sibling names start at the same x; a child's name starts one step right of its parent's; every column's right edge is the same on every row at every depth.
- A header row labels Name, Edited, Words, Sections, Added. Clicking a header sorts by it; clicking again flips direction. Right-clicking the header row ticks columns on and off (Name always shown); the choice survives a restart.
- Folder rows show total words, "n projects", and the latest edit inside them (subfolders included).
- One sort menu holds Sort by (Name, Edited, Added, Words, Sections, Custom), Direction, and Folders (On top / Mixed), each with a checkmark. The separate arrow button is gone.
- Dragging a row under any sort moves just that row inside the saved hand-made order of its container and switches to Custom. With no saved order, the order on screen becomes the saved order.
- A row can be dropped at the end of the top level (the blank area under the list) and a folder can be dropped into another folder.
- Up to three projects or folders can be pinned. Pinned things show in a band at the top with a pin mark and nowhere else. With nothing pinned there is no band.
- The owner's existing `library.json` (folders, colours, placements, hand-made orders) reads exactly as before.
- tsc clean; unit, cargo and full built-app browser suites pass; Opus eyes-on review with screenshots approves; app rebuilt and not launched.

## Non-goals
- Sidebar collection cards (unchanged). A two-pane browser. A "Recent" strip.
- Sources and Comments columns: `Summary` carries only words and sections (see Context); adding counts means Rust work. Not now.
- Full ARIA treegrid and Up/Down arrow row navigation. Tab order and the existing Option+Up/Down stay.
- Reordering inside the pinned band by drag. Guide lines. Any change to `library.json` version or to the Rust store.
- Commits, pushes, package installs.

## Context (verified unless marked)
- The page is nested containers: `folderSection` renders a heading plus `.folder-body.indent` holding child sections then `projectsBox` -- `src/components/ProjectLibrary.tsx:554-596`. Folder headings (`FolderHeading`, `src/library/LibraryFolders.tsx`) and project rows (`projectRow`, `ProjectLibrary.tsx:496-542`) are different components with different left edges: the cause of request item 4.
- Card view is a `view` branch at `ProjectLibrary.tsx:561,570,590,753-762,786,793`; CSS at `src/styles.css:1801-1835` and `1905-1930`; `src/library/folders.css` (256px rule); `src/components/library.css` last rule.
- List columns today are a fixed grid `10.5em 7em 7em 10.5em` inside each row's button -- `src/styles.css:1779-1800`; at 700px and under they stack to two lines -- `src/styles.css:1898-1931`.
- `LibraryState = {version:1, folders, placement, order}`; `parseLibrary` and `copyState` rebuild only those four fields, so any new field is dropped today -- `src/library/folders.ts:9-38,51-118`.
- Order keys today: `order[<container>]` = project ids, `order["folders:"+parent]` = folder ids -- `folders.ts:185-213,240-267`. `deleteFolder` and `fileProject` clean only those shapes -- `folders.ts:215-238`. `moveProject` and `reorderFolder` replace the saved order with the on-screen ids: the cause of request item 1.
- Rust stores `library.json` as an opaque JSON string and keeps `library.backup.json` -- `src-tauri/src/store.rs:239-257`. No Rust change is needed for new fields (inferred from pass-through; covered by existing cargo tests).
- `Summary` = id, title, updatedAt, optional createdAt, wordCount, sectionCount -- `src/model.ts:75-79`. No source or comment counts.
- Preferences: `LibraryPreferences {sort, fallbackSort, reverse, view}` under `folio.workspace.library` -- `src/libraryPreferences.ts`.
- Drag: `src/library/libraryDrag.ts` (pure hit test, has a cards branch) and `useLibraryDrag.ts` (measures `[data-container] > [data-project-id]` and `[data-folder-heading]`).
- About 30 spec files use `.project-row`, `.project-list`, `data-project-id`, "Sort projects" or "Reverse project sort order" (grep 2026-11-22). Card-specific: `tests/w9-cards.spec.ts` (sidebar cards too -- read before deleting anything), `tests/fb-projects-meta.spec.ts`, `tests/layout-invariants.spec.ts` T5.
- Budgets: `src/components/library.css` 12, `src/library/folders.css` 0 -- `src/layoutBudget.json`. `.indent` primitive exists -- `src/components/layout.css:100`.
- Base state: branch main at 3ac28af; the whole folders batch is uncommitted in the working tree (CLAIMED, hand-tested by the owner as "the folders work"). No rollback point exists until the owner approves a commit (Q4).

## Rules in force
- Read `docs/design-system.md` before any CSS. Spacing only through layout primitives; `layoutBudget.json` may only go down. Square corners, flat surfaces, selection is weight and colour, one shared hover rule, '--' separators -- `AGENTS.md`.
- Never write over a library file that could not be read or has an unknown version; deleting a folder never deletes a project -- `AGENTS.md`.
- Keep `folio.*` storage keys compatible -- `AGENTS.md`.
- Small fixes run only the specs they touch; the full suite runs once, at the end, three workers; builds and Playwright take the serial lock -- `AGENTS.md`, `docs/validation.md`.
- No commits, no installs, no native or screen-taking runs without the owner's word. Never stash, reset, checkout or clean. Never touch real projects -- `AGENTS.md`, workspace `AGENTS.md`.
- Shared files are edited by one named task at a time: `src/styles.css`, `src/components/layout.css`, `src/layoutBudget.json`, `tests/layout-invariants.spec.ts`, `docs/design-system.md`, `AGENTS.md`.
- UI tasks are approved only after an Opus review that looks at screenshots, never from the diff alone (lesson of the folders batch).

## Approach
Build the page from a pure function that turns (projects, library, sort settings) into a flat array of rows with a depth, and one row component with a fixed skeleton: depth indent, arrow slot, icon slot, name, columns, trash. Sorting, folder totals, pins and "folders on top" are decided in the pure function and unit-tested; the view only draws rows. One saved order per container holds folders and projects together, so Mixed and Custom work, and one pure operation ("place this row beside that neighbour in the saved order") serves drag, Move up/down and the keyboard.

Rejected: patching the nested containers (each fix so far has produced another alignment or rule defect); a two-pane browser (a different page, too large); keeping cards as sections (owner chose to drop them).

### Decisions every task must follow
1. **Item keys.** `ItemKey` is `"f:<folderId>"` or `"p:<projectId>"`.
2. **Saved order.** New key `order["items:"+container]` (container = folder id or `"root"`) holds `ItemKey[]` for folders and projects together. When it is absent, the saved order is read from the old keys: `order["folders:"+container]` folders first, then `order[container]` projects; when both are absent there is no saved order. Old keys are never rewritten and are removed only by `deleteFolder`. Version stays 1.
3. **Custom display.** A container with a saved order shows it; rows not in it come first, in fallback-sort order. A container with none shows the fallback sort. "Folders on top" is a stable partition of that order, not a second order.
4. **Hand reorder (any sort).** Start from the container's saved order, or the on-screen order if none; make sure every on-screen row is in it; remove the moved row; insert it before or after the neighbour it was dropped beside; save; switch sort to Custom. Other containers are untouched.
5. **Folder values.** name = folder name; edited = latest `updatedAt` in its subtree; words = sum of `wordCount ?? 0`; sections = number of projects in its subtree; added = none. Sorting by Added orders folders by name. Empty folders sort last under Edited. Undefined project counts sort as 0.
6. **Direction** applies to folders and projects alike and is ignored under Custom.
7. **Row skeleton, left to right:** indent of `depth` steps (one step = `--slot`); arrow slot (chevron button on folders, empty on projects; the slot is omitted on every row when the library has no folders); icon slot (folder icon, tinted by its colour; muted document icon on projects, see Q2); name; visible columns; trash slot (projects only, shown on hover or focus as today).
8. **Type.** Names use `--type-body`; folder names weight 700, project names 400; both in the normal text colour. Columns are `--type-small`, muted, Edited in the text colour.
9. **Column cells** hold values only, because the header labels them: a date ("Nov 12, 2026"), "2,117", "25". Folder Sections cell: "2 projects" / "1 project". Folder Added cell: empty. Each cell keeps an `aria-label` with the full phrase ("Edited Nov 12, 2026").
10. **Drop zones.** Project row: top half before, bottom half after. Folder row that is collapsed or empty: top third before, middle third into, bottom third after. Expanded folder with rows under it: top third before, the rest into. "Into" files the row first in that folder. "After" the last row of a folder stays in that folder. Blank area under the last row: top level, last. A folder never drops into itself or its subtree.
11. **Under 700px:** the header row is hidden and each row shows Name and Edited only.
12. **Selector contract (kept so existing specs survive):** project row keeps `.project-row`, `data-project-id`, `.row-label` on its open button, `.project-name`, `.delete-entry`; folder row keeps `data-folder-id`, `data-folder-heading`, `.folder-chevron`, `.folder-name`; the sort menu trigger keeps the accessible name "Sort projects". New: list root `.outline` (also keeps `.library-tree`), every row `.outline-row` with `data-depth`, `data-container`, `data-kind`; header `.outline-header` with buttons named by column label; column cells `.col-edited`, `.col-words`, `.col-sections`, `.col-added`.

## Tasks

### OB1 -- Build the outline model (pure) -- Sonnet
- Files: modify `src/library/folders.ts`, `src/library/folders.test.ts`, `src/libraryPreferences.ts`, `src/libraryPreferences.test.ts`; create `src/library/outline.ts`, `src/library/outline.test.ts`.
- Interfaces: uses none. Provides:
  - `folders.ts`: `type ItemKey`; `itemKey(kind: "folder" | "project", id: string): ItemKey`; `parseKey(key: ItemKey): {kind: "folder" | "project"; id: string}`; `LibraryState.pins?: ItemKey[]`; `PIN_LIMIT = 3`; `savedItems(state, container: string): ItemKey[] | null`; `placeBeside(state, container: string, shown: ItemKey[], key: ItemKey, neighbour: ItemKey | null, side: "before" | "after"): LibraryState` (neighbour `null` = last); `togglePin(state, key: ItemKey): LibraryState` (no change when adding a fourth); `moveFolder` and `fileProject` unchanged in signature.
  - `libraryPreferences.ts`: `LIBRARY_SORTS = ["name","added","edited","words","sections","custom"]`; `LIBRARY_FALLBACK_SORTS` = the same without custom; `LIBRARY_COLUMNS = ["edited","words","sections","added"]`, `type LibraryColumn`; `LibraryPreferences = {sort, fallbackSort, reverse, foldersFirst: boolean, columns: LibraryColumn[]}` with defaults `foldersFirst: true`, all four columns. The `view` field is removed and a saved `view` is ignored on read.
  - `outline.ts`: `type OutlineRow = {key: ItemKey; kind: "folder" | "project"; id: string; depth: number; container: string; pinned: boolean; folder?: LibraryFolder; project?: Summary; totals?: {words: number; projects: number; edited?: string}; path?: string}`; `buildOutline(input: {projects: Summary[]; lib: LibraryState; sort: LibrarySort; fallbackSort: LibraryFallbackSort; reverse: boolean; foldersFirst: boolean}): {pinned: OutlineRow[]; rows: OutlineRow[]}`; `siblings(rows: OutlineRow[], container: string): ItemKey[]`.
- Steps:
  1. In `parseLibrary` and `copyState`, carry `pins` (array of valid `ItemKey` strings, at most 3, duplicates dropped; anything else reads as no pins) and accept `items:` order keys as they are.
  2. Add `savedItems`, `placeBeside`, `togglePin` per Decisions 2 and 4. `deleteFolder` also deletes `order["items:"+id]`, removes `f:<id>` from every `items:` list and from `pins`. `fileProject` also removes `p:<id>` from every `items:` list.
  3. Add the preference fields and migration-by-default (unknown or missing values fall back to defaults).
  4. Write `buildOutline`: per container, compute children (folders and projects), order them by Decisions 3, 5, 6 and `foldersFirst`, recurse into folders that are not collapsed, set `depth`. Pinned keys that still exist are lifted out with their subtree into `pinned` (depth restarts at 0 there; a pinned project that lives in a folder gets `path` from `folderPath`); a pinned item inside a pinned folder stays inside that folder and is not lifted again. Folder `totals` always count the whole subtree, pinned or not.
  5. Unit tests, each written first and seen to fail: pins survive parse and every mutation; a fixture in today's shape (old order keys, no `items:`) displays under Custom exactly as `orderedFolders`/`orderedProjects` show it today; owner rule A (saved order B, C, A; sort by Name; drag A after B; result B, A, C, not A, B, C plus a move); owner rule B (no saved order: on-screen order becomes saved, with the move); Mixed interleaves folders and projects by name; folder values per Decision 5; nothing appears in both `pinned` and `rows`; a pinned project inside a pinned folder appears once; depth values for a three-level tree; deleting a pinned folder unpins it.
- Acceptance check: `npx vitest run src/library src/libraryPreferences.test.ts` -> all pass; `npx tsc --noEmit` reports errors only in `src/components/ProjectLibrary.tsx` and `src/library/useLibraryDrag.ts`/`libraryDrag.ts` (the `view` preference they still read), which OB2 and OB5 remove.
- Fail-first: each new test is run before its code and fails.
- Stop and ask if: `folders.ts` differs from the Context facts; a project id can itself start with `f:` or `p:` in a way that breaks `parseKey`; keeping today's Custom display for the old-shape fixture is impossible under Decision 3.
- Default if unanswered: none -- must ask.

### OB2 -- Draw the outline: one row component, header row, folder totals, no cards -- Opus
- Files: create `src/library/Outline.tsx`, `src/library/outline.css`, `tests/ob-outline.spec.ts`; modify `src/components/ProjectLibrary.tsx` (everything except the sort `Dropdown` and arrow button in the toolbar, which OB4 replaces), `src/library/LibraryFolders.tsx` (keep the helpers and `FolderNameInput`; `FolderHeading` goes), `src/library/folders.css`, `src/components/library.css`, `src/styles.css` (only the `.project-list`/`.project-row`/`.project-dates` rules at 1742-1835 and 1903-1931), `src/components/layout.css` (one new depth primitive), `src/layoutBudget.json` (down only; add `outline.css` at 0), `src/research/pageMotion.ts` only if its Projects selectors break.
- Interfaces: uses `buildOutline`, `OutlineRow`, `ItemKey`, `LibraryColumn`, preferences from OB1. Provides `Outline` props: `{pinned: OutlineRow[]; rows: OutlineRow[]; columns: LibraryColumn[]; sort: LibrarySort; reverse: boolean; hasFolders: boolean; onSort(column: "name" | LibraryColumn): void; onHeaderMenu(at: {x: number; y: number; viaKeyboard: boolean}): void; renderRowProps(row: OutlineRow): object}` (the last carries menu, drag and edit handlers from `ProjectLibrary`), and the DOM of Decisions 7-12. Provides for OB4: `changePrefs` keeps its current name and shape in `ProjectLibrary.tsx`.
- Steps:
  1. Read `docs/design-system.md`. Add the depth primitive to `layout.css` (inline start padding of `--depth` steps of `--slot`), documented beside `.indent`.
  2. Build `Outline.tsx`: header row plus rows from `pinned` then `rows`, each row per Decisions 7-9, using one CSS grid template shared by header and rows so columns align at every depth. Hidden columns leave no gap.
  3. Header buttons call `onSort`; the sorted column shows a small up or down arrow and `aria-sort`. `ProjectLibrary` maps a click to: another column -> that sort, direction reset; same column -> flip `reverse`.
  4. Replace `folderSection`, `projectsBox`, `projectRow` and the search branch in `ProjectLibrary.tsx` with `buildOutline` + `Outline`. Search stays a flat list of matching projects with the folder path after the name, no folders, no pinned band. The empty state stays under the list. Folder rename uses `FolderNameInput` inside the folder row. Clicking a folder row toggles it; Left and Right arrow on a focused folder chevron collapse and expand.
  5. Remove the card view: the toggle button, every `view` branch, the card CSS, the 256px rule. Keep context menus, colours, "New project here", announcements and `menuHandlers` working on the new rows. Draw `pinned` rows exactly like others for now (OB6 adds the band and mark). Keep Move up/down and drag compiling against the old calls; OB5 replaces them.
  6. Rules between rows: one 1px `--line` rule above each row and one under the last; no gaps or double rules at folder ends.
  7. `tests/ob-outline.spec.ts` (isolated preview storage, seeded library with a folder, a subfolder, projects at three depths): sibling names share a left edge at each depth; child name left edge = parent's + one step; each column's right edge is equal across all rows; header click sorts and second click flips; folder row shows summed words, "n projects", latest edit; no element matches `.project-list--cards` and no "Show project cards" button exists; at 600px wide the header is hidden and only Name and Edited show; light and dark screenshots saved to the task notes.
- Acceptance check: `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/ob-outline.spec.ts` (serial lock held) -> all pass; `npx tsc --noEmit` -> clean apart from errors inside `libraryDrag.ts`/`useLibraryDrag.ts` if OB5 has not landed; `node scripts/check-layout-budget.*` or the budget unit test -> passes with no number raised.
- Fail-first: write the alignment assertions first and run them on the untouched tree with the same seeded library: the sibling-edge assertion fails (this is the owner's screenshot).
- Stop and ask if: the alignment cannot be met without raising a budget number; a kept selector from Decision 12 cannot be kept; the owner has answered Q2 with "no icon" (then project rows leave the icon slot empty -- confirm with the coordinator before drawing).
- Default if unanswered: muted document icon on project rows (Q2 default).

### OB3 -- Build the sort menu and the column chooser -- Sonnet
- Files: create `src/library/SortMenu.tsx`, `src/library/columnMenu.ts`, `src/library/columnMenu.test.ts`, `tests/ob-sort-menu.spec.ts` (the spec is completed in OB4 once wired; in OB3 it may hold only the menu's structure test against a story-free mount if one exists, otherwise leave the file for OB4 and say so in the notes).
- Interfaces: uses preferences types from OB1; `Popover`, `PopoverItem`, `ContextMenuItem` as they exist. Provides `SortMenu` props `{sort: LibrarySort; reverse: boolean; foldersFirst: boolean; onChange(change: Partial<LibraryPreferences>): void}`; trigger is a button with accessible name "Sort projects" showing the current sort's label; `columnMenuItems(columns: LibraryColumn[], toggle: (c: LibraryColumn) => void): ContextMenuItem[]` (four checkable rows: Edited, Words, Sections, Added).
- Steps:
  1. Read how `Dropdown.tsx` draws its checkmark (the blue check from FB2) and reuse that mark and the `.menu` styles; add no new spacing rules.
  2. `SortMenu`: one popover, three labelled groups separated by `menu-rule`: "Sort by" (Name, Edited, Added, Words, Sections, Custom), "Direction" (two rows whose labels fit the sort: A to Z / Z to A for Name; Newest first / Oldest first for Edited and Added; Most first / Fewest first for Words and Sections; both disabled under Custom), "Folders" (On top, Mixed with projects). Each group marks its current row with the check and `aria-checked`; rows are `menuitemradio`. Picking a row calls `onChange` and leaves the menu open; Escape and outside click close it. Arrow keys, Home and End move through all rows.
  3. `columnMenuItems` and its unit test (toggling adds and removes, order always follows `LIBRARY_COLUMNS`).
- Acceptance check: `npx vitest run src/library/columnMenu.test.ts` -> pass; `npx tsc --noEmit` -> no errors in the two new files.
- Fail-first: unit test written before `columnMenuItems`.
- Stop and ask if: `ContextMenuItem` has no checked state (then report what it supports; do not edit `ContextMenu.tsx` without the coordinator, it is shared).
- Default if unanswered: show a leading "✓ " in the label for ticked columns.

### OB4 -- Wire the sort menu and column chooser into the page -- Sonnet (after OB2 and OB3)
- Files: modify `src/components/ProjectLibrary.tsx` (toolbar sort region and the `onHeaderMenu` handler only), `tests/ob-sort-menu.spec.ts`, `tests/fb-sort-menu.spec.ts`, `tests/t10-dropdown-label.spec.ts` (only Projects-page cases).
- Interfaces: uses `SortMenu`, `columnMenuItems`, `Outline`'s `onHeaderMenu`, `changePrefs`.
- Steps:
  1. Replace the sort `Dropdown` and the "Reverse project sort order" button with `SortMenu`.
  2. `onHeaderMenu` opens the existing context menu with `columnMenuItems`; Shift+F10 on a header button opens it too.
  3. Spec: each group shows one check; choosing Words sorts by words; Direction flips; Mixed interleaves a folder between projects by name; hiding Added removes the header and every cell and survives reload; the arrow button no longer exists.
  4. Update the two older specs to the new control; delete only cases that tested the removed button or the cover-style dropdown on this page.
- Acceptance check: `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/ob-sort-menu.spec.ts tests/fb-sort-menu.spec.ts tests/t10-dropdown-label.spec.ts` -> all pass.
- Fail-first: the new spec fails before step 1.
- Stop and ask if: removing the cover dropdown here leaves `cover`/`plain` unused anywhere (report it; do not remove the props).
- Default if unanswered: leave the unused props in place and note it.

### OB5a -- Write the pure drop rules for the outline -- Sonnet (after OB1, alongside OB2)
- Files: create `src/library/outlineDrag.ts`, `src/library/outlineDrag.test.ts`. Touch nothing else (the old `libraryDrag.ts` must keep compiling until OB5 swaps it out).
- Interfaces: uses `ItemKey`. Provides `type RowRect = {key: ItemKey; kind: "folder" | "project"; container: string; depth: number; expandedWithRows: boolean; pinnedTop: boolean; ancestors: string[]; rect: {left: number; top: number; width: number; height: number}}`; `type Drop` exactly as in OB5; `outlineDropTarget(point: {x: number; y: number}, rects: RowRect[], dragged: ItemKey, listBottom: number): Drop | null`.
- Steps: implement Decision 10 as a pure function (no DOM); a point below `listBottom` is `{kind: "end"}`; a folder never targets itself or a row whose `ancestors` include it; `pinnedTop` rows give only "into" (folders) or null. One unit test per zone and per refusal, written first.
- Acceptance check: `npx vitest run src/library/outlineDrag.test.ts` -> all pass.
- Fail-first: tests written before the function.
- Stop and ask if: Decision 10 leaves a point with two possible answers.
- Default if unanswered: none -- must ask.

### OB5 -- Rebuild dragging and Move up/down on the flat list -- Opus (after OB4; both edit ProjectLibrary.tsx)
- Files: modify `src/library/libraryDrag.ts`, `src/library/libraryDrag.test.ts`, `src/library/useLibraryDrag.ts`, `src/components/ProjectLibrary.tsx` (`applyDrop`, `stepBy`, `stepProject`, `stepFolder`, `stepItems`, `toCustom` only), `src/library/outline.css` (drop line and into-state only); create `tests/ob-drag.spec.ts`; modify `tests/fb-folder-order.spec.ts`.
- Interfaces: uses `placeBeside`, `fileProject`, `moveFolder`, `siblings`, `ItemKey`. Provides `type Drop = {kind: "before" | "after"; key: ItemKey; container: string} | {kind: "into"; folder: string} | {kind: "end"}` and `dropTarget(point, rects, dragged): Drop | null` with no `view` parameter.
- Steps:
  1. Use `outlineDropTarget` from OB5a (delete `libraryDrag.ts` and its test once nothing imports them); the hook measures `.outline-row` elements by `data-kind`, `data-container`, `data-depth` and expanded state; add the blank-area "end" target; forbid a folder into its own subtree; pinned top rows are neither draggable nor before/after targets (a pinned folder still accepts "into").
  2. `applyDrop`: before/after -> if the row changes container, `fileProject` or `moveFolder` first, then `placeBeside` in the target container with the on-screen siblings; into -> file or move, then `placeBeside(..., neighbour = first sibling, "before")`; end -> top level, `placeBeside(..., null, "after")`. Always switch to Custom. Never rebuild another container's order.
  3. Move up/down and Option+arrows use `placeBeside` with the previous or next on-screen sibling; under "Folders on top" a project cannot step above a folder (announce "already first").
  4. Unit tests for every zone in Decision 10. Spec: owner rule A end to end (set a custom order, switch to Name, drag one row, reload, the other rows keep the custom order); rule B; drag a project into a collapsed folder, out to the blank area, and a folder into a folder; Escape cancels; the click after a drag opens nothing; dragging is off while searching.
- Acceptance check: `npx vitest run src/library` and `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/ob-drag.spec.ts tests/fb-folder-order.spec.ts` -> all pass; `npx tsc --noEmit` -> clean.
- Fail-first: the rule A spec is run on the tree before step 2 and fails (order collapses to alphabetical plus one move).
- Stop and ask if: a Decision 10 zone makes some drop impossible to reach in practice; `fb-folder-order.spec.ts` asserts the old "order on screen replaces saved order" rule (rewrite that case to rule A and say so in the notes).
- Default if unanswered: none -- must ask.

### OB6 -- Pins -- Sonnet (after OB5; HELD until the owner answers Q1)
- Files: modify `src/library/Outline.tsx`, `src/library/outline.css`, `src/components/ProjectLibrary.tsx` (`folderItems`, `projectItems` only); create `tests/ob-pins.spec.ts`.
- Interfaces: uses `togglePin`, `PIN_LIMIT`, `OutlineRow.pinned`, `OutlineRow.path`.
- Steps (Q1 defaults):
  1. Menu row "Pin to top" / "Unpin" on projects and folders, after "Open"/"Collapse". With three pins and this row not pinned, the row is disabled and reads "Pin to top (3 of 3 used)".
  2. Pinned rows draw first, under the header, followed by one `--space-5` gap made with a layout primitive; the band has no heading and no fill. Each pinned top row shows a 14px muted pin icon after its name (accessible name "Pinned"); a pinned project that lives in a folder shows "-- <folder path>" muted after the name, as search results do.
  3. A pinned folder expands and collapses in the band and its contents show under it there. Move up/down are disabled on pinned top rows.
  4. Spec: nothing pinned -> no band and no pin icon anywhere; pin a project in a folder -> it shows once, in the band, with its path, and the folder's "n projects" is unchanged; pin a folder -> it and its contents show only in the band; a fourth pin is refused; unpin returns it to its place; pins survive reload; search ignores pins.
- Acceptance check: `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/ob-pins.spec.ts` -> all pass.
- Fail-first: spec written first; fails for lack of the menu row.
- Stop and ask if: the owner's Q1 answer differs from the defaults in any way (then the coordinator rewrites these steps first).
- Default if unanswered: none -- must ask (task is held).

### OB7 -- Sweep the old specs and docs -- Sonnet (after OB4, OB5, OB6)
- Files: modify `tests/layout-invariants.spec.ts`, `tests/w9-cards.spec.ts`, `tests/fb-projects-meta.spec.ts`, `tests/fb-folders.spec.ts`, `tests/w9-projects-page.spec.ts`, `tests/projects-screen.spec.ts`, `tests/alignment.spec.ts`, `tests/layout-gallery.spec.ts`, `tests/drag-reorder.spec.ts`, any other spec the full run shows failing because of this batch; `AGENTS.md`, `docs/design-system.md`, `docs/architecture.md`, `README.md` only where it describes Projects-page cards.
- Interfaces: none.
- Steps:
  1. Run the full built-app suite once (serial lock, background, log to `node_modules/.cache/personal-word-beta/ob-full1.log`). List every failure in the task notes with one of: card view removed (delete the case), selector or text changed (update), real regression (report to the coordinator, do not edit the test).
  2. Fix the first two kinds. Never weaken an assertion to make it pass; never delete a sidebar-cards case.
  3. Docs: in `AGENTS.md` replace "In each folder, subfolders come first, then projects, and a folder's contents are indented one slot under its heading" with the outline rules (one row list, Folders on top or Mixed, any hand reorder edits the saved order and switches to Custom, up to three pins shown only in the top band); say the Projects page has no card view; keep the sidebar cards line. Match `docs/design-system.md` and `docs/architecture.md` (`items:` order key, `pins`, `outline.ts`).
- Acceptance check: second full run -> 0 failed apart from the known intermittents listed in `HANDOFF.md`, each re-run alone and passing.
- Fail-first: n/a: this task repairs existing tests.
- Stop and ask if: more than 25 specs fail for reasons other than removed cards or changed selectors.
- Default if unanswered: none -- must ask.

### OB8 -- Eyes-on review -- Opus (after OB7)
- Files: create `docs/agent-work/2026-11-22-projects-outline/reviews/REVIEW-1.md`; no source edits.
- Interfaces: none.
- Steps: with the built preview, screenshot light and dark at 1280, 900 and 600 wide: three-level tree, Mixed, each sort, hidden columns, pinned band with a folder and a filed project, mid-drag for each zone, rename field, search. Check every Definition of done line, the design rules, and the diff against this plan. Write findings with severity; the coordinator turns each into a repair task.
- Acceptance check: `REVIEW-1.md` exists with a verdict per Definition of done line and the screenshot paths.
- Fail-first: n/a: review.
- Stop and ask if: the preview cannot be built.
- Default if unanswered: none.

### OB9 -- Final validation and rebuild -- Sonnet (after OB8 and its repairs)
- Files: `docs/agent-work/2026-11-22-projects-outline/VALIDATION.md`, `HANDOFF.md`.
- Steps: run the Validation list below in order; copy the current app bundle to `src-tauri/target/release/bundle/known-good-folders-batch/` before building if the owner has approved keeping it (ask the coordinator); `npm run tauri build`; record path, time and sha256; do not launch.
- Acceptance check: all Validation lines pass and are recorded with totals.
- Fail-first: n/a.
- Stop and ask if: any Validation line fails.
- Default if unanswered: none.

### OB7a -- Docs early -- Haiku or Sonnet (after OB1, alongside OB2)
- Does step 3 of OB7 from the Decisions section; OB7 re-checks the wording against what was built. Files: `AGENTS.md`, `docs/design-system.md`, `docs/architecture.md`. Acceptance check: `grep -n "subfolders come first" AGENTS.md` -> no match. Fail-first: the grep matches today. Stop and ask if: a Decision contradicts another AGENTS.md rule. Default: none.

## Validation (after all tasks, in order)
1. `npx tsc --noEmit` -> clean.
2. `npm test` -> all pass.
3. `cd src-tauri && cargo test` -> all pass (no Rust change expected; this proves it).
4. Layout budget check -> no number raised; `outline.css` at 0.
5. Full built-app browser suite, three workers -> 0 failed.
6. `npm run tauri build` -> app at `src-tauri/target/release/bundle/macos/Personal Word.app`; not launched.
7. Owner hand test (the only route to VERIFIED): his real library opens with folders, colours and orders intact; the Spanish / Subtest / Hello Angela case reads correctly; header sorting; sort menu; column chooser; drag under Name keeps the custom order; pins; quit and reopen.

## Risks and rollback
- No rollback point exists while the folders batch is uncommitted (Q4). If the owner approves a commit first, rollback is `git revert` of this batch's commit; otherwise it is hand repair.
- The owner's real `library.json` now holds hand-made orders. The old-shape fixture test in OB1 and the kept old keys guard it; `library.backup.json` holds the previous write.
- Thirty specs touch this page: the selector contract (Decision 12) and OB7 contain that; the stop rule is 25 unexplained failures.
- Chromium only until the owner's hand test; WebKit grid and subpixel differences are possible in the column alignment.

## Open questions for the user
1. **Pins.** Defaults: a band at the top (no heading, a gap under it); a pin icon after the name; a pinned project that lives in a folder shows only in the band with its folder's name after it, and still counts in the folder's totals; a pinned folder shows with its contents only in the band; a pinned project inside a pinned folder shows inside that folder only. Alternative: pinned things float to the top of their own folder instead of a page-top band.
2. **Icon on project rows.** Sibling names only line up if project rows fill the icon slot. Default: a small muted document icon (the AGENTS.md icon rule would be widened to allow it). Alternative: leave the slot empty.
3. **Columns.** I said Sources and Comments counts already exist; they do not (only words and sections are stored in the project summary). Default: the chooser offers Edited, Words, Sections, Added. Adding the others is a later Rust task.
4. **Commit first.** Default: none -- I will not commit unasked. Recommended: commit the folders batch (you tested it: "the folders work") before workers start, so this rebuild has a way back.
5. **Storage shape.** `library.json` gains a combined order list per folder and a pins list; your existing file is read as it is and the version stays 1. Telling you because I earlier said storage would survive untouched.

## Notes for the implementer (traps, things NOT to do)
- `parseLibrary` and `copyState` silently drop unknown fields. Any new field must be added to both.
- Do not raise a number in `layoutBudget.json`. Do not add margin, padding, gap or height to `outline.css`; use primitives.
- Do not edit `tests/layout-invariants.spec.ts` unless you are OB7.
- Do not delete or rewrite the old order keys; do not bump the library version.
- Do not touch the sidebar's cards or `ProjectSidebar.tsx`.
- Preview storage only. Never open or write a real project or the real `library.json`.
- Builds and Playwright runs take the serial lock; long runs go in the background with a log.
- No commits. No Claude trailers if the owner later asks for one.
