# REVIEW-native2 -- native run r2 of T242 (agent-b396, Claude Opus)

Read only: logs, reports, PNGs, code. Nothing run, no window opened, no source or test edits. All of this is CLAIMED, not owner-confirmed. T242 was not reviewed on the board. Evidence: `node_modules/.cache/personal-word-beta/ui7-v/`. Binary is 16:07; no file in `src/` is newer, and `tests/native-screens.js` is 14:39, so the run matches the tree.

## 1. The `cont-75` failure: the check's fixture, not the app. No text jump.

**Cause: the document is too short for the walk's starting position.** The walk wants paragraph 31 4 px under the ruler. In continuous view at 75% the scroller runs out first, so the caret starts at 83 px, and the first steps are ordinary caret moves with no scrolling. The "not over-scrolled" check (`clearance <= 7`) assumes every step starts near the ruler, so it fails on them.

Trace, `state-ruler-caret-cont-75` (same in all four reports), clearance in drawn px:

`65, 47, 29, 11, 5, 5, 5, ... 5` (20 steps)

- **Line pitch at zoom 0.75 is 18 px.** A drop of exactly 18 means the caret moved a line and `scrollTop` did not change. So steps 2, 3 and 4 did not scroll. Step 5 needed -7, so it scrolled 12 to land on 5.
- **The scroll total proves it.** `startScroll 502 - endScroll 220 = 282`, which is exactly 12 + 15 x 18 for steps 5 to 20. Nothing is left over for steps 1 to 4. Measured.
- **The start was 83.** Paragraph 11 sits at 5 at scroll 220 (`state-ruler-caret-cont-75-*.png`). Paragraph 31 is 20 lines lower, 365 at scroll 220, so 83 at scroll 502. Derived from measured numbers.
- **502 is the end of the document.** Fixture: 60 paragraphs (780 words = 60 x 13). At scroll 502, paragraph 60's caret top is at 132 + 83 + 29 x 18 = 737. Add its line (to 753.5), the 32 px paper bottom padding drawn at 24 (`.is-continuous .editor-paper`, `editor.css:531`), and the viewport's 2 px padding: about 779.5. The scroller's bottom is 780. So `scrollTop` was at its maximum, within 1 px. Inferred from arithmetic: the report does not record `scrollHeight`.
- **Why page 75 did not fail:** same 60 paragraphs and zoom, but page margins and the gap between sheets make it taller. Trace is 5 at all 20 steps, `startScroll` 643.

**Would a person see a jump? No.** Steps 1 to 4 are the caret moving up inside still text. Once it reaches the ruler it holds at 5 and each key scrolls one line. At no step does the scroll exceed what the caret needs. Caveat: this uses `setTextSelection` plus `scrollIntoView`, not real keys.

**Fix (harness only, no app change):**
1. `ensureLongText`: 120 paragraphs rather than 60.
2. Record the start clearance and `scrollHeight - clientHeight`, and assert the start is about 4 px, so a fixture miss reads as a fixture miss.

Then rerun `state-ruler-caret-cont-75`. Steps 5 to 20 already pass both bounds at 5.00; steps 1 to 4 are before the caret reaches the ruler, which the check does not model. The rerun is to make a fixture miss fail loudly, not to prove the bound.

The proof does not rest on the end-of-document arithmetic above. The scroll total leaves nothing for steps 1 to 4, so the caret started about 83 px down, and page 75 lands at exactly 5.00 with the same placement code, so the placement is accurate when the scroller can move. Only the scroller running out explains the miss; the arithmetic corroborates it.

## 2. Other caret states

All clear the ruler, identical in Plain, Color, light and dark. Numbers are drawn px, after each of 20 steps. Every state's min equals its max, so there is no overshoot.

| State | Drawn zoom | Fit scale | minClearance | maxClearance | Scrolled |
|---|---|---|---|---|---|
| page 75 | 0.75 | 1 | 5.00 | 5.00 | 643 to 282 |
| page 100 | 1 | 1 | 5.00 | 5.00 | 853 to 372 |
| page 150 | **1.15** | 0.766 | 5.34 | 5.34 | 960 to 419 |
| page 75, ruler off (floor is the scroller top) | 0.75 | 1 | 5.00 | 5.00 | 643 to 282 |
| two panes at 75, left | **0.555** | fit (inferred) | 5.28 | 5.28 | 469 to 208 |
| two panes at 75, right | **0.555** | fit (inferred) | 5.28 | 5.28 | 469 to 208 |
| image node at 75 | 0.75 | 1 | 5.00 (before: -135) | -- | -- |
| continuous 75 | 0.75 | 1 | 5.00 | 65 (section 1) | 502 to 220 |

- **The r3 failure is gone in these states.** Old code at 0.75 settled with the line about 20 px behind the ruler, by inference (see REVIEW-r3). Now it is 5 px clear, which fits the handler having run. The handler is not instrumented, so that link is inferred.
- **Page at zoom 1 and above: yes, measured this time.** `sidebar width restored` passed and the pane is 970 px. Page 100 is really 1 (at zoom 1 the handler returns false, so this is ProseMirror's own path). Page "150" is really 1.15, because the app fits the page to the 970 px pane; 1.5 cannot occur at this window size.
- **First native point above zoom 1: 1.15, clearance 5.34.** REVIEW-r3's question about above 1 is answered for 1.15 only.
- **Drawn 1.5 has no caret walk.** Continuous 150 is the only state that draws at 1.5, and it was measured for alignment and sticky only.
- **"About 84% fit" was not walked.** With the width fix no state draws at 0.84. Fit-scaled below 1 is covered by the two panes at 0.555; same code path, so 0.84 is inferred fine.
- **Other pane:** moved 0 px in both directions.

## 3. Other measures

**Sound:**
- Alignment (ruler 0, both markers, paper, text) at page 0.75, 1, 1.15 and continuous 0.75, 1, 1.5. Comparisons are within one coordinate space. `glyphInsetFromMarker` is 0 everywhere, recorded not asserted.
- Sticky at page 1.15 and continuous 1.5: `rulerTopAt300` and `rulerTopAt600` both 0 from the scroller top. Opaque background. Clip: `scrollLeft` stays 0.
- Image state: asserts it started behind the ruler (-135, which is 60% of 300 x 0.75, so the placeholder really was 225 px), node selection, top at 5.00, bottom inside. This is a real test of the node branch; the old path would not have moved it.
- Persistence: gap 32 to 48 with `marginInches` 1 unchanged and `topGap` absent before; margin to 120 and 1.25 in with gap kept. Read through `load_project`.
- Row hover 6 x 2 to 16 x 4 (synthetic pointermove). Toolbar dock: scale 1.5, layout rect unchanged.
- The zoom conversion agrees with the picture: at 75%, ruler bottom about 132 and caret at about 137 in the PNG.

**Vacuous or weak; none hides a known failure:**
1. **`caret bottom inside scroller` cannot fail in these walks.** `minBottomGap` is 568 to 646 px, because every walk goes up from near the top. The handler's bottom branch has no native measurement, and neither does moving down. Emulated in Chromium only. This is the one to fix: add a downward walk from near the window's bottom.
2. **No real keys.** All walks are commands, so the 50 ms key window (T243 r2) and real ArrowUp stay hand checks. No typing.
3. **`state-ruler-node-image-75-*.png` does not show the image.** `state()` takes the picture after the state's `finally` has deleted it; the PNG shows paragraph 31 instead. The numbers stand, the picture proves nothing. The placeholder uses a fake asset id, and only the "top above the ruler" start was tried.
4. **`sheetsWithinScroller` ran only at 1.15,** where the sheet fits by design, so it cannot catch a sheet cut off at a narrow width. Narrow widths have pictures only (two panes: not cut off).
5. **Scrollbars were never visible.** `scrollerBarWidth` is 0 in every state, so the alignment checks say nothing about a visible scrollbar.
6. **`check()` records only failures.** A pass and a check that never ran look the same in the report. Low risk, since each state must return without throwing.
7. **`native.sh`'s `grep -q "states 31/31"`** passes if either light or dark has 31. Harmless here: both logs show 31/31 twice, and `stateErrors` is empty in all four reports.

## 4. Pictures

Looked at directly (`p` Plain, `c` Color, `L` light, `D` dark): `writing` cL cD pD; `writing-pages` pL; `research` cD and a crop of pL; `settings` pL; `state-ruler-caret-cont-75` pL; `-page-75` pL; `-page-100` cL; `-page-150` pD; `-page-75-off` pD; `-split-75` cD; `state-ruler-node-image-75` cL; `state-ruler-cont-150` pL; `state-ruler-page-150` cD; `state-margin-persist` cD; `state-gap-persist` pL; `state-row-hover-rail` pD; `state-sidebar190-long` cL; `state-split-rail` cL; `floating-sidebar` cD pL; `floating-card` pL; `state-toolbar-rest` cD; `state-toolbar-magnified` pL. About 26 of the roughly 156 PNGs were opened, so not every state was seen in every palette and theme; the numbers are identical across all four.

**Good:**
- **Double-bold is gone.** With "Only fragment" on screen only Fragments is bold, Manuscript is not (`state-ruler-*`, `state-margin-persist`, `state-row-hover-rail`). Opening alone: Manuscript only. Two panes holding a section and a fragment: both bold, which is correct. Research panel or citation card open over a section: Manuscript and Research both bold, as T244 says. Settings: nothing lit. Icons tinted only in Color.
- **Ruler:** pinned over text, opaque, ticks scale, markers on the text edges at every zoom, at 1.25 in after the key press. Two panes: each pane has its own ruler, aligned, sheets not cut off.
- **Floating:** hugs, no panel or edge, Read to Settings directly below the list, text not overlapped, Plain and Color, both themes.
- **Toolbars:** no box on zoom, type and font; size box stays; the dock grows the last two icons and moves nothing.

**Visible, minor:**
1. **A sliver of the line above shows under the ruler.** The caret line sits 5 px clear, so the line above is cut by the ruler rather than hidden. At 75% and above it is only descenders, reading as small dark marks under the ruler (`state-ruler-caret-cont-75`, `-page-100`). At 0.555 it is the lower half of a line (`state-ruler-caret-split-75`), which looks untidy. Opaque ruler clipping as designed, and a line of scrolled text can always be part-hidden at rest. Owner's call, not a defect in the check.
2. **At the 190 px minimum, "Manusc..." and "Fragme..."** lose letters when bold (`state-sidebar190-long`, `state-split-rail`). Already raised in REVIEW-r3; allowed by the ellipsis rule. Owner's call.

**Not defects, but in the pictures:** focus rings on zoom, More, a marker and the gap handle come from the script. Whether a real mouse click on zoom shows a ring is still a hand check, since a ring would read as the box the owner removed. A toast covers the word count in several states (fixture leftover). No snapshot page, resize-edge, or heading or row CSS hover state exists in the native set. The harness dispatches no `:hover`.

## 5. Native list, "For T240" (for VALIDATION.md)

| # | Item | Status | Basis |
|---|---|---|---|
| 1 | Alignment | **Pass:** Letter, one pane, page 0.75 / 1 / 1.15, continuous 0.75 / 1 / 1.5. **Not checked:** A4; split panes (picture only at 0.555, no measure); visible scrollbar (bar width 0 everywhere) | `state-ruler-{page,cont}-*` |
| 2 | Sticky and clip | **Pass:** pinned at page 1.15 and continuous 1.5, `overflow-x: clip`, no sideways scroll, sheets inside. Static scroll positions, not live scrolling. Narrow widths: picture only, not cut off | `state-ruler-sticky-clip`, `-split-75` |
| 3 | Caret vs ruler | **Pass by command, moving up:** page 0.75, 1, 1.15; 0.75 ruler off; two panes 0.555; image 0.75. **False failure to clear:** continuous 75 upper bound (section 1; its lower bound passes at 5.00). **Not checked:** real ArrowUp and ArrowDown, typing, moving down, the bottom edge, continuous at 1.5 | `state-ruler-caret-*` |
| 4 | Drags | **Not checked.** Key presses only; no trackpad, mouse, release outside window or right-click | -- |
| 5 | Resize handles | **Not checked,** except the split divider's resting line, visible in the two-pane PNG | `-split-75` |
| 6 | Sidebar in Futura | **Pass by eye:** Plain and Color, light and dark, 700 / 500 / 400 readable, dim rows legible. **Not checked:** heading widening as it happens; Bibliography row dim after a click (the harness never clicks it). Weights not read by computed style | `writing`, `state-ruler-*` |
| 7 | Floating | **Pass by eye:** list hug, page view, both palettes and themes. **Not checked:** 30 sections at 600 px; reveal strip; continuous view | `floating-sidebar-*` |
| 8 | SQLite | **Pass:** save then `load_project` for margin and gap; `topGap` absent if never set; gap-only change leaves `marginInches`; margin change keeps gap. **Not checked:** real quit and relaunch, snapshot and restore, recovery journal, project export and import | `state-gap-persist`, `state-margin-persist` |
| 9 | 2 in and 0.25 in export | **Not checked.** No such fixture, and `native.sh` does not run `scripts/native-print-smoke.py` | -- |
| 10 | Toggle | **Partial:** script reached Ruler through More at a 970 px bar and it worked. **Not checked:** Tab order; narrower widths (VALIDATION "Owner's calls" 6 already notes More's Page setup row cannot be clicked at 520 and 460) | `ensureRuler` |
| 11 | Docs merge | **Sections present, now out of date.** Still say native has not been checked: `design-system.md:8`, `:192`, `:253` (twice), `changelog.md:7`, `limitations.md:51`, `validation.md:11`, `architecture.md:55` (item 8 "not yet checked": now partly checked). `limitations.md:52` hedges ("unless the native record says otherwise"), so it stays true but could be sharpened | grep |

**VALIDATION.md, other corrections:**
- Lines 3 and the "All items are not checked" table are now out of date.
- The "Native run" section describes the earlier 26-state run. Add this one: 31/31 states, smoke, baseline, beta and gates exit 0, screens exit 1 only for the `cont-75` fixture miss.
- Its "page 100% and 150% are both..." limit is now fixed, and its real caret failure now passes by command at the states above.

**Still for the owner's hands:** real ArrowUp and ArrowDown at 75%, 150% and in two panes, ruler on and off; an image arrowed onto near the ruler; drags; resize edges; click on zoom for a ring; 2 in and 0.25 in export.

## Final docs (agent-79ce, Claude Opus, T242)

Read only, plus the wording fixes below. Nothing run but `node --check`, no window opened. All of this is CLAIMED.

**Numbers: match the logs.** tsc empty, 69 files and 1157 unit tests, 493 passed / 16 skipped / 1 failed in 28.0 min, rerun 5 of 5, release exit 0, app sha and 15.58 MiB, cargo 63 passed 1 ignored with `git diff src-tauri` empty, T240's 478 and 1137, port 1939. Native list checked against section 5 and the four reports: clearances, 135 to 5 on the image, bottom gap 568 to 646, row hover 6 x 2 to 16 x 4, 31/31, one measure failure in each report, about 156 distinct PNGs. No file in `src/` is newer than the 16:07 binary, and the only later change, `tests/native-screens.js` at 16:27, predates the 16:28 final check. One wrong line, fixed: sticky "`overflow-x: clip`, sheets inside" is true only at page 1.15. Continuous 1.5 has `visible` and 0 sheets, so `sheetsWithinScroller` is empty there. Section 5 item 2 above has the same looseness.

**Docs.** `caretScroll.ts` and T244 (`titleSelected`, `open`) match what `architecture.md:55` and `design-system.md:253` say; "about 0.03 px" is 0.027 measured. Fixed:
1. `limitations.md:51` said both native runs "passed what they measured". Run 1 had a real failure and run 2 a false one. Rewritten.
2. `validation.md:11`: "pass, fail or not checked" now "pass, partial or not checked"; it and `changelog.md:7` called T240 the final check, without the later run's failure or cargo not being rerun. Both corrected.
3. `changelog.md:7` and `design-system.md:8` stopped at T240; now T244. The changelog had no entry for T243 or T244: one bullet added.
4. `design-system.md:253`: "with the ruler off they are the defaults" had lost its subject when the caret text was inserted. Checked against `Writer.tsx:967-968`, then reworded.
`design-system.md:192`, `architecture.md:55`: no change.

**Hand-check sheet.** Every REQUEST.md item and owner decision has a step. Changes, to remove false failures or fill gaps:
- Item 6: two bold headings can be correct. Without this the owner would report T244's intended case as the old bug.
- Item 8: needs a change since the snapshot, or there are no Restore buttons. "Compare" replaced with what you actually click.
- Item 21: 0.25 in must be set with the ruler, since the export panel's box refuses under 0.5.
- Item 14: added 150% and continuous view (both still only command-tested or untested), and named the sliver as not a failure.
- Items 4, 7, 9, 17, 18: exact label or location; a Tab ring on the toolbar is correct.
- New item 23: an image arrowed onto near the ruler was a listed hand check with no step. Item 23 is written from the code and tests, not tried.

**Harness edit: reads correctly, never run, and that is stated** (VALIDATION results table and "Native run"; `node --check` passes). 120 paragraphs give continuous 75 the room it lacked. `startClearance` is measured after the two placing passes and asserted within 2 px of 4, with `scrollHeight` and `clientHeight` in the message, so a miss reads as a fixture miss. The image is removed only by `removeImage` after `state()` has taken the picture, and only if it is still the fixture image. The right pane's 60-paragraph branch stays, and it passed at 0.555. Until a rerun, `cont-75` stays a false failure by reasoning from the numbers, not a demonstrated pass, and the new start assert has not been shown to fail.

**projects-screen:587: the wording was not honest enough, now fixed, and it needs a task.** "The one failure" hid that `ui7-full/pw.log` failed the same way, also at exactly 1.00364. That is 2 of 8 wave-7 full-suite logs, not a one-off. It is listed as an open item. "Timing flake" is now marked inferred: a fixed 30 ms wait then a read of a running animation fits, but nothing was reproduced, and an identical value twice is unexplained (frame-stepped animation time would fit; not checked). The wave-7 diff of `src/styles.css` touches no `emph` rule, so this is no reason to hold wave 7. Task wanted: test-only, low priority, stop reading the scale at a wall-clock moment (for example, assert the transition is running from `getAnimations()`). No task was created.

**Verdict: approve T242 as a record of what was measured,** not as proof of the app in real use. Open: rerun `state-ruler-caret-cont-75` when the Mac is free; the owner's sheet; a downward native walk (section 3, item 1).
