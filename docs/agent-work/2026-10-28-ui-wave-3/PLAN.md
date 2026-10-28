# PLAN -- UI wave 3: icons-only toolbar, no box highlights, one name, aligned split, vertical pages, shortcuts, drag reorder, scoped drops
Date: 2026-10-28 | Architect: Claude Code (Fable 5.1) | Project: Project 13 - Word Processor | Status: APPROVED (owner, 2026-10-28 00:45 EDT: "this is good"; open questions answered with the defaults below)

## Goal
A writer opens Personal Word and finds a toolbar of plain icons with nothing hidden that could fit, hover and selection shown by weight and colour instead of grey boxes, the project named once at the top, two side-by-side panes whose pages line up, page view that scrolls down like a document, a page break on Shift+Enter with their own shortcuts set in Settings, tables edited by right-click, sidebar rows moved by dragging, and files dropped onto the thing they belong to -- with every change checked by a reviewer against a written interface checklist.

## Request
Owner, 2026-10-28, after the wave-2 hand check (quoted words are the owner's). Decisions on wave-2 items: 1-3 "go back to icon only for the top bar. I don't want things under more if possible"; 5 "clicking away should save"; 6 "take away the grey box highlight across the board, and just have icons go bold when hovered/selected ... the trash can and other icons still get the grey box which looks worse ... Section headers go bold and colored and the selection within the section does the same. That doubling up doesn't look good"; 7 whole-version restore closing the split "fine as it"; 8 split undo/scroll reset and footer page lag "worth fixing"; 9 "put the notes under the research section". New: split panes "misaligned" in page view; the project name "appear[s] three times in the top left"; "The settings page should be accessible from the projects page"; "Make bibliography standard in the research section on the chicago template, not all. It should only pop up on other templates if a source/footnote is used"; "page view scrolls horizontally, not vertically. It should scroll vertically"; "Add a page break shortcut (Shift + Enter) and a menu ... in the settings where you can set your hot keyboard shortcuts"; "delete/edit tables with a right click"; Projects screen: "get rid of the projects header ... start new project button left aligned and the stuff we currently have right aligned"; capitalisation of "Start new project" open to feedback; align text optically, not boxes; integrate the useful UI/UX skill repos and component links (research in `RESEARCH.md` beside this plan). Direction chosen in chat: lanes by file ownership, everything in one plan, maximise parallel work. Answers given in chat: accept that indent, spacing, view, aids and setup stay under More at the default 1240 px window once Insert is back on the bar; include the pagination rewrite as its own lane; include the shortcuts Settings section for app-owned actions; keep "Start new project" in sentence case.

## Definition of done
- The format bar shows icons only at every width; at a 1240 x 840 window with the sidebar pinned at 270 px, Insert image and Insert table are on the bar; the More menu still lists overflowed controls as labelled rows with shortcut hints (Playwright).
- No button or row anywhere shows a grey fill on hover or press; hover is shown by icon colour or label weight, selection by weight and colour (text in Plain, section tint in Color); a section header is not emphasised while one of its entries is selected; `docs/design-system.md` and `AGENTS.md` say so (unit test over the stylesheets forbids `background` on `:hover`/`:active` outside an allowlist; Playwright).
- The project title appears once above the editor (the tab strip); the row above the editor shows only the section with proper breadcrumb semantics; clicking away from the sidebar title rename saves it (Playwright).
- Opening or closing a split keeps the left pane's undo history and scroll position; the footer page number updates the moment focus changes pane; in both continuous and page view the two panes' first text lines start at the same y (±1 px) (Playwright).
- The Projects screen has no "Projects" heading: "Start new project" sits left, search, sort and view sit right; a gear there opens the global settings (appearance, palette, section colours, reveal on hover, restore tabs, storage, shortcuts) and changes apply at once (Playwright).
- Research lists Bibliography only for the Chicago template or once the project has a source or a cited footnote; sources and notes are listed; clicking a note opens the Notes tab (Playwright).
- Page view stacks pages vertically, scrolls vertically only, fits a narrow split pane, keeps footnotes at the foot of their page and honours manual page breaks (Playwright; native screenshots).
- Shift+Enter inserts a page break (soft line break stays on Cmd+Enter); Settings > Shortcuts lists every app-owned action with its chord, lets the user record a new one, refuses reserved and duplicate chords, resets to defaults, persists globally, and the menu hints follow (unit + Playwright).
- Right-clicking inside a table (or Shift+F10 with the caret in a cell) opens a menu with Add row below, Delete row, Add column after, Delete column, Toggle header row, Delete table; Escape closes it and returns focus (Playwright).
- Sidebar groups and entries reorder by dragging with a 2 px accent drop line and no shadow; the arrow buttons still reorder by keyboard; the order persists (Playwright).
- Dragging a file over the window shows an outline on the region that will take it (Projects list, or a source's PDF slot) with accept/reject feedback, not a whole-page tint; a "Select files" button offers the keyboard path (Playwright; native drop documented as hand-check).
- Changing numbers (word count, page status) use tabular figures; icon buttons have at least a 24 x 24 px hit area; sidebar labels share one x; icons measured off their optical centre by 1 px or more carry a documented `--optical-x` nudge (Playwright `tests/alignment.spec.ts`).
- `docs/ui-review-checklist.md` exists with Floor/Reflex/Finish tiers and the principles kept from the skill repos; reviewers in this wave cite it.
- The full validation list passes; `Personal Word.app` is rebuilt; every status CLAIMED until the owner's hand check.

## Non-goals
Rebinding Tiptap's built-in editing shortcuts (Cmd+B etc.); an in-window menubar (File/Edit belong to Tauri's native menu -- later-fixes); the magnifying dock, scrollspy rail, expanding pill navbar and the shadcn sidebar shell (RESEARCH.md §3); making every toolbar group fit at 1240 px (needs a narrower sidebar and smaller dropdowns); changing export pagination or page parity (exports keep their own engine); touch/mobile; new npm or cargo packages; "Start New Project" title case; the passage-restore save-wait race (later-fixes L-item); the tab strip's paper fill (a tab surface, not a hover box -- see open question 1); the progress-fill upload button (local imports finish before a bar could show), the attachment row's shimmer, and a Cmd+B sidebar toggle (the sidebar already has a pin and a hover reveal).

## Context (verified)
Base
- Branch `main` at `b3a151a` "Ship UI wave 2"; tree clean except untracked `scripts/__pycache__/` (verified `git status`). Board `team/config.json`: `git_commit` false, `review_default` true; next task id T131 (verified).
- Wave-2 rules still in force from `team/DECISIONS.md`: no task edits `docs/design-system.md` except the docs task; new Playwright motion checks go in `tests/motion-uN.spec.ts` with helpers from `tests/motion-helpers.ts`; native rendering runs need an unlocked, unoccluded screen; never put backticks or `$( )` inside double-quoted shell text (verified).

Toolbar
- `src/Writer.tsx:139 const LABEL_MIN_WIDTH = 1100;` and `:692 const wide = bar.clientWidth >= LABEL_MIN_WIDTH;` (verified). Label spans and `[data-labels]`/`.is-more` CSS at `src/editor/editor.css:229-249` (inferred from the investigation).
- `src/editor/editor.css:114 gap: var(--header-gap);` on the format bar (verified); token 8 px pinned by `src/designTokens.test.ts:220` (inferred). Pre-wave the bar had `gap: 0` (inferred, `git show 85b1a96:src/editor/editor.css`).
- Icon-only group widths measured in Chromium (inferred): history 58, zoom 83, paragraph 113, font 133, size 107, marks 127, link 37, insert 67, lists 97, indent 67, spacing 37, view 37, aids 67, setup 37, right 62, More 37 = 1129. A 1240 window with a 270 sidebar gives a 954 px usable bar: gap 0 fits insert (33 spare); every group needs >= 1145 (impossible at 1240).
- `src/Writer.tsx:635-677`: page count via `countPages(editor.view.dom.scrollWidth, ...)`; page status effect deps `[currentPage, pages]` (verified) -- the D2 lag.

Highlights
- `src/styles.css:251-256`: `button:hover:not(:disabled){background:var(--surface)}` and `button:active:not(:disabled){background:var(--pressed)}` (verified); specificity (0,2,1) beats every `.x:hover{background:transparent}` rule (inferred).
- Sliding highlight elements `src/components/ProjectSidebar.tsx:733` and `:747` (verified); `.segmented-highlight` in `src/components/segmented.css`, `.popover-highlight` in `src/components/popover.css` (inferred).
- Doubling: `src/components/ProjectSidebar.tsx:348 props.activeDestination === id` marks the group title selected (verified) while the entry row is also selected (inferred).
- Tests that assert fills/weights (inferred): `tests/appearance.spec.ts:72-75, 85-90, 255-262, 358-420`; `tests/layout.spec.ts:30-43`; `tests/sidebar-selection.spec.ts:251`; `src/palette.test.ts:62`; `src/designTokens.test.ts:143-157`; `tests/motion-u7.spec.ts`.

Sidebar, breadcrumb, library
- Rename input blur `src/components/ProjectSidebar.tsx:697 onBlur={() => setEditingTitle(false)}` (verified); Enter/Escape at 686-696 (inferred). Dialog validation = non-empty trim (`src/app/ProjectDialogs.tsx:38`, inferred).
- Breadcrumb `src/App.tsx:1987-2021`: project button "Rename project" (`:1990`), `/`, section button, delete button, or "Bibliography"/"Manuscript" (verified). `renameProject` at `:943` (verified).
- Tests using "Rename project": `tests/housekeeping.spec.ts:24`, `tests/projects-screen.spec.ts:487`; `.project-switch`: `housekeeping:27`, `layout.spec:126,139`; native harnesses click the "Projects" tab text (inferred).
- Settings destination `src/App.tsx:2086` inside the project branch; General section ~2088-2200 is global (restore tabs, appearance/palette, section colours, reveal on hover, storage) (verified line; sections inferred).
- Research items `src/App.tsx:1894 { id: "bibliography", title: "Bibliography" }` then sources (verified); pre-wave notes mapping at `git show 85b1a96:src/App.tsx` 1554-1583 (inferred).
- `src/components/ProjectLibrary.tsx:219 <h1>Projects</h1>` (verified); `.library-display { margin-left: auto }` already right-aligns (inferred, `styles.css:1809-1818`); `.library h1` rules at `styles.css:849, 1541, 1813` (inferred). Drop handling: `ProjectLibrary.tsx:62-66` (`dropping`, `dragDepth`), `:115 onDrop`, `library.css:91 .library[data-dropping]` (verified).
- `src/research/ResearchPanel.tsx:170 onAttachPdf?: (sourceId, file: File) => Promise<void>` and `:459 "Attach PDF…"` (verified).
- Reorder arrows: `ProjectSidebar.tsx:246 moveGroup`, `:334` (verified); entry reorder arrows exist in rows (inferred).

Split view
- Render path `src/App.tsx:2486-2555`: unsplit renders `renderWriter(item,"left")` as a direct child of `.editor-area`; split wraps it in `.split-panes > section.split-pane[data-side=left]`; only the right pane has `.split-pane-header` (`:2531`) (verified). Tree-position change remounts the left Writer (inferred, proven by the investigation's DOM tag test). Split CSS `src/styles.css:609-650` (inferred). Right pane measured 80 px lower with a fragment (header 33 + origin line 47), 33 with a section (inferred, Chromium).

Pages
- `src/editor/editor.css:463-507`: `.is-paged{overflow-x:auto}`, `.editor-paper` width = page-count x (page-width + gap), `.writing-surface` multi-column (`column-width`, `column-fill: auto`), `.manual-page-break{break-after: column}` (verified). Footnote x-offsets per column in `src/editor/useFootnoteLayout.ts` (153 lines; inferred). Multi-column cannot wrap vertically in WebKit (inferred; `column-wrap` unverified there -- unknown).

Shortcuts, tables, page break
- `PageBreak` node `src/editor/formatting.ts:93 name: "pageBreak"` (verified); exports, DOCX import and the Rust allowlist (`src-tauri/src/store.rs:1116`) already handle it (inferred). Tiptap HardBreak binds both `Mod-Enter` and `Shift-Enter` to `setHardBreak` (verified in `node_modules/@tiptap/extension-hard-break/dist/index.js:53-54`).
- No `contextmenu` handling in `src` (verified grep). Table commands in `src/editor/tables.ts` (insertTable, addRowAfter, deleteRow, addColumnAfter, deleteColumn, toggleHeaderRow, deleteTable) and the "Table controls" panel in `Writer.tsx` ~1190-1255 (inferred).
- Shortcut homes: `src/App.tsx:832 window.addEventListener("keydown", handler)` (verified; keys Cmd+S, `\`, K, Shift+N/S/L inferred); `Writer.tsx` `editorProps.handleKeyDown` ~449-480 (Cmd+Shift+F, Cmd+Shift+X; inferred); display hints `src/editor/shortcuts.ts SHORTCUTS` keyed by aria-label (verified). Storage key pattern `folio.workspace.*` (`src/appearance.ts:30`, `src/sidebarPreferences.ts:2`, verified).
- `src/components/Segmented.tsx:32` has an `onKeyDown` handler (verified; roving behaviour unknown).

## Rules in force
- Preserve `com.folio.writing`, `folio.*` keys, native event names; additive metadata; immutable mutations with increasing revisions and SaveQueue; never delete user data; isolated test storage -- project `AGENTS.md` "Preserve writing".
- Read `docs/design-system.md` before any CSS; sans-serif UI; square corners; `--` separators; live light/dark and reduced motion; every hover interaction keyboard-reachable; view toggles left of add buttons -- `AGENTS.md` "Product and UI"; motion only transform/opacity/clip-path with the four duration tokens -- `docs/design-system.md` Motion; no caption sentences -- design-system Rules.
- Run build, unit, e2e and cargo for affected persistence; check native WebKit; rebuild with `npm run tauri build` and report the app path; no page-parity promises -- `AGENTS.md` "Verification and delivery".
- Board protocol (`team/PROTOCOL.md`): register paths, serial slot before heavy checks, non-author review, fail-first for every new check, CLAIMED only; no commits (`git_commit` false); no new packages; smallest change; Codex sandboxes cannot drive a GUI window (native runs go to Claude agents or the owner) -- `team/DECISIONS.md`, HANDOFF.md.

## Approach
Work is cut into lanes that own disjoint files so they run at the same time; the board's file-overlap check is the only gate. Four lanes start at once: **Editor** (`Writer.tsx`, `editor.css`, editor extensions), **App** (`App.tsx`, `ProjectSidebar.tsx`, `ProjectLibrary.tsx`, `library.css`, new split/settings files), **Styles** (`styles.css` and the small component stylesheets, `Segmented.tsx`, `Popover.tsx`, the style tests), and **New modules** (shortcut registry, drag-reorder hook, drop target, review checklist -- all new files). The pagination **spike** (P1) also starts at once in a scratch copy. Two larger builds follow their lane's small tasks because they need the same files: the pagination **rewrite** (P2, after the Editor tasks and a GO from P1) and the **wiring** of shortcuts, drag reorder and the drop target into App/Sidebar/Library (K2, N4, after the App tasks). Docs (D2) and validation (V) close; the review checklist (D1) is written at the start so this wave's reviewers can use it.

Decisions taken here so implementers need not: hover = icon colour `--muted` -> `--text` and, for labels in lists, weight 600; pressed = `transform: scale(0.99)` over `--duration-press`; selected = weight 600 + `--text` in Plain / section tint in Color; the sliding highlight boxes go (sidebar, Segmented, popover) and keyboard focus in menus is shown by weight; text buttons inside bars never change weight on hover (width jitter), only colour. Pagination becomes decoration-based: a ProseMirror plugin measures block heights and inserts spacer decorations at page boundaries so one vertical flow is drawn as stacked pages; a block taller than a page straddles the gap (documented limit). Shortcuts are app-owned only: a registry of action ids with default chords, global overrides in `folio.workspace.shortcuts`, hints derived from the registry.

Rejected alternatives: `LABEL_MIN_WIDTH = Infinity` only (leaves dead label code); `:where()` to exempt buttons from the global fill (keeps a global fill nobody wants); keeping multi-column with a wheel-to-horizontal remap (does not stack pages); the HTML5 drag API for reorder (fiddly in WKWebView alongside OS file drops, no animation); porting Mantine/shadcn code (packages).

Board seeding: one task per T-item below, ids T131 onward in this order; `--depends` exactly as the "After" line says; `--files` = the Files line plus `node_modules/.cache/personal-word-beta/ui3-<id>`; never the slot path. Shared snippets as in the wave-2 plan: `NODE` (pinned Node 22.23.3), `PREVIEW(N)` on port 1600 + N with a QUOTED `--outDir` under the task's cache folder and `PW_DIST_DIR` set, `UNIT` = `npm test -- --no-file-parallelism --maxWorkers=1`, `SMOKE` = the debug smoke build then `python3 scripts/native-screens.py --out <dir> [--palette color]` (unlocked screen only).

## Tasks

### E1 -- Icons-only toolbar, zero group gap, footer page status (Editor lane)
- Files: modify `src/Writer.tsx` (`:139`, `fitToolbar` ~688-731, `labels` state/ref and per-mode `groupWidths` ~317, `data-labels` ~1625, `:672-677`), `src/editor/editor.css` (`:114`, `:229-249`), `src/editor/ToolbarControls.tsx` (`:103` label span stays), `tests/editor-toolbar.spec.ts` (~100-190).
- Interfaces: none from earlier tasks. Provides to P2: `fitToolbar` with a single `groupWidths: Partial<Record<ToolbarGroup, number>>` cache and no `labels` state; `.toolbar-label` spans still rendered on every icon button and shown only inside `.toolbar-popover.is-more`.
- Steps:
  1. Delete `LABEL_MIN_WIDTH`, the `labels` state and `labelsRef`, the `wide` branch and the `140 : 40` fallback in `fitToolbar`; collapse `groupWidths` to one cache; stop writing `data-labels`.
  2. In `editor.css` delete the `[data-labels]` rules (keep `.toolbar-popover.is-more .toolbar-label`); change the format bar's `gap: var(--header-gap)` (`:114`) to `gap: 0` with the comment `/* icons only: every group that fits stays on the bar */`.
  3. `Writer.tsx:672-677`: deps become `[currentPage, pages, Boolean(onPageStatus)]` so a pane reports its page status as soon as it gains the callback.
  3b. In `editor.css` delete every `background`/`background-color` declaration inside `:hover`, `:active` and `[aria-pressed="true"]` rules for `.toolbar-icon`, `.extract` and the toolbar panels (S1's recipe in `styles.css` then applies to them by selector; pressed toolbar icons show `color: var(--accent)` only, which E1 sets here).
  4. `tests/editor-toolbar.spec.ts`: delete "a wide format bar shows a label" and "crossing the label threshold"; add "icons only at every width": at 2200 x 900 no `.format-bar[data-labels]` and no visible `.toolbar-label` on the bar; add "the default window keeps Insert on the bar": viewport 1240 x 840, sidebar pinned at 270, `button[aria-label="Insert image"]` and `[aria-label="Insert table"]` visible outside the More menu; More still lists Indent, Spacing, Page view, Prose check, Page setup as labelled rows with hints.
- Acceptance check: `npx tsc --noEmit -p .` -> 0; `PREVIEW(1)` `tests/editor-toolbar.spec.ts tests/motion-u6.spec.ts tests/accessibility.spec.ts` -> all pass.
- Fail-first: the two new cases fail on the untouched build (labels at 2200; Insert in More at 1240).
- Stop and ask if: Insert still overflows at 1240 after gap 0 (then measure and report the shortfall); any test asserts `--header-gap` on the format bar.
- Default if unanswered: gap 0; nothing else moves out of More.

### E2 -- Shift+Enter inserts a page break (Editor lane)
- Files: create `src/editor/pageBreakKeys.ts`, `tests/page-break.spec.ts`; modify `src/editor/extensions.ts` (register), `src/editor/shortcuts.ts` (one hint line).
- Interfaces: provides `export const PageBreakKeys: Extension` (name `"pageBreakKeys"`, priority 1000, `addKeyboardShortcuts` binding `"Shift-Enter"` to `editor.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run()`); the hint `SHORTCUTS["Insert page break"] = "⇧↩"`. K2 later replaces the hint source but keeps the key.
- Steps:
  1. Write the extension; register it after StarterKit so its binding wins over HardBreak's `Shift-Enter`; `Mod-Enter` stays a soft break.
  2. Add the hint line (the Page setup panel's "Insert page break" button, `Writer.tsx` ~1527-1537, keeps its aria-label).
  3. `tests/page-break.spec.ts`: type a sentence, press Shift+Enter, type more -> exactly one page-break element (read its class from `formatting.ts:92-109`) between two paragraphs; in page view the page count reads 2; Cmd+Enter inserts a `<br>` not a page break; the DOCX export of that project contains one `w:pageBreakBefore` (reuse the export helper used by `tests/markdown-roundtrip.spec.ts` or `src/export/document.test.ts` for a unit-level check).
- Acceptance check: `npx vitest run src/editor` -> pass; `PREVIEW(2)` `tests/page-break.spec.ts tests/footnotes.spec.ts` -> all pass.
- Fail-first: the spec's Shift+Enter case fails on the untouched build (soft break, page count 1).
- Stop and ask if: Shift+Enter is intercepted earlier by `Writer.tsx` `handleKeyDown` or `indent.ts`; the page-break node cannot be inserted inside a table cell (then skip inside tables and say so).
- Default if unanswered: inside a table cell Shift+Enter does nothing.

### E3 -- Right-click table menu (Editor lane)
- Files: create `src/editor/TableContextMenu.tsx`, `tests/tables-context.spec.ts`; modify `src/Writer.tsx` (editorProps `handleDOMEvents`, render the menu near the "Table controls" panel ~1190-1255), `src/editor/editor.css` (`.table-menu-anchor`).
- Interfaces: uses `Popover`, `PopoverItem` from `src/components/Popover.tsx` (U4; `morph="edge"`, `highlight="follow"`, `onDismiss`) and the commands in `src/editor/tables.ts`. Provides `export function TableContextMenu({ editor, at, onClose }: { editor: Editor; at: { x: number; y: number } | null; onClose: () => void }): JSX.Element | null`.
- Steps:
  1. In `Writer.tsx` add `handleDOMEvents.contextmenu`: if the event target is inside a table cell (use the `cellAround`-style check from `tables.ts`), `preventDefault`, set the editor selection to that cell, store `{ x, y }` relative to `.writer`; also handle `Shift+F10` and the `ContextMenu` key in `handleKeyDown` when the selection is in a cell (anchor at the caret's `coordsAtPos`).
  2. `TableContextMenu` renders a 0 x 0 absolutely positioned `span.table-menu-anchor` at `at` inside `.writer` and a `Popover` anchored to it with `role="menu"`, items Add row below, Delete row, Add column after, Delete column, Toggle header row, Delete table (same handlers as the panel); `onDismiss`/Escape calls `onClose` and refocuses the editor.
  3. `tests/tables-context.spec.ts`: insert a 2 x 2 table, right-click a cell -> menu with the six items; "Delete table" removes it; reopen and Escape -> menu gone, editor focused; Shift+F10 with the caret in a cell opens the same menu; right-click outside a table shows no custom menu.
- Acceptance check: `npx tsc --noEmit -p .` -> 0; `PREVIEW(3)` `tests/tables-context.spec.ts tests/motion.spec.ts` -> all pass (motion (d)-(g) unchanged).
- Fail-first: the right-click case fails on the untouched build (no menu).
- Stop and ask if: `Popover` cannot anchor to a non-button element (then add an `anchorRect` prop to Popover in a one-line change and record it for S1's owner); preventing the default menu hides native spell suggestions in cells (expected; note it in the done note, not a stop).
- Default if unanswered: none -- must ask.

### A1 -- Bibliography only when it means something; notes back under Research (App lane)
- Files: modify `src/App.tsx` (`:1892-1898` list, `:1918-1928` select handler, destination guard near `:2304`), `tests/research.spec.ts`.
- Interfaces: none. Provides `showBibliography(project): boolean` (module-level helper in `App.tsx`: `project.templateId === "chicago" || (project.research?.sources.length ?? 0) > 0 || (project.research?.footnotes ?? []).some((n) => n.sourceId)`); the Research item order Bibliography?, sources (each with its PDF child row from U19), notes (`{ id: note.id, title: note.text.slice(0, 70) || "Research note", detail: note.kind }`).
- Steps:
  1. Build the list in that order; branch `onCollectionSelect` on membership in `project.research.notes` (note -> `setResearchTab("notes")`, bump `researchEpoch`, no `setFocusSource`); sources unchanged; bibliography unchanged.
  2. When `destination === "bibliography"` and `showBibliography(project)` is false (last source deleted), set the destination to "manuscript".
  3. Tests in `tests/research.spec.ts`: Blank project with nothing -> Research group lists no rows; Chicago project -> "Bibliography" first row; Blank + one source -> Bibliography appears; Blank + a research note -> the note row appears under Research and clicking it opens the Research panel on the Notes tab; keep the existing `:361-417` list case.
- Acceptance check: `PREVIEW(4)` `tests/research.spec.ts tests/sidebar-selection.spec.ts` -> all pass.
- Fail-first: the Blank-with-nothing and note-row cases fail on the untouched build.
- Stop and ask if: notes and sources can share an id format (they are UUIDs; stop if a collision is possible).
- Default if unanswered: none needed.

### A2 -- One project name; blur saves the rename; breadcrumb semantics (App lane)
- Files: modify `src/App.tsx` (`:1987-2021` breadcrumb; delete `renameProject` `:941-...` and its dialog branch if unused), `src/components/ProjectSidebar.tsx` (`:676-715` rename; remove the two `.sidebar-highlight` elements `:733,747` and their `slideHighlight` effect ~212-218), `tests/housekeeping.spec.ts:24`, `tests/projects-screen.spec.ts:487`; create `tests/sidebar-rename.spec.ts`.
- Interfaces: provides the breadcrumb markup `nav.breadcrumb[aria-label="Breadcrumb"] > ol > li` with the section (or "Manuscript"/"Bibliography") as the only item carrying `aria-current="page"`, the "Rename section"/"Delete section" buttons kept inside that `li`; the sidebar title stays `.project-switch` (click = rename in place). S1 relies on the highlight elements being gone (its CSS hides them meanwhile).
- Steps:
  1. Remove the project-title button and the `/` from the breadcrumb; wrap the rest in the `nav > ol > li` structure (separators would be `--` text in `li[aria-hidden]` if a second level is ever added; none now).
  2. Sidebar rename: extract `commit()` (trim; save via `onRenameProject` when non-empty and changed; `setEditingTitle(false)`); call it from Enter and from `onBlur` unless a `cancelled` ref was set by Escape; after Enter or Escape, focus the `.project-switch` button (ref) in the next effect; do not refocus after a pointer blur.
  3. Delete the `.sidebar-highlight` elements and the effect that slides them (S1 removes the CSS and tests).
  4. Move the two tests from "Rename project" to the sidebar title (`.project-switch` click -> input -> Enter).
  5. `tests/sidebar-rename.spec.ts`: click title, type a new name, click into the editor -> the tab and the title show the new name after reload; Escape reverts and focus is on `.project-switch`; Enter saves and focus is on `.project-switch`; the breadcrumb shows only the section and has `aria-current="page"`.
- Acceptance check: `PREVIEW(5)` `tests/sidebar-rename.spec.ts tests/housekeeping.spec.ts tests/projects-screen.spec.ts tests/split-view.spec.ts tests/research.spec.ts` -> all pass; `grep -c "Rename project" src/App.tsx` -> 0.
- Fail-first: the blur-saves case fails on the untouched build (name reverts).
- Stop and ask if: a native harness clicks the breadcrumb project title (grep `tests/native-*.js`; they click the "Projects" tab, so none expected); a 190 px sidebar wraps the title row.
- Default if unanswered: none -- must ask.

### A3 -- Split view keeps the left editor and aligns both pages (App lane)
- Files: modify `src/App.tsx` (`:2486-2555`, `renderWriter` header/footer props ~1745), create `src/components/split.css` (imported by `App.tsx`; the existing split rules in `styles.css:609-650` stay untouched -- S1 may delete them at the end), `tests/split-view.spec.ts`.
- Interfaces: uses E1's page-status fix for one test. Provides the DOM contract `div.editor-area > div.split-panes[data-single?] > section.split-pane[data-side=left] > (div.split-pane-header) + Writer`, with `.split-toolbar`, `SplitDivider` and the right `section` as conditional siblings; `.split-pane-header` on BOTH panes when split (left: title only; right: title + close); `.split-pane-footer` holds the restore-fragment strip when split; the fragment origin line renders as `span.split-pane-origin` inside the header.
- Steps:
  1. Always render the left Writer at that one position (also when unsplit, with `data-single` on `.split-panes` and no divider/right pane) so React never remounts it; `split.css` makes `[data-single] .split-pane[data-side=left]` fill the area with no ratio basis.
  2. In split mode pass `header`/`footer` as undefined to both Writers and render the origin text in the pane header and the restore strip in `.split-pane-footer`.
  3. Tests: type in the left pane, open a split (Cmd+click), Cmd+Z -> the typing undoes (history kept); scroll the left pane, open/close a split -> `scrollTop` within 2 px of before; in continuous AND page view with a section left and a fragment right, the `.ProseMirror` tops are equal within 1 px; switch focus right then left -> the footer page status text updates within 100 ms without a page change (needs E1).
- Acceptance check: `PREVIEW(6)` `tests/split-view.spec.ts --repeat-each 3` plus the U13 reviewer's probe `node_modules/.cache/personal-word-beta/ui2-u14-review/probe/split-safety.spec.mjs` -> all pass.
- Fail-first: the undo-kept and equal-tops cases fail on the untouched build.
- Stop and ask if: keeping a permanent `.split-panes` wrapper changes any `.editor-area` measurement test (`tests/layout.spec.ts`, `performance.spec.ts`) by more than 1 px.
- Default if unanswered: none -- must ask.

### A4 -- Global settings from the Projects screen (App lane)
- Files: create `src/settings/GeneralSettings.tsx`; modify `src/App.tsx` (General block ~2088-2200 -> component; Projects branch passes props), `src/components/ProjectLibrary.tsx` (gear button in `.library-display`, modal), `src/components/library.css`, `tests/projects-screen.spec.ts`.
- Interfaces: provides `export function GeneralSettings(props: { appearance: Appearance; onAppearance: (a: Appearance) => void; hoverReveal: boolean; onHoverReveal: (v: boolean) => void; restoreTabs: boolean; onRestoreTabs: (v: boolean) => void; storagePath: string | null; children?: ReactNode })` -- `children` is the slot K2 fills with the Shortcuts section; `ProjectLibrary` prop `settings?: ReactNode` rendered inside a `ModalFrame` (from `src/app/ProjectDialogs.tsx`) titled "Settings" behind a gear `button[aria-label="Settings"]` (lucide `Settings`, 16 px) placed rightmost in `.library-display`.
- Steps:
  1. Lift the General JSX into the component without changing behaviour or storage keys; render it in the Settings destination and pass the same element to `ProjectLibrary`.
  2. Gear opens the modal; Escape and the close button close it; focus returns to the gear.
  3. Tests: on the Projects screen the gear opens a dialog containing the Appearance segmented control; choosing Dark sets `html[data-theme="dark"]` at once and survives reload; Sidebar and Goals sections are NOT in the dialog.
- Acceptance check: `PREVIEW(7)` `tests/projects-screen.spec.ts tests/appearance.spec.ts` -> all pass.
- Fail-first: the gear case fails on the untouched build (no button).
- Stop and ask if: `ModalFrame` is not exported or traps focus differently from the Rename dialog; the Section colours row depends on project state (it should not; stop if it does).
- Default if unanswered: none -- must ask.

### A5 -- Projects screen without the heading (App lane)
- Files: modify `src/components/ProjectLibrary.tsx` (`:217-219`), `src/components/library.css`, `tests/projects-screen.spec.ts` (`:166, :235, :397, :459`).
- Interfaces: none; S1 later deletes the dead `.library h1` rules in `styles.css`.
- Steps:
  1. Delete the `<h1>Projects</h1>`; give the library `section` `aria-label="Projects"`; keep `.brand`; keep "Start new project" (sentence case) as the first child of `.library-toolbar`; `.library-display` stays `margin-left: auto`.
  2. Retarget the four tests to `.library-toolbar` (header-row stability, click-outside, y stability as projects are added).
- Acceptance check: `PREVIEW(8)` `tests/projects-screen.spec.ts tests/layout.spec.ts tests/appearance.spec.ts` -> all pass; a 1440 x 900 screenshot viewed: button left, controls right, brand line above.
- Fail-first: a new assertion `page.locator(".library h1")` count 0 fails on the untouched build.
- Stop and ask if: removing the h1 changes the toolbar's y by more than the h1's own height (then a margin rule is leaking).
- Default if unanswered: none needed.

### S1 -- No box highlights: the icon-button recipe, doubling fix, dead rules (Styles lane)
- Files: modify `src/styles.css` (`:251-256`, `.sidebar-highlight` ~1368, `.sidebar .selected` ~1403, `.project-tab.active` ~1272, `.delete-entry:hover` ~1861, `.library h1` 849/1541/1813, split rules 609-650 only if A3 has landed), `src/components/popover.css` (`.popover-highlight`, highlighted item), `src/components/Popover.tsx` (remove the highlight element and `slideHighlight` call; highlighted item gets `data-highlighted`), `src/research/research.css` (`.settings-button`), `src/organization/fragments.css` (`.fragment-icon`), `src/palette.test.ts`, `src/designTokens.test.ts`, `src/motion.test.ts`, `tests/appearance.spec.ts`, `tests/layout.spec.ts`, `tests/sidebar-selection.spec.ts`, `tests/motion-u7.spec.ts`, `tests/motion.spec.ts` (highlight cases).
- Interfaces: provides the recipe: `button` base has no hover/active background; `.icon-button` (apply the class to every icon-only button: trash, close, view toggle, sort direction, gear, reorder arrows, toolbar icons, snapshot/export icons) -> `color: var(--muted)`, hover/focus-visible `color: var(--text)`, `[aria-pressed=true]`/`.selected` `color: var(--accent)`, `.danger` hover `color: var(--danger)`, active `transform: scale(0.99)` for `--duration-press`; list rows (`.project-row > button:first-child`, `.entry-main`, `.group-title`, `.template-choice`, popover items) hover -> `font-weight: 600`; bar text buttons (`.topbar button`, `.format-bar button`, `.library-display button`) hover -> colour only. Relies on A2 removing the sidebar highlight elements (until then `.sidebar-highlight { display: none }`).
- Steps:
  1. Delete the global hover/active backgrounds; add the recipe; apply `.icon-button` in the stylesheets by selector where a class edit would touch another lane's file (e.g. `.delete-entry`, `.project-tab button`, `.toolbar-icon` get the same declarations via a shared selector list instead of a class).
  2. Doubling: `.sidebar-group:has(.entry-row.selected) .group-title.selected { font-weight: inherit; color: inherit; }` (WKWebView supports `:has` since macOS 12.4 Safari 15.4 -- confirm with `CSS.supports` in the test and skip on older engines).
  3. Remove `.sidebar-highlight`, `.segmented-highlight` (S3 removes the element), `.popover-highlight` rules and the highlight element in `Popover.tsx`; the highlighted popover item is `[data-popover-item][data-highlighted] { font-weight: 600; color: var(--text) }`.
  4. Keep `.project-tab.active` paper fill (open question 1). Delete the `.library h1` rules.
  5. New unit test in `src/motion.test.ts` or `designTokens.test.ts`: scan every stylesheet; no declaration inside a `:hover` or `:active` rule sets `background`/`background-color` unless the selector is in the allowlist `[".primary", ".project-tab"]`; `designTokens.test.ts:143-157` now asserts `button:active:not(:disabled)` sets `transform`; `palette.test.ts:62` drops the `.sidebar-highlight` contrast case and instead checks the selected-row text colour contrast in both palettes.
  6. Update the Playwright assertions: `appearance.spec.ts:72-75` (Snapshot hover = no background change, colour `--text`), `:85-90, 255-262` (entry row 600 + colour; group title NOT 600 when an entry is selected), delete `:358-420` highlight alignment and the `motion-u7` sidebar/segmented highlight cases, `motion.spec.ts` (g) highlight alignment; `layout.spec.ts:30-43` -> the selected entry is 600 and the group title is not; `sidebar-selection.spec.ts:251` accordingly.
- Acceptance check: `npx vitest run src/palette.test.ts src/designTokens.test.ts src/motion.test.ts` -> pass; `PREVIEW(9)` `tests/appearance.spec.ts tests/layout.spec.ts tests/sidebar-selection.spec.ts tests/motion.spec.ts tests/motion-u7.spec.ts tests/projects-screen.spec.ts tests/editor-toolbar.spec.ts tests/accessibility.spec.ts` -> all pass; Chromium screenshots of the Projects screen with the trash hovered, the writing sidebar with an entry selected (Plain and Color), the Sort menu open, and the format bar with Bold pressed, light and dark, viewed: no grey boxes anywhere; Bold shows accent colour; the hovered popover row is bold.
- Fail-first: the stylesheet scan fails on the untouched tree (global hover rule); the "group title not bold" case fails.
- Stop and ask if: menu keyboard navigation becomes hard to see with weight alone in dark mode (then add `text-decoration: underline` offset 3 px for `[data-highlighted]` and record it); any surface has no label and no icon to emphasise.
- Default if unanswered: underline fallback off.

### S2 -- Separator, tabular figures, hit areas, optical nudges, alignment tests (Styles lane)
- Files: modify `src/styles.css` (`.separator`, `tabular-nums`, hit-area pseudo-element, `--optical-x` hook, and the per-icon toolbar nudges written as `.format-bar button[aria-label="..."]` selectors so `editor.css` stays the Editor lane's), create `tests/alignment.spec.ts`, modify `src/designTokens.test.ts`.
- Interfaces: uses S1's icon-button selector list (the same selectors, so the hit-area and nudge rules cover buttons S1 styled without a class). Provides `.separator[role="separator"][aria-orientation]` (1 px `--line`, vertical = `width:1px; align-self:stretch`); a `::after` hit-area extension to 24 x 24 min on every icon button; `.icon-button > svg { transform: translateX(var(--optical-x, 0)) translateY(var(--optical-y, 0)) }` with per-icon vars set only where measured; `font-variant-numeric: tabular-nums` on `.word-count`, `.page-status`, `.save-status`. D2 documents the table of nudges.
- Steps:
  1. Add the rules; apply `tabular-nums` to the three counters.
  2. Measure every Lucide icon used in the format bar and sidebar with the ink method (`getBBox()` through `getScreenCTM()` + half stroke) in a scratch Playwright script; for any icon whose ink centre is >= 1 px off its button centre, set `--optical-x`/`--optical-y` on that button's selector (record the numbers in the done note).
  3. `tests/alignment.spec.ts`: (a) every `.entry-main` label text starts at one x (Range rect, 0.5 px); (b) every `.icon-button` and toolbar icon button has a hit rect >= 24 x 24 (button rect or `::after`); (c) in the word count, `width("111") === width("888")` (tabular); (d) each toolbar icon's ink centre is within 0.5 px of its button centre after the nudges; (e) `.separator` renders 1 px of `--line`.
- Acceptance check: `npx vitest run src/designTokens.test.ts` -> pass; `PREVIEW(10)` `tests/alignment.spec.ts` -> all pass; the native screenshots viewed at 2x in V (icons centred, counters steady).
- Fail-first: on a doctored copy add `padding-left: 4px` to one toolbar icon -> (d) fails; (c) fails if Futura lacks `tnum` -- then STOP (see below).
- Stop and ask if: the system Futura has no tabular figures (test (c) fails even with the rule) -- then ask whether to fall back to the system font for counters; more than three icons need nudges over 2 px (suggests a wrong icon box).
- Default if unanswered: no font fallback; keep proportional counters and drop check (c).

### S3 -- Segmented without a fill; roving keys (Styles lane)
- Files: modify `src/components/Segmented.tsx`, `src/components/segmented.css`, `tests/appearance.spec.ts` (segmented cases only, coordinate with S1 -- same lane, do S3 after S1).
- Interfaces: provides Segmented pressed = `aria-pressed="true"` + weight 600 + `--accent`; Left/Right/Home/End move focus and selection (roving tabindex); no `.segmented-highlight` element.
- Steps: remove the highlight element and its `slideHighlight` call; keyboard per the interface (check what `:32 onKeyDown` already does and keep it); test: Tab into the Appearance control, Right moves selection and focus, Home/End work, the pressed segment has no background.
- Acceptance check: `PREVIEW(11)` `tests/appearance.spec.ts tests/accessibility.spec.ts` -> pass.
- Fail-first: the no-background assertion fails on the untouched build.
- Stop and ask if: a third party of the Segmented control (Goals scope) relies on the fill for meaning.
- Default if unanswered: none needed.

### N1 -- Shortcut registry, chords and store (New-modules lane)
- Files: create `src/shortcuts/registry.ts`, `src/shortcuts/chords.ts`, `src/shortcuts/store.ts`, `src/shortcuts/shortcuts.test.ts`, `src/settings/ShortcutsSettings.tsx`.
- Interfaces: provides `export type Chord = { key: string; meta?: boolean; shift?: boolean; alt?: boolean; ctrl?: boolean }`; `export type ActionId = "focusMode" | "keepAsFragment" | "insertPageBreak" | "save" | "snapshot" | "newSection" | "findInProject" | "toggleSidebar" | "toggleAppearance"` (K2 reconciles against the real handlers in `App.tsx:808-836` and `Writer.tsx` ~449-480 -- add or drop ids there, never invent handlers); `export const ACTIONS: { id: ActionId; label: string; scope: "app" | "editor"; default: Chord }[]`; `export const RESERVED: Chord[]` (⌘C ⌘V ⌘X ⌘Z ⇧⌘Z ⌘A ⌘Q ⌘W ⌘H ⌘M ⌘, ⌘N ⌘O ⌘P ⌘T ⌘B ⌘I ⌘U); `parseChord(event: KeyboardEvent): Chord`, `formatChord(c: Chord): string` ("⇧⌘F" order ⌃⌥⇧⌘), `sameChord(a, b)`; `SHORTCUTS_KEY = "folio.workspace.shortcuts"`, `readShortcuts(store): Partial<Record<ActionId, Chord>>`, `writeShortcuts(store, overrides)`, `resolveChord(event, overrides): ActionId | null`, `hintFor(id, overrides): string`; `ShortcutsSettings({ overrides, onChange })` renders one row per action: label, current chord in a `<kbd>`-styled span, "Change" (captures the next chord, refuses RESERVED and duplicates with the message "That shortcut is taken by <label>." or "That shortcut is reserved by macOS."), "Reset"; "Reset all".
- Steps: write the modules and the component (no wiring); unit tests: parse/format round trip, reserved refusal, duplicate refusal, defaults when the store is empty or corrupt, `resolveChord` prefers overrides.
- Acceptance check: `npx vitest run src/shortcuts` -> all pass; `npx tsc --noEmit -p .` -> 0.
- Fail-first: tests fail before the modules exist.
- Stop and ask if: an action's default chord in the code differs from what the hint map shows today (list them; K2 decides).
- Default if unanswered: defaults = today's chords.

### N2 -- Drag-to-reorder hook (New-modules lane)
- Files: create `src/components/dragReorder.ts` (pure maths), `src/components/useDragReorder.ts`, `src/components/dragReorder.test.ts`, `src/components/drag-reorder.css`.
- Interfaces: provides `insertionIndex(pointerY: number, rowTops: number[], rowHeights: number[]): number`; `useDragReorder<T>({ items, onReorder, axis: "y", threshold = 5 }): { rowProps(index): { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, style }; dragging: { from: number; to: number } | null }` -- the lifted row follows the pointer with `transform: translateY`, siblings shift by their height with `transform` only, a `.drop-line` (2 px `--accent`) marks the target, `prefers-reduced-motion` disables the shift transition; no shadow; pointer capture; Escape cancels.
- Steps: write the maths with tests (thresholds, first/last positions, equal heights, cancel); write the hook; a small fixture page is not needed -- N4 integrates and tests in the sidebar.
- Acceptance check: `npx vitest run src/components/dragReorder.test.ts` -> pass; `npx tsc --noEmit -p .` -> 0.
- Fail-first: tests fail before the module exists.
- Stop and ask if: pointer capture is unavailable in the preview (it is in Chromium and WKWebView).
- Default if unanswered: none needed.

### N3 -- Scoped drop target (New-modules lane)
- Files: create `src/components/DropTarget.tsx`, `src/components/drop-target.css`, `src/components/dropTarget.test.ts`.
- Interfaces: provides `DropTarget({ accept: (file: { name: string; size: number; type: string }) => string | null /* reason or null */, onFiles: (files: File[] | string[]) => void, label: string, children })` -- wraps its target region; shows a 1 px `--accent` outline and a one-line label only while a drag is over the window (`dragenter`/`dragleave` depth counter on `window`), turns `data-state="reject"` (outline `--danger`, label = the reason) when any dragged item fails `accept`, `data-state="accept"` otherwise; includes a `button.select-files` ("Select files") opening a hidden `input[type=file]` as the keyboard path; on native (Tauri) the window drag events deliver paths, so `accept` is called with `{ name, size: 0, type: "" }` and the size check is skipped there (document).
- Steps: write the component and unit tests for the accept/reject state machine with fake events.
- Acceptance check: `npx vitest run src/components/dropTarget.test.ts` -> pass.
- Fail-first: tests fail before the module exists.
- Stop and ask if: Tauri's drag events cannot be observed from the webview `window` (then N5 wires `ProjectLibrary`'s existing `onDrop` plumbing and the component only renders the states).
- Default if unanswered: render states only on native.

### D1 -- Review checklist from the skill repos (Docs lane; new file, no dependencies)
- Files: create `docs/ui-review-checklist.md`.
- Interfaces: reviewers in this wave cite its item ids (F1.., R1.., P1..).
- Steps: write three tiers from RESEARCH.md §4-5: **Floor** (never ships failing: contrast in both themes incl. hover/focus; `:focus-visible` on every control; `aria-label` on icon buttons; `<button>` for actions; reduced motion = no animation; no layout-property animation; destructive actions confirm or undo); **Reflex** (defaults to override only with a reason: no grey fills; 24 x 24 hit areas; tabular figures on counters; truncation with `min-width: 0`; real "…" and non-breaking spaces in "10 MB"/"⌘ K"; `overscroll-behavior: contain` on popovers; "never animate keyboard actions"; tooltips open instantly after the first; press scale 0.99; state changes paired with a static cue; optical alignment measured by ink; `text-wrap: balance` on UI headings only); **Finish** (never blocks: 1 px 10% image outline; `<kbd>` style for hints; "if it needs a sentence to operate, redesign the control"; remove one element). Add the Before/After/Why review-table format and the sources list.
- Acceptance check: `test -f docs/ui-review-checklist.md && grep -c "^- " docs/ui-review-checklist.md` -> >= 25.
- Fail-first: n/a: documentation.
- Stop and ask if: an item contradicts `docs/design-system.md` (list it; do not change the design doc here).
- Default if unanswered: keep the design doc's rule.

### P1 -- Vertical pagination: feasibility spike (Pages lane; no dependencies -- scratch copy only, starts at once)
- Files: scratch copy only under `node_modules/.cache/personal-word-beta/ui3-p1/` (no project edits); deliverable `docs/agent-work/2026-10-28-ui-wave-3/PAGINATION-SPIKE.md`.
- Interfaces: decides for P2: plugin name `pagination`, decoration class `.page-spacer`, CSS variables `--page-height`, `--page-gap`, `--page-scale`.
- Steps:
  1. In a scratch copy, prototype a ProseMirror plugin that measures top-level block heights after layout, computes page boundaries against `--content-height` (minus the page's footnote reserve), and inserts widget decorations `div.page-spacer` (height = bottom margin + gap + top margin) before the first block of each new page; paper drawn by a vertical repeating gradient of period `page-height + page-gap` on `.editor-paper`; `.is-paged` scrolls vertically only; manual page break forces a boundary; a narrow container scales the paper with CSS `zoom` (`--page-scale = min(1, available / page-width)`).
  2. Measure in Chromium AND the native smoke build (unlocked screen): a 50-page document types with p95 keystroke latency within the existing `tests/performance.spec.ts` budget; footnote markers' pages are computable from decoration positions; caret movement across a spacer (Up/Down/Home/End, click) lands sensibly; a paragraph taller than a page straddles the gap (record how it looks).
  3. Write the spike doc: approach, numbers, screenshots, what P2 must change in `useFootnoteLayout.ts`, `countPages`, current-page tracking, `PageBreak`, and the tests that assert page geometry (`tests/native-smoke.js:80-218`, `footnotes.spec:180-185`, `features.spec:129-144`, `accessibility.spec:107-134`).
- Acceptance check: `test -f docs/agent-work/2026-10-28-ui-wave-3/PAGINATION-SPIKE.md` and it records the latency numbers for both engines and a GO/NO-GO.
- Fail-first: n/a: spike.
- Stop and ask if: NO-GO (latency over budget in WebKit, or caret behaviour at spacers is broken) -- then propose the fallback (keep multi-column; add vertical mouse-wheel mapping and fit-to-width zoom) and wait for the owner.
- Default if unanswered: none -- must ask.

### P2 -- Vertical pagination (Pages lane; after P1 GO and E1, E2, E3)
- Files: create `src/editor/pagination.ts`, `tests/pages.spec.ts`; modify `src/editor/editor.css` (`:463-507` replaced), `src/editor/useFootnoteLayout.ts`, `src/editor/footnoteLayout.ts`, `src/editor/formatting.ts` (`countPages`, `PageBreak` rendering), `src/Writer.tsx` (page count ~635-671, current page ~1664-1671, footnote placement ~1718), `src/editor/extensions.ts`, `tests/native-smoke.js:80-218`, `tests/footnotes.spec.ts`, `tests/features.spec.ts`, `tests/accessibility.spec.ts`, `docs/limitations.md` (one line: a block taller than a page straddles the gap).
- Interfaces: uses E1/E2/E3's `Writer.tsx` as merged. Provides `pageCount` from the plugin state; `.page-spacer` decorations; `--page-scale`; `onPageStatus` unchanged in shape.
- Steps: implement what the spike proved; keep `.is-paged`, `.editor-paper`, `--page-count`, `--page-width` names the native harness reads; footnotes positioned per page by `top`, not `left`; current page from `scrollTop / (page-height + gap)`; manual page break = forced boundary; `tests/pages.spec.ts`: no horizontal scroll (`scrollWidth === clientWidth`) at 1240 and in a 585 px split pane; page 2's paper top is below page 1's bottom; page count equals spacers + 1; a footnote sits at the foot of its page; Shift+Enter starts a new page; Reduce Motion unaffected; update the four existing geometry tests to the vertical model.
- Acceptance check: `UNIT` -> all pass; `PREVIEW(12)` full `tests/` -> all pass; `SMOKE` both palettes with the writing screen in page view (add a `writing-pages` capture to `tests/native-screens.js` if not present) -> PNGs viewed: pages stacked, no horizontal scrollbar; `python3 scripts/native-smoke.py` -> 3 phases pass (unlocked screen).
- Fail-first: `tests/pages.spec.ts` fails on the pre-P2 build (horizontal scroll).
- Stop and ask if: WebKit latency regresses past the performance budget in the real build; any export test changes result (exports must not change).
- Default if unanswered: none -- must ask.

### K2 -- Wire shortcuts into the app and Settings (after N1, A4, E1-E3)
- Files: modify `src/App.tsx` (`:808-836` window keydown; Settings: mount `ShortcutsSettings` in `GeneralSettings`' `children`), `src/Writer.tsx` (`handleKeyDown` ~449-480), `src/editor/shortcuts.ts` (hints from `hintFor`), `src/editor/ToolbarControls.tsx`/`Dropdown.tsx` only if the hint lookup signature changes; create `tests/shortcuts.spec.ts`.
- Interfaces: uses N1's `resolveChord`, `hintFor`, `readShortcuts`, `ShortcutsSettings`; A4's `GeneralSettings.children`. Provides: all app-owned handlers dispatch through `resolveChord`; Shift+Enter (E2) stays a Tiptap binding and is listed read-only in Settings as "Insert page break ⇧↩".
- Steps: reconcile `ActionId` with the real handlers; replace the hard-coded key checks; keep the static aria-labels ("Bold (⌘B)") untouched; hints read from the registry; mount the section titled "Shortcuts"; test: change "Focus mode" to ⌘⇧G in Settings -> the old chord does nothing, the new one toggles focus mode, the More menu hint reads ⌘⇧G, it survives reload; recording ⌘C shows the reserved message; recording a duplicate shows the taken message; Reset all restores.
- Acceptance check: `npx vitest run src/shortcuts src/editor` -> pass; `PREVIEW(13)` `tests/shortcuts.spec.ts tests/editor-toolbar.spec.ts tests/features.spec.ts tests/accessibility.spec.ts` -> all pass.
- Fail-first: the rebind case fails before wiring (old chord still works).
- Stop and ask if: a Tiptap built-in chord collides with a default app chord; a test depends on a hard-coded chord that changes.
- Default if unanswered: keep today's chords as defaults.

### N4 -- Drag reorder and drop targets in the sidebar, library and Research (after N2, N3, A2, A4, A5)
- Files: modify `src/components/ProjectSidebar.tsx` (group headings and entry rows use `useDragReorder`; arrows kept), `src/components/ProjectLibrary.tsx` + `src/components/library.css` (replace `.library[data-dropping]` tint with `DropTarget` around the project list; accept `.md`, `.docx`, `.html`, `.txt`, `.json` per `src/import/dropImport.ts`), `src/research/ResearchPanel.tsx` + `src/research/research.css` (a `DropTarget` on each source card's PDF slot: accept `.pdf` <= 25 MB, calls `onAttachPdf`); create `tests/drag-reorder.spec.ts`, `tests/drop-target.spec.ts`.
- Interfaces: uses N2, N3, A2's sidebar, A4/A5's library.
- Steps: integrate; persistence through the existing `sidebarOrder`/`moveGroup` and entry-order mutations; tests: drag "Fragments" above "Manuscript" with mouse down/move/up -> order persists after reload; drag an entry below its sibling -> persists; arrows still reorder by keyboard; `prefers-reduced-motion` -> no transition; drop target: dispatch `dragenter` with a `.pdf` item over a source card -> outline + "Drop to attach"; a `.txt` -> reject state with the reason; drop -> the PDF row appears; Projects list: a dragged `.docx` shows accept on the list region, nothing on the page body; "Select files" opens the picker (assert the input receives `click`).
- Acceptance check: `PREVIEW(14)` `tests/drag-reorder.spec.ts tests/drop-target.spec.ts tests/sidebar-selection.spec.ts tests/projects-screen.spec.ts tests/research-pdf.spec.ts` -> all pass; screenshots light/dark of a lifted row and an accept/reject target, viewed.
- Fail-first: the drag case fails before integration (order unchanged).
- Stop and ask if: OS file drops and row drags conflict in WKWebView (pointer events vs drag events) -- then disable row drag while a file drag is active and say so.
- Default if unanswered: disable row drag during a file drag.

### D2 -- Documentation (after everything else)
- Files: modify `docs/design-system.md` (Toolbar: icons only, gap 0, what stays in More at 1240; States: the no-fill recipe, bold-vs-colour rule, pressed scale; Sidebar: no highlight box, doubling rule, drag reorder with arrows; Split: stable left editor, matching headers; new "Pages" section: vertical pagination and its limit; new "Shortcuts" section; "Optical alignment" table of `--optical-*` nudges and the ink-measure rule; Separator; drop targets), `AGENTS.md` (the selected-entry sentence: "semibold, text colour in Plain, section tint in Color, no fill"), `README.md`, `docs/architecture.md` (pagination plugin, shortcut registry, drag hook, DropTarget), `docs/limitations.md`, `docs/changelog.md`, `docs/validation.md` (dated "UI wave 3" section stub for V), `docs/agent-work/2026-10-25-later-fixes/PLAN.md` (strike items fixed here; add: native Tauri menu bar; Tiptap built-in chord rebinding; tab paper fill if the owner wants it gone).
- Interfaces: uses every task's done note ("DESIGN DOC:" text) and the nudge table from S2.
- Steps: write; run the greps below.
- Acceptance check: `grep -n "label mode\|data-labels" docs/design-system.md README.md` -> 0 hits; `grep -c "sidebar-highlight" docs/design-system.md` -> 0; `grep -n "no fill" AGENTS.md` -> 1 hit; `grep -n "UI wave 3" docs/validation.md` -> 1 hit.
- Fail-first: n/a: documentation.
- Stop and ask if: a done note's DESIGN DOC text contradicts the code (verify each against the real file).
- Default if unanswered: the code wins; note the discrepancy.

### V -- Final validation and owner hand-check sheet (after D2)
- Files: create `docs/agent-work/2026-10-28-ui-wave-3/VALIDATION.md`; logs in `node_modules/.cache/personal-word-beta/ui3-final/`; no source changes.
- Interfaces: runs the Validation list below; sheet format as wave 2's `VALIDATION.md`.
- Steps: hold the serial slot; `caffeinate -d -i -u` for the run; check `df -h` >= 5 GB before the app build; run steps 1-10 in order in the background with full logs; view every native PNG; write the results table, incidents, "Not established" list and the owner sheet.
- Acceptance check: every step's expected result recorded with its log path; `VALIDATION.md` exists with an empty owner sheet.
- Fail-first: n/a: runs checks proven failing first in their tasks.
- Stop and ask if: any step fails (file a board task; do not fix here); the screen locks mid-run (pause, do not record as a product failure).
- Default if unanswered: none -- must ask.

## Validation (after all tasks, in order; one board task, serial slot held throughout, unlocked screen)
1. `NODE` -> v22.23.3; `npx tsc --noEmit -p .` -> 0.
2. `UNIT` -> all pass (973 + the new shortcuts, dragReorder, dropTarget, page-break, stylesheet-scan cases).
3. `npm run build` -> 0.
4. Production-preview Playwright, whole `tests/`, one worker, no retries, port 1620, quoted private `--outDir` -> all pass (new: `page-break`, `tables-context`, `sidebar-rename`, `pages`, `shortcuts`, `drag-reorder`, `drop-target`, `alignment`; rerun a known load-sensitive spec once if it fails and record both).
5. `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` -> 57 passed, 1 ignored (no Rust changes expected).
6. Smoke rebuild; `python3 scripts/native-reliability.py --suite baseline` -> 13 + 5; `--suite beta` -> 19 + 42; `python3 scripts/native-smoke.py` -> 3 phases.
7. `python3 scripts/native-screens.py` plain and color (10 + 10, plus the page-view capture if P2 added one) -> every PNG viewed, one line each.
8. Exported artifacts: a project with a Shift+Enter page break exported to DOCX and PDF -> the break lands (`w:pageBreakBefore`; PDF page 2 starts with the text after the break).
9. `npm run tauri build` -> `Personal Word.app`, identifier `com.folio.writing`, zero smoke markers, sha256 recorded.
10. Owner hand-check sheet (agents prepare, owner fills): (a) toolbar at the default window: icons only, Insert on the bar, More holds the five rare groups; (b) hover a trash can, a tab, Snapshot, a toolbar icon, a menu row -- no grey box, bold or colour only; (c) select an entry in Plain and Color -- the section header is not emphasised; (d) rename from the sidebar title and click away -- saved; the name appears once above the editor; (e) open a split in continuous and page view -- pages level, undo kept, footer page updates on focus; (f) page view scrolls down; a tall paragraph at a page end (note how it straddles); narrow split pane shows a scaled page; (g) Shift+Enter breaks the page; Settings > Shortcuts rebind Focus mode, reserved and duplicate refusals; (h) right-click a table; (i) drag a sidebar group and an entry; arrows still work; (j) drag a .md over the Projects screen and a .pdf over a source -- outline only on the target, reject on a wrong type; native drop works; (k) gear on the Projects screen opens settings; (l) Research: Bibliography on Chicago only until a source exists; notes listed; (m) tabular figures in the word count; (n) Mac Reduce Motion: menus and drag shifts instant; (o) anything that looks wrong.
11. Docs updated (D2); every status CLAIMED.

## Risks and rollback
- Pagination rewrite (P2) is the largest and riskiest change; P1's GO/NO-GO gates it and the fallback is explicit. Rollback: revert `editor.css` page rules, `pagination.ts`, `useFootnoteLayout.ts`, `countPages`.
- Removing the global hover fill (S1) touches every surface; the stylesheet scan test and the screenshot review are the guard. Rollback: restore `styles.css:251-256` and the three highlight rules.
- The stable split wrapper (A3) changes the editor's DOM path; split-view and performance specs guard it. Rollback: restore the conditional render.
- Shortcuts (K2) rewire key handling; tests pin each default. Rollback: restore the hard-coded checks; the registry files are inert.
- Drag reorder and drop targets add pointer handlers next to OS file drops in WKWebView; N4's stop rule covers the conflict. Rollback: remove the hook calls; arrows remain.
- No Rust, storage-format or export changes are planned; new storage key `folio.workspace.shortcuts` is additive.

## Open questions for the user (answered 2026-10-28: the owner approved the plan as written, so each default stands)
1. The active tab keeps its paper fill (it is the tab's surface, not a hover box). ANSWER: keep.
2. Pressed state: `transform: scale(0.99)` (as popover items already do). ANSWER: scale.
3. In vertical page view a paragraph taller than the remaining space straddles the page gap (block-level pagination). ANSWER: accept as a documented limit; P1 does not prototype paragraph splitting.

## Notes for the implementer (traps, things NOT to do)
- Lanes, all starting at once: Editor (E1-E3), App (A1-A5), Styles (S1-S3), New modules (N1-N3), Docs D1, Pages spike P1 (scratch copy). Then P2 (after E1-E3 + P1 GO), K2 (after N1, A4, E1-E3), N4 (after N2, N3, A2, A4, A5); then D2, then V. Never register a file another live task holds; the board refuses it -- that is the only sequencing. `docs/design-system.md` is edited by D2 only; put design text in your done note under `DESIGN DOC:`.
- Register the plan's Files line in ONE `files add` call on claim; the serial slot right before the first heavy check; post a board message before heavy runs; native runs only with the screen unlocked and only by Claude agents or the owner (Codex sandboxes cannot drive the GUI).
- Never put backticks or `$( )` inside double-quoted shell text (an agent once triggered a release build that way); `team.py` has no `--note-file`: write the note to a file and pass it with `--note "$(cat file)"` only when it contains no backticks.
- Line numbers above are hints from `b3a151a`; lanes change files under you -- read the real file before editing.
- Fail-first on a scratch copy or a pre-change build; restore byte-identical (`cmp`).
- `Writer.tsx` has U4/U6/U12 hunks and will gain E1-E3 then P2; `App.tsx` has every wave-2 hunk; keep unrelated hunks intact.
- Do not change the `--header-gap` token (U3 tests pin it); override the gap on the format bar only.
- The `.sidebar-highlight` elements are removed in A2 (TSX) and their CSS in S1; whichever lands first must not break the other (S1 hides the element with `display: none` until A2 lands).
- Exports must not change in this wave (pagination is editor-only); assert with the existing export tests.
