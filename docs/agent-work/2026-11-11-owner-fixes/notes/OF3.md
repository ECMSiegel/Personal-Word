# OF3 -- Rulers (T286)

Agent agent-6794, 2026-11-11. Nothing committed. Status: CLAIMED (Chromium only).

## What changed
- Two switches in Page setup: "Ruler" (top) and "Side ruler". Storage: `folio.workspace.ruler` (top, unchanged) and new `folio.workspace.side-ruler`.
  If the side key is absent, the side ruler follows the top key, so an old "true" turns both on. Every toggle writes both keys, so a later "top off" does not drag the side ruler off.
- Top ruler (`src/editor/editor.css`, `Writer.tsx`): two `.ruler-band` strips (width = the shown margin, `--line` at 0.5 opacity, same as the side ruler's bands) grey the stretch outside the left and right margins.
- Page view: the top ruler is `position: relative` (not sticky) with a 1 px outer `box-shadow` outline in `--line`. It sits in the grey directly above the first sheet and scrolls away with it,
  so it never covers a sheet or text. Continuous view is unchanged (sticky, opaque, pinned).
- Caret inset (`Writer.tsx`, effect near the "sticky ruler" comment): now applies only in continuous view. In page view the ruler is not pinned, so no dead band; defaults (5 / 0) apply.
- Side ruler: already drawn left of the sheet (`left: -16px`); now gated by its own switch (`sideRulerShown`), not the top one.
- Tests: new `tests/of3-rulers.spec.ts` (9 tests). `tests/w9-side-ruler.spec.ts` `setRuler` turns both switches. `tests/ruler.spec.ts`: the "pinned" test now covers continuous only; a new page-view test asserts the ruler scrolls off above the sheet.

## Zoom
Unchanged structure. Zoomed: `.editor-paper` (so the side ruler and sheets scale with it) and `.document-ruler` (it has its own `style={{zoom}}`; its bands, ticks and markers are in that zoomed space). Not zoomed: `.editor-viewport` and the scroller.
The ruler stays a sibling above the paper, so alignment at 75/100/125/150 and fit scale is the same mechanism as before (ruler.spec alignment tests).

## What a user sees
Page view: the top ruler is a bordered strip over the grey above page 1 (not white on the sheet), shaded outside the margins; scrolling moves it away. Side ruler per page as before. Two separate buttons.

## Limits / not checked
- Native WebKit and the built app. The top ruler no longer follows you down the pages in page view (the side ruler does); that is a deliberate trade for "covers no text" -- say so if the owner wants it pinned again.
- Page setup panel got a third button on its row: width in the real app not checked (popover-bounds result in the acceptance log).

## Hand check
Built app, page view, Page setup: switch Ruler and Side ruler on separately and reload; zoom 75-150; drag a marker on each; scroll down (top ruler leaves, text never covered); continuous view still pins the ruler.

## Verification
- Fail-first: `notes/OF3-fail-first.txt` -> 9 of 9 failed before the code.
- `npx tsc -b` clean; `npx vitest run src/caretScroll.test.ts src/editor/blankClick.test.ts` 43 passed.
- Acceptance 1 (`notes/OF3-acceptance.txt`, 68 tests: of3, ruler, w9-side-ruler, pages-gap, w9-blank-click, popover-bounds): 65 passed, 3 failed, all three fixed or explained:
  1) my continuous-150 band test used the paper width for scale (test bug) -> now the ruler's zoom; 2) w9-side-ruler: the test project was titled "Side ruler", colliding with the new button name -> retitled "Margin strips";
  3) popover-bounds recorded placement, see below.
- Acceptance 2 (`notes/OF3-acceptance-2.txt`): of3-rulers + w9-side-ruler = 13 passed (plus a probe) after those fixes.

## For the coordinator: popover-bounds baseline (fixture NOT touched)
Page setup popover, recorded `{x 1113, y 115.5, width 232, height 136}`; now `{x 1079.5625, y 115.5, width 265.4375, height 136}`. The Side ruler button widens the Page setup row by 33.4375 px; the panel stays right-aligned to its anchor so x moves left by the same amount. Height unchanged.
The `Page setup` entry in `tests/fixtures/popover-baseline-rects.json` needs the new x and width; that test is the only failing one.

## Rework (agent-bc0b, owner ruling: pin the top ruler in page view)
- Page view: `.document-ruler` is wrapped in `.ruler-strip` (Writer.tsx). In page view the strip is a sticky, full-width (extends over the 16 px gutters), opaque `--surface` (desk grey) band at the top of the scroller (z-index 5); pages scroll beneath it. The ruler is centred in it at page width with its grey margin bands, so at rest it is directly above the first sheet, never on it. Continuous view: the strip is `display: contents`, so the sticky ruler behaves as before.
- Caret inset is back for page view (effect no longer limited to continuous), so the caret and a page's first line are scrolled clear of the strip. Zoom/alignment unchanged: the ruler keeps its own zoom and sits in the same centred column as the paper.
- Tests changed first and shown failing (`notes/OF3-rework-fail-first.txt`: 2 failed, "ruler pinned"): of3-rulers test 1 (pinned at scrollTop 1500, caret stepped up under the ruler stays below it) and ruler.spec page-view test (pinned, opaque strip, full width, ruler not on sheet at rest).
- `tests/fixtures/popover-baseline-rects.json`: only the "Page setup" entry re-recorded, old {x 1113, w 232} -> {x 1079.5625, w 265.4375} (y 115.5, height 136 unchanged). The pin did not move the popover again.
- Run (`notes/OF3-rework-acceptance.txt`): of3-rulers, ruler, w9-side-ruler, popover-bounds, pages-gap, w9-blank-click -> 68 passed, 0 failed. tsc clean.
- Not checked: native WebKit under CSS zoom (caret inset uses the measured ruler height with totalZoom as before), real horizontal scroll in the app.

## Rework 2 (agent-8da1, reviewer REVIEW-r2 fixes)
- Floating sidebar vs strip: `.app:has(.sidebar-shell.is-floating) .is-paged .ruler-strip { z-index: 3 }` (editor.css). Checked against the stacking order: the shell is z 4 (floating.css, untouched), the side ruler (z 3) is hidden while floating so nothing ties, other paper items are <= 1, the citation card is inline z 39 and already above the strip. New test asserts `.project-switch`, `.sidebar-pin` and `.citation-card` are topmost at their own centres and at the centre of the part inside the strip band, at rest and scrolled (it failed first: project-switch and sidebar-pin covered by `ruler-strip`; `notes/OF3-rework2-fail-first.txt`).
- Strip clicks: Writer.tsx onMouseDown returns before `blankPageClick` when the target is in `.ruler-strip`, and calls preventDefault unless the target is a `[role=slider]` (otherwise the browser selected the tick number and the caret left the editor; found in the first acceptance run). Test: click the strip's grey end while scrolled -> selection and scrollTop unchanged; the margin marker still works by keyboard.
- Run (`notes/OF3-rework2-acceptance-b.txt`): of3-rulers, ruler, w9-side-ruler, floating, of2-fragment-title, w9-blank-click -> 95 passed, 0 failed. tsc clean. Still unchecked: native WebKit.
