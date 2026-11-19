# REVIEW -- shelved batch (2026-11-16), uncommitted tree

Reviewer: Claude Code (Opus), independent and adversarial, 2026-11-17. I read the code for every piece; nothing here rests on a worker's word alone. Read-only review: I edited no source or test file, ran no Playwright, no build and no cargo.

What I ran myself:
- `npx tsc -b`: exit 0.
- `npx vitest run`: 93 files and 1337 tests, all passed. That includes the new pageLabel, projectCounts, save-queue, storage and pageNumbers tests.
- Two scratch scripts outside the repo that drive the real `src/save-queue.ts` (bundled with esbuild into the scratchpad). They prove finding 1 and finding 2.
- grep counts in `src/Writer.tsx`: `e.detail > 0` = 10 and `editor.view.focus()` = 14. Both are correct.

## Verdicts

| # | Piece | Verdict | One-line reason |
|---|---|---|---|
| 1 | Test speed (workers 3) | APPROVE WITH FIXES | The rule is fine, but no three-worker run of the final tree is green, and both recorded runs failed `performance.spec.ts:170`. |
| 2 | Prose issue focus rings | APPROVE | One scoped `outline-offset` rule, and the test can fail. Notes only. |
| 3 | Table menu stays in window | APPROVE WITH FIXES | The fix is sound and keyboard opening uses the same path. Remove the MENU-DUMP debug log. |
| 4 | Long card titles | APPROVE | Two small CSS changes in the card region only, and the test was shown to fail first. |
| 5 | Motion M2 / M3 | APPROVE WITH FIXES | Pointer-only gating is correct. The scissors keyframes override the dock's own CSS transform (small visual pop), and nothing is documented in design-system.md. |
| 6 | Page header ("Siegel 11") | APPROVE WITH FIXES | Exports with no header text are unchanged and Writer.tsx is clean. The new text input almost certainly breaks the Page setup row checks in `layout-invariants.spec.ts` (that spec was never run). The labels also have no print rule. |
| 7 | Word/section counts (storage) | REJECT (small fix) | Stamping only the disk header makes the existing "Two copies of this project disagree" dialog appear after a crash that lands between the save and the journal clear. Reproduced. |

## Findings

### 1. BLOCKER -- Piece 7: a crash right after a save now shows a false recovery conflict
`src/save-queue.ts:142-146` (`recover`), `:195-198` (the journal header in `enqueue`), `:243-245` (`drain`).

**What is wrong:**
- The disk header now carries `wordCount` and `sectionCount`, but the recovery journal header does not. It is still `headerOf(p)`, which is the in-memory project with no counts, or with stale counts copied from the last load.
- `recover()` raises `RecoveryConflict` when the journal and the disk copy have the same revision but are not `canonical`-equal.
- Before this change that case was equal and silent. It happens whenever the app dies after the native commit but before `drain` removes the journal.
- Now the owner gets "Two copies of this project disagree ... hold different writing" even though the writing is identical.
- No writing is lost, since both choices keep the text. But it is a false alarm on the exact path the recovery design exists for, and it breaks AGENTS.md "Preserve writing".

**Evidence:**
- Scratch harness: open, enqueue rev 2, flush, put the pre-flush journal back, then `recover(disk)`. It throws `RecoveryConflict`.
- Second variant: a loaded project already holding stale counts (rev 5 has wordCount 2), edited to 4 words at rev 6. That also throws `RecoveryConflict`.
- `scripts/native-reliability.py:1291-1320` (post-commit-pre-mirror kill, then restart, expects the committed project to open) exercises this window. If that harness keeps WebView storage across the restart, I expect it to fail now. Not run.

**Smallest fix:** in `recover()`, compare with `wordCount` and `sectionCount` removed from both sides. For example, strip them in a small helper before `canonical(...)`. These are derived values and never the writer's data.
- The alternative (writing the journal header with `savedHeaderOf`) does not cover a legacy disk header at the same revision, so stripping is the safer choice.
- Add a unit test: "save landed, journal left behind, reopen gives no conflict", in both the fresh and the stale-count variants.

### 2. SHOULD-FIX -- Piece 7: a failed same-revision re-send retries with a stamped header and keeps failing
`src/save-queue.ts:243-245`, `:260-263`; `src-tauri/src/store.rs:481-497`.

**What is wrong:**
- `onDisk` is worked out from `this.saved`, which the catch block sets to `null`.
- Take a legacy project (no counts on disk) reopened with a leftover journal at the same revision. It is re-enqueued and sent with the plain header.
- If that persist fails once, the retry has `saved === null`, so it stamps the counts.
- Rust's same-revision path compares the stored header with the new one (`previous != &header`) and returns "A newer revision is already on disk". This repeats on every flush until the writer makes an edit.
- It recovers on the next edit (the new revision saves normally), but the save status stays red in the meantime.

**Evidence:**
- Scratch harness with the first persist rejecting: the first header has no counts and the retry header has counts, at the same revision.
- The Rust result comes from reading `store.rs:493` (cargo was not run).

**Smallest fix:** remember the plain decision across the failure, for example `private plainRevision: number | null`, set when `onDisk` and reused when `p.revision === plainRevision`. Or make the Rust same-revision comparison ignore the two keys. Add a save-queue unit test for "persist fails once on an onDisk re-send".

### 3. SHOULD-FIX -- Piece 6: the "Page header text" input makes the Page setup rows uneven (predicted test failure)
`src/editor/PageHeaderRows.tsx:13-21`.

**What is wrong:**
- The input uses only `className="row-trail"`, so it takes the global `input` style (`src/styles.css:535`: `padding: var(--space-2)` plus a 1 px border). That makes it about 35 px tall inside a `.panel` whose rows are 28 px.
- The existing popover text field (Alt text, `Writer.tsx:1554`) uses `.toolbar-input` (26 px, `editor.css:881`) for exactly this reason.
- `tests/layout-invariants.spec.ts:201-215` ("Page setup panel rows are even and share a trailing edge") and `:219-235` (rows 28 ± 0.5 px, every row ending at the panel edge) cover `.panel > .row`, and the new `<label className="row">` is one of those rows.
- The worker ran sb-page-header, hs8, pages-gap and ruler, but not layout-invariants, editor-toolbar or hover-emphasis, which all open Page setup.

**Evidence:** code reading. Not run, because Playwright was off-limits.

**Smallest fix:** `<span className="row-trail"><input className="toolbar-input" ... /></span>`, with a width the panel can hold. Then run `tests/layout-invariants.spec.ts`, `tests/editor-toolbar.spec.ts` and `tests/hover-emphasis.spec.ts`, each alone.

### 4. SHOULD-FIX -- Piece 6: page labels are not hidden in print
`src/editor/editor.css:617-624` (new rule) against the `@media print` block at `:650-690`.

**What is wrong:**
- The print block hides `.page-sheet`, `.page-spacer` and the rulers, and `side-ruler.css:84` hides the side ruler.
- `.page-label` has no print rule, so a print of page view would draw every label at its on-screen absolute offset over the reflowed print text.

**Evidence:** code reading. No `window.print` call exists today, so the risk is a browser or WebView print.

**Smallest fix:** add `.page-label` to the existing `display: none !important` list inside `@media print`. That is not a spacing declaration, so the layout budget is not affected.

### 5. LOW -- Piece 6: PDF header text skips the font-shard and script checks
`src/export/pdf.ts:597-612`.

**What is wrong:**
- The label is drawn with `embeddedFonts.values().next().value`, the first embedded font. That may be a custom font (even a bold or italic one) or the Latin shard.
- Body text goes through `selectShard`, which picks the Greek or Cyrillic shard or throws the clear "export as DOCX instead" error.
- Header text with Greek, Cyrillic or Hebrew characters therefore draws missing-glyph boxes (or throws a raw pdf-lib error) instead of either outcome.
- Truncation slices UTF-16 code units, so it can split a surrogate pair.

**Evidence:** code reading. Not run.

**Smallest fix:** run the label through the existing segment/font path, or test the label with the `selectShard` rule and throw the same message.

### 6. LOW -- Piece 6: wording and small export points
- `PageHeaderRows.tsx` and `ExportPanel.tsx`: the field is always called "Page header text", even when Position is a bottom corner, where it is a page footer. The ExportPanel's Position label stays "Page number position" when numbers are off and only text shows. The naming rule is respected (no bare "header"), but bottom positions read oddly. This is the owner's call.
- `docx.ts:341`: "Different first page" ticked with numbers off and no text still adds `<w:titlePg/>` to an otherwise unchanged document. It is invisible, but it is not byte-identical. It could be guarded with `showLabel`.
- The Writer path stores `pageHeaderText: ""` and `pageFirstDifferent: false` explicitly after edits, while the ExportPanel path stores only changed keys. This is harmless.
- Each keystroke in the field is one `mutate` call: a new revision and a journal header write. That is the same cost as typing in the document, the saves are debounced, and caret and focus held in the spec. Acceptable.

**What I verified as correct in piece 6:**
- With no header text and Different first page off, the PDF label and x are identical (the `document.test.ts` and `multiparagraphNote.test.ts` hash tests pass unchanged).
- The DOCX children and `titlePage` are identical, and there is a new XML-equality test.
- Text plus PAGE field, text only, `titlePg` for non-Chicago, and Chicago start 0 combined with text (page two reads "Siegel 1") all follow `pageLabel`.
- Top and bottom y are the old values.
- On screen: `pointer-events: none`; the label is a sibling of `.page-sheet` (outside ProseMirror) and is drawn only when `layout.mode === "pages"`; it sits inside the sheet margin, so it is clear of the top ruler and the side ruler (at -16 px).
- The `src/Writer.tsx` diff is exactly: two imports, the optional `templateId` prop (destructure and type), the `PageHeaderRows` insertion with the changed Position condition, and the `PageLabels` insertion. Greps are 10 and 14.
- No margin, padding, gap or height was added to component CSS, `layoutBudget.json` is unchanged, and there is no new z-index.

### 7. SHOULD-FIX -- Piece 1: no green three-worker run, and the performance budget fails under contention
`playwright.config.ts:12`; evidence in `test-results/sb-baseline/e2e1.log` and `e2e2.log`.

**What is wrong:**
- BRIEF.md cites "670 passed, 0 failed, 9.8 min" plus "two confirming runs".
- The two runs on disk are both red:
  - **e2e1** (started about 00:59, about 16.5 min): 2 failed. `performance.spec.ts:170` at 135.7 ms against a 50 ms budget, and `floating.spec.ts:908`, where keyboard focus was not where expected.
  - **e2e2** (01:16-01:40): 20 failed. Mostly the new specs, which workers were still editing during that run, plus `performance.spec.ts:100` and `:170` and `hover-emphasis.spec.ts:160`.
- The input-latency budgets in `performance.spec.ts` are measured while two other browsers are running, so they will keep failing at three workers.
- `docs/design-system.md:399` still says "one worker".
- CI is safe: `ci.yml:45` passes `--workers=1`.

**Smallest fix:**
- Run `performance.spec.ts` alone. For example, give it its own Playwright project with `workers: 1` that runs after the others, or exclude it from the parallel run and run it as a second command.
- Update `design-system.md:399`.
- Record one green full run of the final tree before commit, as BRIEF.md already plans.

### 8. LOW -- Piece 5: the scissors keyframes override the dock's CSS transform on the icon
`src/research/snipMotion.ts:9-17`; the dock rule is in `src/editor/toolbar-motion.css:4-9`.

**What is wrong:**
- The toolbar svg's resting transform is `translate(optical) scale(dock/1.5)`, not `none`.
- The WAAPI keyframes `none -> rotate(-12deg) -> none` replace it for 160 ms, so the icon drops its dock scale and optical offset. With the pointer on the icon (dock about 1.5) that is a small jump. With the pointer at the icon's edge it is a visible size pop.
- The spec ignores CSS transitions, so it cannot see this.

**Smallest fix:** add `composite: "add"` to the keyframes (`FRAME_KEYS` already allows it) and use `rotate(0deg)` and `rotate(-12deg)`, so the rotation adds to the CSS transform.

### 9. LOW -- Piece 5: smaller motion points
- **M2 departs from IDEAS.md.** It is entrance-only: there is no `usePresence` exit for the outgoing tree. The deviation is recorded in `notes/motion-M2.md`; the owner should know.
- **A tab click from the Projects page counts as an open.** `projectOpen` goes from false to true, so with a pointer the sheet animates. IDEAS.md says tab switching stays immediate. Switching between two open projects does stay still.
- **`.app .editor-paper` is a first match.** In a restored split view only the left sheet rises. In Read mode, or when the project opens on a destination page, nothing animates (harmless).
- **The `.extract` lookup.** `App.tsx:1306` falls back to `document.querySelector(".extract")` because WebKit does not focus a clicked button. There is only ever one `.extract`, since only the focused pane renders a toolbar (`App.tsx:2018`, `showToolbar={side === focusedPane}`). So the "two buttons in split view" worry does not arise. The only caller paths are the toolbar button and the shortcut.
- **Weak shortcut test.** `tests/sb-motion-fragment.spec.ts`: the shortcut test says "after a pointer click elsewhere" but only calls `mouse.move`. It never sets `pointerInput` to true first, so it cannot catch a leak of the pointer flag into a keyboard action. Add a real click (on the editor) before the chord.
- **design-system.md is not updated** for M2/M3, the page header or the table menu flip. Previous waves documented each behaviour there.
- **Verified correct:** gating is `pointerdown` true and `keydown` false (capture phase); Reduce Motion returns before `play`; the durations are 80 + 80 delay, 180 and 120, all within 220 ms; only transform and opacity are animated; the first paint (tab restore) does not animate; `.page-scale` uses CSS `zoom`, not `transform`, so the sheet rise does not fight it.

### 10. LOW -- Piece 3: debug output and edge cases
`tests/sb-table-menu-flip.spec.ts:24-47, 74`.

**What is wrong:**
- `dump()` and `console.log("MENU-DUMP", ...)` print on every run. That is diagnostic scaffolding. Remove both (or put them behind an env flag).
- The tests check "inside the window" (0..size), not the 8 px margin the fix aims for, and nothing tests the keyboard (ContextMenu key) opening.
- Code reading shows keyboard opening uses the same `at` path (`Writer.tsx:734-747`) and the ref callback never touches focus.
- Already admitted in the note: a resize while the menu is open lets Popover's own `measure()` add `popover-up` on top of the translate. In addition, a flipped menu still reveals top-down, because `up.current` stays false, so the clip-path grows from the edge away from the pointer. This is cosmetic.
- **Verified correct:** the ref callback runs at mount, before the clip-path/opacity enter animation, and the measurement is not distorted by it; it resets `translate` first, so nothing leaks across re-opens; the deps `[x, y]` re-measure for a new click point.

### 11. LOW -- Piece 2 and Piece 4: notes
- **Piece 2 (`prose-issues.css`):**
  - There is no note file and no recorded fail-first run.
  - The test fails against the old outline (outside the button), but it would also pass if the outline were removed entirely, because the computed width becomes 0.
  - Add `expect(parseFloat(outlineWidth)).toBeGreaterThan(0)` to the test.
  - The file loads after `layout.css`, and the rule sets only `outline-offset`, which is allowed.
- **Piece 4 (`styles.css`):**
  - `align-items: stretch` also widens `.project-dates` in cards. It already wraps and is start-justified, so that looks fine.
  - The fail-first evidence is in `notes/card-title.md`.
- **Out of scope for this review, noted only:** `tests/w9-projects-page.spec.ts` changed an existing locator from `.project-dates > span` `.nth(1)` to a `/^Added/` text filter. That belongs to T3 (counts) and is reasonable, because spans are inserted. The order check now lives in the new counts test.

### 12. LOW -- Tests: timing under three workers
- `tests/sb-page-header.spec.ts:189` waits a fixed 800 ms before reload to let the save land. Under three workers it may reload before the save. Wait for `.save-status` to read "Saved" instead.
- Test (f) is titled "keeps editor focus", but by design it only compares the click outcome with and without the label. The `elementFromPoint` check is the real proof.
- The page-header fail-first evidence is in `/tmp/ph/` (it still exists today). That folder is outside the repo and will not survive a reboot.

## What I could not check
- `cargo test` (the new Rust list test, and the same-revision comparison in finding 2) was not run; that finding comes from reading `store.rs`.
- No Playwright spec was run: layout-invariants (finding 3), sb-*, w9-*, motion, or the full suite at three workers.
- Native WebKit was not checked: the dock pop, button focus on click, label rendering under CSS zoom, and real right-click or ContextMenu-key placement.
- `scripts/native-reliability.py` was not run (the post-commit kill and restart in finding 1).
- I did not open real exported PDF or DOCX files in Word or Preview, so the first-page blank with `titlePg` and the right alignment of "Siegel 11" are not checked by eye.
- The Projects-page count display (T3) was skipped, as instructed.
