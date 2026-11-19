# IMPLEMENTATION LOG -- Page header (T1-T5)
Date: 2026-11-17

## Plan deviations
- Coordinator correction to T2 (PDF): existing exports must stay byte-for-byte identical, so the PDF number keeps the old `paperWidth - margin - 10` x when the header text is empty; measured-width right alignment is used only when text is non-empty. My first version (always measured width) had changed the PDF content hashes in src/export/document.test.ts ("Chicago ... exports exactly as before") and src/export/multiparagraphNote.test.ts ("identical to the pre-fix exporters"); proved by temporarily restoring `- 10` (both passed), then fixed as above. Those two tests pass unchanged; my edits to the two `x` expectations in pageNumbers.test.ts were reverted. DOCX output with no text and Different first page off is identical (document XML equality test added).
- T5 (f): a click at the label's centre in the top margin does move focus out of the editor, with or without the label (existing margin-click behaviour). The test therefore asserts (1) the hit test at the label centre does not find the label, (2) the same click with the label hidden gives the same focus result, (3) the first text block's top is identical with the label on and off.
- T5 typing: the text field is typed key by key and must keep focus and value; it did, so the T4 "local state" default was not needed.
- T3: the label's margin uses the live ruler-preview margin (`shownMargin`), not `geometry.margin`, so it follows a margin drag.

## T1 Settings and label rule
Changed: `DocumentSettings` gains `pageHeaderText?`, `pageFirstDifferent?` (src/research/types.ts); new src/export/pageLabel.ts and pageLabel.test.ts. No unknown-key validation found (stop condition not met).
Fail-first: before pageLabel.ts existed: `Failed to resolve import "./pageLabel"` / "Test Files 1 failed, no tests".
Pass: `vitest run src/export/pageLabel.test.ts src/research/documentSettingsDefaults.test.ts` -> 2 files, 12 tests passed; `npx tsc -b` clean.

## T2 PDF and Word
Changed: src/export/pdf.ts (label via pageLabel, ellipsis if wider than text width, measured-width right alignment only with text), src/export/docx.ts (text run + PAGE field, header/footer when numbers or text, titlePage also for Different first page), src/export/pageNumbers.test.ts (5 new tests).
Fail-first (new tests against untouched exporters; /tmp/ph/t2-fail.txt): 4 failed | 10 passed (PDF x position, page-one label count, numbers-off text count, Word header "Siegel "); the fifth new test is a no-change guard and passed by design.
Pass: `vitest run src/export` -> 12 files, 197 tests passed.

## T3 / T4 On-screen line and controls
Changed: new src/editor/PageLabels.tsx, src/editor/PageHeaderRows.tsx; src/Writer.tsx (2 imports, `templateId` prop in destructuring and type, `<PageLabels>` after the page-sheet map, `<PageHeaderRows>` and Position-row condition); src/App.tsx (one line `templateId={project.templateId}`); src/editor/editor.css (one `.is-paged .page-label` rule, no margin/padding/gap/height); src/export/ExportPanel.tsx (text field, checkbox, Position shown with numbers or text).
Focus greps after edits: `e.detail > 0` = 10, `editor.view.focus()` = 14.

## T5 Browser spec
tests/sb-page-header.spec.ts (8 tests a-h).
Fail-first (before T3/T4): `8 failed` (/tmp/ph/t5-fail.keep).
Pass: `8 passed`.

## Validation
See final report.

Final (2026-11-17): `npx tsc -b` clean; `npx vitest run --testTimeout=60000` 93 files / 1337 tests passed (at the default 5 s timeout, 16 heavy PDF/font tests timed out under machine load; all pass at 60 s and in isolation). Playwright, each under the lock: sb-page-header 8 passed, hs8-page-numbers 1 passed, pages-gap 10 passed, ruler 38 passed. Focus greps: 10 and 14.

## Follow-up: Page setup row height and review items (2026-11-17)
- Page header text input now uses the existing `.toolbar-input` class (26 px high, same as Alt text) inside `<span className="row-trail" style={{ width: 112 }}>` (same 112 px as the Position dropdown), in src/editor/PageHeaderRows.tsx. Rows are even at 28 px; panel x and width unchanged. No CSS spacing added.
- Panel height legitimately grew by 72 px (two new rows): tests/fixtures/popover-baseline-rects.json "Page setup" height 219 -> 291 (only change to a recorded placement; x, y, width untouched).
- Print: `.page-label` added to the existing `.page-sheet` display:none rule in the `@media print` block of src/editor/editor.css.
- PDF: when header text is non-empty, the label is split with the same `segment` shard selection as body text (glyphs for text, digits, space and "..." embedded up front) and drawn run by run; number-only path unchanged (existing hash tests pass). Truncation marker is now "..." (unreachable for number-only). New test: Cyrillic + Greek header. Not run fail-first against old code.
- Spec (g) waits for `.save-status` "Saved" instead of 800 ms.
- Evidence copied to docs/agent-work/2026-11-16-shelved-batch/page-header/evidence/.
- Results (logs test-results/sb-page-header-logs/*.2.log, port 1441, lock held): layout-invariants 41 passed, popover-bounds 5 passed, sb-page-header 8 passed, hs8-page-numbers 1 passed; layoutPrimitives 3 passed; tsc clean; vitest src/export 198 passed.
