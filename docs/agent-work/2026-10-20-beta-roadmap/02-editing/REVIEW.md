# REVIEW — Precise annotations, responsive aids and useful revision comparison

Reviewer: Codex | Range: base `2bb181b` to current working tree (base diff not inspected) | Date: 2026-10-20

## Verdict: E1 focused local checkpoint PASS on supplied logs; final E1 acceptance and release approval NOT GRANTED

## Summary

This checkpoint covers E1 only and is based on the root-provided logs plus a read-only source/hash review; I did not rerun commands. The earlier context finding is repaired: both `resolveCommentAnchor` and the pre-map path require exact saved context. The project-entry flow clears transient jump/amendment/reattachment state. The malformed empty-quote/attached-anchor edge is repaired: `validateProject` rejects that shape, and `editorReady` treats quote-less tasks as an open-entry action. The comments browser test leaves and reopens the project after reattachment, and that test passed in both the focused E1 browser log and the complete browser run.

The supplied build, full unit, focused comments/research browser, and scoped Rust metadata outputs all report success. All 139 paths and hashes in `integrated-code-manifest.json` match the current checkout. The full 54-test browser run completed with 52 passed and 2 failed; both failures are in the R1 indent reload tests. E1's focused local checkpoint is supported, but E1 completion remains open for the native-owner hold, artifact/screenshots, and overall acceptance. The full browser gate is not green, and this review grants no release or binary approval. E2 and E3 remain pending.

## Findings

No remaining E1 source finding was identified in this checkpoint. The earlier context, project-switch, empty-quote, reattachment-persistence-test, and implementation-log findings are resolved in the current source/logs or covered by the focused browser run. This does not close native, artifact, screenshot, or owner acceptance gates.

## Plan vs diff

- The current source contains the E1 model/helper/App/Writer/CommentsPanel paths described by the plan, and `tests/comments.spec.ts` includes leave/reopen after manual reattachment. The original baseline failures were the second-duplicate offset and block-reference placement assertions.
- The 139 current code/test/config paths in `node_modules/.cache/personal-word-beta/e1/integrated-code-manifest.json` were checked for safe in-checkout paths and SHA-256 equality; all 139 matched. This verifies the integrated snapshot against its manifest, not its complete base-to-working-tree scope.
- I did not inspect a base-to-working-tree diff or the complete changed/untracked file list. I therefore cannot certify that every changed hunk is in plan or that there are no out-of-scope changes.
- E2 and E3 are still pending and were not reviewed.

## Re-run validation (commands and results)

No build/test/browser/native command was run by this reviewer; parent explicitly reserved the lease for the integrator. I read the supplied output logs. Their contents support these scoped results, but they are not independent reruns:

- `npm run build`: `build-final.log` ends with `✓ built in 45.54s`; parent reports exit 0. It includes Vite chunk-size/dynamic-import warnings, not build errors.
- `npm test`: `unit-full.log` reports 18 files and 189 tests passed; parent reports exit 0. The refreshed implementation log states that this full unit run includes the final wrong-context-before-mapping case. The separate focused helper run reports 22 tests passed; mutant controls fail when context and unchanged-entry protections are removed.
- Isolated helper mutants: helper evidence reports context and fast-path mutants failed as intended. These are source-level negative controls, not browser/native evidence.
- `npm run test:e2e -- tests/comments.spec.ts tests/research.spec.ts --workers=1`: `browser-focused.log` reports all 9 tests passed, including duplicate selection after reload, manual reattachment after leave/reopen, quote structure, and undo/redo.
- Full browser suite: `npm run test:e2e -- --workers=1` completed with 52 passed and 2 failed (`browser-full.log`). The failures are the R1 `tests/ci-indent.spec.ts` cases “Blank start indent survives undo, redo, save, and reload” and “Chicago inherited indent uses left indent and survives undo, redo, and reload”; both report `Expected the project to be saved before the edit.` E1 comments/research tests passed in the same run. The full-browser gate is not green.
- Scoped Rust metadata: `native-metadata-rust-test.log` reports 1 test passed. This is limited SQLite serialization/history/mirror/reopen evidence, not the full native history/recovery/snapshot/import matrix or native WebView UI.
- Baseline targeted browser evidence reported the duplicate selection at offset 4 instead of 13 and zero blockquote-contained references where one was expected.

## Evidence level reached, and what the user must still verify by hand

The E1 focused local checkpoint reaches build/tested evidence on root-run logs; source hashes match the integrated manifest. The full browser run completed with two observed R1 failures, and no native UI result is included. Browser preview storage is not proof of Tauri/Rust/SQLite persistence.

Before E1 can be called complete, resolve the R1 full-browser failures and complete the native metadata/history/recovery/snapshot matrix and native WebView checks under the owner's hold; verify quote placement in rendered Word/PDF output; finish screenshots and owner checks. The R1 exact repeat-70 and hosted jobs also remain pending. The manual plan checks remain open: attach the second duplicate, insert before it, reopen and jump; insert a multi-paragraph cited quote and undo once; restore changed words and reopen the safety copy.

## Not reviewed / limits

- No tests, build, browser, Rust, or native commands were run by this reviewer; provided logs were read but not independently rerun.
- The base-to-working-tree diff, complete scope, exported artifacts, screenshots, and native application were not inspected.
- `IMPLEMENTATION_LOG.md` now records the supplied build, unit, focused browser, native-metadata, and full-browser status, but no final E1/D1/R1 completion claim is supported while the listed gates remain open.
- This is a draft review, not approval to mark E1, E2, E3, or the full beta roadmap complete.

## E2/E3 checkpoint -- October 22, 2026

> Historical checkpoint: the status below was accurate before the UTC baseline repair and final sequential qualification. The dated independent rerun update at the end of this file supersedes its then-current red-browser status; earlier diagnostic and failure evidence is retained as history.

### Verdict: implementation substantially present; full browser gate remains RED; no stage or release approval

This dated checkpoint preserves the E1 findings above and adds an E2/E3 review of the current working source and root-provided qualification outputs. I did not run tests, builds, or native commands; the root holds the qualification lease. I inspected the current `Writer.tsx` stable-options/revision-context diff and the E2/E3 index, goals, worker, comparison, restore, and related tests. I did not certify the complete base-to-working-tree diff or inspect every untracked path.

The current source has the planned incremental summary index, optional goal scope/day modes, worker-backed full prose issue index with paged controls, bounded decorations, revision comparison, and guarded rich-text restore. Static review found the worker dirty-ID pruning regression has been corrected and covered with a ProseMirror transaction test. Restore checks the project revision and exact entry-content fingerprint, validates the rich-text slice and references, flushes pending saves, verifies a reopened safety snapshot against the pre-restore project, rechecks current state, then applies the mutation. I found no additional definite restore data-loss defect in the reviewed path.

### Findings and current qualification

- **R1 pointer-path qualification now passes; the latest full production browser suite remains red on an E2 goal reload case.** The final R1 tests click the actual paragraph before typing, then preserve the single Home key and exact DOM/ProseMirror start assertions. Root reports `paragraph-focus-repeat.log` at **50 passed** across five focused cases repeated ten times, and the subsequent full `browser-paragraph-full.log` has no indent or comment failures (**62 passed, 1 failed of 63**). The sole failure is `tests/performance.spec.ts` goal persistence after reload: expected `1 of 10 today`, received `0 of 10 today`.
- Diagnostics distinguish two focus cases. The synthetic-focus trace proves ProseMirror's observer restored the stale position: Home keydown had DOM/PM offset31; keyup and selectionchange moved DOM to0 while PM stayed31; `DOMObserver.flush` then reset DOM to31 without any editor transaction. The trace had `lastFocusAgo=169ms`, no prior pointer click, and no PM transaction. But an actual click on the editor container did not solve the scenario (39 passed, 11 failed across its repeat batch; Chicago failed 10/10 and comment failed once), so that broader click setup was rejected. A paragraph-target click before typing passed five isolated Home trials, then the final 50-case focused repeat and full suite's R1 cases passed. This supports the pointer-focused R1 path only. Recent keyboard-only focus followed by Home remains an open ProseMirror/browser behavior and is not claimed fixed.
- The remaining goal failure has a concrete source explanation reported by root: on reload, `goalDay` initially uses the local date while the restored project is already in UTC mode. The baseline effect can compare and overwrite the saved UTC next-day baseline using that stale local day before the focus/timer refresh corrects `goalDay`; at 22:00 Eastern the local and UTC dates differ. A deterministic New York/UTC boundary fixture is being added, and a root-run pre-fix baseline is in progress. The planned synchronous day derivation fix is not yet reviewed or accepted.
- `npm run build` passed after the current Writer stable-options change. `npm test` reports 223 tests passed across 20 files. The scoped Rust suite reports 21 passed and 1 ignored. These are root-run outputs in `node_modules/.cache/personal-word-beta/e2/integration/`; they are not independent reruns by this reviewer.
- The two 100k-word paired performance cases passed in the full production run: 60 sections, 1,000 notes, 200 paired edits, and a 10,000-word active paragraph, with ordinary and repeated-word variants. Reported input-to-editor medians/p95s were 2.5/3 ms ordinary and 4.6/6 ms repeated-word with aids on. Host load was elevated, and these are Chromium input measurements; they do not establish native responsiveness or behavior for a 100,000-token single paragraph. The production benchmark separately waits for a worker result before measuring.
- Root reports generated three-page PDF and DOCX render outputs. The XML structural check passed for both quote paragraphs and the footnote nested in the final quote paragraph; its removed-citation control failed as expected, and the original export passed again. These checks do not substitute for the missing native WebView and broader artifact acceptance. Fresh post-repair light/dark screenshots also remain pending per the implementation log.
- Current source review found no further definite defect in the guarded restore sequence or stable editor-option refs. The prose scanner now uses a Set for issue de-duplication. One low-frequency performance risk remains unmeasured: quote exclusion checks call `quotedRanges.some(...)` for each candidate issue, so a paragraph with many short quote spans interleaved with unquoted issues can incur work proportional to candidates times quote ranges. The supplied repeated-word performance fixture has no quote spans.

### Evidence limits and remaining gates

The latest full browser suite's 62/1 result means the browser gate is not green; it currently exercises the R1 pointer-path cases successfully while exposing the UTC baseline reload defect. The diagnostic and focused runs are useful scoped evidence, not substitutes for a green complete run. Native WebView behavior, native project/profile creation, the full metadata/history/recovery/snapshot/import matrix, and owner-operated checks remain absent or held. The generated PDF/DOCX previews and structural XML check do not establish visual acceptance in Word or native export parity. Hosted CI, bundle/signing, publication, and release authorization are not covered here.

This checkpoint does not approve E2, E3, E1, or the overall beta roadmap as complete. Preserve the goal failure, keyboard-only recent-focus behavior, native hold, and screenshot/artifact limits in subsequent reports until each is resolved with current-source evidence.

## Independent qualification update -- October 22, 2026

### Verdict: scoped automated checkpoint PASS; native, hosted, and release gates remain open

I ran the targeted unit and browser suites after the final source freeze. The run is independently reproducible from the commands and logs below. This updates the earlier 62/63 report: the deterministic UTC reload failure is repaired and the complete current Chromium browser suite now passes. This is an automated checkpoint only; it does not approve E1/E2/E3 completion or release.

### Independent reruns

- `npm test -- src/model.test.ts src/derived/projectIndex.test.ts src/goals.test.ts src/editor/indent.test.ts src/editor/commentAnchors.test.ts src/editor/proseCheck.test.ts src/editor/writingAids.test.ts src/organization/operations.test.ts src/organization/revisionDiff.test.ts` passed **110 tests in 9 files**. Output: `node_modules/.cache/personal-word-beta/r1/resume-20261022/review-final-unit.log`.
- `npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/independent-review-r1.config.mjs tests/editor-toolbar.spec.ts tests/ci-indent.spec.ts tests/comments.spec.ts tests/research.spec.ts tests/writing-aids.spec.ts tests/performance.spec.ts tests/revisions.spec.ts --workers=1` passed **30/30 tests** in 54.7 seconds. Output and report: `node_modules/.cache/personal-word-beta/r1/resume-20261022/review-final-browser.log` and `node_modules/.cache/personal-word-beta/e2/integration/independent-review-r1-report.json`; traces/results use the separate `independent-review-r1-results` directory. This run covers both paragraph-click/Home/Tab paths and the keyboard-only toolbar Tab cases, comment anchor duplicate/edit/reopen/reattach flow, quote insertion/undo, goal profile persistence and timezone switching, both local and UTC midnight rollovers, paged prose issues, revision restore controls, and both paired 100k-word performance fixtures (60 sections, 1,000 notes, 10,000-word active section; ordinary and repeated-word variants).
- I independently checked the root's current stage manifest: all **112** listed paths exist and match their recorded SHA-256 hashes. This verifies those manifested paths only, not every base-to-working-tree change.

### Current integrated evidence

- The final current-source build passed (`build-goal-clock-final.log`); TypeScript and Vite completed. Existing bundle-size and dynamic-import warnings remain non-fatal.
- The final full unit run passed **223 tests in 20 files** (`unit-goal-clock-final.log`).
- The final sequential Chromium suite passed **65/65 tests** (`browser-stage-final-full.log` and `browser-stage-final-report.json`), including the UTC late-evening reload case, R1 indent/comment flows, and local/UTC midnight tests.
- The Rust suite passed **21 tests with 1 ignored** (`rust-stage-final.log`). The ignored case is the 100k-active-entry save benchmark, so native performance remains unmeasured.
- Goal-clock fail-first evidence is recorded in the parent logs: the fixed-time New York UTC reload test failed on the preserved old compiled output with the exact prior 0-vs-1 daily-progress mismatch; two new local/UTC midnight cases passed after the repair and both failed with the scheduled refresh disabled. The controlled mutant was restored before the final build/unit/browser runs.
- The R1 test setup targets the actual paragraph with a pointer click before typing, retains one Home key press, and asserts DOM and ProseMirror selection at offset zero before Tab. The focused R1 repeat passed 50/50 and both cases also passed in the 65-case run and my 30-case rerun. This qualifies that pointer-entry workflow only. The separate keyboard-only recent-focus/Home behavior still has a reproduced ProseMirror observer edge and remains open; the tests do not claim it fixed.
- The two current 100k-word browser benchmarks passed under the documented input-to-editor-update scope. Earlier root measurements record paired aids-off/on medians and p95 below the 25ms/50ms budgets, with elevated host load. These Chromium input measurements do not establish native WebKit latency, paint latency, worker completion time, or a universal large-paragraph guarantee.

### Remaining limits

The macOS native WebView/owner hold remains in force. Browser preview storage is not proof of native persistence; the Rust suite does not cover the complete metadata/history/recovery/snapshot/import matrix or native UI behavior. The generated three-page DOCX/PDF quote-placement XML checks are useful structural evidence, but fresh visual review in Word/PDF and native appearance screenshots remain outstanding. Hosted CI has not been observed, and no signed bundle, publication, or release approval is included. E1/E2/E3 completion and overall beta approval therefore remain open.

The final reviewed checkpoint is green for the scoped automated runs above, with the explicit keyboard-only Home behavior and native, visual artifact, hosted CI, and release gates still open. This review does not authorize a commit, push, tag, bundle distribution, or release claim.
