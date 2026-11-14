# REVIEW-8: T306 rework 3 (plan T2 sidebar), T314 (LP T10 Dropdown in a label), T307 rework 2 (plan T3 toolbar popovers)

Reviewer: Opus "final reviewer LP-G" (agent-382a), 2026-11-12/13. Read-only: I edited no source or project test files.
T307 was added by the coordinator mid-review after its worker finished, so no source was being edited during my run.

## Verdicts

| Task | Verdict | In one line |
|---|---|---|
| T306 (plan T2, rework 3) | **APPROVE** | Mouse clicks no longer reveal the view toggle, so the labels fit at 190. Keyboard focus reveals the toggle and operates it. The focus ring is complete on all four sides. The five spec edits are legitimate. |
| T314 (LP T10) | **APPROVE** | The bug was already there before this batch. Fixed once in the Dropdown component. All nine Dropdowns close after a mouse pick and apply the value. I found no side effects. |
| T307 (plan T3, rework 2) | **APPROVE** | The long-sentence row is contained: the excerpt is capped at 50% and clamped to 3 lines, the message takes the rest, and nothing spills. Prose check opened from More no longer jumps. The count has an 8 px gap. Writer.tsx is untouched. |

## What I ran
- `npx vitest run src/hoverEmphasis.test.ts src/motion.test.ts`: 24/24 passed. `npx tsc -b`: clean.
- One serial-lock hold on port 1474 (21:54-22:03). Throwaway `tests/reviewG-tmp.spec.ts` was copied in inside the lock and removed by an EXIT trap (`rm -f`). Lock released.
  1. `tests/layout-invariants.spec.ts -g "T2"`: **4 passed, 1 skipped** (the shared T2/T3 slot fixme).
  2. `tests/layout-invariants.spec.ts -g "T3"`: **12 passed, 1 skipped** (same fixme).
  3. t10-dropdown-label, features, popover-bounds, hs9-top-level-sections, sidebar-selection, sidebar-context-menu, w9-font-menu, of5-settings, accessibility, w9-prose-menu, writing-aids, editor-toolbar and hover-emphasis, plus my throwaway: **126 passed, 2 failed, 4 skipped**.
     - Every project spec passed, popover-bounds included.
     - Both failures are wrong assertions in my throwaway, not product faults (see T314).
- Screenshots: `notes/reviewG-*.png`. I opened the following:
  - 190 after a title click;
  - 190 after a row click and then a key;
  - 190 with [+] keyboard focus;
  - the Manuscript ring at 190 dark and at 270 light;
  - count focus;
  - prose top dark and scrolled dark;
  - More prose light.
- Worker shots: I opened all of them.
  - T2: the four `T2-rework3-*-focus-*.png`. Only **four** exist, not eight.
  - T3: all six `T3-rework2-*.png`.

## T306 (plan T2, rework 3): APPROVE

### Verified
1. **Mouse never reveals the toggle (190 px, pointer parked away).** The rule is `src/styles.css:1607`, `.sidebar-group:is(:hover, :has(:focus-visible))`. I clicked, in turn:
   - the first row;
   - the Manuscript title;
   - the Fragments title;
   - Manuscript [+] (the New section dialog, then the Cancel button by mouse; focus returns to [+]);
   - Fragments [+] (the New fragment dialog, then Cancel).

   After each click, every toggle was 0 wide and nothing was truncated:
   - Manuscript bold 700: 77/77.
   - Fragments: 60/60, or 73/73 once it is bold.
   - Research 53/53; Part two 49/49.
   - The active element never matched `:focus-visible`.
2. **A mouse click, then a key.** After a row click I pressed Shift, then ArrowRight. The row becomes `:focus-visible`, so the Manuscript toggle appears (24 px) and the label truncates to 77/65; this is the allowed change.
   - Every heading's label left, [+] and chevron moved by 0.
   - Every entry row's left, top and width stayed identical.
   - The row's own ring and row actions also appear: that is the row's existing focus-visible reveal, which moves nothing (`reviewG-190-click-then-key-light.png`).
3. **Keyboard.**
   - I clicked the search field, then pressed Tab until the Manuscript title had focus. The toggle was 24.
   - Tab moved to the toggle. Enter switched the group to cards view, and Space switched it back; the toggle kept focus at 24.
   - Tab moved to **[+]**. The toggle stayed 24 with opacity 1 (`reviewG-190-plus-focus-light.png`).
   - Shift+Tab returned to the toggle, then to the title.
4. **Focus ring** (`styles.css:2006-2008`, offset 2 px, width 2 px).
   - It is inside `.sidebar-groups` on all four sides for Manuscript (the first heading), Fragments and Research, at 190 and 270, light and dark.
   - It is 2 px clear of the icon and 2 px clear of the last glyph's ink in every case.
5. **Spec edits** (features:58, popover-bounds:169, hs9:171 and :241, layout-gallery:76). Each one only adds `.group-heading.hover()` before the toggle click, and layout-gallery's `force: true` is gone. These are legitimate, not a weakening. The rest of the hs9 diff is earlier tasks' wording (T9).
6. **No flicker: not re-sampled this round.** This rests on REVIEW-6's rAF sampling and on the reveal mechanism being unchanged: an instant width change keyed on the group, with only the selector changed.
7. **What REVIEW-3 and REVIEW-6 accepted still holds.** The T2 invariants pass: one left ink edge at 16, 24x24 slot columns, row slots under [view][+], and one chevron column.

### Findings
1. **low (no rework).** At 190, with keyboard focus on the Manuscript title, the ring's outer right edge exactly meets the revealed layers icon's svg box (gap 0.0). The icon's ink sits about 2 px inside that box, and in the shot they do not touch. Fragments has 4.7 px and Research 11.5 px. This appears only while the title has keyboard focus at the minimum width.
2. **note.** The ring on the second and later headings is unchanged from REVIEW-6's accepted state.

## T314 (LP T10): APPROVE

### Verified
1. **PRE-EXISTING: confirmed.** All three parts of the bug were already present at 1361f1e:
   - `git show 1361f1e:src/components/Dropdown.tsx` has `onClick={() => choose(index)}` on a `div role="option"`, with no `preventDefault`. The batch diff otherwise changes classNames and the `row-label` wrapper only.
   - `git show 1361f1e:src/components/Popover.tsx` has no `createPortal`, so the list rendered inside the label.
   - The `<label>` wrappers already existed at all six sites: RevisionComparison:55, ExportPanel:74/105/162, ProjectLibrary:312 and App:2687.
2. **The fix** (`src/components/Dropdown.tsx:222-227`) adds `event.preventDefault()` before `choose(index)`.
   - **Which click it affects.** Only the click on an option `div`. A `div` has no default action of its own, so the only thing cancelled is the wrapping `<label>`'s activation of the trigger.
   - **Selection, focus and onChange.** `choose()` is unchanged: it closes the list, focuses the trigger and calls onChange once if the value changed.
   - **Text selection.** Already blocked before this change by the existing `onPointerDown` `preventDefault`.
   - **Option content.** The two `option.render` sites (App.tsx:3230, GeneralSettings.tsx:104) are plain spans: no link, input or button whose default action could be lost.
   - **Form submission.** A `div` click never submits a form.
   - **No handler depends on it.** No code in `src` checks `defaultPrevented` on clicks (the two hits are Escape keydown handlers).
   - **Context menu.** `ContextMenu.tsx:160-162` has its own handlers and is not touched.
   - **Keyboard, typeahead and Escape.** `handleMenuKey` is not in the diff.
   - **Trigger clicks.** A probe counting clicks on the Sort trigger saw exactly 1 (the opening click) after a mouse pick.
3. **Browser: all nine sites.** For each one I measured, 700 ms after a mouse pick, the open options (should be 0), the value, `aria-expanded` and focus.

   | Site | In a `<label>` | Options left | Value applied | Focus on trigger |
   |---|---|---|---|---|
   | Projects Sort | yes | 0 | Name | yes |
   | Read manuscript Font | yes | 0 | System sans | yes |
   | Export typeface | yes | 0 | Times New Roman | yes |
   | Line spacing | yes | 0 | Single | yes |
   | Page number position | yes | 0 | Top left | yes |
   | Compare section | yes | 0 | Opening | yes |
   | Header colour dialog | no | 0 | Purple | yes |
   | Page setup Paper size (`.panel`) | no | 0 | A4 | yes |
   | Page setup Margins (`.panel`) | no | 0 | ½ inch | yes |

   - Compare section had only one section, so the pick re-chose "Opening": the value could not change, but the list closed.
   - The font-family toolbar Dropdown is not in a label: 0 options left, Arial applied. Focus goes to the editor, by its own `onChange` (`src/Writer.tsx:1407-1414`). That is existing, intended behaviour; my throwaway wrongly expected trigger focus.
   - w9-font-menu (the font preview behaviour) and accessibility (keyboard: Escape and selection return focus) pass.
   - My second throwaway case expected `role=dialog` for Export settings, which it is not. Before that point it did confirm that Escape closes the list and focus stays on the trigger.
   - Typeahead rests on the unchanged code and the passing accessibility spec.
4. **`tests/t10-dropdown-label.spec.ts`** pins the bug with three label sites plus a keyboard case.
   - It has no `/src/` imports.
   - It waits 400 ms for the reveal and 700 ms after the pick for the close and any reopen.
   - Fail-first (`notes/T10-fail-first.txt`): 3 mouse cases failed (3, 4 and 3 options came back); the keyboard case passed.
   - It passed in my run.

### Findings
1. **low (by reading only, no rework).** A click on a heading, a separator or the list padding inside a label-wrapped list is not prevented, so it still reaches the label, which re-toggles the trigger and closes the list. None of the six label sites has `kind:` options, so today only a click on padding can do it, and the result is just a closed list.

## T307 (plan T3, rework 2): APPROVE

### Verified
1. **Issue list at 1600 px, light and dark (identical).**
   - **Seeding:** a repeated word, 3 passives, 10 filler words and two long sentences (52 and 54 words) give 16 issues. The list scrolls.
   - **Long-sentence rows:**
     - The excerpt takes at most 50% of the content box (every row 51% or less).
     - It is clamped to 3 lines with an ellipsis ("This sentence keeps going with many…").
     - The message ("Long sentence: 52 words") takes the remaining column.
   - **Containment:** every text line of every span lies inside its button's padding box on all four sides, at the top and after scrolling to the end. `scrollWidth - clientWidth` is 0 on every button and row, and no button overlaps "Dismiss once".
   - **Row gaps:** 4 px throughout, both at the top and scrolled.
   - **Dismiss once:** its baseline delta to the excerpt's first line is 0 in every row.
   - **Choosing the long-sentence issue** selects the whole sentence (275 characters, from "This sentence keeps going…" to "…at the very end").
   - **Dismiss once** removed one issue (16, then 15).
2. **Prose check opened from More at 1000 px, light and dark.**
   - The More list does not scroll sideways (0).
   - Each issue stacks its message under its excerpt (16 of 16).
   - No line is outside its button, no button scrolls sideways, and the gaps are 4.
   - The invariant "Prose check opened from More keeps 28 px rule rows that do not move on hover or focus" passes: 5 rows of 28, one checkbox column, no move on hover or Tab.
   - **Mid-word breaks:** with the seeded messages, no message word broke mid-word in the narrow list. If a long word ("Possible") does break there, it stays inside the box, which I judge **acceptable**: `overflow-wrap: anywhere` is the only way to contain an over-wide word.
3. **Count and checkboxes.** The count's ink ends 8 px from its checkbox in all four rule rows. All five checkboxes ("On" and the four rules) share the right edge 1547.
4. **Writer.tsx is untouched this round.** Its mtime is 01:29 UTC, before T307 rework 2 started at 02:23. It still has 10 `e.detail > 0` and 14 `editor.view.focus()` calls.
5. **The extended invariant** ("T3: prose issue rows contain their text", `tests/layout-invariants.spec.ts`) checks Range rects against the button's padding box:
   - on left, right, top and bottom, with ±1 tolerance;
   - excluding only lines that the clamp hides below the excerpt's own box;
   - plus `scrollWidth <= clientWidth + 1` on buttons and rows;
   - and it requires the long-sentence row to be listed.

   Fail-first (`notes/T3-rework2-fail-first.txt`) shows it catching the REVIEW-7 spill (lines at 1440..1491 in a 1288..1457 box).
6. Tests: all of editor-toolbar, w9-prose-menu, writing-aids, hover-emphasis and popover-bounds (prose and toolbar cases included) pass.

### Findings
1. **low (accepted earlier, not a regression).** Focus rings on the first and last issue buttons are still clipped by the `.prose-issues` scroller (REVIEW-7 finding 2). The worker left this deliberately, with a reason.
2. **note.** In a long-sentence row, the hidden lines beyond the 3-line clamp are not available as a tooltip: the button's `title` is the message. Clicking the row still selects the whole sentence, so nothing is lost.

## Stays unverified
- Everything here is Chromium. Not checked in native WebKit:
  - Manuscript's 0 px fit at 190;
  - `:has(:focus-visible)` after a mouse click and then a key;
  - `-webkit-line-clamp` inside a flex row;
  - the label-activation cancel.
- VoiceOver activation of the 0-wide toggle.
- T306:
  - [+], then typing a title, then Enter: I only cancelled by mouse. Whether focus returns to [+] as `:focus-visible` after a keyboard Save was not checked; if it does, the toggle appearing is allowed.
  - The focus ring on the custom "Part two" heading was not measured (only Manuscript, Fragments and Research).
- `layout-gallery.spec.ts` was not run (GALLERY only); its edit was read, not executed.
- With only one section, Compare section could not show a value change, only that the list closed.
- Typeahead in a label-wrapped Dropdown was not exercised in the browser (code unchanged).
