# PLAN -- Reliable checks and installable Mac downloads
Date: 2026-10-20 | Architect: Codex | Project: Personal Word | Status: APPROVED -- owner: “Run the plan as cheap is as feasible utilizing luna as much as possible” (2026-10-20)

## Goal
A writer can download the right Mac installer, open it normally, and verify its version and source.

## Request
First milestone of [the parent plan](../PLAN.md): fix the missing downloadable app and CI before waiting for all later features.

## Definition of done
The Tab regression has a deterministic behavioral test; CI and Rust checks run independently; DMGs for both supported architectures include reviewed notices and corresponding source information; Developer ID/notary/clean-machine checks pass; README links only to verified published assets after separate release approval.

## Non-goals
App Store, automatic updater, unsigned public fallback, Windows/Linux, changing legacy storage identity, retargeting the existing source-alpha tag.

## Context (verified)
- `tests/editor-toolbar.spec.ts:21-44` expects first-line indent after Home/Tab; `src/editor/indent.ts:62-115` branches on document setting and ProseMirror parentOffset. Hosted failed logs show left indent instead. Exact cause UNKNOWN.
- Blank disables inherited first-line indentation -- `src/templates.ts:24-35`; default document settings enable it -- `src/research/types.ts:54-61`.
- CI is one sequential job: a browser failure prevents Rust tests -- `.github/workflows/ci.yml`, checks job. Playwright has no retries configured -- `playwright.config.ts`.
- Current bundle is app-only -- `src-tauri/tauri.conf.json`, bundle.targets. License inventory is not a complete binary notice package -- `THIRD_PARTY.md:11-17`.
- Credentials, signed-package installation on a second Mac, minimum-version/ARM execution are UNKNOWN. Parent baseline and approval rules apply.

## Rules in force
Parent plan Rules in force and project AGENTS.md. Do not inspect/copy secrets or change global tools. Current accepted native-sidebar gap applies to source alpha only. Never skip tests to make a release green. No release/push/tag mutation authorized by this DRAFT.

## Approach
Repair the actual selection/settings defect or test setup supported by evidence, not the expected product semantics. Separate read-only CI jobs so failures remain visible. Prepare architecture-specific signed DMGs through a manually dispatched, protected release workflow; use existing Tauri CLI for packaging. Existing alpha stays immutable. Every publish consumes an exact reviewed candidate manifest.

## Tasks
### R1 -- Reproduce and repair the hosted indentation failure
- Files: modify `tests/editor-toolbar.spec.ts`, `src/editor/indent.ts`, `src/Writer.tsx` only if the traced defect requires it; `src/editor/indent.test.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`; create `tests/ci-indent.spec.ts` and `docs/agent-work/2026-10-20-beta-roadmap/01-downloads/IMPLEMENTATION_LOG.md` during execution.
- Interfaces: uses existing `indentKeys(isScreenplay, documentIndent)`; preserve Tab-at-start first-line behavior when inherited indent is zero, left-indent increment when already inherited, Shift+Tab reversal, and list/screenplay behavior. Provides green frontend/browser and independently reported Rust jobs; no model change.
- Steps: (1) Capture hosted failure and passing-run environment, selected template/settings and editor JSON/ProseMirror selection. (2) Reproduce both paragraph-start and non-start cases using an explicit ProseMirror text selection, plus a separate actual Home-key behavior test; DOM anchorOffset alone is insufficient evidence of parentOffset. (3) Trace template readiness/settings closure and selection. Repair only the demonstrated race/selection/settings defect, or correct setup if production semantics were already correct. (4) Assert resulting firstLineIndent/indentLeft values and focus, then undo/redo/reload, for Blank and Chicago; retain list/screenplay cases. (5) Keep retries zero; set one worker explicitly and CI server reuse false. Enable trace-on-failure and split Rust into a separate read-only workflow job. Preserve pinned actions and least privilege.
- Acceptance check: `npm test -- src/editor/indent.test.ts`; `npm run test:e2e -- tests/ci-indent.spec.ts tests/editor-toolbar.spec.ts --workers=1 --repeat-each=10` -> all pass with zero retries, no weakened assertions; `gh run view <new-run> --repo ECMSiegel/Personal-Word --json jobs` -> distinct frontend/browser and Rust jobs reported, both green before release. Hosted dispatch/push requires execution delivery authorization.
- Fail-first: controlled setup reproduces expected first-line versus actual left-indent mismatch before repair; restore the specific defect in an isolated copy and require the same assertion to fail. An intermittent hosted log alone is not the complete fail-first proof. Do not add arbitrary sleeps or accept either indent as equivalent.
- Stop and ask if: only a test expectation change would contradict the stated Tab behavior; changing app-wide defaults is proposed; root cause cannot be reproduced after instrumented comparison.
- Default if unanswered: keep original product behavior; mark unresolved CI gate, continue R2 preparation.

### R2 -- Build a complete distributable candidate
- Files: modify `src-tauri/tauri.conf.json`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `THIRD_PARTY.md`; create `src-tauri/tauri.release.conf.json`, `src-tauri/resources/THIRD_PARTY_NOTICES.txt`, `src-tauri/resources/licenses/` exact reviewed license files, `scripts/verify-release.py`, `scripts/package-source.py`, `docs/distribution.md`, `.github/workflows/release.yml`. Integrator owns manifest/version changes; dependency versions do not change merely for packaging.
- Interfaces: `verify-release.py --app <path> --arch <x86_64|arm64> --version <version> --source-manifest <json> [--require-notarized]` exits nonzero for any required mismatch; output is redacted JSON evidence. `package-source.py --revision <sha> --out <dir>` emits corresponding-source archive, build/lock instructions, provenance and SHA256SUMS; no credential/private-ref inclusion. Release workflow produces candidate files only until R3 owner approval.
- Steps: (1) Reconcile exact runtime assets/compiled dependencies and applicable license texts, including existing bundled Noto OFL, MPL components and GPL corresponding-source obligations; unresolved obligations block binary delivery. (2) Bundle notice resources and link them from About/README distribution docs; inspect actual packaged Resources. (3) Use release-only config for app+DMG, hardened runtime/signing configuration, retaining `com.folio.writing`. Bump agreed version consistently; never retag v0.1.0-alpha.1. (4) Build x86_64-apple-darwin and aarch64-apple-darwin artifacts using explicitly recorded runner architecture/target; no assumption macos-latest is Intel. Request any missing target/tool installation separately. (5) Create protected manual release workflow with read permissions by default, write permission only for owner-approved publish job, no secrets on fork/pull-request builds, pinned actions and no public assets from an unreviewed commit. (6) Generate source/build manifest and inspect a clean offline reconstruction of bundled source obligations; publish no “license-complete” claim without actual review.
- Acceptance check: `python3 scripts/verify-release.py --app '<candidate.app>' --arch <arch> --version 0.1.1 --source-manifest <manifest.json>` for each architecture -> identity, normal/non-smoke binary, notices, architecture and fresh source pass. `lipo -archs '<app>/Contents/MacOS/folio'` -> expected architecture. `python3 scripts/package-source.py --revision <candidate-sha> --out <owned-output>` -> archive/manifests exist and contain neither HANDOFF/private Git refs nor machine paths/secrets. Do not equate package metadata with license text inspection.
- Fail-first: on disposable candidate copies, remove an OFL notice, substitute wrong version/architecture and insert a smoke marker; checker must reject each before accepting the real bundle. Source-package checker must reject a synthetic excluded path.
- Stop and ask if: binary notice obligations remain unresolved, required architecture SDK/target installation is unapproved, or hosted platform support differs from plan.
- Default if unanswered: keep locally prepared artifacts; no binary release.

### R3 -- Sign, qualify installation and prepare release publication
- Files: release config/workflow and verifier from R2; modify `README.md`, `docs/distribution.md`, `docs/publication-readiness.md`, `docs/validation.md`, `ROADMAP.md`; execution evidence in this stage's IMPLEMENTATION_LOG.md and independent REVIEW.md.
- Interfaces: consumes R1 green jobs, R2 complete candidate and D1 native qualification. Uses protected owner-managed Developer ID/notary credentials without exposing values. Emits immutable candidate commit, architecture/OS evidence, DMG hashes/notary ticket/source archive, release title/notes and exact asset list for owner approval.
- Steps: (1) Ask owner to configure signing/notary access using approved local signing or protected GitHub environment; do not request key/password contents in chat. (2) Sign/notarize/staple both DMGs/apps; fail closed on missing credentials. (3) Verify signatures and tickets, download the actual candidate to fresh Intel and Apple silicon test environments, and test quarantined install/open, save/reopen, export, upgrade from copied old-alpha data and uninstall retaining writing. Explicitly test minimum supported OS (default macOS15) before claiming it. (4) Get actual native sidebar light/dark/reorder/selection, VoiceOver, Hebrew/Chinese input-method and long-session results; alpha's source-only waiver does not replace these binary checks. (5) Independently review all evidence and present exact tag, files, notes and checksums. (6) Only after separate concrete release authorization create/publish the new prerelease and verify downloaded bytes against manifest; then replace “no downloadable app” with the tested release URL. Until then use candidate wording, not a broken public link. Reuse the process for 0.2.0-beta.1 after later stages/D2, without replacing alpha assets.
- Acceptance check: `codesign --verify --deep --strict --verbose=2 '<app>'`; `spctl --assess --type execute --verbose=2 '<app>'`; `xcrun stapler validate '<app-or-dmg>'`; verifier with `--require-notarized` -> all succeed; named human install matrix recorded. After authorized publication: `gh release view <tag> --repo ECMSiegel/Personal-Word --json isPrerelease,url,assets` -> correct prerelease/assets; download/hash comparison -> exact match. Required unknown/blocked human checks prevent ready status.
- Fail-first: disposable unsigned/ticket-less candidate must fail strict release verification; missing architecture/human report must fail readiness checklist. n/a for inventing a fake real-use pass -- leave it pending instead.
- Stop and ask if: Apple membership/credentials or either architecture tester is unavailable; owner wants an unsigned public download; release approval absent.
- Default if unanswered: finish reviewable local candidate; hold publication and do not weaken checks.

## Validation (after tasks, in order)
R1 focused/fail-restoration evidence -> full build/unit/browser/Rust sequential -> D1 native matrix -> normal release builds -> R2 negative controls/notices/source checks -> R3 signatures/install/owner checks -> independent review -> concrete publication approval -> download-byte verification. Existing historical counts are not a fixed expected total after new tests.

## Risks and rollback
Keep the current source alpha and any existing downloads unchanged. Failed signing/CI/install holds the new candidate. Reverting packaging/code is ordinary source rollback, not old-data overwrite. No force-push, existing-tag move, global install or deletion of older bundles. Owner can withdraw a bad new release after diagnosis; preserve its source/evidence.

## Open questions for the user
Signing/notary access and Intel/ARM testers needed at R3; default version/OS policy in parent. Installations and final publication require their own explicit approval. No questions block read-only preparation now.

## Notes for the implementer
Read parent plan and D1 before offering a binary. New source changes invalidate old release binaries. A passing hosted run beside a failing same-source run does not settle the indentation defect. [Tauri signing](https://v2.tauri.app/distribute/sign/macos/) and [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) describe credentials/tickets; they do not prove these actual artifacts pass.
