# REVIEW-3: T306 (plan T2, sidebar) and T311 (plan T7, research panel, citation card, bibliography)

Reviewer: Opus "reviewer LP-B" (agent-5a3e), 2026-11-12. This was a read-only review: I edited no source files. Other workers (T305, T307, T310, T312 and T313) were live at the same time, so I judged only these two tasks' surfaces.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T306 (plan T2) | **REJECT** (one blocker, one should-fix) | The left edge, slots, columns and rail line up as the worker reported, in every mode. But at the 190 px minimum, the heading labels "Manuscript", "Fragments" and "Part two" are now cut off. That trips the plan's stop rule, and the worker did not raise it. A keyboard focus ring also now cuts through heading text. |
| T311 (plan T7) | APPROVE, with low notes | It is a real migration with even spacing and nothing cramped or clipped, in light and dark: research tabs, the source form, the Notes tab, the bibliography page and the citation card's form stage. |

## What I ran
- `npx vitest run src/layoutPrimitives.test.ts src/hoverEmphasis.test.ts`: 9 passed, 1 failed. The failure is only the expected "lower the budget" lines for the shared files (styles.css 118/189, research.css 61/81 and others). None of T306's or T311's solely-owned files is over its budget. `npx tsc -b`: clean.
- One locked run (port 1465, 19:12-19:29):
  - `layout-invariants.spec.ts -g "T2|T7"`: 4 passed, 1 skipped (the shared `T2/T3` slot case is still `fixme`).
  - Then alignment, hs4, sidebar-*, drag-reorder, scrollspy, floating, w9-cards, hs9 and my throwaway `tests/reviewB-tmp.spec.ts` (deleted afterwards): **166 passed, 2 failed, 12 skipped**.
  - Failure 1, `alignment.spec.ts:254`: the Projects card trash (point 6 below).
  - Failure 2, `sidebar-context-menu.spec.ts:225`: it expects "Add header" while the menu still says "New top-level section". That is T313's rename in flight, not T306.
  - `-g` filters the whole command, which is why I ran two invocations.
- New screenshots `notes/reviewB-*.png` (31 files). I opened every one:
  - Docked light and dark, plus the hover, heading and focus zooms.
  - 190 px at rest and on hover; floating light and dark; overlay.
  - Cards light and dark; heading menu, Shift+F10 row menu and More menu; Read light and dark.
  - T7: source, source-bottom, notes, bibliography and card-form, each in light and dark.
  - The Projects card.
- Probe measurements (x is measured from the sidebar's left):
  - **270 px (light, dark, floating and overlay alike):** the title text, search icon, all 7 heading icons, every row icon, the add row and the bottom-row icons are all at x=16. Settings is at 16.
  - **Heading trail:** the slot boxes run 185 / 209 / 233-257, with ink at 189-205, 213-229 and 238-252. The ink gaps are 8 and 9, and the zoom shots read as evenly spaced.
  - **Row trail:** the slots are at 185 and 209, exactly under [view][+].
  - **Rail:** the lines run 247-253 at rest and 237-253 when magnified, under the chevron ink at 238-252.
  - **Rows and title:** rows are 32 tall. The title is 15px/600, with 10 px above and 10 px below it in its 40 px bar.
  - **Floating:** the tabs are 32 tall, the format bar ends at 112, the title top is at 128 (112+16) and the search centre is at 188. The sidebar's right edge is at 270 and the paper starts at 392, so it never overlaps the text.
  - **Cards:** heading icons are at 16, card icons at 29 (16 + 1 border + 12 padding).
  - **Row hover reserve (190 px):** the label's left stays at 40, and only its right end moves from 149 to 101, so the label never shifts.
  - **Keyboard menu:** it opens at x=8, with the row icon at 16.

## T306 (plan T2): REJECT

1. **blocker. At the 190 px minimum, the heading labels are cut off at rest.**
   - Measured `.group-label` scrollWidth/clientWidth: Manuscript 66/57, Fragments 60/57, and the custom header "Part two" 60/57. They show as "Manus...", "Fragme..." and "Part t..." in `reviewB-190-rest.png`.
   - Where the room goes: the label starts at 40. The `.row` gap (8) and three always-reserved 24 px slots end at 177.
   - Hidden view and + slots (opacity 0) still take width. So Fragments and Research lose room to buttons that are not even shown.
   - Before this batch: the room was about 64 px, inferred from `HEAD:src/styles.css` (12 px sidebar inset, `.group-title` padding 8, 20 px buttons, 3 px gap). Then Fragments and "Part two" (60) fit, and Manuscript (66, bold) was about 2 px short.
   - Plan T2 says "Stop and ask if: a row no longer fits one line at 190px", and T2.md's hand check claims "every label still fits".
   - **Fix (must-ask per plan; my recommendation is first):**
     - (a) Minimal fix, which restores at least the old room: in `src/styles.css`, add `.sidebar-groups .group-heading.row { gap: 0 }` (`.group-title` already has no inline-end padding). The room becomes 65, so Fragments and "Part two" fit and Manuscript stays as borderline as before.
     - (b) More room: put the heading `.row-trail` absolute at the row end (as `.entry-trail` already is). Reserve label room with `padding-inline-end` on `.group-title`:
       - `var(--slot)` at rest for Fragments and Research.
       - `calc(2*var(--slot))` for `[data-group-kind="manuscript"]` headings (their + always shows).
       - `calc(3*var(--slot))` on `:hover`/`:focus-within`.

       At 190 this gives about 113 / 89 / 61 px. Manuscript then truncates only while hovered, and the heading gives up the "boxes always reserved" rule from wave 6 T6. That trade-off is the owner's call.
     - Either way, add a T2 invariant: at width 190, every at-rest `.sidebar-groups .group-label` has `scrollWidth <= clientWidth` (bold labels included).
2. **should-fix. The heading's keyboard focus ring now cuts through the icon and the last letter.**
   - `.group-title` lost its 8 px inline padding (`styles.css:1536`, now `padding: var(--space-1) 0`). The sidebar's inset ring (`styles.css:1990-1992`, offset -2x) therefore sits on the glyphs: see `reviewB-focus-heading-zoom.png`, where the "t" of Manuscript is cut.
   - **Fix:** `.sidebar-groups .group-title:focus-visible { outline-offset: var(--space-1); }`. The row's 16 px inset leaves room, so nothing is clipped. This is a focus rule, not a hover rule.
   - The row focus ring (`reviewB-focus-row-zoom.png`) is fine.
3. should-fix (owner-facing, not T306's fault). "Title a bit bigger than the rest" did not change anything: the title was already 15px/600 before the batch (`.project-switch`, `--type-large`). Next to a selected 13px/700 heading it reads only slightly bigger. The plan pinned 15, so the worker was right. The coordinator should ask the owner whether to use `--type-title` (19).
4. ok, Q031. [More][Open beside] under [view][+], with the rail under the chevron, reads well in the zoom shots (light and dark): three clean columns. I accept it.
5. ok, menus.
   - The keyboard-opened row menu opens at x=8, the `MARGIN` clamp at `src/components/ContextMenu.tsx:15,67`, with the row icon at 16.
   - Before, it opened at 12 with the icon at 20. The menu still sits 8 px left of the row ink, so this is not a regression. The new expectation `max(rowBox.x, 8)` (`tests/sidebar-context-menu.spec.ts:146-147`) is legitimate.
   - The heading right-click and More menus look right.
6. Test expectations the worker changed (tests/alignment.spec.ts is registered to T306, so the T309 trash fix belongs here too):
   - Legitimate:
     - scrollspy gutter 24 to 40 and cards 0 to 16 (`scrollspy.spec.ts:248,251,356,585`).
     - The sidebar-selection `lastChild` lookup (`sidebar-selection.spec.ts:929-930`).
     - hs4 130/190 to 128/188 (verified: tabs 32 + top bar 40 + format bar 40 + 16 = 128, and the search centre is 60 lower).
   - **should-fix:** `alignment.spec.ts:254` trash.
     - Now: T309's rule (`styles.css:1814-1817`) places a 24 px slot at 8/8, so the box is 9 from the card edge (1 px border). The icon ink is 13 from the top and right (`reviewB-projects-card.png`).
     - Before: a 32 px box at 4/3 with 8 px padding put the ink at about 12-13.
     - The icon did not move; the `<= 6` box limit is stale.
     - **Fix in `tests/alignment.spec.ts:258-273`:** measure the `svg` and assert `inkTop <= 14` and `inkRight <= 14`. Do not move the rule to `--space-1` (that would push the icon into the corner).
   - low: `alignment.spec.ts:281-290` now asserts that a `div.entry-trail` is absolute, which the hit-area rule (buttons only) can never break. **Fix:** also assert that the inner `.collection-open-beside` box ends within 4 px of the row's right edge.
7. low. The invariants pin less than they could. The T2 cases run docked, at 1440, in light only. The 190 check from point 1 would have caught the blocker. The `T2/T3` slot case (`tests/layout-invariants.spec.ts:249`) is still `fixme`; un-fixme it for the sidebar part.
8. low.
   - `.entry-row { margin: 1px 0 }` (`styles.css:1604-1606`, an owned selector, pre-existing) makes the row pitch 34 against 32 px headings.
   - `.entry-list .entry-row.has-beside .entry-main` (`styles.css:701-704`) reserves two slots on research rows that have one button.
   - Floating title text now sits 4 px lower in its band (reported).
9. ok, everything else:
   - The `ProjectSidebar.tsx` diff is classes and wrappers only. The drag guards (`.reorder`, `.collection-open-beside`, `.group-actions`) still match.
   - The drag-reorder, scrollspy, floating, selection and w9-cards specs pass.
   - Selection is not a fill. Bottom dividers are inset to 16 and Settings runs edge to edge.
   - The old copies are deleted (my rough count agrees with net -31), and there are no specificity fights with layout.css. The overrides that are left (`.cards-view .entry-main` padding, bottom-row `padding-inline: 0`) are intentional.

## T311 (plan T7): APPROVE
- What I checked:
  - Tabs: a 40 px bar with the underline on the bar's bottom rule.
  - Source form (light and dark): label, field and divider spacing match `gallery/before/research-source-light.png`, the only before shot of these surfaces. Citation previews, Cite here / Add quote / Delete source, More details, Used in and Citation rules are evenly spaced.
  - Notes tab: even. Bibliography controls: a 16-gap cluster.
  - Citation card: the form stage is even, and the close icon inset matches the title inset (invariant passes). The card stays 360 wide, `zIndex: "var(--layer-card)"` is set, and the width/position code is untouched.
- Low notes:
  1. low. `.citation-rules { margin-top: var(--space-2) }` (`src/research/research.css:581-583`) is now dead: `.stack > *` in layout.css, which loads later, zeroes it, giving 8 px less above "Citation rules". **Fix:** delete it (budget -1).
  2. low. Plan T7 step 1's "panel header" (Research + close) lives in `App.tsx`/`styles.css` (`.research-aside > header`), outside T7's files, and was not migrated. Note it for the coordinator.
  3. low. `.citation-card-head` (`citation-card.css:35`) lost its gap. That is harmless with today's two short headings. **Fix:** add `className="citation-card-head cluster gap-3"` or a `gap`.
  4. ok. The source-toggle chevron gap going from 12 to 8 (reported) is fine.

## Unverified
- Native WebKit and the owner's hand test. Chromium only.
- Whether the pre-batch 190 px headings fit: inferred from the old CSS, not measured.
- The citation card's "cited" stage, and cards view for Fragments and Research. w9-cards passes for those.
