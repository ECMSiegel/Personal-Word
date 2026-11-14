# REVIEW-6: T306 rework (plan T2, sidebar) and T313 rework (plan T9, header colour)

Reviewer: Opus "re-reviewer LP-E" (agent-eb72), 2026-11-12/13. Read-only: I edited no source or project test files. T307 (toolbar popovers) was live; I judged only these two tasks.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T306 (plan T2 rework) | **REJECT** (2 should-fix, 1 must-do test repair) | The width-0 mechanism itself is sound: labels fit at rest after a blur, nothing moves on hover, there is no flicker, and Tab reaches the toggle. But (1) the reveal is keyed on `:focus-within`, so after an ordinary mouse click on a row or heading, bold "Manuscript" sits truncated at 190 with the pointer far away. (2) The new focus ring loses its top edge on the first heading. (3) Four specs click the now-unclickable toggle without hovering, and two of them time out. |
| T313 (plan T9 rework) | **APPROVE** | After a choice, by mouse or keyboard, the list is closed and the button shows the colour. The name is "Colour". Escape closes the list, then the dialog, and focus returns to the heading. The menu reads "Sidebar actions". Built-ins have no "Colour…". |

## What I ran
- `npx vitest run src/hoverEmphasis.test.ts src/motion.test.ts`: 24 passed. `npx tsc -b`: clean.
- Lock hold 1 (port 1471, 20:51-21:09):
  - A: `layout-invariants.spec.ts -g "T2"`: 4 passed, 1 skipped (the `T2/T3` slot fixme).
  - B: alignment, sidebar-selection, sidebar-context-menu, hs4, floating, hover-emphasis, accessibility, hs9, appearance and revisions, plus my throwaway `tests/reviewE-tmp.spec.ts`: **146 passed, 1 failed, 4 skipped**. The failure is `hs9-top-level-sections.spec.ts:231`, which timed out at `:241`, the `Show Manuscript cards` click. See T306 finding 3.
- Lock hold 2 (21:18-21:23, at the coordinator's request): popover-bounds, w9-cards, features and w9-icon-magnify, plus a throwaway rerun of the revisions probe: **17 passed, 2 failed**. Both failures time out on the view-toggle click: `features.spec.ts:58` and `popover-bounds.spec.ts:169`. w9-cards and w9-icon-magnify pass.
- The throwaway spec was copied in only while I held the lock and removed with `rm` by an EXIT trap. Both holds were released.
- Probe data: `notes/reviewE-probe-*.json`. Screenshots: `notes/reviewE-*.png`. I opened rest/hover at 190 and 270 in light and dark, cards, after-click-row, the focus shots of the toggle and the rings (Manuscript, Fragments, light/dark, 190/270), and the export, read and projects dropdown shots. I also opened all eight `T2-rework2-*`, both `T2-rework-focus-*`, `T2-rework-190-rest-light` and both `T9-dialog-*`.

## T306 (plan T2 rework): REJECT

### What holds (verified)
- **At rest after a blur (190 px, light and dark), no label is cut.**
  - Manuscript (bold 700) measures 77/77, Fragments 60/60, Research 53/53, "Part two" 49/49.
  - A long custom header ("A much longer header title that cannot fit") ellipsizes: 242/89, heading 32 px tall, no wrap. Its label ends exactly at the [+] (129).
  - In cards view the rest numbers are the same.
  - Manuscript has **0 px of slack** at 190 (box 76.6, need 77). WebKit's text metrics could tip it into "Manuscrip…": unverified.
- **On hover, nothing moves.** For all five headings at 190 and 270, the label start, [+] and chevron each move by 0. The toggle goes from 0 to 24 with `transition: all 0s`. Only the label's end shortens (Manuscript 77/65 at 190, as designed).
- **No flicker.** I sampled with rAF on Fragments and Manuscript:
  - pointer arriving on the spot where the toggle appears;
  - pointer resting on the label's rest end;
  - pointer leaving sideways over the sidebar edge, 2 px steps;
  - pointer leaving downward over the group edge, 1 px steps.

  Each produced exactly one change (0 to 24, or 24 to 0). Hover is on `.sidebar-group`, so no hit-test loop is possible.
- **Keyboard.**
  - Tab order: title, then toggle, then [+], then chevron. The toggle is already 24 when it is reached.
  - `focus()` followed by a synchronous measure gives width 0 then 24, so the first painted frame already has the slot.
  - Shift+Tab from [+] lands on the toggle.
  - The ring is visible on the toggle (`reviewE-focus-toggle-190-light.png`).
  - At rest, `getByRole("button", {name: "Show Fragments cards"})` still finds it (count 1), so assistive technology sees it.
- **No sliver at rest.**
  - Border, padding and width are all 0, with `overflow: hidden`.
  - The toggle (or its `.group-actions`) is also at opacity 0 at rest.
- **One chevron column.** Every chevron box spans 153-177 at 190 and 233-257 at 270. That includes Research, which has its own toggle and [+], hover-revealed.
- **The column invariant holds while hovered.** With a Manuscript row hovered, the row slots sit at 105/129 under the toggle and [+] at 105/129 (190 px); at 270 they are 185/209 under 185/209.
- **Floating and overlay behave the same.**
  - Both: rest toggle 0, labels fit.
  - Floating hover: toggle 24 at 186, [+] 210, chevron 234.
  - Overlay hover: toggle 185, [+] 209, chevron 233.
- **Rules.** hover-emphasis and motion pass. The change is a width toggle with no transition, not a hover weight or scale rule.
- **(4) Trash assertion (`tests/alignment.spec.ts:263-274`).** Measuring the svg with a limit of 14 is legitimate: it matches the measured 13 and the pre-batch ~12-13. The suggested low item (assert the inner `.collection-open-beside` right edge in the probe at `:280-290`) was not done; it stays low.
- **(5) `tests/sidebar-context-menu.spec.ts:228`.** "Add header" is correct. The exact `toEqual` also proves Manuscript has no "Colour…". My probe confirms the same for Fragments and Research.

### Findings
1. **should-fix: after a mouse click, the toggle stays revealed and Manuscript truncates "at rest".** The cause is `src/styles.css:1607`: `.sidebar-groups .sidebar-group:is(:hover, :focus-within) > .group-heading .group-view-toggle`.
   - Clicking a section row (the normal way to open one) leaves focus on `.entry-main`. Clicking the heading title leaves focus on `.group-title`. Either way, with the pointer parked away, the toggle stays 24 wide.
   - Measured at 190 px:
     - Manuscript (bold) 77/65 after a row click and after a title click;
     - Fragments 73/65 after clicking its title (bold once open).
   - Screenshot: `reviewE-190-after-click-row.png` shows "Manus…" with the layers icon visible.
   - The worker's invariant blurs before measuring, so it misses this. The rework exists to stop truncation at rest, and this is the state the owner will see most.
   - **Fix:** reveal on keyboard focus only. Change `:is(:hover, :focus-within)` to `:is(:hover, :has(:focus-visible))` in that one rule; the repo already uses `:has(:focus-visible)` for rows at `styles.css:1581`.
     - Tab from the title still reaches the toggle: the title is `:focus-visible`, so the group reveals before Tab moves on.
   - **Then:** extend `tests/layout-invariants.spec.ts` "no heading label is truncated at 190px". Mouse-click the first Manuscript row and park the pointer, and do NOT blur, before measuring. Keep the existing hover/Tab test passing.
   - If the hover/Tab test or `drag-reorder.spec.ts:258` used programmatic `.focus()` and stops matching `:focus-visible`, give them a real keyboard step: focus the search field, then Tab.
2. **should-fix: the top edge of the Manuscript heading's focus ring is clipped.**
   - The rule is `.sidebar-groups .group-title:focus-visible { outline-offset: var(--space-1) }` at `styles.css:2006-2008`. The first heading sits at the top of `.sidebar-groups`, which is `overflow-x: hidden; overflow-y: auto` (`styles.css:1518-1525`). The ring (offset 4 + 2 px) starts about 2 px above that box.
   - Evidence: `reviewE-ring-manuscript-190-light.png` and `-270-dark.png` show three sides only. The probe reports `clipT: true` for Manuscript only; the other headings are fine.
   - Left and right are clear (4 px from the icon and from the last glyph) at 190 and 270, light and dark.
   - At 190 the Manuscript ring's outer right edge (111) runs 2 px into the revealed layers icon's svg box (109). The ink only just touches it: low.
   - **Fix:** make the ring fit inside the scroller at the top. Either use `outline-offset: calc(var(--focus-offset) * 2)`, which gives about 2 px of clearance and still sits outside the glyphs, or add `padding-block-start: var(--space-1)` on `.sidebar-groups` and take the 4 px back from the search bar's bottom margin.
   - Add an assertion: the first heading title's ring rect lies inside `.sidebar-groups`' rect.
3. **must-do (test repair; the behaviour is acceptable).** At rest, the toggle can no longer be clicked by a script that has not hovered or focused the heading. Playwright's `click()` waits for a visible (non-zero width) target and times out.
   - **Ruling for the coordinator:** the behaviour is acceptable for the owner, so the specs must change, not the CSS.
     - A pointer user can only aim at the toggle while over the group, which reveals it and gives it `pointer-events: auto`. Before the rework it was an invisible but clickable spot; a click there was never an intended affordance.
     - Keyboard users reach it by Tab.
     - VoiceOver's press is a synthetic `click()` on the element, which `pointer-events` does not block (inferred, not tested natively).
   - Specs to update (each needs a hover or focus of the group heading before the click):
     - `tests/features.spec.ts:58`: times out (hold 2).
     - `tests/popover-bounds.spec.ts:169`: times out (hold 2; the coordinator's report).
     - `tests/hs9-top-level-sections.spec.ts:241`: times out (hold 1).
     - `tests/hs9-top-level-sections.spec.ts:171`: passed only because the pointer happened to rest inside the group. Fragile: hover first.
     - `tests/layout-gallery.spec.ts:76`: `click({force: true})` on a 0-wide, `pointer-events: none` box. Inferred, not run (GALLERY only): the press lands at x=129, the [+]'s left edge, so it may add a section instead of switching to cards. Hover first and drop `force`.

     Every other toggle click already hovers or focuses first: `sidebar-selection:146`, `scrollspy:246,249,583`, `w9-cards:72`, `w9-icon-magnify:75` (row hover) and `drag-reorder:258-259` (focus).
   - These files are registered to other tasks or to none. The coordinator assigns them; T306 owns only `alignment`, `hs4`, `scrollspy`, `sidebar-selection` and `sidebar-context-menu`.
4. low. Manuscript fits at 190 with 0 px to spare (finding above). Check it in native WebKit at the owner's hand test.

## T313 (plan T9 rework): APPROVE
- **Mouse:** Colour, then Purple. After 600 ms, 0 options; the button reads "Purple". Clicking the visible "Part two" text does nothing (it is a `<span>` now, `src/App.tsx:3218`).
- **Keyboard:**
  - Shift+F10 on the custom heading opens the menu; End, ArrowUp highlights "Colour…"; Enter opens the dialog with focus on the trigger.
  - In the dialog, Enter, ArrowDown ×2, Enter gives 0 options, value "Orange", focus on the trigger.
  - Screenshots `reviewE-colour-kbd-light/dark.png`.
- **Name:** `dialog.getByRole("button", {name: "Colour", exact: true})` count 1, from `aria-label` (`src/components/Dropdown.tsx`, the trigger).
- **Escape:** the first press closes the list (dialog stays, focus on the trigger); the second closes the dialog, with focus back on the "Part two" `.group-title`.
- **Empty-space menu:** accessible name "Sidebar actions", item "Add header".
- **Built-ins:** Manuscript, Fragments and Research menus have no "Colour…".
- hs9 colour test (`:260`) and appearance: pass.
- **Unrun:** `cargo test` for the `colour` key in `store.rs` (validation step 3).

## The same bug elsewhere: Dropdowns inside a `<label>` (for the coordinator, pre-existing, one pass)
A mouse click on an option is forwarded by the `<label>` to the Dropdown trigger, which reopens the list. Keyboard choice (Enter) never misbehaves. I measured each in the browser (option count 700 ms after a mouse choice), and the chosen value is applied in every case:

| file:line (label / Dropdown) | Control | Reopens after a mouse choice? |
|---|---|---|
| `src/organization/RevisionComparison.tsx:55` / `:57` | Compare section (snapshot preview) | **yes** (1 option back) |
| `src/export/ExportPanel.tsx:74` / `:76` | Export typeface (Settings, Export document) | **yes** (3) |
| `src/export/ExportPanel.tsx:105` / `:107` | Line spacing | **yes** (3) |
| `src/export/ExportPanel.tsx:162` / `:164` | Page number position | **yes** (6) |
| `src/App.tsx:2693` / `:2695` | Read-mode Font (`.reader-options`) | **yes** (4) |
| `src/components/ProjectLibrary.tsx:313` / `:315` | Projects screen Sort | **yes** (3) |

- **How I found them:** a source scan for `<Dropdown` with an unclosed `<label` before it in the same file, plus a DOM check `label .dropdown-button` on the editor, Settings, Read, Projects, the snapshot preview and the colour dialog. Nothing else turned up. ResearchPanel, SourceForm, CitationCard, CaptureQuote, CslImportPreview, FragmentLibrary, BibliographyPage and Writer were scanned only, not visited.
- **Fix pattern (as T313 did):** change the `<label>` to a `<div>` or `<span>` keeping its classes, and put the visible text in a `<span>`. Each Dropdown already has an `aria-label`.
- **Regression assertion:** `expect(page.getByRole("option")).toHaveCount(0)` after a mouse choice.

## Stays unverified
- Native WebKit: Manuscript's 0 px fit at 190, the ring, the toggle reveal, and Tab-to-button behaviour (macOS "Keyboard navigation" setting) in the real app.
- VoiceOver activation of the 0-width toggle at rest (inferred from `pointer-events` semantics).
- `layout-gallery.spec.ts:76` with `force` (not run).
- `cargo test` (T313's `store.rs` fixture).
- Chromium only throughout.
