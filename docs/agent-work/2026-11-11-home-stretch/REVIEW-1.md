# Review 1 -- HS2, HS4, HS5, HS8 (reviewer agent-1324, 2026-11-12)

Independent review, no source edits. Verdicts: **HS2 approve, HS4 approve, HS5 approve (two low findings), HS8 approve (three low notes).**

## What I ran
- `npx vitest run src/editor/pageBreakKeys.test.ts src/export/pageNumbers.test.ts`: 2 files, 12/12 passed.
- `npx tsc -b`: clean (no errors at 00:14).
- A throwaway headless probe (tests/review1-tmp-unit.test.ts, deleted) on `insertPageBreak`: mid-paragraph structure and link carry. Headless `undo()` did nothing at all, so I do not count it as evidence; the browser run settles undo.
- One locked Playwright run (port 1441, Chromium, 1280x800, 1x): `hs2-spacing`, `hs4-sidebar-align` (3), `hs8-page-numbers` and a throwaway `review1-tmp.spec.ts` (7 tests, now deleted). **12/12 passed.** Screenshots are in `notes/review1-*.png`.

## HS2 / T293 -- approve
- `src/Writer.tsx:1713-1748`: "pt" text and unit wrappers are gone, all three `NumberInput` are `width={64}`, and the values are still written as `${n}pt`. The aria-labels "Space before, points" and "Space after, points" are sensible. `.toolbar-field` (`src/editor/editor.css:311`) uses `justify-content: space-between`, so the right edges match.
- `.toolbar-field-unit` is removed and nothing in `src` or `tests` uses it any more, so there is no orphaned CSS. Nothing else in `tests/` depends on the old labels.
- Screenshot `notes/review1-hs2-spacing.png`: the boxes are equal and right-aligned, with no "pt".
- Low: the fail-first trips on the new aria-label before the width and "pt" assertions run (the worker disclosed this). Reading the old code (64 vs 56 px wide), the width assertion would also have failed, so the test does pin the behaviour.

## HS4 / T295 -- approve
- `src/styles.css:1663-1677`: a block scoped to `.sidebar-shell:not(.is-floating):not(.is-overlay)`. It adds no borders, motion or hover rules. No other rule sets the sidebar's top padding or the title-row height that this block could silently override (checked `.sidebar` at 589, the 1000px media query at 1469, and `floating.css`).
- Measured in the browser (light): title centre 54 = top bar centre 54; search centre 94 = format bar centre 94; title row left 12 = section-heading row left 12; sidebar top padding 0.
- The overlay sidebar is untouched: top padding 16px, title row 36px, search margin-top 12px (the old values). The floating sidebar is pinned by the worker's spec (title top 130, search 190, recorded before the fix), which passed.
- Screenshots looked at, light and dark entry (`review1-hs4-entry-*.png`), Comments (`-comments`) and Read manuscript (`-read`). The title sits on the top-bar line and "Find in project" on the format-bar line. Comments and Read keep the same positions, and the gap under the search row (about 13px to "Manuscript") is not cramped.
- Unverified: WebKit and the real app (a native titlebar inset could shift things), and the wide sidebar-* suite after the change (the worker skipped it).

## HS5 / T296 -- approve
- `src/editor/pageBreakKeys.ts:12-25`: one helper, used by Shift-Enter and by the Page setup button (`src/Writer.tsx:1947-1953`, which focuses the editor first). The insert, the paragraph attrs and the stored marks all go into one chain, which is one transaction.
- Browser evidence (Chromium):
  - **End of paragraph:** type bold text, Shift+Enter, type: the new text is `<strong>`, so the marks carry.
  - **Undo:** wait 800 ms, Shift+Enter, wait 800 ms, Cmd+Z once: the doc goes back to the single original paragraph. One history step.
  - **Page setup button:** after "Insert page break", focus is back in the editor and the typed text keeps bold.
  - **Mid-paragraph:** `Hello|world` gives `P(Hello) / BREAK / P(empty) / P(X world)`. The tail moves below the break with its marks and the caret lands at the start of the tail, so typing works and keeps the format.
- Findings (both low, non-blocking):
  1. `src/editor/pageBreakKeys.ts:14`, `editor.state.storedMarks ?? $from.marks()`, carries marks that Enter drops. In a headless probe a link at the end of a paragraph extended into the text typed after the break (`Y{link}`); Enter would not do that, because Link is `keepOnSplit: false`. Fix: filter through `editor.extensionManager.splittableMarks`, as Tiptap's `splitBlock` does.
  2. A mid-paragraph break leaves an empty paragraph between the break and the moved tail, and now that paragraph also carries the copied attrs. The old code did the same (headless comparison), so this is pre-existing. Fix if wanted: when the cursor is not at the end of its paragraph, insert only the pageBreak.
- Test strength: the mid-paragraph unit test passes without the fix (disclosed), and the undo test checks step inversion, not real history. The browser checks above cover both gaps for Chromium.

## HS8 / T299 -- approve
- **Default unchanged:** `src/export/pdf.ts:594-610`. With no position set, x = `paperWidth - margin - 10`, y = `margin / 2`, size 10 and the same font expression, identical to the old code by reading. `src/export/docx.ts:253-264,347-348`: the footer paragraph is RIGHT-aligned with PAGE.CURRENT, as before, and `headers: undefined` is ignored by docx.
- **Chicago and Word:** `titlePage` and `pageNumbers.start` (`docx.ts:331-333`) do not depend on position. With `titlePg` and no first-page header or footer, Word shows nothing on the title page for any position. In the PDF, the skip/start-at-0 test sits outside the position branch, so it holds for all six.
- **Collision:** the top baseline is at `paperHeight - margin/2 - 10`. At the smallest margin ExportPanel allows (0.5 in = 36 pt) that leaves about 8 pt clear above the text block. The PDF draws no running head (the only `drawText` calls are body, notes and the number), so nothing collides. Word headers push the body down by themselves.
- **Persistence:** `onDocumentSettingsChange` (`src/App.tsx:1925-1933`) goes through `mutate`, the normal immutable save path. Rust keeps `documentSettings` in the flattened `extra` map (`src-tauri/src/store.rs:41-42`, test at 1913), so the field survives. `validateProject` does not strip it (unit round trip). No rename, no folio.* change.
- **In sync:** the Page setup and ExportPanel controls read and write the same field. The e2e test proved it (Top center kept on reopen and shown in Export settings). In the Page setup screenshot "Bottom center" fits the 112px dropdown, and the control is a plain checkbox with the muted line.
- Notes (low):
  1. `src/App.tsx:1929`: on an old or imported project with no `documentSettings`, the first Page-setup toggle writes `defaultDocumentSettings`. The Writer's fallbacks then switch from sans 14 / 1.5 to serif 12 / double. This is the same pattern as the existing margin path (`App.tsx:1945`) and ExportPanel, and new projects always get settings from a template, so it is not a new class of bug. Worth knowing if the owner opens an old project.
  2. The PDF right positions keep the old fixed `-10` offset, so multi-digit numbers are not flush (disclosed, needed so the default stays identical).
  3. Not HS8: the same diff contains the font-embedding work from another wave. `embeddedFonts.values().next()` can now be a custom document font, which changes the page-number font in PDFs that embed one. Listed, not judged.
- Test strength: the fail-first shows 4 of 8 failing on the old code. The Word Chicago test covers 2 of 6 positions, but the code does not depend on position.
- Unverified: real exported files opened in Word or Preview, and WebKit.

## For the owner's hand test
- HS4: in the real app (WebKit, native titlebar), the sidebar title on the top-bar line and "Find in project" on the undo/redo line, in light and dark.
- HS5: page break at the end of a link, and in mid-sentence (an empty line appears on the new page; this was already so).
- HS8: export with Top center and Chicago. Open the .docx in Word and check that page 1 (the title page) has no number and page 2 shows "1" at top centre.
- In the real app, Page setup and Line spacing open inside the "More formatting" list, which scrolls. Expected, but with HS8's three extra rows Paper size can scroll out of view.
