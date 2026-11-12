# Wave 9 native record (T278, agent-8928, Claude Opus, 2026-11-11)

Status of everything here: CLAIMED, not VERIFIED. All checks are scripted in the real WebKit app (the
`com.folio.smoke` debug build, isolated data dir and WebKit data store); clicks are synthetic dispatched
`mousedown` events, not physical clicks. Logs: `node_modules/.cache/personal-word-beta/w9-n/`.

## 150 percent blank-click bug

Check: `tests/native-smoke.js` phase `w9-blank-click`, run by `w9-n/w9-native.py blank`. A blank project,
five short paragraphs, page view, A4, 2-inch margins. For each zoom it dispatches a `mousedown` on the element
under a point (from `elementFromPoint`) in the left paper margin beside line 2, the right margin beside line 2,
and below the last line, then reads the selection. Points are in drawn px (WebKit rects x zoom); each zoom first
calibrates by checking that `elementFromPoint` at the computed start of line 2 hits paragraph 2 (it did at every
zoom). Zooms: toolbar 100/125/150 with the sidebar shown (the 1240 px smoke window fits a 125 or 150 A4 page to
the pane, so both draw at zoom 1.18) and with the sidebar hidden (true zoom 1, 1.25, 1.5).

| Build | Result | Log |
|---|---|---|
| Doctored: `const scale = 1` (the old handler) | 100 passes. 125 and 150 fail: hidden sidebar, true 1.5: left margin caret at the END OF THE DOCUMENT (paragraph 5, offset 20), exactly the Codex symptom; at 1.18 and 1.25 caret at paragraph 5 or between paragraphs 2 and 3 | `blank-doctored2.log` (also `blank-doctored.log`, sidebar-shown only) |
| Real tree with today's fix (rects x zoom) | 100 passes. Every zoom other than 1: below-text click is correct, but BOTH margin clicks put the caret at position 53, the boundary between paragraph 2 and paragraph 3 (a between-blocks position), not the start or end of line 2 | `blank-fixed.log` |

Finding: today's fix is necessary but NOT sufficient. The remaining cause is inside ProseMirror's own
`posAtCoords`: `posFromCaret` (`node_modules/prosemirror-view/dist/index.js:427-433`) compares each block's
`getBoundingClientRect()` with the click coordinates. Inside the zoomed paper native WebKit reports those rects
in drawn / zoom while the coordinates are drawn px, so paragraph 2 looks wholly above / left of the point and
ProseMirror returns `posAfter` of paragraph 2 (53). `caretRangeFromPoint` and `elementFromPoint` take drawn px
and are not affected (the calibration hits paragraph 2).

Other `posAtCoords` callers that may have the same native defect under zoom (recorded, not changed):
`src/Writer.tsx:687`, `src/editor/pagination.ts:615`.

### Second fix (made by this run, as the brief allowed: `src/editor/blankClick.ts` and its unit test only)

Under zoom (`scale !== 1`, so Chromium and native 100% are unchanged) the handler now takes the caret from
`caretRangeFromPoint` at the clamped drawn point, mapped with `view.posAtDOM`; if that gives nothing inside the
editor it falls back to the old `posAtCoords` line. New unit test in `src/editor/blankClick.test.ts` failed first
(`caretRangeFromPoint` never called), then 17/17 passed; `tsc -b` clean. File sha256 after the fix:
`3c27671099c2227ed15ce20e9a0c0f215a3cbf9785ebb95af6a8ac5a3f1ee03e` (copy: `w9-n/blankClick.ts.fix2`).
The native check gained an empty paragraph (line 4) with a left-margin click beside it, and per-case diagnostics.

| Build | Result | Log |
|---|---|---|
| Smoke binary `6f81ddce...` with both fixes | 24 of 24 pass: sidebar shown (zoom 1, 1.18, 1.18) and hidden (1, 1.25, 1.5), left and right margin beside line 2 (start / end of line 2), below the last line (end of document), left margin beside the empty line 4 (inside it) | `blank-fix2.log` |

Measured diagnostics at the handler's clamped point, every zoom other than 1: ProseMirror's raw `posAtCoords`
answers 53 / 53 / 95 / 73 (the position AFTER the block) where `caretRangeFromPoint` answers 27 / 52 / 94 / 72
(the right ones). At zoom 1 both agree. So the cause above is measured, not inferred.
Not covered: wrapped (multi-line) paragraphs, shift+click, clicks on the ruler, footnotes and page gaps
(the handler ignores those targets), a second page, split view, a physical click or trackpad tap.

## Font checks across a real relaunch (phases `w9-fonts-1` then `w9-fonts-2`, same isolated data dir and WebKit store)

| Check | Normal run | Control run (phase 1 sets nothing) |
|---|---|---|
| Installed (Core Text) list non-empty, has Georgia, lacks a made-up family | 180 families, Georgia yes, made-up no | same |
| Logo stays Futura while the interface font is Georgia (interface text reads `Georgia, serif`, `.brand` reads `Futura, ...`) | pass | pass |
| Installed non-built-in interface font (American Typewriter, picked at run time) survives relaunch: saved key, `--ui-font` and interface text all American Typewriter after the menu lists installed families (initFonts finished) | pass | FAILS as it must |
| Added font survives relaunch: fixture = Georgia's single-file TTF from `system_font_file`, given to the Settings hidden file input (no system picker), so the real `addUserFont` path and the `font_add` command ran; after relaunch `font_list` has Georgia/regular and Settings lists it | pass | FAILS as it must |
| Logo Futura after relaunch | pass | pass |

Logs: `fonts-normal.log`, `fonts-control.log`. The added fixture is an installed font, so this proves storage and
listing only, not use of an embedded font on another Mac.

## r2 (agent-e8b8, after REVIEW-blank-click.md)

- Part 1 in `src/editor/blankClick.ts` (sha a36218f1...): S1 between-blocks position moved to nearest text; S2 footnote
  rows and `[role='button']` ignored; S3 tests pin the old path for Chromium and WebKit at zoom 1. Each test failed first.
  Unit 1250 passed; Chromium blank-click/footnotes/pages-gap 18 passed; native blank-click still 24/24.
- New measure-only phase `w9-zoom-probes` (`w9-native.py zoom`). Measured at zoom 1 / 1.25 / 1.5:
  S4 table right-click menu does not open at 1.25 or 1.5 (posAtCoords answers "after the table", 134): REAL.
  S5 arrows across the page gap: correct everywhere tried: NOT reproduced.
  S6 click under page 1's last line: at 1.5 with the gap low in the window the caret goes to page 2 (handler local 150.4
  vs split 107.1): REAL, position-dependent. Details and proposed fixes in VALIDATION.md "Native run r2".
- Release app binary sha256 2586aeee2b80906d90ef6d62ecf0bbab9632b329b2ede2f2e6c468e287c5a752 (14:23).
