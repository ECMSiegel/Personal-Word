# REVIEW -- D2 final durability and beta evidence (Review Gate D, team task T022)

Reviewer: agent-9e61 (Claude Opus; authored none of WP1-WP11, T018-T021, T043 or T046) | Date: 2026-10-25 (09:58-10:30 UTC) | Tree: HEAD `ee2fe3a` plus the uncommitted board work pinned by `SOURCE_MANIFEST.json` digest `ed8ea16f12a9af75...` | Status of everything reviewed: CLAIMED (no owner real use yet).

## Verdict: PASS (automated acceptance); beta readiness pending owner real use

Every required automated, native-harness and artifact check named by `team/PLAN.md` "How to verify" step 4 and `06-durability/PLAN.md` D2 (line 44) was executed on the current tree, passed, and was reproduced by my own reruns. Nothing failed, nothing blocked was counted as passed, and nothing was waived, so the D2 stop rule (line 45-46) is not triggered. The candidate is **not** beta-ready: nine owner real-use items and this review's own recording are pending, and the verifier correctly exits 2 ("consistent but incomplete"). Two findings were filed as scoped repair tasks (T048 verifier verdict parsing, T049 stale status lines in the docs); neither is a data-loss, export or durability defect, and neither changes `src/**` or `src-tauri/**`.

### What this file replaces, and why
This path previously held the D1 review (committed at `4f8e9ee`, verdict **CHANGES REQUIRED**, 2026-10-23). An off-board edit made on 2026-10-24 23:27 EDT (no board task owned this file then) rewrote that verdict to "PASSED" and appended an unsigned "Resolution of Findings" list whose claims no board task recorded. That upgraded verdict is not carried forward. Copies: committed D1 text `node_modules/.cache/personal-word-beta/team-t022/draft-backup/REVIEW.HEAD-ee2fe3a.md` (sha256 `c3ebcc1c...`), off-board draft `REVIEW.offboard-draft.md` (sha256 `6ba6e7ab...`); the D1 text also stays in git history. D1's findings were later addressed by board tasks with executed evidence (T005, T018, T021: native suites, release benchmark, normal-app marker scan); this review relies on that evidence, not on the draft's list.

## 1. Scope

- Request: `team/PLAN.md` Goal ("complete the remaining beta roadmap, pass its review gates, prepare it for owner testing") and Scope (WP1-WP11 and gates A-D in `DELEGATION.md`). Approved plans: beta roadmap `PLAN.md` with "Owner decisions -- 2026-10-23" (source beta; R2/R3 descoped; no new packages), `05-layout/PLAN.md` (L1 stop rule), `06-durability/PLAN.md` D2.
- Diff: `git status --porcelain -uall` against HEAD `ee2fe3a`: 49 modified tracked files and 79 untracked product/test/doc paths, plus board infrastructure (`team/`, `.agents/`) and generated `scripts/__pycache__/`. Every one of the 128 product/test/doc paths maps to at least one board task's registered paths (`team-t022/logs/hunk-trace.txt`); the off-board drafts in WP8/WP11 files are accounted for by the decision "Off-board WP8/WP11 files adopted by their board tasks" and were inspected/rewritten by T013 and T018. No unexplained path.
- Task reports read: `REPORT.md` (T001), `wp1`-`wp8`, `wave3-integration`, `keyboard`, `gate-a`, `gate-b`, `gate-b-repairs`, `feasibility`, `gate-c`, `wp11-matrix`, `artifact-acceptance`, `docs`, `evidence` (sections 1-7), T043/T046 reports, and the board log of every task (T001-T047 done except T022/T023).
- Not in scope: signing, notarization, DMG, publication (descoped by the owner); WP9/WP10 (cancelled after the WP8 STOP).

## 2. Evidence table

`R` = `node_modules/.cache/personal-word-beta/team-t021-review/` (my Part A reruns, T047), `T21` = `.../team-t021/`, `G` = `.../team-t022/`. All npm/npx runs used the pinned Node v22.23.3. Expensive runs were serial under the team serial-check slot.

| Check | Command | Log | Result | State |
|---|---|---|---|---|
| Types | `npx tsc --noEmit -p .` | `R/logs/1-tsc.log` (empty), T21 `logs/1-tsc.log` | exit 0, no output | passed |
| Production build | `npm run build` | T21 `logs/2-build.log` | "built in 7.66s"; `dist/` newer than every `src/` file at my Playwright run | passed (T021 run; not rerun, dist current) |
| Unit suite | `npm test -- --no-file-parallelism --maxWorkers=1` | `R/logs/2-vitest.log` | 47 files / 865 tests passed (equals T021) | passed |
| Browser, production preview | `npx playwright test -c R/pw-1493.config.mjs --workers=1` (clone of `c2r-full.config.mjs`, port 1493, retries 0) | `R/logs/4-playwright.log`, `R/pw/report.json` | 112 passed, 0 failed/flaky/skipped, 23 spec files; per-spec counts identical to `EVIDENCE.json` | passed (Chromium only) |
| Rust, offline serial | `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | `R/logs/3-cargo.log` | 48 passed, 0 failed, 1 ignored (the release benchmark) | passed |
| Isolated smoke build | `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` | T21 `logs/6-smoke-build.log` | Finished; binary sha256 `9d4c24fe...`; not rebuilt by me (identity matched) | passed |
| Native baseline | `python3 scripts/native-reliability.py --suite baseline` | T21 `logs/7-native-baseline.log`; run `d1/runs/20261025T093854Z-eb139b9b/` | 13 passed + 5 negative controls detected | passed (T021 run) |
| Native beta | `python3 scripts/native-reliability.py --suite beta` | T21 run `20261025T093937Z-7c31d8de`; my rerun `R/logs/5-native-beta.log`, run `20261025T100024Z-93ccb1f1` (result.json sha256 `40d0010b...`) | both 19 passed + 42 detected, same identity and binary, no `folio` process left | passed |
| Save benchmark | `cargo test --release ... bench_save -- --ignored --nocapture` | T21 `logs/9-bench.log` | median 108.12 ms, p95 117.98 ms (bound 150) | passed (one Intel host, load about 2) |
| Normal app build | `npm run tauri build` | T21 `logs/10-release-build.log` | Finished 1 bundle, Personal Word.app 15.49 MiB | passed |
| Native print matrix | `scripts/native-print-smoke.py --matrix` | -- | not run: WP8 STOP, WP9/WP10 cancelled | not-run, not applicable |
| `verify-release.py` | -- | -- | needs clean git + DMG; distribution descoped | not-run, not applicable |
| Evidence verifier | `python3 scripts/verify-beta-evidence.py --evidence .../EVIDENCE.json --source-manifest .../SOURCE_MANIFEST.json` | `R/logs/6-verify-real.log` | exit 2, 0 FAIL, exactly 10 pending (independentReview + 9 owner gates) | consistent, incomplete (correct) |
| Rendered exports (current `pdf.ts`/`docx.ts`) | `npx vitest run -c G/vitest.config.mjs` (copy of T019's harness, D1 workaround removed) | `G/logs/artifacts-vitest.log` | 1 passed; the unmodified project now exports to PDF with no refusal | passed |
| Light/dark UI | T019 screenshots (`team-t019/screens/`, approved by T044) | -- | spot-viewed `01-editor-dark`, `05-export-panel-light`: flat, square, sans UI, blue/semibold selection | Chromium only; WebKit owner-pending |

## 3. Source and artifact identities

- Source manifest: `06-durability/SOURCE_MANIFEST.json`, 207 files, digest `ed8ea16f12a9af75213b5a12b0e468ac65ca13c5bfed025d14671881d3cc9772`; recomputed by my own code: list digest equal, 0 mismatched / missing / unlisted files.
- Native identity (143 inputs from `native-reliability.py source_inputs()`): `7e07795970ee8195846170a408c43f9e70b4135aecebe4527e0a5d76926f3e94`, equal to the current tree; diagnostic binary `src-tauri/target/debug/folio` sha256 `9d4c24feeb89d3332069bafc38c20a4aa55121f1108a7054baf77e80e10de3a4` (unchanged before/after my cargo run).
- Native runs: baseline `20261025T093854Z-eb139b9b` (result.json `2d7c6466e6fddee7...`), beta `20261025T093937Z-7c31d8de` (`809c23d8029be5a5...`), Gate D beta rerun `20261025T100024Z-93ccb1f1` (`40d0010b87ada0d0...`). Host macOS 15.7.9 x86_64; isolated `com.folio.smoke` only.
- Normal app: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`; `Contents/MacOS/folio` sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`, Mach-O 64-bit x86_64, modified 2026-10-25 05:45:46 EDT (after the recorded build start 09:43:41Z; no app input file is newer). `Info.plist`: CFBundleName and CFBundleDisplayName "Personal Word", CFBundleIdentifier `com.folio.writing`, version 0.1.1 / 0.1.1. My own `strings -a` and byte-grep scan for `smoke_beta_fixture`, `post-asset-stage`, `post-merge-safety-snapshot`, `post-restore-safety-snapshot`, `FOLIO_SMOKE`, `Beta synthetic durability fixture`, `com.folio.smoke`, `native-print`, `native-smoke`, `smoke_report`, `smoke_progress`: 0 hits each (the same scan finds them in the smoke binary, so the scan works). The markers do not occur in `src/` or `dist/` (Rust-side only). The previous Oct-24 bundle (binary `86d9e980...`) is kept in `team-t021/old-app-copy/` for the stale-bundle control. Not signed, not opened against the real library.
- Rendered exports (`G/artifacts/`, `G/hashes-artifacts.txt`): `t019.pdf` `f3cab3b7...` (12 Letter pages, 5 embedded Noto Serif CID subsets), `t019.docx` `5146e3ae...`, `footnotes.xml` `47a2998e...`, `t019.md` `d0dd641f...` and `t019.txt` `95dcca85...` byte-identical to T019's, bundle `16d3da99...`, archive `da76c36e...` (differs from T019's only by fresh ids and timestamps). PDF/DOCX/ZIP bytes carry export timestamps; compare content, not hashes.

## 4. Fail-first spot checks (mine)

1. **T043 multi-paragraph notes, own pre-fix copies.** Pre-fix `pdf.ts`/`docx.ts` taken from `git show HEAD` (equal to T043's recorded before-hashes `ffef585b`/`acd72aa2`), aliased under the current `src/export/multiparagraphNote.test.ts` (`G/failfirst/`): **6 failed | 1 passed** (the passing one is the unchanged-output guard, as designed); current files: 7 passed. Real files unchanged (sha before = after).
2. **Verifier doctored controls on copies** (`R/controls/SUMMARY.txt`): T021's source-hash mismatch -> `SOURCE-HASH-MISMATCH`; blocked Word claimed passed -> `BLOCKED-CLAIMED-PASSED`; smoke binary as app -> `APP-STALE-SMOKE`; plus new ones: an older native run (T018-era identity `2d7538f3`) substituted with consistent hash/counts -> `NATIVE-IDENTITY-STALE`; nested `notarizationTicket`, `dmgDownloadUrl`, `codesign_identity` -> `SCHEMA-FORBIDDEN-FIELD`; T021's original failed Playwright report claimed passed -> `CHECK-LOG-FAILED`. Real `EVIDENCE.json`/manifest unchanged.
3. **Negative result -> finding F1:** a review file whose final verdict is FAIL but which mentions "Gate A verdict: PASS" is accepted as a passed review (R5, exit 2 instead of `REVIEW-CLAIM-UNBACKED`).
4. Reviewed (not rerun) earlier fail-first records: T046 `prefix-single.log` (fails at line 128) / `postfix-features-file.log` (6/6); T021's 14 controls; T018 Rust/TS/native controls (42 detected per beta run, which I re-executed as part of the beta rerun).

## 5. Gates A-D

| Gate | Record | Verdict | Basis |
|---|---|---|---|
| A (wave 0, WP1-WP4, keyboard) | `gate-a.md` (T007) | PASS (conditional) | executed browser + identity-pinned native baseline; Q001 open |
| B (WP5-WP7, Wave 3) | `gate-b.md` (T012), repairs `gate-b-repairs.md` (T032-T035) | PASS (evidence-limited) | executed Chromium/units/Rust; F1-F4 repaired and reviewed; B1-B7 boundaries carried |
| C (layout) | `gate-c.md` (T017) | PASS as a documented STOP | WP8 STOP reproduced (Arabic lam-alef not searchable); legacy pdf-lib exporter is the only PDF route; WP9/WP10 cancelled without code; F1 -> T041 done |
| D (WP11/D2, final qualification) | this file, `gate-d.md` | PASS (automated acceptance); beta readiness pending owner | sections 2-4; findings F1/F2 filed |

## 6. Known limitations (carried, not fixed here)

- Gate B: B1 Chromium only, no WebKit or native run of Wave 3 import/export/bundle/Zotero paths; B2 no owner use; B3 XML check rejects external DOCTYPEs only; B4 understated zip headers are caught only after inflation (Q003 open); B5 C3/Zotero gaps beyond the delegated scope (no polling/backoff, no `since`/version reuse, no server-ID check, remote deletions not marked, no distinct error messages or API-version header, any `/api/` path accepted natively, no resumable cancel, no auto-apply policy, no real-Zotero run; `wp6.md`); B6 browser-preview Zotero fetch path is an unapproved difference; B7 `zoteroOrigin` persistence untested.
- Gate C: native WebKit PDF path ended in STOP (Q004 open); legacy PDF refuses non-Latin/Greek/Cyrillic scripts and overlong notes; no page parity between editor page view and PDF/DOCX.
- Artifacts (`artifact-acceptance.md`, re-confirmed on the current build): PDF tables do not repeat the header row on continuation pages (pages 5-10 viewed); PDF images stack with no gap (O2, page 3); DOCX/PDF omit the project and section titles (O1); BibTeX "Jr." only in raw `cslData`; DOCX not opened in Word (header repeat, note paragraphs, RTL marking unobserved); QuickLook is not Word. T043 residual: DOCX continuation note paragraphs are unindented while PDF's are indented.
- Durability (`wp11-matrix.md` section 8): kills are SIGKILL at named checkpoints in an isolated store, not power loss or disk failure; uncommitted-keystroke survival not claimed; CSL import dialog not clicked natively; archive serialization unit-only; older-schema migration Rust-only; benchmark measured on one Intel Mac at low load.
- Platform: Intel only (no Apple silicon), macOS 15.7.9 only, no hosted CI, no VoiceOver/IME evidence.
- Open owner questions: Q001 (off-board WP8 edits), Q002 (off-board orchestrator edits), Q003 (zip header limit B4), Q004 (native print STOP options). The board proceeded on plan defaults; none is answered.

## 7. Findings

| # | Severity | Finding | Evidence | Task |
|---|---|---|---|---|
| F1 | Medium (verifier integrity, no product impact) | `check_review()` in `scripts/verify-beta-evidence.py` accepts any "verdict: PASS" substring, so a FAIL review that mentions an earlier gate's PASS would be recorded as a passed review. | control `R/controls/R5-fail-review-with-pass-substring.log` (exit 2, no failure) | **T048** (p2): anchor to the final verdict line, fail-first, regenerate manifest/evidence (scripts only; no native/app rebuild) |
| F2 | Low (documentation currency) | README.md, docs/validation.md, ROADMAP.md and both implementation logs still say the final qualification and app build are not done (858/46, "no single full-suite browser run", "T021 is open"). They understate rather than overclaim. | line pointers in T049 | **T049** (p2): dated updates from evidence.md and this review; docs are outside the source manifest, so no requalification |
| O1 | Info | Off-board edit flipped the committed D1 verdict in this file (see top). | `G/draft-backup/` | superseded here |
| O2 | Info | Stray items from earlier shell-quoting slips: empty folders `Projects/VC`, `Projects/Project` in the project root (born 2026-10-25 01:50) and a 110-byte file `/Users/ethansiegel/Local` outside the workspace (born 2026-10-24 23:45). Not created by the board's deliverables; left in place for the owner. | `stat` | owner may delete |

## 8. Definition of done (`team/PLAN.md`) -- assessment only, boxes not ticked

1. Reconciled with the working tree -- **met** (T001 approved; every changed path traces to a task).
2. All in-scope WPs and gates A-D complete, WP8 stop documented -- **met once T022 is approved** (WP9/WP10 cancelled per STOP; gates A-C done).
3. Required checks pass with retained logs and fail-first evidence; blocked checks not counted -- **met** for the automated scope (print matrix and `verify-release.py` recorded not-run/not-applicable, not passed).
4. Known limitations and evidence boundaries documented honestly -- **pending T049** (limitations are honest; the current status lines are stale).
5. Fresh normal app built, inspected, path recorded -- **met** (section 3).
6. Owner real-use checklist prepared, status CLAIMED -- **pending T023**.
7. Every board task done and reviews complete -- **pending** T022 review, T023, T048, T049.

## 9. Owner-pending (only the owner can close these; none may be recorded as passed by an agent)

keyboard-only editing and duplicate-comment jump in the real app; blocked-close retry; recovered image and its hash; reopening the pre-restore safety copy; Microsoft Word rendering of the exported DOCX; Apple silicon run; VoiceOver and input methods; a long real writing session; native WebKit light/dark visuals. Plus answers to Q001-Q004. Until then the verifier stays at exit 2 and the beta stays CLAIMED.
