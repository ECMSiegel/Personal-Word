# REVIEW — Complete the local writing workflows
Reviewer: Codex | Range: `c62332c`..working tree | Date: 2026-10-18

## Verdict: CHANGES REQUIRED (native smoke rerun blocked by environment)

## Summary

The original PDF defect and both documentation findings have been repaired. Final frontend build, 78 unit tests, the 37-case browser suite, Rust tests, regenerated PDF fixtures, release bundle, and license inventory passed. I inspected both final PDF pages; multilingual text, notes, strike, lists, and bibliography render legibly. The isolated native smoke still times out before its injected script starts, with LaunchServices/hiservices connection errors. No unresolved source defect was found in the reviewed repair; the review remains CHANGES REQUIRED because the independent native runtime rerun did not complete.

## Findings

| # | Severity | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| 1 | High | `src/export/pdf.ts:121`; `src/export/fonts.ts:1-2` | **Implementation defect.** The PDF exporter passes bundled WOFF2 data directly to `pdf.embedFont`. The generated fixture PDF is malformed for Poppler and loses visible text. | Fresh `npm run render:export-fixtures` exited 0. `pdftoppm` emitted repeated `Embedded font file may be invalid` and `Couldn't create a font` errors; rendered pages were blank except for horizontal rules. `pdftotext` emitted the same font errors and returned text with many missing characters. This contradicts T3's embedded-font, content-preservation, and rendered-artifact acceptance checks. | Use a PDF-compatible embedded font program (fontkit subsetting/re-encoding is a candidate) or reject/fallback before writing an invalid PDF. Add a meaningful regression check and rerun fixture generation, text/content checks, and visual rendering. Do not treat the generated PDF as a passing artifact until then. |
| 2 | Medium | `docs/agent-work/2026-10-18-completion/persistence-log.md:21-24` | **Resolved.** The original log called automated unit, syntax, and diff checks `VERIFIED`, although the plan reserves that label for owner confirmation in real use. | The current entries label all four automated results `CLAIMED`, consistent with the plan and authority rules. | Completed: automated evidence labels changed to `CLAIMED`; command outcomes remain. |
| 3 | Low | `src-tauri/src/lib.rs:174-176`; `docs/agent-work/2026-10-18-completion/PLAN.md:50` | **Resolved as a documented scope deviation.** T2 scoped `lib.rs` to instance-lock tests only, but this diff registers `smoke_progress`. | The implementation log now explicitly records that the smoke-only handler registration extends the original `lib.rs` scope so harness breadcrumbs reach IPC. | Completed: the implementation log records the deviation and its reason. |

## Plan vs diff

- Claimed done but absent from diff: none found among T1-T6 completion-owned changes. The planned save queue, export, UI, Markdown import/dialog, documentation, smoke harness, and fixture-generator work are present in the baseline-to-current comparison. The T6 release bundle is claimed in the implementation log; this review did not rebuild or re-inspect it.
- In diff but not in plan: `src-tauri/src/lib.rs` registers `smoke_progress` even though T2 limits that file to instance-lock tests (Finding 3). T3 names `scripts/render-export-fixtures.ts`, while the implementation uses the logged `.mjs` Node entrypoint adaptation. `src/vite-env.d.ts` supports the planned inline font imports. These latter two adaptations are disclosed and fit the planned work.
- Attribution boundary: comparison used the ignored baseline inventory at `node_modules/.cache/personal-word-completion/manifest.json` and source snapshots under its `baseline/` directory. The parallel `README-draft.md`, `docs/evidence/readme/`, and `docs/agent-work/2026-10-18-writer-features/` work is excluded. It is not part of this completion review. The baseline snapshot is a file copy, not a complete byte-for-byte snapshot of every pre-existing dirty document; the implementation log records that limitation.

## Re-run validation (commands and results)

- `npm run build` — **PASS after repair**. Final repair log `/tmp/pw-repair-build.log`; TypeScript and Vite completed. Vite reported chunk-size and dynamic-import warnings.
- `npm test` — **PASS after repair**. 78 tests passed across 10 files; `/tmp/pw-repair-unit.log`.
- `npm run test:e2e -- --workers=1` — **PASS after repair with permissioned owned server**. 37/37 browser cases passed in 3.2 minutes; `/tmp/pw-repair-e2e.log`. The initial sandboxed attempt recorded above failed before tests due localhost `EPERM`; the permissioned rerun supersedes that startup blocker.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml` — **PASS after repair**. 17 passed, 1 ignored; `/tmp/pw-repair-cargo.log`.
- `npm run render:export-fixtures` — **PASS after repair**. Synthetic DOCX/PDF were generated; Vite logged a non-fatal HMR WebSocket `EPERM`, but wrote both artifacts. Full log: `/tmp/pw-repair-fixtures.log`.
- `pdftoppm` final fixture rendering — **PASS after repair**. `/tmp/pw-repair-render.log` is empty of font errors; I inspected `/tmp/pw-repair-final-1.png` and `/tmp/pw-repair-final-2.png`. Both pages render legibly, including Latin Extended, Greek, Cyrillic, footnote, strike, nested list, and bibliography. Long unbroken tokens wrap at character boundaries.
- `pdftotext test-results/export-fixtures/export-fixture.pdf -` — **PASS after repair**. `/tmp/pw-repair-final.txt` retains multilingual text, notes, list items, and bibliography without missing characters.
- Focused export tests — **PASS after repair**, as reported in the integration log: 11/11; the SFNT font-program regression also passed against the repaired exporter.
- `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` — **PASS**. Built `src-tauri/target/debug/folio` with the isolated smoke identifier. Full log: `/tmp/pw-review-native-build.log`.
- `python3 scripts/native-smoke.py` — **BLOCKED in phase 1 after 180 seconds**. No injected breadcrumbs or report appeared. The isolated app log records a LaunchServices notification failure and `com.apple.hiservices-xpcservice` connection-invalid errors. The harness cleaned up its owned app process. Full log: `/tmp/pw-review-native-smoke.log`; isolated data: `/var/folders/rw/ltqyk83j3c5041kpmmr0dk000000gp/T/personal-word-native-smoke-7bpjhp_y`.
- `npm run tauri build` — **PASS after repair**. Full log `/tmp/pw-repair-release.log`; Tauri reported one 15.25 MiB bundle at `src-tauri/target/release/bundle/macos/Personal Word.app`.
- Release bundle inspection — **PASS**. `Info.plist` reports `CFBundleName=Personal Word`, `CFBundleIdentifier=com.folio.writing`, version `0.1.0`, executable `folio`. Executable timestamp is 2026-10-18 15:43:25 -0400, later than the newest `src/` or `src-tauri/src/` source file (15:25:42 -0400). `strings` found no `smoke_report` or `smoke_progress` symbols in the normal bundle.
- `python3 scripts/license-inventory.py` — **PASS after repair**. Inventory has 254 npm packages and 456 Cargo packages with 0 missing license metadata; the script/log outcome was reported by the integrating agent and the generated JSON summaries were read-only checked.
- `git diff --check` — **PASS after repair**, as reported by the integrating agent.

## Evidence level reached, and what the user must still verify by hand

The final build, unit, browser, Rust, export, and inventory checks provide automated test evidence. The browser suite reached its 37 cases in a permissioned owned-server run. The native smoke remains blocked before injected UI behavior by its background-session failure; it does not confirm save/recovery. No check establishes owner-confirmed real use; keep product claims **CLAIMED** until the owner confirms them.

After repair, the owner still needs to inspect a multilingual PDF and DOCX in their normal reader, then confirm native light/dark rendering, VoiceOver, IME and rich paste, native file dialogs, an interactive second-instance lock, and real-use save/recovery durability. Exact save/recovery confirmation should use an isolated test project: type text, wait for the saved state, quit and reopen, then repeat with an intentionally unsaved edit and confirm recovery. Do not use a real manuscript for deliberate termination.

## Not reviewed / limits

- The permissioned browser rerun passed in Chromium; native WebKit behavior remains unverified. The separate isolated native harness did not reach its injected script.
- Native save/recovery behavior remains unverified by this review because the isolated native harness timed out before injection. The normal release bundle was inspected as recorded above.
- I did not change or audit the unrelated pre-existing dirty files or the parallel README/writer-features work.
- No Word application rendering, native screenshots, VoiceOver, IME, file-dialog, or owner real-use checks were available in this review.

## Repair reassessment (2026-10-18)

The integration agent repaired Finding 1 in the current working tree: `src/export/fonts.ts` now supplies WOFF font assets and `src/export/pdf.ts` embeds them with subsetting enabled. The new regression assertion in `src/export/document.test.ts` checks that embedded font programs are SFNT/TrueType/OpenType signatures, excluding WOFF/WOFF2. The integration agent reports the focused export suite passed (11/11), the strengthened font assertion passed, regenerated PDF text extraction preserved the multilingual fixture, and Poppler rendered without font errors. I inspected `/tmp/pdf-repair-after-1.png` and `/tmp/pdf-repair-after-2.png`; the Greek/Cyrillic text, footnote, strike, list, bibliography, and long-token fixture render visibly. The text is legible; the long token wraps at character boundaries as the existing exporter permits.

This addresses the reproduced PDF defect at source and artifact level. I verified that Finding 2's automated labels are now `CLAIMED` and that Finding 3's smoke-only registration scope deviation is explicitly documented in the implementation log; all three code/documentation findings are resolved. The final frontend, unit, browser, Rust, fixture, rendered export, license, diff, and release-bundle checks passed. The bundle has the expected product identity, is newer than the source changes, and contains no smoke-only symbols. The isolated native harness still blocks before UI injection. Verdict remains **CHANGES REQUIRED** because the independent native runtime rerun did not complete; LaunchServices/hiservices errors are an environmental blocker, not a confirmed product failure. A quiet interactive desktop rerun and owner confirmation remain open.
