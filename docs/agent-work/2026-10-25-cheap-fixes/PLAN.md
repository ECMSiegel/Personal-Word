# PLAN -- Cheap known limitations, fixed now
Date: 2026-10-25 | Architect: Claude Code (Fable 5.1) | Project: Project 13 - Word Processor | Status: APPROVED (owner, 2026-10-25)

## Goal
Eight small, long-documented rough edges in Personal Word's imports, exports, Zotero refresh and messages behave the way the README already implies they should, so the beta's limitation list shrinks to things that are real design boundaries.

## Request
Owner, 2026-10-25: "Why haven't we fixed these known limitations? ... Write a plan to fix the cheap stuff now." The cheap items named: import label "up to 20 MB" vs the 5 MB text cap; "newer version of Folio" error string; a toast covering the Export PDF button; PDF images stacking with no gap; Word/PDF exports omitting project and section titles; the BibTeX "Jr." suffix dropped from formatted names; the unapproved browser-preview Zotero fetch path; the untested abandon-dialog import cancel path.

## Definition of done
- The import button label states the real limits per format, and a browser test asserts the label text.
- A too-new project database produces an error naming Personal Word; a Rust test asserts the text.
- A notice toast never sits over the settings/export panel's buttons; a browser test clicks Export PDF while a toast is visible.
- Consecutive images in a PDF export are separated by a visible gap; a unit test asserts the gap in page geometry.
- Word and PDF exports print section titles as headings (and the project title unless a Chicago title page already carries it), identical to what Markdown export prints; unit tests assert them, and exports of a project with no headings in the body are otherwise byte-identical to before.
- A BibTeX creator with a suffix formats as "John Q. Smith Jr." in notes and "Smith, John Q., Jr." in the bibliography; unit tests assert both.
- The browser preview no longer performs any Zotero network read; it shows a clear "desktop app only" message; a unit test asserts no fetch is attempted.
- Abandoning the import dialog by Escape or by the frame's cancel path leaves no project; a browser test covers both.
- `npx tsc --noEmit -p .`, `npm test -- --no-file-parallelism --maxWorkers=1`, the production-preview Playwright suites named below and `cargo test --locked --offline` pass; every new check was shown failing first.

## Non-goals
PDF table header repeat, streaming zip cap, block-quote citation placement, comment anchors on identical passages, Zotero polling, writing-aid performance, native print (all in `docs/agent-work/2026-10-25-later-fixes/PLAN.md`). No new npm or cargo packages. No change to the 5 MB / 20 MB limits themselves. No change to storage identifiers or event names.

## Context (verified)
- Import label text "Import writing -- text, Markdown, Markdown bundle (.zip), Word, or HTML (up to 20 MB)" -- `src/components/ProjectLibrary.tsx:200` (verified); accept list at `:207` (verified).
- Plain text/Markdown cap `MAX_MANUSCRIPT_BYTES = 5 * 1024 * 1024` with message "Manuscripts must be 5 MB or smaller." -- `src/import/manuscript.ts:7,94` (verified). DOCX/HTML/zip caps 20 MiB -- `src/import/importLimits.ts:4-9` (verified); DOCX check at `src/import/docxImport.ts:192` (verified).
- Error string "This project needs a newer version of Folio." -- `src-tauri/src/store.rs:174`, inside the `user_version > SCHEMA_VERSION` branch (verified). The beta harness asserts the newer-schema refusal by file bytes, not by message text (inferred from `wp11-matrix.md`; the implementer must grep `tests/native-reliability.js` and `scripts/native-reliability.py` for "newer version" before changing it).
- Toast: `.notice` is `position: fixed; bottom: 49px; left: 50%` -- `src/styles.css:711-715` (verified); rendered in `src/App.tsx:2287-2296` with a dismiss button (verified). It has `pointer-events: none` except its button (`styles.css:896-901`, verified), so it blocks clicks visually, not technically; the T019 screenshot showed it over the Export PDF button (`artifact-acceptance.md` section 5, verified).
- Export PDF / Preview PDF buttons -- `src/export/ExportPanel.tsx:255,290` (verified).
- PDF image line: `{ runs: [], height: b.image.height + 6, ... }` -- `src/export/pdf.ts:288-289`; drawn at `y + size - line.image.height` -- `pdf.ts:475-480`; `y -= line.height` per line -- `pdf.ts:504` (verified). Two consecutive image lines therefore touch (6 pt is consumed by the baseline offset `size`).
- Block builder `documentBlocks()` iterates `project.order`, visits each section's content, and inserts a page break after the first entry for the Chicago template -- `src/export/document.ts:82,264-268` (verified). Section titles are never emitted as blocks (verified: no `e.title` reference in `document.ts`). Markdown/plain text exporters do emit `# project.title` and `## entry.title` -- `src/export/textExport.ts:182-186,258-262` (verified). DOCX has `titlePage: project.templateId === "chicago"` -- `src/export/docx.ts:255` (verified); what the Chicago title page prints is unknown (implementer reads `docx.ts` ~236-300 and `pdf.ts` for "chicago").
- Creator type `SourceCreator = { role; given?; family?; literal? }` has no suffix -- `src/research/types.ts:2` (verified). BibTeX keeps suffix only in `cslData` -- `src/research/bibtexImport.ts:374-378` (verified) and test `bibtexImport.test.ts:95-104` (verified). CSL to creator mapping drops it -- `src/research/cslImport.ts:70-77` only reads given/family/literal (verified). Name formatting -- `src/research/citations.ts:9-18,37,105` (verified).
- Zotero browser path: comment "Browser preview only (the desktop app uses the native command above)", limits applied -- `src/research/zotero.ts:259-275`, `browserRead` uses `fetch(url, { redirect: "error", ... })` -- `:321-325` (verified). `fetchZoteroItems` at `:244`, `fetchAllZoteroItems` at `:400` (verified). Gate B recorded this path as an unapproved deviation (`gate-b.md` B6, verified); the owner has not approved it (no decision on the board, verified).
- Import cancel: `cancelImport` aborts the controller and clears busy state -- `src/App.tsx:1127-1130`; `ModalFrame` handles Escape by calling `onCancel` when not busy -- `src/app/ProjectDialogs.tsx:17-19` (verified); `ImportPreview` and `ImportBusy` pass `onCancel` -- `src/import/ImportPreview.tsx:23,101` (verified). Existing browser tests cover the Cancel button during a slow read and during parsing, plus a control -- `tests/import-cancel.spec.ts:29,75,127` (verified). No test presses Escape or dismisses via the frame (verified by reading the spec).
- Base state: `main` @ `72732d8`, clean except `scripts/__pycache__/` and the board's regenerated `team/BOARD.md` (verified 2026-10-25 15:40 EDT). All beta work is committed and pushed to `origin` (public repo; owner chose to leave visibility as is).
- Pinned Node `node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin`; production-preview Playwright config pattern `node_modules/.cache/personal-word-beta/team-t005/browser.config.mjs` (port 1420 is squatted; use 1500+) (verified during the board).

## Rules in force
- Preserve `com.folio.writing`, `folio.*` keys, native event names, additive metadata; no new packages; no commits unless asked -- project `AGENTS.md`, `team/PLAN.md`.
- UI: sans-serif, flat, square corners, `--` separators, every hover action keyboard reachable -- project `AGENTS.md`.
- Export formatting must not silently change; Chicago/Turabian guidance -- project `AGENTS.md`.
- Team board: one task per item, register paths, serial check slot for expensive checks, fail-first for every new check, report CLAIMED, independent review -- `team/PROTOCOL.md`, `docs/agent-work/2026-10-24-delegation/DELEGATION.md` lines 8-20.
- Workspace: smallest change, surgical, no unrelated tidying; user's runtime report outranks static checks -- `/Users/ethansiegel/Local Projects/VC Projects/AGENTS.md`.

## Approach
Eight independent board tasks (disjoint files), each a Sonnet worker plus a non-author reviewer, run two at a time through the serial slot. Rejected: one combined task (shared App.tsx/ExportPanel edits would serialise anyway and one rejection would block all eight). Rejected: raising the text cap to 20 MB to make the label true (changes a tested limit for a label).

## Tasks
### T1 -- Import label states the real limits
- Files: modify `src/components/ProjectLibrary.tsx:200`; modify `tests/import.spec.ts` (add one case) or `tests/rich-import.spec.ts`.
- Interfaces: none.
- Steps: (1) Change the label to "Import writing -- text or Markdown (up to 5 MB), Word, HTML or Markdown bundle (.zip) (up to 20 MB)". (2) Add a browser test asserting the exact label text via `getByText` on `#import-writing-label`. (3) Keep the `accept` list unchanged.
- Acceptance check: `npx playwright test -c <preview config> tests/import.spec.ts --workers=1` -> all pass including the new case; `npx tsc --noEmit -p .` -> exit 0.
- Fail-first: run the new test before step 1 -> fails on the old text.
- Stop and ask if: the label is referenced by another test's locator (grep `import-writing-label` and "up to 20 MB" under `tests/`).
- Default if unanswered: update those locators to the new text.

### T2 -- Error message names Personal Word
- Files: modify `src-tauri/src/store.rs:174`; add a Rust test in the same file's `mod tests`.
- Interfaces: none.
- Steps: (1) Grep `tests/native-reliability.js`, `scripts/native-reliability.py`, `src/` for "newer version of"; note every consumer. (2) Change the string to "This project was saved by a newer version of Personal Word. Update the app to open it." (3) Add a test that opens a temp database with `user_version` = `SCHEMA_VERSION + 1` and asserts the error contains "newer version of Personal Word". (4) Update any consumer found in step 1 to the new text.
- Acceptance check: `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 newer_version -- --test-threads=1` -> 1 passed; full offline serial cargo -> 49 passed, 1 ignored.
- Fail-first: write the test first; it fails with the old text.
- Stop and ask if: the native harness matches the old message by text (step 1 finds it) -- then the smoke binary must be rebuilt and `--suite beta` rerun under the slot; say so in the task note.
- Default if unanswered: rebuild and rerun the beta suite.

### T3 -- Notice toast never covers panel buttons
- Files: modify `src/styles.css:711-716` (and the `.error-banner` rule if shared); modify `src/App.tsx:2287-2296` only if auto-dismiss is added; add a case to `tests/features.spec.ts` or a new `tests/notice.spec.ts`.
- Interfaces: none.
- Steps: (1) Move the toast to the top centre under the tab bar (`top: 56px; bottom: auto`) or to the bottom-right corner clear of the settings panel's action column; pick top centre. (2) Add auto-dismiss after 6 s via a `setTimeout` in the effect that sets `notice`, keeping the dismiss button. (3) Browser test: trigger a notice (for example save a snapshot), open Settings, assert `getByRole("button", { name: "Export PDF" })` is visible and not obscured (`page.locator(".notice").boundingBox()` does not intersect the button's box), then click it.
- Acceptance check: the new Playwright case passes; `tests/features.spec.ts tests/editor-toolbar.spec.ts --workers=1` still pass; light/dark screenshots of the toast viewed (Read tool) show flat, square styling.
- Fail-first: the intersection assertion fails on the current CSS.
- Stop and ask if: the toast position collides with the comments or research panels at 1280x800 (check both).
- Default if unanswered: bottom-right corner with 16 px inset.

### T4 -- Gap between consecutive PDF images
- Files: modify `src/export/pdf.ts:288-289` (and the draw call at `:475-480` if needed); add a test in `src/export/document.test.ts`.
- Interfaces: none.
- Steps: (1) Give an image line `height: b.image.height + 12` and draw the image at `y + size - line.image.height - 6` so a 6 pt gap sits above and below. (2) Unit test: two stacked images; collect `drawImage` calls via a spy on `PDFPage.prototype.drawImage` (pattern in `multiparagraphNote.test.ts`) and assert the second image's top is at least 12 pt below the first's bottom. (3) Add the single-image unchanged-page-count guard (same project exports to the same page count as before).
- Acceptance check: `npx vitest run src/export/document.test.ts` -> all pass; `npx vitest run src/export` -> 180 + new.
- Fail-first: the gap assertion fails on the current code (gap 0).
- Stop and ask if: the extra 12 pt pushes any existing fixture to a new page count in `document.test.ts` (then keep the old page count by adjusting only the gap, not the image height).
- Default if unanswered: none -- must ask.

### T5 -- Section and project titles in Word and PDF
- Files: modify `src/export/document.ts:264-268`; add tests in `src/export/document.test.ts`; possibly `src/export/docx.ts` for heading styling (read first).
- Interfaces: provides `Block` with `kind: "heading"`, `level: 1 | 2` (verify the existing `Block` type in `document.ts:30-60` already has a heading kind; reuse it).
- Steps: (1) In the `project.order` loop, before `visit(e.content)`, push a level-2 heading block with `e.title` text; before the loop, push a level-1 heading block with `project.title` unless `project.templateId === "chicago"` (its title page already prints the title; confirm by reading `docx.ts` ~236-300 and record what it prints). (2) Confirm DOCX maps heading blocks to `HeadingLevel` (`docx.ts:112` area) and PDF renders heading blocks (grep `heading` in `pdf.ts`). (3) Tests: DOCX `document.xml` contains the section title as a heading paragraph; PDF text (pdftotext or `drawText` spy) contains it on page 1; Markdown and DOCX now agree on the title set. (4) Unchanged-output guard: a project whose single section has an empty title and the Chicago template exports DOCX byte-identical to before (record the pre-fix hash as T043 did).
- Acceptance check: `npx vitest run src/export src/adversarial-wp3-exports.test.ts` -> all pass; `cargo`/browser unaffected.
- Fail-first: the heading assertions fail on the current code.
- Stop and ask if: the Chicago title page already prints section titles, or the reading view / editor page view would then show titles twice (check `src/components/ReadDocument.tsx` is unaffected: it does not use `documentBlocks`, verify).
- Default if unanswered: emit section titles only; leave the project title to the title page.

### T6 -- "Jr." suffix in formatted names
- Files: modify `src/research/types.ts:2` (add `suffix?: string` to `SourceCreator`); `src/research/cslImport.ts:70-77` (carry `suffix`); `src/research/citations.ts:9-18,37,105` (append suffix: note form "Given Family, Suffix"? no: Chicago 18 note form "John Q. Smith Jr." and bibliography "Smith, John Q., Jr."); tests in `src/research/bibtexImport.test.ts:95-104` and `src/research/citations.test.ts`.
- Interfaces: provides `SourceCreator.suffix` (optional string); the Rust store treats creators as an opaque metadata map (additive field; confirm `store.rs` `validate_source` does not reject unknown creator keys: grep "creators" in `src-tauri/src/store.rs`).
- Steps: (1) Add the optional field; Rust metadata maps preserve additive fields (project `AGENTS.md`), verify by reading the creator validation in `store.rs`. (2) Map `suffix` in `cslImport.ts`. (3) Format: notes/short forms append " Jr." after the family name; bibliography inverted form "Family, Given, Suffix". (4) Tests: BibTeX "Smith, Jr., John Q." -> creators include `suffix: "Jr."`; citation note contains "John Q. Smith Jr."; bibliography contains "Smith, John Q., Jr."; a creator without suffix formats byte-identically to before (snapshot the existing expected strings).
- Acceptance check: `npx vitest run src/research` -> all pass (195 + new); `npx tsc --noEmit -p .` -> 0; `cargo test --locked --offline ... store -- --test-threads=1` -> pass (metadata round trip).
- Fail-first: the suffix assertions fail on the current code.
- Stop and ask if: `store.rs` validates creator keys with an allowlist (then the Rust allowlist must gain `suffix` and the native beta suite reruns).
- Default if unanswered: extend the allowlist and rerun `--suite beta` under the slot.

### T7 -- Browser preview does not read Zotero
- Files: modify `src/research/zotero.ts:244-275` (the browser branch) and `src/research/ResearchPanel.tsx` (message); tests `src/research/zotero.test.ts`, `tests/zotero.spec.ts`.
- Interfaces: none (the native `zotero_read` command path is unchanged).
- Steps: (1) In `fetchZoteroItems`, when not desktop, throw `new Error("Zotero refresh works in the desktop app only.")` before any network call; delete `browserRead` and the constants it alone used. (2) ResearchPanel shows that message in the status line (theme variables, `--` dashes). (3) Unit test: in browser mode `fetch` is never called (spy on `globalThis.fetch`). (4) Browser tests in `tests/zotero.spec.ts` that currently exercise the mocked fetch path must be rewritten to assert the message instead; keep the URL-guard unit tests.
- Acceptance check: `npx vitest run src/research` -> pass; production-preview `tests/zotero.spec.ts tests/research.spec.ts --workers=1` -> pass with the rewritten cases; grep `browserRead` returns nothing.
- Fail-first: the no-fetch unit test fails on the current code.
- Stop and ask if: the owner wants the browser path kept as an approved feature (then this task becomes "document and approve", not remove) -- open question 1 below.
- Default if unanswered: remove it (the plan C3 specifies the native command only).

### T8 -- Abandon-dialog import cancel is tested
- Files: modify `tests/import-cancel.spec.ts` (two cases); `src/App.tsx:1127-1130` or `ImportPreview.tsx` only if a reproduced gap appears.
- Interfaces: none.
- Steps: (1) Case A: start the slowed import (reuse the existing route delay helper), press Escape while `ImportBusy` is shown, wait for the read-done marker, assert no "Import writing" dialog and no new project before and after reload. (2) Case B: let the preview dialog open, press Escape, assert the same. (3) If either fails, repair the smallest cause (for example `ImportBusy` not forwarding Escape to `cancelImport`) with its own fail-first run retained.
- Acceptance check: `npx playwright test -c <preview config> tests/import-cancel.spec.ts --workers=1` -> 5 passed (3 existing + 2 new).
- Fail-first: n/a if both pass on the current code (record that as the finding: coverage gap closed, no product change); otherwise the failing run is the control.
- Stop and ask if: a product change is needed in a file registered to another live task.
- Default if unanswered: hand off with the failing log.

## Validation (after all tasks, in order)
1. `npx tsc --noEmit -p .` -> 0.
2. `npm test -- --no-file-parallelism --maxWorkers=1` -> all pass (865 + new).
3. `npm run build` -> 0.
4. Production-preview Playwright, one worker, no retries: `tests/import.spec.ts tests/import-cancel.spec.ts tests/rich-import.spec.ts tests/zotero.spec.ts tests/research.spec.ts tests/features.spec.ts tests/editor-toolbar.spec.ts` -> all pass.
5. `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` -> pass.
6. If T2 or T6 touched Rust-visible behaviour: isolated smoke rebuild and `python3 scripts/native-reliability.py --suite beta` -> 19 + 42; otherwise record "not applicable, no src-tauri change".
7. Regenerate `SOURCE_MANIFEST.json`/`EVIDENCE.json` with `node_modules/.cache/personal-word-beta/team-t021/make_evidence.py`, re-record the review field per `team-t023` notes, `python3 scripts/verify-beta-evidence.py ...` -> exit 2 with only the owner items pending; a normal `npm run tauri build` and marker scan if any `src/`/`src-tauri/` file changed.
8. Update README "Limitations" and `docs/validation.md` to remove each fixed item, keeping dated history.

## Risks and rollback
All changes are small and local; revert by `git checkout -- <file>` per task before commit. T5 changes export output on purpose: the unchanged-output guard limits it to projects with titles. T7 removes a code path: revert restores it.

## Open questions for the user
1. T7: remove the browser-preview Zotero fetch path (plan C3 says native only), or keep it and approve it formally?
2. T5: should Word and PDF print the project title when the template is not Chicago (default yes), and section titles always (default yes)?

## Notes for the implementer (traps, things NOT to do)
- Never run two expensive checks at once; hold the board's serial slot; pinned Node in every shell.
- Do not change the 5 MB / 20 MB limits, the `folio.*` keys or identifiers.
- A `.ts` test copy under `node_modules` cannot run (no type stripping) and a copy under `/tmp` cannot resolve `@playwright/test`; doctor via `.mjs` copies in your task cache folder.
- pdf-lib stamps creation time: compare page text and geometry, not PDF bytes.
- Report CLAIMED; only the owner's real use makes anything VERIFIED.
