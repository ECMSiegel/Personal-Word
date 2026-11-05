# REVIEW -- T237 ruler and continuous-view top gap

Reviewer: agent-b422 (Claude Opus). Date: 2026-11-04. Verdict: **REJECT**.

The data side is sound: the top gap stays out of exports, margins reach them, and old projects load unchanged. The ruler itself does not work as a ruler. In a normal window it does not line up with the page, so its numbers and markers point at the wrong place.

Evidence is Chromium only, from a private build of the tree as it stood at 2026-11-04 (scratch `node_modules/.cache/personal-word-beta/ui7-rv-e`, port 1942). Measurements are in `art/audit.log`, screenshots and exports in `art/`. The audit spec is `audit/audit.spec.mjs`. No source or test was edited.

## Defects (must fix)

**D1. The ruler does not line up with the page (blocker).** `--page-width` is set only in `pageStyle`, on `.editor-paper` (`Writer.tsx:1073`). `.document-ruler` is a sibling of the paper, so `max-width: var(--page-width)` (`editor.css:419`) and `.is-paged .document-ruler { width: var(--page-width) }` have nothing to resolve. The computed `max-width` is `none` and the variable reads empty, so the ruler fills the pane and measures from the pane's edge.

Measured at a 1440 window:

| View, zoom | Left marker minus text edge | Ruler 0 minus paper edge |
|---|---|---|
| Continuous 75% | -272.5 px | -277 px |
| Continuous 100% | -169 px | -175 px |
| Page 75% | -258.5 px | -263 px |
| Page 100% | -155 px | -161 px |

The right marker is off by the same amount the other way, and sits outside the paper. It looks right only once the pane is at or below the page width (zoom 150%, narrow windows, split view). See `art/geo-continuous-100.png` and `art/page-2in.png`: the "2 inch" marker is at x 484 while the text starts at x 639.

Fix: put the page variables on a common ancestor or on the ruler, so that the ruler's box equals the paper's box in both views, and clip ticks to it.

**D2. The ruler's ticks add a horizontal scrollbar.** The ticks always run the full page width, and `.document-ruler` does not clip them. `.writer-scroll` scrollWidth versus clientWidth with the ruler on:

| Case | scrollWidth | clientWidth |
|---|---|---|
| Split view, each pane | 819 | 585 |
| Continuous, 900 window | 819 | 630 |
| Continuous, 700 window | 819 | 430 |
| Continuous 150%, 1440 window | 1227 | 1170 |

A baseline with the ruler off was not measured; the 819 matches the tick run (816 plus padding), so the attribution is inferred. Page view hides it with `overflow-x: hidden`, which clips the ruler instead.

**D3. Text runs through the ruler.** The ruler is sticky with no background (`rulerBg` is transparent) and a -24 px bottom margin.
- Continuous view, scrolled: lines of text draw through the ticks and numbers, light and dark (`art/scroll-continuous.png`, `art/scroll-continuous-dark.png`).
- Top gap below 24 px: the first line sits under the ticks at rest, and the handle (`top: max(26px, ...)`) sits on the first and second lines (`art/gap-zero.png`). The allowed range includes 0, so this is reachable with one Home key.

The fix needs a solid paper-colour band, or a ruler that is not over the text. "No fills" in the design rules is about selection, and this is the page's own colour. If a band is not acceptable, the ruler should take layout space.

**D4. In page view the ruler scrolls away.** `.is-paged` has `overflow-y: auto` but grows to its content, so sticky has no scroller to stick to. After a 500 px scroll the ruler is at y -370 in page view (`art/scroll-pages.png`), and pinned at the scroller's top in continuous view. RESEARCH section 1 specified "stuck to the top", inside `.writer-scroll`.

**D5. A right-button drag changes the document margin.** `startRulerDrag` has no `event.button === 0` check. A right-button drag at 150% moved the margin from 116 to 156 px, and the export margin follows. That is a stray write to an export setting, and it cannot be undone with Cmd-Z.

**D6. Markers are off by half their width even when the ruler lines up.** The marker's edge, not its point, is placed at the margin. The point is 6 px inside the text edge, scaled by zoom: 9 px at 150%, 6 px in split view. It needs a half-width offset.

**D7. The Ruler button changes the toolbar at the owner's window size, and one test now fails because of it.**
- At 1440, the extra button sends Focus mode and Prose check into a new More menu. A build with only the button removed (`mut-nobutton`) has no More menu at 1440. `docs/design-system.md` says that at 1440 "the whole toolbar fits, so there is no More button".
- `popover-bounds.spec.ts:166` fails with "Page setup x moved" by 37 px. It passes on the button-removed build, so **this failure is T237's**. The notes call it "outside T237's registered paths".

Fix: make room on the bar, or get the owner's choice of what moves into More, then re-record `tests/fixtures/popover-baseline-rects.json` (with the owner's say-so) and update the design-system width table.

**D8. The new tests do not catch these.**
- `ruler.spec.ts` split test compares ruler centre to paper centre. Two centred boxes always match, so it passes with D1 present. It must compare marker position to the text edge, and ruler 0 to the paper edge, in a 1440 window. The ruler test also asserts no alignment.
- Q026 required a test that a top-gap-only change never writes `marginInches`. With the `App.tsx` guard removed (`mut-guard`), all 3 ruler tests still pass, because margin and `marginInches` are already equal in that test. It needs a project where they differ. My audit seeded one (see below) and the guard does hold, but no committed test proves it.
- `document.test.ts` `not.toContain("128")` cannot fail: exporters never read the gap. The `w:pgMar` assertions in the same test are real. There is no PDF assertion.
- `ruler.spec.ts` writes screenshots into another worker's folder (`ui7-e/ruler-light.png`, `ruler-dark.png`). Remove this from a test that will be committed.

## Minor (fix while there; would not block alone)
- `formatting.ts` comment says "Space above each page in page view", which is wrong: it is continuous view, top of document only. `DEFAULT_PAGE_GAP` and `MAX_PAGE_GAP` are misleading names beside the real `gap`.
- A click with no movement on a non-whole-pixel margin commits a change (`finishRulerDrag` compares the rounded value to the unrounded start). For example 1.33 in typed in the export panel. By reading, not run.
- Margin drag moves only the marker, with no guide line or value shown; RESEARCH recommended showing the value because a stray drag changes exports. Only screen readers get it.
- `.sr-only` is a new global in `editor.css`, though `.visually-hidden` already exists in `styles.css`. Limits 24, 192, 200 are repeated as literals in `Writer.tsx`. Sizes 36, 26 and 12 px are not tokens.
- No command palette entry. RESEARCH suggested one; the worker explained why not, and the owner did not ask.

## What held up (CLAIMED, Chromium)

**Top gap and exports.** Real downloads through the app's Export buttons:

| Export | DOCX `w:pgMar` | PDF first word xMin | PDF pages |
|---|---|---|---|
| a: base, gap 32 | 1440 all sides | 72 | 2 |
| b: gap 200 only | 1440 (document.xml identical to a) | 72 (text and page 1 render identical to a) | 2 |
| c: ruler drag to 2 in | 2880 all sides | 144 | 4 |

- `topGap` appears only in `Writer.tsx`, `model.ts`, `formatting.ts` and `editor.css` (plus tests), so no exporter or native print code can read it. Print CSS resets the padding to 32 px and hides the ruler (measured under print media).
- PDF a and b files differ in bytes at one point. Text and render are identical; I assume a timestamp, not checked.

**Margin sync.**
- Seeded project with `marginInches` 2 and layout margin 96: a gap change and a zoom change both leave 2.
- No `pageLayout` and 1.5 in: gap change leaves 1.5, screen shows 144 px.
- Behaviour change to record, not a defect: zoom, mode and paper changes no longer rewrite `marginInches`. The old code did, which was the riskier behaviour.

**Serialization.**
- No `topGap`: loads at 32 px, field not added until changed.
- Browser preview: `topGap` and the toggle survive reload.
- Rust has no `pageLayout` type. It lives in the flattened `extra` map, so no Rust validation is needed or possible there. `validateProject` checks 0 to 200. A hand-edited value out of range rejects the whole project, the same as other page settings.
- `cargo test`: 63 passed, 1 ignored. No test sets `topGap` natively, so this shows the map path only; native save and reload is T240's.

**The 2 inch cap.** Exports are unchanged because they read `marginInches`, not the clamped value. A project with a stored margin of 144 to 192 px now draws wider on screen and repaginates in page view, which is what Q026 approved. Margin 500 clamps to 192. `pages`, `page-break`, `pages-gap`, `features` specs pass. A footnote at a 2 inch margin in page view was not specifically tested.

**Presets.** The 1¼ to 2 inch dropdown entries were not requested but change nothing silently: existing values still show through `withCurrent`. Owner's call to keep; not a defect.

**Ruler input.** Drag scale is exact at 150% (+30 screen px gives +20). Arrow, Shift+Arrow, Home and End work on all sliders and link both sides; both split panes follow one drag. Toggle works by keyboard and persists in `folio.workspace.ruler`, off by default. Ruler is in More at narrow widths. Cmd-Z does not undo a gap change, as the notes say. No transitions or animations. Square corners, no second hover rule.

## The 11 reported full-suite failures

| Failure | Result on fresh build | Whose |
|---|---|---|
| `popover-bounds:166` | still fails; passes with Ruler button removed | **T237** (D7) |
| `appearance:263, 353, 392`, `layout:27`, `split-view:866` | still fail: sidebar weight and colour assertions | Not T237: sidebar hierarchy (T236 or lane A), inferred from what they assert, not traced to a commit |
| `import-cancel:75`, `markdown-roundtrip:177, 190, 316, 355` | **pass** | Not code. The worker ran `npm run test:e2e` without the private config, and the failure output shows dev-server HTML (`/@vite/client`) |

`ResearchPanel.tsx`: `insertTextOnly` is declared once now. That file is T238's, so the parse error was another worker's edit in progress, seen through the dev server. Not T237's.

## Fail-first
- Unit: reported 3 failures before the fix. Plausible and consistent with the diff; not reproduced.
- `ruler.spec.ts`: the log shows 2 tests failing because the elements did not exist, which is real but shows little. The third test was not in that run and passes with D1 present.
- No test was weakened. 144 to 192 in `formatting.test.ts` is the approved cap.

## Commands and results
- `npx tsc --noEmit -p .`: pass. `vitest` formatting and document tests: pass. `vite build`: pass.
- `ruler.spec.ts`: 3 of 3 pass (with the defects above present).
- Audit spec: 8 of 8 ran (a measuring script, not assertions on correctness).
- Spec rerun (popover-bounds, pages, page-break, features, floating, appearance, layout, import-cancel, markdown-roundtrip, editor-toolbar, motion, pages-gap): 132 passed, 5 failed.
- `split-view -g B1`: 1 failed. The full suite was not rerun.
- Mutants: `mut-guard` ruler.spec passes (test is blind); `mut-nobutton` popover-bounds passes (failure is T237's).
- `cargo test`: pass.

## Not verified
Native WebKit and SQLite. Focus mode hiding the ruler (code read only; my probe could not reach the button, which was in More). Footnotes at a 2 inch margin. Reduce Motion beyond computed styles. Whether top-gap changes survive snapshot, restore and import in practice (read as generic spreads, not run). The real full suite after a fix.

## For T240 (native WebKit), after the fixes
1. Ruler 0 and both markers line up with the paper and text edges at 75, 100, 150%, in page and continuous view, A4 and Letter, and in both split panes, with a visible scrollbar.
2. Sticky plus CSS `zoom` on the ruler stays pinned and correctly sized while scrolling in both views.
3. Tick spacing and labels scale with zoom; a real inch on the ruler matches `--page-margin`.
4. Trackpad and mouse drags with pointer capture: drag scale correct at each zoom, release outside the window, right-click does nothing.
5. `top: max()` handle position and keyboard focus ring on sliders; Tab order through the toolbar toggle and sliders; More menu at narrow widths.
6. SQLite: set margin and top gap, save, quit, relaunch; snapshot and restore; recovery journal after a forced quit; project export and import; `topGap` and `marginInches` intact, and `topGap` absent from a project that never set it.
7. A top-gap-only change leaves `documentSettings.marginInches` unchanged on a real project.
8. A 2 inch margin on screen, in page view, with a footnote, through native DOCX and PDF export and `printing.rs` (0.25 to 2 bound). A 0.25 inch margin the same way, since the ruler allows it while the export panel's minimum is 0.5.
9. Light, dark, and Reduce Motion in the real app. Page/Word pagination parity is not promised.
