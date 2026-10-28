# PLAN -- Remaining known limitations, fixed later
Date: 2026-10-25 | Architect: Claude Code (Fable 5.1) | Project: Project 13 - Word Processor | Status: DRAFT

## Goal
The limitations that remain after the cheap-fixes plan either disappear (table headers repeat in PDF, hostile zips cannot inflate past the limit, citations land inside block quotes, comments stay on the right passage, Zotero stays in sync) or become an explicit owner choice (native print with a bundled Arabic font), so the README's Limitations list holds only genuine design boundaries.

## Request
Owner, 2026-10-25: "Write another plan for everything else to be fixed later." Items: PDF table header row on continuation pages; streaming zip byte cap (Q003); citation after a block quote landing outside it; comment anchors on identical passages; Zotero polling, incremental updates and deletions (plan C3); writing-aid recomputation on large projects; native print reopened with a bundled open-licence Arabic font (Q004 option C).

## Definition of done
- A PDF table that continues onto another page repeats its header row there; a unit test asserts the header cells on page 2.
- A DOCX or Markdown bundle whose zip headers understate an entry's size is rejected before more than the declared limit has been inflated; a unit test with a crafted archive proves the cap and measures that the inflated bytes never exceed the limit.
- A citation inserted while the caret is in the last paragraph of a block quotation is placed inside that paragraph; a browser test proves it.
- A comment attached to one of two identical passages reattaches to the same one after reload and after the other passage is edited; unit and browser tests prove it.
- Zotero refresh keeps a per-source library version, requests only changes since it, marks Zotero-side deletions "unavailable" without deleting local data, and polls only when the user turns it on; synthetic tests only.
- Goal and citation summaries for a 100,000-word project recompute only when their inputs change; a benchmark test shows no recomputation on an unrelated keystroke.
- A decision on native print is recorded: either the probe passes with a bundled open-licence Arabic font (searchable lam-alef in the PDF text layer) and WP9/WP10 reopen, or the STOP stands with that font result documented.

## Non-goals
Everything in `docs/agent-work/2026-10-25-cheap-fixes/PLAN.md`. Signing, notarisation, distribution. New npm or cargo packages (a font file is an asset, not a package; its licence text goes in THIRD_PARTY.md). Word-level version comparison. Exact editor/Word page parity.

## Context (verified)
- PDF tables: rows are laid out in `src/export/pdf.ts:290-320` (one `Line` per row with `row.cells`, `colWidth`; page overflow handled by the page splitter at `:397-410`, which only knows line heights, not row roles); header cells are mapped with `cell.header` at `:144` (verified). No header-repeat logic exists (verified).
- DOCX import: `validateZipContainer(bytes, signal)` inspects the central directory before `JSZip.loadAsync(bytes)` -- `src/import/docxImport.ts:195-201`; entries are read with `entry.async("text" | "uint8array")` -- `:219,254,293`; limits in `src/import/importLimits.ts:4-9` (verified). Markdown bundle import does the same -- `src/export/markdownBundle.ts:593-654` (verified). Gate B probe: a lying header inflated about 100 MiB before rejection -- `node_modules/.cache/personal-word-beta/team-t012/lying-header-probe.log` (verified). JSZip exposes `file.internalStream("uint8array")` with `on("data")` chunks that can be aborted (inferred from JSZip 3 docs; implementer confirms in `node_modules/jszip/lib/zipObject.js`).
- Block-quote citations: `buildQuoteInsertion()` puts the footnote reference in the last paragraph of a new block quote -- `src/editor/commentAnchors.ts:434-470` (verified). The README limitation ("a citation inserted after a block quotation can appear after the block") concerns inserting a citation into an EXISTING block quote; the insertion sites are `src/App.tsx:1331` (`insertContent({ type: "footnoteReference" })`) and `:1403` (verified). Where the caret resolves when the selection is at the end of a blockquote is unknown (implementer reproduces in a browser test first).
- Comment anchors: `createCommentAnchor` / `resolveCommentAnchor` -- `src/editor/commentAnchors.ts:40,64` (verified); the existing browser test keeps the second duplicate and reattaches by selection -- `tests/comments.spec.ts:36` (verified). Anchor shape (what context it stores) is unknown; implementer reads `:40-160`.
- Zotero: `fetchZoteroItems` (`src/research/zotero.ts:244`), `fetchAllZoteroItems` (`:400`, paged, bounded 50 pages), `computeZotero3WayDiff` (`:446`), `previewZoteroChanges` (`:552`), `pollZoteroUpdates` exists but is never called (`:634`, verified); `since` / `If-Modified-Since-Version` / `Last-Modified-Version` handling exists at `:233-235,315-316,347-348` (verified). Source metadata `zoteroOrigin.itemKey` exists (per the T009 cycle-2 review, verified). Open C3 gaps listed in `docs/agent-work/2026-10-24-team-reconciliation/wp6.md` (verified).
- Writing aids: `projectSummary` recomputes from `projectIndex.current.update(null, project)` on every `project` change -- `src/App.tsx:214`; `footnoteNumbers` / `citationSections` / `citationContext` memos -- `:1357-1376` (verified); these depend on the whole `project` object, which changes on every keystroke (inferred).
- Native print: STOP recorded in `docs/agent-work/2026-10-20-beta-roadmap/05-layout/REVIEW.md`; 26 of 28 installed fonts fail the lam-alef search, two decorative ones pass -- `docs/agent-work/2026-10-24-team-reconciliation/feasibility.md` (verified); font experiments `node_modules/.cache/personal-word-beta/team-t013-review/font-search-untried.py` (verified). Probe embeds a WOFF font via `embeddedFont` -- `src/print/printProbe.ts:187-194,242,266` (verified). Owner answer to Q004: B (keep legacy), with C recorded as the reopen path (`team/QUESTIONS.md`, verified). `render_pdf` is registered only in the smoke build (verified by Gate C).
- Base state: `main` @ `72732d8`, all beta work committed and pushed (verified 2026-10-25 15:40 EDT).

## Rules in force
- Preserve writing: identifiers, additive metadata, SaveQueue, safety snapshots, never delete user data -- project `AGENTS.md`.
- Export formatting must not silently change; Chicago/Turabian guidance; no page-parity promise -- project `AGENTS.md`.
- New native bridge/font installations require separate explicit approval; no broad file/network/IPC access for the print view -- `05-layout/PLAN.md` "Rules in force".
- Team board protocol, serial slot, pinned Node, fail-first, CLAIMED -- `team/PROTOCOL.md`, `DELEGATION.md` lines 8-20.
- Synthetic Zotero only; never a real library -- `04-research/PLAN.md` C3, `wp6.md`.

## Approach
Seven independent board tasks, ordered by value and risk: header repeat and zip cap first (self-contained), block-quote citation and comment anchors next (editor behaviour, browser-tested), Zotero sync and writing-aid performance after (larger surface), native print last and only after the owner approves bundling a font. Rejected: folding Zotero sync into the cheap plan (it is the rest of a feature, not a fix). Rejected: a native-print retry without a font decision (the STOP is a font problem, not a code problem).

## Tasks
### L1 -- PDF table header row repeats on continuation pages
- Files: modify `src/export/pdf.ts:290-320` (row lines) and `:397-410` (page splitter); tests in `src/export/document.test.ts`.
- Interfaces: provides `Line.row.header: boolean` and `Line.row.tableId: string` on row lines (implementer adds to the `Line` type at the top of `pdf.ts`).
- Steps: (1) Tag each row line with its table id and whether it is a header row (from `cell.header`). (2) In the page splitter, when a page break falls between two row lines of the same table and that table has a header row, prepend a copy of the header line to the new page before the continuation row; account for its height when deciding the break. (3) A table whose header row alone exceeds the page height keeps the existing "row taller than one page" refusal. (4) Test: a 60-row table with a header row; assert page 2's first row line is the header (cell texts equal the header's) and the body rows are not duplicated or dropped (count all body rows across pages equals 60). (5) Unchanged-output guard: a one-page table exports the same page text as before.
- Acceptance check: `npx vitest run src/export/document.test.ts` -> pass; render the fixture with `pdftoppm` and view pages 1-2 (Read tool).
- Fail-first: the page-2 header assertion fails on the current code.
- Stop and ask if: the splitter cannot know the table id without restructuring `(Line | "break")[]` more than 40 lines.
- Default if unanswered: none -- must ask.

### L2 -- Streaming zip byte cap (resolves Q003)
- Files: modify `src/import/docxImport.ts:195-300` (entry reads) and `src/export/markdownBundle.ts:593-660`; add `readZipEntryBounded(entry, limit, signal)` to `src/import/importLimits.ts`; tests in `src/import/richImport.test.ts` and `src/export/markdownBundle.adversarial.test.ts`.
- Interfaces: provides `readZipEntryBounded(entry: JSZip.JSZipObject, limitBytes: number, signal?: AbortSignal): Promise<Uint8Array>` which rejects with `RangeError("... exceeds ... before inflation finished")` as soon as streamed bytes pass `limitBytes`, and a total-bytes counter shared across entries of one archive.
- Steps: (1) Implement the helper with `entry.internalStream("uint8array")`, `on("data")` accumulating into a growing buffer, `stream.pause()`/reject on overflow, `on("error")`, `on("end")`; abort via `signal`. (2) Replace every `entry.async(...)` read of DOCX parts, media and bundle assets with the bounded read using the existing per-entry and total limits. (3) Keep the central-directory pre-check. (4) Tests: craft an archive whose local header and central directory declare 1 KiB for a 300 MiB entry (the Gate B probe script shows how); assert rejection and, via a counter in the helper exposed for tests, that at most `limit + chunk` bytes were inflated; existing valid fixtures still import byte-identically.
- Acceptance check: `npx vitest run src/import src/export/markdownBundle.adversarial.test.ts` -> pass; production-preview `tests/rich-import.spec.ts tests/markdown-roundtrip.spec.ts --workers=1` -> pass.
- Fail-first: the inflated-bytes assertion fails on `entry.async` (inflates everything).
- Stop and ask if: JSZip's stream API is absent in the installed version (then the stop rule in `03-imports/PLAN.md:46` applies: report, do not add a package).
- Default if unanswered: none -- must ask.

### L3 -- Citation inside an existing block quote
- Files: `src/App.tsx:1325-1335` and `:1395-1405` (insertion sites), possibly a helper in `src/editor/commentAnchors.ts`; browser test in `tests/footnotes.spec.ts`.
- Interfaces: none.
- Steps: (1) Reproduce: type a block quote, place the caret at its end, insert a citation from the Research panel; record where the reference node lands (browser test with a DOM assertion). (2) If it lands after the blockquote, compute the insertion position as the end of the deepest textblock at the selection (`$from.end()` of the paragraph) instead of the selection head, and insert there. (3) Keep the existing behaviour for ordinary paragraphs (assert in the same test).
- Acceptance check: `npx playwright test -c <preview config> tests/footnotes.spec.ts --workers=1` -> pass with the new case.
- Fail-first: the reproduction in step 1 is the failing run; keep its log.
- Stop and ask if: the reproduction does not fail on the current build (then the README line is stale: remove it instead and close the task).
- Default if unanswered: remove the README line.

### L4 -- Comment anchors on identical passages
- Files: `src/editor/commentAnchors.ts:40-160`; migration-safe additive fields only; tests in `src/editor/commentAnchors.test.ts` and `tests/comments.spec.ts`.
- Interfaces: anchor gains optional `before` and `after` context strings (additive; old anchors without them resolve as today).
- Steps: (1) Store up to 32 characters of surrounding text on creation. (2) On resolution, when the quoted text matches more than once, prefer the match whose context matches; fall back to the current rule. (3) Unit tests: two identical passages, anchor on the second, edit the first, resolve -> still the second; legacy anchor without context still resolves. (4) Browser test extending `tests/comments.spec.ts:36`: duplicate passage, reload, the comment jumps to the original passage.
- Acceptance check: `npx vitest run src/editor/commentAnchors.test.ts` and the browser spec -> pass; `cargo test ... store` -> metadata round trip of the new fields.
- Fail-first: the "still the second" assertion fails on the current resolver.
- Stop and ask if: anchors are validated by an allowlist in `store.rs` (grep `anchor`) -- then the allowlist and the native beta suite are in scope.
- Default if unanswered: extend the allowlist and rerun `--suite beta`.

### L5 -- Zotero incremental sync, deletions, optional polling (rest of C3)
- Files: `src/research/zotero.ts:400-700`, `src/research/ResearchPanel.tsx` (Zotero section), `src/research/types.ts` (additive `zoteroOrigin.version`, `source.unavailable?: boolean`), tests `src/research/zotero.test.ts`, `tests/zotero.spec.ts`; Rust `src-tauri/src/zotero.rs` only if the native command needs a `since` parameter (read it first).
- Interfaces: provides `zoteroOrigin.libraryVersion: number` per source, `source.unavailable` flag, `pollZoteroUpdates` wired to a user-visible toggle (off by default).
- Steps: (1) Persist the `Last-Modified-Version` from the last successful refresh on each imported source. (2) Refresh sends `since` and merges only returned items through the existing review dialog. (3) Fetch `/deleted?since=` (Zotero local API) and mark matching sources `unavailable` in the review dialog; never delete local data. (4) Wire `pollZoteroUpdates` to a toggle in the Research panel, default off, with the existing loopback limits. (5) Distinct messages for Zotero down, 403, and API-version mismatch (`Zotero-API-Version` header). (6) Synthetic mock server tests for each.
- Acceptance check: `npx vitest run src/research` -> pass; production-preview `tests/zotero.spec.ts tests/research.spec.ts --workers=1` -> pass; `cargo test ... zotero` -> pass; no process listens on 23119 during tests.
- Fail-first: each new unit test fails on the current code.
- Stop and ask if: the Zotero local API's deleted-items endpoint is undocumented for the local server (then skip step 3 and record it).
- Default if unanswered: skip deletions, keep the rest.

### L6 -- Writing-aid and summary recomputation on large projects
- Files: `src/App.tsx:214,1357-1376`; possibly `src/research/noteForms.ts`; benchmark in `tests/performance.spec.ts`.
- Interfaces: none.
- Steps: (1) Measure: on the 100k-word fixture in `tests/performance.spec.ts`, count calls to `resolveCitationContext` and `projectIndex.update` per keystroke (temporary counters in a test build). (2) Key the memos on the inputs they read (entry order, entry contents hash, research footnotes) rather than the whole `project` object; `projectIndex.update` already takes a previous value: pass it. (3) Benchmark assertion: zero recomputations of citation context on a keystroke that changes no footnote reference; existing input-to-editor p95 budgets unchanged.
- Acceptance check: `npx playwright test -c <preview config> tests/performance.spec.ts --workers=1` -> pass with the new assertion.
- Fail-first: the zero-recomputation assertion fails on the current memo keys.
- Stop and ask if: the recomputation is needed for correctness (a footnote number can change on any edit) -- then narrow to "recompute only when footnote references changed".
- Default if unanswered: the narrowed version.

### L7 -- Native print retry with a bundled open-licence Arabic font (Q004 option C)
- Files: `src/print/printProbe.ts:187-270` (font embedding), `tests/native-print.js`, `scripts/native-print-smoke.py`, `THIRD_PARTY.md` (licence text), a font file under `src-tauri/resources/fonts/` or `src/export/fonts/` (read `src/export/fonts.ts` for the existing Noto shard layout); no public export route.
- Interfaces: none until a PASS; a PASS reopens `05-layout/PLAN.md` L2/L3 as new board tasks.
- Steps: (0) Stop first: bundling a font needs the owner's explicit approval (`05-layout/PLAN.md` rules); ask with the candidate (Noto Naskh Arabic, SIL OFL) and its size. (1) Embed it as the probe's Arabic font via `embeddedFont`. (2) Rebuild the smoke binary; run `python3 scripts/native-print-smoke.py --probe`; the searchable-text assertion must find the lam-alef word via `pdftotext` and PDFKit search (the reviewer's `font-search-untried.py` shows the search). (3) Record PASS or STOP in a dated section of `05-layout/REVIEW.md` through the independent review path (T014-style task). (4) On PASS, file L2 and L3 of the layout plan as board tasks; on STOP, record the font result and close.
- Acceptance check: `PROBE_RESULT: PASS` with `letter:searchable-text` and `a4:searchable-text` passing and all four negative controls detected; or a documented STOP.
- Fail-first: the current probe run is the failing control (`print-smoke/runs/20261025T074258Z-7930e721`).
- Stop and ask if: no open-licence font makes the search pass (then the STOP is final and the README keeps the limitation).
- Default if unanswered: none -- must ask (font bundling is an approval item).

## Validation (after all tasks, in order)
1. `npx tsc --noEmit -p .`; `npm test -- --no-file-parallelism --maxWorkers=1`; `npm run build`.
2. Full production-preview Playwright, one worker, no retries (the `c2r-full.config.mjs` shape on a free port).
3. `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1`.
4. Isolated smoke rebuild, `--suite baseline` and `--suite beta` (L4/L5 change stored metadata; L7 changes the probe).
5. Regenerate the evidence manifest and record the independent review; `scripts/verify-beta-evidence.py` -> exit 2 with owner items only; normal `npm run tauri build` and marker scan.
6. README and `docs/validation.md`: remove each fixed limitation with a dated note; Gate-style independent review before commit.

## Risks and rollback
L2 touches every import read path: a bug there blocks all rich imports, so its unchanged-fixture tests are the guard; revert the helper call sites to `entry.async` to roll back. L4/L5 add stored fields: additive only, old data unaffected; rolling back code leaves harmless extra fields. L7 adds a font asset and its licence: removing both restores the current state. L1 changes PDF pagination for tables only.

## Open questions for the user
1. L7: approve bundling an open-licence Arabic font (candidate Noto Naskh Arabic, SIL OFL, roughly 300 KB) for the probe? Without it L7 does not start.
2. L5: is Zotero polling wanted at all, or is "refresh on demand with incremental updates and deletions" enough? Default: no polling.
3. Priority order confirmation: L1, L2, L3, L4, L5, L6, L7.

## Notes for the implementer (traps, things NOT to do)
- Never delete local sources on a Zotero deletion; mark unavailable.
- Never widen the print view's privileges to fix fonts; the font must be embedded as data.
- pdf-lib output hashes change per export; compare text and geometry.
- Board rules apply: one task at a time per file set, serial slot, pinned Node, fail-first, CLAIMED.

## Added 2026-10-26 from the UI polish critique and reviews (not yet planned in detail)
- L8 Native screenshots capture at 1x on the external monitor (board T090, Low): request a 2x snapshot in `smoke_snapshot` (WKSnapshotConfiguration snapshotWidth) or run on the Retina display.
- L9 Plain palette dark-mode primary button contrast 2.45:1 (board T087, recorded only): owner decision; option is a darker fill for `.primary` in Plain dark with white text.
- L10 Drag-and-drop import hardening (T080 review): consume a dropped path one-shot after a successful read; open with O_NOFOLLOW; also record drops from the webview event if the owner's Finder drag records nothing.
- L11 Settings "Export document" intro paragraph still reads like a caption; Goals numeric labels darker than the muted `.settings-label` rows (T094/T095 reviews).
- L12 Hovering an entry row hides its word count (T092 fade-replace); consider showing the count on hover and arrows on focus only.

## Added 2026-10-27 from UI wave 2 (not yet planned in detail)
- L13 Web article reader (a reading view for a source's web page): a non-goal of UI wave 2; no design recorded yet.
- L14 Carry source PDFs inside the project archive (`.json`) and the Markdown bundle, so a project moved that way keeps its attachments. Today the bytes stay in the project folder and the attachment is lost on that path.
- L15 Toolbar label mode threshold (open question 3 of the wave-2 plan): raise `LABEL_MIN_WIDTH` to about 1600-1900 px, or shorten the labels. Measured cliff: bar 1099 px icons = 9 of 13 groups; bar 1100 px labels = 3 of 13.
- L16 Passage restore can be overwritten while the save queue is pending (pre-existing, single pane too): the restored content is written, the editors remount after the queue drains, and typing in that window overwrites it. Data safety; highest priority in this list.
- L17 More menu stays open after clicking one of its rows (U4/U6); also the cause of the split-view menus test flake (about 2 in 20).
- L18 Plain palette: a brief accent-blue flash while pressing an UNSELECTED sidebar row; Color `:active` on a selected group title uses `--accent` rather than its tint.
- L19 `slideHighlight(null)` mid-slide snaps the box before fading (minor).
- L20 Flaky tests under load: `src/adversarial-wp3-exports.test.ts` (raise the 5 s timeout to about 15 s), `tests/notice.spec.ts` toast-cover, `tests/performance.spec.ts`, `tests/research.spec.ts:176` captured-quote undo.
- L21 Group-title line-height tied to `--icon-size` (mild smell, U3).
- L22 Native checks for the wave-2 menus: Escape on the create control, native Popover open/close/reverse and Mac Reduce Motion, and Insert image from the More menu (no native run opens a menu).
- L23 Removing a PDF (or deleting its source) while it is open beside leaves the split showing the "not stored" alert instead of closing the pane; `prune()` in `src/split.ts` checks that the source exists, not that it still has a PDF.
- L24 The PDF size label only counts up to KB (25 MB is shown as "25600.0 KB"), `src/research/ResearchPanel.tsx` `.source-pdf-size`.
- L25 `tests/research-pdf.spec.ts:33` starts the network check after the first load, so first-load requests are unchecked.
