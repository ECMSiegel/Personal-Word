# UI wave 3 -- final independent review (Fable)

Reviewer: agent-50eb (Claude Code, Fable 5.1), 2026-10-28, 10:55Z to 11:20Z. Reviewed the whole uncommitted wave-3 tree on `main` against `b3a151a` (60 tracked files changed, plus the new modules, specs and docs listed by `git status`). I wrote none of it. The screen was locked throughout: no native GUI, no app build, no native drop. No source, test or other doc file was changed by this review; the only writes are this file and the private folder `node_modules/.cache/personal-word-beta/ui3-fable-review/` (called `REV/` below).

Note on T151: the coordinator reported that agent-a6ec approved T151 (V) before this review reached it, so no board verdict on T151 is recorded here. My reading of VALIDATION.md is below under "V's record".

## Verdict

**Ship as CLAIMED, with fixes.** Nothing in the wave puts writing at risk (see Data safety). Two real defects must be fixed before the shortcuts and drag-reorder lines of the Definition of done can be called met, and one should-fix sits behind them:

1. **High -- Settings > Shortcuts accepts a chord with no modifier.** A bare letter, Enter, Space, Backspace or an arrow can be recorded for Save, Focus mode and the rest; afterwards every press of that key fires the action and never reaches the document. Board task T162.
2. **Medium -- a sidebar drag stays armed after the button is released outside the row.** The next time the pointer crosses that row with no button down, the row lifts and its siblings shift; the state sticks until Escape or a click, and a click that moves a few pixels reorders and persists. Board task T163.
3. **Medium -- Shift+Enter inside a list item nests the page break inside the list item.** Page view ignores it (the plugin paginates top-level blocks only) while DOCX and PDF export honour it, so the editor and the exports disagree about where a page ends. Board task T164.
4. **Low -- a Control chord recorded for an action listed after Save is accepted but shadowed.** `chordProblem` compares strictly while `resolveChord` folds Control into Command and takes the first match in registry order. Folded into T162.
5. **Low, intermittent -- caret across the page gap.** `tests/pages.spec.ts:240` failed once in my run (ArrowDown from page 1's last line landed 2 positions short of page 2) and passed on the immediate rerun and in V's run. Board task T165 (investigate; it is also one of the native gate's caret flags).

Everything native is NOT ESTABLISHED (locked screen): WebKit rendering and latency of vertical page view, the P2 native gate, native reliability and smoke, native screenshots, the native file drop onto the Projects list and a source's PDF slot, and Mac Reduce Motion with real menus. VALIDATION.md already says so and gives the morning commands.

## What I ran (all logs under `REV/`, every log ends with `EXIT=`)

| Check | Result | Log |
| --- | --- | --- |
| pinned Node v22.23.3; `npx tsc --noEmit -p .` | exit 0 | `REV/tsc.log` |
| targeted vitest: `src/shortcuts`, `pagination.test`, `dragReorder.test`, `dropTarget.test`, `designTokens.test`, `formatting.test`, `footnoteLayout.test`, `dropImport.test` | 8 files, 77 passed | terminal (11:00Z) |
| private production build `npx vite build --outDir "REV/dist"` | exit 0 | `REV/build.log` |
| my probe spec (6 probes + 2 screenshot runs), port 1690 | P1 confirms defect 1; P2 confirms defect 2; P3 shows defect 3; P4 blank rename refused; P5 no spacer in saved JSON or `getHTML()`, one history event after typing | `REV/probe.log`, `REV/probe-p6.log`, `REV/probe/probe.spec.mjs` |
| targeted Playwright against `REV/dist`: `split-view`, `pages`, `sidebar-rename`, `shortcuts`, `drag-reorder`, `drop-target`, `tables-context`, `page-break`, `research`, `appearance` | 77 passed, 1 failed (`pages.spec.ts:168`, defect 5); the failed test passed on a single rerun | `REV/suite.log`, `REV/pages-rerun.log` |
| one-off vitest for the Control-shadow question | `chordProblem("newSection", {s, ctrl}) = null`; `resolveChord(Ctrl+S, that override) = "save"` | `REV/shadow.test.ts`, `REV/shadow.config.mts` |
| light and dark screenshots of Projects, Projects settings dialog, writing (page view, hovered row), split (page view and continuous), More, Research, Settings | viewed; notes below | `REV/shots/*.png` |

Screenshot notes (Chromium, 1240 x 840, Chicago template, which opens in page view): the toolbar is icons only with Insert image and Insert table on the bar and a More button; pages stack with a grey gap and no sideways scrollbar; the footer reads "Section page 2 of 2"; the narrow left split pane shows a scaled page; the Projects screen has no heading, Start new project left with "Import writing" beside it, search, sort, view and the gear right; the settings dialog shows General plus Shortcuts; Research on Chicago lists Bibliography only; dark mode matches. `REV/shots/writing-hover-light.png` caught the hovered row mid-crossfade (word count under the reorder arrows); the same row is clean in `split-light.png`, so this is the existing crossfade, not a wave-3 defect (inferred).

## Definition of done, line by line

| # | DoD line (short) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Icons only at every width; at 1240 x 840 with a 270 px sidebar Insert image and table are on the bar; More lists labelled rows with hints | MET (browser) | `src/Writer.tsx` has no `LABEL_MIN_WIDTH`/`data-labels` left; `src/editor/editor.css` gap 0; `REV/shots/writing-hover-light.png`; `tests/editor-toolbar.spec.ts` passed in V's step 4; hint in More checked by `tests/shortcuts.spec.ts:25` (my run) |
| 2 | No grey fill on hover or press anywhere; hover by colour/weight, selection by weight + colour; section header not emphasised while an entry is selected; docs say so | MET (browser), with the recorded exceptions | `src/designTokens.test.ts` "paints no grey box" scans every `src/**/*.css` (passed); `src/styles.css` `:where(...)` icon-button recipe and `.sidebar-group:has(.entry-row.selected) .group-title.selected { font-weight: 500 }`; `tests/appearance.spec.ts` 20/20 in my run; `AGENTS.md` line 16 and design-system States. Allowed fills listed in the design doc (primary button, active tab, cards-view selected card) |
| 3 | Title once above the editor; breadcrumb semantics; blur saves the rename | MET | `src/App.tsx` breadcrumb is `nav > ol > li[aria-current]` with the section only; `renameProject` dialog removed; `src/components/ProjectSidebar.tsx` `commitTitle` trims and refuses empty; `tests/sidebar-rename.spec.ts` 4/4 and probe P4 (blank refused) in my run |
| 4 | Split keeps the left pane's undo and scroll; footer page follows focus; first lines level within 1 px in both views | MET (browser) | left Writer key unchanged across split open/close (`renderWriter` in `App.tsx`; wrapper always rendered with `data-single`); `tests/split-view.spec.ts:545, :560, :584 (±1 px both views), :646` and `tests/pages.spec.ts:340` (page number per pane) all passed in my run |
| 5 | Projects screen: no heading, Start new project left, search/sort/view right, gear opens global settings that apply at once | MET (browser) | `src/components/ProjectLibrary.tsx` (h1 gone, `library-settings` button, `ModalFrame` with the shared `GeneralSettings` element); `REV/shots/projects-light.png`, `projects-settings-light.png`; `tests/projects-screen.spec.ts` passed in V's run (not rerun by me) |
| 6 | Bibliography only on Chicago or once a source or cited footnote exists; sources and notes listed; a note opens the Notes tab | MET | `showBibliography()` in `App.tsx`; notes mapped into the Research group; destination falls back to manuscript; `tests/research.spec.ts:436` passed in my run |
| 7 | Page view stacks vertically, scrolls vertically only, fits a narrow pane, footnotes at the foot of their page, honours manual breaks | MET (Chromium) / NOT ESTABLISHED (native) | `src/editor/pagination.ts` (widget spacers, whole-block rule, heading keep-with-next); `tests/pages.spec.ts` 5/5 on rerun (one intermittent caret failure, defect 5); native screenshots and the P2 gate NOT RUN |
| 8 | Shift+Enter page break (Cmd+Enter soft break); Settings > Shortcuts lists every app action, records, refuses reserved and duplicates, resets, persists, hints follow | PARTLY | page break, soft break, DOCX `pageBreakBefore`: `tests/page-break.spec.ts` passed in my run; recording, reserved/duplicate refusal, reset, persistence, hint: `tests/shortcuts.spec.ts` 4/4. NOT met: refusal is incomplete -- a chord with no modifier is accepted (defect 1), a Control chord can be shadowed (defect 4); Shift+Enter inside a list item nests the break (defect 3) |
| 9 | Right-click or Shift+F10 in a table opens the six-item menu; Escape closes and returns focus | MET (browser) | `src/editor/TableContextMenu.tsx`, `Writer.tsx` `handleDOMEvents.contextmenu` and the `ContextMenu`/Shift+F10 branch; `tests/tables-context.spec.ts` 3/3 in my run |
| 10 | Groups and entries reorder by dragging with a 2 px accent line and no shadow; arrows still work; order persists | PARTLY | `tests/drag-reorder.spec.ts` 8/8 in my run (line, no shadow, arrows, persistence, Escape, reduced motion); NOT met: the armed-drag defect (defect 2) |
| 11 | File drag shows an outline on the region that takes it with accept/reject feedback, no page tint; a Select files button is the keyboard path; native drop a hand check | MET (browser) / NOT ESTABLISHED (native) | `src/components/DropTarget.tsx`; `tests/drop-target.spec.ts` 7/7 in my run. On the Projects screen the keyboard path is the "Import writing" text button (T158, owner decision 4 in VALIDATION.md); the PDF slot keeps "Select files". Native region check (`payload.position / devicePixelRatio`) never driven |
| 12 | Tabular figures on counters; 24 x 24 hit areas; sidebar labels share one x; optical nudges documented | MET as rules / limitation recorded | `src/styles.css` `font-variant-numeric: tabular-nums` on `.document-statistics, .save-status`; `::after` hit-area rule; `--optical-x/--optical-y` hook; `src/designTokens.test.ts` (passed); `tests/alignment.spec.ts` 7/7 in V's run (not rerun). Futura has no tabular digits: `docs/limitations.md` and owner decision 2 |
| 13 | `docs/ui-review-checklist.md` with Floor/Reflex/Finish tiers; reviewers in this wave cite it | PARTLY | file exists (80 lines, three tiers, principles kept); 8 of the 21 task records checked cite an item id or the checklist (T131, T133, T136, T139, T145, T146, T147, T152 by grep; the rest do not) |
| 14 | Full validation list passes; `Personal Word.app` rebuilt; every status CLAIMED | PARTLY | steps 1-5, 8, 9, 11 done by V (tsc 0, unit 1025, build 0, Playwright 265/265, cargo 63/1, exports, app sha256 `31fff151...`, 0 smoke markers); steps 6, 7 and the P2 native gate NOT RUN (screen locked); every doc says CLAIMED |

## Data safety (AGENTS.md "Preserve writing")

- **Page spacers never enter the document, saves, undo or exports.** They are ProseMirror widget decorations (`src/editor/pagination.ts:53-71`), not nodes; the plugin's own transaction carries `setMeta("addToHistory", false)` (`:267`) and no doc change, so Tiptap's `update` (which gates the Writer's `onEdit`) does not fire for it. Probe P5: after typing 60 paragraphs in page view with spacers present, the stored project JSON (`folio.preview.project.*`) and `editor.getHTML()` contain no `spacer`, and the history has one event. Exporters read the JSON model (`src/export/document.ts`), never the editor DOM; V's step 8 checked the DOCX and PDF output. The `Pagination` extension is added only in the Writer (`Writer.tsx` `editorExtensions`), not in `documentExtensions()`, so the shared schema, importers, `getSchema` users and the Rust allowlist are untouched (no `src-tauri/src/store.rs` change in the diff).
- **Sidebar reorder** goes through the existing `onReorder` / `onGroupOrder` props into App's `mutate` (unchanged this wave); `tests/drag-reorder.spec.ts` asserts "Saved" and the order after reload. Defect 2 can trigger that path unintentionally but through the same immutable mutation; nothing is lost and the arrows undo it.
- **Rename on blur** trims and refuses empty (`ProjectSidebar.tsx` `commitTitle`); Enter and Escape suppress the duplicate blur commit. Probe P4. Edge not tested: a blur caused by the project closing while the input is open (browsers differ on firing blur on removal); the handler would call `onRenameProject` with the still-current project, so no cross-project write is possible from that closure (inferred from the code).
- **Split open/close** never remounts the left Writer (same React key); `split-view.spec` covers per-pane undo, undo after close, DOM identity and scroll. Fragment restore in a split pane uses `item` (the focused pane's entry, set by `focusSide`), as before.
- **Native PDF drop** (`src-tauri/src/dropped.rs`): `read_capped` keeps its exact semantics through `read_guarded`; `DROPPED_EXTENSIONS` and `MAX_DROPPED_BYTES` are unchanged and pinned by `the_importer_allow_list_still_excludes_pdf`; `read_capped_pdf` applies the same path-must-be-in-latest-drop, extension, regular-file (no symlink), size and grow-after-stat guards with a 25 MB cap; both commands are registered in both builds (`lib.rs`). cargo 63/1 in V's run.
- **Keys and identity:** the one new storage key is additive (`folio.workspace.shortcuts`, `src/shortcuts/store.ts`); corrupt or unknown values are dropped on read. `com.folio.writing` is the built app's identifier (V step 9). No model, store or metadata change in the diff (`src/model.ts`, `src-tauri/src/store.rs` untouched).

## Findings in detail

### F1 -- High: a chord with no modifier can be recorded (T162)
- Where: `src/shortcuts/store.ts` `chordProblem()` (only reserved-list and duplicate checks); `src/settings/ShortcutsSettings.tsx:27-33` records whatever `parseChord` returns once it is not a lone modifier.
- Scenario: Settings > Shortcuts, Change beside Save, press `g` (a slip, or a user who expects to add Cmd next). The row shows `G`. Back in the editor, typing "gag" produces "a": each `g` is swallowed by the App's window keydown handler (`App.tsx`, `resolveChord`) and saves instead. Enter, Space, Backspace, Tab and the arrows can be recorded the same way; Shift+letter too.
- Evidence: `REV/probe.log` -- `RECORDED save chord: "G"`, `EDITOR TEXT after typing gag: "a"`.
- Not covered by: `src/shortcuts/shortcuts.test.ts`, `tests/shortcuts.spec.ts` (both only try reserved and duplicate chords).
- Recovery exists (Reset / Reset all), so it is not data loss, but it blocks writing until the user finds it.

### F2 -- Medium: a drag stays armed after a release outside the row (T163)
- Where: `src/components/useDragReorder.ts` -- `onPointerDown` (`:60-69`) arms `DragController.pending` without capturing the pointer; capture only happens in `onPointerMove` once the 5 px threshold is crossed (`:72-79`); `onPointerUp` is bound to the row only (`:81`), so a release elsewhere never reaches it and nothing clears `pending`.
- Scenario: press on a manuscript row, move sideways into the editor at the same height, release. Later the pointer crosses that row at a different height with no button down: the row lifts and follows the pointer, siblings shift, the drop line shows. It stays like that until Escape or a click on the row; a click that moves 5 px or more completes a reorder, which saves.
- Evidence: `REV/probe.log` -- `LIFTED rows after hover-back with no button: 1` (P2 failed its "expect 0").
- Fix direction (for the task, not applied): capture the pointer on pointerdown, or clear `pending` on a window `pointerup`/`pointercancel` while armed, and ignore moves with `e.buttons === 0`.

### F3 -- Medium: Shift+Enter inside a list item nests the page break (T164)
- Where: `src/editor/pageBreakKeys.ts` declines only inside `tableCell`/`tableHeader`; elsewhere it inserts `[pageBreak, paragraph]` at the selection, which inside a `listItem` lands inside that item.
- Evidence: probe P3 JSON -- `{"type":"listItem","content":[{"type":"paragraph",...},{"type":"pageBreak"},{"type":"paragraph",...}]}`.
- Consequence: `src/editor/pagination.ts` `computeBoundaries` walks `doc.forEach` (top level) so page view shows no new page; `src/export/document.ts:239-262` visits list-item children and emits a `pageBreak` block, which `docx.ts` turns into `pageBreakBefore` and `pdf.ts` into a break. Editor and exports disagree. The heading case is fine (the break lands at top level after the heading).
- Fix direction: mirror the table-cell rule for list items and block quotes (decline), or lift the break to the top level after the list.

### F4 -- Low: Control-chord override is accepted but shadowed (folded into T162)
- `chordProblem("newSection", {key:"s", ctrl:true}, {})` returns null, but `resolveChord(Ctrl+S, {newSection: ...})` returns `"save"` because the press is also compared folded (Ctrl treated as Cmd) and Save comes first in `ACTIONS`. Evidence: `REV/shadow.test.ts` output `PROBLEM: null`, `RESOLVES TO: save`. Fix: compare the folded chord in `chordProblem` as well, or refuse Control-only chords on the Mac.

### F5 -- Low, intermittent: caret ArrowDown across the page gap (T165)
- `tests/pages.spec.ts:240` -- `Expected: >= 1848, Received: 1846` once (`REV/suite.log`), passed on the single rerun (`REV/pages-rerun.log`) and in V's run. The spacer is a `contenteditable=false` widget with `ignoreSelection`; a vertical caret move that lands 2 positions short suggests the browser's line-step landed in the previous block's last line under some layout timing. Unknown whether it reproduces by hand; it is one of the six caret flags the P2 native gate checks, so the morning gate will say more.

### Minor observations (no task)
- `src/import/dropImport.ts` `listenForNativeDrops` has no callers since `DropTarget` listens itself; `docs/architecture.md` notes the same for `slideHighlight` but not for this one. Tidy-up only.
- The "reviewers cite the checklist" DoD line is partly met (8 of 21 task records).
- The More popover stays open after the Page view toggle plus a document-level Escape (V's 4b' note; consistent with my `REV/shots/more-light.png`, where a second click on More closed the panel rather than opened it). Already known; harness closes it explicitly.
- `button:active:not(:disabled) { transform: scale(0.99) }` now applies to every button, including the primary and the tabs; the reduced-motion block (`styles.css:1879`) zeroes the transition. No conflict found with the rotated `.group-chevron` (it is a span, not the button).
- Modified specs: every removed assertion I found maps to a removed feature (sliding highlight boxes, `.popover-highlight`, label mode and `data-labels`, HTML5 `draggable`, the old selected-row fill colours). `tests/appearance.spec.ts` dropped `expect(style.weight).toBeGreaterThanOrEqual(600)` on the group title because the doubling rule now demands weight 500 there; the replacement test asserts the entry's weight instead. No weakened check found.

## V's record (VALIDATION.md)
Honest and complete as far as I can check: results match the logs under `ui3-final/` for the steps I reopened (tsc, unit count, Playwright count, cargo), the locked-screen steps are marked NOT RUN with exact morning commands, the open owner decisions (whole-block page rule, counters under Futura, Cmd+Shift+S snapshot-only, Import writing button) are listed, incidents are recorded, and nothing is called VERIFIED. V's step 4 ran the whole suite once and `pages.spec.ts` passed there; my single failure of it is recorded above as intermittent, not as a contradiction. T161 (filed by another agent during this review) asks V to correct the D2 approval time and the start-fingerprint wording in VALIDATION.md; neither touches the results I reopened.

## Docs honesty
`docs/design-system.md`, `docs/limitations.md`, `docs/validation.md`, `docs/changelog.md`, `docs/architecture.md`, `README.md` and `AGENTS.md` say CLAIMED, mark native items not run, and carry the pending owner decisions (page rule, counter digits, Cmd+Shift+S). `docs/architecture.md` wrongly implies the drag hook is the only dead-code note (see minor observations). The design doc's Pages section states the whole-block rule is CLAIMED and asks the owner the straddle question. No doc claims native WebKit behaviour.

## Not established
- Everything native (listed under Verdict). The `DropTarget` native region test divides a physical position by `devicePixelRatio`; correct per Tauri 2's event shape (inferred), never run.
- T155's WebKit harness fixes (Chromium dry-run only).
- Opening the exported DOCX in Word or Pages.
- Reduce Motion with real macOS menus.
- Whether F5 reproduces by hand or in WebKit.
- `tests/editor-toolbar.spec.ts`, `tests/projects-screen.spec.ts`, `tests/alignment.spec.ts`, `tests/motion*.spec.ts` were not rerun by me; they passed in V's whole-suite run on the same tree.

## What the owner must check in the morning
1. Run the native steps in VALIDATION.md "Native steps NOT RUN" (unlocked, unoccluded screen, serial slot held): smoke rebuild, native reliability baseline and beta, native smoke, native screenshots plain and color, then the P2 native gate per `ui3-p2/NATIVE-GATE-MORNING.md`. View every PNG, especially `writing-pages-*`.
2. Decide the four open items in VALIDATION.md: page rule (whole block vs straddle), counter digits under Futura, Cmd+Shift+S snapshot-only, the "Import writing" button.
3. After T162-T164 are fixed: open Settings > Shortcuts, press Change and then a bare letter -- it must be refused; press a sidebar row, drag sideways into the editor, release, then move back across the row -- nothing may lift; put the caret in a bullet item and press Shift+Enter -- the break must not vanish into the list.
4. Then the hand-check sheet (a) to (v) in VALIDATION.md, in the new `Personal Word.app` (sha256 `31fff151...`).
5. Strays from the night: `/Users/ethansiegel/Local` and `./Processor` (empty folders; see VALIDATION.md incidents).
