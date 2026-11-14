# REVIEW-2: T4 menus (T308), T5 Projects page (T309), T6 dialogs/Settings/versions (T310), T8 comments/fragments/revisions (T312)

Reviewer: Opus "reviewer LP-A" (agent-99d3), 2026-11-12. This was a read-only review: I edited no source files. Four other workers (T305 bars, T306 sidebar, T307 toolbar, T311 research) were editing at the same time, so I judged only these four tasks' surfaces.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T310 (plan T6) | **REJECT** | It deleted `.dialog-actions { display:flex; gap }` and `.dialog input` margins, but three dialogs never got `.cluster`/`.stack`, so their buttons sit flush-left with no gap. Settings `.row` has no effect, and its invariant was narrowed until it passed. |
| T312 (plan T8) | **REJECT** | It swapped px for tokens and removed nothing (budget 26 -> 26 and 13 -> 13). The added `.stack` makes the comment dividers lopsided, `.row` silently changes the fragment-actions gap, and `.fragment-head` was skipped under a stop rule that is about a different element. |
| T308 (plan T4) | APPROVE, with should-fix | A real migration: per-menu item rules are deleted, every row is a `.row`, separators are `.menu-rule`, and the shell is shared. Fix the w9-fonts exception and widen the tests (see below). |
| T309 (plan T5) | APPROVE, with low notes | Duplicates are merged, the toolbar is a `.bar`, icon buttons are slots, and the card gap is 16. The whole-file rewrite did no damage that I could find. |

## What I ran
- `npx vitest run src/layoutPrimitives.test.ts src/designTokens.test.ts`: 14 passed, 1 failed. The failure is (a), "lower the budget" for library.css 12/16, editor.css 54/70, export-menu.css 1/4, research.css 61/81 and styles.css 117/189. These are shared files left to the coordinator. organization.css (26) and fragments.css (13) match their budgets exactly, which confirms T8 removed nothing.
- `npx vitest run src/palette.test.ts src/hoverEmphasis.test.ts src/motion.test.ts`: 37 passed. `npx tsc -b`: clean.
- First locked run (port 1461, lock held 18:23-18:28): `tests/layout-invariants.spec.ts -g "T4|T5|T6|T8|Projects"` gave 10 passed and 2 skipped (the T6_SHOTS block).
- Second locked run: command-palette, sidebar-context-menu, w9-fonts, w9-font-menu, projects-screen, comments, of5-settings and my throwaway `tests/reviewA-tmp.spec.ts` (deleted afterwards) gave 78 passed, 2 failed and 8 skipped. The two failures:
  - **w9-fonts** "open toolbar font dropdown": the offenders are `span.row-label "Futura" / "Arial" / ...` inside the open font menu (finding T4-1).
  - **sidebar-context-menu:135** (Shift+F10 placement): `box.left` is 8 px from `max(row.x, 8)`. T306 is rewriting this exact assertion (its comment says "Layout primitives T2: rows now start at the window edge") and held the lock straight after me. The menu's position comes from `ContextMenu.tsx` JS, and T308 changed only class names there. I do not attribute this failure to T308; rerun it once T306 lands.
- New screenshots (light and dark) in `notes/`: `reviewA-comments-*`, `reviewA-fragments-*`, `reviewA-versions-*`, `reviewA-revision-compare-*`, `reviewA-settings-*`, `reviewA-name-dialog-*`, `reviewA-import-preview-*`, `reviewA-projects-settings-modal-*` and `reviewA-capture-quote-*`. I opened and looked at the comments, fragments, versions, revision-compare, import-preview and capture-quote shots, plus every T4-*, T5-* and T6-* shot listed below.
- Measurements printed by the throwaway spec:
  - COMMENTS: the gap between items is 8 and the text sits 24 below each item's top, so a divider has 24 above it and 32 below.
  - VERSIONS: `titleToDateGap` is 0.
  - SETTINGS: heights are 32 / 32 / **37.5** (Interface font) / 32, then 37.5 for the Goals rows. Every `.settings-field` computes `display: grid`.
  - CAPTURE: `.dialog-actions` computes `display: block`, the gaps are `[0, 0]`, and the last button sits 72 px from the right edge.
  - PROJSETTINGS: `display: block`, and the Close button sits 33 px from the left edge.
  - MENUS: the palette, dropdown and context-menu rows all have a 12 px inset and are 32 tall. The palette input is 37 tall, not 40 (see T4-4). Keyboard: ArrowDown then "h" highlights "Heading 1", and ArrowDown in the context menu highlights "Open". The context menu computes `position: absolute`, z-index 70, `overflow: auto`, max-height 320 and width 160, the same as before.

## T310 (plan T6): REJECT

1. **blocker. `src/styles.css:1156` `.dialog-actions` no longer has `display:flex` or `gap`, and three consumers were not migrated.** Their buttons now sit flush-left and touch:
   - `src/research/CaptureQuote.tsx:38` (screenshot `reviewA-capture-quote-light.png`: Cancel / Save to source / Save and insert are left-aligned with 0 gap)
   - `src/research/CslImportPreview.tsx:104`
   - `src/components/ProjectLibrary.tsx:485`, the Projects-page Settings modal (its Close button now sits at the left)

   **Fix:** give each of the three `className="dialog-actions cluster gap-4"`. The two research files belong to T311 and ProjectLibrary to T309, so coordinate through the board. Alternatively, put `display:flex; gap: var(--space-4)` back on `.dialog-actions` until every consumer is migrated.
2. **should-fix. `.dialog input` lost its `margin-top: var(--space-2)` (`src/styles.css:1150`), but only the name dialog's label became `.stack.gap-2`.** In Import preview, "Project title" now touches its input (`src/import/ImportPreview.tsx:55-58`, screenshot `reviewA-import-preview-dark.png`). **Fix:** `<label className="stack gap-2">` there. Also check the Capture quote and Zotero dialogs: their `.field` grid has a 2 px gap, and the 24 px input bottom margin that used to separate fields is gone.
3. **should-fix. Versions rows: the title and date now touch (gap 0, measured).** `.version-item small { margin-top }` was deleted (`src/styles.css:1238`) without a replacement. **Fix:** in `App.tsx` add `className="stack gap-1"` to the `<span>` inside each `.version-item`.
4. **should-fix. Settings `.row` has no effect.** The two-class rule `.project-settings .settings-field` (`src/research/research.css:415`) still sets `display:grid` and `gap`, so `.row` contributes only `min-height: 32px`. Nothing was removed from research.css, organization.css, settings/*.css or segmented.css. Exact rework:
   - `.settings-form` (:411) becomes `.stack.gap-3`. Delete its `display:grid` and `gap`.
   - `.settings-field` (:415) becomes `.row.gap-3`. Delete `display:grid` and `gap`, and give `.settings-label` a fixed `flex: 0 0 180px`, so you keep the one label column without the grid.
   - `.settings-checks` (:440) becomes `.stack.gap-2` with `align-items: flex-start`.
   - `.settings-check` (:445) becomes `.cluster.gap-2`.
   - `.settings-actions` (:454) becomes `.cluster.gap-2`, keeping `flex-wrap`.
   - `.settings-section` (:391) becomes `.stack.gap-4`, keeping `border-top` and `padding-top`.

   `App.tsx`, `ExportPanel.tsx` and `TemplatePicker.tsx` also render these classes, so add them through `files add` or the coordinator. If that is refused, say so in the notes rather than leaving the decorative `.row`.
   - Dead code: `src/organization/organization.css:161` `.project-settings { padding: 30px }` loses to `div.project-settings` (research.css), so delete it. That selector is in T6's scope.
5. **should-fix. Ruling on (e): shortening `.settings-button` to `--space-1` block padding is not acceptable as done.** The buttons are now about 30 px, while `.settings-field .dropdown-button` (research.css:436) keeps `--space-2` and stays 36-37.5. The Interface font row is therefore 37.5 while the others are 32, and "Add font..." no longer matches the dropdown beside it (they matched in `gallery/before/settings-general-light.png`). **Fix:** give both controls a box of `--control-height`: `.project-settings .settings-button` and `.settings-field .dropdown-button` get `min-height: var(--control-height); padding-block: 0`.
6. **should-fix (test). The T6 invariant was narrowed until it passed.** The fail-first log measured every row (28 / 28 / 37.5 x4 / 39.5 / 36.8 x4). The test now filters to `Appearance|Palette|Storage location` (`tests/layout-invariants.spec.ts:304`), skipping the very row that is still uneven. **Fix:** assert every `.project-settings .settings-field` in General, and add Capture-quote and Import-preview cases for "actions are a flex cluster at the end".
7. low. `notes/T6.md` claims the versions panel was migrated but has no screenshot of it. Mine: `reviewA-versions-*`. Apart from finding 3, the panel spacing is even (heading, tabs and help are 16 apart).
8. ok. The name dialog takes its spacing from the `.stack.gap-5` frame, focus lands on the input (`DIALOG focus INPUT`), the revision-compare preview dialog is fine in dark, `T6_SHOTS` is skipped by default and harmless, and the `SettingsNav` `offsetHeight + 8` maths is untouched.

## T312 (plan T8): REJECT

1. **blocker (plan not met). Nothing moved onto the primitives.** Every edit in `organization.css` and `fragments.css` swaps a px value for a token. The declaration counts are unchanged (26 and 13), and only two `className` additions were made. The plan's steps 1-2 and 4 ("items in a .stack", "fragment rows = .row", "lower budgets") are not done in substance.
2. **should-fix (visible). The comment dividers are lopsided.** `CommentsPanel.tsx:38` makes the section a `.stack` (gap 8), and the `.feature-item` articles keep their own 24/24 padding. The result is 24 px above each divider and 32 below (measured; see `reviewA-comments-light.png`). **Fix:** wrap the items in `<div className="stack gap-0">`, and make the section `.stack.gap-5`.
3. **should-fix. The `.row` gap silently overrides the fragment-actions gap.** `fragments.css` loads before `layout.css` (REVIEW-1 finding 1), so `.row`'s `gap: var(--gap, 8px)` wins the single-class tie against `.fragment-actions { gap: var(--space-3) }` (`fragments.css:113`). The links moved from 12 to 8 apart without being reported, and the old declaration is now dead but still counted. **Fix:** `row gap-3` on both `.fragment-actions` divs (`FragmentLibrary.tsx`), and delete `display/align-items/gap` from `.fragment-actions`.
4. **should-fix. `.fragment-head` was skipped under the wrong stop rule.** "Fragment title band (floating)" means the project-title band tested by `tests/of2-fragment-title.spec.ts` (floating sidebar), not `.fragment-head`. **Fix:** make `.fragment-head` (`fragments.css:57`) a `.row` with `h2.row-label` and the chevron button `.slot` in a `.row-trail`. Keep `align-items: flex-start` on `.fragment-head` if wrapped titles must stay top-aligned. Delete its `display`, `gap` and `justify-content`.
5. **should-fix. Exact selector map for the rework:**
   - `.fragment-library` (:1): `.stack.gap-3`. Then delete `.fragment-count` margin (:40) and `.fragment-empty` margin (:45).
   - `.fragment-controls` (:8): `.cluster.gap-3`, keeping `flex-wrap`.
   - `.fragment-across` (:29): `.cluster.gap-2`.
   - `.fragment-item` (:50): `.stack.gap-2`, keeping `border-bottom` and `padding-block`.
   - `.fragment-icon` (:136): `.slot`, deleting `padding: 2px`.
   - `.fragment-tags` (:156): `.cluster.gap-2`.
   - `.feature-panel header` and `.feature-controls` (organization.css:6): `.cluster.gap-4`.
   - `.feature-item` (:17): `.stack.gap-2`, deleting `.feature-item small` margin (:24) and wrapping its buttons in `.cluster.gap-3`.
   - `.reader-options` (:145): `.cluster.gap-3`, with its margin-bottom taken from the parent stack.
   - `.reader-options label` (:151): `.cluster.gap-2`.
   - `.revision-change-controls` (:72): `.cluster.gap-3`, deleting its margin.
   - Then lower the `fragments.css` budget line, and report the `organization.css` count to the coordinator.
6. low. No screenshots were taken (the brief requires them). Mine are `reviewA-comments-*`, `reviewA-fragments-*` and `reviewA-revision-compare-*`. Apart from finding 2, nothing is clipped or misaligned, and the fragment-actions row wraps cleanly to two lines at a 390 px panel width.
7. low. Plan step 3 (adding the two files to `designTokens.test.ts` SWEPT) was refused because T304 owns that file. That is correct; the coordinator should do it.

## T308 (plan T4): APPROVE, with should-fix

The surface really gets its spacing from the primitives. Item padding is deleted from `.dropdown-option`, `.popover-shortcut`, `.command-palette-option`, `.create-project .popover [data-popover-item]` and `.export-menu-item`. `.create-rule`, `.export-menu-rule` and `.dropdown-separator` are replaced by `.menu-rule`. Every menu container is `.menu`. The screenshots (`T4-*`) show 32 px rows, a shared 12 px label edge and rules with 4 px above and below, in both themes. Definition of done (4) is met for New project, Export, dropdowns, context menus and the palette rows.

1. **should-fix (loose end a). w9-fonts fails, and the test should change, not the markup.** `tests/w9-fonts.spec.ts:61` exempts an element only when `el.classList.contains("dropdown-option")`. The face preview style is on `.dropdown-option` (`Dropdown.tsx:219`), and its text now sits in the child `span.row-label`, which inherits that face. The intent ("an open font menu shows each choice in its own face") is unchanged. **Fix:** `if (fontMenu && el.closest(".dropdown-option")) continue;`.
2. should-fix (test). "every menu uses one row height and one left inset" (`layout-invariants.spec.ts:272`) checks only the New project menu's inset, and there is no palette case, although plan step 7 asks for one. **Fix:** loop the inset (12) and row-height (32) check over New project, Export, Paragraph style, the context menu and `.command-palette-option`, and assert the palette heading, input text and option labels share one left edge. Also, the fail-first failed on a missing `.menu` selector, not a measured spacing value. Acceptable, but say so in the notes.
3. **ok (loose end b). T308 did not change dropdown anchoring.** The `Dropdown.tsx` diff is class names plus the `row-label` span. The deleted `.dropdown-menu` `position`, `top: calc(100% + 2px)` and `left: 0` were identical to `.popover`'s, and Dropdown always rendered through `Popover`. The zoom rect moved x 345 -> 367 with the width unchanged at 150: the trigger moved (format-bar inset 24, T307). The height grew 164 -> 168 because of T4's 32 px rows, so T307's re-recorded `popover-baseline-rects.json` must take the T4 height.
4. low. The palette input is a `.bar` but measures **37** tall, not 40. An `<input>` with `display:flex` ignores the `.bar` height because of the global input sizing. Either drop `.bar` from the input and give the palette a `.bar` wrapper `div` around it, or accept 37 and say so. Its inset (12) is correct.
5. low. Shortcut and hint spacing went from 24 (8 gap + 16 padding) to the row's 8 gap. In `T4-dropdown-dark.png` "Normal text ⌥⌘0" still reads clearly, because `.row-trail` sits at the row end and the 150 px minimum width leaves room. Not cramped.
6. low. Adding `.popover` to the context menu also makes `scroll-fade.css`'s `:not(:has(.popover, …))` drop the sidebar scroll fade while a context menu is open. That matches that file's stated intent ("a menu open inside the region … the mask is dropped"), so it is arguably a fix. Stacking (70), overflow, max-height (320) and width (160) were measured unchanged.
7. low. `.menu [data-popover-item]:focus-visible { outline-offset: -2px }` now applies to Export and table-menu rows too (previously only the New project menu). Consistent; fine.
8. **ok (loose end f).** `PopoverItem` always carries `.row`, and `TableContextMenu.tsx` already has `table-context-menu menu` (T307), so its rows are 32 with a 12 px inset. Its children are plain text, so the `row-label` span changes nothing there.
9. ok (rule 4). No new hover rule, no corner radius, no fill. Text-shadow emphasis inherits into the new `span.row-label`.

## T309 (plan T5): APPROVE, with low notes

1. **ok (loose end c). No damage from the whole-file rewrite.** In `src/styles.css`, braces balance (384/384) and no rule block is duplicated. I diffed every removed declaration against HEAD:
   - Each removal belongs to one of the tasks' own selectors, or to a selector that is dead (`.statusbar*`, `.local-label*`, `.sidebar-bottom*`, `.library-heading` and the styles.css `.format-bar` copy each have 0 TSX users).
   - `.format-bar .extract` was removed on purpose by T3, and its live copy is in editor.css:178.
   - `.project-tabs` moved to `.project-tabs.bar` with background, border and overflow intact.

   `tests/layout-invariants.spec.ts` parses and runs, has one `describe` per task, and the T5 block is intact; nothing was truncated.
2. low (loose end d). `.project-row .delete-entry { margin: 0 }` (`styles.css:2019`) is needed, because the base `.delete-entry` (`:1037`) keeps `margin-left` for its breadcrumb use in App.tsx. Its `padding: 0` is redundant with `.slot` (harmless). The mobile `.library-toolbar .library-display { --gap }` rule overrides through a custom property, which is the sanctioned way (REVIEW-1 1c), and is not a specificity fight. Both are acceptable.
3. low. Project rows are `.row`, but their height still comes from `.project-row > button:first-child { padding: var(--space-4) var(--space-1) }` (about 53 px rows). The rows are even and match the old look, and the plan allows taller rows. To follow the system strictly, those 16/4 paddings would become the row's `--row-height`/`--edge`; this can wait for the coordinator's budget pass.
4. low (test). "cards ... 16 px gap both ways" (`layout-invariants.spec.ts:433`) asserts only the horizontal gap; with 3 cards in one row there is no vertical gap to measure. Rename it, or seed 5 projects at 1440.
5. low. The Projects Settings modal (`ProjectLibrary.tsx:485`) lost its right-aligned Close button through T310's `.dialog-actions` change (T310 finding 1). The fix lands in this file, so T309 must accept that one-line edit.
6. ok. Screenshots `T5-*` in both themes match `gallery/before/projects-light.png`, apart from the 24 px slots and the 16 px card gap. projects-screen.spec passed 43/43 in my run.

## Not verified
- WebKit/native rendering: everything here is Chromium.
- The sidebar-context-menu:135 failure, until T306 finishes its edit of that assertion.
- The CslImportPreview (Zotero) dialog was not opened. Its actions problem is inferred from the shared CSS and the same markup as Capture quote.
- `tests/tmp-t3-look.spec.ts` (T307's scratch spec) is still in `tests/`. It is not mine, so I left it; T307 should delete it.
