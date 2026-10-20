# Qualification review — source-alpha continuation
Reviewer: Codex independent reviewer | Range: cf1226b..aad4c12 | Date: 2026-10-20

## Verdict: APPROVE

## Summary

Static review found the new DOCX allowlist at the export boundary and a regression test that checks accepted HTTPS/mailto relationships, rejected JavaScript/file relationships, and preservation of unsafe-link text. The separate exported-artifact assertion also covers plain HTTP. The font wording change matches the `.woff` imports in `src/export/fonts.ts`. No source defect has been found in the inspected diff. Core, native and export qualification logs/artifacts are inspected; the normal bundle and fresh-source rehearsal passed; my focused reruns passed. The integrator reconciled current-source readiness and validation records, closing Q-1. I approve the local evidence commit/tag transaction; the integrator's post-commit source, privacy, backup, and tag-equality checks remain part of T8 and are not claimed complete here.

## Findings

| # | Severity | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| Q-1 | Medium, resolved | `docs/publication-readiness.md:14-24`; `docs/validation.md:229-240` | The initial review found current qualification prose stale relative to the added DOCX exporter source. | Reconciled records identify `aad4c12`, 164 unit tests, 49 browser scenarios, 19 Rust tests plus 1 ignored benchmark, actual hyperlink artifact results, the fresh release hash, isolated rehearsal, and the accepted native-sidebar limit. The 115-source manifest is explicitly described as frozen code/test/config evidence; the later five-file Markdown delta is separately recorded. | Closed by current documentation reconciliation. |
| Q-2 | Low, future automated regression coverage | `src/export/document.test.ts:326-327` | The unit regression proves HTTPS and mailto are accepted, but does not independently pin the plain HTTP behavior named in the allowlist requirement. | `src/export/docx.ts:28` accepts all three schemes. The integrator's separate generated-DOCX assertion covers an `http://` target, so this is not a current behavior finding. | Consider adding an `http://` fixture to the committed unit test in a future test-only update. |

## Plan vs diff

- Claimed done but absent from diff: none in this range.
- In diff but not in the active continuation scope: none. The DOCX export behavior change, regression, and WOFF wording correction are the explicit review scope for this continuation. T6 requires actual artifact inspection for touched export behavior.
- The new exporter source invalidated the earlier qualification's manifest and bundle as evidence for `aad4c12`; the reconciled current-source records now provide the regenerated 115-file manifest and release evidence.

## Re-run validation (commands and results)

The integrator ran these sequentially on frozen `aad4c12`; I inspected the complete saved logs and result JSON. I ran the two T7 focused reruns after the integrator released the lease. Node for all reviewer tests was the already-installed local `v22.23.3` runtime at `node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin/node`.

- `npm run build` — exit 0; 1,959 modules transformed. Vite emitted its existing dynamic/static import and large-chunk warnings.
- `npm test` — exit 0; 17 files, 164 tests passed.
- `npm run test:e2e -- --workers=1` — exit 0; 49/49 Chromium scenarios passed.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml` — exit 0; 19 passed, 1 existing ignored benchmark.
- `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` — exit 0; diagnostic native build completed.
- `python3 scripts/native-smoke.py` — exit 0; isolated macOS WebKit/SQLite runner completed all 3 phases. Its report and harness assert clean quit/reopen, acknowledged checkpoint, harness-owned termination, journal recovery, SQLite integrity, and portable JSON mirror equality.
- `npm run render:export-fixtures` — exit 0; synthetic DOCX/PDF artifacts generated. The integrator's inspection script found 4 allowed hyperlink relationships (HTTP, HTTPS, uppercase HTTPS, mailto), 0 disallowed relationships, all 8 labels retained, Markdown/plain-text labels retained, and the baseline DOCX/PDF checks passed.
- Export regression fail-first — isolated doctored copy: defect exit 1 on `javascript:` relationship, fixed exit 0, restored defect exit 1 on the same assertion, final fixed exit 0. Result JSON records `root_unchanged: true`.
- Export-validator negative control — final doctored artifact run exited nonzero at the exact allowed-target-set assertion, as expected. The first artifact inspection attempt also failed because pypdf inserted layout whitespace inside the title; the validator now collapses PDF whitespace before the same title/Café checks, and its corrected run passed. This is a harness normalization, not a relaxed hyperlink assertion.
- Visual artifacts — I inspected the generated boundary DOCX page, both rendered DOCX pages, and both PDF pages. Labels and manuscript content were retained, with no missing glyphs or clipping visible. The bibliography occupies the second page. Poppler text extraction confirms `Synthetic export QA`, Café, Greek and Cyrillic content.
- `npm run tauri build` — exit 0; `src-tauri/target/release/bundle/macos/Personal Word.app`, 15.25 MiB. Inspected Info.plist and executable evidence: name `Personal Word`, identifier `com.folio.writing`, version `0.1.0`; executable SHA-256 `0c5740e853040f652e3ed2c3d61ba3a497ac314c08d9f742ea68f731f04c3865`, newer than all 77 listed source files, no `FOLIO_SMOKE` marker. The 115 frozen source hashes matched.
- Fresh-source rehearsal — isolated 167-file candidate passed pre-install SHA-256 comparison and redacted Gitleaks scan (0 findings); approved `npm ci`, `npm run build`, and `npm test` each exited 0 under Node 22. The fresh unit log reports 17 files and 164 tests passed. The rehearsal script asserts all 115 frozen source hashes both before and after installation/build/unit still match root and the isolated copy. The candidate copy is a point-in-time snapshot; its later five-file Markdown delta is recorded in `candidate-docs-delta.json` and does not change the tested code manifest.
- `npm test -- src/export/document.test.ts` — reviewer rerun exit 0; 1 file, 13 tests passed.
- `npm run test:e2e -- tests/sidebar-selection.spec.ts tests/layout.spec.ts tests/editor-toolbar.spec.ts --workers=1` — reviewer rerun exit 0; 13 tests passed in 26 seconds after the existing local-loopback approval was used. The first attempt was blocked before tests by `listen EPERM` and is preserved separately; no test result was counted from it.

## Evidence level reached, and what the user must still verify by hand

- DOCX allowlist: reached rung 5 — the exported-XML assertion failed on the restored unsafe exporter, passed with the fix, failed again on restored defect, and passed after restoring the fix. I independently reran all 13 DOCX document tests and the focused test passed. The separate artifact assertion covered all three allowed schemes plus uppercase HTTPS and disallowed JavaScript, file, data and relative hrefs.
- Exported DOCX/PDF: generated XML/text assertions and LibreOffice/Poppler renderings were inspected. This evidence covers the synthetic export fixture, not Microsoft Word or real user documents.
- Native sidebar interaction: the owner previously accepted the manual gap for this source-only alpha. Keep actual native label/prose selection, light/dark appearance, drag reorder and physical interaction marked unverified; this acceptance is not real-use confirmation.

## Not reviewed / limits

- The reviewer first attempted a broad Playwright command without the three requested spec paths; it failed before test discovery with `listen EPERM`. The exact focused command was then run with the approved loopback escalation and passed 13/13. The unsuccessful pre-test attempt is preserved as a setup limitation, not a product failure.
- Final post-commit Gitleaks/main-tag audit, verified-backup evidence and tag-to-final-evidence commit equality remain pending integrator T8 completion. This approval authorizes that local transaction under the approved plan; it does not claim those checks have already passed.
- This review does not establish Microsoft Word rendering, hosted CI, binary distribution readiness, VoiceOver/IME behavior, physical power-loss behavior, or user confirmation.
