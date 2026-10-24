# REVIEW — Reliable checks and installable Mac downloads (R1 scope)
Reviewer: Codex | Range: `2bb181bebb567b7dc35f66332ea905b5feab9262`..working tree | Date: 2026-10-22

## Verdict: CHANGES REQUIRED

## Summary
The R1 implementation matches the reviewed plan and its focused local tests passed. The indentation decision is extracted without changing the existing selection-based behavior; browser tests now establish actual ProseMirror selection readiness and cover Blank, Chicago, list, and screenplay behavior. The 70-case repeat passed. R1 remains incomplete because the planned hosted frontend/browser and independent Rust jobs have not run on the reviewed revision.

## Findings
| # | Severity | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| 1 | Medium | `.github/workflows/ci.yml:16-64` | Hosted qualification is pending, so the planned independent frontend/browser and Rust jobs have not been confirmed on this revision. | No hosted run was dispatched; implementation log records hosted jobs pending. | After the reviewed change is committed and push/dispatch is authorized, confirm both workflow jobs are green before marking R1 complete. |

## Plan vs diff
- Claimed done but absent from diff: None within R1 scope.
- In diff but not in plan: None within R1 scope. The conditional `src/Writer.tsx` change was not needed; there is no R1 change to it.
- Reviewed files: `src/editor/indent.ts`, `src/editor/indent.test.ts`, `tests/editor-toolbar.spec.ts`, `tests/ci-indent.spec.ts` (untracked), `playwright.config.ts`, and `.github/workflows/ci.yml`.
- The helper extraction in `indent.ts` keeps the production branch on `selection.empty`, paragraph `parentOffset`, and block type. Unit tests construct explicit ProseMirror selections. Browser tests press Home and assert ProseMirror state and DOM offset before Tab; they do not set the selection directly.
- CI retains pinned actions and read-only permissions, splits Rust into its own job, and configures one worker, zero retries, no server reuse, and trace-on-failure.

## Re-run validation (commands and results)
- `npm test -- src/editor/indent.test.ts` — exit 0, 1 file / 7 tests passed. Full output: `node_modules/.cache/personal-word-beta/r1/resume-20261022/review-indent-unit.log`.
- `npm run test:e2e -- tests/ci-indent.spec.ts tests/editor-toolbar.spec.ts --workers=1` — exit 0, 7 tests passed in 19.0 seconds. Run used the pinned Node v22.23.3 path and localhost permission. Full output: `node_modules/.cache/personal-word-beta/r1/resume-20261022/review-indent-browser.log`.
- `npm run test:e2e -- tests/ci-indent.spec.ts tests/editor-toolbar.spec.ts --workers=1 --repeat-each=10` — root-run log read in full; exit 0, 70 tests passed in 4.1 minutes. Output: `node_modules/.cache/personal-word-beta/r1/resume-20261022/repeat10-pm.log`.
- `git diff --check 2bb181b -- src/editor/indent.ts src/editor/indent.test.ts tests/editor-toolbar.spec.ts tests/ci-indent.spec.ts playwright.config.ts .github/workflows/ci.yml` — exit 0.

## Evidence level reached, and what the user must still verify by hand
R1 changes are present, wired into the existing keyboard shortcut, and tested in local Chromium and unit tests. The isolated restored old setup log records a prior DOM Home offset of 0, then ProseMirror `parentOffset` 19 when Tab runs, producing `margin-left: 0.5in`; its repeat failed 1/10. The original-source baseline also reproduced the toolbar margin-left failure. These are controlled test-setup reproductions, not evidence of a production behavior defect.

The browser checks use Chromium and browser storage. They do not prove macOS WebKit/native persistence. The owner has explicitly held native WebView tests. No hosted workflow result or user-confirmed runtime behavior is available. No beta release approval is implied.

## Not reviewed / limits
- Hosted frontend/browser and Rust jobs were not dispatched and are not confirmed green.
- Native WebView, release builds, signing, notarization, installation, and publication are outside this R1 review and remain unqualified.
- Broader dirty beta files and later roadmap stages were not reviewed or certified.


# R2 distributable candidate review -- 2026-10-23
Reviewer: Claude (Sonnet 5.5, independent R2 reviewer) | Range: `2bb181bebb567b7dc35f66332ea905b5feab9262`..working tree (uncommitted; R2 has no commit) | Date: 2026-10-23

## Verdict: CHANGES REQUIRED (no Critical or High findings)

## Summary
The R2 preparation work is safe: nothing in it can publish, tag, release, upload a binary, or read a secret, and the scripts only write to a new/empty `--out` directory. The workflow is manual-only, read-only, uses pinned action SHAs that match their upstream tags, and passes the reviewed commit through `env:`, not into shell text. Version fields are consistent at 0.1.1 and `com.folio.writing` is preserved. The verifier fails closed on every negative control I reproduced, and candidate mode reports `distribution_ready: false`.

The verdict is CHANGES REQUIRED, not APPROVE, for three reasons. Two Medium defects weaken the gates R3 will lean on: the blocker list can silently become empty, and the source archive can never be complete because the packager filters its own script. R2 steps 4 and 6 (real per-architecture builds, clean offline reconstruction) and the acceptance commands on a real `.app` have not run. The logs already say so honestly (R2 "IN PROGRESS", "not DONE"). Do not change this finding into "R2 done". None of this blocks committing the preparation files, because nothing can publish.

## Findings
| # | Severity | Plan/Impl | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | Medium | Implementation | `scripts/verify-release.py:208-219`, `scripts/package-source.py:373-380` | The release-blocker list is parsed from prose bullets that start with `- `. If the section keeps its header but uses `* ` or `1.` bullets, or is emptied, the parser returns `[]` instead of failing. Strict mode (`--require-notarized`) rejects only `source["blockers"]` and a review JSON whose `distribution_blockers == []` (lines 323-325, 236). A formatting edit can therefore clear the gate silently. Strict mode still needs a real Developer ID signature, Gatekeeper, a stapled ticket and a hash-bound `release-review.json`, so this is a weakened gate, not a bypass. | Disposable fixture: committed `docs/distribution.md` with every `- ` changed to `* `, regenerated manifest, ran candidate mode: `pass False []` (blockers empty). Baseline fixture gave 8 blockers. | Fail closed when the marker exists but zero bullets parse unless the section holds an explicit sentinel such as "No current release blockers."; accept `-`/`*` bullets and wrapped lines; add a negative control for it. |
| 2 | Medium | Implementation | `scripts/package-source.py:31`, `:284-285`, `:303-305` | `PERSONAL_PATH` is a literal that matches itself. Any tracked file containing `/Users/<x>` is omitted, including `scripts/package-source.py` (the regex literal) and `docs/agent-work/2026-10-19-alpha-security-reliability/PUBLICATION_AUDIT.md` (prose about a `/Users/` prefix). `source_archive_complete` is therefore always False, the completeness blocker can never clear, and the packaging script ships without itself. The filter is safe but over-broad, and the "archive contains no machine paths" aim is met only by dropping files. | Fixture repo containing only copies of the scripts: `filtered_source_files == [{'repo_path': 'scripts/package-source.py', 'reason': 'tracked documentation contains a personal machine path'}]`, `source_archive_complete False`. Grep of the real path list (220 tracked/planned paths) found exactly these two files matching. | Make the pattern non-self-matching (construct it from pieces), sanitize or reword the audit prose, or add a reviewed allowlist. Keep filtering real personal paths. Re-run the packager on a committed tree and show `source_archive_complete: true` or an explained list. |
| 3 | Medium | Implementation (evidence gap, logged) | whole stage | No real candidate exists. No `.app` or DMG was built, `lipo`/`verify-release.py` was never run on one, the hosted workflow was never dispatched, and `package-source.py --revision <sha>` cannot run on the current uncommitted tree (it requires the four manifests to equal the commit). Unverified assumptions include: whether Tauri maps `"resources/licenses/": "licenses/"` to `Contents/Resources/licenses/`; whether the DMG step works headless on `macos-15-intel`/`macos-15`; whether offline `cargo tree --target aarch64-apple-darwin` works on the Intel runner; and whether the executable mtime stays newer than the manifest. Plan steps 4 and 6 and the real-bundle acceptance commands are not done. | Logs say "NOT RUN". No bundle under `src-tauri/target` was produced or touched by me (owner HOLD). | Keep R2 IN PROGRESS. After the owner lifts the hold: build per architecture, run the plan acceptance commands against the real bundles, and keep the verbatim output. |
| 4 | Low | Implementation | `.github/workflows/release.yml:22`; `docs/distribution.md` | `environment: release-candidate` creates no protection by itself, and `workflow_dispatch` runs the workflow file from whichever branch is selected. Anyone with write access can dispatch an edited workflow from a branch unless the environment has required reviewers and a deployment-branch rule limited to `main`. The log and HANDOFF already say this. | Workflow lines 11-13 (`contents: read`, `actions: read`); no secrets referenced. | Owner action (not a code change): configure required reviewers and restrict deployment branches to `main` before the first dispatch. Add that to the distribution doc as a pre-dispatch step. |
| 5 | Low | Implementation | `scripts/verify-release.py:241-309` | Bundled-license verification covers only the three Noto OFL texts. The other shipped license files (MPL texts, jszip, sax, caniuse-lite, webpki-roots, rusqlite) and any extra or missing files in `Resources/licenses/` are not compared with `src-tauri/resources/licenses/`. The `"OFL-1.1" in notice_text` check is shallow. | Code read; fixtures only exercised the three Noto files. | Compare the whole `licenses/` directory (names and bytes) with the source directory, and confirm every file named in the notice file exists. |
| 6 | Low | Implementation | `scripts/verify-release.py:296` vs `:190` | The bundled notice is compared with `Path.cwd()/src-tauri/resources/...` before `source_checkout()` enforces cwd == repo root. The run still fails later from a wrong cwd, so no wrong pass results; the order is just wrong. A symlinked license file is rejected with the misleading reason "required bundled Noto OFL license text is empty". | Fixture: replaced a license with a symlink: rejected (`rc=1`) with the "empty" message. | Resolve the source root from `ROOT`, not `cwd`; give the symlink case its own message. |
| 7 | Low | Implementation | `src-tauri/resources/THIRD_PARTY_NOTICES.txt`; `src-tauri/Cargo.lock:4145,4154` | The notice lists `webpki-roots` 1.0.9 only. The lock also contains 0.26.11, and no text for it is shipped. The notice also does not give per-crate attribution for the MIT/Apache crates that would be linked. The notice says openly that it is not a complete binary notice package, and `option-ext`/`selectors` are listed as unresolved. | Lock inspection. All 11 shipped license files are byte-identical to their `node_modules` or Cargo-cache sources (`cmp` on all 11 license files; versions match: fontsource 5.3.0, caniuse-lite 1.0.30001816, jszip 3.10.2, sax 1.6.1, cssparser 0.37.0, cssparser-macros 0.7.1, dtoa-short 0.3.5, webpki-roots 1.0.9, rusqlite 0.32.1). | Resolve in the same legal/source review that closes the logged blockers. Do not claim license completeness before then. |
| 8 | Low | Implementation | `.github/workflows/release.yml:93-95,121-124`; `verify-release.py:60-75`; `package-source.py:25-65` | The unsafe-path rule is copied into four places, and it is broad (any path part containing "token", "secret", "keys", "cache", ...). Today none of the 220 tracked/planned paths trips any copy (checked with both functions), so there is no current failure. A future file such as `tokens.css` would make the verifier fail permanently and make the packager drop the file. All of this fails closed. | `verify unsafe: []`, `package unsafe: []` over `git ls-files` + HEAD tree + untracked. | Optional: share one rule and document the naming restriction. |
| 9 | Low | Implementation | `src-tauri/tauri.release.conf.json:4-7`; `release.yml:160-168` | The DMG is built (`dmg` target) but never inspected, hashed, or uploaded. Only the `.app` is verified, and the strict review binds to the executable hash, not the DMG or the full bundle. Fine for metadata-only R2; R3 must verify and bind the DMG. | Code read. | Carry into R3: verify DMG contents/hash and bind the review to the shipped asset. |
| 10 | Low | Plan deviation (logged) | plan R2 step 2 | The plan says to link notices from "About/README". There is no in-app About screen, so only the README and `docs/distribution.md` link them, and the bundle carries the files in `Resources/`. The log records the choice to avoid unplanned UI. | `grep` of `src/` found no About or notice reference. | None for R2. Owner to decide on an About link before release. |

## Plan vs diff
- Claimed done but absent from diff: none of the claimed files is missing. Present: `src-tauri/tauri.conf.json` (version 0.1.1 only), `package.json`, `package-lock.json` (both version fields), `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (folio entry only), `THIRD_PARTY.md`, `src-tauri/tauri.release.conf.json`, `src-tauri/resources/THIRD_PARTY_NOTICES.txt`, `src-tauri/resources/licenses/` (11 files), `scripts/verify-release.py`, `scripts/package-source.py`, `docs/distribution.md`, `.github/workflows/release.yml`. Planned work not done and honestly logged: per-architecture builds (step 4), clean offline reconstruction (step 6), real-bundle acceptance commands, and the unresolved `option-ext`/`selectors` MPL texts. The unbuilt "notices bundled" claim is therefore wiring only (see #3).
- In diff but not in plan, or attributed elsewhere: the README distribution paragraph and the `THIRD_PARTY.md` hunks are R2 and fit the plan's docs scope. The other README hunks (LibreOffice/citation/Zotero text) belong to other stages. The `.github/workflows/ci.yml` hunks (split `frontend`/`rust` jobs, `--workers=1`) are R1. The `docs/validation.md` diff is the D1 section only; R2 added nothing there, and the plan lists `validation.md` only under R3. `Cargo.toml` is shared with D1, but its diff is the version line only.
- Version consistency (all 0.1.1): `package.json:3`, `package-lock.json:3` and `:9`, `src-tauri/Cargo.toml:3`, `src-tauri/Cargo.lock:826` (`folio`), `src-tauri/tauri.conf.json:4`. `identifier` is still `com.folio.writing`. No leftover `0.1.0` in `src/`, `src-tauri/src/`, `tests/` or `scripts/`. The remaining `0.1.0` mentions in `docs/publication-readiness.md` and `docs/validation.md` are historical records of the old alpha build.
- Workflow safety, confirmed from code and `git ls-remote` read-only: triggers are `workflow_dispatch` only; permissions `contents: read` and `actions: read`; no `secrets.*`, no `gh release`, no tag or push, no `contents: write`, no `id-token`; `GH_TOKEN` is the default read token and is used only for one `gh api` GET. The three action SHAs match upstream tags (checkout v5.0.0 `08c6903c...`, setup-node v6.0.0 `2028fbc5...`, upload-artifact v6.0.0 `b7c566a7...`). `source_sha` reaches `ref:`, `concurrency` and an `env:` variable validated with a full 40-hex `re.fullmatch`; it is never interpolated into a `run:` script. Signing uses ad-hoc `APPLE_SIGNING_IDENTITY: '-'` only. Uploads are `candidate-evidence/*.json` only, so no binaries or source archives. The gate file hard-codes `ready_for_publication: false` and `binary_uploaded: false`.
- Script safety: the only writes are the `--out` files and a `tempfile.TemporaryDirectory`. There is no `rmtree`, `unlink`, `os.system`, `shell=True` or `extractall` in either script. `--out` must be new or empty. Tracked symlinks, ancestors and non-regular entries are rejected by the verifier and omitted by the packager. Package paths are checked by `safe_member` before any bytes are read.

## Re-run validation (commands and results)
All run lightweight, with `PYTHONPYCACHEPREFIX` pointing into the session scratchpad and `python3 -I` for the scripts. No build, cargo, Playwright, network write, or native launch.
- `python3 -m py_compile scripts/package-source.py scripts/verify-release.py` -- `COMPILE_OK`.
- YAML: no PyYAML installed, so I used `ruby -ryaml`. `release: jobs=["candidate"] perms={"contents"=>"read","actions"=>"read"} on=["workflow_dispatch"]`; `ci: jobs=["frontend","rust"] perms={"contents"=>"read"} on=["push","pull_request","workflow_dispatch"]`. Both parse.
- JSON parse of `src-tauri/tauri.release.conf.json` and `tauri.conf.json` -- `json ok`.
- `git diff --check HEAD` on the R2 manifest, doc and config files -- rc=0.
- `git ls-remote` (read-only) for the three action tags -- all three SHAs identical to those pinned in `release.yml` and `ci.yml`.
- Version greps (above) -- all six fields 0.1.1.
- `cmp` of all bundled license files with their node_modules/Cargo-cache sources -- identical; versions match the notice file.
- Safety-rule check over 220 tracked/HEAD/untracked paths with `verify-release.py:safe_source_path` and `package-source.py:safe_member` -- both list `[]` unsafe.
- Disposable fixture (a throwaway Git repo plus a fake single-arch `Personal Word.app` under the scratchpad, never the real project):
  - Baseline candidate check -- `pass`, `distribution_ready False`, `notarized False`, 8 blockers.
  - `--arch arm64` on an x86_64 binary -- `fail`, "executable architecture does not exactly match", rc=1.
  - `--version 0.1.0` -- `fail`, "bundle version does not match", rc=1.
  - Appended `FOLIO_SMOKE` to the binary -- `fail`, "native smoke-test marker", rc=1.
  - Removed `noto-serif-OFL-1.1.txt` -- `fail`, "required bundled Noto OFL license text is missing", rc=1.
  - Modified the bundled notice -- `fail`, "bundled notices differ", rc=1.
  - Symlinked license file -- `fail` (message imprecise, #6), rc=1.
  - `--require-notarized` on an ad-hoc/unsigned fixture -- `fail`, "code signature verification failed", rc=1 (so strict cannot pass without a real signature).
  - Tracked `HANDOFF.md`, `notes-token.txt` and a symlink: verifier -- `fail`, "tracked source contains an unsafe path"; packager (no cargo on PATH) -- exit 0, `status: provisional`, all three listed in `filtered_source_files` and absent from the tarball (`tar tzf | grep` found none).
  - Packager: non-empty `--out` rejected rc=1; abbreviated revision rejected rc=1. Baseline run produced `BUILDING.md`, `SHA256SUMS`, both archives and four JSON files, with 13 blockers, `source_archive_complete False`.
  - Bullet-format control (finding #1) -- `pass False []` (blockers empty), the weakness.
- Not run by instruction or hold: `npm run build`, `npm test`, Playwright, cargo, `npm run tauri build`, any workflow dispatch, native app.

## Evidence level reached, and what the user must still verify by hand
Reached: present and referenced (files exist, versions agree, notices byte-match their sources, workflow statically safe and parseable), plus tested on synthetic fixtures (verifier negatives and packager filtering). Not built, not wired on a real bundle, not tested on a hosted runner, and nothing confirmed in real use.

Owner steps still needed, in this order:
1. Decide on commit of the R2 preparation files after the Medium repairs (or accept them as logged Mediums).
2. Before any dispatch, configure the `release-candidate` environment: GitHub repo Settings, Environments, add required reviewers and limit deployment branches to `main`. Then dispatch `Prepare reviewed macOS candidate` with a full commit SHA that already has green CI.
3. After the owner lifts the native hold: read the two `candidate-evidence-*` artifacts for `verification.json` and `distribution-gate.json`; both must say not ready.
4. Resolve the logged binary-notice, source and legal items. Signing, notarization, Apple silicon install and publication remain R3 and need explicit owner approval.

## Not reviewed / limits
- No real candidate: no build, no DMG, no `lipo` on a real binary, no hosted workflow run, no signing or notarization, no ARM or install testing. Tauri resource mapping and the CI gate API call are unverified until a hosted run.
- Legal and license completeness not assessed. I compared the shipped license files with their sources but did not establish the compiled dependency graph, WebKit or Tauri notices, or SQLite contents.
- The packager's cargo/npm dependency-tree path ran only in the "cargo unavailable" branch; its offline resolution was not exercised.
- D1 files (`store.rs`, `lib.rs`, `smoke.rs`, native scripts) and R1/other-stage hunks were out of scope. The `native-smoke` marker list was checked only against the `cfg(feature)` gating seen in `lib.rs`, not against a compiled normal binary.
- Fixtures and temp output live in the session scratchpad, not in the project tree.
