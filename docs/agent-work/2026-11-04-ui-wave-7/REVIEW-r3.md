# REVIEW r3 -- T236 and T237, targeted re-review

Reviewer: agent-f8b6 (Claude Opus). Date: 2026-11-04. Scope: only what round 3 changed. Everything marked held up in `REVIEW-T236-T237.md` stays settled and was not re-audited.

- **T236: APPROVE.** No defects. Status: CLAIMED (Chromium only).
- **T237: REJECT, one firm and small.** The app behaviour is right. The padding change makes 2 tests in the full suite fail every time, and the done note says no other spec depended on the old width. Fix the tests, not the CSS.

Evidence is Chromium with real Futura, from one private build: `node_modules/.cache/personal-word-beta/ui7-rv-r3`, port 1942. Logs: `run.log`, `full.log`, `rerun.log`, `bisect.log`. Probe numbers: `art/audit-first.log`, `art/audit-second.log`, `art/audit-third.log`, `art/audit.log`. Probes: `r3-first.mjs.txt`, `r3b.mjs.txt`, `r3c.mjs.txt`, `audit/r3d.spec.mjs`. No source or test was edited. Nothing here is native WebKit.

## Suite

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm test` | 68 files, 1137 passed |
| Full Playwright, one fresh build | 475 passed, 2 failed, 16 skipped (22 min) |

| Failure | Alone, 5 runs | Same bundle with only the padding rule removed, 3 runs | Board owner | Cause |
|---|---|---|---|---|
| `tests/markdown-roundtrip.spec.ts:190` | failed 5 of 5 | passed 3 of 3 | unowned | T237 N2 |
| `tests/markdown-roundtrip.spec.ts:379` | failed 5 of 5 | passed 3 of 3 | unowned | T237 N2 |

The previous review's full run (`ui7-rv-de/full.log`) passed both. The known flakes ci-indent:227, sidebar-context-menu:319 and performance:170 did not fail this time.

No file under `src/` or `tests/` is newer than the build. The `git diff` hash did change between build and end of suite. I infer that is board traffic in `team/`; I did not diff the two states.

## T237: the defect

**R3-1 (firm). The 8 px padding removal breaks `buildRichProject` in `tests/markdown-roundtrip.spec.ts`.**

The helper runs `editor.getByText("Closing paragraph with second note").click()`, which clicks the centre of the paragraph box, then presses End. The wider column moved that centre onto the footnote marker. Measured:

| Bundle | Click x | Marker x | After click | After End |
|---|---|---|---|---|
| Tree (padding 0) | 855 | 851 to 859.7 | node selection on the footnote | still node selection |
| Padding restored | 855 | 859 to 867.7 | text caret | caret at paragraph end |

In the failing export, the image sits where the marker was and `[^2]` is gone: "Expected substring: [^2]: Single note B."

Fix: in that helper, click so the position cannot land on the marker, for example near the start of the line. The test file is unowned, so register it. Keep the CSS: the first glyph on the marker is right and holds up below. A click position that depends on column width is the fragile part. Rerun the whole suite, not a chosen subset.

**R3-2 (same pass, small). Two test weaknesses in `tests/ruler.spec.ts`.**
- `caretTop` reads `getClientRects()[0]` of the collapsed DOM range. At a soft wrap that rect can be the end of the previous line. At 150% page view this read 26 of 110 moves as hidden, while `view.coordsAtPos(head, 1)` read 0 of 110 at 1440 and 1900 wide. The test passes today at 100%, but a different font could trip it, which matters because CI has no Futura. Use `coordsAtPos` through `el.editor.view`.
- "caret scrolling with the ruler off keeps the default margin" never asserts the margin and never turns the ruler on first, so it would still pass if defaults were not restored. Assert `view.props.scrollMargin` is 5 and `scrollThreshold` is 0 after on then off. Remove its `console.log("SCROLLTRACE ...")`.

## T237: what held up

**The scrollMargin effect in `src/Writer.tsx`.**
- Top margin and threshold equal the measured ruler height plus 5, per pane. Measured: 23 at 75%, 29 at 100%, 41 at 150%, 35 at 125%, 38.47 at 150% page view scaled to fit 1440, 19.64 at 800 wide.
- Ruler off restores 5 and 0. Coming back from Settings re-applies it. Closing a split pane keeps the other pane's values. No page errors.
- Changing one pane's props leaves the other pane's alone.
- No scroll jump on toggle: the same paragraph stays at the same screen y (220 continuous, 258 page), on and off, with and without the caret in the editor. `scrollTop` moves by exactly the ruler's 24 px, which is scroll anchoring doing its job.
- True caret position by `coordsAtPos`, 110 ArrowUps: 0 behind the ruler in page and continuous at 100 and 150. Screenshot `art/g1-hidden.png` shows the caret's line right under the ruler. It was named when I suspected a defect, and that suspicion was wrong.
- DOM-range loops, read with R3-2's limit in mind: 0 hidden at 75 and 100 (both views), continuous 150, page view at 125 and at 800 wide, the right split pane, and page view under 4x CPU throttling. Not hidden after typing at any zoom I measured.
- Comment-style jump (`setTextSelection().scrollIntoView()`): caret 5 px below the ruler.
- Read has no ruler and no ProseMirror on that path; its section jump works.

**The new tests are real.** Setting the defaults on a live editor under a shown ruler gives 6 of 80 hidden in continuous and 5 of 70 in the right split pane, worst 24 px, so the caret test can fail. The glyph test's fail-first is in the worker's logs, and my old-padding injection reproduces 8 px.

**The padding removal.**
- Column 624 px at 1440 and 1100, first glyph offset 0, footnote area flush with the text on both sides, no horizontal scroll, nothing spills (list, quote, heading, long URL, table).
- Narrow windows: at 900 and 700 the column follows the pane (434, 234) and the paper keeps its margin. Spill appears only where the column reaches 0 width (420 wide with default margin, 560 wide with a 2 inch margin). Both are below the app's 850 minimum window and the outer box is unchanged, so this is not new.
- Smallest margin (24 px): text stays 24 px inside the paper at both 1440 and 560, so it never touches the edge. Selection runs from 471 to 1239 inside a 447 to 1263 paper, light and dark (`art/margin-min-selected-dark.png`).
- Split panes: paper 581, column 389, no overflow.
- Floating mode measures the `.writing-surface` box, which did not change size, and its specs pass.

## T236: verified

- **split-view:881 and :891 assert 500: the worker is right and the earlier "700" in the handoff was a misread.** At :881 the open panes are manuscript and fragments, so research is unlit; at :891 the right pane is closed, so fragments is unlit. 700 is asserted on the lit headings just above (:876 to :878 in the worker's numbering). Rows assert 400.
- **1.04 and stroke checks** are back on hover and focus, and pass.
- **Nothing-lit tests** (Comments, Read manuscript, Bibliography click then leave) each assert the heading is lit first, so they prove the page changed. Bibliography's fail-first is in the worker's log.
- **`:has(:focus-visible)`**, all four palette and scheme combinations: rest `--muted`; hover `--text` with stroke; clicked and left dim unless open; keyboard focus `--text` with 1.04 and stroke; focus moving to the row's own Open beside button keeps the row lit, which is right. Bibliography after click: dim, all headings 500.
  - Note, not a defect: pressing any key (even Shift) after that click lights the focused row, because Chromium then treats the focus as keyboard focus. That fits the "keyboard focus" clause. WebKit may differ: T240.
- **Split divider:** the same gradient at rest, hover, mouse down, mid-drag and focus. Rest and hover screenshots are pixel-identical. It moves by drag and by arrow key. Outline is solid on keyboard focus and none after the mouse moves away. `art/div-drag.png` shows the line during a drag.
  - Small gap: the worker's note says the test asserts the line on focus, but the test only checks the outline there. Measured correct by hand. Not worth a rejection.
- **AGENTS.md:** "never a fill" restored; the bullet matches measured behaviour.

## Could not verify

- Native WebKit for all of it, including `scrollMargin` under CSS zoom. T240.
- Focus mode exit restoring the ruler's margin: my probe did not get out of focus mode. Entering restores defaults (measured). Exit relies on `focusMode` being in the effect's dependencies (read, not run).
- A comment highlight's edges: the probe found no mark element. Inline marks stay inside the text column, which is measured; the highlight itself is not.

## Owner's call, not defects

- Ruler toggle location: Page setup (keyboard reachable) versus the toolbar.
- Margin presets: left for the owner to settle.
- Continuous column 608 to 624 px rewraps some lines in existing documents.

## For the coordinator, outside these tasks

The failing test shows a path worth a look: with a footnote marker node-selected, End does not move the selection, and the image that follows ends up where the marker was, so the note is gone from the export. Clicking a marker gives the same node selection with or without the padding change, so this is not T237's bug. My own direct reproduction stopped earlier, because the Insert image click timed out in both bundles with the marker selected. So the loss is seen only through the test, and whether a real user hits it is unknown. I did not add it to either task.

## Round 4 (agent-1af6): T237, tests only

**Verdict: approve.** R3-1 and R3-2 are fixed. App code was not re-audited, as briefed. Runs are in `node_modules/.cache/personal-word-beta/ui7-rv-r4/run.log`. The real `src/Writer.tsx` and both spec files hash the same before and after my runs.

**`buildRichProject` click (R3-1).**
- The diff is the one click line and its comment. No assertion changed, including `[^2]: Single note B.`
- The marker sits at x 308 to 317 in a 624 px paragraph, so the old centre click (312) landed right on it. That confirms the cause in REVIEW-r3.
- Probe with the same steps on a clean build: after click and End, the selection is a text caret at 96, the paragraph's end is 96, and the paragraph is "Closing paragraph with second note." End does reach the paragraph's end.
- The paragraph is one line (30 px tall), so End cannot stop at a soft wrap. The probe's "2 lines" count is the raised marker's own rect top.
- A read taken straight after the click still showed the old selection (the heading, position 1). I read that as ProseMirror not yet having handled the click (inferred). The End result is the one that matters.
- The export and zip import tests (now :192 and :381) passed 3 of 3 each. REVIEW-r3 had them failing 5 of 5, so the test still proves what it did.

**`caretTop` with `coordsAtPos(head, 1)` (R3-2).** Mutant in a copy of the tree (`ui7-rv-r4/tree`), one line: `const height = 0;` in the scrollMargin effect, which disables the margin.
| Test | Mutant | Clean build |
|---|---|---|
| N1 caret, continuous | fails, 10 of 110 hidden | passes |
| N1 caret, pages | fails, 12 of 110 hidden | passes |
| Ruler off | fails at the ruler-on check, top margin 0 | passes |

The new measure still catches the bug, in both views.

**Ruler-off test.**
- It turns the ruler on and asserts top margin above 5, then turns it off and asserts margin 5 and threshold 0. `SCROLLTRACE` is gone.
- The mutant proves the ruler-on half can fail. The restore half was not run against a mutant: it is read only, and an exact match on 5 and 0 straight after a value above 5 can only pass if the defaults come back.

**`full.log`.**
- 477 passed, 16 skipped, 0 failed, `PW_RC=0`, 493 tests in all. No `✘` lines.
- Built from the current tree: a fresh build of the real tree into my scratch folder is byte-identical to `ui7-e/dist` (`diff -rq` empty).
- Nothing in `src/` or `tests/` is newer than that dist, and the run began after the spec edits (06:41 edits, 06:42 build, 06:44 run).

**Note, not a defect.** The same helper's first click, on "First sentence with a note", is still a centre click. Its marker is at x 213 to 222 against a centre of 312, so it is safe at this width by about 90 px. It would only become the same bug if the text or column changes a lot. Left as is, because R3-1 did not ask for it.

**Not verified.** Native WebKit (T240). The open question in REVIEW-r3 about a selected footnote marker losing the note on image insert is still for the coordinator.

## T241 (agent-8f61): rejected, on reading alone

**Evidence limit.** Nothing was run. My probe waited 15 minutes for `serial-check.lock` (07:20 to 07:35), which agent-3100 (T240 chromium) held the whole time, then gave up without building (`ui7-rv-241/probe.log`). I did not touch the lock. Everything below comes from reading the code and the worker's logs, and no computed style was measured by me.

**Defect: the second rule puts the box back on zoom, paragraph style and font when the More menu holds them.**
- `.writer .format-bar .toolbar-popover .dropdown-button` matches every dropdown inside any toolbar popover, and the More menu is one (`PanelButton` with `isMore`, class `toolbar-popover is-more`).
- `OVERFLOW_ORDER` (`src/Writer.tsx:130`) includes `font`, `paragraph` and `zoom`, and the More panel renders hidden groups through `renderGroup(group, true)`. The screenplay dropdown is in the `paragraph` group, so it moves with it. The `.toolbar-popover.is-more .dropdown` rule (`editor.css:304`) exists for this layout.
- The new test shows the More popover sits inside the format bar: it reaches Page setup through More, and the broad `.format-bar` rule stripped those boxes (0px in `fail-first2.log`). So these triggers match both rules, and the later, more specific one wins: 1px box.
- This is a regression from T241: under the broad rule alone they were borderless in More. The owner asked for no boxes on these three controls.
- Inferred, not measured: the window or pane width at which these groups overflow. They are the last to overflow, so it takes a narrow bar (a narrow window or split view).

**Suggested fix (one selector).** Use `.writer .format-bar .toolbar-popover-body .dropdown-button`. Paper size and Page margins sit in `.toolbar-popover-body` (`Writer.tsx:1819`). More-held groups are direct children of the More popover with no body wrapper. Page setup opened from More still matches, because its own body wraps the fields. Not tested.

**Test gap.** Add a case that narrows the bar until the triggers are in More, opens More, and asserts 0px on zoom, paragraph style and font, plus the screenplay dropdown under the Screenplay template. The existing "draw no border" test only looks at the 1280 px bar, which is why this passed.

**What held up (reading).**
- Original box: the `HEAD` rule was height, padding, `1px solid var(--line)` and radius 0. The new rule inherits the rest from the rule above, with the same `border-box`, so Page setup's box should match.
- Hover, focus, open: no rule in the format bar changes the border in those states. Focus is the outline from `dropdown.css`. Hover is the shared emphasis rule.
- Dark mode: same `--line` token as the original, so it follows the theme.
- Other popover dropdowns: `Writer.tsx` has six `Dropdown`s (zoom, paragraph, screenplay, font, Paper size, Page margins) and `src/editor` has none, so only Page setup's two are meant to get the box. I did not trace components imported into the other panels.
- Three triggers on the bar itself, including screenplay: not inside a popover, so `border: 0` applies.

**The test is real, but narrow.**
- `fail-first2.log`: this test alone fails, with 0px on all four sides, 1 failed and 20 passed. `final.log`: 21 passed, `PW EXIT 0`.
- `fail-first.log` was an earlier attempt that failed on a click timeout, not on the border, so it is not fail-first evidence. `fail-first2.log` is the valid one.
- It checks widths only, not border colour or style, and only at 1280 px through More. Page setup opened directly from a wide bar is covered only by the shared selector.

**Not verified.** Any of this in Chromium or native WebKit.

**Scope call for the coordinator.** This rejection reads "top bar" as including these controls when the More menu holds them, as the review brief asked. If you read it as the visible bar only, T241 can be approved as it is.

## Final (agent-499c, Claude Opus): T241 and T240

- **T241: APPROVE.** Status CLAIMED (Chromium only).
- **T240: REJECT, small.** The results table is honest and the docs are now right, but the record `VALIDATION.md` has one wrong hand-check step and stale lines. Exact replacements are below. They take minutes and need no rerun.
- T242 stays open. Advice for its runner is at the end. Nothing was approved or rejected there.

Evidence: one private build from the current tree, `node_modules/.cache/personal-word-beta/ui7-rv-final`, port 1944, under the serial lock. `run.log`: `tests/editor-toolbar.spec.ts` 17 passed, PW exit 0, no file in `src` or `tests` newer than the build. `probe.log`: read-only widths probe, 8 passed. No native step ran. No source or test was edited.

### T241

| Question | Result |
|---|---|
| Page setup keeps its boxes | Yes: `1px solid` in `--line` on Paper size and Page margins, measured at 1900 (from the bar), 1280, 850, 700, 600 (from More) |
| Triggers borderless in the bar | Yes: spec at 1280, plus the screenplay dropdown at 1280, 0 px by probe |
| Triggers borderless in More when narrow | Yes: spec at 460 for all three, plus the screenplay dropdown in More, 0 px by probe (not in the spec) |
| Other panels wrongly boxed | No. All six `Dropdown`s in `Writer.tsx` are read: four in the bar groups (lines 1248 to 1321) and two in Page setup (1822, 1837). The other `.toolbar-popover-body` panels hold none |
| Narrow test real | Yes. `failfirst2.log` ran against the 07:43 pre-fix dist (`job3.sh` runs it before `build2`): Editor zoom expected 0px, received 1px. `measure2.log` shows 1px on all three on that build. The final test has the same loop |

**Removal of the Page setup step from the narrow test: acceptable, but the stated reason is incomplete.** The wide test does cover the rule. The step was removed because it timed out (`final2.log`). My probe shows why: at 520 and 460 px the More menu's Page setup row is covered by the sidebar's Settings group, so a click never lands. At 600 and up the row works. This is below the 850 px minimum window, so it is not reachable by resizing the window, and it is not caused by T241's CSS. Not investigated: whether a narrow pane at a legal window size can reach the same overlap. Worth a line for the coordinator, not a defect here.

Not verified: native WebKit, which draws the same computed rule but has not been looked at.

### T240: results table against the logs

Every line matches its log: `tsc.log` empty; `unit.log` 68 files, 1137 passed; both builds exit 0; `pw-full.log` and `report.json` 478 passed, 16 skipped, 0 unexpected, 0 flaky, 22.3 min, port 1939; `cargo.log` 63 passed, 1 ignored; `release-summary.txt` exit 0 and the sha quoted. Native is stated as not run, in the header, the table and all ten items of the native list, and no native log exists in `ui7-v/`. Nothing is overstated there.

### T240: why rejected (`VALIDATION.md` only; outside the `docs/*.md` I may edit)

1. **Hand-check 12 sends the owner the wrong way (firm).** "open a source, press Cite here" goes through the sidebar source row, which sets `fullResearch` (`App.tsx:2243`), so it opens the ordinary Research panel. That panel's Cite here focuses the footnote field by design (`limitations.md`). The owner would see a failure that is not one. Replace with: "Cite here: with floating on, in a window wide enough that the card shows, click the Research heading, choose Enter manually, press Cite here. The cursor should be in the card's Page field, not in the footnote."
2. **Line 39 "expect 13 states" is wrong now.** `native.sh` and `native-screens.py` now require 26. Replace with "expect 26 states".
3. **Line 22 "no ruler or topGap coverage" is out of date.** True when written. Replace with: T242 has since added these states; written and compiled, never run.
4. **Line 78 "before T241" is imprecise.** `pw-full.log` includes the round-1 test ("keep their 1 px box") and passed, so the full run had T241's first rule, with the bug in More, and not the fix. Say so, and point to `ui7-rv-final/run.log` for the toolbar spec on the fix. The full suite has not rerun on the final rule; only a one-selector CSS change separates them.
5. **Release section is stale.** `Contents/MacOS/folio` is now `cdb427169c13736a...` (07:58 local, coordinator's rebuild, `release2.log`), not the quoted `0a43b22b...`. Record the new sha. Whether that build holds T241: `editor.css` is dated 07:45 and `release2.log` began after it, so inferred yes.
6. **Hand-check 7 "may still have boxes (T241)"** should read "should still have boxes".

The T241 caveats on lines 48 and 78 should be updated along with items 4 and 5.

**Coverage otherwise holds.** Every `REQUEST.md` item has a line (sheet items 1 to 11), and the steps are plain. Labels checked: Ruler, Settings then Sidebar, 50% zoom, Snapshots & history.

### T240: docs merge

Checked against the code, all true: no word count or Cmd-K hint in `ProjectSidebar.tsx`, shortcut still in `shortcuts/registry.ts`; heading 700 in `--text`, rows 400 in `--muted`, lit on hover, focus or open (`styles.css`); Ruler button in Page setup; 1/16 and 1/4 inch keys; top gap 0 to 200, default 32, Shift 16 px; margin 24 to 192 px, 0.25 to 2 inches matches `printing.rs`; export panel minimum 0.5; Cite here focus through one rAF to the locator field; resize edges transparent, divider keeps its gradient; floating `left: 0`, 8 px strip, list `flex: 0 1 auto`. No doc promises exact page parity; `limitations.md` denies it.

**Wording fixed by me (small, listed in full):**
- `changelog.md`: "native where the validation record says so" now says native has not run (T242). Format bar line notes More and Page setup.
- `design-system.md`: same status fix. "draws anything" is now "adds anything" (the divider keeps its line). T241's More and Page setup rule added to the dropdown paragraph and its coverage. Panel size is 232 x 136 from the bar and 204 x 152 from More (measured; it said always 232 x 136). "scale with CSS zoom in WebKit", first glyph and caret claims marked as not native.
- `architecture.md`: topGap's native round trip was written as fact; now "should", inferred, item 8 not checked.
- `limitations.md`: all native checks are not checked as of T240. "The ruler shrinks to nothing" is now "The text column" (REVIEW-r3 measured the column).
- `validation.md`: "ran as one pass" now names Chromium, unit and cargo, and says native has not run.

`user-guide.md`: no change needed. It is user wording and says nothing about test evidence.

### T242 harness: advice for whoever runs it (read only, never run)

Selectors all match the source: `.ruler-margin-marker--left/--right`, `.ruler-tick`, `.continuous-top-gap-handle`, `.document-ruler`, `.page-sheet`, `.editor-viewport.is-paged`, Page view label, Page setup dialog, Ruler button with `aria-pressed`, `Add a citation`, `Enter manually`. `list_projects` returns `.projects` with `title`. Each launch uses a fresh data store, so the ruler left on cannot leak into the next scenario.

1. **Likely false failures: `state-gap-persist` and `state-margin-persist` read the slider straight after a synthetic key.** `shownGap` and `shownMargin` are read in the same tick as `key(...)`. React 19 applies that state update in a microtask, which cannot run until the script next awaits, so the read should return the old value and report "gap changed on screen" or "margin changed on screen" as failed. Inferred from React's scheduling, not run. Fix: `await delay(100)` before those reads. If either fails only on that line while the SQLite check passes, this is why.
2. **Stale comment.** `measureRuler` says continuous view pads the surface by 8 px. T237 removed that padding, so `glyphInsetFromMarker` should be near 0 and is not asserted. A value near 8 now would be a real finding. Consider asserting it, since it is item 1 of the native list.
3. **`native.sh`'s check is weak.** `grep -q "states 26/26"` passes if any one scenario in the log has all 26. The script's own exit code is the stricter signal, and it is in `native-summary.txt`. Read it.
4. **Cite here state leaves a footnote in the fixture,** and the later ruler states measure that document. Harmless on reading, but check PNGs if a glyph or caret number looks off.
5. **The dialog helper assumes the name stays "Add a citation" after Cite here.** Read as correct: `cardFootnote` is set only by `openCard`, and Research opens with none. If `state-cite-here-page` reports `inCard: false` with a `-locator` id, suspect this first.
6. **Coverage gaps the handoff already states:** no real quit and relaunch, no real ArrowUp, synthetic hover. Those stay owner hand checks, and items 4, 5, 6, 7 and 9 of the native list are not in the harness as measurements. Do not mark them passed from these states.

## T242 (agent-9618, Claude Opus): rejected, the caret correction hides a real failure

Read only: nothing run, no window opened. Evidence: `node_modules/.cache/personal-word-beta/ui7-v/` and `r2/`. Status of everything below: CLAIMED or inferred, not owner-confirmed.

### The `drawnRect` correction

**Caret check: false pass, this is the rejection.** `rulerBottom()` goes through `drawnRect`; `caret.top` from `ed.view.coordsAtPos` does not (`tests/native-screens.js`, `state-ruler-caret-page-*`), so the check compares drawn pixels with zoomed-space pixels. The original failure compared like with like and was right.

Proof that `coordsAtPos` is in zoomed space, from the run's own numbers. Paragraphs are one 24 px line each, so two neighbours must differ by 24 layout px:

| State | zoom | caret k-1 raw / scrollTop | caret k raw / scrollTop | Pitch if raw is zoomed space | Pitch if raw is drawn |
|---|---|---|---|---|---|
| page "150" | 0.843 | 148.46 / 507 | 137.79 / 536 | 23.7 layout px | 18.3 drawn = 21.7 layout |
| page 75 | 0.75 | 220 / 416 | -61.33 / 645 | 24.0 layout px | k-1 lands 52 px below k: impossible |

| State | Caret top, drawn | Ruler bottom, drawn | True clearance | Report says |
|---|---|---|---|---|
| page "150" (zoom 0.843) | 125.17 | 134.23 | **-9.06** | +14.23 |
| page 75 (zoom 0.75) | 165.00 | 132.00 | +33.00 | +88 |

Identical in all four reports (Plain, Color, light, dark).

**Why it is an app bug, not only a test bug.** `scrollRectIntoView` in `prosemirror-view` compares the caret's raw rect with the unzoomed scroller's rect and writes the difference to `scrollTop`. `Writer.tsx`'s effect reads the ruler height with `getBoundingClientRect()`, which is 24 at any zoom in WebKit, so the margin is 29 (its comment says "drawn height"). With scroller top 114 that model predicts the measured moves: -29.2 against -29, and -228.3 against -229; caret after, 148.18 against 148.46 and 220.0 against 220.0.

Inferred from that model, not measured: holding Up settles where the caret's raw top is 167 - 24z. At zoom 0.843 the 20 px line is drawn at about 124 to 144, half behind the ruler that ends at 134. At zoom 0.75 it is about 112 to 130, wholly behind the ruler that ends at 132. So the 75% pass above came only from `place()` starting far off screen and overshooting; the line-by-line case is worse. Zoom 1 has no error, so a default window at 100% is fine. It needs a zoom below 1: 75%, or a pane too narrow for the page.

Also inferred: with the ruler off, the same mix settles at raw 143 - 24z, about 94 drawn at zoom 0.75, above the scroller top of 114. So the caret may leave the view at low zoom with no ruler at all, and at zoom above 1 possibly past the bottom. That would predate wave 7. `gate-zoom`'s "out of text area" is not this check, so its zero flags do not clear it. Hand check it.

Fix directions, not made: in the harness, convert `caret.top` by the total zoom of `.ProseMirror` and rerun, with a real caret-near-the-ruler start in `place()` (it also mixes spaces, which is why `before.caretTop` is -61 at 75%). In the app, a constant margin cannot work because the error scales with distance from the window's top; ProseMirror's `handleScrollToSelection` prop, scrolling in drawn pixels, is the likely hook.

**Sticky check: correct.** Comparing 300 with 600 is right: at 0 the ruler sits 16 px down below the padding, and at 300 it is already pinned. A non-sticky ruler would move 300 px and fail. The converted values are both 0.00 from the scroller's top in both views, and the first run's raw 21.2 from the scroller top converts to the same place (raw top 135.2 x 0.843 = 114, the scroller top). Small points: the variable `rulerTopAt0` is really at scroll 300, and the distance from the top is recorded, not asserted.

**Sheets within scroller: correct.** Sheets are under the zoomed paper and the scroller is not. 635.7 to 1451.7 raw is 536 to 1224 drawn, inside 522 to 1240. It only tests a page that fits, though, because page view never went above zoom 1 (next item).

**`drawnRect` itself matches `reportsUnzoomedRects` and `drawnEdges`** in `src/components/floating.ts`: same probe, same multiply by every ancestor's zoom.

**Harness slip: the "100%" and "150%" page states are the same picture.** The width restore before the ruler states (`for ... ArrowRight`) sends 20 keys without awaiting React, so `aria-valuenow` never updates inside the loop and the sidebar ends at 520 px; compare `state-ruler-page-100-dark.png` and `state-ruler-page-150-light.png`. The pane is 720 px and page zoom is 0.843 at both. So page view above zoom 1 and page view at exactly 1 were not measured natively. Continuous 75, 100, 150 did draw at 0.75, 1, 1.5.

Harness leftovers, none hiding anything: the stale `measureRuler` comment about 8 px padding (measured inset 0, still not asserted); `ensureLongText` leaves an empty first paragraph, so page 1's text starts one line lower in every ruler PNG (not an app bug; page 2's margin in `floating-sidebar-light.png` is exact). The advice above about reading sliders in the same tick was taken (`delay(100)`) and that false failure did not occur.

### VALIDATION "Native run", line by line

Supported: smoke, baseline and beta (`"ok": true, "status": "passed"`); gates zero flags (`gate-zoom.log`, `gate-probe.log`); 26/26 in all four scenarios, `stateErrors` empty; gap-only change (`topGap` 48, `marginInches` 1, `topGap` absent before); margin 120 px, 1.25 in SQLite, gap kept; Cite here on `card-...-locator`, label Page, not in the editor; row hover 6 to 16 px, height 2 to 4 (synthetic pointermove); SQLite through the load path only, as stated.

**Corrected by me, Native run section only:**
1. "All three were harness errors" is now two, plus the real caret failure with drawn numbers.
2. The table's "no failed measured check" now says one false pass.
3. "within 0.01 px" is now 0.03 (right marker at page 100 and 150: 1355.734 against 1355.707, raw).
4. "at 75, 100 and 150%" now says page 100 and 150 both drew at 0.843.
5. "78 px caret" is now 59 px drawn, and the Up-arrow hand test now names 75% and says it is expected to fail.
6. The log line now says `native-summary.txt` records only the first screens run (EXIT=1, 6 failures); the passing rerun is in `r2/`.

Not touched, outside that section: lines 3, 14, 22 to 36 and 47 still say native was not run, and the native list is not updated item by item, which T242's description requires. Items 4, 5, 6, 7, 9 and 10 have no native measurement; A4 and split panes in item 1 were not run; item 8 is partial.

### Native pictures (`r2/color`, `r2/plain`)

Good, against `REQUEST.md` and `design-system.md`:
- **Hierarchy** (`writing-*`, Plain and Color, light and dark): lit heading bold in the text colour with only its icon tinted in Color; open row full colour; other headings lighter; dim rows legible in Futura. `settings-dark.png`: nothing lit, Settings tinted. Good.
- **Floating** (`floating-sidebar-light.png`, `plain/floating-sidebar-dark.png`): the hug looks right. Read, Comments, History and Settings sit right below the list at y 457 to 575, not at the window bottom. Title at x 20 and search at x 13, the same as docked. No panel, no edge. Rail and chevrons are 1 px right of docked; not visible in use.
- **Toolbars** (`state-toolbar-rest-light.png`, `plain/state-toolbar-magnified-dark.png`): zoom, type and font have no box; the size box stays; the dock grows the last two icons without moving anything.
- **Ruler** (`state-ruler-*`, `state-margin-persist-light.png`, `plain/state-gap-persist-dark.png`): ticks scale with zoom in WebKit; markers sit on the text edges; both markers moved to 1.25 in; the gap handle moved 16 px. The ruler is pinned over text in `state-ruler-caret-page-150-light.png`.
- **Research** (`research-light.png`) and **190 px** (`state-sidebar190-long-light.png`): no overlap; labels ellipsize.

**Visible defects:**
1. **Two headings bold while one section is on screen** (`state-ruler-*`, `state-margin-persist-*`, `state-row-hover-rail-*`, all palettes). With "Only fragment" in the pane, both Fragments and Manuscript are bold. `ProjectSidebar.tsx` lights a section when `activeDestination === id`; clicking the Manuscript heading with a fragment open sets that and leaves the fragment on screen. `AGENTS.md` says the heading is bold for the section holding what is on screen. It came from a plain `.click()` on the heading, so inferred reachable by a real click. Hand check: open a fragment, click Manuscript.
2. **Minor: "Manusc..."** (`state-sidebar190-long-light.png`). At the 190 px minimum the lit heading loses letters where Fragments and Research at 500 fit. Allowed by the ellipsis rule; the bold made it visible. Owner's call.

Not defects, but they make the pictures look worse than the app:
- Blue rings on the zoom dropdown, More, the left marker and the gap handle: focus from the script. Whether a real mouse click on the zoom dropdown shows a ring is a hand check, since a ring reads as the box the owner removed.
- The dark line on "Only fragment" against blue on "Opening": the rail's progress remainder at scroll 0.
- The toast over the word count in several PNGs: fixture leftover.
- The caret PNGs show the state after `Selection.modify`, so they cannot picture the asserted failure. `state-ruler-sticky-clip` is captured after scrolling back to 0, so it does not show pinning.
- No snapshot page, resize-edge or hover state is in the native set.

### Docs still claiming native has not run

`docs/changelog.md:7`; `docs/design-system.md:8`, `:192`, `:253` (twice); `docs/limitations.md:51`, `:52`; `docs/validation.md:11`; `docs/architecture.md:55` (item 8). Not edited: they should say what was found, including this failure, after the rerun. `design-system.md:253` claims the caret never sits behind the ruler, with a Chromium caveat; in native that is now false below zoom 1.

## T243 T244 (agent-2f02, Claude Opus)

Headless Chromium and unit tests only; no window opened, no native run. No source or test edits. Status of all below: CLAIMED or emulated, not owner-confirmed. Scratch specs: `node_modules/.cache/personal-word-beta/ui7-rv-f/scratch-specs/`; logs `run.log`, `run2.log`, `run3.log` beside them.

**Verdicts: T243 rejected (one defect, two-line fix). T244 approved.**

### Suite (one fresh build)

tsc exit 0, `npm test` exit 0, build exit 0, Playwright 484 passed, 16 skipped, 0 failed. No failure to assign or rerun.

### T243: the defect

**A node selection is scrolled by the position after the node, not by the node.** `handleCaretScroll` (`src/caretScroll.ts:37`) always uses `coordsAtPos(selection.head, 1)`. ProseMirror's default, which the handler replaces (`prosemirror-view` `scrollToSelection`), uses the node's own rect for a `NodeSelection`. So on WebKit below or above zoom 1, arrowing onto an image (or selecting one and scrolling to it) can leave it behind the ruler or above the window, because only the line after it is brought into view. The "taller than the window, align its top" branch also cannot fire, since the span is one line.

Measured with the WebKit model below, image top starting above the ruler, top's clearance from the ruler after `setNodeSelection` + `scrollIntoView`:

| Zoom | Path | Before | After |
|---|---|---|---|
| 100 | ProseMirror default | -19 | **+5** |
| 75 | `handleCaretScroll` | -10 | **-10, did not move** |

Fix direction: when the selection is a `NodeSelection`, take the span from `view.nodeDOM(from)`'s rect through `drawnSpan`, as the default does. Add a test that actually executes the handler (see "Unit test" below).

### T243: what held up

- **Geometry, no double correction on the path that matters.** One multiply by total zoom, then drawn against `.writer-scroll`'s rect (zoom 1, so drawn) and writes to its `scrollTop` (drawn). Margin and threshold from the `Writer.tsx` effect are drawn too (24z + 5). Same rule as `scrollRectIntoView`, line for line in `scrollDelta`.
- **WebKit model run of the real handler.** Chromium with rects of zoomed content patched to drawn / effective zoom (the measured model; layout and scrolling real). 60 ArrowUp then 40 ArrowDown, pages and continuous, 75 and 150, ruler on and off: caret hidden 0, below the window 0, in all 8 handler runs. The same runs with the handler off and the old margin: up to 3 hidden at -18 px (75, ruler on) and -38.7 px (150), and `focus("end")` left the caret about 3700 px below the window at 150 (handler: 5 px inside). So the emulation reproduces the bug, and this is a stronger result than r3's: the old code was also wrong above zoom 1. This is emulation, not native proof.
- **Not reproduced:** r3's inference that with the ruler off the caret may leave the view at low zoom (old path, 75, ruler off: 0 hidden). Native decides.
- **Selection at document end:** bottom sits 5 px inside the scroller; the bottom margin and threshold are read. Jump to the middle of the document: 5 px inside, the same rule as the default.
- **Find and other jumps:** `setTextSelection(range).scrollIntoView()` (App.tsx, Writer.tsx, pagination.ts) use the head, the same as the default.
- **Split panes:** two panes at 75: 0 hidden in each, and the other pane's `scrollTop` did not move. Each Writer has its own view and margin.
- **Read mode:** App.tsx renders `.manuscript-read` instead of a Writer, so the handler is not mounted. By reading.
- **Zoom 1 and Chromium identical:** handler returns false before touching anything; the ruler height is multiplied by 1. The suite's zoom and ruler specs pass.
- **Horizontal scroll and nested scrollers: no effect today.** At 150 in an 800 px window with a 600-character word, a code block and a 12-column table, nothing inside `.ProseMirror` has non-visible overflow, `scrollWidth` equals `clientWidth`, `scrollLeft` stayed 0.

### T243: latent, not blocking

1. The walk starts at `view.dom`, not the selection's focus node as the default does, and for ancestors under the zoom it compares a drawn caret with a zoomed-space rect. Harmless only because nothing from `.ProseMirror` to `.editor-paper` can scroll (census above; above that `.is-paged` and the app shell are `clip`). A table wrapper or scrolling code block added later would be skipped by this handler. One comment in `caretScroll.ts` would record the constraint.
2. No zero-rect guard (the default returns on an all-zero rect). Only matters for a hidden editor holding the selection; I found none.
3. `parent.getBoundingClientRect()` includes scrollbars; the default uses `clientWidth/clientHeight`. Only differs with "always show scrollbars", and only at the right edge (no horizontal overflow).
4. Checking `reportsUnzoomedRects()` first would spare Chromium the ancestor `getComputedStyle` walk; negligible.

### T243: unit test and browser tests, honestly

`src/caretScroll.test.ts` is partly a mirror. Its WebKit model is `raw = drawn / z` and `drawnSpan` multiplies by `z`, so both models feed `scrollDelta` the same numbers; the "8 of 20 fail-first" only shows that removing the multiply breaks a model defined as its inverse. It does prove `scrollDelta`'s rule holds for every start position. It does not use r3's measured values, and never runs `handleCaretScroll`: the loop, margin reading, `someProp`, and the node path have no test. The model's real authority is r3's measured paragraph pitch.

The 4 new `tests/ruler.spec.ts` tests run in Chromium, where the handler returns false. They pin "Chromium unchanged" and nothing else, as the worker said. So before this review the handler had never executed anywhere. Advice: move the rect patch from `scratch-specs/emu.spec.ts` into a real spec so the handler and the node path run in CI.

### T244: approved

Reviewed only the `titleSelected` change; the same file's diff also removes `entryWords` and `⌘K`, which belong to other tasks. The path is unowned now.

Sidebar scratch (`sidebar.spec.ts`), bold headings with a section on screen:

| State | Manuscript | Fragments | Research |
|---|---|---|---|
| Research heading clicked, panel open | yes | no | yes |
| Research panel closed | yes | no | no |
| Fragments heading clicked, library open | yes | yes | no |
| Library closed | yes | no | no |
| Manuscript heading clicked | yes | no | no |
| Manuscript collapsed | yes | no | no |
| Read | no | no | no |
| Settings | no | no | no |

- **Research lit by its own heading is right:** its panel is on screen, it unlights on close, and closing the card sets the destination back (`closeCard`, by reading). Two bold headings here are correct: both sections hold something on screen.
- **Nothing relied on the removed lighting.** `titleSelected` feeds only the heading's class and `open`, and `selected` on `group-title` is CSS only. `openIds` is empty off a writing page, so Read and Settings stay unlit. Collapse does not touch `open`.
- **Fail-first:** the worker's log records the new test failing on the old build; I did not repeat it.

**Split-view "first text lines start at the same y":** alone 5 of 5 passed; in its file 5 of 5 (27 passed each); passed in the full suite. Not reproduced. The worker's failure was the `.split-pane` count after hovering a row and clicking "Open beside"; T244's line cannot affect that. Cause unknown, possibly machine load. Unowned; not charged to T244.

### T242 harness: advice (unowned, no verdict)

Read only. The reviewed changes are right: caret converted with `drawnY`, `place()` in drawn px with both sides converted and no scroll from `setTextSelection`, the awaited width loop, sticky distance asserted, `viaCommand` is drawn throughout.

1. **Assert the width restore worked.** Record `aria-valuenow` after the loop, and assert `paperScale` / total zoom in `state-ruler-page-100` is 1, so the 0.843 picture cannot silently repeat. Record the drawn zoom in every state: with a sidebar restored, "page 150" will likely draw near 1.2 from the fit scale, not 1.5 (inferred from the 720 px pane at 520 px sidebar).
2. **`clearance >= -1` has no upper bound**, and r3 showed the 75% pass came from overshoot. Expect about 5 drawn px: add `clearance <= 7`.
3. **One step does not test holding Up.** Loop about 20 steps from `k` down, asserting each. Add caret states at 100, 75 ruler off, two panes, and an image `NodeSelection` (for the defect above).
4. **"Inside scroller" checks the caret's top only.** Add the bottom, and a downward case.
5. **`scrollIntoView` is a no-op if the app is not frontmost** (`hasFocus` false: ProseMirror does not sync the selection, so `scrollToSelection` returns early). The "scrolled up" check would fail rather than pass falsely; a failure there means check focus first.
6. `viaModify` stays recorded only, so real-key ArrowUp remains a hand check. `scroller.scrollLeft = 60` is not restored; harmless, it asserts 0.

### Native must confirm

Real ArrowUp and ArrowDown at 75% and at a fit-scaled page view (about 84%), ruler on and off, one and two panes, and 150%: caret clear of the ruler and inside the window. After the fix, an image arrowed onto near the ruler. Whether `coordsAtPos` and the scroller obey the model at zoom above 1 has not been measured natively (r3's numbers are all below 1).

## T243 r2 (agent-290e, Claude Opus)

Headless Chromium only; no window opened, no native run. No source or test edits; mutants were scratch copies. Everything below is emulation or reading, CLAIMED, not owner-confirmed. Logs and mutants: `node_modules/.cache/personal-word-beta/ui7-rv-f2/`.

**Verdict: rejected, for the tests only. `src/caretScroll.ts` needs no change. Fix: change one number.**

### The defect: at 75% the key tests never scroll on the way up

There are 10 emulated tests, not 12 (8 key tests, 2 image tests). From the end of the document, 30 ArrowUps at 75% do not reach the ruler, so the upward scroll path is not run at the zoom the bug was reported at.

| Key test, 30 Ups | Scroll moves on the way up | Closest caret to the floor (drawn px) |
|---|---|---|
| pages 75, ruler on | 0 | 8 |
| pages 75, ruler off | 0 | 26 |
| continuous 75, ruler on | 0 | 176 |
| continuous 75, ruler off | 0 | 194 |
| pages 150, ruler on | 6 | 4.6 |
| pages 150, ruler off | 3 | 35.3 |
| continuous 150, ruler on | 12 | 5 |
| continuous 150, ruler off | 2 | 0 |

With 70 Ups (a scratch copy of the spec, same tests otherwise), all four 75% tests scroll:

| 75% test, 70 Ups | Real code | Handler off | Margin ignored |
|---|---|---|---|
| pages, ruler on | pass, min 5 | fail, 5 hidden, -18 | fail, 8 hidden, -13 |
| continuous, ruler on | pass, min 5 | fail, 4 hidden, -18 | fail, 31 hidden, -13 |
| pages, ruler off | pass | pass | pass |
| continuous, ruler off | pass | pass | pass |

Fix: `run("ArrowUp", 30)` to 70 in `tests/ruler.spec.ts` (adds about 2 s per test). No other change is needed.

### Worker's fail-first claims: hold

Rerun on scratch copies, 10 tests per mutant:

| Mutant | Fails |
|---|---|
| Handler returns false | 75 pages on, 150 pages on, 150 pages off |
| Node branch reverted | image at 75 only |
| `drawnSpan` does not multiply | the same 3 as handler off |
| `scrollMargin` ignored | 150 pages on, 150 continuous on, image at 75 |

- **The handler really runs on real keys.** A counter build shows 46 handler returns in every key test: 45 presses plus `focus("end")`.
- **The other 5 key tests when the handler is off:** the two 150 continuous and the 75 ruler-off tests are not pointless but weak. They run the handler and pin "no wrong scroll", and 150 continuous on does catch the margin mutant. Chromium's own caret scrolling keeps ruler-off cases passing with the handler off; I did not measure how much of that carries over to WebKit (inferred).
- **Weakness (advice):** no key or image test has an upper bound, so overshoot passes. Add `clear <= 7` to the image test.

### Node branch: correct

- **`nodeDOM`:** an element for every node selection I tried: image figure, `HR`, page break, blockquote, at 75, 100 and 150. Clearance after scrolling was about 5 drawn px at each zoom. The page break's height of 0 caused no problem. Null or a non-element falls back to `coordsAtPos` (by reading; I could not produce one, since text nodes cannot take a `NodeSelection`).
- **Table:** `setNodeSelection` on a table became a cell selection, so this branch does not apply. The table top measured -18, -25 and -38 px at 75, 100 and 150, the same at 100 as the default path, so not this change.
- **A node taller than the scroller: not top-aligned when its top starts in view or below the window.** Image top clearance from the ruler after selecting (2000 px tall):

| Start | 75 (handler) | 100 (ProseMirror default) | 150 (handler) |
|---|---|---|---|
| Top above the ruler | +5 | +5 | +4.7 |
| Top in view | -41 | -53 | -75.3 |
| Top below the window | -41 | -53 | -75.3 |

This copies ProseMirror's own formula (`prosemirror-view` dist/index.js:233-234): `rect.top + margin - bounding.top` leaves the top a full margin above the scroller, and with the ruler the margin is its height + 5. The handler matches the default, so it is not T243's defect. Only a selected node taller than the window is affected. Unowned; left alone.

### The intermittent miss: not reproduced, mechanism found

- **10x run:** `--repeat-each=10` on the real build: 100 of 100 passed.
- **Mechanism:** `prosemirror-view` adds `scrollIntoView` to a key's selection change only if it lands within 50 ms of the keydown (dist/index.js:5129). Later than that, the handler is never asked.
- **Proof, 120 ms main-thread stall on each keydown, 40 Ups, continuous, ruler on:**

| Build | No stall | With stall |
|---|---|---|
| Emulated, 150 | 0 hidden, handler ran 41 times | 3 hidden, min -36, handler ran once |
| Plain Chromium, 100, handler not involved | 0 hidden | 2 hidden, min -24 |

So a stall can produce this miss, and it also happens at zoom 100 without the handler. That the worker's one miss had this cause is inferred: `ui7-e/real.log` has no detail, and it ran in a longer batch. It is not a T243 code defect. The owner could see one line behind the ruler after a long stall, and the next key corrects it. The key tests can flake on a very busy machine; if one does, its message now names the press, and a single isolated press points here.

### `tests/native-screens.js`: advice (no verdict)

Read only, not run. The new walk states and the image state read correctly.

1. The image state's `finally` runs `setNodeSelection(at).deleteSelection()` even when the insert failed, which would delete a fixture paragraph. Harmless to the fixture project, but guard it.
2. The walks use `setTextSelection` plus `scrollIntoView`, so real ArrowUp stays a hand check, including the native caret scroll and the 50 ms window above.
3. `rulerEd` is reused for the image state after the split state. By reading, the left Writer keeps its key and position, so it should stay mounted, but re-fetching the editor costs one line.

### Native must confirm

Unchanged from the section above: real ArrowUp and ArrowDown at 75, fit-scaled and 150, ruler on and off, one and two panes, and an image arrowed onto near the ruler.
