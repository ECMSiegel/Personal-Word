# OB2 notes (T336, agent-120d, Claude Opus)

Status: CLAIMED (Chromium preview build only; not checked in the Mac app's WebKit).

## What I built
- `src/library/Outline.tsx` (new): the `Outline` component. Header row, then `pinned` rows, then `rows`, all drawn by one row skeleton on one grid template.
- `src/library/outline.css` (new, budget 0): grid, rules, type, cells, header, the under-700px layout.
- `src/components/layout.css`: new primitive `.depth` (start padding = `--edge` + `--depth` x `--slot`), defined after `.row` so it wins the start side.
- `src/components/ProjectLibrary.tsx`: tree, search and card view replaced by `buildOutline` + `Outline`. `folderSection`, `projectsBox`, `projectRow`, `projectsIn`, `foldersIn`, `folderCount`, `sortProjects` (no importers), the card toggle and every `view` branch are gone. The toolbar's sort `Dropdown` and the reverse arrow are untouched (no options added); with Words or Sections chosen from a header the Dropdown shows a blank label (it tolerates an unknown value). `changePrefs` keeps its name and shape.
- `src/library/LibraryFolders.tsx`: `FolderHeading` removed; `FolderNameInput` now exported; the helpers are unchanged.
- `src/library/folders.css`: heading, card-grid (256px) and list-container rules removed; kept `.library-tree { position: relative }` and the generic drag-state rules for OB5.
- `src/styles.css`: removed the `.project-list` / `.project-row` / `.project-dates` / card rules (old lines 1742-1835) and the under-700px stacking rules (1901-1931). Nothing else touched.
- `src/components/library.css`: removed the 15px name rule, the Edited colour rule (moved to outline.css) and the card trash rule.
- `src/layoutBudget.json`: `styles.css` 115 -> 107; `src/library/outline.css` added at 0. Nothing raised.
- `src/projectLibraryCounts.test.ts` (existing unit test, outside the task's file list): it asserted the old "Edited ... / 12,400 words" spans; rewritten to Decision 9 (values only, full phrase in `aria-label`, empty unlabelled cell when a count is missing). Flagging because it was not in my file list.
- `tests/ob-outline.spec.ts` (new, 10 tests).

## DOM and props contract (as built; OB4, OB5, OB6 read this)
Import with the extension: `import { Outline, type OutlineRowWiring } from "../library/Outline.tsx"`. **Trap:** `Outline.tsx` and `outline.ts` sit side by side; on the Mac's case-insensitive disk `"./Outline"` resolves to `outline.ts` (tsc error TS1149). The tsconfig allows `.tsx` imports.

`Outline` props:
- `pinned: OutlineRow[]`, `rows: OutlineRow[]` (pinned drawn first, exactly like other rows), `columns: LibraryColumn[]`, `sort: LibrarySort`, `reverse: boolean`, `hasFolders: boolean`.
- `showPaths?: boolean` (added; search only): shows `-- <row.path>` after a project name. Pinned rows' `path` is NOT shown (OB6 decides).
- `onSort(column: "name" | LibraryColumn)`; `ProjectLibrary.sortBy` maps: another column -> `changePrefs({sort: column, reverse: false})`; same column -> `changePrefs({reverse: !reverse})`. Under Custom a header click leaves Custom.
- `onHeaderMenu({x, y, viaKeyboard})`: called on right-click of a header button and on Shift+F10 / ContextMenu key there. `ProjectLibrary` passes a no-op now; OB4 opens the column chooser.
- `renderRowProps(row) => OutlineRowWiring` where `OutlineRowWiring = { attrs (spread on the row div: today onContextMenu + onKeyDown from menuHandlers; OB5 adds drag data-* here), onActivate() (project: open; folder: toggle), onDelete?() (projects), tint?: string (folder icon colour), rename?(name | null, viaKey) (set only while that folder's rename field shows) }`.
- Added beyond the plan's list: `rootRef` (the tree ref used for focus restore and drag measuring), `rootAttrs` (root `data-dragging`, `onPointerDown`), `children` (empty state, "No matching projects.", the context menu are drawn inside the root, under the list).

DOM:
- Root `div.outline.library-tree` with inline `--outline-template` and `--outline-template-narrow` (grid templates built from the visible columns; named lines `[arrow]` (only when the library has folders) `[icon] [name] [edited] [words] [sections] [added] [trash] [end]`).
  - `div.outline-header.row[role=row]` (only when there is at least one row): `div.outline-heading.col-<name|column>[role=columnheader][aria-sort?]` each holding `button.outline-sort` named by the label ("Name", "Edited", "Words", "Sections", "Added"); the sorted one has `data-active` and a `span.outline-sort-arrow` (↑ ascending / ↓ descending; arrow left of right-aligned labels, right of Name). Unreversed, Name reads ascending and the other columns descending (OB1's "newest/biggest first").
  - `div.outline-body` holding the rows; it draws the closing rule under the last row.
  - Folder row: `div.outline-row.folder-row.row.depth[style=--depth:N][data-kind=folder][data-key=f:<id>][data-depth][data-container][data-folder-id][data-folder-heading][data-pinned?][data-path?]` holding `button.folder-chevron.icon-button.slot.flush-start[aria-label=<name>][aria-expanded]`, the folder svg `.outline-icon.folder-icon` (tinted inline), `span.outline-name.folder-name` or `input.folder-name-input` while renaming, then the cells. Click anywhere on the row toggles (not while renaming); Left/Right on the chevron collapse/expand.
  - Project row: `div.outline-row.project-row.row.depth[...same data-*, data-kind=project, data-key=p:<id>, data-project-id]` holding `button.outline-open.emph-row.row-label` (first child; subgrid from `icon` to `trash`, so the whole row except the trash opens it) with the muted `FileText` svg `.outline-icon`, `span.outline-name.project-name.emph-label` (+ `span.project-path` in search), the cells; then `button.delete-entry.icon-grow.slot.flush-end`.
  - Cells: `span.outline-cell.col-<column>` with the value only and `aria-label` with the phrase when there is a value. Folder: Edited = latest edit in its subtree, Words = total, Sections = "n projects"/"1 project", Added empty. Project: date, "2,117", "25", date; a missing count is an empty cell.
- `data-pinned` is `""` when the row's own key is pinned; `data-path` carries `row.path` (set by `buildOutline` on lifted pinned rows, and on search rows).
- Kept selectors (Decision 12): `.project-row`, `data-project-id`, `.row-label`, `.project-name`, `.delete-entry`, `data-folder-id`, `data-folder-heading`, `.folder-chevron`, `.folder-name`, "Sort projects". Dropped: `.project-list`, `.project-list--list/--cards`, `section.library-folder`, `.folder-body`, `.folder-projects`, `.folder-heading`, `.folder-count`, `.project-dates`, `.project-edited/-added/-words/-sections`.

## Decisions I made (plan silent)
- Row height: every row and the header use `.row` with `--row-height` set to `--bar-height` (40 px) on `.outline` (same pattern as `.menu`/`.panel` overriding `--row-height`). One line in outline.css changes it.
- Rules: each row has a 1 px `--line` top border; `.outline-body:has(> .outline-row)` draws the one under the last row. The header has no rule of its own (the first row's top rule separates it).
- Column widths (em at `--type-small`): Edited 7.5, Words 6, Sections 7.5, Added 7.5. Grid gap is the `.row` default `--space-2`. Hidden columns are left out of the template, so no gap.
- Under 700 px: header hidden, template switches to `--outline-template-narrow` (Edited only, if Edited is a visible column), Words/Sections/Added cells `display: none`.
- Folder icon slot is `--icon-size` (16 px) wide; arrow slot is `--slot`; the chevron keeps `flush-start` (ink on the row edge) and the trash keeps `flush-end` with `justify-self: end`.
- Search uses `buildOutline` over the matches with `emptyLibrary`, so all six sorts work (Custom shows the fallback sort, as before); rows keep their real `container` and get `path`.
- Move up / down and Option+arrows now take "shown" from `siblings(outline.rows, container)` by kind, still saving through the old `moveProject` / `reorderFolder` (OB5 replaces them).
- **Drag is inert:** `useLibraryDrag` is called with `enabled: false, view: "list"`. Its `measure` looks for `[data-container] > [data-project-id]` and nested folder sections, which the flat list no longer has; it would compute every container as root. OB5 rebuilds it.
- `src/research/pageMotion.ts` untouched: its `.project-row` stagger still finds project rows, but folder rows are not staggered on a pointer return to Projects. Suggest `.outline-row` there (OB8/OB5 to decide).

## Test results
- Fail-first (untouched tree, `npx vite build` because `npm run build` fails its tsc step on the `view` errors): `node_modules/.cache/personal-word-beta/ob2-failfirst2.log` -- the sibling-edge test fails: "top-level folder vs project: 291 vs 244" and "subfolder vs project in the same folder: 315 vs 268" (the owner's case).
- `npx tsc --noEmit`: clean (exit 0; no errors left in libraryDrag/useLibraryDrag).
- `npx vitest run` (whole unit suite): 100 files, 1434 tests passed (includes `layoutPrimitives.test.ts` budget, `hoverEmphasis`, `motion`, `designTokens`).
- `PLAYWRIGHT_PREVIEW=1 npx playwright test tests/ob-outline.spec.ts --workers=1` on a fresh `npm run build`, serial lock held, `OB2_SHOTS=1`: 16 passed. Log `node_modules/.cache/personal-word-beta/ob2-run3.log`. Besides drawing, sorting and toggling, the spec covers: right-click menus on both row kinds with Escape returning focus (checks the rewritten `folderFocus`), rename in the row (menu and New folder; field on the sibling name edge, row height unchanged, Enter saves, Escape removes a fresh folder), Option+Down after a Words header sort (order changes, sort becomes Custom, focus stays), search (projects only, "-- Essays / Drafts", "No matching projects."), the empty library (no header), a long title ellipsizing with columns aligned at 1280 and 600 and no sideways scroll.
- The screenshot test is skipped unless `OB2_SHOTS=1`, so a full-suite run does not rewrite the reviewed PNGs. (Run 1, `ob2-run1.log`, failed one assertion of mine: the trash slot's `flush-end` pull makes the Added-to-trash distance 12 px, not 8; the assertion was corrected, not the code.)

## Screenshots (looked at)
`docs/agent-work/2026-11-22-projects-outline/notes/ob2-shots/outline-1280-light.png`, `outline-1280-dark.png`, `outline-600-light.png`, `outline-600-dark.png`, plus `outline-1280-light-hover.png` (hovered row: trash ink on the row end, under the header's end edge). Sibling names line up (Essays / Top note / Zebra notes; Drafts / Essay one), each depth one step in, columns right-aligned on one edge at every depth, one rule between rows, one under the last, no gaps; rows one height; at 600 no header, Name and Edited only.

## Existing specs expected to break (for OB7)
- `tests/fb-projects-meta.spec.ts`: whole file (list/card `.project-dates` columns, card view).
- `tests/w9-projects-page.spec.ts`: card toggle and `.project-list--cards`; likely "Edited ..." text checks.
- `tests/fb-folders.spec.ts`: "Show project cards" button order, `section.library-folder`, `.folder-projects.project-list--*`, `.folder-count`, card cases, nesting through `.folder-body`.
- `tests/fb-folder-order.spec.ts`: card case; every drag case (drag is inert until OB5).
- `tests/drag-reorder.spec.ts`: any Projects-page drag case (inert).
- `tests/layout-invariants.spec.ts`: T5 card case and any Projects row measurement through `.project-dates`/old padding.
- `tests/alignment.spec.ts`: `.project-list--cards .project-row` case.
- `tests/projects-screen.spec.ts`: likely the card toggle / view persistence and old row text.
- `tests/drop-target.spec.ts:45`: expects one `.project-list` in the drop region.
- Possibly any spec that reads a project row's text expecting "Edited <date>" or "n words" (values only now), or matches a row button's accessible name exactly.
- `tests/native-screens.js` references old selectors (native harness, not in the browser suite).

## Known loose ends (not fixed here)
- Until OB4 removes it, the toolbar reverse arrow and the header arrow can disagree (under Name the header shows ↑ ascending while the toolbar shows ↓ for "not reversed").
- `.project-list strong` / `.project-list small` rules (styles.css around line 1068, outside my range) are now dead; OB7 can remove them (lower the budget if any counted line goes).
- WebKit: the project row's open button uses `grid-template-columns: subgrid` and the closing rule uses `:has()`; both are the pieces to look at in the owner's Mac-app hand test (Chromium only so far).
