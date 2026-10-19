# REVIEW — Source-alpha security, reliability, and sidebar selection
Reviewer: Codex independent reviewer | Range: `f324a7a`..reviewed worktree | Date: 2026-10-19

## Verdict: APPROVE — proceed with T8 local delivery only

## Summary

I reviewed the approved request and plan, final implementation log and findings ledger, T1–T3 reports, complete intended diff, fail-first evidence, full T6 logs and artifacts, before/after light/dark screenshots, native smoke harness/results, normal release bundle, and fresh-copy results. The first T6 build exposed a TypeScript nullability error in the sidebar restoration handler; the typed row capture repaired it before the final source freeze. Frozen-source automated suites, isolated native WebKit/SQLite smoke, normal release build, fresh-copy rehearsal, and independent focused T7 reruns passed. The owner explicitly accepted the documented native-sidebar gap for this source-only alpha. I found no actionable source defect or unresolved release-blocking finding. This approval covers the planned local T8 delivery steps only; it does not authorize a remote, push, hosted release, or binary distribution.

## Findings

| # | Severity | Where (file:line) | Finding | Evidence | Required action |
|---|---|---|---|---|---|
| F-01 | Low, documentation limitation | `THIRD_PARTY.md:11` | The inventory calls the embedded PDF font inputs WOFF2, while the source imports `.woff` assets and performs subsetting during PDF embedding. | `src/export/fonts.ts:2-12` names `.woff` assets; `src/export/pdf.ts:121` calls `pdf.embedFont(bytes, { subset: true })`. The authorized publication-readiness update now records this path and identifies the inventory wording as inaccurate. | No action within this narrow plan remains. Leave `THIRD_PARTY.md` unchanged; do not claim its wording was corrected. This is not a license or binary-compliance determination. |

## Plan vs diff

- T4's safe-prefix repair and both regression cases are present in `src-tauri/src/lookup.rs`. The regression failed against the restored defect with a UTF-8 boundary panic at byte index 8, passed with the fix, and passed again in the final focused log.
- T5 uses scoped sidebar `user-select` rules and temporarily disables the dragged row only when preview prose is selected. This component boundary followed the recorded CSS-only failure, where selection remained collapsed while the row stayed draggable. Restoration covers pointerup/cancel, window blur, hidden document, and component unmount. The same test selects preview prose and then reorders that row. Final source and full diff are now available for review.
- The final source diff contains the planned URL guard, sidebar CSS/component/test changes, and authorized report/readiness updates. No unplanned code or dependency change was identified in the reviewed diff.
- The publication-document accuracy mismatch remains in the pre-existing `THIRD_PARTY.md`; the authorized readiness note now names it transparently. Correcting that inventory remains outside the reviewed file scope.
- The sidebar test selects preview prose then reorders the same row and verifies drag restoration; full T6 browser tests also pass. The native smoke does not cover native sidebar selection or reordering; the owner explicitly accepted this gap for this source-only alpha, without waiving other gates.
- T3's REL-01/02/03 items remain explicitly documented coverage gaps without a reproduced writing-loss defect. The native smoke's successful three phases do not close those combinations or physical power-loss behavior.
- The four pre-existing owner-edited documents remain checkpointed: validation and the two source-alpha records retain the original bytes as an exact prefix, and the publication-readiness rewrite retains the owner-reported 46-browser-pass attribution. Its later edits and the new evidence documents are within the approved review scope.

## Re-run validation (commands and results)

- Root's first T6 build stopped at `TS18047` in `ProjectSidebar.tsx:401` (`row` possibly null); the complete saved log contains that compiler error. After the typed-capture repair, the final frozen-source T6 results were: `npm run build` passed; `npm test` passed 163 tests in 17 files; `npm run test:e2e -- --workers=1` passed 49/49 tests; `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml` passed 19 tests with one pre-existing ignored benchmark. Full logs and `t6-results.json` record exit code 0 for all four gates.
- `t6-native-build.log`, `t6-native-smoke.log`, and `test-results/native-smoke.json` report a successful native diagnostic build and all three native smoke phases. Static harness review confirms a fresh temporary data root, a harness-launched Tauri/WebKit process, SQLite integrity and mirror checks, clean quit/reopen, a harness-owned termination after an acknowledged SQLite checkpoint, journal recovery after restart, fragment restoration, and snapshot restoration. The runner passed all three phases and verified `project.json` parity after clean shutdown.
- The normal release log and evidence record name `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25 MiB), version `0.1.0`, identifier `com.folio.writing`. I read the actual bundle `Info.plist` and executable, confirmed its SHA-256 matches the evidence record, and found no native-smoke diagnostic markers. I independently hashed all 115 entries in the tested-source manifest; every entry matches the current source tree.
- T4 focused fail-first, restored-defect, fixed, and final-pass logs were inspected. Sidebar fail-first evidence shows the brand label text selected under the regression; the final focused sidebar suite passed 3/3. I independently inspected before/after light/dark captures: the initial blue selection highlight on the chrome label is absent after the fix, with surrounding light/dark layout intact.
- Independent T7 Rust rerun: `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml lookup::tests:: -- --nocapture` passed 4/4; full output is in the ignored `t7-rust-lookup.log`.
- Independent T7 browser rerun: the first attempt failed before tests because the sandbox could not bind Playwright's configured loopback server (`EPERM` on `127.0.0.1:1420`). The identical local-Node-22 command passed all 13 sidebar, layout, and editor-toolbar scenarios in 1.1 minutes after the approved loopback retry. The initial block and successful retry are preserved separately in ignored `t7-focused-browser.log` and `t7-focused-browser-escalated.log`; no product failure is inferred from the pre-run block.
- The isolated Node 22.23.3 fresh-copy rehearsal passed locked `npm ci`, build, and all 163 unit tests. I independently verified all 115 tested-source manifest hashes against the current tree after final documentation reconciliation.
- `git diff --check` passed after the final reviewed changes.

## Evidence level and remaining delivery work

- Static source review, fail-first evidence, complete automated T6 logs, Chromium screenshot and interaction review, isolated native WebKit/SQLite save/reopen/recovery smoke, normal release metadata/freshness, fresh-copy rehearsal, and independent focused reruns. Browser results establish Chromium behavior only.
- T8 must still preserve a recoverable backup, replace only the two confirmed historical path strings in main, re-audit the intended history/tag, commit the reviewed tree, and verify the local annotated alpha tag. No remote or push is authorized. REL-01/02/03 and physical power-loss behavior remain explicit reliability limits; native sidebar real-use remains unverified under the owner's bounded acceptance.

## Not reviewed / limits

- Native sidebar selection/reordering remains unverified; the owner explicitly accepted this gap for the source-only alpha.
- The two confirmed historical local-path strings remain reachable until the planned T8 history sanitation and final redacted audit. The current-tree scan alone does not close that history gate.
- This review does not approve public publication, hosted CI, signing/notarization, distribution, complete bundled notices, Word/LibreOffice rendering, VoiceOver/IME, or exact editor/export pagination parity.
