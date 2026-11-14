# REVIEW-1 -- T0 foundation (board T304)

Reviewer: Opus (agent-6efd), 2026-11-12. Read-only review: no source edited, no Playwright run (lock saturated), reasoning from code.

## Verdict: APPROVE

The tokens, classes, layer scale and guard test do what "The system" says. Nothing below makes the eight consumers build the wrong thing if they act on findings 1 and 2 now. Findings 1-2 are should-fix and need attention today; the rest can wait.

Commands run: `npx vitest run src/layoutPrimitives.test.ts src/designTokens.test.ts` -> 14 passed, 1 failed: (a) reports `src/styles.css: 173 ... lower the budget to 173`, which is a worker mid-migration, as expected. `npx tsc -b` -> clean.

## Findings

1. **should-fix (urgent, tell workers): the CSS load order is the opposite of what the docs say.** `src/main.tsx:3` runs `import App from "./App"` *before* `./styles.css` (:4) and `./components/layout.css` (:5). App's import graph pulls in nearly every component stylesheet (editor.css, toolbar-motion.css via Writer.tsx:62-63; popover, dropdown, context-menu, command-palette, export-menu, library, split, pane-footer, organization, fragments, research, citation-card, segmented, floating, scrollspy, drag-reorder, scroll-fade, settings-nav, shortcuts-settings, drop-target). Vite injects CSS in module run order, in dev and in the build. So **layout.css comes after almost every component file and wins every specificity tie against them and against styles.css.** Only `icon-magnify.css`, `prose-issues.css`, `appearance-settings.css` and `side-ruler.css` load after layout.css.
   - Wrong text: `docs/design-system.md` "Layout primitives" paragraph ("so every component stylesheet imported later still wins a tie") and `notes/T0.md` "What changed".
   - What this means for workers: (a) a leftover single-class rule such as `.dropdown-option { padding: 6px 12px }` loses its inline padding to `.row` but keeps its block padding, so the row is taller than 32. Delete the old declarations (that is what the plan wants anyway); do not count on the primitive "just winning". (b) Any rule with two or more classes, such as `.writer > .format-bar { height; gap }` (editor.css:101-110) or `.writer .toolbar-popover { gap: 10px }`, still beats `.bar`/`.panel`. It must be deleted, not overridden. (c) A single-class override written to *change* a primitive inside a component file loses silently. Use a two-class selector or a custom property (`--edge`, `--gap`, `--value-width`). (d) **T3 exception:** `prose-issues.css` loads *after* layout.css, so its single-class `gap`/`padding` rules override `.stack`/`.row`. T3 must delete them.
   - Verified in the last build. `dist/assets/index-Da-T6L2W.css` (16:19, built before layout.css existed, with the same import graph) has `.writer>.format-bar{` at byte 1663 and `.dropdown-menu{` at 19744, both before styles.css's `:root{` at 54324, while `.prose-issues-panel` sits at 97948, after it. No `React.lazy` or dynamic CSS imports exist (the only `import()`s are Tauri APIs and `./pdf`).
   - Fix: one sentence in design-system.md: "layout.css loads after every component stylesheet except icon-magnify, prose-issues, appearance-settings and side-ruler (App's graph is imported first in main.tsx), so it wins single-class ties; delete old declarations rather than override." Do not reorder the imports mid-migration.

2. **should-fix (one line in layout.css): `.panel`'s `--row-height` leaks into menus nested inside it.** `src/components/layout.css:108-112` sets `--row-height: var(--row-height-compact)` on `.panel`, and custom properties inherit. `.dropdown-menu` is rendered in place, positioned absolutely inside its own wrapper (`src/components/Dropdown.tsx:188`, `dropdown.css:44`), so Page setup's Paper size and Page margins dropdowns sit *inside* the Page setup `.panel`. Once T4 makes their menus `.menu` + `.row`, those rows come out 28 px instead of 32. That breaks Definition of done (4), and no invariant catches it: T4's dropdown case uses Paragraph style, which is not inside a panel. `--edge` is already reset by `.menu`; `--row-height` is not.
   - Proposed amendment to "The system" (the coordinator's decision, because implementers may not change it): in layout.css `.menu`, add `--row-height: var(--control-height);`. That is 32 px, a token, and passes test (c).

2b. **should-fix (plan/doc ambiguity, not a T0 defect): `.gap-N` has no effect on `.bar` or `.row`.** Both hard-code `gap: var(--space-2)` (layout.css:21, :83) and never read `--gap`. So a `.bar-divider` inside a `.bar` gets 8 px of gap plus 8 px of margin, 16 px on each side, while design-system.md says "`--space-2` each side". T3 currently gets around this with `.writer > .format-bar { gap: 0 }` (editor.css:106, specificity 0,2,0, counted in the budget). That works, but every other consumer needs to know: on a bar or row, use a `.cluster.gap-N` child, or override `gap` with a two-class selector. layout.css matches the plan as written.

3. **low: a 14 px chevron sits 1 px inside the edge under `.flush-end`.** `.flush-end` pulls the cluster out by (24-16)/2 = 4 px. A 16 px icon lands exactly on the edge, but a `--icon-chevron` 14 px chevron has 5 px on each side, so its ink ends 1 px inside. T2's heading trail ends with the chevron and the entry-row trail ends with Open beside (16 px), so the "shared right-hand columns" check (`expectSharedEdge(headingSlots.last(), rowSlots.last())`) measures about 1.0 px, right on the 1 px tolerance. It will be flaky in WebKit. Fix (T2): compare the slot boxes (`boundingBox`) rather than `ink()` for the column check, or draw that chevron at 16. The toolbar maths is right: (28-16)/2 = 6, and `:has(> .slot-toolbar)` is specificity 0,2,0, so it beats plain `.flush-end`. `:has` needs Safari 15.4; the app already uses `:has` in 20 places.

4. **low: `@property --gap` support.** Safari 16.4+ supports it, and the owner's macOS 15 WebKit does, as does Chromium. No `minimumSystemVersion` is set (`src-tauri/tauri.conf.json`), so the Tauri default applies. On a WebKit without `@property`, `--gap` simply inherits: a `.cluster` nested in a `.stack.gap-4` gets 16 instead of 4. That degrades but does not break. Registering with `syntax:"*"` and no initial value gives the guaranteed-invalid initial value, so `var(--gap, default)` picks the default correctly. No action needed for this owner.

5. **low: `.bar-main`'s `--edge: 24px` also inherits.** Anything non-portaled inside the top bar or format bar that uses `.row` without its own `.menu`/`.panel` reset gets 24 px insets. `.menu` (12) and `.panel` (0) both reset it, so today this only matters for an ad-hoc `.row` in a bar. Note for T1/T3, no change.

6. **should-fix (helpers): `ink()` sees no form controls and no CSS-drawn marks.** `tests/layout-helpers.ts:30-66` unions text-node ranges and `<svg>` boxes only. An `<input>`/`<select>`/`<textarea>` has no text node, closed `<option>`s have no client rects, and `::before`/`::after` or background icons are invisible to it. `ink()` on a `.row-trail` that holds only a checkbox (Prose check, `ProseIssues.tsx:44`) therefore throws "draws no visible text or icon", and a trail with checkbox + count reports only the count. Truncated text (`text-overflow: ellipsis`) reports the unclipped width. Fix: in the walker add `else if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) { if (shown(node)) add(node.getBoundingClientRect()); }`. Measuring the border box is fine for the shared-trailing-edge checks.

7. **low: the budget test (a) is fine as a ratchet, but awkward while workers share files.** Counting rule checked: comments are blanked before parsing; multi-line declarations split on `;`; `@media`/`@supports`/`@container` are counted; `@media print` and `@font-face`/`@property` are skipped; `margin: 0 auto` and `inset` behave as documented (counted / not counted); `isZero` handles `0 0` and `!important`; a new `padding: 6px` in any component file is caught. Weak spots:
   - (i) Document selectors are matched by substring over the whole selector list, so `.foo, .writing-surface p { padding }` exempts `.foo` too.
   - (ii) A brand-new CSS file is accepted at any count ("add it with N"), which is a loophole for moving spacing out of a budgeted file.
   - (iii) `src/styles.css` is shared by T1/T2/T5/T6/T9 and the rule is "equal". Its line fails for everyone whenever another worker has removed declarations without lowering the line, as now (173 vs 189). Concurrent Edit-tool writes to different lines of `layoutBudget.json` do not merge-conflict (shared working tree, no branches), but two edits in the same instant can clobber each other.
   - Convention for workers: set your own file's line to the count the test prints, and treat `styles.css`/`editor.css` mismatches caused by others as expected until final validation.
   - z-index check (b): `z-index: auto` would be flagged as bad (`Number("auto")` is NaN). None exists today.

8. **low: stacking walk.** Each replaced site, before and after:
   - `.modal-backdrop` 70 -> modal 70, `.dropdown-menu.context-menu` 70 -> modal, `.command-palette` 60 -> overlay, `.sidebar-shell.is-overlay` 60 -> overlay: unchanged values.
   - `.popover` and `.dropdown-menu` 40 -> 45: they used to tie the format bar and now always beat it. Intended; this replaces the deleted export-menu 41.
   - `.writer > .format-bar` (and the focus-hidden copy) 40 -> bar 40. The bar is `position: relative` with a z-index, so it is a stacking context. Toolbar popovers inside it (`.writer .toolbar-popover` 40 -> 45) only order within the bar, and the bar still sits at 40 against the rest. Unaffected.
   - `.writer .table-menu-anchor` 50 -> 45: still above the format bar's context (40) and therefore above toolbar popovers, as before. Now it ties with top-bar popovers instead of beating them, and DOM order (writer after top bar) keeps it on top. No visible change.
   - `.notice, .error-banner` 30 -> 40: fixed bottom-centre. They were below the citation card (inline 39, `App.tsx:2962`) and now paint above it where they overlap on narrow windows. They are still below popovers (45) and overlay (60). Minor and plan-mandated; worth one glance in the owner's hand test.
   - Remaining literals are all 1-9.

9. **low: invariants vs Definition of done.** The file is now being edited by workers (only 1 `test.fixme` remains, at line 254), so this judges the cases as they stand. DoD (1)-(5) are each expressed. Gaps:
   - (1) The 15 px title / 13 px rest is not asserted.
   - (4) The command palette has no case although the plan's T4 step 7 lists it, and "every menu uses one row height and one left inset" checks only the New project menu's inset = 12, so it is close to vacuous as "every menu".
   - (5) Only Prose check / Line spacing / Page setup are covered (the plan's own list); zoom, font, paragraph style and table controls are not.
   - (6) Header naming/colour has no invariant (T9's `hs9` spec covers it).
   - `settled()` waits on `document.getAnimations()`. No infinite CSS animation exists today; any future one would hang every helper.

10. **ok: tokens.** Present once in the first `:root` (`styles.css:52-65`). They are not redefined in the dark or Color blocks: they are not colours, so they are inherited unchanged. The `designTokens.test.ts:228` parity regex addition only exempts these new names from the light/dark colour-name parity. Sound, and that test passes.

11. **ok: docs/AGENTS.** The design-system table matches layout.css class for class, apart from the load-order sentence (finding 1). The toolbar sentence correctly says T3 has not landed yet. The AGENTS.md line matches the plan's wording. Interpreting (c) as "0px and 1px anywhere" is needed (`.gap-0`, `.panel --edge`, `.menu-rule`) and acceptable.

12a. **ok: other primitives.**
   - `.stack > *` / `.panel > *` (0,1,0, and late-loading) clear UA margins, element margins and single-class block margins. They do not clear two-class rules or rules in the four late files. It resets block margins only, not inline ones.
   - `.row-trail` sets `margin-inline-start: auto` and repeats the cluster declarations, so it works with or without `.cluster`. `.flush-end` sets the other side and does not conflict with it.
   - `ink()` measures the `<svg>` box, not the drawn path. That is consistent with how the slot maths is done.
   - The budget parser would drop declarations that come before a natively nested `{` block. No CSS file uses nesting today (no `&` in src CSS).

12. **ok: nothing visual changed at T0.** I checked at `1361f1e` that no TSX `className` and no CSS selector used `bar`, `row`, `panel`, `menu`, `stack`, `slot`, `cluster`, `bar-divider` or `flush-*`. The only near misses are `panel-heading`, `panel-help` and `prose-check-panel`, which are different classes. None of the new token names, nor `--gap` or `--value-width`, existed before. No element carried any primitive class before, so the only visible effects are the z-index changes in finding 8. Gallery: 50 PNGs present; not compared to the app.

## Not verified
- No Playwright run: helpers, invariants and stacking are judged from code. The worker's locked run (hs1/popover-bounds/floating) is a claim I did not repeat.
- The CSS order in finding 1 was checked in a pre-T0 build bundle, not in a build that contains layout.css. The import graph is unchanged apart from layout.css sitting next to styles.css.
- WebKit rendering (`@property`, `:has`, 1 px rounding) is not run; the owner's hand test is the proof.
