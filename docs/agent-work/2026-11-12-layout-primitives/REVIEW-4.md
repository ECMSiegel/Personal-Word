# REVIEW-4: T305 (plan T1, app chrome bars), T307 (plan T3, format bar and toolbar popovers), T310 (plan T6 rework, dialogs/Settings/versions)

Reviewer: Opus "reviewer LP-C" (agent-a0e7), 2026-11-12. This was a read-only review: I edited no source files. T312 and T313 were live and another reviewer had T306/T311, so I judged only these three tasks' surfaces.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T307 (plan T3) | **REJECT** (1 blocker, 2 should-fix) | The bar, dividers, right edge and the empty Prose check are right, but with issues listed the Prose check rows overflow their boxes. Nested panels inside More break the panel rhythm. Keyboard focus no longer emphasises a checkbox row's label. |
| T305 (plan T1) | APPROVE (low notes) | Saved / Snapshot / Export are 16 / 16 apart. The top bar's and format bar's last ink both sit 24 px from the right at 1440 and at 1240 + 270 sidebar, light and dark. Its last locked run passed 37/37. |
| T310 (plan T6 rework) | APPROVE (low notes) | Every REVIEW-2 finding is fixed and measured. All 14 Settings rows are 32 on a 180 + 12 label column. The four specs it did not run all pass. |

## What I ran
- `npx tsc -b`: clean.
- `npx vitest run src/layoutPrimitives.test.ts src/designTokens.test.ts`: 14 passed, 1 failed. The failure is only the expected (a) "lower the budget" lines for shared files: library 12/16, editor 54/70, export-menu 1/4, organization 14/26, research 55/81, styles 118/189. No file is over its budget.
- Locked run 1 (port 1466, 19:40-19:55), two invocations:
  - `tests/layout-invariants.spec.ts -g "T1|T3|T6"`: **14 passed, 1 skipped** (the shared T2/T3 slots case is still fixme).
  - editor-toolbar, popover-bounds, hs2-spacing, w9-prose-menu, hs8-page-numbers, hs11-font-focus, w9-fonts, **w9-settings-nav, of5-settings, hs3-checkbox, rich-import** (the four T310 skipped), split-view and alignment: **every one of them passed**. The run's 8 failures were all in my own throwaway spec. Its viewport was wrong: I had not set 1440, so it ran at 1280x720.
- Locked run 2: the corrected throwaway `tests/reviewC-tmp.spec.ts` only, **16 passed**. I created it only while holding the lock and deleted it afterwards; `tests/reviewC*` is gone.
  - Screenshots are in `notes/reviewC-*.png`. The `pop-*`, `chrome-*`, `split-*`, `settings-*`, `versions-*`, `table-menu-*` and `pop-alt-*` shots are from run 2, at 1440x900 or at 1240x800 with a 270 sidebar.
  - The `more-*` shots are at 1000 wide.
  - The dialog shots `projects-settings-*`, `import-preview-*`, `choice-dialog-*`, `zotero-preview-*`, `capture-quote-*` and `name-dialog-*` were overwritten by run 2.
- I opened and looked at: chrome (light 1240, dark 1440 right end), Prose check empty (dark) and with 18 issues (light), Page setup with Paper size open, More (narrow) with Line spacing open from inside it, table menu, split view, Settings (Goals/Export), versions, snapshot preview, the Zotero import preview, Capture quote, choice dialog, Projects Settings modal, Import preview, Table controls, image alt text, Settings General and Settings bottom (Export/Templates) and the name dialog. I compared these with `gallery/before/`: Prose check, Line spacing, Table controls, More (narrow) and Settings General. The other "before" shots I did not open.

## T307 (plan T3): REJECT

Probes:
- **(a) ok.** `src/Writer.tsx` still has 10 `if (e.detail > 0) editor.view.focus()` and 14 `editor.view.focus()` calls, the same counts as HEAD. A sorted diff of the changed lines shows only class names, `row-label`/`row-trail` wrappers, the removed inline-style `div` and the `ic` helper. Nothing in any handler changed.
- **(b) ok.** The divider is still rendered for every group except `history` and `right`, the same as HEAD. Measured at 1440 (15 groups) and at 1240 + 270 sidebar (11 groups, More shown):
  - The first group has no divider, and `right` has none.
  - The group before `right` is `setup` at 1440 (no More) and `more` at 1240. Each has its own divider; there is no stray divider at either end.
  - Icon ink to divider is 10 / 10 at every icon boundary. Before a dropdown the measured box is 4, but the dropdown text sits 6 px inside it, so it reads even in the shots.
  - `fitToolbar` reads computed padding and column-gap, and group `offsetWidth` includes the divider's margins. Insert stays on the bar at 1240.
- **(c) ok, with a low note.** `content-box` keeps the old 260 px content width, so the box is 284 (286 in the fixture, which counts the borders). It is a local min-width choice and acceptable. Writing `min-width: calc(260px + 2 * var(--space-3))` would avoid also inflating `max-width` to 420 + 24.
  - Height 255-257 for 7 lines (5 rows of 28, summary 28, help 15, gaps of 8) is right for the system and reads well (`reviewC-pop-prose-dark.png`). The "On" row now matches the rule rows exactly.
- **(d) ok.** popover-bounds passed against the fixture, and my own boxes at 1440 match it: zoom 359/109.5 150x168; paragraph 442/109.5 167.7x104; font 555/109.5 150x232.
  - Line spacing measured 1173/114.5 230x181 and Page setup 1074.6/114.5 263.4x217 against the fixture's 1172/113.5 232x183 and 1073.6/113.5 265.4x219. The differences are exactly the popover's 1 px border on each side: I measured the inner `.panel`, while the fixture records the `.popover`. popover-bounds measures the `.popover` and passed.
- **(e) ok.** Page setup rows are 28 with 8 gaps. The Paper size menu opened inside the panel has 32 px rows (measured), and the invariant "a dropdown menu opened inside the Page setup panel keeps 32 px menu rows" exists and passes.
- **(f) ok.** `tests/tmp-t3-look.spec.ts` is gone.

Findings:
1. **blocker. Prose check with issues listed: issue rows overflow their 26 px boxes.** See `reviewC-pop-prose-issues-light.png`, with 18 issues at 1440: "Consider removing “basically”" wraps to 3 lines inside a bordered button that stays 26 px tall, so the text spills over the border above and below. Every row with a wrapped message looks broken.
   - Cause: `src/editor/editor.css:48` `.prose-issues .toolbar-text-button { height: auto; min-height: 26px }` (0,2,0) loses to the later `.writer .toolbar-presets button, .writer .toolbar-text-button { height: 26px }` (:297-298, also 0,2,0).
   - This is pre-existing: neither rule appears in the T3 `editor.css` diff, and HEAD has the same order. But it is T3's owned selector (`.prose-issues*`), it is the popover the owner complained about, and Definition of done (5) says "nothing touches". The worker's notes and screenshots only cover the empty state.
   - **Fix:** raise the issue-button rule to `.writer .prose-issues .toolbar-text-button` (height auto, `min-height: var(--row-height)`, `padding-block: var(--space-1)`). Then re-shoot Prose check with issues.
2. **should-fix. Panels opened inside More break the panel rhythm and the shared trailing edge.** In `reviewC-more-line-light.png` (1000 wide, Line spacing opened from More), Custom, Space before and Space after are **34** tall, not 28. Their number boxes sit 8 px in from the preset row's right edge.
   - Cause: `src/editor/editor.css:278-282` `.writer .toolbar-popover.is-more .dropdown, .writer .toolbar-popover.is-more .toolbar-number { margin: var(--space-1) var(--space-2) }` also matches controls inside nested `.panel` rows. The rule existed at HEAD, but on the bar the panel is now a `.panel` with `.row`s and this rule undoes it in More.
   - **Fix:** scope it to the More list's own controls, e.g. `.writer .toolbar-popover.is-more .toolbar-group > .dropdown`, `… .toolbar-group > .toolbar-number`, or add `.writer .toolbar-popover.is-more .panel :is(.dropdown, .toolbar-number) { margin: 0 }`.
   - Add a T3 invariant that opens Line spacing from More at 1000 px and runs `expectEvenRows`.
3. **should-fix (from CSS, not run in a browser; the only item here that T3 itself made worse). Keyboard focus no longer emphasises the label of the Prose check rows ("On" and the 4 rules) or of Page numbers.** The shared emphasis rule (`src/styles.css` ~:423-485, ending in `:is(:hover, :focus-visible, …, label:has(> input:focus-visible))`) fires on a label only through `label:has(> input:focus-visible)`, which needs the checkbox to be a **direct** child of the label. T3 moved each checkbox into `span.row-trail` (`ProseIssues.tsx:41-45`, `Writer.tsx:1847` "On" and :1952-1955 "Page numbers").
   - Mouse hover still emphasises them; I measured the "On" label at 0.3 px under the pointer. So hover has lost its keyboard equivalent (AGENTS.md: "Every hover interaction must have keyboard access").
   - hs3-checkbox does not cover this: it only checks that the boxes are 14 px squares.
   - **Fix (within T3's files first):** keep the checkbox a direct child of the `<label class="row">`, after a `.row-trail` that holds only the count (or give the checkbox `margin-inline-start: auto` when there is no count). The alternative is the coordinator widening the shared selector in styles.css to `label:has(> input:focus-visible, > .row-trail > input:focus-visible)`; that file is not T307's. Add an assertion to w9-prose-menu: Tab to a rule checkbox, then the label's `text-shadow` is not `none`.
4. low. Line spacing presets (26) and Table controls buttons (26, `.stack.gap-1`, 4 apart) sit inside 28/8 panels. They are tidy, but they are not "rows of one height with one gap". Acceptable as button groups; say so in the notes.
5. low. Plan step 5 ("More-formatting overflow: slots in a .cluster grid") was not done: More keeps labelled 32 px rows, the same as HEAD, with group gaps evened to 4. That is the better choice (no behaviour or text change), but it is a plan deviation that was not raised. Record it.
6. low, unconfirmed. **Table right-click menu above the format bar:** at 1440x300 the menu opened downwards from the click and ran past the viewport bottom (229..431 in a 300 px window, `reviewC-table-menu-over-bar-light.png`), so I could not make it overlap the bar. By the stacking walk in REVIEW-1 (anchor `--layer-popover` 45 against the bar's 40 in the same `.writer` context) it should paint above. The fact that the menu does not flip or clamp at short window heights is positioning (`Popover`/`TableContextMenu` JS), not T3, and is probably pre-existing.
7. should-fix (test gap). Nobody ran `tests/tables-context.spec.ts`, although T3 changed that menu's class (`table-context-menu menu`) and deleted its item CSS. Run it in the rework.
8. ok. Image alt-text panel: rows 15 (filename) / 28 / 28 with 8 gaps; Insert and Cancel are at the end. The table context menu is a `.menu` of 32 px rows with a 12 px inset. The More list rows are 32. Dropdown rows are 32 in both themes.

## T305 (plan T1): APPROVE

- **Its last locked run (`t305a.log`, 19:05): 37 passed, 0 failed.** That covers hs1-export-menu, hs4 (3), split-view (27) and w9-export-menu (6). `tests/hs4-sidebar-align.spec.ts` was last modified at 18:24, so the run used the 128/188 constants. A tab row of 34 -> 32 gives -2 px, and those numbers are -2 from 130/190: consistent.
- Measured at 1440 and at 1240 + 270 sidebar, light and dark:
  - Gaps between Saved, Snapshot and Export are 16 / 16.
  - The top bar's last ink and the format bar's last ink are each 24.0 from the right edge.
  - The top bar and the format bar are both 40 tall.
  - Snapshot's box is 74x32 and the Export trigger 60x32, so `padding: 0` still leaves a 32 px-high hit target.
  - The split headers are 32 tall with the title 24 in and the close icon ink 24 from the right. Both pane footers are 32.
- The two-class rules are acceptable. `pane-footer.css` loads before `layout.css`, so a single-class `height: auto` would lose to `.bar-compact`. `.project-tabs.bar` must beat `.bar`'s gap and centring. The old single-class rules were deleted, not left to fight.

Low notes:
1. The footer wrap was not exercised. With goals set (80,000 total, 750 a day, deadline) the line still fitted in a 485 px pane. From CSS: when it wraps, `.bar`'s 8 px row-gap applies (`.pane-footer.bar` overrides only `column-gap`) and there is no block padding, so two lines are about 38 px with the text close to the rules. Before, the row-gap was 0, so this is not worse. Check once by hand in a narrow split.
2. The top bar's left content (breadcrumb at about 60 px) does not share an edge with the format bar's first icon ink (30 px). That is the same as `gallery/before` and is not in Definition of done (3). The sidebar toggle `.slot` (24) would put its ink at 28 against the toolbar's 30 if it is ever shown with the bar. Not blocking.

## T310 (plan T6 rework): APPROVE

The REVIEW-2 findings, re-checked:
1. **Fixed.** `dialog-actions cluster gap-4` is on CaptureQuote.tsx:38, CslImportPreview.tsx:104, ProjectLibrary.tsx:485, ProjectDialogs, ImportPreview (x2) and the new header-colour dialog. The **Zotero preview, opened in the browser**, measured `display: flex`, gap 16, last button 1 px from the content edge (`reviewC-zotero-preview-*.png`). Capture quote, Projects Settings and Import preview are asserted by the invariant (passed) and look right in my shots.
2. **Fixed.** The Import "Project title" label is `.stack.gap-2`, and the invariant asserts 8 px (passed). Capture quote fields are `.stack.gap-2`.
3. **Fixed.** The versions title and date are 4 apart (invariant passed). Versions panel spacing is heading / tabs / help / create / rows at 16 (measured).
4. **Fixed.** `.settings-field` is a real `.row.gap-3`: the grid and gap are deleted from research.css, and the label is `flex: 0 0 180px`. Settings sections, forms, checks and actions are on the stack and cluster primitives in GeneralSettings, AppearanceSettings, ExportPanel, TemplatePicker and App.tsx. The dead organization.css `.project-settings` rules are gone.
5. **Fixed.** Inputs, dropdown buttons and Settings buttons get `min-height: var(--control-height); padding-block: 0`. "Add font..." matches the Futura dropdown again (`reviewC-projects-settings-light.png`).
6. **Fixed.** The T6 invariant now asserts every `.settings-field` (32 tall, 12 apart, label column, control column at +192). It passed in my run.
- My own run 1 log (invariant output) shows **14 rows**, every one 32 tall, with the label at x 543 and the control at x 735 (+192), and 12 between consecutive rows. Control widths: Appearance 174, Palette 113, Interface font 432, Storage 89, number boxes 72, dropdowns and date 260. These match the worker's figures, and the controls are unchanged against `gallery/before/settings-general-light.png`, where "Add font..." now matches the dropdown's height.
- The shared files edited with python read-modify-write (App.tsx, research.css, layout-invariants.spec.ts):
  - `npx tsc -b` is clean.
  - The App.tsx diff contains only the expected regions: T6 classes, T313's header strings and colour dialog, T305's top bar and split header.
  - The research.css settings block is coherent, and every invariant describe I ran (T1/T3/T6) parses and passes.
  - I found no damage. I cannot attribute every research.css line between T310 and T311.
- The four specs it skipped all passed: w9-settings-nav, of5-settings, hs3-checkbox and rich-import.

Low notes:
1. In the Projects-page Settings modal's Shortcuts list, "Insert page break" shows its "⇧↩" in the Change column (`reviewC-projects-settings-light.png`). ShortcutsSettings is untouched by this batch, so this is pre-existing. Note it for a later pass.
2. Capture quote leaves a large gap between the Quotation textarea and the Page field (the stack's 24 plus the field's own label). It is even, not cramped.

## Not verified
- WebKit/native rendering: all of this is Chromium.
- Whether the table right-click menu paints above the format bar when they overlap (T307 finding 6). `tests/tables-context.spec.ts` was not run by anyone.
- T307 finding 3 (keyboard emphasis) is read from the CSS, not observed in a browser.
- A wrapped pane footer (T305 note 1).
- Exactly which research.css lines came from T310 and which from T311.
