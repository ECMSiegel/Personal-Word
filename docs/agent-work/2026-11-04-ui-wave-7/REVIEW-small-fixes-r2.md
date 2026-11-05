# Review r2: W7 small-fix repairs (T247, T248, T249) and the caret fix

Reviewer: agent-b7b4 (Claude Opus reviewer W7 r2). Date: 2026-11-05.
Evidence level: headless Chromium against the `ui7-final` build, some with emulated WebKit rects in tests the coordinator ran. Not native, not confirmed in real use. Status of everything approved here: CLAIMED.
No source or test edits. Probes and shots: `node_modules/.cache/personal-word-beta/ui7-rv-r2/` (`probe.spec.mjs`, `probe2.mjs`, `shots/`).

| Item | Verdict | Why |
|---|---|---|
| T247 | REJECT | Defect 1 is fixed, but the repair moved the Settings rule 1 px above the footer rule |
| T248 | APPROVE | One rule with zero sources, no empty band, status still a live region |
| T249 | APPROVE | No doubled rule with one PDF; owner's placement rulings hold |
| Caret fix | PASS, one small defect | No harm to undo, saving or listeners; a non-moving key followed by Cmd+A jumps to the document end |

Spec run, fresh: `tests/research.spec.ts` + `tests/sidebar-selection.spec.ts`, 49 passed. Those specs do not catch the T247 defect below.

## Defects

### T247 (blocking): Settings rule sits 1 px above the footer rule
- Where: `src/styles.css:2197` gives every bottom `.group-heading` `min-height: var(--control-height)`. That includes Settings, whose group has a 1 px top border, so the group grows to 33 px. The group's own 32 px border-box (`src/styles.css:2206`) no longer holds.
- Repro: any project at 1280 x 800, docked sidebar. Measure `.sidebar-bottom-groups .sidebar-group:last-child` and `.pane-footer`.
- Measured: Settings top 767, height 33. Footer top 768, height 32. Label centre 784, footer text centre 784.5. The previous review measured Settings top 768 before this repair.
- Visible: `ui7-rv-r2/shots/footer-step.png` (2x) shows the line stepping where sidebar meets main pane. The comment at `src/styles.css:2202` says this separator is level with the footer's rule.
- Why tests pass: `tests/alignment.spec.ts:358` allows 1 px of difference.
- Fix: at `src/styles.css:2214` add `min-height: 0` to `.sidebar-bottom-groups .sidebar-group:last-child > .group-heading`. Then tighten `tests/alignment.spec.ts:358` and `:360` (top and height) to 0.5, shown failing first.
- Floating mode removes the divider border (`floating.css:95`), so it probably has no step. Inferred, not measured.

### Caret fix (small, not a board task): stale key plus select-all
- Where: `src/caretScroll.ts:43`. `keyAt` is only cleared by a selection change or a mousedown, so a movement key that moves nothing stays armed for 1 second.
- Repro: caret at the very start of a long document, press ArrowUp, then Cmd+A within a second.
- Measured: scroller goes 0 to 3705, to the end of the document. Control, Cmd+A alone: stays 0.
- Likely more common on Mac: PageUp, PageDown, Home and End normally scroll in WebKit without moving the caret (inferred, not measured).
- Fix: `keyAt = MOVE_KEYS.has(event.key) ? Date.now() : 0;` so any other key disarms it. Confirm with the Cmd+A repro, since this relies on the handler seeing the key before the select-all keymap takes it.

### Tidy, not blocking
- `.source-list:empty` is written twice in `src/research/research.css`, lines 200 and 213.

## What I checked

### T247
- Bottom group is a block; only Settings stays flex, and it holds no list.
- Snapshot list below its heading: heading ends about 732 (inferred from group top 699 plus border and 32 px), list top 733, list right 257 inside the 270 sidebar. Comments uses the same rule; a list with real comments was not rendered.
- Row heading height 32 with label centred, at all four rows.
- Long title on hover, ellipsis stops before the split icon: 200 against 217 at 270 wide, 117 against 137 at 190 wide. Shots `long-hover-270.png`, `long-hover-190.png`. The spec assertion at `tests/sidebar-selection.spec.ts:910` measures the same thing.

### T248 and T249 (y positions in the panel, px)
| State | Rules | Between them |
|---|---|---|
| Zero sources, zero PDFs | 363 | Nothing; Text-only notes at 380, Zotero ends 347 |
| Zero sources, error showing | 398 | Status text above the rule, then Text-only notes |
| One PDF | 363, 470 | PDFs subheading at 380, section ends 454 |
| PDF and three sources | 363, 674 | PDFs, then list 470 to 658 |
| Three sources | 352, 574 | List 369 to 558 |

- `.research-pdfs` has no rule, and the spec asserts `borderTopWidth` 0.
- Empty `.research-status`: `position: absolute`, 1 px, `display: block`, `role="status"` kept. It returns to flow when it has text.
- Last source has no bottom border, so no double line above Text-only notes. No sideways overflow in any state.
- Owner's rulings: Upload PDF follows Enter manually in the action row with no icon (`shots/pdf-and-sources.png`). The PDFs section is absent until a PDF exists.
- The T249 data work was not re-reviewed, as instructed.
- With PDFs and sources together, no rule or subheading separates them, only a 16 px gap. Reads fine; for the owner's eye only.

### Caret fix
- Cause: confirmed in `node_modules/prosemirror-view/dist/index.js:5129`. `readDOMChange` takes the "key" origin only if the selection time is within 50 ms, and only then adds `scrollIntoView`.
- Scope: only in the writer's list (`src/Writer.tsx:625`); `documentExtensions` untouched. `keyAt` is per editor, so split panes do not share it. No schema effect.
- Undo and history: appended transaction has no steps, and `prosemirror-history` returns early on `steps.length == 0`. Probe: after typing and six slow keys, undo removes exactly the 3 typed characters and redo restores them.
- Save queue: Tiptap only emits `update` on a doc change. Probe: 0 updates over 5 slow arrows.
- Listeners: one `transaction` event per key, not two (5 keys gave 5 events, with 5 appended scrolls). `selectionUpdate` once each. `Writer.tsx:774`, `:793`, `:914` read state only; nothing in `src` reads `scrolledIntoView`.
- Shift+arrow: slow Shift+ArrowUp keeps its range (89 characters) and scrolls as usual.
- Keymap, table and footnote commands: the handler returns false so nothing is blocked. Commands that scroll set `scrolledIntoView`, so no second scroll. A key command that moves the selection without scrolling would now scroll, which is the wanted result. By reading; not driven in a table.
- Mouse click: stale key then click in view, selection moves, scroll stays 30. `mousedown` disarms. Only covers clicks inside the editor.
- Code-set selection in the window: with a stale key a no-scroll selection does jump (30 to 5143); control with no key stays 30; after 1.1 s stays 30. So the window closes correctly. In-app, the code paths either ask for a scroll themselves (`App.tsx:241`, `Writer.tsx:679`, `:1798`, `pagination.ts`), change the document, or select the paragraph at the caret (`Writer.tsx:743`, `:1936`, `:1954`). The rail only sets `scrollTop` and sets no selection. Select-all is the one path found that reaches far from the caret, hence the defect above.
- Composition: `editHandlers.keydown` returns before `handleKeyDown` while composing, so the key is never armed. By reading, not driven.
- Stored marks and selection: `after.tr` carries them forward unchanged. By reading.
- Slow-key test soundness: the busy listener on `window` runs after ProseMirror's handler and before the browser moves the caret, so it does force the over-50 ms path. Coordinator's fail-first and 10-of-10 not repeated.

## How far the evidence goes
Headless Chromium only. Native WebKit was not run, and that is where the caret problem was reported, so the caret fix needs the owner's real test. Nothing here is confirmed in real use.

## Native still to check
1. Hold and tap ArrowUp in a long document at 75% and 150% with the ruler on: caret never hides behind the ruler.
2. PageDown or End, then Cmd+A, in WebKit: see whether the jump happens if the small fix is not applied.
3. Settings rule against footer rule, after the T247 fix.
4. The T249 native list in `REVIEW-small-fixes.md`, still open.

## Note on this review
A first probe wrote its screenshots to a stray `/Users/ethansiegel/Local%20Projects/` folder because of an unescaped path. The shots were moved to `ui7-rv-r2/shots/` and that folder, which held only this probe's output, was removed.

## r3: recheck of the two fixes (2026-11-05, agent-bfb7)
| Item | Verdict | Why |
|---|---|---|
| T247 | APPROVE | Settings rule now level with the footer rule; lists still stack |
| Caret disarm | PASS | The Cmd+A fix does not disturb the slow-key path; one narrow race remains, harmless |

Evidence: own probe `ui7-rv-r2/probe3.mjs` against `ui7-final/dist`, headless Chromium, 1280 x 800. The four spec files were not rerun, per the coordinator; their 100 passed and fail-first results are the coordinator's. Not native, not confirmed in real use. Status: CLAIMED.

**Settings against footer:** top 768 and 768, height 32 and 32, text centre 784.5 and 784.5. Same with the Snapshots list open. Shot `shots/r3-footer-step.png` shows one continuous line (r2's showed a step).

**Bottom rows:**
- Read is 32 px. Comments and Snapshots are 33 px as whole groups: a 32 px heading plus the 1 px divider. So the headings are 32, and this is unchanged from r2.
- Settings' own heading box is now 22 px, centred inside its 32 px group, with the same text centre as the footer. Its clickable height was not measured.
- Snapshots list with one row: heading ends 733, list 734 to 767, right edge 257 inside the 270 sidebar. Stacks. Shot `shots/r3-sidebar.png`.
- With a list open there is 1 px between the list's end (767) and Settings (768), and 1 px between heading and list. r2's numbers show the same. Not a defect.
- A list with real comments was still not rendered; it uses the same rule.

**Disarm, by reading `src/caretScroll.ts` and `prosemirror-view` (not newly driven):**
- Shift held before an arrow: the Shift keydown sets `keyAt` to 0, then the arrow keydown arms it. Same for Cmd or Alt plus an arrow. Works. The modifier's own keydown also disarms before Cmd+A.
- Key repeat: every repeat is a movement key, so it re-arms; the new line never disarms it. Repeats that outrun the selection change coalesce into one change that reads the latest caret, so the final position gets its scroll.
- Narrow race: a different key (say Shift) pressed after an arrow but before that arrow's selection change fires disarms first. `forceFlush` does not help, because it only acts on a scheduled flush and `selectionchange` flushes directly. That one move then misses the late scroll, exactly the pre-fix behaviour, and the next press corrects it. No wrong jump. Not worth more code.

**Other:** the duplicate `.source-list:empty` is gone (`research.css:210`). `probe3.mjs` uses `fileURLToPath`; the stray folder did not come back.

## Review of T252 (native rerun)

Reviewer: Claude Opus reviewer T252. Date: 2026-11-05. Read-only: nothing was built, run or launched. Verdict: **APPROVE**. Status stays CLAIMED, not VERIFIED.

**Evidence level:** automated native windows (WebKit, smoke build, isolated test identifier) with scripted actions. Real keys, mouse, file picker and relaunch by hand are NOT covered. Those belong to T253 and the owner.

**1. Exit codes and counts, read from the logs in `node_modules/.cache/personal-word-beta/ui7-t252/`:**
- `native-summary.txt`: smoke build, smoke, baseline, beta, gate-zoom, gate-probe, screens Plain and screens Color all EXIT=0, ending in `done`.
- Smoke log ends "Native WebView + SQLite smoke test passed." Baseline and beta both report `ok: true`. Their statuses are only `passed` (34) and `detected` (47, the negative controls catching injected faults). Nothing is skipped.
- Gate-zoom and gate-probe: `zero flags: True`, `ok: true` in the JSON. Caret sweep out of text area 0/100 and fuzz violations 0/150, at both 100% and 75%.
- All four `report-*.json` files, not just the logs: `ok: true`, 31 states, 31 measures, 0 `measureFailures`, 0 `stateErrors`. So the summary's lack of MEASURE FAILED and STATE FAILED lines is real.
- 39 PNGs per set (31 states plus 8 screens), no two byte-identical across sets. The logs' "16 native screenshots" counts only the 8 base screens per scenario; it is not a shortfall.

**2. The run tested the final code: yes.**
- Timeline (UTC): `tests/native-screens.js` 2026-11-04 21:27; `src/caretScroll.ts`, `src/styles.css`, `src/research/research.css` 2026-11-05 08:23:06; driver run started 08:44:50; smoke build finished 08:46:14.
- Build log shows `tsc -b && vite build` ran first, so the frontend was rebuilt from those files. The worker's driver differs from `ui7-v/native.sh` only in the output path and lock label.
- A sweep of the project outside `node_modules`, `target`, `team`, `docs` and `dist` finds later changes only in `HANDOFF.md`, `tsconfig.tsbuildinfo` and `src-tauri/src/lib.rs` (09:24:30). `git diff` on `lib.rs` is empty, so that is a touch to force a rebuild, not a code change. None can change the verdict.
- `target/debug/folio` has the build's mtime and size, and the SHA-256 (`1c64e52e...`) of the `bin/folio-v` the gates ran. `dist/` was rebuilt at 09:25, after this run (inferred to be T253's build, whose log ends 09:28); the binary tested was not affected.

**3. T246's case passed in all four runs.**
- `state-ruler-caret-cont-75`: start clearance 4.0 px (asserted 4 +/- 2), min and max clearance 5.0 (asserted -1 to 7), 20 steps, scroll 581 to 220, scrollHeight 2248, ruler shown, continuous mode.
- The 120-paragraph fixture is confirmed three ways: the code, the status bar's 1,560 words (120 x 13), and the capture ending at paragraph 11 as a 30-then-20 step walk should.
- All four cont-75 captures viewed full size: caret at the start of paragraph 11, clear below the ruler; right window, not blank. Same result in Plain and Color, light and dark.

**Captures:** I built my own contact sheets (Plain light, Color dark, viewed; the worker's sheets were not kept in the evidence folder, so its inspection cannot be rechecked directly). No blank, wrong-window or clipped capture. This is an overview, not a pixel-level check of all 156 images.

**Limits, none blocking:**
- The cont-75 walk moves the caret by setting the selection and calling `scrollIntoView`, not by keydown. It therefore tests the drawn-pixel scroll, but not the `KeyCaretInView` late-scroll path in `src/caretScroll.ts`, which needs a real movement key. The pages-probe gate does send a synthetic keydown plus `Selection.modify` (`tests/native-smoke.js:287`), which may reach that plugin, but it asserts where the caret lands, not the late scroll. So this run gives no native proof of that path; its direct coverage is unit and headless. T253 must press real arrow keys in continuous and page view at 75%.
- Reliability tests cover owned-process termination at acknowledged SQLite checkpoints, not power loss.
- T246 remains open on the board; this review does not change it.
