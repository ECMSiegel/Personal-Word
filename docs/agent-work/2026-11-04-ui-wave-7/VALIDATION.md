# VALIDATION -- UI wave 7 (T240 and T242, final check 2026-11-04)

Status: CLAIMED. Nothing here is VERIFIED until the owner confirms it in real use. Native WebKit ran twice through the command-driven harness (no real keys, no mouse); the app was not run by this check. Corrections to earlier wording are listed under "Native run".

## Results

Final check (Mac in use, so compile and Chromium only): tsc, unit, build and full Playwright on the tree as of 2026-11-04 16:28 to 16:57 local. Logs: `node_modules/.cache/personal-word-beta/ui7-v/f-tsc.log`, `f-unit.log`, `f-build.log`, `f-npmbuild.log`, `f-pw.log`, `f-rerun.log`, `f-release.log`.

| Check | Result | Evidence |
|---|---|---|
| `tsc --noEmit` | pass (empty log) | `f-tsc.log` |
| `npm test` | pass, 69 files, 1157 tests | `f-unit.log` |
| `npm run build` and private vite build | pass | `f-npmbuild.log`, `f-build.log` |
| Full Playwright (Chromium, port 1939, serial lock) | 493 passed, 16 skipped, 1 failed, 28.0 min. The failure passed 5 of 5 alone (below) | `f-pw.log`, `f-rerun.log` |
| `cargo test` (src-tauri) | not rerun: `git diff` of `src-tauri` is empty, so Rust is unchanged since T240's run (63 passed, 1 ignored, `ui7-v/cargo.log`). `lib.rs` was only touched to force the rebuild | `git diff src-tauri` |
| Native runs (T242), two | see "Native run" | `ui7-v/native-summary.txt`, `r2/` |
| Release build `npm run tauri build` | pass (exit 0), see "Current app" | `f-release.log` |
| `tests/native-screens.js` edits after the second native run (120 fixture paragraphs, start-clearance assert, scroll sizes recorded, image picture taken before deletion) | `node --check` only. Not rerun tonight, because the Mac is in use. The harness change is untested | `node --check` |

**The one failure:** `tests/projects-screen.spec.ts:587` "a project row label eases its grow back after unhover" read a scale of 1.00364 where it wants more than 1.005, mid-transition, in the full run. It is not a first: the earlier full run in `ui7-full/pw.log` (00:28 local) failed the same way with the identical 1.00364. So it failed in 2 of the 8 wave-7 full-suite logs on disk and passed in the other 6; rerun alone 5 times, 5 passed. Classification: probably a timing flake, inferred and not proven: the test waits a fixed 30 ms, then reads an animation in flight, so a late read under a full suite's load would come in low. The wave-7 diff of `src/styles.css` touches no `emph` rule. Not reproduced, and the identical value is not explained. It needs a small test-only task (see "Known open items").

Earlier in the night T240 ran the same suites on an older tree (478 passed, 16 skipped, 0 failed; unit 68 files, 1137 tests). The numbers above supersede it. T236-T238's notes say `writing-aids.spec.ts:21` failed locally 14 of 20 times in a repeat hunt; it passed in both full runs. Treat it as an open flake.

## Native list (from REVIEW-native2.md, item 5)

PASS, PARTIAL and NOT CHECKED mean what the second native run measured, by command: no real keys, mouse, trackpad or window resize. All CLAIMED.

| # | Item | Status | Basis and limits |
|---|---|---|---|
| 1 | Ruler alignment | PASS: Letter, one pane, page 0.75 / 1 / 1.15, continuous 0.75 / 1 / 1.5. NOT CHECKED: A4; split panes (picture only at 0.555, no measure); a visible scrollbar (bar width was 0 in every state) | `state-ruler-{page,cont}-*` |
| 2 | Sticky and clip | PASS at page 1.15 and continuous 1.5: pinned (moves 0 px), no sideways scroll. At page 1.15 also `overflow-x: clip` and sheets inside; continuous has no sheets and no clip (its viewport is `visible`). Static scroll positions, not live scrolling. Narrow widths are pictures only | `state-ruler-sticky-clip`, `-split-75` |
| 3 | Caret vs ruler | PASS by command, moving up only: page 0.75, 1, 1.15; page 0.75 ruler off; two panes at 0.555; image node at 0.75 (started 135 px behind, ended 5 px clear). FALSE FAILURE at continuous 0.75 (below). NOT CHECKED: real ArrowUp and ArrowDown, typing, moving down, the bottom edge, continuous at 1.5 | `state-ruler-caret-*` |
| 4 | Drags | NOT CHECKED: key presses only; no trackpad, mouse, release outside the window or right-click | -- |
| 5 | Resize handles | NOT CHECKED, except the split divider's resting line in the two-pane picture | `-split-75` |
| 6 | Sidebar in Futura | PASS by eye: Plain and Color, light and dark, 700 / 500 / 400 readable, dim rows legible. NOT CHECKED: heading widening as it happens; Bibliography row dim after a click; weights not read from computed style | `writing`, `state-ruler-*` |
| 7 | Floating | PASS by eye: list hug, page view, both palettes and themes. NOT CHECKED: 30 sections at 600 px; reveal strip; continuous view | `floating-sidebar-*` |
| 8 | SQLite | PASS: save then `load_project` for margin and gap; `topGap` absent if never set; a gap-only change leaves `marginInches`; a margin change keeps the gap. NOT CHECKED: a real quit and relaunch, snapshot and restore, recovery journal, project export and import | `state-gap-persist`, `state-margin-persist` |
| 9 | 2 in and 0.25 in export | NOT CHECKED: no such fixture, and `native.sh` does not run `scripts/native-print-smoke.py` | -- |
| 10 | Toggle | PARTIAL: the script reached Ruler through More at a 970 px bar and it worked. NOT CHECKED: Tab order; narrower widths (see Owner's call 6) | `ensureRuler` |
| 11 | Docs merge | Done and now corrected to the above | docs diff |

Other native results (second run): the double bold heading is gone (with only Fragments on screen only Fragments is bold; two panes holding a section and a fragment light both; Research panel or citation card over a section lights Manuscript and Research; Settings lights nothing); floating hugs its rows with no panel or edge; the format bar has no box on zoom, type or font; row hover grew its line 6 to 16 px (synthetic pointer move). About 26 of about 156 PNGs were opened by the reviewer.

Weak or vacuous native checks, none hiding a known failure: `caret bottom inside scroller` cannot fail in up-only walks (bottom gap was 568 to 646 px); `sheetsWithinScroller` ran only at 1.15; `check()` records only failures; `native.sh` greps `states 31/31` and passes if either theme has it (both did).

## Native run (T242, 2026-11-04, owner unlocked the Mac)

Two runs. Logs: `ui7-v/` (`native-summary.txt` holds the second run's smoke, reliability, gates and screens; `r2/plain.log`, `r2/color.log`, `r2/*/report-*.json` the first screens rerun and its reports).

**Run 1 (26 states).** Three measured failures at "150%": caret below ruler, sticky pinned, sheets within scroller. Two were harness errors (WebKit reports rects under CSS zoom in zoomed space; the sticky check compared scroll 0). The third was real: caret against ruler compared two different scales. In drawn pixels at zoom 0.843 the caret line's top sat 9 px behind the ruler (REVIEW-r3.md, T242). That is what T243 (`src/caretScroll.ts`) fixes. **Correction:** an earlier edit of this file said the rerun reported no failed measured check and treated that as a pass; that "all pass" claim was wrong, because the harness hid the real failure.

**Run 2 (31 states, binary built 16:07, after T243 and the width fix).** Native smoke PASS; reliability baseline and beta PASS; gates pages-zoom and pages-probe PASS with zero flags; native screens Plain and Color, light and dark: 31/31 states, `stateErrors` empty, exit 1 for one reason only: **`caret cont-75 not over-scrolled`** (min clearance 5.0, max 65.0). That is a **false failure from the check's fixture, not the app.** The 60-paragraph fixture is too short in continuous view at 75%, so the scroller runs out and the walk starts 83 px down instead of 4; the first four steps are ordinary caret moves with no scroll (clearance 65, 47, 29, 11, then 5 for steps 5 to 20). A person would see no jump. The same check at page 75, with a taller page, holds 5.00 for all 20 steps. The cause is read from the measured scroll total (502 to 220 = 282, which is exactly what steps 5 to 20 need), not from `scrollHeight`, which was not recorded. Fix made in the harness only (see the Results table): not rerun.

Measured natively in run 2 (drawn px, after 20 steps each): clearance 5.00 at page 0.75, 1, 0.75 ruler off; 5.34 at page 1.15 (the app fits a "150%" page to the 970 px pane, so 1.5 never occurs there); 5.28 in each of two panes at 0.555 with the other pane moving 0 px. Page "100%" really is zoom 1, where the handler returns false and ProseMirror's own path runs. Real keys and the 50 ms key window were not exercised.

Limits, still hand checks: real ArrowUp and ArrowDown; an image arrowed onto near the ruler; typing; drags; resize edges; a click on zoom showing a focus ring (focus rings seen in pictures came from the script); print and PDF export with a changed margin; SQLite through a real quit and relaunch.

## Known open items

- footnotes.spec:48 and :134 failed once on CI; the cause is unproven. Both builds fail under a 150 ms rAF delay. No fix made.
- projects-screen:587: failed in 2 of 8 wave-7 full-suite logs, 1.00364 both times (see "The one failure"). Needs a test-only task: stop reading the scale at a fixed 30 ms. No task exists yet.
- writing-aids:21: unexplained local failures in T238's repeat hunt (caret stays in paragraph 2 after ArrowUp and Home); passed here.
- A node-selected footnote marker followed by Insert image drops the note. Seen through a test only; cause not found.
- `SelectAllSync` calls `view.domObserver.flush`, an untyped ProseMirror internal; tsc will not catch an upgrade changing it, the split-view spec will.
- Native WebKit was checked only by the command-driven harness (see "Native run"): real keys, mouse drags, resize edges, A4, split-pane measures, a visible scrollbar, and print or PDF export with a changed margin are unchecked.
- T243 (`src/caretScroll.ts`) is verified only in emulation (Chromium with rects patched to the WebKit model) and by native command-driven walks. Its unit test is partly a mirror of its own model, and the Chromium browser tests only pin that Chromium is unchanged.
- Moving down, the bottom edge, and typing at the bottom have no native measure; `caret bottom inside scroller` cannot fail in the up-only walks.
- A node taller than the window is not top-aligned by the caret handler when its top starts in view (same as ProseMirror's own rule; unowned).
- After a long main-thread stall (over 50 ms between key and selection change) ProseMirror does not ask the handler to scroll, so one line can sit behind the ruler until the next key. Inferred cause of one earlier miss, not reproduced.

## Owner's calls

1. Ruler toggle is a button in Page setup, not a toolbar icon (a toolbar icon would push Focus mode and Prose check into More at 1440 and need a baseline re-record).
2. Margin presets 1 1/4, 1 1/2, 1 3/4 and 2 inch were added unasked; keep or drop.
3. Continuous-view column went from 608 to 624 px (8 px side padding removed), so some lines rewrap.
4. The split divider's 1 px line stays on hover; the sidebar and research edges show nothing.
5. The Haiku worker's unboxed dropdowns also took the screenplay paragraph-style dropdown on the format bar.
6. At 520 and 460 px window width the More menu's Page setup row sits under the sidebar's Settings group and can't be clicked; below the 850 minimum window, narrow-pane case not checked.
7. A sliver of the line above shows under the ruler. The caret line sits 5 px clear, so the line above is cut by the ruler instead of hidden. At 75% and up it is only descenders (small dark marks under the ruler); at the two-pane zoom (0.555) it is the lower half of a line, which looks untidy. Keep, or ask for a bigger gap.
8. At the 190 px minimum sidebar width "Manusc..." and "Fragme..." lose letters when bold. Allowed by the ellipsis rule; keep, or ask for a wider minimum.

## Owner hand-check sheet (one line per request item)

1. Scroll bars grow when you hover the matching subsection: in a project with 3+ sections, move the pointer over a sidebar row (not the line); that row's short line on the right should grow like pointing at the line does.
2. No word count in the sidebar: look at the section rows and the hover state of a row; no count. The count is only in the footer under the page.
3. Ruler: open Page setup (More on a narrow window), press Ruler. Drag a triangle; both sides move and the margin matches Word and PDF export (export a PDF and look). Try 75%, 100%, 150% zoom, page and continuous view.
4. Top gap: with the ruler on in continuous view, scroll to the very top, then drag the short line centred just above the first line of text up and down; scroll and confirm the gap scrolls away. Export to Word: no extra space.
5. No Cmd-K next to Find in project: look at the empty field; Cmd+K should still focus it.
6. Hierarchy: click a section: its heading is bold and normal colour (icon tinted in Color palette); rows are dim; hover a row and it goes full colour; open a row and it stays full colour. Two headings can be bold when two things are on screen (two panes holding a section and a fragment, or the Research panel over a section): that is intended. With only a fragment open, only Fragments is bold. Try Plain and Color, light and dark.
7. No boxes on zoom, text style and font on the top bar: look at the bar; hover and click each with the mouse; no box and no ring (reaching one with the Tab key does show a ring, which is correct). Page setup dropdowns should still have boxes.
8. Snapshot page spacing: take a snapshot, change some text, open Snapshots & history and click that snapshot (with no change there are no Restore buttons to compare); the title, Restore buttons and text should share one left edge.
9. Floating sidebar left alignment: Settings, under Sidebar, turn on "Floating sidebar and research", wide window and zoom 50%; compare the search icon and rows x position against the docked sidebar; they should match.
10. Investigate 1 (blue edge on hover): hover the sidebar edge, the research panel edge and the split divider; no blue; cursor changes; Tab to a handle and press arrows; a ring shows.
11. Investigate 2 (floating text): floating list should hug its rows with no tall empty column and no painted edge.
12. Cite here: with floating on, in a window wide enough that the card shows, click the Research heading, choose Enter manually, press Cite here. The cursor should be in the card's Page field, not in the footnote.
13. Keyboard: Tab through Page setup and the ruler sliders; arrows move a margin by 1/16 inch.
14. Real-key caret check: ruler on, zoom 75, then 100, then 150, in page view and in continuous view; click into the text, then hold Up arrow and hold Down arrow through a long document. The caret line should never hide behind the ruler or leave the window. Repeat with the ruler off. Not failures: the bottoms of letters from the line above showing under the ruler (Owner's call 7), or the caret starting lower down when near the document's end. Worth reporting, not yet understood in real use: one line slipping behind the ruler until the next key press (known open item, after a stall). (Native checks used commands, not real keys.)
15. Type at the end of a long document and move down a few lines: the caret stays in view and nothing jumps.
16. Page size A4: turn the ruler on at A4 and check the 0 tick and both markers sit on the paper and text edges.
17. Split panes: hover a section row and click its split icon to open two panes, ruler on, hold Up and Down in one; the other pane must not move and no sheet is cut off.
18. Visible scrollbar: in System Settings > Appearance set Show scroll bars to Always; check the ruler, markers and text edges still line up and nothing scrolls sideways.
19. Snapshot page: open a snapshot compare at a narrow and a wide window; title, Restore buttons and text share one left edge.
20. Resize edges: hover and drag the sidebar edge, the research panel edge and the split divider; no line on hover except the divider's resting line; no focus ring on a mouse click.
21. Print and PDF export with a changed margin: set the margin to 2 in, then 0.25 in, print to PDF, and check the PDF margin matches the ruler and the page setup (Page setup shows 0.25 as "0.25 inch"). Set it with the ruler: the Margins box in the export panel refuses anything under 0.5 by design (`docs/limitations.md`), which is not a failure.
22. Project restart: set a margin and a top gap, quit Personal Word fully, reopen the project; margin and gap are kept.
23. Image near the ruler: at zoom 75 with the ruler on, put an image in a long section, scroll until the image is partly behind the ruler, then arrow onto it from the line above or below; the whole top of the image comes clear of the ruler.

## Current app

`npm run tauri build` after `touch src-tauri/src/lib.rs`, exit 0 (2026-11-04 about 17:00 local, under the serial lock). App: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app` (15.58 MiB). sha256 of `Contents/MacOS/folio`: `4f28039a8b4cef3e63d9cf7b781871a305d219d0888b4e060240d3e1e4fd81b2`. This supersedes the earlier shas recorded here (`cdb42716...6b6df72` and any before it). Version not bumped, nothing published or committed. The build includes T241, T243 and T244 as they are in the tree; it was not opened or run. The browser suite ran on the same source (the `tests/native-screens.js` edit is not part of the app).

## Owner's answers (2026-11-04)

All owner's calls above are settled as they are. Owner on real keys: "arrow seems to work" (Up and Down in the app, reported in chat, so this item is VERIFIED only as far as that report; other hand checks were not reported). Floating "fine for now". Footnote marker and Apple silicon saved for later (board). Wave 4 and 5 hand-check sheets marked done by the owner without being run.


## T252 native rerun (2026-11-05)

CLAIMED, awaiting independent review and owner real use. Agent-f01a ran the isolated native driver on the current tree after confirming the desktop was accessible. Evidence is retained in `node_modules/.cache/personal-word-beta/ui7-t252/`; the earlier `ui7-v` evidence was preserved. Smoke binary SHA-256: `1c64e52e033446e48a367e74720f2f1151d6c16cf857958f9287307354d184c8`.

The smoke build, native WebView/SQLite smoke, baseline and beta reliability suites, pages-zoom and pages-probe gates, and Plain and Color captures each exited 0. Each palette reported 31/31 states in both light and dark, with no `MEASURE FAILED` or `STATE FAILED` in the summary. The repaired continuous 75% fixture ran: the Plain light report records 5 px clearance for the inspected caret positions. The four 39-image sets were inspected as contact sheets, with the continuous 75% light Plain and dark Color images also viewed full size; this overview is not a pixel-level review of every image. No new failure was identified in that inspection. Logs, reports and original PNGs are under the evidence directory.

The reliability tests exercise controlled process termination and acknowledged SQLite checkpoints, not power loss or hardware failure. Automated native commands do not substitute for real keyboard, mouse, file-picker, quit/relaunch and export checks in T253.

## T253 attempt (2026-11-05)

The current normal app was rebuilt with `npm run tauri build` under the serial lock, exit 0. Bundle: `src-tauri/target/release/bundle/macos/Personal Word.app`; identifier `com.folio.writing`; `Contents/MacOS/folio` SHA-256 `d5f9edcab4567790f4447e114d7c59a6eaf6351142dee51b56af59dc9a915fba`. Build log: `node_modules/.cache/personal-word-beta/ui7-t253/build.log`. No real-app interaction checks were performed in this attempt. Auto-review rejected launching with a dedicated `HOME`, citing the risk of overriding that common variable. The app was not launched and the required real-input, PDF, relaunch, export, sidebar and A4 checks remain open.

## T253 skipped by the owner (2026-11-05)

The owner chose to skip T253 for this wave and commit and push without it. None of these were run: real arrow keys around the ruler in the real app, ruler drag with a mouse or trackpad, Upload PDF through the Mac file picker and its quit, relaunch, removal and snapshot restore, margin and top gap across a real relaunch, PDF and Word export with a changed margin, sidebar bottom rows with content, and A4. T252's automated native run does not cover them. The late-key caret fix (`KeyCaretInView`) is proven only in Chromium with emulated WebKit rects.

Final full check on this code: tsc clean; unit 1157 passed; cargo 64 passed, 1 ignored; Playwright 503 passed, 16 skipped, 0 failed (24.6 min).

