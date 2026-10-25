# Wave 3 integration -- app and native registration gaps (team task T011)

Date: 2026-10-25 | Agent: agent-558f (Claude Sonnet worker) | Status: CLAIMED (submitted for independent review)
Logs: `node_modules/.cache/personal-word-beta/team-t011/` (below: `$L`). Pinned Node v22.23.3 in every shell. Serial slot held throughout. Playwright: production preview only, port 1468 (`$L/browser.config.mjs`, cloned from team-t005 config, own report/results paths).

## Files changed
- `src/components/ProjectLibrary.tsx` -- writing-import `accept` gains `.zip` and `application/zip`; label now "Import writing -- text, Markdown, Markdown bundle (.zip), Word, or HTML (up to 20 MB)".
- `src/import/docxImport.ts` -- `previewWriting` gets a `/\.zip$/i` branch that does `await import("../export/markdownBundle")` and returns `importMarkdownBundle(bytes, filename, options)`. All other routing unchanged.
- `src/import/importLimits.ts` -- `ImportDraft.format` union gains `"Markdown bundle"`.
- `src/export/markdownBundle.ts` -- `format: "Markdown bundle" as any` -> `format: "Markdown bundle"`; manifest loop tightened (item 8, see below).
- `src/export/markdownBundle.schema.test.ts` -- one unit test appended (item 8).
- `tests/markdown-roundtrip.spec.ts` -- `test.fail(...)` and its comment removed; stale header comment about the unreachable import half rewritten; 3 tests appended (accept/label, bundle import carries image + survives reload, cancel for bundle/DOCX/HTML with reload).
- `docs/agent-work/2026-10-24-team-reconciliation/wave3-integration.md` -- this file.
- Verified by reading, NOT changed: `src/App.tsx`, `src-tauri/src/lib.rs`, `playwright.config.ts`.
- The three off-board `printing` lines in `lib.rs`, `src/print/*`, `tests/native-print.js`, `scripts/native-print-smoke.py` were not touched.

## Per item
1. **ProjectLibrary accept + label**: done (above).
2. **previewWriting .zip route**: done with a dynamic import. The built `dist/assets/markdownBundle-*.js` chunk still exists, so the spec's `bundleChunkUrl()` helper keeps working (spec tests 1-7 pass).
3. **ImportDraft.format**: union extended, `as any` removed; `npx tsc --noEmit -p .` exit 0.
4. **App.tsx wiring (read, unchanged)**: `importWriting` (line 1104) -> `previewWriting` -> `setImportPreview(draft)`; `confirmImport` (line 1108) takes `importPreview.assets` and calls `storage.createProjectWithAssets(imported, assets)`. A bundle draft already carries its `PendingAsset`s, so no change was needed. Cancel path: `onCancel={() => setImportPreview(null)}` (line 2275) never calls storage. Browser proof: new spec test "UI import of a bundle carries its image asset ... survives reload" (image decodes with naturalWidth 1 after reload; library then shows 2 projects), and "cancelling a bundle, a DOCX and an HTML import leaves no new project, even after reload" (project count stays 1 after each cancel and after reload). Note: there is still no AbortSignal passed from App into `previewWriting` (already recorded by T008 review; not changed, Gate B item).
5. **test.fail removed**: the UI bundle-import test now runs as a normal test and passes. ImportPreview pills read exactly "1 image", "1 table", "2 notes" and the dialog contains "Markdown bundle"; no expectation changed or weakened.
6. **lib.rs (read, unchanged)**: `mod zotero;` at line 4; `zotero::zotero_read` at line 250 (native-smoke handler) and line 281 (normal handler); `pub async fn zotero_read` is `#[tauri::command]` in `src-tauri/src/zotero.rs:226`. Both branches registered. `mod printing` / `printing::render_pdf` (lines 7, 261, 282) left alone. `lib.rs` mtime/SHA unchanged from start.
7. **playwright.config.ts (read, unchanged)**: diff vs HEAD: adds `PLAYWRIGHT_PORT` (default 1420) and `PLAYWRIGHT_PREVIEW=1`; with it the web server is `npm run preview -- --port <port> --strictPort` (package.json `preview` is `vite preview --host 127.0.0.1`, so host matches the 127.0.0.1 baseURL), otherwise the old `npm run dev` on 1420. `reuseExistingServer` stays false, so it never attaches to someone else's server; port is strict. It does not set a results/report directory (defaults to repo-root `test-results/`, gitignored), so for isolated results pass `--output`. I ran `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1468 npx playwright test tests/import.spec.ts --workers=1 --output $L/repo-config-results` against it: 2 passed (`$L/repo-config-import.log`). It requires a prior `npm run build`. Default (no env) behaviour is dev server -- not a production preview -- so qualification must set `PLAYWRIGHT_PREVIEW=1`. Isolation judged adequate; no fix needed.
8. **Manifest loop tightening (done)**: in `importMarkdownBundle`, when a manifest asset's recorded id disagrees with its path hash, the path-hash asset being absent from the archive now throws "Manifest lists asset ... missing from the archive" (previously only warned and `continue`d). An id/path mismatch where the file is present still only warns (existing test "warns when a manifest asset's recorded id does not match its path hash" still passes).

## Fail-first evidence
| What | Control | Result |
|---|---|---|
| Items 1-3, 5 (UI bundle import) | `test.fail` line removed from the spec, product code untouched, fresh build (`$L/baseline-build.log`) | `$L/failfirst-prefix-browser.log`: **exit 1**, 7 passed / 1 failed -- `getByRole('dialog', { name: 'Import writing' })` not found (the `.zip` fell into the plain-text fallback / was not routed) |
| Item 8 | new unit test run on unrepaired `markdownBundle.ts` | `$L/unit-tamper-prefix.log`: **exit 1**, 1 failed / 43 passed (import resolved with warning instead of throwing) |
| Item 4 / new test "cancelling..." | doctored `src/App.tsx`: `onCancel` also calls `createProjectWithAssets` | `$L/ctl-ca2-cancel-persists-project.log`: **exit 1**, `.project-row` count Expected 1, Received 4. (First doctor `ca`, which created the project inside `importWriting`, broke the fixture setup instead and is not counted: `$L/ctl-ca-app-create-before-confirm.log`.) |
| New test "UI import of a bundle carries..." | doctored `docxImport.ts` route regex `\.zipx$` | `$L/ctl-cb-no-zip-route.log`: **exit 1**, figure image never visible |
| New test "accepts .zip" | doctored `ProjectLibrary.tsx` without `.zip` | `$L/ctl-cc-accept-no-zip.log`: **exit 1**, `Expected substring: ".zip"` |
After the final comment-only spec edit the spec was rerun alone: `browser-final-spec-after-comment.log`, 11 passed.

SHA-256 before == after for every doctored file (`$L/controls-summary.txt`, `$L/controls-summary-ca2.txt`; `identical=True`): App.tsx `9e5ece91...7980`, docxImport.ts `6f03db25...d4e2`, ProjectLibrary.tsx `9430adf3...dc77`. dist was rebuilt from the restored source before the final runs (`$L/build-final.log`). Original spec SHA `6ec64ee7...d8cd` (backup `$L/spec.orig.bak`), original schema test backup `$L/schema.test.orig.bak`.

## Qualification (serial, retained logs; all on the final tree)
| Log | Command | Result |
|---|---|---|
| `tsc-final.log` | `npx tsc --noEmit -p .` | exit 0 |
| `vitest-final.log` | `npm test -- --no-file-parallelism --maxWorkers=1` | exit 0, 44 files / 837 tests passed |
| `unit-export-import-postfix.log` | `npx vitest run src/export src/import src/adversarial-wp7-exportpanel.test.ts` | exit 0, 9 files / 188 tests |
| `build-final.log` | `npm run build` | exit 0 |
| `browser-final.log` | `npx playwright test -c $L/browser.config.mjs tests/import.spec.ts tests/rich-import.spec.ts tests/markdown-roundtrip.spec.ts tests/zotero.spec.ts tests/research.spec.ts --workers=1` (production preview, port 1468) | exit 0, **31 passed** (markdown-roundtrip 11/11, none expected-fail) |
| `repo-config-import.log` | repo `playwright.config.ts` with `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1468`, `tests/import.spec.ts` | exit 0, 2 passed |
| `cargo-final.log` | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | exit 0, 44 passed / 0 failed / 1 ignored |

## Registered-path mtimes at start vs end
Start (`$L/start-stat.txt`): App.tsx 23:15:44, ProjectLibrary.tsx 13:49:18, lib.rs 19:22:30, playwright.config.ts 07:18:24, docxImport.ts 13:49:38, importLimits.ts 13:45:56, markdownBundle.ts 00:45:08, spec 00:46:25. At end, `lib.rs` and `playwright.config.ts` mtime and SHA unchanged; `App.tsx` SHA unchanged (mtime moved only because the control script restored it byte-identically). No registered path was changed by anyone else during the task; no `src-tauri` file is newer than my start.

## Not covered
- No native Tauri / WebKit run: browser results are Chromium on a production preview only. Native `export_bytes`/save-dialog and native asset store were not exercised for the bundle import.
- No `cargo` test touches the invoke-handler registration (it is only checked by reading and by `cargo test` compiling both feature configurations' sources that are built by default; the `native-smoke` handler branch is not compiled by this command).
- No AbortSignal is passed from App into `previewWriting`, so a bundle/DOCX/HTML preview cannot be cancelled mid-parse from the UI (unchanged from T008 review note).
- Owner's real-use confirmation: none. Status CLAIMED.
