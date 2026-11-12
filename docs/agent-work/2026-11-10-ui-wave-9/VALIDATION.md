# Wave 9 validation (T277, steps 1-5)

Runner: agent-575d (Sonnet), 2026-11-11. Status of everything below: CLAIMED, not VERIFIED. Nothing was fixed or
edited; failures are listed as found and the reviewer (step 6) judges them. Logs: node_modules/.cache/personal-word-beta/w9-v/.
Pinned Node 22.23.3, serial lock held for steps 2-5 and released.

## Step 1 -- `git status --short`  (exit 0, 175 lines, log step1-status.txt)
- 60 modified tracked files, the rest untracked. All src/, src-tauri/, tests/ and docs paths are named in the wave 9 plan
  or the task notes EXCEPT these three, which belong to the already-approved board task T251 ("selected footnote marker then
  Insert image", approved by agent-2ff3), not to the wave 9 plan text:
  - `src/editor/extensions.ts` (modified)
  - `tests/t251-marker-image.spec.ts` (untracked)
  - `docs/agent-work/2026-11-11-t251-marker-image/` (untracked)
- Also modified, not source: `src/adversarial-wp2.test.ts`, `src/adversarial-wp2-1.test.ts`, `src/main.tsx`, `src/split.ts`, `src/split.test.ts`
  are all named in the plan or notes (grep found them).
- Known pre-existing untracked items present: scripts/__pycache__/, docs/agent-work/2026-11-02-ui-wave-6/shots/,
  docs/agent-work/2026-11-04-ui-wave-7/shots/, docs/agent-work/2026-11-05-ui-wave-8/, team/ files. `test-results` not listed (ignored).
- New untracked source: src-tauri/src/fonts.rs, sysfonts.rs; src/fonts/; src/editor/SideRuler.tsx, blankClick.ts(+test), side-ruler.css;
  src/export/ExportMenu.tsx, exportActions.ts(+test), export-menu.css, fontSource.ts(+test), pdf-fonts.test.ts, docx-fonts.test.ts;
  src/settings/AppearanceSettings.tsx, SettingsNav.tsx and css; src/derived/footnoteLocations.ts(+test); src/libraryPreferences.ts(+test);
  src/research/asideMotion.ts; src/components/icon-magnify.css, prose-issues.css; 16 tests/w9-*.spec.ts files.

## Step 2 -- `npm run build`  (exit 0, log step2-build.log)
tsc -b clean; vite build: 2057 modules, built in 7.88s, dist/ written (markdownBundle-ylRfuyjJ.js, pdf chunk 2.5 MB).
Only warnings: the existing plugin-dialog dynamic/static import note and the chunk-size note.

## Step 3 -- `npm test`  (exit 0, log step3-unit.log)
Test Files 81 passed (81); Tests 1237 passed (1237); 13.9 s.

## Step 4 -- `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/T277`
Exit 1, log step4-e2e.log. 568 tests, 1 worker, retries 0: **546 passed, 6 failed, 16 skipped, 24.5 min.**

Markdown round-trip, the four tests that failed on the dev server (baseline-dev.txt): against the built app all four PASSED:
:179, :192, :318, :357 (also :262, :283, :372, :381, :400, :408, :433 in the same file passed). Log lines 240-250.

Failures (each file rerun alone three times, same environment, whole file each time; pass count is for the failing test):

| # | file:line, title | rerun 3x | in baseline-dev.txt? | known intermittent? | first error lines |
|---|---|---|---|---|---|
| 1 | popover-bounds.spec.ts:57 research menus stay inside the research aside scroll container | 2 of 3 passed (failed in rerun 2) | no | yes (HANDOFF: popover-bounds:57 failed once for earlier workers) | `expect(within(asideBox, menuRect)).toBe(true)` Expected true, Received false (line 78) |
| 2 | popover-bounds.spec.ts:174 toolbar popovers keep their recorded untouched-tree placement | **0 of 3** (fails every time) | no | no | `Prose check height changed` Expected <= 1, Received 86 (line 220) |
| 3 | sidebar-context-menu.spec.ts:319 Reduce Motion: a pointer-opened menu is instant | 2 of 3 passed (failed in rerun 3) | no | no (older HANDOFF notes list it as a CI-only failure on a prior run) | `expect(state.opacity).toBe("1")` Received "0" (line 329) |
| 4 | w9-export-menu.spec.ts:55 Cmd+Shift+E opens the menu, focus on first item; keyboard works | 1 of 3 passed (rerun 1 timed out at 90 s waiting for "download"; rerun 3 got the file `Keyboard export.docx`, expected `Keyboard export.txt`) | no | no | full run: `page.waitForEvent: Test timeout of 90000ms exceeded`, waiting for event "download" (line 77) |
| 5 | w9-research-panel.spec.ts:15 an open source reads Source, Citation, More details, Used in | **0 of 3** (fails every time, same line) | no | no | `locator('.research-panel .footnote-where')` Expected count 0, Received 1 (line 92); the "Used in" row shows a location although the test says there should be none |
| 6 | w9-settings-nav.spec.ts:100 scrollToSettingsSection works in the same tick that opens Settings | **0 of 3** (fails every time) | no | no | `TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:1420/src/settings/SettingsNav.tsx` (line 106 `import("/src/settings/SettingsNav.tsx")`; that source path does not exist in the production bundle) |

Notes for the reviewer (facts, not verdicts): #2 and #5 and #6 are deterministic in this environment; #6 imports a /src path that only
a dev server serves. The other failures in baseline-dev.txt (import-cancel.spec.ts:75 and four markdown-roundtrip) did NOT fail here. The wave
had earlier said that hover-emphasis crawl is near its cap; hover-emphasis.spec passed in this run.

## Step 5 -- `cd src-tauri && cargo test`  (exit 0, log step5-cargo.log)
lib: 70 passed, 0 failed, 1 ignored; main and doc-tests: 0 tests.
`git diff --stat src-tauri/Cargo.lock`: 1 file, 2 insertions. The two added lines are `"objc2-core-foundation",` and `"objc2-core-text",`
in the folio package's dependency list. No new `[[package]]` entry appears (both crates were already locked via wry/tao); Cargo.toml adds
them as direct dependencies with limited features (the approved C6 exception).

## Not checked
- Native WebKit / the real Mac app (no tauri build, no app launch, no native or screen script, per instruction).
- 150 percent zoom in a real window, hover sharpness (fuzzy text), real fonts added/installed fonts in native storage, PDF/Word output opened in Preview/Word/Pages.
- Step 6 (independent Opus review) and steps 7-8 (owner).
- cargo test with `--features native-smoke`; Rust fmt/clippy; `npm run lint` (none exists in the list).
- Flaky tests were not run beyond three solo reruns of the failing files.

## Owner hand checks
From plan step 8: hover sharpness; blank-page click at 100% and 150%; PubMed link; add a font family, relaunch, pick an installed
font, export a PDF and a Word file; side ruler; sidebar on a short window; card view at narrow and wide sidebar widths; Export menu
and Cmd+Shift+E; Go to from "Used in"; Research slide-in; Settings strip; Projects page with and without projects.

From the task notes (notes/<task>.md has the full steps):
- A1: hover sidebar rows, toolbar text menus and Settings buttons in the built app: text thicker, not growing, sharp.
- A2: ~1100x500 window, sidebar pinned, ~25 sections: no scrollbar, wheel scrolls, no sideways drag, edge fade shows.
- A3: card view in Manuscript/Fragments/Research at ~220 px: no overflow, titles end with "...", PDF card indented, synopsis boxes open on click.
- B1: Times New Roman appears once, no quotes, fits the button at 1400 px; Prose check and Page setup icons differ.
- B2: "The the cat." gives "1 issue"; checkboxes share one right edge; Previous/Next "Page 1 of 21" with ~2,100 words.
- B3: trash icon on a project row and Open beside icon grow alone (icon only), also on keyboard focus; nothing grows under Reduce Motion.
- B4: Open beside with a split: left/right pane targeting as listed in B4.md.
- B5: click below last line, left/right margin, shift+click, ruler/footnote/page gap, at 100 and 150 percent.
- B6: paste the Gupta PubMed link into Research lookup; check the source created, DOI follow, metadata fallback.
- C1: Research source layout (Source, Citation, More details closed, Used in), Citation rules, offline sentence.
- C2/C3/C6: add a .ttf/.otf, relaunch, family still listed; Interface font menu and document font menu list installed families (Georgia); remove it.
- C3: Interface font Georgia: the Projects page logo stays Futura.
- C4: export a PDF with an added font, Georgia and Futura; Preview > Inspector > Fonts (Futura expected to fall back).
- C5: side ruler at 100/150 percent and split view; drag the margin marker; ruler hides when the sidebar floats.
- C7: export .docx with an added font; open in Word and Pages; also export in the real build.
- E1: Export button after Snapshot, eight rows, plain text downloads `<title>.txt`, Cmd+Shift+E focus and Escape; Export settings opens Settings.
- G1: "Used in" footnote row reads "in Two" with Go to; Cmd+click split case.
- M1: Research slides in on sidebar click, not on the palette command.
- P1: Projects toolbar, sort/direction/view persistence, icon grow, row text, empty state.
- S1: Settings strip pinned, Goals link scrolls smoothly, Reduce Motion instant.
- T251 note (docs/agent-work/2026-11-11-t251-marker-image/NOTE.md): marker node-selected then Insert image directly still replaces the marker (open).

## Rerun after fixes (2026-11-11)

Runner: agent-3b1a (Sonnet). Status of everything below: CLAIMED, not VERIFIED. Nothing was fixed or edited. Logs:
node_modules/.cache/personal-word-beta/w9-v2/. Pinned Node 22.23.3, serial lock held for all steps and released.

### Step 1 -- `git status --short | wc -l`: 187 lines (was 175 + an EXIT line in the first list)
Compared with w9-v/step1-status.txt: new lines are only team/agents/*.json (7 new agents), team/tasks/T280-T283.json,
`M src/components/ContextMenu.tsx` and `M tests/fixtures/popover-baseline-rects.json`. All are in the allowed set. Nothing unexpected.

### Step 2 -- `npm run build`: exit 0 (step2-build.log). built in 8.36 s, only the usual chunk-size note.

### Step 3 -- `npm test`: exit 0. Test Files 81 passed (81); Tests 1242 passed (1242) (was 1237) (step3-unit.log).

### Step 4 -- `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/T277-r2`
Exit 1, step4-e2e.log. 568 tests: **551 passed, 1 failed, 16 skipped, 22.9 min.**
All six first-run failures PASSED (popover-bounds:57 and :174, sidebar-context-menu:319, w9-export-menu:55, w9-research-panel:15, w9-settings-nav:100).
One failure, NOT one of the six:
- `tests/command-palette.spec.ts:147` "Enter on a command that does not move focus keeps the caret". Error: `expect(locator).toContainText` Expected "hello woXrld", Received "hello worXld" (line 154: typed "X" landed one character further right).
- Solo reruns of the whole file, same environment, 3 times: 9 passed each time (logs rerun-command-palette-1..3.log). So that test passed 3 of 3 alone; it failed 1 of 1 inside the full run, so it looks order- or timing-dependent. It passed in the first run's full suite.

### Step 5 -- repeat-each 5 on the fixed specs (step5-repeat.log)
Exit 0. 135 passed, 0 failed, 20 skipped (the 4 screenshot tests x 5 are skipped). Per test, 5 of 5 passed for each of the 27 non-skipped tests, including
"toolbar popovers keep their recorded untouched-tree placement" (5/5; no Prose check height failure seen), popover-bounds:57 (5/5),
sidebar-context-menu all 12 including "floating sidebar, short window > the scrolling group list ends above the bottom rows" (5/5) and "Reduce Motion" (5/5),
w9-export-menu all 6 (5/5, including Cmd+Shift+E), w9-research-panel (5/5), w9-settings-nav all 4 (5/5).

### Step 6 -- `cd src-tauri && cargo test`: exit 0. lib 70 passed, 0 failed, 1 ignored; main and doc-tests 0 tests (step6-cargo.log).

Full built-app suite: 551 passed, 1 failed (tests/command-palette.spec.ts:147, passes 3 of 3 when its file is run alone; new this run, not among the first six).

## Native run (2026-11-11, scripted, Opus)

Runner: agent-8928 (Claude Opus), T278, owner's "go" of 2026-11-11 relayed by agent-a63f. Status of everything here: CLAIMED, never
VERIFIED. "Scripted" means run inside the real WebKit app (the `com.folio.smoke` debug build, isolated data dir and WebKit data
store, never the owner's storage) by tests/native-smoke.js or the existing native scripts; clicks are SYNTHETIC dispatched
`mousedown` events, not physical clicks; no real keys, mouse, trackpad, file picker or System Settings. Logs and runner:
`node_modules/.cache/personal-word-beta/w9-n/` (`w9-native.py` runs the new phases). Full detail: `NATIVE.md` in this folder.
Pinned Node 22.23.3; serial lock held for all builds and native runs, released.

**Source change made by this run (allowed by the brief, say so prominently):** `src/editor/blankClick.ts` got a SECOND fix and
`src/editor/blankClick.test.ts` one new test. Today's first fix (rects x zoom) was necessary but NOT sufficient in native WebKit. The second fix has had NO independent review.

| Check | How | Result | Log |
|---|---|---|---|
| Blank click, fail-first: old handler (`scale` forced to 1, rebuilt) | scripted, synthetic mousedown; A4, 2-inch margins, page view; zoom 100/125/150 with sidebar shown (draws 1, 1.18, 1.18) and hidden (1, 1.25, 1.5) | 100 passes; every other zoom fails. True 1.5: left-margin click beside line 2 put the caret at the END OF THE DOCUMENT (the Codex symptom) | `blank-doctored2.log` |
| Blank click with today's first fix only (handler restored byte-identical, sha cded1b55...) | same | 100 passes; every other zoom: both margin clicks put the caret at position 53, BETWEEN paragraphs 2 and 3. Below-text click correct. Cause measured: ProseMirror's own posAtCoords (`prosemirror-view/dist/index.js:427-433`) compares WebKit's drawn / zoom block rects with drawn px and returns "after the block" | `blank-fixed.log` |
| Blank click with the second fix (under zoom take the caret from `caretRangeFromPoint`, fall back to posAtCoords; sha 3c276710...) | same, plus an empty paragraph and per-case diagnostics | 24 of 24 pass: left margin = start of line 2, right margin = end of line 2, below = end of document, beside empty line 4 = inside it, at every zoom. Unit test failed first, now 17/17; full unit suite 1244 passed; tsc clean. Chromium path unchanged by construction (scale 1), browser spec not rerun | `blank-fix2.log`, `unit.log` |
| Installed (Core Text) font list | scripted (`system_font_families`) | 180 families, contains Georgia, lacks a made-up name | `fonts-normal.log` |
| Logo stays Futura with interface font Georgia | scripted, computed style | pass (interface text reads Georgia, `.brand` reads Futura) | `fonts-normal.log` |
| Interface font survives relaunch, no reset (F3/F5) | scripted, quit and relaunch on the same isolated store, read after initFonts finished; uses an installed non-built-in family (American Typewriter) so the reset path is reachable | pass; control run (nothing chosen) FAILS as it must | `fonts-normal.log`, `fonts-control.log` |
| Added font survives relaunch | scripted: Georgia's TTF bytes (from `system_font_file`) given to the Settings hidden file input (no system picker), real `addUserFont` + `font_add` | pass (listed by `font_list` and in Settings after relaunch); control FAILS as it must. Installed font, so not proof of embedding on another Mac | same |
| native-smoke.py | scripted | PASS | `smoke.log` |
| native-reliability.py --suite baseline | scripted | PASS, 14 passed + 5 negative controls detected, 0 failed | `rel-baseline.log` |
| native-reliability.py --suite beta | scripted | PASS, 20 passed + 42 controls detected, 0 failed | `rel-beta.log` |
| native-screens.py Plain / Color | scripted, light and dark | each exit 0, 31/31 states light and dark, no MEASURE/STATE FAILED | `screens-plain.log`, `screens-color.log` |
| Screenshots of wave 9 areas | read by eye (about 9 PNGs) | Projects: empty screen and two-project list, the caption row (Sort, reverse, view toggle; P1 `.library-caption`) above the list in both, long name ends "...", no clipping. Sidebar: no scrollbar at 270 and 190 px. Research: lookup, actions, then the source with "Source" open; Citation / More details / Used in are below the fold, NOT seen. Settings: strip General..Templates shown (light Plain, dark Color). Export button after Snapshot in the header. Side ruler and top ruler at 150%. Nothing visibly broken. Noted, not judged: two rules about 33 px apart under the Settings strip; "Selected sources added." toast covers the word count (known backlog); every capture, light and dark, is 1240x840 with a band below the footer (visible only in dark), same size in both themes, so not dark-specific; not compared with older runs | `screens-plain/`, `screens-color/` |
| Release app | `touch src-tauri/src/lib.rs`, `npm run tauri build` (13:48-13:51), exit 0 | `src-tauri/target/release/bundle/macos/Personal Word.app` (15.65 MiB), binary built 2026-11-11 13:51:20, sha256 of `Contents/MacOS/folio` `8587c0b246cfbc0213fb28eaaa87f36bd56da4a3db33a4c2a81c8aa9ded3ad71`. Contains both blank-click fixes. Not launched | `release-build.log` |

Limits: only the two persistence font checks were shown failing (control run); the installed-list and logo checks rest on discrimination (made-up family absent; the same reading on interface text says Georgia). The persistence check was not run against the pre-F3/F5 code. The `pages-zoom` and `pages-probe` gates (ui4-g/native-gate.py) were NOT run. Typing after the blank click (the owner's actual symptom) was not scripted; the check reads the selection only.

Found, not fixed (other `posAtCoords` callers that may share the zoom defect natively): `src/Writer.tsx:687`, `src/editor/pagination.ts:615`.

### Still needs a human at the Mac

| # | Check | Why it is left |
|---|---|---|
| 1 | Blank-page click with a real mouse/trackpad: A4, 2-inch margins, 100/125/150%, left and right margin beside a middle line, below the text, then type; also wrapped lines, shift+click, second page, split view (B5) | scripted run used synthetic events on short lines only |
| 2 | Real Up/Down arrow keys at 75/100/150%, page and continuous, ruler on and off (T253, wave 7 item 14) | needs real keys |
| 3 | Reduce Motion via System Settings: icon grow off, Research slide-in, Settings Goals scroll instant, menus instant (B3, M1, S1) | needs System Settings |
| 4 | Hover sharpness by eye (A1): sidebar rows, toolbar text menus, Settings buttons thicken without growing | judged by eye with a real pointer |
| 5 | Side ruler: physical drag of the margin marker at 100/150% and in split view; hides when the sidebar floats (C5) | Codex drag inconclusive; needs a mouse |
| 6 | Gupta PubMed link in Research lookup, DOI follow and metadata fallback (B6) | network and the Gupta URL not recorded |
| 7 | Empty Projects screen in the real app (P1) | seen only in an isolated screenshot; owner's storage has projects and must not be emptied |
| 8 | Trackpad cases: sidebar short window ~1100x500 with ~25 sections, wheel scroll, no sideways drag, edge fade (A2) | needs a trackpad |
| 9 | Export files opened in Preview, Word and Pages, ideally on another Mac without the fonts (C4, C7, E1, A4 and changed margin) | needs apps and another Mac |
| 10 | Add a font through the real file picker, relaunch, remove (C2/C3/C6) | picker not reachable by script (Codex did one pass) |
| 11 | Card view at ~220 px and wide in Manuscript/Fragments/Research (A3); B1, B2, B4, G1 (Used in "Go to", Cmd+click split), E1 Cmd+Shift+E focus and Escape, P1 sort/view persistence, T251 marker + Insert image | not scripted in this run |
| 12 | Research source zones below the fold: Citation, More details closed, Used in (C1); Authors label overlap | screenshot shows only the top |
| 13 | M1 and S1 base behaviour: Research slides in on a sidebar click but not on the palette command; Settings strip pinned, Goals link scrolls smoothly | not scripted |
| 14 | T253 leftovers: Upload PDF through the picker, quit/relaunch, removal and snapshot restore; margin and top gap across a relaunch; sidebar bottom rows with content | need picker and real use |
| 15 | Typing after the blank click (the reported symptom) at 150% | scripted check reads the selection only |
| 16 | Independent review of the second blank-click fix | made by this run, unreviewed |
| 17 | Release app first launch on the owner's storage, and the 150% blank-click case there | release app not launched by rule |


## Native run r2 (2026-11-11)

Runner: agent-e8b8 (Claude Opus), T278 r2, work orders from `REVIEW-blank-click.md` (which approved both blank-click
fixes). Status: CLAIMED, never VERIFIED. Scripted in the real WebKit smoke app with synthetic events; no real mouse, keys
or trackpad. Logs: `node_modules/.cache/personal-word-beta/w9-n/r2-*`. Serial lock held for Playwright, builds and
native runs, released.

### Part 1 -- fixes in `src/editor/blankClick.ts` and its test only (sha256 after: a36218f1...)

| Item | Change | Fail-first | After |
|---|---|---|---|
| S1 | A position between blocks is moved to the nearest text (`Selection.findFrom` -1, then +1) before the TextSelection is made | new test with a real schema (posAtDOM between two paragraphs) failed: parent `doc` | passes: head 4, end of "one" |
| S2 | `.page-footnotes, .footnote-area, [role='button']` added to the ignore list | three new ignore rows failed | pass |
| S3 | two tests: Chromium (unzoomed false, zoom 1.5) and WebKit at zoom 1 never call `caretRangeFromPoint`; posAtCoords gets `{120,150}` | both fail when `scale !== 1` is mutated to `true` (mutation reverted, sha checked) | pass |

`npx vitest run src/editor`: 10 files, 132 passed (blankClick 23). Full `npm test`: 1250 passed. `npx tsc -b`: clean.
Chromium: `w9-blank-click`, `footnotes`, `pages-gap` specs on port 1438: 18 passed (`r2-playwright.log`).

### Part 2 -- MEASURE ONLY (no change to Writer.tsx or pagination.ts): phase `w9-zoom-probes`

A4 page view, sidebar hidden, true drawn zoom 1 / 1.25 / 1.5, 6 intro lines, a 3x3 table, 70 body lines (two pages).
Logs `r2-zoom.log`, `r2-zoom2.log` (the second adds the page gap placed near the window's bottom).

| Probe | Zoom 1 | 1.25 | 1.5 | Verdict |
|---|---|---|---|---|
| S4 right-click (contextmenu) in the middle table cell (`Writer.tsx:687`) | menu opens; posAtCoords = inside the cell | menu does NOT open; posAtCoords = 134, document depth, after the table, so `cellAround` fails | same as 1.25 | REAL, measured |
| S5 ArrowDown from page 1's last line / ArrowUp from page 2's first line (`pagination.ts:615`), keydown dispatched to the editor, handled by the plugin | correct both ways | correct (gap mid-window and low) | correct both ways, both placements (Up lands at the end rather than the start of line 27, still the right line) | NOT reproduced in this geometry; the handler's unzoomed lookup point still found the right line. Left for the real-arrow human check |
| S6 mousedown 8 px under page 1's last line, inside the column, on the page spacer (`pagination.ts:534`) | page 1 end; handler's local offset 8 | gap mid-window: page 1 (local 68 vs split 106.5); gap low: page 1 only just (105.4 vs 106.5) | gap mid-window: page 1 (98 vs 107.1); gap LOW: caret goes to PAGE 2's first line (local 150.4 vs 107.1; the drawn-consistent value is 5.3) | REAL, measured; depends on how far down the window the gap is |

Proposed fixes (not made):
- **S4** (`src/Writer.tsx:687-691`): after `posAtCoords`, if the position is null or `!cellAround(doc.resolve(position))`,
  use `view.posAtDOM(cell, 0)` (the clicked cell is already known). Engine-neutral; prove with the native S4 probe
  (expect the menu at 1.25 and 1.5) and the existing Chromium table-menu spec.
- **S5** (`src/editor/pagination.ts:601-626`): no change while it does not reproduce (the review's gate). If the human
  arrow check at 150 percent shows a wrong line, apply the review's drawn-px `caretRangeFromPoint` lookup at line 615.
- **S6** (`src/editor/pagination.ts:532-534`): import `reportsUnzoomedRects, totalZoom` from `../components/floating`,
  `const s = reportsUnzoomedRects() ? totalZoom(spacer) : 1;` and
  `const local = (event.clientY - rect.top * s) * (height / (rect.height * s || height));` (Chromium unchanged, s = 1).
  Prove with the S6 probe, gap low, at 1.5 (fails now), and the Chromium `pages-gap` spec.

### Part 3 -- rechecks and release

| Check | Result | Log |
|---|---|---|
| Smoke binary with Part 1 + probes (sha256 72c13ba4...) | built | `r2-build-smoke2.log` |
| Blank-click native check | 24/24 pass | `r2-blank.log` |
| Font checks across relaunch | pass; control run fails as it must (interface font, added font) | `r2-fonts.log`, `r2-fonts-control.log` |
| Release app | `npm run tauri build` 14:21-14:23, exit 0: `src-tauri/target/release/bundle/macos/Personal Word.app` (15.65 MiB), binary 2026-11-11 14:23:01, sha256 of `Contents/MacOS/folio` `2586aeee2b80906d90ef6d62ecf0bbab9632b329b2ede2f2e6c468e287c5a752` (supersedes 8587c0b2...). Contains Part 1. Not launched | `r2-release-build.log` |

Still needs a human (adds to the table above): right-click a table cell at 100 and 150 percent (S4: expected to fail at
150 today); click just under the last line of a page low in the window at 150 percent (S6: expected to land on the next
page today); real Up/Down across a page gap at 150 percent (S5); click a footnote's text at 150 percent (S2).
