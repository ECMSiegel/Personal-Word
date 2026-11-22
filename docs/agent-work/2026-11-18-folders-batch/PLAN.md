# PLAN — Folders batch: Projects-page folders, real page view for Read and Bibliography, and eight fixes
Date: 2026-11-18 | Architect: Claude Code (Fable 5.2) | Project: Project 13 - Word Processor | Status: APPROVED (owner, 2026-11-18: "Write the plan. After you do so, post everything to the board")

## Goal
The owner can file projects into coloured, nestable, hand-ordered folders on the Projects page, reads the manuscript and bibliography on real pages, and no longer hits the eight small annoyances he listed.

## Request
Owner, 2026-11-18 (after hand-testing the 2026-11-17 build: "Everything looks amazing. Couple things. Use sonnet or opus sub agents"):
1. Projects page meta text: aligned columns in list view; in cards the dates stacked (Edited over Added) with words over sections to the right, so nothing "gets pushed around based on length".
2. "When you click tab to indent when writing, you can't just backspace/delete to get rid of it."
3. "We need page view as default for the bibliography and manuscript views." Clarified: "New projects should open in page view, but we need a real page view in manuscript and bibliography."
4. "We should be able to drag the project tabs at the top to reposition them."
5. "Siegel" must not be the default name; no placeholder needed.
6. Folders on the Projects page: add-folder icon left of the card/list icon; subfolders, rename and colour from the right-click menu; Move up / Move down and dragging for a custom order. Chosen design: option 1, inline collapsible folder headings (no clicking "into" a folder), in both list and card view.
7. "There is no delete option when you right click a source."
8. Sort dropdown is misaligned, too wide, needs no blue checkmark; the selected sort should itself be the button.
9. Research bar: a small grey arrow to collapse each of Note / Shortened note / Bibliography (confirmed reading) and "Used in".
10. Research bar: drag sources above/below each other, as in the left sidebar.

Owner's rule for custom order (verbatim sense): dragging "should automatically initiate custom view"; switching from another sort into Custom "returns to the custom order you set up prior"; "if you haven't set one up, it stays the same as whatever option you selected from until you switch the order around."

## Definition of done
- Projects page, list view: Edited / words / sections / Added sit in fixed columns that line up on every row, no wrapping at 1100 px wide.
- Projects page, card view: every card shows two columns of two lines: left "Edited <date>" over "Added <date>", right "<n> words" over "<n> sections"; the same position on every card whatever the numbers.
- The sort control is one button showing the current sort; its menu covers the button, is as wide as its longest row, has no checkmark, and lists Name, Added, Last edited, Custom.
- A folder button left of the view toggle adds a folder; folders show as collapsible headings with their projects beneath, in list and card view; right-click a folder: Collapse/Expand, New project here, New subfolder, Rename, Move up, Move down, Move to folder…, Delete folder, colour swatches (Color palette only). Right-click a project: Open, Move up, Move down, Move to folder…, Delete.
- Folders, their colours, nesting, collapsed state and custom order survive quitting and reopening the real app (stored in one file beside the projects, not in browser storage and not inside any project).
- Dragging a project or folder, or using Move up/down, switches the sort to Custom; Custom shows the hand-made order where one exists and otherwise the order of the sort you came from.
- Deleting a folder never deletes a project.
- Backspace at the very start of a Tab-indented paragraph removes the indent instead of joining paragraphs.
- New projects (and imported writing) open in Page view. Existing projects are unchanged.
- Read and Bibliography show white sheets with real page breaks and page labels, with a "Page view" toggle (on by default) to return to the continuous look.
- Project tabs can be dragged sideways and moved with Option+Left/Right; the order persists the same way tabs already do.
- "Page header text" inputs have no placeholder.
- Right-click a source in the sidebar offers "Delete source", which confirms, takes a safety snapshot, and still refuses while footnotes or quotes are linked.
- Research bar: Note, Shortened note, Bibliography and Used in each collapse with a small grey chevron; the state is remembered.
- Research bar: sources can be dragged, and moved with Option+Up/Down; the sidebar shows the same order.
- `npx tsc -b`, `npm test`, `cargo test`, `npm run build`, the built-app browser suite and `npm run tauri build` pass on the final tree (known intermittents listed in HANDOFF.md excepted, re-run alone).

## Non-goals
- No folder field inside saved projects; no change to src/save-queue.ts (HANDOFF.md line 11).
- No dragging a folder into another folder (use "Move to folder…"); no multi-select; no folder cards; no folders in the sidebar.
- Read keeps its current rendering gaps (ReadDocument ignores paragraph alignment and indents); footnotes stay one "Notes" list at the end, not per page. No promise that Read page breaks match the editor, PDF or Word.
- Existing projects are not switched to Page view. `defaultPageLayout.mode` stays "continuous".
- The research panel's own "Delete source" button keeps its current behaviour (no snapshot); mention only.
- No commit, no push, no native screen-taking run without the owner's word.

## Context (verified unless marked)
Base: main @ 3ac28af, pushed, working tree clean except untracked records. Line numbers are from that tree.
- Projects page: `src/components/ProjectLibrary.tsx` (509 lines). Props :35-52; prefs state :53-83; inline filter+sort :84-95; create menu :197-263; `.library-display.cluster.gap-2.flush-end` toolbar :272; Sort `<label className="cluster">Sort <Dropdown …>` :313-325; list wrapper `div.project-list.project-list--{list|cards}` :364; row `div.project-row.row` :366 with `button.emph-row.row-label` :367, `strong.project-name` :368, `span.project-dates` :369-382 holding `span.project-edited`, `span.project-words`, `span.project-sections`, unclassed Added span; `button.delete-entry` :384-391; `date()` :182-189. (verified by research agent)
- Projects page CSS: `src/styles.css` :1742-1776 (list), :1777-1805 (cards, grid `repeat(auto-fill, minmax(230px,1fr))`, card `.project-dates` wraps :1796-1800), :1871-1875 (narrow), `.library-display` :1964; `src/components/library.css` :121-127, :147-149, `.create-project .menu` min-width :71-73. (verified)
- Library preferences: `src/libraryPreferences.ts` — `LIBRARY_KEY`, `LIBRARY_SORTS = ["name","added","edited"]`, `LibraryPreferences {sort, reverse, view}`, `readLibraryPreferences`, `writeLibraryPreferences`; test `src/libraryPreferences.test.ts`. (verified)
- Dropdown: `src/components/Dropdown.tsx` :33-243 — trigger `.dropdown-button` :158-175, `<Popover className="dropdown-menu menu">` default `morph="edge"` :176-189, options with `.dropdown-check` + `Check` :206-238. `src/components/dropdown.css` :45-54 `.dropdown-menu {width:max-content; min-width:max(100%,150px)}`. Popover modes in `src/components/Popover.tsx` (:62-102 `placePopover`, anchor morph :238-242) and `popover.css` :2-8, :23-26. Popover rects are pinned by `tests/popover-bounds.spec.ts` + `tests/fixtures/popover-baseline-rects.json`. (verified)
- No library-level store exists; everything cross-project is WebView localStorage. Native projects are UUID folders under `app_data_dir()/projects`; `Store::list()` `src-tauri/src/store.rs` :208-238 skips any entry that is not a UUID-named directory (:214); `.personal-word-instance.lock` already lives in that root. `pub(crate) fn atomic(path, bytes)` store.rs :1250. Commands are registered in TWO `generate_handler!` lists, `src-tauri/src/lib.rs` :239-278 (native-smoke) and :280-304. Root reached as `state.0.lock()?.root` (see `storage_path` lib.rs :169-177). Rust tests use `tempfile::tempdir()` + `Store::new` (store.rs :1262-). (verified) Whether `src-tauri/src/smoke.rs` inspects the root: unknown.
- `src/storage.ts` :39-243: `export const storage = {…}`, each method `if (desktop) return invoke(…)` else `read/write` helpers (:25-31) under prefix `folio.preview.`. (verified)
- Context menu: `src/components/ContextMenu.tsx` — props `x, y, label, items, viaKeyboard, onClose`; items `{label, run, disabled?, danger?}` or `{kind:"swatches", label, value, options:[{id,label,colour}], onPick}`; positioned against its offsetParent; mounted today only in `ProjectSidebar.tsx` :1269-1278. Header swatch row built in `ProjectSidebar.tsx` :177-193 (`headerColourRow`); shown only when `headerColours` and `onHeaderColour` are passed (Color palette only, `src/App.tsx` :2484). (verified)
- Icons: lucide-react only; `Folder` / `FolderPlus` exist in the package, none imported. AGENTS.md line "no decorative folders/quills" (also `docs/design-system.md` :270). (verified)
- Drag: `src/components/dragReorder.ts` (`insertionIndex`, `reorder`, `moveWithin`, `keyboardMove`, `shiftFor`, `dropEdge`, `DragController`), hook `src/components/useDragReorder.ts` (vertical only: `clientY`, `translateY`, `rowTops`, :82-125; rows must be `:scope > [data-drag-index]` siblings, :70-71), styles `src/components/drag-reorder.css`. (verified)
- Tabs: `src/components/ProjectTabs.tsx` (42 lines; props `tabs, activeId, onSelect, onClose, onLibrary`); state `src/App.tsx` :287-291, persisted :326-328, rendered :2292-2310. (verified)
- Tab indent: `src/editor/indent.ts` — `indentKeys()` :147-166 (Tab / Shift-Tab), `handleIndent` :115-127, `indentTextSelection` :99-113, `indentParagraphStart(delta, documentIndent)` :64-96; attributes `firstLineIndent`, `indentLeft` in `src/editor/formatting.ts` :49-62; wired `src/Writer.tsx` :677-680. No Backspace handler exists for indents (verified by grep); that default Backspace therefore joins paragraphs is inferred, not reproduced.
- Page view: `Project.pageLayout?` `src/model.ts` :43; `defaultPageLayout` `src/editor/formatting.ts` :121 (continuous); new-project mode chosen only at `src/App.tsx` :1488-1493 (`template.id === "chicago" ? "pages" : "continuous"`); imports (`confirmImport` App.tsx :1548) set none. Many specs toggle "Page view" assuming continuous (`tests/pages-helpers.ts` :71-76 and the list in FB13). (verified)
- Pagination: `src/editor/pagination.ts` — pure `planPages(blocks: BlockBox[], geometry: PageGeometry)` :151 (unit-tested); measuring is tied to `EditorView` (`computeBoundaries` :335); `offsetWithin` :49 exported; `glyphLines` :269 and `firstCharBelow` :296 not exported (portability to static DOM: unknown). Sheet CSS `src/editor/editor.css` :555-643 (`.is-paged`, `.editor-paper`, `.page-sheet`, `.page-label`, `.writing-surface`, `.page-spacer`). `paperGeometry(layout)` formatting.ts :127. `src/editor/PageLabels.tsx` props `{pages, geometry, margin, settings, templateId}`. Writer renders sheets at `src/Writer.tsx` :2194-2287 and sets `pageVars` ~:1135-1146. (verified)
- Read view: inline JSX `src/App.tsx` :2710-2865 (`div.manuscript-read`; reader toolbar :2711-2775; sections; `.reader-footnotes`; `.reader-bibliography`); `reader` state :315-335 (`personal-word.reader` = `{font,size,spacing}`); `src/components/ReadDocument.tsx` is a static React renderer. CSS `src/styles.css` :1255-1270. (verified)
- Bibliography: `src/research/BibliographyPage.tsx` (74 lines), mounted App.tsx :2679-2693, CSS `src/research/research.css` :531-562. (verified)
- "Siegel": only `src/export/ExportPanel.tsx` :166 and `src/editor/PageHeaderRows.tsx` :19 (placeholders); a doc comment at `src/research/types.ts` :95. (verified by grep, 2026-11-18)
- Sidebar source menu: `collectionRow()` `src/components/ProjectSidebar.tsx` :567-637 (research rows :596-614), moves :1015-1032; pinned by `tests/sidebar-context-menu.spec.ts` :275-310. `removeSource(data, id)` `src/research/citationActions.ts` :42-46 returns an error string when linked. Destructive pattern: `remove()` App.tsx :1119-1160 (`setChoice` → `queue.flush()` → `storage.snapshot(id, "Before deleting …")` → `mutate`). (verified)
- Research panel: `src/research/ResearchPanel.tsx` (838 lines): source list ~:606-632 (`li.source-item`, `button.source-toggle.row`, chevron rotate CSS `research.css` :227-239), `renderSource` ~:325-357 (`section.citation-zone`, three `<Preview>`, `section.used-in`), `Preview` in `src/research/Cite.tsx` :8-10. Sources order = array order of `project.research.sources`; reducer `reorderResearch` App.tsx :1236-1250, passed to the sidebar at :2488; sidebar hook use `ProjectSidebar.tsx` :396-404. (verified)

## Rules in force
- Never touch real projects; isolated test storage; keep `folio.*` keys — `AGENTS.md` (Preserve writing).
- Safety snapshot before destructive edits — `AGENTS.md`.
- Read `docs/design-system.md` before any CSS. Spacing only through `src/components/layout.css` primitives; `src/layoutBudget.json` numbers may only go down; insets from `--edge`; z-index ≥ 10 via `--layer-*` — `AGENTS.md`, `HANDOFF.md` rules.
- One shared hover rule; icons outside the toolbar magnify through `icon-magnify.css`; every hover action needs keyboard access; square corners, flat surfaces; UI dash is `--` — `AGENTS.md`.
- Shared, region-edit-only, never registered: `src/styles.css`, `src/App.tsx`, `src/Writer.tsx`, `src/editor/editor.css`, `src/components/ProjectSidebar.tsx`, `src/layoutBudget.json`, `tests/layout-invariants.spec.ts`, `docs/design-system.md`. Use the Edit tool on small regions; never whole-file rewrite, never revert — `HANDOFF.md`.
- CSS load order: component stylesheets load before layout.css; delete an old declaration rather than override — `HANDOFF.md`.
- Small fixes run only the specs they touch; the full browser suite runs once per batch — `AGENTS.md`.
- Serial lock around every build and Playwright run; pinned Node; tests must pass against the built app — `HANDOFF.md` (commands below).
- New test must be shown failing first — workspace `AGENTS.md`.
- Never git stash/checkout/reset/clean, never rm -rf, no package installs — `HANDOFF.md`.
- Workers: Sonnet unless a task says Opus; only one Opus task runs at a time; every task is reviewed on Opus — owner memory + this request.

## Common commands (every task)
```sh
cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
npx tsc -b                      # expect no output
npx vitest run <file>           # unit
# browser specs: take the serial lock first, release it even on failure
until mkdir node_modules/.cache/personal-word-beta/serial-check.lock 2>/dev/null; do sleep 20; done
echo "<task> $$" > node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt
npx playwright test tests/<spec> --workers=1 --trace off --output test-results/fb-<task>
rm node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt; rmdir node_modules/.cache/personal-word-beta/serial-check.lock
```
Each task writes `docs/agent-work/2026-11-18-folders-batch/notes/<task>.md` (what changed, the fail-first output, the passing output) and nothing else outside its Files.

## Approach
- Folders live in one JSON file, `library.json`, in the projects root, read and written whole through two new Rust commands; the browser preview uses `folio.preview.library`. Rejected: a field in each project (changes "Edited", repeats the saved-header design that broke recovery); localStorage only (lost if WebView storage is cleared).
- Folder logic is a pure TypeScript module with unit tests; the page only renders it.
- Presentation: inline collapsible folder headings (owner's choice). In every container: subfolders first, then projects.
- Project/folder dragging on the Projects page uses a new small hit-testing drag (drop line, no live shifting) because the existing vertical hook cannot cross containers or handle a grid. Tabs and research sources reuse the existing hook (tabs via a new x axis).
- Read and Bibliography get pages from a new static-DOM measurer feeding the existing pure `planPages`, drawn with the existing `.is-paged` sheet CSS and `PageLabels`. Rejected: read-only Writer (Writer has no read-only mode and is one entry per editor); CSS-only sheets (no real breaks).
- Serial chains where files collide: Projects page FB1 → FB2 → FB4 → FB5 (all edit ProjectLibrary.tsx); research panel FB9 → FB10. FB13 (default page view) runs after everything because it changes what every new-project test starts in. FB14 validates.

## Tasks

### FB1 — Projects meta layout: fixed columns in list, two-by-two in cards (Sonnet)
- Files: `src/components/ProjectLibrary.tsx` (:369-382 only), `src/components/library.css`, region `src/styles.css` :1769-1776, :1796-1800, :1871-1875, `tests/w9-projects-page.spec.ts`, `tests/fb-projects-meta.spec.ts` (new).
- Interfaces: provides markup later tasks keep: inside `span.project-dates`, four spans in this DOM order with these classes: `project-edited`, `project-added` (class added to the Added span), `project-words`, `project-sections`. Uses none.
- Steps:
  1. Add class `project-added` to the Added span and reorder the spans to edited, added, words, sections.
  2. Cards: make `.project-list--cards .project-dates` a two-column grid, `grid-auto-flow: column; grid-template-rows: auto auto; grid-template-columns: 1fr 7.5em;` (a fixed second track, so the right column starts at the same place on every card) so column 1 is Edited over Added and column 2 is words over sections. Remove the flex-wrap rule and its `!important`s.
  3. List: make `.project-list--list .project-dates` a four-column grid with fixed tracks wide enough for "Edited Sep 30, 2026", "999,999 words", "999 sections", "Added Sep 30, 2026" at `--type-small` (start from `10.5em 7em 6.5em 10.5em`; visual order edited, words, sections, added via `order` or grid-column), `white-space: nowrap`, text right-aligned in each track. A project with no counts leaves its two tracks empty, not collapsed.
  4. Keep the ≤700 px rule working (stack to two lines).
  5. Update the order assertions in `tests/w9-projects-page.spec.ts` (~:183-240) to the visual order, not DOM order.
  6. New spec: seed three projects with very different titles/counts; assert in list view each of the four spans has the same `left` (±1 px) across rows and no row is taller than the others; in card view assert `project-added` is directly below `project-edited` (same left, greater top) and `project-sections` directly below `project-words`, identical offsets within every card.
- Acceptance check: `npx playwright test tests/fb-projects-meta.spec.ts tests/w9-projects-page.spec.ts tests/projects-screen.spec.ts --workers=1` → all pass; `npx vitest run src/layoutPrimitives.test.ts` → pass.
- Fail-first: run `tests/fb-projects-meta.spec.ts` before steps 1-4 → fails on column alignment.
- Stop and ask if: the list columns cannot fit beside a 15 px title at 1100 px window width without truncating the title below 12 characters.
- Default if unanswered: switch dates to numeric `MM/DD/YY` in list view only (owner pre-approved this fallback) and say so in the note.

### FB2 — Sort button: the current sort is the button; add Custom (Sonnet)
- Files: `src/components/ProjectLibrary.tsx` (:84-95, :313-325), `src/components/Dropdown.tsx`, `src/components/dropdown.css`, `src/libraryPreferences.ts`, `src/libraryPreferences.test.ts`, `tests/fb-sort-menu.spec.ts` (new), `tests/w9-projects-page.spec.ts`, `tests/t10-dropdown-label.spec.ts`, `tests/fixtures/popover-baseline-rects.json`.
- Interfaces: depends on FB1 (same file). Provides, in `src/libraryPreferences.ts`: `LIBRARY_SORTS = ["name","added","edited","custom"]`; `LibraryPreferences` gains `fallbackSort: "name"|"added"|"edited"` (default `"edited"`); when `sort` changes to `"custom"` the previous non-custom sort is written to `fallbackSort`. Provides in ProjectLibrary a pure exported helper `sortProjects(projects: Summary[], sort: "name"|"added"|"edited", reverse: boolean): Summary[]` (the current inline logic moved out unchanged). Provides Dropdown props `cover?: boolean` (use Popover `morph="anchor"`, menu top-left on the trigger, width = max(trigger, longest row)) and `plain?: boolean` (no check column; current row is weight 600 only).
- Steps:
  1. Add the two optional Dropdown props; default behaviour everywhere else is byte-identical.
  2. On the Projects page drop the visible word "Sort" (keep `aria-label="Sort projects"`), pass `cover plain`, add option `custom` / "Custom".
  3. With `sort === "custom"` and no folders feature yet, show `sortProjects(…, fallbackSort, reverse)`; the reverse button is `disabled` while Custom is selected.
  4. Extend prefs validation and tests (unknown `fallbackSort` falls back to `"edited"`).
  5. New spec: menu left edge equals trigger left edge (±1), menu top equals trigger top (±1), menu width ≤ trigger width + 24 px, no `.dropdown-check` in the menu, four options, choosing Custom after "Added" keeps the Added order.
  6. Regenerate only the Sort entry in `popover-baseline-rects.json` and say so in the note.
- Acceptance check: `npx vitest run src/libraryPreferences.test.ts` → pass; `npx playwright test tests/fb-sort-menu.spec.ts tests/w9-projects-page.spec.ts tests/t10-dropdown-label.spec.ts tests/popover-bounds.spec.ts --workers=1` → pass.
- Fail-first: `tests/fb-sort-menu.spec.ts` on the tree before step 1 → fails (check column present, menu below the trigger).
- Stop and ask if: any other Dropdown's rect in `popover-bounds.spec.ts` changes.
- Default if unanswered: none — must ask.

### FB3 — Library store: folders model, library.json, storage methods (Sonnet)
- Files: `src/library/folders.ts` (new), `src/library/folders.test.ts` (new), `src/storage.ts`, `src/storage.test.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/store.rs`.
- Interfaces: uses none. Provides, from `src/library/folders.ts`:
  ```ts
  export type LibraryFolder = { id: string; name: string; parent: string | null; colour?: string; collapsed?: boolean };
  export type LibraryState = { version: 1; folders: LibraryFolder[]; placement: Record<string, string>; order: Record<string, string[]> };
  export const ROOT = "root";                       // container key for the top level in `order`
  export const emptyLibrary: LibraryState;
  export function parseLibrary(raw: unknown): LibraryState;            // never throws; bad input → emptyLibrary; drops folders whose parent is missing or cyclic to parent null
  export function containerOf(state, projectId): string;                // folder id, or ROOT when unplaced or the folder is unknown
  export function childFolders(state, parent: string | null): LibraryFolder[];   // array order
  export function addFolder(state, name, parent: string | null): { state: LibraryState; id: string };
  export function renameFolder(state, id, name): LibraryState;          // trims; empty name = no change
  export function setFolderColour(state, id, colour: string | undefined): LibraryState;
  export function setFolderCollapsed(state, id, collapsed: boolean): LibraryState;
  export function moveFolder(state, id, parent: string | null): LibraryState;     // refuses self/descendant (returns state)
  export function orderedFolders(state, parent: string | null, shown: LibraryFolder[]): LibraryFolder[]; // same rule as orderedProjects, using order["folders:" + (parent ?? ROOT)]
  export function reorderFolder(state, parent: string | null, shownFolderIds: string[], id: string, toIndex: number): LibraryState; // sets order["folders:" + (parent ?? ROOT)] = shownFolderIds with id removed then inserted at toIndex
  export function deleteFolder(state, id): LibraryState;                // child folders and projects move to the deleted folder's parent; its order list is dropped
  export function fileProject(state, projectId, folder: string | null): LibraryState; // sets/removes placement; removes the id from every order list
  export function orderedProjects(state, container: string, shown: Summary[]): Summary[]; // if order[container] exists: ids not in the list first (in `shown` order), then listed ids in list order; else `shown` unchanged
  export function hasCustomOrder(state, container: string): boolean;
  export function moveProject(state, container: string, shownIds: string[], projectId: string, toIndex: number): LibraryState; // ALWAYS rebuilds: order[container] = shownIds with projectId removed, then projectId inserted at toIndex (an index into that reduced list). Works when projectId was not in shownIds (a drop from another folder).
  ```
  and from `src/storage.ts`: `storage.readLibrary(): Promise<unknown>` (resolves `null` only when no library has ever been saved; REJECTS when the file exists but cannot be read or is not valid JSON, so a caller never mistakes a damaged file for an empty one) and `storage.writeLibrary(state: LibraryState): Promise<void>`. Native: `invoke("read_library")` returns `string | null` which storage JSON-parses (null → `null`; a parse error rejects); `invoke("write_library", { data: JSON.stringify(state) })`. Browser: `read("library", null)` / `write("library", state)`.
- Steps:
  1. Write `folders.ts` exactly to the signatures above; every function returns a new object (immutable); ids from `crypto.randomUUID()`.
  2. Unit tests for each function, including: cyclic parent input, delete with children, `moveProject` rebuilding from `shownIds` (including a project absent from them), `reorderFolder`/`orderedFolders`, `orderedProjects` with a project missing from the list, unknown folder in `placement`.
  3. Rust: `Store::read_library(&self) -> Result<Option<String>>` (reads `root/library.json`; missing file → `None`) and `Store::write_library(&self, data: &str) -> Result<()>` (reject input that is not valid JSON or is over 1 MB; if `library.json` exists, first copy it to `root/library.backup.json`; then write with `atomic`). Commands `read_library`, `write_library` in lib.rs, added to BOTH `generate_handler!` lists.
  4. Rust tests in the store test module with `tempfile::tempdir()`: round trip; missing file is `None`; invalid JSON refused and the old file kept; a second write leaves the first content in `library.backup.json`; `list()` still returns the same projects with `library.json` present.
  5. `storage.ts` methods + tests for both branches (`setDesktopForTesting`).
- Acceptance check: `npx vitest run src/library/folders.test.ts src/storage.test.ts` → pass; `cd src-tauri && cargo test --offline library` → the four new tests pass; `cargo test --offline` → 0 failed; `npx tsc -b` → clean.
- Fail-first: write the tests first and run them before the implementation → fail to compile / fail.
- Stop and ask if: `src-tauri/src/smoke.rs` or any native check lists the projects root and would trip on `library.json`; or `cargo test` needs network.
- Default if unanswered: none — must ask.

### FB4 — Folders on the Projects page (Opus)
- Files: `src/components/ProjectLibrary.tsx`, `src/library/useLibrary.ts` (new), `src/library/LibraryFolders.tsx` (new, if splitting helps), `src/library/folders.css` (new; imported by the component that uses it, as `ProjectLibrary.tsx` :17 does with library.css), `src/components/library.css`, regions of `src/styles.css` (:1742-1805), region `src/App.tsx` (:1443-1500 `create`, :2310-2362 ProjectLibrary props), region `src/layoutBudget.json` (an entry for the new stylesheet at 0, only if the guard asks for one), `tests/fb-folders.spec.ts` (new), `tests/w9-projects-page.spec.ts`, `tests/projects-screen.spec.ts`, `tests/alignment.spec.ts`.
- Interfaces: depends on FB2 and FB3; uses everything FB3 provides and `sortProjects` from FB2. Provides:
  - `useLibrary(): { state: LibraryState; update(fn: (s: LibraryState) => LibraryState): void }` — loads once with `storage.readLibrary()` + `parseLibrary`, `update` sets state and calls `storage.writeLibrary` (failures go to the existing `onDropError` banner text "Folders could not be saved."). If the first read rejects, show "Folders could not be loaded.", render every project at the top level, and make `update` do nothing for the rest of the session (never write over a file that could not be read).
  - `ProjectLibrary` prop change: `onCreate: (templateId?: string, folderId?: string) => void`; new prop `colours?: { id: string; label: string; colour: string }[]` (passed only in the Color palette, same eight as the sidebar's header swatches).
  - `App.create` files the new project: after the project id exists, `await storage.writeLibrary(fileProject(parseLibrary(await storage.readLibrary()), id, folderId))` when `folderId` is given.
  - DOM hooks FB5 relies on: each folder is `section.library-folder[data-folder-id]` containing `div.folder-heading.row[data-folder-heading]` and `div.folder-body`; each container's projects sit in `div.folder-projects[data-container="<folder id | root>"]` whose children are the existing `div.project-row[data-project-id]`.
- Steps:
  1. Toolbar: add `button[aria-label="New folder"]` with lucide `FolderPlus`, immediately left of the view toggle, same slot size and icon-magnify class as its neighbours.
  2. Render order in every container: child folders (by name; while sort is Custom, `orderedFolders` applied to that by-name list, so folders also stay put until the first hand reorder) then that container's projects (`sortProjects` with the active sort, or with `fallbackSort` plus `orderedProjects` when Custom). The top level renders the same way with container `root`. `div.project-list--list|cards` class stays on each `div.folder-projects` so FB1's CSS applies unchanged; card grids sit under their heading.
  3. Folder heading: chevron button (`aria-expanded`, collapses the body, persisted via `setFolderCollapsed`), lucide `Folder` icon tinted with the folder colour (Color palette only; otherwise `--muted`), name at 13 px bold in the text colour, a count "-- n" in `--muted`. Indent each nesting level by one `--slot` on the heading only.
  4. New folder / New subfolder: add the folder, then show its name as an inline text input, focused and selected; Enter or blur saves, Escape cancels (a cancelled brand-new folder is removed). Rename uses the same input.
  5. Mount `ContextMenu` in ProjectLibrary (a `position: relative` wrapper as its offsetParent; right-click and the keyboard menu key / Shift+F10 both open it, `viaKeyboard` set accordingly). Folder items, in order: Collapse|Expand, New project here (calls `onCreate(undefined, id)` — the default template), New subfolder, Rename, Move up, Move down, Move to folder…, Delete folder (danger), then the swatches row when `colours` is passed (`value` = current colour, picking the current one clears it). Project items: Open, Move up, Move down, Move to folder…, Delete (danger, calls the existing `onDelete`). In this task Move up/Move down are present but `disabled` (FB5 wires them).
  6. "Move to folder…" replaces the open menu, at the same point, with one row per destination: "Top level" then every folder as an indented path ("Essays / Drafts"); the current location is `disabled`; for a folder, itself and its descendants are omitted. Picking a row calls `fileProject` / `moveFolder`.
  7. Delete folder runs `deleteFolder` at once (nothing is destroyed; no confirm).
  8. Search: while the search box has text, hide folder headings and show one flat list of matching projects (existing behaviour), each with its folder path in `--muted` after the title.
  9. A project whose folder is collapsed is not rendered; an empty folder shows only its heading.
  10. CSS in `src/library/folders.css` using layout primitives only (`.row`, `.cluster`, `.slot`, `.gap-N`). Update any existing spec that pins the Projects toolbar's buttons or their order (`tests/w9-projects-page.spec.ts`, `tests/projects-screen.spec.ts`, `tests/alignment.spec.ts`) for the new button; do not loosen them.
  11. Spec `tests/fb-folders.spec.ts` (browser preview storage, seeded projects): create folder → appears in rename mode → name saved on blur; subfolder nests; Move to folder… files a project and it renders under that heading in list AND card view; collapse hides its rows and survives reload; rename; delete folder moves its project up and the project still opens; search shows flat results with the path; swatch pick sets the icon colour (seed the Color palette the way the swatches test in `tests/sidebar-context-menu.spec.ts` (~:255) does); "New project here" lands the project in that folder after returning to Projects; keyboard: menu key on a focused folder heading opens the menu and arrow keys move in it.
- Acceptance check: `npx playwright test tests/fb-folders.spec.ts tests/projects-screen.spec.ts tests/w9-projects-page.spec.ts tests/fb-projects-meta.spec.ts tests/fb-sort-menu.spec.ts tests/sb-motion-projects.spec.ts --workers=1` → pass; `npx vitest run src/layoutPrimitives.test.ts src/hoverEmphasis.test.ts` → pass; `npx tsc -b` → clean.
- Fail-first: `tests/fb-folders.spec.ts` before step 1 → fails at "New folder" button not found.
- Stop and ask if: a hand-written margin/padding/gap/height is unavoidable (budget may not grow); the sidebar's eight swatch options are not reachable without editing `ProjectSidebar.tsx` beyond adding one `export`; `create` in App.tsx cannot learn the new project's id before the library is written.
- Default if unanswered: none — must ask.

### FB5 — Custom order: Move up/down, dragging, auto-switch to Custom (Opus)
- Files: `src/components/ProjectLibrary.tsx`, `src/library/LibraryFolders.tsx`, `src/library/useLibraryDrag.ts` (new), `src/library/libraryDrag.ts` (new, pure), `src/library/libraryDrag.test.ts` (new), `src/library/folders.css`, `tests/fb-folder-order.spec.ts` (new).
- Interfaces: depends on FB4; uses FB3's `moveProject`, `reorderFolder`, `orderedFolders`, `fileProject`, `hasCustomOrder`, `orderedProjects` and FB2's `fallbackSort`. Provides none.
- Steps:
  1. Any reorder (menu, keyboard or drag) first sets `sort: "custom"` through `changePrefs` (which records `fallbackSort`), then applies the move. Project moves call `moveProject(state, container, shownIds, id, toIndex)` where `shownIds` is exactly the order on screen in that container at that moment, so a container with no custom order starts from what the owner was looking at. Folder moves call `reorderFolder(state, parent, shownFolderIds, id, toIndex)` with the sibling order on screen. While the search box has text, every reorder control is off (menu items disabled, no drag, no Option+arrows), so a filtered list is never saved as an order.
  2. Enable Move up / Move down for projects (within their container) and folders (among siblings); disabled at the ends. Option+Up / Option+Down on a focused project row or folder heading does the same; announce "Moved <name> to position n of m" in a polite live region and keep focus on the moved row (copy the sidebar's `moveBy` behaviour, `ProjectSidebar.tsx` :456-485).
  3. Pure `libraryDrag.ts`: `dropTarget(point: {x:number;y:number}, rects: {id:string; kind:"project"|"folder"; container:string; rect:DOMRectLike}[], view: "list"|"cards", dragged: {id:string; kind:"project"|"folder"}): null | { kind:"before"|"after"; id:string; container:string } | { kind:"into"; folder:string }`. Rules: a project over another project → before/after by the row midpoint on y (list) or the card midpoint on x (cards); a project over a folder heading → into; a folder over a sibling folder heading → before/after on y; anything else → null. Unit-test each rule.
  4. Hook `useLibraryDrag`: pointerdown on a project row or folder heading, a 4 px threshold, then `data-drag-state="lifted"` on the source and `data-drag-edge` (start|end) on the target row or `data-drop-into` on a target heading; pointerup applies (`fileProject` first when the container changes, then `moveProject` with the TARGET container's on-screen ids; `reorderFolder` for folders); Escape cancels. A press on the trash button, chevron or an input never starts a drag; a drag suppresses the click that would open the project. No live shifting of other rows. Respect Reduce Motion (no transition).
  5. CSS: reuse the 2 px accent drop line look from `drag-reorder.css` (horizontal line in list, vertical line in cards); `data-drop-into` heading uses weight and colour, never a fill.
  6. Custom with no order set: the container shows `fallbackSort` order (already true from FB4 step 2); after the first move it shows the hand-made order; switching to Name and back to Custom shows the hand-made order again.
  7. Spec: (a) sort Added → drag row 3 above row 1 → sort button reads "Custom", order is 3,1,2,… ; (b) choose Name → alphabetical; choose Custom → 3,1,2 again; (c) fresh storage, sort Name → choose Custom → still alphabetical; (d) Move down from the menu switches to Custom; (e) drag a project onto a folder heading files it; (f) cards view drag reorders; (g) Option+Down moves and focus stays; (h) a folder dragged below its sibling reorders; (i) order survives reload.
- Acceptance check: `npx vitest run src/library/libraryDrag.test.ts` → pass; `npx playwright test tests/fb-folder-order.spec.ts tests/fb-folders.spec.ts tests/projects-screen.spec.ts --workers=1` → pass.
- Fail-first: spec case (a) before step 1 → fails (rows do not move).
- Stop and ask if: pointer dragging conflicts with the Projects ↔ document open animation (`src/research/pageMotion.ts`) in a way a click-suppression flag does not solve.
- Default if unanswered: none — must ask.

### FB6 — Backspace removes a Tab indent (Sonnet)
- Files: `src/editor/indent.ts`, `src/editor/indent.test.ts`, `tests/ci-indent.spec.ts`.
- Interfaces: none.
- Steps:
  1. In `indentKeys()` add a `Backspace` shortcut: when not screenplay, the selection is an empty caret at `parentOffset === 0` of a paragraph or heading that is not inside a list item, and the block has `indentLeft` > 0 or an explicit `firstLineIndent` greater than 0, run the same change Shift-Tab makes there (`indentParagraphStart(-1, documentIndent)`) and return `true`. Otherwise return `false` so the default Backspace runs.
  2. Unit tests: first-line-indented paragraph → one Backspace clears `firstLineIndent`, text unchanged, paragraph count unchanged; `indentLeft: 1in` → two Backspaces reach 0, a third joins with the previous paragraph (default); caret mid-paragraph → default; inside a list item → default; a project whose document default is a first-line indent (`documentIndent` 0.5) with no explicit attribute → default (nothing to remove).
  3. Browser test in `tests/ci-indent.spec.ts`: type a line, Enter, Tab, type "x", Home, Backspace → still two paragraphs and the second has no text-indent.
- Acceptance check: `npx vitest run src/editor/indent.test.ts` → pass; `npx playwright test tests/ci-indent.spec.ts --workers=1` → pass.
- Fail-first: the new unit test before step 1 → fails (paragraphs join).
- Stop and ask if: the explicit-vs-document-default first-line indent cannot be told apart from the node attributes.
- Default if unanswered: none — must ask.

### FB7 — Remove the "Siegel" placeholder (Sonnet)
- Files: `src/export/ExportPanel.tsx` (:166), `src/editor/PageHeaderRows.tsx` (:19), `src/research/types.ts` (:95 comment), `tests/sb-page-header.spec.ts`.
- Interfaces: none.
- Steps: 1. Delete both `placeholder="Siegel"` attributes. 2. Change the doc comment example to `("Lastname")`. 3. In `tests/sb-page-header.spec.ts` add an assertion that both "Page header text" inputs have no `placeholder` attribute; leave the tests that type "Siegel" as a value alone.
- Acceptance check: `grep -rn 'placeholder="Siegel"' src` → no output; `npx playwright test tests/sb-page-header.spec.ts --workers=1` → pass.
- Fail-first: the new assertion before step 1 → fails.
- Stop and ask if: the spec locates either input by its placeholder.
- Default if unanswered: locate by `aria-label="Page header text"` instead.

### FB8 — "Delete source" in the sidebar right-click menu (Sonnet)
- Files: region `src/components/ProjectSidebar.tsx` (Props type; :596-614), region `src/App.tsx` (new function beside `deleteTopSection` :1214-1235; sidebar props ~:2480-2490), `tests/sidebar-context-menu.spec.ts`.
- Interfaces: provides sidebar prop `onDeleteSource?: (id: string) => void`. Uses `removeSource` (`src/research/citationActions.ts` :42-46).
- Steps:
  1. App: `deleteSource(id)`: call `removeSource(project.research, id)`; if it returns its refusal string, show that string through the existing error banner (`setError`) and stop. Otherwise `setChoice` with a destructive confirm ("Delete source “<title>”?", button "Delete source"), then `queue.flush()`, `storage.snapshot(project.id, "Before deleting source “<title>”")`, then `mutate` with the filtered research. Follow `remove()` :1119-1160 line for line for ordering and error handling.
  2. Sidebar: for a source row only (not its PDF row, not notes, not Bibliography) append `{ label: "Delete source", danger: true, run: () => props.onDeleteSource?.(sourceId) }` after the Move items, only when the prop is passed.
  3. Tests: menu for a source now reads Open, Move up, Move down, Delete source (update :275-310); deleting an unlinked source asks for confirmation, removes the row and adds a "Before deleting source" entry in History; a source with a linked footnote shows the refusal text and stays.
- Acceptance check: `npx playwright test tests/sidebar-context-menu.spec.ts tests/research.spec.ts --workers=1` → pass.
- Fail-first: the new menu assertion before step 2 → fails.
- Stop and ask if: `removeSource`'s return shape is not "error string or new data".
- Default if unanswered: none — must ask.

### FB9 — Research bar: collapse Note / Shortened note / Bibliography / Used in (Sonnet)
- Files: `src/research/ResearchPanel.tsx` (~:325-357), `src/research/Cite.tsx` (:8-10), `src/research/research.css`, `src/research/collapsePreferences.ts` (new), `src/research/collapsePreferences.test.ts` (new), `tests/fb-research-collapse.spec.ts` (new), `tests/w9-research-panel.spec.ts`, `tests/w9-used-in.spec.ts`.
- Interfaces: provides `readCollapsed(store): Record<"note"|"short"|"bibliography"|"usedIn", boolean>` and `writeCollapsed(store, value)` on localStorage key `personal-word.researchCollapsed` (app-wide; bad JSON → all false). `Preview` gains optional props `collapsed?: boolean; onToggle?: () => void`; without them it renders exactly as today (the Cite dialog must not change).
- Steps:
  1. When `onToggle` is given, `Preview`'s label becomes a button holding the label text and a lucide `ChevronRight` size 12, colour `--muted`, same small type as the label, rotated 90° when open (reuse the `.source-toggle` chevron rotate rule's transition, off under Reduce Motion); `aria-expanded`; the `p.citation-preview` is not rendered when collapsed.
  2. The "Used in" `h4` gets the same button; collapsed hides the hint line and the items.
  3. One state object in ResearchPanel, loaded from and saved to `collapsePreferences`.
  4. Hover/focus follows the shared rule (the button is a text control); no new hover CSS.
  5. Spec: each of the four toggles hides its body and flips `aria-expanded`; state survives closing/reopening the source and a page reload; Enter and Space toggle from the keyboard; the Cite dialog's previews have no chevron.
- Acceptance check: `npx vitest run src/research/collapsePreferences.test.ts src/hoverEmphasis.test.ts src/layoutPrimitives.test.ts` → pass; `npx playwright test tests/fb-research-collapse.spec.ts tests/w9-research-panel.spec.ts tests/w9-used-in.spec.ts tests/research.spec.ts --workers=1` → pass.
- Fail-first: new spec before step 1 → fails (no toggle button).
- Stop and ask if: `Preview` is used anywhere the new button would change layout without the props (it must not).
- Default if unanswered: none — must ask.

### FB10 — Research bar: drag sources to reorder (Sonnet)
- Files: `src/research/ResearchPanel.tsx` (~:606-632, Props), region `src/App.tsx` (ResearchPanel props ~:3099), `src/research/research.css`, `tests/fb-research-drag.spec.ts` (new).
- Interfaces: depends on FB9 (same file). Provides ResearchPanel prop `onReorderSources?: (id: string, toIndex: number) => void`; App passes `(id, to) => reorderResearch("sources", id, to)`.
- Steps:
  1. `useDragReorder({ items: <the sources shown>, onReorder })` on the `li.source-item` rows (spread `rowProps(i)` on each `li`); map shown index to the index in the full `data.sources` the same way `ProjectSidebar.tsx` :396-404 does; drag is off while the panel's list is filtered or searched, if it has such a mode.
  2. A press on anything inside an open source's body never starts a drag (only the `.source-toggle` row does); a drag suppresses the toggle click.
  3. Option+Up / Option+Down on a focused `.source-toggle` moves the source, announces it in a live region, and keeps focus (same wording as the sidebar).
  4. Spec: drag source 3 above source 1 → panel order and sidebar order both change; Option+Down works; order survives reload; clicking without dragging still opens the source.
- Acceptance check: `npx playwright test tests/fb-research-drag.spec.ts tests/drag-reorder.spec.ts tests/w9-research-panel.spec.ts tests/w9-research-motion.spec.ts --workers=1` → pass.
- Fail-first: new spec before step 1 → fails.
- Stop and ask if: `useDragReorder`'s sibling requirement fails for the `ul` (e.g. non-row children between items).
- Default if unanswered: none — must ask.

### FB11 — Drag project tabs (Sonnet)
- Files: `src/components/dragReorder.ts`, `src/components/dragReorder.test.ts`, `src/components/useDragReorder.ts`, `src/components/drag-reorder.css`, `src/components/ProjectTabs.tsx`, region `src/App.tsx` (:2292-2310), `tests/fb-tab-drag.spec.ts` (new).
- Interfaces: provides `useDragReorder` option `axis?: "x" | "y"` (default "y", vertical behaviour byte-identical); ProjectTabs prop `onReorder: (from: number, to: number) => void`; App passes `(from, to) => setTabs(t => reorder(t, from, to))` using the existing `reorder` helper in dragReorder.ts.
- Steps:
  1. Add the x axis: `clientX`, `translateX`, row lefts/widths, and a vertical 2 px drop line (`[data-drag-edge]` rules scoped to a `[data-drag-axis="x"]` container). Unit-test the pure functions for x where they take coordinates.
  2. ProjectTabs: `rowProps(i)` on each `div.project-tab`; the "Projects" button is not a row; a press on the close button never starts a drag; a drag suppresses tab selection.
  3. Option+Left / Option+Right on a focused tab title moves it one place, announces it in a live region, and keeps focus.
  4. Spec: three tabs, drag the third before the first → DOM order changes; with `personal-word.restoreTabs` true the order survives reload; Option+Right moves; a plain click still selects; the close button still closes.
- Acceptance check: `npx vitest run src/components/dragReorder.test.ts` → pass; `npx playwright test tests/fb-tab-drag.spec.ts tests/drag-reorder.spec.ts tests/features.spec.ts --workers=1` → pass.
- Fail-first: new spec before step 1 → fails.
- Stop and ask if: making the hook axis-aware needs changes to how sidebar callers use it.
- Default if unanswered: none — must ask.

### FB12 — Real page view for Read and Bibliography (Opus)
- Files: `src/editor/staticPagination.ts` (new), `src/editor/staticPagination.test.ts` (new), `src/editor/pagination.ts` (add `export` to existing helpers only), `src/components/PagedSheet.tsx` (new), `src/components/paged-sheet.css` (new; imported by PagedSheet.tsx; all new rules go here, NOT in research.css, which FB9/FB10 own), region `src/layoutBudget.json` (entry at 0 only if the guard asks), region `src/App.tsx` (:315-335 reader state, :2679-2693, :2710-2865), `src/research/BibliographyPage.tsx`, region `src/styles.css` (:1255-1270), `tests/fb-paged-read.spec.ts` (new).
- Interfaces: provides
  - `measureStatic(surface: HTMLElement): BlockBox[]` — one box per direct child of `surface`, in document order; `heading` true for h1-h3 and `.read-title`; `pageBreak` false; `lines()` from the element's text line rects.
  - `paginateStatic(surface: HTMLElement, geometry: PageGeometry): number` — removes every spacer it previously inserted (then `normalize()` on affected parents), measures, calls `planPages`, inserts `span.page-spacer[data-static]` elements of the planned heights (block boundary: before the block; inside a paragraph: at the first character of the line that moves), returns the page count.
  - `<PagedSheet layout={PageLayout} settings={DocumentSettings} templateId={string | undefined} contentKey={string} className?>{children}</PagedSheet>` — renders `div.editor-viewport.is-paged` (with the same `--page-*` variables Writer sets, from `paperGeometry(layout)`) › `div.editor-paper` › one `div.page-sheet` per page + `<PageLabels>` + `div.writing-surface` (keyed by `contentKey`, so React remounts it whenever content changes and never reconciles into spacer-mutated DOM). It re-runs `paginateStatic` in a layout effect on mount, on `contentKey` change, on width change (ResizeObserver), after `document.fonts.ready`, and when an image inside finishes loading. It scales down to fit a narrow pane with CSS `zoom = min(1, available width / page width)`.
  - Reader preference: `personal-word.reader` gains `paged: boolean`, default `true` (missing → true). One preference drives both Read and Bibliography.
- Steps:
  1. Read `pagination.ts` `measure()`, `glyphLines`, `firstCharBelow` in full; export what is reusable; write `staticPagination.ts` so the editor path is untouched.
  2. Unit-test `measureStatic` → `planPages` wiring with a fake element tree (jsdom rect stubs), and spacer removal being exact (DOM equals the original after undo).
  3. Build `PagedSheet`; reuse the `.is-paged` rules in `editor.css` as they are (add only what a non-Writer parent needs in `paged-sheet.css`, primitives only).
  4. Read: add a "Page view" toggle button (`aria-pressed`) to the "Reading display" toolbar; when on, everything from the project title down to the bibliography renders inside `<PagedSheet layout={project.pageLayout ?? {...defaultPageLayout, mode:"pages"}} …>`; reader font, size and spacing still apply inside; the toolbar stays outside the sheet. When off, today's markup is unchanged. Each direct child of the writing surface must be one block (flatten the per-section wrappers so paragraphs, titles and notes are direct children; a fragment per section is fine). The anchor `id={"read-" + e.id}` must survive on the section's title block: `src/App.tsx` :2063 and :2583 and `src/components/scrollspy.ts` :120 look it up. The eyebrow line and the "Export plain text" button stay above the sheet with the toolbar; in page view the eyebrow reads "MANUSCRIPT -- READ ONLY".
  5. Bibliography: same toggle in `.bibliography-controls`; when on, the heading and entries render inside `<PagedSheet>` and the controls stay above it.
  6. `contentKey` = project revision + reader font/size/spacing (Read) or + bibliography order/scope (Bibliography).
  7. Page view is now the default for Read and Bibliography, so existing specs that look inside them may break. Run `tests/scrollspy.spec.ts tests/floating.spec.ts tests/hs7-document-font.spec.ts tests/w9-fonts.spec.ts tests/hs9-top-level-sections.spec.ts tests/research.spec.ts tests/appearance.spec.ts tests/assets.spec.ts tests/hover-emphasis.spec.ts`; for each failure, make the test say which view it needs (seed `personal-word.reader` with `paged: false` where it tests the continuous look) following the shared-spec rule in Notes. Never weaken an assertion.
  8. Spec (browser): a seeded project long enough for three pages → Read shows ≥ 3 `.page-sheet`, no text line's box crosses a sheet's bottom margin edge (check every paragraph line rect against sheet content boxes), page labels follow the project's page-number settings; toggling "Page view" off restores `.manuscript-read` continuous markup and the choice survives reload; changing reading font size repaginates; Bibliography with 60 seeded sources shows ≥ 2 sheets and no entry line crossing; light and dark screenshots saved under `test-results/fb-FB12/` and looked at.
- Acceptance check: `npx vitest run src/editor/staticPagination.test.ts src/editor/pagination.test.ts src/components/ReadDocument.test.ts src/layoutPrimitives.test.ts` → pass; `npx playwright test tests/fb-paged-read.spec.ts tests/pages.spec.ts tests/features.spec.ts --workers=1` → pass, and the nine specs named in step 7 → pass.
- Fail-first: `tests/fb-paged-read.spec.ts` before step 3 → fails (no `.page-sheet` in Read).
- Stop and ask if: splitting a paragraph across pages in static DOM cannot be made reliable (line detection or spacer insertion); a Read block cannot be flattened to a direct child without breaking `ReadDocument.test.ts`; images resolving late make page counts oscillate.
- Default if unanswered: for the first condition only — move whole paragraphs to the next page (no mid-paragraph split), keep everything else, and state it at the top of the note so the owner is told. Others: none — must ask.

### FB13 — New projects and imported writing open in Page view (Sonnet; runs after every task above)
- Files: region `src/App.tsx` (:1488-1493, `confirmImport` ~:1548), `tests/` (whole folder, registered because any spec may assume continuous view), `src/model.test.ts` or the nearest existing unit test of project creation (only if one asserts the mode).
- Interfaces: depends on FB1-FB12 being done (it edits test files they own). Provides none.
- Steps:
  1. App.tsx :1489: `mode: "pages"` for every template. In `confirmImport`, give the imported project `pageLayout = { mode: "pages", paper: "letter", margin: (documentSettings margin in inches, default 1) * 96, zoom: 100 }` when it has none. Do not touch `importProject` (project.json recovery keeps what the file had) or `defaultPageLayout`.
  2. Build, then run the full built-app browser suite once in the background with a log (`PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/fb-FB13-a`), inside the serial lock.
  3. For each failure caused by the new default: make the test state its intent. Tests that need continuous view call a helper that sets continuous if not already (make `togglePageView`-style helpers in `tests/pages-helpers.ts` state-aware: `setPageView(page, on: boolean)` reading `aria-pressed` first); tests that need pages do the same with `true`. Never weaken an assertion and never change app code to suit a test. Known candidates: `tests/pages-helpers.ts` :71-76, `pages.spec.ts` :65, `page-break.spec.ts` :34/:81, `ruler.spec.ts` :26-36/:336, `accessibility.spec.ts` :107-144, `hover-emphasis.spec.ts` :184-186, `readme-shots.spec.ts` :259, `editor-toolbar.spec.ts` :171, `scrollspy.spec.ts` :507, `w9-blank-click.spec.ts` :42, `pages-gap.spec.ts` :93, plus the layout gallery/invariant specs.
  4. Add one new test (in `tests/features.spec.ts`): a new Blank project's "Page view" button is `aria-pressed="true"`; an existing seeded project with no `pageLayout` is still continuous.
  5. Re-run only the specs that failed, then the full suite once more to `test-results/fb-FB13-b`.
- Acceptance check: second full run → 0 failed apart from `tests/drop-target.spec.ts:123` and `tests/comments.spec.ts:36` (known intermittents; each re-run alone must pass).
- Fail-first: the new test in step 4 before step 1 → fails.
- Stop and ask if: more than 40 tests fail in the first run; or a failure shows a real page-view bug rather than a test assumption (list them; do not fix app code here).
- Default if unanswered: none — must ask.

### FB14 — Final validation, documents, rebuilt app (Sonnet)
- Files: `AGENTS.md`, `docs/design-system.md` (region), `docs/architecture.md`, `HANDOFF.md`, `docs/agent-work/2026-11-18-folders-batch/VALIDATION.md` (new).
- Interfaces: depends on FB13.
- Steps:
  1. AGENTS.md "Product and UI": change "no decorative folders/quills" to "no decorative quills; the only folder icons are the working ones on the Projects page (owner approved 2026-11-18)"; add one bullet: "Projects-page folders live in `library.json` in the projects root (browser preview: `folio.preview.library`), never inside a project. In each folder, subfolders come first, then projects. Custom is a sort; any hand reorder switches to it. Deleting a folder never deletes a project." Add under naming: library groups are "folders"/"subfolders", never "headers". Mirror in `docs/design-system.md` :270 and add the storage note to `docs/architecture.md`.
  2. Run, in order, logging to `VALIDATION.md`: `npx tsc -b`; `npm test`; `cd src-tauri && cargo test --offline --jobs 1 -- --test-threads=1`; inside the lock `npm run build` and the full built-app suite; `touch src-tauri/src/lib.rs && npm run tauri build`.
  3. Record the app path, binary time and sha256; copy the previous owner-tested bundle to `src-tauri/target/release/bundle/known-good-3ac28af/` BEFORE the rebuild (copy, never move or delete).
  4. Update `HANDOFF.md` with the batch state (CLAIMED), the hand-test list from "Definition of done", and what was not verified (native WebKit, real `library.json` in the real app).
- Acceptance check: `VALIDATION.md` shows every command with its result; `ls -la "src-tauri/target/release/bundle/macos/Personal Word.app/Contents/MacOS"` shows a binary newer than the last source edit.
- Fail-first: n/a: validation and documents only.
- Stop and ask if: any suite fails outside the two known intermittents.
- Default if unanswered: none — must ask.

## Validation (after all tasks, in order)
FB14 is the validation. In addition the owner verifies by hand in the rebuilt app (the only thing that upgrades CLAIMED to VERIFIED):
1. Projects page, both views: meta text lines up as described; sort button and menu.
2. Make a folder, a subfolder, rename, colour (Color palette), collapse; move a project in by menu and by drag; reorder by drag and Move up/down; switch sorts and return to Custom; quit and reopen the app: everything is as left.
3. Delete a folder holding a project: the project is still there and opens.
4. In a document: Tab then Backspace at the line start.
5. New project opens in Page view; an old project opens as before.
6. Read and Bibliography: pages, labels, the Page view toggle, a narrow split pane.
7. Drag tabs; right-click a source → Delete source; research bar chevrons and dragging; Page header text field is empty.

## Risks and rollback
- `library.json` is a new file in the projects root. Rollback: delete the two commands and the file is simply ignored (`list()` already skips it). It never holds writing.
- FB13 changes many tests. Rollback: revert App.tsx :1489 and the `confirmImport` lines; state-aware helpers stay valid either way.
- FB12 mutates React-rendered DOM. Contained by remounting on `contentKey` and by exact spacer removal; the continuous toggle is the user's escape hatch.
- FB2 changes the shared Dropdown; guarded by `tests/popover-bounds.spec.ts`.
- Nothing is committed by workers; the tree at 3ac28af is the rollback point for the whole batch.

## Open questions for the user
None blocking. Assumptions taken (say so if wrong): "manuscript view" means the Read screen; the AGENTS.md line "no decorative folders" is amended in FB14 to allow the working folder icons; imported writing also opens in Page view; one "Page view" toggle is shared by Read and Bibliography; "New project here" uses the default (first) template; folders sort by name when the sort is not Custom; deleting a folder asks no confirmation because nothing is destroyed.

## Notes for the implementer (traps, things NOT to do)
- Read only your own task plus "Rules in force" and "Common commands". Names in "Interfaces" are contracts: do not rename them.
- Shared files are edited by region with the Edit tool. If the lines you were given have moved, find the code by its content; if it is not there, stop and ask.
- Do not store anything about folders in a project, and do not touch `src/save-queue.ts`.
- Do not add a hover rule, a fill for selection, rounded corners, or a hand-written margin/padding/gap/height.
- Tests run against the built app in validation: no `import("/src/…")` in the page; wait for popover animations; hover a sidebar heading before clicking its view toggle.
- `src/Writer.tsx` toolbar focus calls are deliberate; no task in this plan needs to edit Writer.tsx.
- Browser tests prove nothing about the native file; FB3's cargo tests are the only automated proof of `library.json`.
- Shared specs: if a spec you do not own fails because of your change, run `python3 team/team.py owner "<path>"`. Unowned: register it on your task with `files add` and fix the test so it states its intent. Owned by a live task: message that task's owner and wait. `tests/layout-invariants.spec.ts` is region-edit-only and never registered.
- A new stylesheet is imported by the component that uses it. Run `npx vitest run src/layoutPrimitives.test.ts`; if it asks for a budget entry, add the file to `src/layoutBudget.json` at the number it prints, which must be 0.
- Board tasks T250, T253 and T278 are held: never claim them.
- Plan names FB1-FB14 map to board IDs in `BOARD-MAP.md` in this folder; `--depends` uses board IDs.
- Do not commit. Do not run the release app or anything that takes over the screen.

## As built (deviations)
- Folder bodies are indented one slot under their heading (not just the heading), via a new `.indent` layout primitive.
- `parseLibrary` throws `LibraryVersionError` for an unknown library version, and the file is then never written over.
- Nested card grids are capped at 256 px.
- Dragging a heading drops the file first.
- Research collapse chevrons are 14 px (the house chevron size), not 12.
- FB13's 40-failure stop rule was lifted by the coordinator (62 tests updated).
