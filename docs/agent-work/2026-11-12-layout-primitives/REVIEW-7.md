# REVIEW-7: T307 (plan T3) rework after REVIEW-4

Reviewer: Opus "re-reviewer LP-F" (agent-abe7), 2026-11-12. Read-only: no source edited. T306 (sidebar) and the
popover-bounds "cards-view status dropdown" timeout belong to the other reviewer and are not judged here.

## Verdict: REJECT (1 blocker; everything else fixed)

REVIEW-4 findings 2, 3 and 4 are fixed and measured. Finding 1 (issue rows spilling) is fixed for short and
wrapped messages, but **not for a "Long sentence" issue** (a regression from the rework's own `min-width: 0`). That rule's excerpt is the whole sentence, so whenever the
rule fires, the message is crushed to a 9 px column and its words spill sideways out of the bordered button.
The worker's own invariant seeds exactly this sentence and still passes, because it checks only vertical overflow.

## Findings

1. **blocker, introduced by this rework. A long-sentence issue's message spills horizontally out of its button**
   (`src/editor/editor.css:61-65`, `.prose-issue-select span:last-child { flex: 1 1 auto; min-width: 0; ... }`).
   - **Measured (1600x900, light and dark, identical):**
     - The row for the 45-word sentence has an excerpt 136.1 px wide and a message 9.3 px wide.
     - "Long / sentence: / 45 / words" sit on 4 lines, and the button has `scrollWidth - clientWidth = 34`.
     - The message's Range rects fall outside the button's inner box: its widest word runs up to 34 px past the button's right border, into the 4 px gap toward "Dismiss once". Whether that ink actually lands on "Dismiss once" is inferred, not measured.
     - The row is 238 px tall.
   - **Cause:** the rework added `flex: 1 1 auto; min-width: 0` to the message span. At HEAD that rule had only `color`, so the message could not shrink below its longest word. The excerpt (the whole sentence, `flex: 0 1 auto`, max-content basis) now takes nearly all the width, and the message is crushed.
   - **When it happens:** every Long sentence issue, because that rule's excerpt is always the whole sentence.
   - **Why the worker's test misses it:** its invariant seeds this very sentence, but it checks only vertical overflow.
   - **Fix (not tried by me):**
     - Delete `min-width: 0` (and the `flex` line) from `.prose-issue-select span:last-child`, or cap the excerpt instead with `.prose-issue-select span:first-child { max-width: 50%; overflow-wrap: anywhere; }`.
     - Prefer one of those over equal columns, which would change every short row.
   - **Acceptance:**
     - Extend "T3: prose issue rows contain their text" (`tests/layout-invariants.spec.ts`) so that every span's Range rects lie inside the button's padding box on all four sides, and `scrollWidth <= clientWidth` holds on the button and the row.
     - Show the extended test failing on the current tree first (the 45-word sentence is already seeded), then passing.
     - Take light and dark shots of the long-sentence row.

2. low. **Focus rings in the issue list are clipped by the list's scroller.**
   - `.prose-issues` is `overflow: auto`, and both buttons sit flush with its edges.
   - The first issue button's ring loses its top and left (`notes/reviewF-issue-focus-light.png`), and "Dismiss once" loses its top and right (`notes/reviewF-issue-dismiss-focus-light.png`).
   - This is the same scroller and flush layout as at HEAD, so it is not a regression.
   - Optional fix: `padding: 3px` on `.prose-issues` (it is counted in the budget), or `outline-offset: -3px` on the two buttons.

3. low. **The checkbox focus ring nearly touches the count.**
   - The count sits 4 px from the box (`gap-1`), and the ring reaches 3 px out (2 px ring plus 1 px offset), which leaves 1 px.
   - "6" and the ring visibly abut in `notes/T3-rework-focus-*.png`.
   - HEAD had 12 px here. `gap-2` (8 px) would clear it; the columns stay aligned either way.

4. low. **The issue button differs slightly from `.toolbar-text-button` on focus.**
   - Everything else matches, measured against "Insert page break": the 2 px accent ring with 1 px offset, the 0.3 px faux bold, the 1 px `--line` border, the 12 px UI font, the transparent background and the 0.99 press scale.
   - The only difference is that it lacks `z-index: 1` on focus (`editor.css:140` lists `.toolbar-text-button` only). With 4 px row gaps nothing covers the ring, so it is cosmetic only.

5. accepted deviation. **"Dismiss once" stays text, not a `.slot`.**
   - A 24 px slot cannot hold the words, and the brief freezes wording.
   - It sits after the button (never overlaps it, apart from finding 1), on the first line's baseline (baseline delta 0 in every row), in Tab order, and it gets the shared emphasis.

6. note. The task said ten `T3-rework-*.png`; only **eight** exist (prose-issues, more-line, more-page and focus, each light and dark). I opened all eight.

## REVIEW-4 findings, re-checked

- **F1, issue rows:**
  - **Seeding:** a repeated word, three passives, eight filler words and a 45-word sentence give 13 issues. The list is capped at 260 px and scrolls to 820.
  - **Rows:** one-line rows are 31 tall, two-line 43, three-line 58. Every gap is exactly 4, both at the top and after scrolling to the end. No row overlaps, every button sits inside its row, and `btnScroll` and `rowScroll` are 0.
  - **Exception:** finding 1 above.
  - **Behaviour:**
    - Clicking the "was written" issue selects "was written" in the document.
    - Tab order is issue, Dismiss, issue, Dismiss, issue.
    - The shared rule fires on the issue button: focus-visible gives the 0.3 px text-shadow and press gives the 0.99 scale (both measured).
    - Hover was not measured separately, because my rest reading still had focus. It rests on the same shared selector (the button is a plain `button`, not excluded), on `src/hoverEmphasis.test.ts` being unchanged (no diff) and passing, and on hover-emphasis.spec passing.
    - "Dismiss once" still works: `tests/writing-aids.spec.ts:117` clicks it and expects the issue gone, and it passed in my run. My own Dismiss click failed only because my throwaway test toggled the popover shut before clicking.
- **F2, More panels: fixed.**
  - **Line spacing, measured:** at 1000 px, opened from More, its rows are 28/28/28 with gaps 8/8, each box ends exactly on the panel's content edge (end gap 0), and the boxes are 64 px wide. That is identical to the bar at 1600, except the panel is 211.9 wide against 230 there (the More list's own width).
  - **Page setup:** covered by the passing invariant "Page setup panel opened from More …". My own pass reported Page setup "absent", which was my test reopening More, not a product fault.
  - **The selector `:is(.dropdown, .toolbar-number):not(.panel *)` is sound:**
    - At 700 px, More's own font dropdown and number box keep `margin: 4px 8px`.
    - Inside panels the margin is 0, and Table controls opened from More have 26 px buttons with margin 0.
    - Zoom, font and paragraph style are still on the bar at 1000, so they are unaffected. WebKit supports a complex `:not()`.
- **F3, checkbox rows: fixed.**
  - The checkbox is again a direct child of `label.row` in all six rows (measured `parentElement === label`).
  - "On" and the four rules: every row is 28 tall with gaps of 8. Every checkbox's right edge is 1547, the panel's content edge, and every label's left edge is 1287.
  - The counts form one right-aligned column: box and ink both end at 1529, in light and in dark.
  - Page numbers' checkbox ends at 1326, the same as the Paper, Margins and Position dropdowns.
  - Keyboard focus emphasises the label and nothing moves (invariant passed).
- **F4, Writer.tsx: untouched logic.**
  - There are still 10 `e.detail > 0` calls and 14 `editor.view.focus()` calls, the same as HEAD.
  - The changed lines (sorted and counted) are only classNames, the `ic` helper, `row`/`row-label`/`row-trail` wrappers and the removed inline-style div.
- **Tests:**
  - **The new "rows contain their buttons" check can fail.** I injected `.prose-issue-row { flex: 0 1 auto !important }`: all 13 rows shrank to 28, `scrollHeight` beat `clientHeight` (31..238 against 28) and 11 buttons overlapped the next row. So the spill check catches that case. It does not catch horizontal spill (finding 1).
  - **The trailing-edge change is legitimate, not a weakening.**
    - Before the rework the case compared `.row-trail` boxes, which now hold only the count. It now compares each row's last child (the checkbox or control).
    - Only rows with no element child are skipped (Prose check's "N issues" summary line).
    - `rights.length > 1` keeps the case from passing on nothing. A row that lost its control entirely would be skipped silently, which is acceptable.
  - The acceptance specs the worker owns (w9-prose-menu, hs2, editor-toolbar, hs3) are unchanged against HEAD, so nothing was loosened.

## What I ran
- `npx vitest run src/hoverEmphasis.test.ts src/designTokens.test.ts`: 19/19 passed. `npx tsc -b`: clean.
- One serial-lock hold on port 1472 (21:09-21:18):
  - `tests/layout-invariants.spec.ts -g "T3"`: **11 passed, 1 skipped** (the shared T2/T3 slots fixme).
  - editor-toolbar, w9-prose-menu, writing-aids, hs2-spacing, hs8-page-numbers, hs11-font-focus, hs3-checkbox, tables-context and hover-emphasis, plus my throwaway `tests/reviewF-tmp.spec.ts`: **70 passed, 1 failed**. The single failure is my own throwaway case (a popover-toggle bug before the Dismiss click); every acceptance spec passed.
  - The throwaway spec was created only while holding the lock and is deleted.
- Shots in `notes/reviewF-*.png`:
  - `prose-issues-{light,dark}` and `prose-issues-scrolled-{light,dark}`
  - `issue-focus-light`, `issue-dismiss-focus-light` and `doctored-shrink-light`
  - `more-list-{light,dark}`, `more-line-{light,dark}`, `more700-{light,dark}` and `more-table-{light,dark}`
- I opened and inspected: prose issues (light, dark), scrolled (light), issue focus, dismiss focus, and the 8 worker shots.

## Unverified
- WebKit/native rendering: all of this is Chromium.
- I did not see the long-sentence row itself in a shot (my scrolled shot starts mid-row). Finding 1 rests on the measured rects: message 9.3 px wide, button `scrollWidth` 34 over, span rects outside the button.
- **Prose check opened from More (1000 px) was not checked.** My pass skipped it, and neither the worker's invariants nor the shots cover it. `notes/T3.md` (Resumed section) recorded a rule checkbox moving 12 px on hover when the panel was nested in More; it went away only because the bar fits again at 1440. The rework should show that at 1000 px, hovering or focusing a rule row inside More does not move its checkbox.
- The table right-click menu over the format bar (REVIEW-4 note 6) was not rechecked.
