# PLAN -- Page header text, corner page numbers, different first page
Date: 2026-11-16 | Architect: Claude Code / Fable | Project: Project 13 - Word Processor | Status: APPROVED (owner's choices of 2026-11-16; one assumption flagged under Open questions)

## Goal
A writer can set a running line such as "Siegel 11" (their text plus the page number) in Page setup, choose its corner, turn on a different first page, and see it on every page on screen, in the PDF and in the Word file.

## Request
Owner, 2026-11-16: "Page numbers should be in page set up. We need them to be adjustable to show in any of the four corners depending on what the user needs and You should be able to write something that appears in every page. basically what I am looking for is the 'Siegel 11' that would appear in the top right or bottom right of an essay. needs to able to set it on right or left side and have page numbers. We also need the different first page option."

## Definition of done
- Page setup (the popover in the editor) has: Page numbers on/off, Position, a text field "Page header text", and a checkbox "Different first page". The Export panel shows the same two new controls.
- With text "Siegel", numbers on, position Top right: every page sheet in page view shows "Siegel 1", "Siegel 2", ... in its top-right margin; the PDF and the Word export show the same line in the same corner.
- Position offers the four corners (and keeps the two existing centre options).
- Text with numbers off shows the text alone on every page. Numbers with no text behave exactly as today.
- "Different first page" on: page one shows nothing; page two shows "Siegel 2".
- Chicago template rule is unchanged: page one blank, page two is numbered 1.
- The settings survive reload (browser preview) and are plain additive keys inside `documentSettings`.
- The on-screen line never takes clicks, never moves text, and is absent in continuous (non-page) view.

## Non-goals
Tokens ({title}, {author}); separate header and footer lines; separate first-page text; a start-at number; total page count ("11 of 20"); making on-screen page breaks match the exports; Read view; the native print path (src/print); any Rust change.

## Context (verified unless marked)
- Settings type `DocumentSettings` has `pageNumbers: boolean` and `pageNumberPosition?: PageNumberPosition` (six values, default treated as "bottom-right") -- `src/research/types.ts:71-97` (verified).
- Projects store `Partial<DocumentSettings>`; read through `editorSettings()` / `exportSettings()`; `changedSettings()` stores only changed keys -- `src/research/documentSettingsDefaults.ts:9-41` (verified).
- PDF draws the number per page, skips page index 0 for Chicago, label is `index` for Chicago else `index + 1`, size 10; right alignment uses `paperWidth - margin - 10`, not the measured width -- `src/export/pdf.ts:594-612` (verified).
- Word builds one `Footer`/`Header` with `PageNumber.CURRENT`; `titlePage` and `pageNumbers.start` 0 only for Chicago -- `src/export/docx.ts:253-264`, `:330-348` (verified).
- Page setup rows for Page numbers and Position are in `src/Writer.tsx:1948-1984`; they read `exportSettings(documentSettings)` and call `onDocumentSettingsChange({...})` (verified).
- Page sheets: one absolutely positioned `.page-sheet` per page at `top: page * (geometry.height + geometry.gap)`, only when `layout.mode === "pages"`; `pages` state holds the count -- `src/Writer.tsx:922-932`, `:2268-2276`; CSS `src/editor/editor.css:609-617` (verified). `SideRuler` is an existing per-page overlay -- `src/Writer.tsx:2278-2290` (verified).
- Export panel controls -- `src/export/ExportPanel.tsx:140-170` (verified).
- Existing tests: `src/export/pageNumbers.test.ts`, `tests/hs8-page-numbers.spec.ts`, `src/research/documentSettingsDefaults.test.ts` (reported by research, not opened: inferred).
- Rust keeps `documentSettings` inside the flattened `extra` map, so new keys round-trip with no Rust change -- `src-tauri/src/store.rs:43-56` (inferred from the flatten design and AGENTS.md).
- Whether `Writer` receives the project's `templateId` as a prop: unknown (see T3 stop condition).

## Rules in force
- Name it "Page header" / "Page footer", never a bare "header" -- `AGENTS.md` (Product and UI).
- No new margin/padding/gap/height declarations in component CSS; `src/layoutBudget.json` counts only go down -- `AGENTS.md`.
- `src/Writer.tsx` toolbar handlers hold deliberate focus code: 10 `e.detail > 0` and 14 `editor.view.focus()`; counts must be unchanged afterwards -- `HANDOFF.md` rules.
- Shared files (`src/Writer.tsx`, `src/editor/editor.css`) are edited in small regions with the Edit tool, never rewritten.
- Export formatting must not silently change -- `AGENTS.md`. Documents with no text and the box unticked must export byte-for-byte as before, except the right-aligned PDF number, which moves to true right alignment (T2; called out to the owner).
- Fail-first for every new test -- workspace `AGENTS.md`.
- Small fixes run only affected specs; serial lock around every Playwright run -- `AGENTS.md`, `HANDOFF.md`.

## Approach
One pure function decides what a page shows; the PDF, the on-screen overlay and (by the same rules) the Word export all follow it. Two additive settings. The text sits before the number in the same corner ("Siegel 11").
- Rejected: separate header and footer text fields -- the owner asked for one running line in a corner.
- Rejected: tokens -- not asked for.
- Rejected: putting the overlay markup inline in Writer.tsx -- keeps the delicate file's diff to two insertion points.

## Tasks
### T1 -- Settings and the label rule
- Files: modify `src/research/types.ts` (the `DocumentSettings` type only); create `src/export/pageLabel.ts`, `src/export/pageLabel.test.ts`.
- Interfaces: provides `pageHeaderText?: string` and `pageFirstDifferent?: boolean` on `DocumentSettings` (no entries added to `defaultDocumentSettings`); provides
  `export function pageLabel(s: Pick<DocumentSettings, "pageNumbers" | "pageHeaderText" | "pageFirstDifferent">, templateId: string | undefined, pageIndex: number): string | null` and
  `export function pageLabelPosition(s: Pick<DocumentSettings, "pageNumberPosition">): PageNumberPosition` (returns `s.pageNumberPosition ?? "bottom-right"`).
- Steps:
  1. Add the two optional fields to the type.
  2. `pageLabel` rules, in order: text = `(s.pageHeaderText ?? "").trim()`; if `!s.pageNumbers && !text` return null; if `pageIndex === 0 && (templateId === "chicago" || s.pageFirstDifferent)` return null; number = `templateId === "chicago" ? pageIndex : pageIndex + 1`; return text and number joined by one space, or whichever exists.
  3. Unit tests: every rule above, including Chicago page two = "1", and "Siegel" + numbers off = "Siegel".
- Acceptance check: `npx vitest run src/export/pageLabel.test.ts src/research/documentSettingsDefaults.test.ts` -> all pass; `npx tsc -b` -> exit 0.
- Fail-first: run the new test file before `pageLabel.ts` exists -> fails on import.
- Stop and ask if: `DocumentSettings` is validated somewhere that rejects unknown keys.
- Default if unanswered: none -- must ask.

### T2 -- PDF and Word exports
- Files: modify `src/export/pdf.ts:594-612`, `src/export/docx.ts:253-264` and `:330-348`, `src/export/pageNumbers.test.ts`.
- Interfaces: uses `pageLabel`, `pageLabelPosition` from T1.
- Steps:
  1. PDF: replace the condition and label with `const label = pageLabel(s, project.templateId, index)`; draw when non-null. Left: `x = margin`; centre: `paperWidth / 2 - width / 2`; right: `paperWidth - margin - width` (measured width; this replaces the fixed `- 10`). Truncate the text part with an ellipsis if `width > paperWidth - 2 * margin`.
  2. Word: the header/footer paragraph becomes text run (`text + " "` when text is set) followed by `PageNumber.CURRENT` (omitted when `pageNumbers` is false). Attach the header or footer when `pageNumbers || text`. `titlePage: project.templateId === "chicago" || !!s.pageFirstDifferent`. Leave `pageNumbers.start` as it is (0 only for Chicago). Define no `first` header/footer, so page one is blank.
  3. Tests: PDF draws "Siegel 2" on page index 1 at the top-right coordinates; nothing on page index 0 when `pageFirstDifferent`; DOCX header XML contains "Siegel " and a PAGE field; `titlePg` present when `pageFirstDifferent`; with neither new setting the DOCX XML is unchanged from today. Update any existing right-aligned x expectation to the measured-width value and say so in the log.
- Acceptance check: `npx vitest run src/export` -> all pass.
- Fail-first: add the new assertions first and run them against the untouched exporters -> they fail.
- Stop and ask if: an existing test pins the old right-aligned x and the difference is more than a few points for one- and two-digit numbers.
- Default if unanswered: use the measured width (true right alignment).

### T3 -- On-screen line on each page
- Files: create `src/editor/PageLabels.tsx`; modify `src/Writer.tsx` (one import, one insertion directly after the `.page-sheet` map at about `:2268-2276`), `src/editor/editor.css` (one new rule next to `.is-paged .page-sheet`).
- Interfaces: uses `pageLabel`, `pageLabelPosition`. Provides `<PageLabels pages={number} geometry={...} margin={number} settings={DocumentSettings} templateId={string | undefined} />`, rendering one `<div className="page-label" data-page={n} data-position={position} aria-hidden="true">` per non-null label.
- Steps:
  1. Each label is absolutely positioned with INLINE `top`/`left`/`right` only: vertical centre of the top margin band (`page * (height + gap) + margin / 2`) or of the bottom band (`page * (height + gap) + height - margin / 2`), horizontally at `left: margin`, centred, or `right: margin`. Use `transform: translateY(-50%)` for centring.
  2. CSS rule `.is-paged .page-label`: `position: absolute; pointer-events: none; font-size` from the existing small type token, colour `--muted`, `white-space: nowrap`. No margin, padding, gap or height declarations.
  3. Settings come from `exportSettings(documentSettings)`, the same reading the Page setup rows use. Render only when `layout.mode === "pages"`.
  4. Re-count in `src/Writer.tsx`: `grep -c "e.detail > 0"` = 10 and `grep -c "editor.view.focus()"` = 14.
- Acceptance check: `npx vitest run src/layoutPrimitives.test.ts` -> pass; the T5 spec's on-screen tests pass; `tests/pages-gap.spec.ts` and `tests/ruler.spec.ts` pass (each as its own command).
- Fail-first: T5's on-screen tests are written first and fail.
- Stop and ask if: `Writer` has no access to the project's `templateId` and adding it needs more than one new optional prop passed at the existing `<Writer` call sites in `src/App.tsx`.
- Default if unanswered: add one optional prop `templateId?: string`, passed from `src/App.tsx` in a one-line edit per call site.

### T4 -- Controls in Page setup and the Export panel
- Files: create `src/editor/PageHeaderRows.tsx`; modify `src/Writer.tsx` (insert the component after the Position row, about `:1984`), `src/export/ExportPanel.tsx:140-170`.
- Interfaces: provides `<PageHeaderRows settings={DocumentSettings} onChange={(patch: Partial<DocumentSettings>) => void} />`.
- Steps:
  1. Rows, using the popover's existing `.row` / `.row-label` / `.row-trail` classes: a text input labelled "Page header text" (placeholder "Siegel", `maxLength` 60) writing `pageHeaderText`; a checkbox "Different first page" writing `pageFirstDifferent`.
  2. In Page setup the Position row must show when numbers are on OR text is non-empty (today it shows only when numbers are on).
  3. Export panel: the same two controls beside the existing page-number controls, using that panel's existing classes; Position shown under the same rule.
  4. Re-count the two Writer.tsx focus greps as in T3.
- Acceptance check: T5 spec passes; `npx tsc -b` -> exit 0.
- Fail-first: T5's control tests are written first and fail.
- Stop and ask if: typing in the text field loses focus or caret on each keystroke (the popover re-rendering on project change).
- Default if unanswered: keep the field's value in local state and write the setting on blur and on Enter.

### T5 -- Browser spec
- Files: create `tests/sb-page-header.spec.ts`. Model on `tests/hs8-page-numbers.spec.ts`.
- Interfaces: none.
- Steps (tests): (a) page view, enough text for three pages, set text "Siegel", Position Top right: `.page-label` count equals page count, texts "Siegel 1".."Siegel 3", each label's box lies inside its page sheet's top margin band and right-aligned to the text area's right edge within 1 px; (b) each of the four corners places the label in the matching band and side; (c) Different first page: no label with `data-page="0"`, page two reads "Siegel 2"; (d) numbers off, text on: labels read "Siegel"; (e) continuous view: zero labels; (f) a click at a label's centre does not move focus out of the editor, and the first text block's top is identical with the label on and off; (g) reload keeps text and checkbox; (h) Chicago template: page one blank, page two reads "1".
- Acceptance check: `PLAYWRIGHT_PORT=1441 npx playwright test tests/sb-page-header.spec.ts --trace off --output test-results/sb-page-header` -> all pass, under the serial lock.
- Fail-first: run it before T3/T4 -> every test fails.
- Stop and ask if: none.
- Default if unanswered: n/a.

## Validation (after all tasks, in order)
1. `npx tsc -b` -> exit 0.
2. `npx vitest run` -> all pass.
3. Under the lock, each as its own command: `tests/sb-page-header.spec.ts`, `tests/hs8-page-numbers.spec.ts`, `tests/pages-gap.spec.ts`, `tests/ruler.spec.ts`, and the spec covering the Export panel (grep `tests/` for "Page number position").
4. `git diff --stat -- src/Writer.tsx` shows only the two insertions (plus the optional prop); focus greps read 10 and 14.
5. Coordinator: Opus review, then the batch's single full-suite run and release rebuild.
6. Owner by hand in the real app: set "Siegel", Top right, three pages; export PDF and Word and open both; tick Different first page and repeat.

## Risks and rollback
- On-screen page breaks differ from the exports on long documents, so the on-screen "11" can sit on different text than the exported "11". Stated to the owner; no parity promise.
- The right-aligned PDF number moves a few points (true right alignment). Visible only on close comparison.
- Rollback: the change is additive; `git diff` of the listed files reverts it. Stored keys left in a project are ignored by old code.

## Amendment 2026-11-16 (coordinator)
T2 as first written moved the right-aligned PDF number for every document and broke two "exports exactly as before" hash tests. Corrected: with no Page header text the PDF number is drawn exactly as before (x = `paperWidth - margin - 10`); measured-width right alignment applies only when text is set. Existing export hashes are not updated. The owner confirmed the "Different first page" assumption below on 2026-11-16.

## Open questions for the user
- Assumed: "Different first page" means page one shows nothing and still counts as page 1 (page two shows 2). If the owner wants page one to carry its own text, or numbering to restart, that is a follow-up.

## Notes for the implementer (traps, things NOT to do)
- Do not add entries to `defaultDocumentSettings`; absent means off/empty.
- Do not touch any other part of `src/Writer.tsx`; do not reformat it.
- Never commit, stash, reset, clean, or install packages. Record evidence in `IMPLEMENTATION_LOG.md` in this folder.
- Another worker is editing `src/App.tsx`, `src/components/ProjectSidebar.tsx` and `src/components/ProjectLibrary.tsx`; if T3's default needs `src/App.tsx`, make only the one-line prop edits and re-read the region first.
