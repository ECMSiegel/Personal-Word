# WP7 -- Markdown bundle round-trip acceptance (team task T010)

Date: 2026-10-25 | Agent: agent-0da8 (Claude Sonnet worker) | Status: CLAIMED (submitted for independent review)
Logs: `node_modules/.cache/personal-word-beta/team-t010/` (below: `$L`). Pinned Node v22.23.3 in every log. Serial slot held throughout.

## Files changed (all registered to T010)
- `tests/markdown-roundtrip.spec.ts` -- rewritten (see below).
- `src/export/markdownBundle.ts` -- import now validates the manifest (repair 1).
- `src/export/markdownBundle.schema.test.ts` -- 6 new manifest tests appended (describe "Markdown bundle manifest verification (T010)").
- `src/export/ExportPanel.tsx` -- bundle download name goes through `safeFilename` (repair 2).
- Untouched: `markdownBundle.test.ts`, `markdownBundle.adversarial.test.ts`, `src/adversarial-wp7-exportpanel.test.ts`.
- No other file changed. No file registered to T010 changed under me from outside (mtimes of untouched paths unchanged since start: `$L/start-stat.txt`).

## What was already there (inspected, not rebuilt)
`exportMarkdownBundle`/`importMarkdownBundle` (zip: `manuscript.md`, `manifest.json`, `assets/<sha>.<ext>`), the "Markdown with images (.zip)" button, 181 unit tests. Earlier WP7 evidence was unit-only; the old Playwright spec imported `/src/export/markdownBundle.ts` inside `page.evaluate`, which does not exist on a production preview (dist has hashed chunks, no `/src`), so it could never have run there.

## Per-step work
1. Baseline (unmodified source): vitest 181/181, tsc 0, build 0 (`$L/units.log`, `tsc.log`, `build.log`).
2. Spec retargeted to the bundled UI:
   - Build the project through the real UI: writing-import input (`#import-writing-text`) with a Markdown file holding two notes (note A is two paragraphs, reference mid-sentence) -> ImportPreview modal "Import" -> editor "Insert table" and typing cells -> toolbar "Insert image" (1x1 PNG) -> Settings -> "Markdown with images (.zip)" -> real browser download.
   - The downloaded zip is opened in Node: file list, `manifest.json` (format, version 1, title, asset id/path/mime/byteLength/width/height), SHA-256 of the asset bytes == manifest id == filename, `manuscript.md` (image link, pipe table rows, `[^1]:` note with 4-space continuation paragraph).
   - Re-import runs the production build's own `dist/assets/markdownBundle-*.js` chunk (the one ExportPanel lazy-loads) in the page: counts (1 image, 1 table, 2 notes), asset id equals the original sha, image node `assetId`/alt, table cell text, note A text `"Paragraph one of note A.\n\nParagraph two of note A."`, and exact inline shape of the first paragraph `["First sentence with a note", <ref A>, " and more text."]` and second note reference in the closing paragraph.
   - Zero remote loads: a `page.on("request")` watcher records anything not on the preview origin (data:/blob: excluded) during build, export and re-import; asserted `[]`. A liveness test proves the same watcher counts an in-page fetch to `example.invalid` (count 1).
   - Missing asset: the stored image bytes are cleared from the `personal-word-browser-assets` IndexedDB, then the button is clicked: `.settings-status` shows "An image is missing from this export" with the 12-char asset prefix, never "exported", and zero `download` events.
   - Limits in the production chunk: path traversal, compression-ratio bomb (30 MiB of zeros), a 21 MiB entry over the 20 MiB per-entry cap, and a tampered asset (name/bytes SHA mismatch) are rejected.
   - Remote image URL inside a bundle's Markdown is kept as text with a warning and never fetched.
   - Download-name test (below).
3. Defects reproduced and repaired (only these):
   - **D1 manifest ignored on import.** `importMarkdownBundle` read only `title` from `manifest.json`. A manifest of version 2, a foreign `format`, or listing an asset absent from the zip imported silently. Repair: unsupported `format`/`version` throw; a manifest asset missing from the archive throws "Manifest lists asset ... missing from the archive"; a manifest id that disagrees with its path hash, or a wrong `byteLength`, is a warning (the content-addressed file hash stays the source of truth, which the existing adversarial test "records behavior when manifest.json specifies an asset SHA that differs" requires and still passes unchanged). A manifest without `format`/`version`/`assets` is still accepted (hand-made bundles).
   - **D2 unsafe download name.** ExportPanel used `${project.title}-markdown.zip` raw; title `A/B: C?` produced `A/B: C?-markdown.zip` (the DOCX/PDF/MD/TXT exports use `safeFilename`; in Tauri the raw name becomes a path in the save dialog). Repair: `safeFilename(project.title || "Untitled")`.

## Commands and results
| Log | Command | Result |
|---|---|---|
| `units.log` | `npx vitest run src/export src/import src/adversarial-wp7-exportpanel.test.ts` (baseline) | exit 0, 9 files, 181 tests |
| `unit-manifest-prefix.log` | `npx vitest run src/export/markdownBundle.schema.test.ts` with new tests, unrepaired source | **exit 1, 5 failed** / 38 passed |
| `unit-manifest-postfix2.log` | `npx vitest run src/export src/import src/adversarial-wp7-exportpanel.test.ts` | exit 0, 9 files, 187 tests |
| `units-final.log`, `tsc-final.log`, `build-final.log` | vitest (same command), `npx tsc --noEmit -p .`, `npm run build` | exit 0 / 0 / 0, 187 tests |
| `browser-pass1..6.log` | spec iterations (table not importable from .md -> built via editor; caret placement; filename expectation) | exits 1,1,1,1,1,0 (harness fixes, no product change) |
| `browser-pass7-prefix-filename.log` | spec + download-name test, ExportPanel unrepaired | **exit 1**, `Received "A/B: C?-markdown.zip"` |
| `browser-final.log` | production preview port 1466, `npx playwright test -c $L/browser.config.mjs tests/markdown-roundtrip.spec.ts --workers=1` | exit 0, 8 passed |
| `browser-final2.log` | same, after all controls and restores, rebuilt dist | **exit 0, 8 passed** (22.5 s) |

The 8th test ("UI import of a .zip bundle...") is `test.fail(...)` -- it passes as an expected failure, see "Not covered / for T011". The list reporter prints it with an x.

## Fail-first controls (doctored product/spec files, backups in `$L/ctl-backup-*`, restored byte-identically)
Each control rebuilt dist (`$L/ctl-<name>-build.log`), ran the matching test (`$L/ctl-<name>.log`), restored, and recorded SHA-256 before/after in `$L/controls-summary.txt`.
| Control | Doctor | Result |
|---|---|---|
| c1-version | export writes `version: 2` | UI export test **fails** (`Expected 1, Received 2`) |
| c2-remote-fetch | import fires `fetch("https://example.invalid/leak.png")` | remote-URL test **fails** (off-origin list not empty) |
| c4-sha-check-removed | SHA-256 comparison disabled | limits test **fails** (SHA-256 mismatch no longer reported) |
| c5-unsafe-filename | ExportPanel reverted to raw title | download-name test **fails** (`A/B: C?-markdown.zip`) |
| c6-ui-import-failfirst | `test.fail` line removed from the spec | UI-import test **fails** (dialog never appears: `.zip` not routed) -- proves the known-gap test fails for the stated reason |
| c7 (`ctl-c7-assets-kept.log`) | spec no longer clears the asset store | missing-asset test **fails** (`Received "Markdown bundle exported."`) |
| manifest loop (`ctl-manifestloop-doctored.log`) | manifest validation loop disabled | 3 unit tests **fail** (missing-asset rejection + 2 warnings) |
SHA-256 before == after for every control: markdownBundle.ts `2634e22f...0a965`, ExportPanel.tsx `1486e061...b8d5`, spec `6ec64ee7...d8cd` (all `identical=True`). Original pre-task hashes: markdownBundle.ts `a4f51956...0236b`, ExportPanel.tsx `c3296531...e21d`, spec `26de3af8...c7ef`, schema test `539640ef...ec03` (`start-stat.txt`).
- c3/c3b (missing-asset check removed from ExportPanel, then also from markdownBundle) did **not** make the browser test fail (`ctl-c3-*.log`, `ctl-c3b-*.log`, exit 0): a third, independent check in `src/export/textExport.ts` (`projectMarkdown`, unregistered) throws the same message, so the behavior is defended in three places. c7 shows the test itself is live. Recorded honestly, not a gap.

## Not covered / needed from files T010 does not own (for T011)
1. **No UI route imports a bundle (real gap).** `src/components/ProjectLibrary.tsx` line 207 `accept` has no `.zip`; `src/import/docxImport.ts` `previewWriting` (line ~854) only routes `.docx`/`.html`, everything else goes to the plain-text/Markdown fallback; `src/App.tsx` `importWriting` (line 1104) calls only `previewWriting`; `importMarkdownBundle` is imported by nothing but tests. T011 should: add `.zip`/`application/zip` to the accept list and the "Import writing" label, route `*.zip` in `previewWriting` (or `importWriting`) to `importMarkdownBundle(bytes, filename, {signal})`, and extend the `ImportDraft.format` union (currently the bundle returns `"Markdown bundle" as any`). Then delete the `test.fail(...)` line from the last spec test; it is written to flip to a hard failure ("expected to fail but passed") the moment the route works. Until then the import half is verified only through the production chunk, not the ImportPreview modal.
2. `ImportPreview` count pills and "Markdown bundle" label are unverified for the same reason.
3. Chromium only (no WebKit/native Tauri run); browser asset store is IndexedDB, native `export_bytes`/save dialog path not exercised.
4. Not tested: reference positions inside table cells or notes in image captions; JPEG round trip (units cover it); bundles with >0 unreferenced assets in the browser (units cover the warning); `AbortSignal` cancellation (units).
5. `src/adversarial-wp7-exportpanel.test.ts` filename cases recompute the name instead of rendering ExportPanel, so they never exercised D2; the browser test now does. Left as is (mentioned, not edited).
6. Markdown import (`.md`) intentionally disables tables (`manuscript.ts` `.disable("table")`), so pipe tables in a plain `.md` stay text; tables only survive via the bundle importer, the DOCX/HTML importers or editor insertion.

Status: CLAIMED. Not confirmed by the owner in real use.
