# UI wave 6 -- validation record (T233, V)

Date: 2026-11-03, runs 16:45-17:35 UTC. Validator: agent-30f0 (Claude Opus). Base: `main` @ 08e9f85 plus the uncommitted wave-6 tree (T225-T232, all lane-approved). Pinned Node v22.23.3. Every run held `node_modules/.cache/personal-word-beta/serial-check.lock` and released it (phases A-E). Screen unlocked, `caffeinate -dimsu` on every native step. Logs and captures: `node_modules/.cache/personal-word-beta/ui6-v/` (scripts `phaseA.sh`..`phaseE.sh`, summaries `summaryA.txt`..`summaryE.txt`).

**Status: CLAIMED.** Nothing here is owner-verified. The hand-check sheet at the end is for the owner.

## Results

| # | Step | Result | Log | EXIT / UTC |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit -p .` | PASS (empty log) | `tsc.log` | 0, 16:45:34 |
| 2 | `npm test` (1 worker) | PASS: 68 files, 1134 tests | `unit.log` | 0, 16:46:09 |
| 3 | `npm run build`; private `vite build --outDir ui6-v/dist` | PASS | `npmbuild.log`, `build.log` | 0 / 0, 16:46:44 |
| 4 | Full Playwright, whole `tests/`, private preview on port 1918, 1 worker, no retries | **443 passed, 2 failed, 16 skipped** (skips are the env-gated screenshot cases in command-palette, sidebar-context-menu and sidebar-search) | `pw-full.log`, `report.json` | 1, 17:10:23 |
| 4r | The 2 failures rerun alone, 3 times: `motion.spec.ts:36` (a) (a clip-path animation still running at the check) and `research.spec.ts:177` (one undo removes quote and citation; the text was still there 5 s after Cmd+Z) | **PASS 3/3** (2 passed each run). Both are timing flakes, not wave-6 regressions. Neither failed in any lane run, and motion (a) is a known wave-5 flake | `rerun-1..3.log` | 0, 17:29:58-17:30:13 |
| 5 | `cargo test --locked --offline` (1 job, 1 thread) | PASS: 63 passed, 0 failed | `cargo.log` | 0, 17:13:22 |
| 6 | Every-state captures, Chromium (Amendment 1): `ui6-v/every-state.spec.mjs`, 16 cases, light + dark | **16 passed** on the final run (after harness fixes; see "Every-state list") | `states-pw3.log`, `states/results.jsonl`, `states/*.png` | 0, 17:35:00 |
| 7 | Smoke build (`touch src-tauri/src/lib.rs` first) | PASS twice. Build 1 sha `fcf1af0f...` ran native-screens 14/17 states; build 2 sha `8a98286c...` (changed: rebuild proof) carries the fixed `native-screens.js` + `native-smoke.js` (`grep -a "opening after cut"` = 1) | `smoke-build.log`, `smoke-build2.log` | 0, 17:20:18 / 0, 17:30:54 |
| 8 | `native-screens.py` Plain, light + dark | **PASS: 8 standard + 17 state captures per theme** | `native-screens-plain2.log`, `native-plain2/` | 0, 17:31:36 |
| 9 | `native-screens.py --palette color`, light + dark | **PASS: 8 + 17 per theme** | `native-screens-color2.log`, `native-color2/` | 0, 17:32:16 |
| 10 | `native-reliability.py --suite baseline` / `--suite beta` | PASS / PASS | `native-baseline.log`, `native-beta.log` | 0, 17:23:36 / 0, 17:24:53 |
| 11 | `native-smoke.py` | First run **FAILED**: `Timed out: Append to section ->`. The smoke script still clicked the fragment footer that T226 removed. Fixed in `tests/native-smoke.js` (go back to Opening and type the prose back, as T226 did for `writing.spec.ts`), rebuilt (step 7), rerun **PASS** ("Native WebView + SQLite smoke test passed") | `native-smoke.log` (fail-first), `native-smoke2.log` | 1, 17:25:16 / 0, 17:32:27 |
| 12 | `ui4-g/native-gate.py --phase pages-zoom` / `--phase pages-probe` (smoke build 1, same app code) | PASS / PASS | `gate-zoom.log/json`, `gate-probe.log/json` | 0, 17:28:30 / 0, 17:28:57 |
| 13 | Docs merge (V step 4) | Done: `docs/changelog.md`, `design-system.md`, `limitations.md` (o, p, s, t, u moved to Part 2 as fixed 2026-11-03), `user-guide.md`, plus a wave-6 paragraph in `docs/architecture.md`. `notes/T2.md` selector wording corrected against `library.css:127` | `git diff -- docs/` | -- |
| 14 | Release build (`touch src-tauri/src/lib.rs`, `npm run tauri build`) | PASS | `release.log` | 0, 17:33:58 |

**App (V build, superseded by R's rebuild, see R reruns):** `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`. `Contents/MacOS/folio` is 16,289,824 bytes, built 2026-11-03 17:33 UTC. **sha256 `7bf6e6953a2e792cdfd14a6ad4f93510a00674b64ef707fe4300b15ed78e6009`** (same as `target/release/folio`; differs from wave 5's `3c4a01f7...`). Bundle id `com.folio.writing`, name Personal Word. Smoke markers in the binary: `smoke_snapshot` 0, `native-screens` 0, `com.folio.smoke` 0, `FOLIO_SMOKE` 0. `git diff -- src-tauri` is empty.

Files V changed: `tests/native-screens.js` (17 every-state captures, run after the existing ones so those are unchanged), `scripts/native-screens.py` (accepts and copies them, exits 1 if any is missing), `tests/native-smoke.js` (fragment-footer step), the docs above, `notes/T2.md`, this file. No `src/` file was touched.

## Every-state list (Amendment 1)

Native = macOS WebKit smoke app, 1240x840 window, light + dark, Plain + Color (4 captures per state, `native-plain2/` and `native-color2/`). Chromium = `states/`, light + dark. Native cannot move a real pointer, so previews and the project row use keyboard focus, the palette uses its own arrow keys, and the dock gets a synthetic pointermove.

| State | Chromium | Native | Verdict and what was seen |
|---|---|---|---|
| Long command highlighted in the palette | PASS: wraps to 2 lines inside the row, text ends 86 px before the row edge | PASS: same wrap | PASS. The label *box* runs 4 px past the palette because of the 4 % grow, but no text does |
| Every hinted command highlighted (latent 4 px hint overlap) | PASS: 6 hinted commands, tightest gap 378 px | not captured | PASS. The overlap needs a long *hinted* label, and no hinted command is long today. Latent only |
| Long project name hovered/focused, 1100 and 1600 | PASS at both (name ellipsizes, trash clear of name and dates) | PASS at 1240 (focus ring, trash in its own slot) | PASS. **But the project tab bar clips the long name at its start ("...at should never run under the date"), with no ellipsis** -> F |
| Long section / note / source titles at the 190 px sidebar | PASS: every row fits or ellipsizes | see verdict | **ISSUE for F:** titles shrink to 3-4 letters beside the word count ("Ope...", "A ve...", "Only..."), headings to "Manuscr...", "Fragme..." |
| Rail preview card, long section | PASS: inside the sidebar, clear of the document | PASS: card 20-155 px, inside the sidebar, no spill | PASS |
| Rail preview card, long source | PASS | text: full title, then "title -- River Press -- 202..." | **ISSUE for F:** the card repeats the title and cuts the year mid-number. At 190 px the card is 135 x 278 px |
| Rail preview card, long note | PASS (shows the note's words) | title cut mid-word at 70 characters with no ellipsis ("...of any narro"), then the same words repeated as the preview | **ISSUE for F:** doubled text and a mid-word cut. The rail line's accessible name has the same cut |
| Notes tab with no notes | PASS: "No notes yet.", no hint, Add note visible | PASS | PASS |
| Notes tab with two notes | (lane spec T228) | PASS: exactly one divider between the notes | PASS |
| Rail group with 0 items (Fragments) | PASS: no lines; group heading only | PASS | PASS for the rail. **Observation for F:** an empty Fragments or Research group shows only its heading, with no empty text. Also an unexplained 2 px `scrollWidth` excess (247 vs 245) with no child past the edge and nothing visible: cause unknown |
| Rail group with 1 item | PASS: 1 line | PASS: 1 line | PASS |
| Project with no research | PASS: panel shows "No sources yet..." | PASS (the fixture already had one manual source; the panel text is right) | PASS |
| Source with no title or year | PASS: line "Berg -- Untitled source", card "Berg -- Untitled source" (no "undefined", no dangling "--") | PASS: same | PASS. CSL import *rejects* an untitled item ("Invalid items skipped"), so the state is reachable only through Enter manually |
| Toast raised while the citation card is open | PASS: toast left of the card, inside the window, card clear of the sheet | PASS: toast 488-848, card 864-1224 | PASS for card/panel. The toast does cover the bottom of the page sheet (by design: toasts float) |
| Split view with the rail | -- | PASS: lines idle/active/open as expected | PASS |
| Toolbar at rest and scissor at 1.5x (T3 blur) | -- | at rest and at 1.5x the scissor and comment icons look equally sharp at 2x device pixels (`crop-toolbar-*.png`) | PASS (my reading). Owner to judge by eye |
| Cmd-Shift-X with a bare cursor | PASS: the cursor's paragraph becomes the one fragment, the other stays | -- | PASS |

Also seen in native captures, outside Amendment 1's list (for F): with the Research panel open at 1240 px, the header's entry title is cut mid-word ("...river c") with no ellipsis, running into "* Unsaved edits", and the header's download button is clipped at the panel edge (`native-color2/state-notes-two-light.png`, x ~ 1100 CSS px).

Capture sweep: every PNG in `native-plain2/`, `native-color2/` and `states/` was also read by a helper. Its per-file verdicts are summarised under "Capture sweep" below.

## Review follow-ups from HANDOFF "Also check"

- T229 native shrink-to-fit and zoom correction: gates pages-zoom and pages-probe PASS natively. The floating-sidebar and floating-card captures (page 50 %) are clear of the sheet. Continuous 125/150 %, 1080-1100 px continuous (16 px gap) and split page-view floating: **not checkable natively** (fixed 1240 px window); Chromium specs pass. -> owner hand check.
- T3 dock blur: native capture above. Design-system dock 24 px note added.
- Extra Tab stop per rail line: documented in limitations and the user guide. No spec counts sidebar Tab presses (writing and sidebar-selection specs pass). -> owner hand check.
- Cmd-Shift-X path: Chromium every-state case PASS.
- Latent palette overlap: not reachable with today's commands (see table).
- `notes/T2.md` selector wording: corrected.

## Capture sweep

A Sonnet helper read the capture folders (126 unique PNGs; the flat `native-*2/<name>-<mode>.png` files are byte-identical to the nested `<mode>/screens/` copies). Honest coverage: 74 viewed directly. Most `native-plain2/state-*` files hit an image-request limit and were judged from their `native-color2` twins (same layout, only tints differ), which V also read in part. It found no "undefined", no dangling "--", no grey box behind any sidebar icon and no dark-mode colour mistake. It confirmed V's issues (preview cards: doubled title, mid-word and year cuts; 190 px truncation; tab-bar clip; empty groups with heading only) and added:
1. The header entry title is cut mid-word with no ellipsis whenever the Research panel is open ("...river com"), and in `state-notes-two` the download icon is sliced at the panel edge (`native-color2/state-no-research`, `-notes-empty`, `-notes-two`, `-sources-import`).
2. Toasts cover the footer word count (y ~ 796 native), not only the page sheet. This is seen in most native state captures because earlier toasts are still up (fixture artefact), but the overlap is real.
3. Rail preview cards cover the sidebar rows under them, including the very row the untitled-source card describes. Card placement differs a little between native (keyboard focus) and Chromium (hover).
4. Stale toasts leak into later captures ("Selected sources added." on the Projects screen). Fixture artefact only.
5. The palette covers the lower half of the toolbar row while open (probably by design).
6. `states/palette-hints-light.png`: the unfiltered palette list ends on a "Destinations" group heading with no visible item under it (it may be scrolled; unconfirmed).
7. The disabled "Look up" button shows a grey filled box in the Sources tab (minor; disabled-state styling predates wave 6).
Settings capture: the breadcrumb still reads "Manuscript" while Settings is open (minor, pre-existing).

## Owner hand-check sheet (new app above; one line per Definition-of-done bullet)

1. Palette (Cmd+Shift+P): arrow up and down. The highlighted row's shortcut stays exactly where it sits unhighlighted, and the left and right padding look equal.
2. Settings: the column is centred. "Reveal sidebar on hover" and "Floating sidebar and research" sit under **Sidebar** (Project settings: with Show Read/Comments/History; Projects-screen gear: their own Sidebar section).
3. Scissor and comment: put the cursor in a paragraph with nothing selected. Both are clickable and act on that paragraph, and both magnify with the dock. On an empty paragraph they are disabled.
4. Projects list: hover each row, including one with a long name. The trash never sits over the name or dates.
5. No "Give these words a home" panel anywhere (fragment open, unsplit).
6. Notes tab: no "Ideas and reminders" text. Two notes show one line between them, never stacked.
7. Toolbar icons at full magnification (hover slowly across the bar) are as sharp as at rest.
8. Sidebar at 190, 240 and 390 px, Plain and Color, light and dark, pinned/unpinned/floating: no filled box behind any hover icon, icons never over a label, word counts visible at 190. Judge whether "Ope..."-style truncation at 190 is acceptable.
9. Line rail: click a line (opens it), hover or Tab to a line (preview card with title and first words), the open item's line is longer, spacing even, works in split view. Judge whether the extra Tab stops are wanted.
10. Rough edges o, p, s, t, u: with floating on and Research open as a panel, widen the window and the card takes over. A toast never covers the card or panel. The floating Research list never runs behind the bottom rows.
11. Floating limits not checkable natively: continuous view at 1080-1100 px (floats only if clear), continuous 125/150 % on a wide window, page 125 % (never floats), split view (never floats).
12. Native persistence (carried from waves 4/5): reorder two fragments/sources/notes, Cmd+Q, reopen; the order holds.

## R -- repairs from FABLE-REVIEW.md (T235)

Repairer: agent-30f0 (the same Opus session as V; PLAN said one Sonnet worker per finding group, but the six fixes were a few lines each in four files, so they were done directly, under T235 with the files registered). Logs: `node_modules/.cache/personal-word-beta/ui6-r/`.

| Finding | Disposition | Change |
|---|---|---|
| 1 source preview repeats the title, cuts the year | FIXED | `App.tsx` collectionItems: a source's `preview` is its container, journal or publisher only (`""` when none), so the card shows the summary title once and never a cut year. `tests/scrollspy.spec.ts` T7b card case now asserts the title and no repeated body. Docs wording in design-system and architecture updated |
| 2 note preview doubled, title cut mid-word | FIXED (both parts) | (a) `App.tsx`: note title is `previewText(n.text, 70)` (real ellipsis, also the row title and the "Go to ..." name), `preview` is the text only when longer than 70, else `""` (keeps the kind out of the card). (b) `SpyRail.tsx`: when the preview starts with the title, it is shown once in the title slot and the body is dropped |
| 3 toast moved left of the card lands on the sheet | FIXED | `App.tsx` T5 region: the toast moves left of the card only when the card reaches the toast's band (card bottom + 16 > window height - 16 - 80, measured when a toast appears); otherwise it stays in the corner. `tests/floating.spec.ts`: the T5 card-toast spec now asserts no overlap with the card *or* `.editor-paper`; a new short-window spec (1600x420) asserts the toast sits left of a card that reaches the corner |
| 4 tab bar clips a long name at its start | FIXED | `styles.css` `.project-tab > button:first-child`: `display: block; min-width: 0; text-align: left`. The first try (min-width only) did not work: the base `button` is `inline-flex` + centred, so the name still started 131 px left of the button (`ui6-r/r-checks.log`, the fail-first); `display: block` fixed it |
| 5 header title cut mid-word, download sliced with Research open | FIXED | `styles.css`: `.topbar > div:last-child { flex-shrink: 0 }`; `.breadcrumb li { overflow: hidden }`; `.breadcrumb-title` block + `min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` |
| 6 docs say "Chromium only / native pending"; SPY_RADIUS; unsupported Read-mode sentence | FIXED | `changelog.md`, `design-system.md`, `limitations.md` now say what native covered and what stays Chromium-only/hand-check; `SPY_RADIUS` 84 vs `RAIL_RADIUS` 36 corrected; the Read-mode rail sentence removed |
| 7 190 px truncation | OWNER RULING (hand check 8) | not changed |
| 8 empty groups show only a heading | BACKLOG | not changed |
| 9 preview card can extend above the list top | BACKLOG | not changed |
| 10 toasts cover the footer word count | BACKLOG | not changed |
| 11 toast offset with a wide panel on a narrow window | BACKLOG | not changed |
| 12 native-screens.py total count ignores state captures | BACKLOG | not changed (cosmetic; the per-theme "states 17/17" line and exit code are right) |
| 13 sweep coverage note | NO ACTION | -- |

Fail-first (against V's pre-repair build `ui6-v/dist`, port 1921): `floating.spec.ts` "toast ... never covers the card or the sheet" FAILS (toast intersects `.editor-paper`); `scrollspy.spec.ts` T7b card case FAILS (`.spy-card-text` count 1, expected 0); the new short-window spec passes there too (a guard: the old code always moved the toast left). Logs `ff-floating.log`, `ff-scrollspy.log`.

### R reruns

| Step | Result | Log | EXIT / UTC |
|---|---|---|---|
| tsc; unit; `npm run build`; private build (first pass, after repairs 1-6) | PASS; 1134 unit | `ui6-r/summary.txt` | 0, 17:54-17:55 |
| Full Playwright once (App.tsx and styles.css changed), port 1920 | 444 passed, 2 failed, 16 skipped. `motion.spec.ts:36` is the known flake. **`scrollspy.spec.ts:623` was a real regression from repair 2(b)**: the dedupe also fired for a *section* whose text starts with its title ("Gamma part" / "Gamma part line 0..."), so its card lost the bold title. Fixed: `SpyRail.tsx` now dedupes only when the title is a cut-short copy (ends in "..."), so section and source cards keep title + text | `ui6-r/pw-full.log` | 1, 18:17:43 |
| After that fix (fresh build): tsc, unit, both builds | PASS | `ui6-r/summary2.txt` | 0, 18:19-18:19:55 |
| Affected specs: scrollspy, floating, research, sidebar-selection, split-view, projects-screen, alignment | **180 passed, 0 failed** | `ui6-r/pw-affected.log` | 0, 18:26:56 |
| `motion.spec.ts:36` alone x3 | PASS 3/3 | `ui6-r/motion-rerun-*.log` | 0, 18:27 |
| Every-state Chromium spec (16 cases) | **16 passed** (V's captures kept in `ui6-v/states-V/`; R's overwrite `ui6-v/states/`) | `ui6-r/states-pw.log` | 0, 18:27:50 |
| Release build (`touch src-tauri/src/lib.rs`; `npm run tauri build`) | PASS. **New sha256 `e93d7a0569a5a85ef26bc19a6fc10caa9c8ad59ceff29f8329673049fb628e41`** (16,289,824 bytes, 18:29 UTC); smoke markers all 0. **V's `7bf6e695...` is superseded** | `ui6-r/release.log`, `ui6-r/summary3.txt` | 0, 18:29:35 |
| Native smoke build, native screens Plain + Color, native smoke (the smoke build compiles the current source, tab fix included) | **NOT RUN YET: the screen locked at 18:27 UTC.** `ui6-r/phaseR3.sh` waits (up to 6 h, without holding the serial lock) for an unlocked screen, then runs them and writes the results to `ui6-r/summary3.txt` | `ui6-r/summary3.txt` | pending |

| R checks for fixes 4 and 5 (new every-state cases "R: ..."): tab shows its start + ellipsis; with Research open at 1240 px the header title ellipsizes inside the breadcrumb and the export button is whole (32 px, inside the bar) | first run: header PASS, tab FAIL (see finding 4); after the tab fix: **4 passed** | `ui6-r/r-checks.log`, `r-checks2.log` | 0, ~18:45 |
| After the tab fix: tsc; `hoverEmphasis`/`designTokens`/`motion` unit; private build; alignment, features, projects-screen, hover-emphasis, appearance specs | PASS; **89 passed** | `ui6-r/summary4.txt`, `pw-tabfix.log` | 0 |
| Release rebuilt again (styles.css changed) | PASS. **sha256 `ef6a58fcb1459463739a973f4f80dde7920052cba5946da8078db5810dadfe0d`**; smoke markers 0. Supersedes `e93d7a05...` | `ui6-r/release2.log`, `summary4.txt` | 0 |

**App (current):** `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`, sha256 `ef6a58fcb1459463739a973f4f80dde7920052cba5946da8078db5810dadfe0d`.

Owner hand-check additions after R: (13) hover a long note's and a long source's rail line: the card shows the words once, the year is not cut. (14) Open a project with a long name: its tab ends in "..." and shows the start of the name. (15) With Research open at a 1240 px window, the header title ends in "..." and the download button is whole. (16) With floating on and the citation card open, take a snapshot: the toast stays in the bottom-right corner, off the page and the card.

## Native recheck after R (2026-11-03, 22:25 UTC)

Run on the R source with the Mac idle. Logs: `node_modules/.cache/personal-word-beta/ui6-r/rerun5/`.

| Check | Result |
|---|---|
| Native screens, Plain | PASS, states 17/17 light and dark |
| Native screens, Color | PASS, states 17/17 light and dark |
| Native smoke | PASS |
| Release app | Unchanged, sha256 `ef6a58fc...`; the test edits below compile only into the smoke build |

Earlier runs failed while the owner was using the Mac and the test window was behind another app. Same build, same run: all 4 rail preview cards failed with `windowFocused=false` and passed once the window had focus, so the cards are not an app bug. `state-palette-long` also failed once with the window focused. It stopped failing after the test waited for the Save dialog to close; the cause (shortcut pressed while the dialog was closing) is inferred, not proven.

Harness changes: `tests/native-screens.js` records window focus on failure and waits for the dialog before the palette key; `src-tauri/src/smoke.rs` keeps the screens window focused during a run (smoke feature only). Known cost: test windows take the front on the active monitor, so run with the Mac unattended. cargo tests were not rerun after this smoke-only edit.

## Owner change after hand check (2026-11-03): rail preview card removed

The owner asked for the box to go (screenshot: "Chacha" card over the row's word count). `SpyRail.tsx` no longer shows a card on hover or focus; the lines still jump on click, Enter and Space. Hand checks about the card (item 9's preview, item 13) no longer apply. The 4 `state-preview-*` native captures are gone, so native screens now expect 13 states. New test `scrollspy.spec.ts` "shows no preview card" failed on the old build before the removal.

Final run after the removal (Chromium, tsc, unit; native not rerun): tsc 0; unit 1134 passed; Playwright 442 passed, 2 failed, 16 skipped. `performance.spec.ts:170` is machine timing (28 ms against a 25 ms budget) and passed 3 of 3 alone. `research.spec.ts:177` is a real, older bug, not a flake: a captured quote's footnote can come out empty. It failed 3 of 8 on the wave 5 build and 6 of 8 on this one (small samples). The footnote renders with no citation, which from the code suggests the source is missing from `data.sources` at that moment; root cause not proven. OPEN, listed as a known issue in the release notes.
