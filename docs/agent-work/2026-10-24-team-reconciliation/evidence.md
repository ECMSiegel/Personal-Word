# T021 -- beta evidence verifier and current normal app

Agent: agent-dbd8 (Claude Sonnet worker T021). Date: 2026-10-25 (EDT morning). Status: **CLAIMED** (automated and isolated-harness evidence only; nothing here is VERIFIED, because only the owner's real use can do that).

**Headline.** The final qualification run is green except one stale browser test: 111 of 112 Playwright tests pass; `tests/features.spec.ts:116` fails because the test clicks a toolbar button that now sits in the "More formatting" overflow menu. A copy of that spec using the spec's own `toolbarButton()` helper passes, so this is test drift rather than a product bug. It is recorded as **failed** and never retried into green; follow-up task **T046** (priority 2) owns the repair. Because of that one failed check the real verifier run exits **1** (it would exit 2, "consistent but incomplete", with only the 10 owner/review items pending). The candidate stays "incomplete". A fresh normal `Personal Word.app` was built and passes identity, freshness and the no-diagnostic-marker scan.

## 1. Commands, in the order they ran (all serial, pinned Node v22.23.3, one at a time, slot held by T021)

Logs and helper files are under `node_modules/.cache/personal-word-beta/team-t021/` (`logs/`, `steps.log` has exact UTC start/end times and exit codes). Machine load was low (about 2), so everything was quick.

| # | Command | Log | Result | State |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit -p .` | `logs/1-tsc.log` | exit 0, no output (8 s) | passed |
| 2 | `npm run build` | `logs/2-build.log` | `built in 7.66s` (chunk-size warning only) | passed |
| 3 | `npm test -- --no-file-parallelism --maxWorkers=1` | `logs/3-vitest.log` | 47 files passed; **865 tests passed** (was 858 before T043) | passed |
| 4 | `npx playwright test -c team-t021/pw-1490.config.mjs --workers=1` | `logs/4-playwright.log`, `pw/report.json` | **111 passed, 1 failed** of 112 in 4.3 min, 23 spec files, retries 0 | **failed** |
| 5 | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | `logs/5-cargo.log` | 48 passed, 0 failed, 1 ignored (the 100k-word benchmark) | passed |
| 6 | `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` | `logs/6-smoke-build.log` | `Finished dev profile ... in 43.66s`; diagnostic binary sha256 `9d4c24fe...` | passed |
| 7 | `python3 scripts/native-reliability.py --suite baseline` | `logs/7-native-baseline.log` | run `20261025T093854Z-eb139b9b`: 13 passed + 5 negative controls detected | passed |
| 8 | `python3 scripts/native-reliability.py --suite beta` | `logs/8-native-beta.log` | run `20261025T093937Z-7c31d8de`: 19 passed + 42 negative controls detected | passed |
| 9 | native print matrix | -- | not run: WP8 feasibility STOP (`05-layout/REVIEW.md`, `team/DECISIONS.md` "WP9/WP10 cancelled"); recorded as `not-run`, `applicable: false` | not-run (N/A) |
| 9b | `cargo test --release --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 bench_save -- --ignored --nocapture` | `logs/9-bench.log` | 100k words, 100 saves: median 108.12 ms, p95 117.98 ms (bound 150 ms) | passed |
| 10 | `npm run tauri build` (no `--features`, no `--config`) | `logs/10-release-build.log` | `Finished 1 bundle`, Personal Word.app 15.49 MiB (2 min) | passed |

Notes on the table:
- Step 9b is an addition to the brief's list. It gives `saveBenchmark` a fresh log rather than borrowing T018's numbers, and warms the release dependencies for step 10.
- Step 4 deviation: the recorded `c2r-full.config.mjs` uses port 1420, which a stray dev server holds. `pw-1490.config.mjs` has identical settings (production preview via `npm run preview`, one worker, retries 0, timeout 90 s) on port 1490 with its own report and results folder. `dist/` was rebuilt by step 2 just before.
- Step 4 failure, exactly: `tests/features.spec.ts:116 page layout reflows long paragraphs and preserves undo and formatting`, timeout at line 128 waiting for `getByRole('button', { name: 'Line and paragraph spacing' })`. Per-spec results are in `EVIDENCE.json` `checks.playwright.perSpec` (22 files all green; `features.spec.ts` 5 passed, 1 failed). Diagnosis (unconfirmed by the owner, but demonstrated): the failure snapshot shows the button inside the overflow menu; `Writer.tsx` and `editor.css` changed on 2026-10-24 03:26, after the spec last passed (2026-10-23); a cache copy of the spec using `toolbarButton()` passes (`logs/diag-features-doctored-spec.log`, 1 passed). The repo spec was not touched.
- `scripts/verify-release.py` was not run: it demands a clean git checkout (`git diff --quiet HEAD`), a DMG and release metadata; the tree has uncommitted work and distribution is descoped. Recorded under `notApplicable.verifyReleaseScript`.

## 2. Native runs

Both runs used the isolated `com.folio.smoke` profile folders under `node_modules/.cache/personal-word-beta/d1/`; the real `com.folio.writing` library was never opened. Host `macOS-15.7.9-x86_64`, architecture x86_64 (`file` on the diagnostic binary agrees).

| Suite | Run ID | result.json sha256 | Identity manifest (sourceManifestSha256) | Diagnostic binary sha256 |
|---|---|---|---|---|
| baseline | `20261025T093854Z-eb139b9b` | `2d7c6466e6fddee70c1649dd70a671f25abc281b5f1bbf9ed3a8fa3905b703f2` | `7e07795970ee8195846170a408c43f9e70b4135aecebe4527e0a5d76926f3e94` | `9d4c24feeb89d3332069bafc38c20a4aa55121f1108a7054baf77e80e10de3a4` |
| beta | `20261025T093937Z-7c31d8de` | `809c23d8029be5a5d3ac7bfbbc04283dc1bc58e04f179def018d0b972a1eba3e` | same | same |

The identity manifest covers 143 files (all of `src/`, `src-tauri/src/` and the fixed inputs); it differs from T018's `2d7538f3...` because T043 changed `pdf.ts`/`docx.ts` and added a file, which is why the smoke binary had to be rebuilt first.

## 3. Normal app

- Path: `src-tauri/target/release/bundle/macos/Personal Word.app` (absolute: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`). Built 09:43:41Z-09:45:46Z (05:43-05:45 EDT) from the tree pinned by `SOURCE_MANIFEST.json`.
- Main binary `Contents/MacOS/folio`: sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`, Mach-O x86_64, modified 05:45:46 EDT (after the build start and after every source file).
- Replaced the previous bundle (binary sha256 `86d9e980...`, built 2026-10-24 23:31 EDT); a copy of it is kept in `team-t021/old-app-copy/` for the stale-bundle control. No older downloadable was touched.
- `Info.plist`: CFBundleName and CFBundleDisplayName `Personal Word`, CFBundleIdentifier `com.folio.writing` (equals `tauri.conf.json`), CFBundleShortVersionString and CFBundleVersion `0.1.1`.
- Marker scan of the whole binary (byte search plus `strings`): zero hits for `smoke_beta_fixture`, `post-asset-stage`, `post-merge-safety-snapshot`, `post-restore-safety-snapshot`, `FOLIO_SMOKE`, `Beta synthetic durability fixture`, `com.folio.smoke`, `native-print`; the verifier also searches `native-smoke`, `smoke_report`, `smoke_progress` (zero hits).
- Not signed, notarized, published or copied anywhere. Opening it for the first time is the owner's job (`com.folio.writing` is the real library).

## 4. Verifier

`scripts/verify-beta-evidence.py --evidence <EVIDENCE.json> --source-manifest <SOURCE_MANIFEST.json>`; `--write-source-manifest <file>` writes the manifest (207 files: `src/**`, `src-tauri/src/**`, `src-tauri/{tests,capabilities,resources}`, `tests/**`, `scripts/**`, `package*.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, Cargo files, `build.rs`, tauri configs; caches, `dist`, `target`, `node_modules`, `__pycache__` excluded). Manifest digest `950a42bcee0c9a6bfe12fd339ba5110f1a19149a4fb2a112a8e75d9ff5f80d70`.

Exit codes: 0 everything verified; 1 integrity failure or a failed check; 2 consistent but items pending/blocked/not-run (named in the output); 3 usage.

**Real run** (`team-t021/logs/verify-real.log`): **exit 1**. Failure named: `CHECK-FAILED: playwright is recorded as failed`. Everything else passes (source hashes, tsc, build, units, cargo, smoke build, benchmark, both native runs against the current tree and binary, app identity/freshness/markers). Pending, named in the output: `independentReview` (pending T022; `06-durability/REVIEW.md` is an off-board draft and is not read as a pass), `keyboardAndCommentAnchors`, `closeRetry`, `recoveredImage`, `preRestoreSafetyCopy`, `wordRendering`, `appleSilicon`, `voiceOverAndIme`, `longSession`, `webkitVisuals`. Not applicable (printed as N/A): `nativePrintMatrix`, `verifyReleaseScript`.

**Fail-first controls** (`team-t021/controls/`, one log per control, `SUMMARY.txt`; generated by `make_controls.py` from copies, real files untouched). Each control is the real evidence with exactly one defect; it must produce the real run's one existing failure plus its own single named code. All 14 came out as expected:

| Control | Defect | Distinct reason |
|---|---|---|
| 01 | `native.architecture` removed | `NATIVE-ARCH-MISSING` |
| 02 | Word gate `passed` but records a `blockedReason` | `BLOCKED-CLAIMED-PASSED` |
| 03 | one manifest hash altered (`src/model.ts`), manifest digest and evidence link recomputed so only the per-file check can catch it | `SOURCE-HASH-MISMATCH` |
| 04a | `app.path` is the diagnostic smoke binary | `APP-STALE-SMOKE` |
| 04b | `app.path` is the previous (Oct 24) bundle copy | `APP-STALE-SMOKE` |
| 04c | recorded build start later than the binary's mtime | `APP-STALE` |
| 05a | `checks.tsc.logPath` does not exist | `PATH-MISSING` |
| 05b | native beta `result.json` path does not exist | `PATH-MISSING` |
| 06a | unit test count edited by one | `COUNT-MISMATCH` |
| 06b | a signing field added | `SCHEMA-FORBIDDEN-FIELD` |
| 06c | review claimed passed from the draft `REVIEW.md` with no hash | `REVIEW-CLAIM-UNBACKED` |
| 06d | `meta.status: "passed"` while items pending | `STATUS-OVERCLAIM` |
| 07 | **SYNTHETIC all-passed** (Playwright report doctored green, fake owner/review files in the cache folder) | exit **0** |
| 08 | **SYNTHETIC**: Playwright passed, owner gates and review pending | exit **2**, the 10 pending items named, no failures |

Controls 07 and 08 are labelled synthetic; they prove exit 0 is reachable only when nothing is pending and are never the real file. (An earlier run of the control script printed 06b as UNEXPECTED: the draft key filter missed camelCase keys such as `signedBy`; fixed in the verifier by splitting words, then manifest, evidence and controls were regenerated.)

### What changed in the inherited draft, and why

The off-board draft was replaced wholesale (kept: SHA-256 helpers, the idea of re-reading run folders and scanning the binary). Defects found:
1. `meta.status` had to be `passed` and `blockers` had to be empty, so the script could only ever pass or crash; there was no honest "pending" exit. Now states are `passed | failed | blocked | not-run`, owner items are `pending`, exit 2 means "consistent but incomplete".
2. It took the review verdict from `06-durability/REVIEW.md`, an off-board draft T022 will replace. Now the review field is `pending T022` and a `passed` claim needs a reviewer, a file, and a matching file sha256.
3. There was no `--source-manifest` file (the plan interface); hashes lived inside EVIDENCE.json and could not detect added or removed files. Now a separate manifest, compared both ways (changed, missing, unlisted).
4. No check that the native run folders match the current tree. Now each run's recorded identity (143 inputs, manifest digest, binary sha) is compared with the current sources and the current diagnostic binary, using `native-reliability.py`'s own `source_inputs()`.
5. Hard-coded thresholds (>= 800 tests, >= 38 Rust tests) and trusted counts. Now every count is re-derived from the log (or the Playwright JSON report) and compared; logs are pinned by sha256.
6. No native architecture field, no Word/blocked handling, no extra-field rejection, no signing-field ban, no app freshness check, a release check that assumed the wrong binary markers. All added.
Dropped: the per-scenario name cross-check (replaced by the hash-bound `result.json` plus counts and process-log existence) and `--run-benchmarks` (the benchmark is run as a normal step with a log instead).

## 5. Deviations and not covered

- Deviations: port 1490 instead of 1420 for Playwright (stray server holds 1420); print matrix not applicable (WP8 STOP); `verify-release.py` not run; added step 9b.
- Not re-inspected by T021: the light/dark screenshots and rendered DOCX/PDF/Markdown export artifacts (plan step 4) -- those were T019's deliverable (`artifact-acceptance.md`, approved); T043 changed `pdf.ts`/`docx.ts` afterwards and its reviewer ran the 180 export tests, so Gate D should look at the exports once more.
- Not covered by anything here: the 10 owner/review items above; Apple Silicon and other macOS versions; native WebKit visual rendering of the new UI (browser results are Chromium only); real Word rendering of DOCX; VoiceOver/IME; power loss or hardware failure; an uncommitted keystroke; the CSL import dialog natively. Source merge and restore crashes drive the app's own store calls but not the dialogs (T018 section 8).
- Source freeze: the evidence is pinned to the tree at manifest `950a42bc...`. Any later edit under `src/**`, `src-tauri/src/**`, `tests/native-*.js` or the fixture also invalidates the native runs and the app (rebuild smoke binary, rerun native suites and `npm run tauri build`). Edits elsewhere under `tests/**` or `scripts/**` (for example the T046 repair) only change the manifest.

## 6. Regenerating after T046 / T022 (exact commands)

Run from the project root with the pinned Node on `PATH`, and only while holding the serial slot:
1. `npm run build` (dist must be current), then `bash node_modules/.cache/personal-word-beta/team-t021/rerun-playwright.sh` (appends to `steps.log`, rewrites `logs/4-playwright.log` and `pw/report.json`).
2. `python3 -B scripts/verify-beta-evidence.py --write-source-manifest docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json`
3. `python3 -B node_modules/.cache/personal-word-beta/team-t021/make_evidence.py docs/agent-work/2026-10-20-beta-roadmap/06-durability/EVIDENCE.json docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json` (it rewrites the whole file from the logs; owner gates and review come out `pending`; after T022 edit `review` by hand to `{"state":"passed","reviewer":"<id>","reviewFile":"<path>","reviewFileSha256":"<sha256>"}` and, when the owner reports, each owner gate to `{"state":"passed","reportedBy":"owner","reportFile":"<path>","reportSha256":"<sha256>"}`).
4. `python3 -B scripts/verify-beta-evidence.py --evidence docs/agent-work/2026-10-20-beta-roadmap/06-durability/EVIDENCE.json --source-manifest docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json`; expect exit 2 with only the owner and review items named.

Files created or changed by T021: `scripts/verify-beta-evidence.py`, `06-durability/EVIDENCE.json`, `06-durability/SOURCE_MANIFEST.json`, `06-durability/IMPLEMENTATION_LOG.md` (appended), this file; helpers `make_evidence.py`, `make_controls.py`, `run-serial.sh`, `run-final.sh`, `rerun-playwright.sh` and all logs in `node_modules/.cache/personal-word-beta/team-t021/`. No product code, no commits, no installs.

## 7. T046 rerun (2026-10-25, agent-d5dc, CLAIMED)
`tests/features.spec.ts` line-spacing step now goes through the spec's `toolbarButton()` helper (More formatting overflow); fail-first single-spec run failed at line 128 before the edit and passed after. Full production-preview Playwright (port 1490, 1 worker, retries 0) rerun: 112 passed / 0 failed across 23 spec files. SOURCE_MANIFEST.json regenerated (207 files, digest ed8ea16f12a9af75213b5a12b0e468ac65ca13c5bfed025d14671881d3cc9772 (superseded by 24fa1a86893ba3a6cf4cc08471b222949c5b7ec9eaf34840e0bed5720928e97c after T048 regenerated the manifest; same 207 files, the digest is the manifest's own manifestSha256 field, which the verifier recomputes)) and EVIDENCE.json rebuilt with make_evidence.py. `verify-beta-evidence.py` exits 2 with no failed check and exactly 10 pending items (independentReview/T022 plus 9 owner items); native runs and the app remain valid (identity 7e07795970ee8195 unchanged). Logs and report: node_modules/.cache/personal-word-beta/team-t046/ (REPORT.md).
