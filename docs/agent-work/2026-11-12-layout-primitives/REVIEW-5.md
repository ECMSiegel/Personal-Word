# REVIEW-5: T312 (plan T8 rework: comments, fragments, revisions) and T313 (plan T9: headers and per-header colour)

Reviewer: Opus "reviewer LP-D" (agent-bf08), 2026-11-12/13. This was a read-only review: I edited no source files. T306 (sidebar) was still live and another reviewer had T305/T307/T310, so I judged only these two tasks.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T312 (plan T8 rework) | **APPROVE**, with low notes | Now a real migration: fragments.css 13 -> 4, organization.css 26 -> 14. Every REVIEW-2 point is fixed. Dividers measure 24/24, and nothing looks wrong in either theme. |
| T313 (plan T9) | **REJECT** (one should-fix, a one-line markup change) | The strings, data, tint, keyboard path and snapshot round-trip all work, and the swatch colours are correct in light and dark. But the new Colour dialog wraps its Dropdown in a `<label>`, so choosing a swatch reopens the list over the dialog. cargo was not run. |

## What I ran
- `npx vitest run src/layoutPrimitives.test.ts src/designTokens.test.ts src/organization/groups.test.ts src/model.test.ts src/palette.test.ts`: 102 passed, 1 failed. The one failure is the expected "lower the budget" message for shared files. For organization.css it reads "14 spacing declarations, budget 26 -- lower the budget to 14", which is the coordinator's line. fragments.css matches its budget of 4.
- `npx tsc -b`: clean.
- Locked run 1 (port 1468): `layout-invariants` (T8 plus whatever else matched my `-g`), comments, of1-text-notes, of2-fragment-title, assets, hs9-top-level-sections, appearance, fragments-panel, revisions, plus my throwaway `tests/reviewD-tmp.spec.ts`. Result: **51 passed, 6 skipped (the `T8_SHOTS` screenshots), 3 failed**. All 3 failures were in my own throwaway spec and were my scripting errors: I clicked "Expand" on a fragment that was already expanded, and I was one ArrowDown off so I opened Delete. No project spec failed. hs9 passed 6/6, including the new colour test.
- Locked run 2: the throwaway spec only, with those errors fixed. **3 passed.** The spec was deleted with `rm` after each run, and I released the lock both times.
- `tests/sidebar-context-menu.spec.ts` was not run, because T306 owns it while that task is live.
- My screenshots are in `notes/reviewD-*.png`.
  - **Worker's screenshots I opened:** T8-comments-light, T8-fragments-dark, T8-fragment-open-light, T8-revision-light/dark, T8-read-dark, T9-dialog-light and T9-sidebar-dark. The remaining T8 light/dark twins are the same scenes, and I did not open them.
  - **My own I opened:** comments-one-light, comments-detached-dark, fragments-empty-dark, fragments-long-narrow-light, fragments-long-open-dark, revision-passage-light, revision-oversized-dark, header-dialog-light/dark, header-dialog-plain-dark and header-cards-light.
  - **My own taken, with measurements logged but not opened:** the other theme of each. They cover: comments empty, comments with one comment and with a detached comment (light and dark), fragments empty, fragments with a long title, tags and narrow width, an open fragment, the oversized revision view and its selected-passage box (light and dark), the header dialog in Color (light and dark), the header dialog in Plain (light and dark), the sidebar in light and dark, and the cards view.

## T312 (plan T8 rework): APPROVE

REVIEW-2 points, each checked against the code and against measurements:
1. **It is a real migration now.** Primitives now live on the markup:
   - CommentsPanel: section `.stack.gap-5`, header `.cluster.gap-4`, item `.stack.gap-2`, buttons `.cluster.gap-3`.
   - FragmentLibrary: library `.stack.gap-3`, controls, across and tags as clusters, head `.row` with `h2.row-label`, chevron and trash as `.slot.row-trail`, actions `.row.gap-3`.
   - RevisionComparison: stacks, with the controls as `.cluster.gap-3`.

   The per-component display, gap and margin declarations are deleted. The counter confirms fragments.css 13 -> 4 and organization.css 26 -> 14.
2. **Dividers are equal.** Items pad only below their divider, and the parent stack's gap is the space above the next item.
   - Measured comments: 24 above, 24 below. The T8 invariant passes.
   - First item: the header-to-item gap is 24, with no divider above it.
   - Last item and single item: padding 24, then the divider, then the panel's padding. With one comment the item's children are 8 apart and the bottom padding is 24 (measured).
   - Empty panel: the `<p>` sits 24 below "Show resolved", with no stray margins.

   The technique is sound in every case I tried.
3. **The fragment-actions gap is deliberate.** `row gap-3` gives 12. Measured: Insert to dropdown 12, dropdown to Append 12. The old declaration is deleted.
4. **The fragment head is a `.row`**: `h2.row-label`, with the chevron `.slot` in `.row-trail`. of2-fragment-title passes, and the title band is unchanged (titleX 0, titleY 128 in the worker's log).
5. **The selector map was followed**, with defensible deviations:
   - No `gap-0` wrapper: padding below the divider plus the gap does the same job.
   - **`.reader-options` keeps `margin-bottom` 24.** Accepted: the parent `.manuscript-read` (styles.css:1284) is a block element and belongs to Read-mode geometry, which T8 does not own.
   - **`.revision-comparison { padding-bottom: --space-5 }` is new.** Accepted: the stack zeroes the help text's own bottom margin, and the next sibling ("Opening") is outside the stack. It is counted in the budget.
   - **`align-self: flex-start` on buttons that are stack children.** Accepted: a column flex parent stretches its children, and this keeps the buttons at text width on the shared left edge. It sets no spacing.
- **The fragment text typography is untouched.** `.fragment-text` (14 px), `.fragment-text p` and the clamp fade are unchanged in the diff.
- **No other consumers.** No TSX outside the three organization files uses the deleted classes. `reader-options` is the one App.tsx use, and it was migrated. FragmentEditor.tsx does not use them.

Findings (all low):
1. low. `notes/T8.md` says "my selectors 24 -> 13". Both `.project-settings` rules have gone from organization.css (T310's change), so all 14 remaining declarations are T8's: own 24 -> 14. The coordinator should set the organization.css budget to **14**.
2. low. **The fragment head lost `align-items: flex-start`** (`fragments.css`, `.fragment-head` now takes `.row`'s centre alignment). With a 5-line title, the chevron sits at the vertical middle of the title (measured: h2 at 156-247, chevron at 189-213; screenshot `reviewD-fragments-long-narrow-light.png`), where it used to sit at the top. Single-line titles look right. If the owner wants it at the top: `.fragment-head { align-items: flex-start }`, though that moves single-line titles to the top of their 32 px row. Owner's call, not a reject.
3. low. **Wrapped comment text.** The comment checkbox is centred against wrapped comment text instead of the first line (`CommentsPanel.tsx`, `label.cluster`). Measured: label 202-236, checkbox 212-226. It shows only for comments longer than one line.
4. low. **The comment link buttons lost their padding.** `.feature-item button` padding went from 6/10 to 0 (organization.css:30). This is intentional (the links now sit on the text edge, 12 apart) and is in the notes, but the click target is now the text box (17 px tall). Mention it to the owner.
5. low. **Oversized view: two buttons sit off the text edge.** "Compare selected passage" (a direct child of `.revision-oversized`) and "Use these passages" (a direct child of `.revision-selected-passage`) keep the default button padding. Their text starts about 6 px right of the text edge above and below them (`reviewD-revision-oversized-dark.png`, `reviewD-revision-passage-light.png`). The "Restore this section" rule (`.revision-comparison > button { padding: 0 }`) shows the fix if wanted: `.revision-oversized > button, .revision-selected-passage > button { padding: 0 }`. I believe this indent predates T8.
6. **Plan step 3: the designTokens SWEPT question.**
   - **Spacing sweep:** both files would pass now. No 4-32 px literal is left; the only px spacing is `margin: -1px` in `.revision-comparison .sr-only`, which falls outside 4-32.
   - **Font-size sweep:** both files would fail on 13 declarations:
     - organization.css: `.feature-panel h1` 24px, `.feature-item h2` 16px, `.revision-structure` 12px, `.revision-change-controls span` 12px, `.revision-selected-passage label` 12px, `.reader-options label` 12px.
     - fragments.css: `.fragment-library` 13px, the `.fragment-library input…/.fragment-tags input` selector 13px, `.fragment-across` 12px, `.fragment-head h2` 13px, `.fragment-text` 14px, `.fragment-link` 12px, `.fragment-tags` 12px.

     12 px maps to `--type-small` and 13 px to `--type-body`. 24, 16 and 14 have no token. `.fragment-text` is document typography: add it to `DOCUMENT_SELECTORS` rather than tokenising it.

   Two ways forward:
   - Add both files to SWEPT for the spacing test only.
   - Or tokenise the 12/13 sizes and exempt `.fragment-text`, deciding what to do with 24 and 16 (a type-scale question, outside T8's "spacing only" scope).

## T313 (plan T9): REJECT

**Fix this one thing; everything else below is approved.**

**should-fix (visible in the owner's hand test). `src/App.tsx:3217`: the Colour dialog's Dropdown sits inside `<label className="stack gap-2">`.**
- **Why the list reopens:** `Dropdown` renders its list through `Popover` inline, not in a portal (`src/components/Dropdown.tsx:175-235`). So the option `div`s are inside that `<label>`. A click on non-interactive content inside a label is forwarded to the label's first labelable descendant, which is the `.dropdown-button` trigger. The trigger then reopens the list.
- **Evidence:**
  - My `reviewD-header-dialog-light.png` and `-dark.png`, and the worker's `T9-dialog-light.png`, all show the list open again 400 ms after clicking "Purple" with reduced motion on. "Purple" is already ticked, so the list closed and then reopened.
  - The Settings swatch pickers use a `<span>` label and do not do this.

  This is inferred from code and screenshots; I did not trace the event.
- **Impact:** after every choice the list covers the dialog's title and label. The value is applied and Done still works, which is why the hs9 test passes.
- **Fix:** change `<label className="stack gap-2">` to `<div className="stack gap-2">` and put `{groupTitle(project, colourGroup)}` in a `<span>`. The Dropdown already has `label="Colour"` as its accessible name. In the hs9 colour test, add `await expect(page.getByRole("option")).toHaveCount(0)` after picking Purple, so the bug cannot come back.
- **Not T313's:** the same label-wrapped pattern already exists at `src/organization/RevisionComparison.tsx:55` ("Compare section"). It is pre-existing; it is noted here for the coordinator.

**(1) Strings.**
- **Headers:** "Add header" appears on the add row, the heading menus, the empty-space menu and the palette. Dialogs: "New header", "Rename header", "Delete header “x”?" / "Delete header". Safety snapshot: "Before deleting header “x”". Errors: "Invalid headers." / "Invalid header names.". Settings: "Header colours". The colour dialog is titled "Header colour".
- **Entry level, untouched:** "New section", "New section below", "New section in <header>" (aria), "Delete " + kind, and the housekeeping/split-view "Delete section" dialogs, which are entry-level and correct.
- **No stale wording:** `src/` and `docs/user-guide.md` contain no user-visible "top-level section", "section heading" or "Section colours". The ones left are code comments, test titles and a `layout-gallery.spec.ts` comment.
- **Live regions:** move announcements use the title ("Moved Part two to position …").

**(2) Data.**
- **Validation:** `validateProject` (model.ts:266-270) deletes an unknown colour and does not throw, as the groups test asserts.
- **Archive and save queue:** the colour round-trips through the archive and the save-queue header (`model.test.ts:331`; `toEqual` includes `colour: "purple"`).
- **`setGroupColour` (groups.ts:93):**
  - It is immutable.
  - It returns `p` unchanged for a built-in or unknown id.
  - `undefined` removes the key.
  - Through `mutate` in App.tsx: yes (the dialog's `onChange`).
- **Rename and delete:** rename spreads `{...g, title}`, so the colour is kept (tested). Delete filters the group out, so its colour goes with it.
- **Snapshots:** checked in the browser. I set Purple, took a snapshot, set Default, restored the snapshot, and `data-tint` came back as purple.
- **Rust:** `groups` lives in `Project.extra`, which is `#[serde(flatten)] serde_json::Map<String, Value>` (store.rs:54-55, Header :68). No Rust code reads `groups`, so an extra key inside a group entry is opaque JSON and round-trips. The fixture line now carries `"colour":"purple"` and is checked by the existing `assert_eq!(store.read(..), p)`. **cargo was not run by the worker or by me: inferred, not verified.**

**(3) Applying the colour.**
- **Markup:** a custom header gets `data-tint` (ProjectSidebar.tsx:847).
- **CSS:** styles.css:2155-2162 maps it to `--tint` under `:root[data-palette="color"]`. The specificity equals the Manuscript `:is()` rule, and it comes later, so it wins. Built-ins never get `data-tint`.
- **Measured in Color:**
  - Light: heading icon and entry-row icon both `rgb(154, 40, 212)` (`--swatch-purple`).
  - Dark: both `rgb(202, 117, 244)`.
  - Cards view: the card icon is purple too.
  - Default: back to Manuscript's `rgb(0, 98, 205)`.
- **Plain:** icons, Manuscript and text are all `rgb(36, 36, 40)`, so nothing is tinted.
- **Dark contrast:** the dark swatch is the existing contrast-safe value.
- **Scroll-spy rail:** not measured (my selector matched nothing). By code, only `styles.css:2165` and `:2168` consume `--tint`, both in the sidebar, so the rail is untinted, the same as the built-ins.
- **Settings wording:** the Palette row is literally "Plain" / "Color" (label "Palette"). The worker's sentence, "Colours show when Palette is set to Color in Settings.", matches it. The plan's wording ("Appearance is set to Colour") would have named the wrong row.

**(4) Dialog.**
- **Built from primitives:** `ModalFrame` (`.dialog.stack.gap-5`), an inner `.stack.gap-5`, the label as `.stack.gap-2`, and `.dialog-actions.cluster.gap-4`. No hand-written spacing.
- **Keyboard:** I focused the heading, pressed Shift+F10, used ArrowDown to reach "Colour…" and pressed Enter. Focus landed in the dialog, on the Colour dropdown.
- **Escape with the dropdown open** closes only the dropdown (dialog still open, focus on the trigger). A second Escape closes the dialog, and focus returns to the "Part two" heading. After Done, focus also returns to the heading.
- **Default** clears the colour.
- **Menu order:**
  - Custom header: Collapse, Move up, Move down, New section, Add header, Rename, Colour…, Delete.
  - Manuscript: no Colour… (Rename, plus Reset name when renamed).
  - Fragments and Research: no Colour… either.

**(5) Edits to App.tsx and GeneralSettings.tsx.**
- **App.tsx:** T313's lines are the groups import, the swatch import, the `colourGroup` state, the group handler strings plus `colourTopSection`, `modalOpen` (adds `colourGroup`), the palette label, `onColourGroup` and the dialog JSX.
- **GeneralSettings.tsx:** T313's change is the one label. The `stack`/`row` classes in that diff are T310's.
- Nothing strays outside those regions.

**(6) Tests.**
- **hs9 colour test:** it asserts `data-tint` and the computed icon colour against a probe of `var(--swatch-purple)` before and after `page.reload()`, then Default equals Manuscript's colour. It passed in my run.
- **appearance.spec:** only the "Section colours" -> "Header colours" text changed. Legitimate.
- **Fail-first:** the log shows 4 failed before, on "Add header" not found and the menu text.

Findings (all low):
1. low. **"Sections actions" aria-label.** `src/components/ProjectSidebar.tsx:1217` gives the empty-space context menu the accessible name "Sections actions", and its only item is "Add header". Suggest "Sidebar actions" or "Header actions". It is a screen-reader name only.
2. low. **"Header" means a table header row elsewhere.** `src/editor/tables.ts:268` "Toggle header row" (table menu, pre-existing) and `docs/user-guide.md:20` "line their pages up under matching headers" (split panes, pre-existing) use "header" for other things. The design-system note also reserves "Page header" for a future feature. These are standard terms; the owner should decide whether they conflict with the brief's "header only means a sidebar header".
3. (Moved up: the reopening dropdown is the should-fix at the top of this section.)
4. low (test gap). **Untested paths.** The hs9 test does not cover the entry-row icon colour, the Plain-palette line, the keyboard path or focus return. I verified all four by hand-scripted checks. A three-line addition to the hs9 test would lock in the row icon colour and the Plain sentence.
5. Not verified: `cargo test` (store.rs fixture) and the native WebKit look. The validation list at the end of the plan runs cargo.

## Stays unverified
- `cargo test` for the `"colour"` key in `store.rs`. The reasoning above says it round-trips, but nothing has run it.
- WebKit/native rendering: everything here is Chromium.
- `tests/sidebar-context-menu.spec.ts`: T306 is live on it.
- The exact event path of the Dropdown reopening (T313 should-fix). It is inferred from code and screenshots.
