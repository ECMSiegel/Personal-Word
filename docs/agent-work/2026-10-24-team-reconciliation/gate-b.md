# Review Gate B -- WP5 (I2), WP6 (C3), WP7 (I3) and the Wave 3 integration (team task T012)

Date: 2026-10-25 (05:06-05:40 UTC) | Reviewer: agent-81ae (Claude Opus; authored none of WP5-WP7, T011 or the earlier Gate B text) | Status of the reviewed work: CLAIMED (no owner real-use confirmation).

Logs: `node_modules/.cache/personal-word-beta/team-t011-review/` (below `$A`, my T011 reruns, which count as this gate's executed evidence for the current tree) and `node_modules/.cache/personal-word-beta/team-t012/` (below `$B`). Pinned Node v22.23.3 in every run (`$A/node-version.log`, `$B/node-version.log`). One expensive check at a time, serial slot held throughout (T031, then T012).

## Verdict: Gate B PASS (evidence-limited)

Every required Gate B check was executed on the current tree and passed; no run failed; the open questions handed to this gate were investigated and none is a defect that blocks the gate. The pass is limited to what was run: Chromium on a production preview, Node units, offline Rust tests. No WebKit, no native Tauri run of any Wave 3 path, no hosted CI, no real Zotero. Behaviour stays CLAIMED until the owner uses it.

The earlier "APPROVE Review Gate B" sections in `03-imports/REVIEW.md` and `04-research/REVIEW.md` (2026-10-24) rested on `playwright --list` and older unit counts; their evidence basis is superseded by this report. Their text is left as written.

Four findings are recorded as follow-up repair work (below). None is a data-loss, fetch, or script-execution defect, and each sits outside what DELEGATION.md assigned to WP5-WP7 or is a narrow accuracy issue, so they do not hold the layout wave.

## Executed evidence

| Check | Command | Log | Result |
|---|---|---|---|
| Types | `npx tsc --noEmit -p .` | `$A/tsc.log` | exit 0 |
| Full units | `npm test -- --no-file-parallelism --maxWorkers=1` | `$A/vitest.log` | exit 0, 44 files / 837 tests |
| Build | `npm run build` | `$A/build.log` | exit 0 (dist used by every browser run below) |
| Browser (production preview, port 1469) | `npx playwright test -c $A/browser.config.mjs tests/import.spec.ts tests/rich-import.spec.ts tests/markdown-roundtrip.spec.ts tests/zotero.spec.ts tests/research.spec.ts --workers=1` | `$A/browser.log` | exit 0, **31 passed, executed** (not listed): import 2, rich-import 5, markdown-roundtrip 11 (no `test.fail` left), research 9, zotero 4 |
| Rust (offline, serial) | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | `$A/cargo.log` | exit 0, 44 passed / 1 ignored; includes all 13 `zotero::tests` (loopback-only, credentials, ports, schemes, traversal, no redirects, 12 s config, timeout, 5 MiB cap as error, 304) |
| I2 units incl. malicious fixtures | `npx vitest run src/import src/adversarial-wp5.test.ts` | `$B/units-import-wp5.log` | exit 0, 4 files / 79 tests |
| C3 units | `npx vitest run src/research` | `$B/units-research.log` | exit 0, 11 files / 195 tests |
| I3 units | `npx vitest run src/export src/adversarial-wp7-exportpanel.test.ts` | `$B/units-export-wp7.log` | exit 0, 6 files / 143 tests |
| Pre-inflation guard control, **re-executed** on current source | T008 reviewer's harness copied to `$B/limits-control/` (rebuilds `real.mjs` from current `docxImport.ts`/`importLimits.ts`, and `doctored.mjs` with the size/ratio/zero-compressed guards disabled); `node build.mjs; node drive.mjs real; node drive.mjs doctored` | `$B/limits-control.log` | real: ALL PASS, exit 0 (zip-bomb, traversal, encrypted rejected with `loadAsync` never called; spy live on minimal.docx). doctored: zip-bomb FAILS (`loadAsync` called), exit 1. Source sha1 unchanged before/after (`$B/limits-control/source-sha1-*.txt`) |
| Understated-size zip probe (new) | `$B/limits-control/lying-header-probe.mjs` | `$B/lying-header-probe.log` | DOCX whose headers claim 1 000 bytes for a 300 MiB entry passes the pre-inflation check; JSZip rejects it after inflating ("uncompressed data size mismatch"); RSS rose about 100 MiB. See boundary B4 |
| Browser probes (port 1471) | `npx playwright test -c $B/probe.config.mjs --workers=1` (`$B/probe/gateb-probe.spec.mjs`) | `$B/probe.log` | exit 0, 3 passed: P1 image count, P2 external image relationship, P3 watcher liveness |
| T011 doctored control | `.mjs` copy of the round-trip spec with the cancel assertion inverted | `$A/control.log` | exit 1, "Expected 2, Received 1" (the cancel assertion is live); T011 files byte-identical before/after |

### Fail-first spot checks (one per WP)
- WP5: `team-t008/browser-pass1.log` -- 4 failed / 1 passed on a production preview (the old `/src` imports never ran there). Re-executed control: the limits harness above (doctored exit 1, real exit 0) on today's source.
- WP6: `team-t009-repair/cargo-failfirst-mutants.log` -- four doctored copies of `zotero.rs` (redirects on, status check off, silent `.take`, no timeout) each `exit=101` (2/1/2/2 failed); restore `exit=0`, restored hash `03bde130...` equals today's file.
- WP7: `team-t010/controls-summary.txt` -- c1, c2, c4, c5, c6 `playwright_exit=1`, all `identical=True`; c3 exit 0 explained in wp7.md (a third independent check in `textExport.ts`). `ctl-c4-sha-check-removed.log`: 1 failed.
- Integration (T011): the author's four doctored controls (`team-t011/controls-summary*.txt`, all `playwright=1`, `identical=True`) plus my inverted-assertion control above.

## Source identities (sha256, current tree, `$B/source-hashes.txt`)

Equal to the hash recorded by the approving review unless noted. WP5 files have no hash recorded by T008's review; for them the check is that none changed after T008 was approved (03:45 UTC) except T011's registered `docxImport.ts`/`importLimits.ts` (find -newer, nothing else).

| File | sha256 (first 16) | Matches |
|---|---|---|
| src/import/docxImport.ts | 6f03db25c07fb691 | T011 end hash |
| src/import/importLimits.ts | 1a082ecba880276b | T011 end hash |
| src/import/htmlImport.ts | 2bc013ae562fa98c | unchanged since 2026-10-24 13:58 EDT |
| src/import/richImport.test.ts, src/import/ImportPreview.tsx, src/adversarial-wp5.test.ts, tests/rich-import.spec.ts, tests/fixtures/rich-import/* | see `$B/source-hashes.txt` | unchanged since before T008 approval |
| src/research/zotero.ts | 123339e52df0176b | T009 repair final / T009 review 2 |
| src/research/zotero.test.ts | 49f42b17aa50aa64 | same |
| src/research/zotero.adversarial.test.ts | 935da6511be11de4 | same |
| src/research/bibtexImport.ts | 25159201f3f60cfd | same |
| src/research/bibtexImport.test.ts | 67316bc66935e7f8 | same |
| src/research/ResearchPanel.tsx | 608b27c9eccd56a5 | same |
| src/research/CslImportPreview.tsx | 7d76f68dd56bdfff | same |
| src-tauri/src/zotero.rs | 03bde130cddad6b4 | same |
| tests/zotero.spec.ts | f34c3db982fc0844 | same |
| tests/fixtures/sample.bib | 49ca02a04128da88 | same |
| src/export/markdownBundle.ts | 937402b4c7b23d18 | T011 end hash (T010's 2634e22f plus T011's two reviewed hunks) |
| src/export/markdownBundle.schema.test.ts | b59846ec89f875f6 | T011 end hash (T010's 74ebe0ab plus one test) |
| tests/markdown-roundtrip.spec.ts | 7ac2c57c4568ffc5 | T011 end hash (T010's 6ec64ee7 minus `test.fail`, plus 3 tests) |
| src/export/markdownBundle.test.ts | c28d523804079e39 | T010 review |
| src/export/markdownBundle.adversarial.test.ts | d90b8cb8370e1d82 | T010 review |
| src/export/ExportPanel.tsx | 1486e06158c910f4 | T010 review |
| src/adversarial-wp7-exportpanel.test.ts | aa4a5c3f97de978c | T010 review |
| src/export/textExport.ts | 87827f719e34bde9 | T010 review |
| src/App.tsx | 9e5ece91396e892e | T011 start and end |
| src/components/ProjectLibrary.tsx | 9430adf388b27b69 | T011 end hash |
| src-tauri/src/lib.rs | 8ad94633cb0edee0 | T011 start-stat (unchanged) |
| playwright.config.ts | 384e323e1620fd7e | T011 start-stat (unchanged) |

No file under `src/`, `tests/` or `src-tauri/src/` changed after T011 finished (01:05 EDT). WP6 files: nothing newer than the T009 approval. WP7 files: only T011's three registered files are newer than the T010 approval.

## Plan check, per package

- **WP5 / I2** (DOCX/HTML with the approved DOMParser, no-worker, no-parse5 deviation): entry count, per-entry, total and ratio checks run on the central directory before JSZip inflates (re-executed control); encrypted, traversal and zip-bomb fixtures are rejected with clear messages; HTML is parsed inert (malicious fixture: no request, no `__pwned`, active content and remote image warned); preview shows counts and warnings; Cancel creates nothing, also after reload (T011 test with DOCX and HTML). External image relationships: now executed (P2) -- the warning "External image reference (https://example.invalid/remote.png) was omitted; remote network resources are never fetched." appears, zero off-origin requests before and after confirming, and no `example.invalid` reaches the editor; the external hyperlink keeps its `href` as a link mark and is not fetched.
- **WP6 / C3** (as delegated: BibTeX routing, one-way refresh, off by default, loopback GET only, reviewed per-field preview): met. `checkZoteroUrl` pins `127.0.0.1:23119` and `/api/` before either path; the desktop app calls the native `zotero_read` command, which is registered in both invoke-handler branches of `lib.rs` (lines 250, 281) and re-validates the URL. The browser `fetch` branch runs only when `isNativeApp()` is false (preview/tests), so it is a test-path deviation, not a way around the loopback rule.
- **WP7 / I3**: `manuscript.md` + `assets/<sha>.<ext>` + `manifest.json`; hashes verified on import; bounded by the same `validateZipContainer`; manifest format/version/missing-asset rejected. The UI round trip (export -> download -> import through `#import-writing-text` -> ImportPreview -> project) now runs end to end, and the imported image still decodes after reload.
- **Integration (T011)**: approved by me separately (board T011). App needed no change: `importWriting -> previewWriting -> setImportPreview`, `confirmImport -> createProjectWithAssets`.

## Preservation review
- Deletions: `git status --porcelain` shows no deleted path. Wave 3 changes are new files plus additive edits.
- Metadata: no Wave 3 file edits `model.ts`, `storage.ts`, `store.rs` or `research/types.ts` (mtimes predate Wave 3). `zoteroOrigin` lives inside the source's `cslData` object (additive; native maps are flattened) -- but its survival through save/reload/native serialization is untested (B7).
- Image bytes never in the localStorage journal: T008 review control B (`team-t008-review/control.log`, executed) found no `data:image`/PNG/JPEG base64 in any localStorage value after a confirmed DOCX import; my probe P1 found the only localStorage value holding the image node is a 1 963-character project record (asset id reference only).
- No network from imports: zero off-origin requests in the malicious HTML, remote-image-in-bundle, round-trip and P2 cases, each with a liveness control proving the watcher counts a real request (P3, `team-t008-review` C, round-trip "listener liveness").

## Questions handed to this gate

1. **Image count, editor 2 vs preview "1 image" (T008 reviewer)** -- investigated (P1). Not a defect. After a confirmed `rich-sample.docx` import there is exactly one `.ProseMirror` (the Writing editor), one `figure.doc-image`, and one stored image node; the second `<img>` is ProseMirror's own `ProseMirror-separator` placeholder (empty `src`), which the T008 control counted with `.ProseMirror img`. Side note: the preview pill counts staged assets (`counts.images: assets.length`, `docxImport.ts` ~845), not image nodes, so (inferred) a DOCX that shows one picture twice would say "1 image" -- see finding F3.
2. **No AbortSignal from App into `previewWriting`** -- confirmed (`App.tsx:1105` passes none). I2's done-condition "cancel leaves no visible project" is met (Cancel before confirm, tested after reload); mid-parse cancellation is unit-tested only and unreachable from the UI. Finding F1.
3. **DOCX external-link drop untested** -- now executed (P2, above). The probe is a review harness, not a maintained test; finding F4 asks for a maintained case.
4. **XML check blocks only external DOCTYPEs** -- read, unchanged; a local/internal DOCTYPE with entity expansion is left to the browser's XML parser (DOMParser does not fetch, but internal entity expansion is not blocked by this code). Boundary B3.
5. **Zip sizes trusted from the central directory** -- confirmed by execution (B4). DELEGATION.md specified exactly this check ("from the central directory BEFORE inflating"), so it meets the delegated scope; the I2 plan's stricter wording ("not only after JSZip decompression") is not fully met for headers that lie.
6. **Open C3 gaps (wp6.md)** and **Connect button** -- carried as boundary B5 and finding F2.
7. **Browser-preview Zotero fetch path** -- unapproved deviation from C3, but confined to the browser preview (see WP6 above). Boundary B6.

## Findings (scoped follow-up repairs; none blocks the gate)

- **F1 -- mid-parse cancel unreachable** (board task T032). File: `src/App.tsx` (`importWriting` ~1104) and `src/import/ImportPreview.tsx`/a busy state. Pass an `AbortController.signal` to `previewWriting` and abort it when the user cancels or leaves while a large DOCX/HTML/bundle is still parsing. Check: a Playwright case that starts a slow import, cancels, and asserts no dialog and no project after reload; plus the existing unit `aborts parsing when AbortSignal is triggered`. Owner: a small App task (App.tsx is unregistered now).
- **F2 -- Zotero Connect wording** (board task T033). File: `src/research/ResearchPanel.tsx` ~801-860. "Connect local Zotero" sets "Connected to local Zotero (127.0.0.1:23119)" without contacting Zotero, and nothing explains that Zotero's local API must be enabled in Zotero's settings (C3 step 3). Repair: say "Zotero refresh enabled" until a request succeeds, and add a one-line hint naming the Zotero setting. Check: `tests/zotero.spec.ts` asserts the hint text and that "Connected" appears only after a mocked successful read.
- **F3 -- DOCX preview image count counts assets, not pictures** (board task T034; inferred from reading the code, not reproduced by a run). File: `src/import/docxImport.ts` ~845 (`images: assets.length`, while `countItems(finalBlocks).images` is computed and unused). Inferred: a picture used twice would show "1 image", and an embedded image that no drawing references would still be staged and saved as an orphan asset. Repair: report the node count (and warn about unreferenced media, or skip staging it). Check: a unit in `richImport.test.ts` with one image referenced twice (expect 2) and one unreferenced (expect a warning, no asset), shown failing first.
- **F4 -- maintained test for external DOCX relationships** (board task T035). File: `tests/rich-import.spec.ts` (or `richImport.test.ts`) plus a fixture. Port probe P2 (`$B/probe/gateb-probe.spec.mjs`) as a maintained test with its liveness control. Also rename the case at `tests/rich-import.spec.ts:34`, whose title says "WebKit/Chromium" though only Chromium runs.

## Boundaries (accepted for this gate, carried forward)
- B1 Chromium only on a production preview; no WebKit and no native Tauri run of any Wave 3 import, export, bundle or Zotero path; no hosted CI. The native asset store, `export_bytes`/save dialog and the native `zotero_read` over real IPC are unexercised.
- B2 No owner real-use confirmation; everything stays CLAIMED.
- B3 `validateXmlSafe` rejects external DOCTYPEs only (internal-subset entities are not blocked by our code).
- B4 Understated zip headers pass the pre-inflation check; JSZip catches the mismatch only after inflating the entry, so a hostile 20 MiB DOCX could cost memory up to its real inflated size before it is rejected. The user must choose the file themselves; nothing is saved. A real fix needs a streaming byte counter during inflation.
- B5 C3 gaps beyond the delegated scope (wp6.md): no 30 s polling/backoff, no `since`/version reuse, no server-ID check, remote deletions not marked unavailable, no distinct down/403/version messages and no `Zotero-API-Version` header, native command accepts any `/api/` path rather than a fixed resource, no resumable cancel (5 000-item stop with a message), no auto-apply policy, no synthetic real-Zotero run or owner integration report.
- B6 Browser-preview Zotero `fetch` path is an unapproved C3 difference; its paging depends on CORS header exposure that Playwright mocks provide and a real Zotero may not.
- B7 `zoteroOrigin` persistence across save, reload and native serialization is untested.

## What the layout wave (T013) should know
- Gate B is PASS, so the layout wave may start. Findings F1-F4 are board tasks T032-T035 (priority 3, review required); none touches `src/print/*`, `printing.rs`, `nativePdf.ts` or `printProbe.ts`.
- T013 registers `src-tauri/src/lib.rs`: `zotero::zotero_read` must stay in both invoke-handler branches (lines 250, 281) next to the printing lines.
- `dist/` was last built 01:09 EDT from the current tree; later layout edits need a fresh `npm run build` before any production-preview run.
- PDF layout must later cover the Wave 3 content (images, tables, notes from DOCX/HTML/bundle imports), per the I2/I3 plan note.

## Process
Ports 1469, 1470 and 1471 were used and are closed; no process of mine is left. No product, test, config or fixture file was edited; only my cache folders and the three registered T012 documents were written. A whole-tree check (`find . -newer <01:05 EDT>` excluding `node_modules`, `src-tauri/target`, `.git`) lists only `dist/` and `tsconfig.tsbuildinfo` (rebuilt by my `npm run build`, gitignored build output), these three documents, and the `team/` state the tool writes. `lib.rs` lines 250 and 281 (`zotero::zotero_read`) were checked by me with grep. Nothing committed.
