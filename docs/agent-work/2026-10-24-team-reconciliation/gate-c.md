# Review Gate C -- layout wave (team task T017)

Reviewer: agent-c57f (Claude Opus, independent; authored none of WP8-WP10 or their reviews),
2026-10-25 (07:38-07:50 UTC). Status: CLAIMED (owner real use not performed).

**Verdict: PASS as a documented STOP.** The WP8/L1 feasibility STOP is reproduced; the legacy
pdf-lib exporter is preserved byte-for-byte and still refuses what it cannot render; no public
route reaches the native print path; user-facing warnings and docs describe the legacy limits
accurately; WP9/WP10 are not applicable and were cancelled without code. Three findings (F1-F3)
are recorded below; none of them is a Gate C failure.

Inputs read: `team/PLAN.md`, `team/PROTOCOL.md`, DELEGATION.md (Wave 4, gate C, review-gate rules),
`05-layout/PLAN.md` (L1-L3 in full), `05-layout/REVIEW.md` (T014 STOP section),
`05-layout/IMPLEMENTATION_LOG.md`, `wp8.md`, `feasibility.md`, decisions "Off-board WP8/WP11 files
adopted" and "WP9/WP10 cancelled: WP8 feasibility STOP", Q004 (open), task logs T013-T017.

All logs below are in `node_modules/.cache/personal-word-beta/team-t017/` unless a path is given.
Node v22.23.3 (pinned; `node-version.log`). HEAD `ee2fe3a`.

## 1. Evidence table

| # | Check | Command / method | Log | Result |
|---|---|---|---|---|
| 1 | Legacy exporter unchanged | `shasum -a 256 src/export/pdf.ts` vs `git show HEAD:src/export/pdf.ts \| shasum -a 256` | `identity.log` | both `ffef585b...d359da396`; `git diff --stat` empty |
| 2 | Script-matrix refusal present | read `src/export/pdf.ts:78-93` (`shapeError`: any letter outside Latin/Greek/Cyrillic, or a glyph missing from the bundled shards, throws "...needs script shaping... export it as DOCX instead.") | -- | present |
| 3 | Overlong-note refusal present | read `src/export/pdf.ts:369-373` ("A footnote is too long to fit on one PDF page. Export DOCX for flowing footnotes.") | -- | present, but **not covered by any repo test** (F1) |
| 4 | Export units | `npx vitest run src/export src/adversarial-wp3-exports.test.ts --reporter=verbose` | `vitest-export.log`, `vitest-export-verbose.log` | exit 0; 6 files / 167 tests. `src/export` alone = 5 files / 138 (document 22, textExport 21, markdownBundle 12, .schema 44, .adversarial 39); adversarial-wp3-exports 29. Includes `document.test.ts` "rejects scripts that need shaping" (Arabic) and "throws instead of clipping a table row taller than a page" |
| 5 | Refusals probed directly | reviewer harness `gatec-artifacts.test.ts` (cache folder only; config `vitest.gatec.config.mjs`) | `artifacts.log` | exit 0, 3/3: Arabic `السلام عليكم` rejected "needs script shaping"; a 600-sentence note rejected with the exact overlong message; DOCX of the same project still exports |
| 6 | Harness can fail | control copy `gatec-control.test.ts` (Latin text, 1-sentence note) | `artifacts-control.log` | exit 1, both refusal checks FAIL ("promise resolved Blob ... instead of rejecting"; "expected undefined to be 'A footnote is too long...'") -- the probes are not vacuous |
| 7 | Legacy PDF artifact | same harness, `exportPdf(project, undefined, imageAssets())`; `pdfinfo`, `pdffonts`, `pdftotext -layout`, `pdftoppm -r 80` | `pdfinfo.log`, `pdffonts.log`, `artifacts/gate-c.txt`, `artifacts/page-{1,2,3}.png` | 3 Letter pages 612x792; 5 embedded Noto Serif CID subsets (Identity-H, uni yes). All 3 pages viewed: heading, Latin/Greek/Cyrillic, strike, hard break, nested list (4.), long token split at code points, table with header row and a cell note, image, notes 1-2 under a rule on p.1, explicit break to p.2 with note 3, bibliography p.3, page numbers. No clipping, overlap or missing glyphs seen |
| 8 | Legacy DOCX artifact | same harness, `exportDocx`; XML read after unzip; `qlmanage -t` thumbnail | `docx-xml.log`, `artifacts/docx-ql/gate-c.docx.png` | 1 `<w:drawing>`, 1 `<w:tbl>`, 3 `<w:tblHeader`, 3 `<w:footnoteReference`, 2 page breaks; footnotes.xml holds all 3 notes incl. the Chicago note. Thumbnail shows text/table/image; QuickLook shows no footnote area or page breaks (renderer limit, not a defect) |
| 9 | No public route to native print | `grep -rnE "render_pdf\|nativePdf\|printProbe\|renderNativePdf\|native-v2\|native_print" src` minus `src/print/`; grep for imports of `print/` outside `src/print/` | `public-route.log` | no match outside `src/print/` (the log's "grep exit 0" line is the unfiltered grep matching inside `src/print/`; the filtered list is empty). `src/print/*` imports only `model`, `assets/types`, tauri `invoke` |
| 10 | `render_pdf` registration | read `src-tauri/src/lib.rs` | `public-route.log` | `printing::render_pdf` only in the `#[cfg(feature = "native-smoke")]` handler (line 263); the `#[cfg(not(feature = "native-smoke"))]` handler (266-283) lacks it; `mod printing` carries `cfg_attr(not(native-smoke), allow(dead_code))` (lines 7-9) |
| 11 | Normal build compiles | `cargo check --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1` | `cargo-check-normal.log` | exit 0, 0 warnings (42 s) |
| 12 | Smoke build compiles | same `--features native-smoke` | `cargo-check-smoke.log` | exit 0, 0 warnings (2.4 s, already cached). Diagnostic binary `src-tauri/target/debug/folio` `a15f40b3...` unchanged before/after (`binary-before.txt`) |
| 13 | WP8 identity | compare `result.json` identity of runs `20261025T070701Z-642a1146` and `20261025T072108Z-e51b1619` with current files | `identity-check.log` | all 10 hashes equal (binary a15f40b3, native-print.js 7ee4ef20, printing.rs 0ac9a4d6, smoke.rs 6c8bd4de, lib.rs b8aaaea3, Cargo.toml dce53be1, nativePdf.ts 072d93f8, printProbe.ts ead14277, native-print-fixtures.mjs 033417b7, native-print-smoke.py 6445c757) -> no rebuild |
| 14 | STOP reproduced | `python3 scripts/native-print-smoke.py --probe --timeout 420` (isolated `com.folio.smoke`, no rebuild) | `probe-rerun.log`; run `node_modules/.cache/personal-word-beta/print-smoke/runs/20261025T074258Z-7930e721/` | `PROBE_RESULT: STOP -- failing: letter:searchable-text, a4:searchable-text` (missing `السلام عليكم`); every other assertion PASS; 4/4 checker controls DETECTED; 7 boundary rejections + native readiness refusal; 0 loopback requests in launch A. ~11 s. Viewed `pages/letter-1.png` (headers/footers, Latin/Greek/Cyrillic/Hebrew pointed/Arabic joined, mixed bidi line, 3-script table, swatch image, note ref) and `pages/note-flow-2.png` (note continues PWS069-PWS120, no gap). No `folio` process left (`pgrep` empty) |
| 15 | Preservation | `git status --porcelain` for deletions; `git diff --stat` on capabilities, Cargo.lock, Cargo.toml | `preservation.log` | no deleted tracked file; `src-tauri/capabilities/default.json` unchanged (`df445a89`); `Cargo.lock` +5 lines, only the `folio` dependency edges block2, objc2, objc2-app-kit, objc2-foundation, objc2-web-kit (no new packages) |
| 16 | WP9/WP10 not implemented | existence check of every L2/L3-only path | (this review, T016 review note) | absent: `src/print/{document,fontPolicy,pagination,footnotes}.ts` and their tests, `PrintPreview.tsx`, `print.css`, `tests/print-preview.spec.ts`, `tests/fixtures/print/`, `wp9.md`, `wp10.md`. `src/print/` holds only T013's `nativePdf.ts`, `nativePdf.test.ts`, `printProbe.ts` |
| 17 | User-facing wording | grep README.md, ROADMAP.md, docs/*.md, src for "print preview", "native-v2", "exact PDF", "PDF preview", "native typography", "per-page footnote", "flowing footnote", "native print", "WKWebView" | `docs-promises.log` | no promise of an exact/native PDF preview, native typography or per-page footnote flow. See section 3 |

Artifact hashes (SHA-256):
- `artifacts/gate-c.pdf` 22156 bytes `f361b9212acff45eaaba7e7f214ce3f8e28191a3bf7d95e2899ccda4c1a271a3`
  (pdf-lib embeds the creation time, so a regenerated PDF will hash differently)
- `artifacts/gate-c.docx` 12402 bytes `7731c7adbf337034b137cc49e77f7fa6f20511a3499861cd273fd73e0af07c3b`
- `05-layout/REVIEW.md` before my append: `dd352246...60d7714`, 41 lines (`review-md-before.txt`).

## 2. WP9 / WP10 non-applicability

- `05-layout/PLAN.md` L1 stop rule: stop if native print cannot satisfy "pagination / searchable
  shaping". Default if unanswered: "retain legacy PDF and label new path experimental/unavailable;
  do not remove script/long-note warnings or claim parity". Q004 (accept limitation / cancel /
  try a bundled OFL Arabic font) is still open, so the default governs.
- L2 (WP9) and L3 (WP10) build on a native-v2 engine that L1 did not qualify. Both were cancelled
  through the board procedure in the decision "WP9/WP10 cancelled: WP8 feasibility STOP":
  T015 done "not needed" (approved by agent-b8ae), T016 done "not needed" (approved by me,
  agent-c57f, after checking no WP10 file exists). No L2/L3 code exists (row 16).
- The native path is "unavailable" in the strongest sense: it is compiled only as dead code into
  normal builds and its command is registered only in the native-smoke diagnostic build. There is
  no UI to label, so no "experimental" label is needed or present.
- Reopen path: owner answers Q004 A or C, a new reviewed probe passes (or records the accepted
  limitation under A), then new L2/L3 tasks are added. The old T015/T016 stay closed.

## 3. Wording check (for T020)

Checked and accurate -- no edit needed for Gate C:
- `src/export/ExportPanel.tsx:133-140` help text: own pagination, bundled Noto subsets instead of
  the document font, Latin/Latin Extended/Greek/Cyrillic only, other scripts rejected with DOCX as
  the alternative, overlong notes reported rather than truncated. Matches `pdf.ts`.
- `README.md:113-114` ("Page breaks differ between views", "PDF uses bundled fonts ... A footnote
  too long to fit on one page is also refused").
- `docs/architecture.md:49`, `ROADMAP.md:8` ("complex-script shaping and long-note overflow remain
  open"), `docs/validation.md:60,68`, `docs/publication-readiness.md:32`.
- `docs/personal-word-v2.md:16` "in-app PDF preview": accurate for the legacy "Preview PDF" button
  (`ExportPanel.tsx:234-255` shows the pdf-lib blob in an iframe). It is not a native/exact preview
  and does not claim to be; it calls `exportPdf` separately from Save, so preview and saved bytes
  are not claimed identical. If T020 touches this line, "legacy PDF preview" would be clearer, but
  it is not wrong.

## 4. Findings

- **F1 (test gap, priority 3, filed as T041).** The legacy overlong-footnote refusal
  (`src/export/pdf.ts:369-373`) has no repo test; only the script refusal (`document.test.ts:234`)
  and tall table row (`:525`) are tested. My cache-folder harness proves the refusal works today
  (rows 5-6) but is not part of `npm test`. T041 adds the unit with fail-first; `pdf.ts` must not
  change.
- **F2 (docs accuracy, for T020 and T018/T021).** `docs/validation.md:256-300` (uncommitted,
  off-board WP11 text, section "Beta Durability & Verification Qualification") presents a finished
  beta qualification and lists "print probe integration" among qualified features (line 258).
  For Gate C: the print probe is a STOP, not a delivered feature; this line should say the native
  print probe ended in a documented STOP and the legacy PDF exporter remains the only PDF route.
  The rest of that section's claims (818 units / 44 files, 38 Rust tests, native beta 18+8,
  verified evidence manifest, clean release build) are not board-verified and differ from current
  counts (full units were 847 / 45 at T038; T013 reported 47 Rust tests); I did not judge them --
  T018 (WP11), T021 (evidence) and T020 (docs) must re-derive them from their own runs.
- **F3 (informational, for T019).** pdf-lib output is timestamped, so legacy PDF hashes are not
  reproducible across runs; artifact inspection should compare rendered pages/text, not PDF hashes.
  QuickLook DOCX thumbnails omit the footnote area and page breaks; no LibreOffice/Word is
  installed here, so DOCX evidence is XML plus thumbnail only.

## 5. WP11-relevant drift (observed, not judged) -- for T018

From `wp11-drift.log`:
- `src-tauri/src/smoke.rs` (+35/-11 vs HEAD) carries off-board WP11 `VALID_CHECKPOINTS`
  validation in `arm_checkpoint` and a changed `verify_safety_snapshot`, next to T013's
  `native-print` arm.
- `src-tauri/src/store.rs` (+35/-2) carries `#[cfg(feature = "native-smoke")]` checkpoints
  (`beta-crash-asset-stage-vs-content`, `post-asset-stage`, `beta-crash-source-merge`,
  `post-merge-safety-snapshot`, `beta-crash-snapshot-restore`, `post-restore-safety-snapshot`).
- `src-tauri/src/printing.rs` is compiled into normal builds as dead code (`allow(dead_code)`);
  the normal handler does not register it. T021's smoke-marker scan of the normal app should
  expect the printing symbols may be present but unreachable, or strip-check accordingly.
- `tempfile = "3"` is now a normal (non-dev) dependency because `printing.rs:596` uses it at
  runtime; `Cargo.toml` also gains a macOS-only target block for objc2/block2/objc2-* features.
- The probe writes runs into `node_modules/.cache/personal-word-beta/print-smoke/runs/` (this
  review added `20261025T074258Z-7930e721`).

## 6. Boundaries

- Export units and artifacts ran under Node/vitest (pdf-lib, docx), not Chromium or the native
  WebView; the legacy exporter is pure JS so this is its real code path, but no in-app click or
  native save dialog was exercised.
- PDF rendered with Poppler `pdftoppm`; DOCX inspected as XML plus a QuickLook thumbnail. Not
  Microsoft Word, not LibreOffice.
- Native probe: macOS 15.7.9, Intel x86_64, this Mac's fonts only. No Apple Silicon, other macOS
  version, other font sets, or bundled OFL Arabic font.
- No normal `npm run tauri build` made (T021's job); `cargo check` proves compilation only.
- Owner real use: none. Everything here is CLAIMED, not VERIFIED.

## 7. What later tasks must know

- **T018 (WP11):** section 5 drift is yours to adopt or repair; do not touch `printing.rs`, the
  `native-print` arm of `smoke.rs`, or the `render_pdf` line in the smoke handler without a new
  layout task. Keep `render_pdf` out of the normal handler.
- **T019 (artifact inspection):** legacy PDF/DOCX baseline here (`team-t017/artifacts/`); PDF
  hashes are timestamped (F3). Native print pages are only probe evidence, not a product feature.
- **T020 (docs):** F2 (`docs/validation.md:258` "print probe integration"); state that the native
  print path ended in a documented STOP (Arabic lam-alef not searchable with body-text fonts),
  Q004 is open, and the legacy exporter's limits stand. Section 3 lists lines already accurate.
- **T021 (evidence):** use run `20261025T074258Z-7930e721` (or T014's `20261025T072108Z-e51b1619`)
  as the WP8 STOP evidence; record the gate as "PASS as a documented STOP", never as a layout pass.
