# T002 -- WP1 acceptance and reproduced integrity gaps

Date: 2026-10-24. Agent: agent-74f2. Status: CLAIMED -- ready for independent review, not owner-VERIFIED.

## Existing work preserved

The owner explicitly approved T001; the approval was recorded with `--agent user` and identified as owner approval, not independent agent review. T002 was then claimed and started normally. Existing uncommitted WP1-WP7 code and reports were preserved. T003 is owned separately by OpenCode.

Read the current storage adapters, model validation/text extraction, asset store implementation, storage/model/adversarial tests, prior WP1 handoff, delegation brief and applicable I1 plan. Existing native staging/base64 payloads, raw-byte read verification, create-with-assets change/header payloads, IndexedDB per-project scoping, image-alt text and table-cell word boundaries are present. The initial focused suite passed 153 tests; the earlier report's green status did not expose the gaps below.

## Changes specific to this task

- `src/storage.ts`: browser ordinary saves now verify every referenced image against that project's asset store before publishing project/history writes. The same helper retains the existing create-with-assets reference check. Missing/cross-project images reject the save, leaving the acknowledged project and history intact; after staging bytes into the correct project, the same edit can be saved. Native IPC payloads and historical storage identifiers are unchanged.
- `src/storage.test.ts`: two regressions cover rejected initial saves and rejected edits referencing another project's asset, preserved acknowledged state/history, then successful retry after staging into the target project.
- `src/adversarial-wp1.test.ts`: replace the assertion that merely checked whether a boolean was a boolean with an actual rejection assertion for an indirectly nested table.
- `src/model.ts`: after shared-schema validation, reject a table anywhere below another table, including through blockquotes/lists. The existing schema restriction alone only excludes direct table children of cells.
- `src/model.test.ts`: preserve the valid image/table fixture and additionally accept a top-level quoted table, so the nesting restriction does not forbid ordinary blockquote containment.
- `src-tauri/src/store.rs`: registered this additional path before editing. Native validation had the same indirect-nesting bypass; carry table-ancestor context through recursive validation. Extend the existing table test with the indirect case plus a valid top-level quoted-table control. Existing depth limits and other validation remain.

No writing, recovery data, history, app bundles, dependency manifests, global settings or another task's source paths were deleted or reset. No new packages were installed and no commits/pushes were made.

## Fail-first evidence

Logs are under `node_modules/.cache/personal-word-beta/team-t002/`. All npm/npx commands use the pinned Node v22.23.3 path. The task holds the registered serial-check slot while checks run.

1. `npx vitest run src/model.test.ts src/storage.test.ts src/assets src/adversarial-wp1.test.ts` -- baseline: 153 passed across four files (`baseline.log`).
2. Add the two storage regressions and replace the ineffective nested-table assertion. `npx vitest run src/storage.test.ts src/adversarial-wp1.test.ts` -- **3 failed, 87 passed**, with saves resolving instead of rejecting and the nested table failing to throw (`regressions-before.log`).
3. Apply browser/model fixes. The four-file focused suite passes **155/155** (`fixed-focused.log`).
4. Temporarily remove only the new save/nesting checks, rerun the same storage/adversarial command, and observe the same **3 failed, 87 passed** (`restored-defects.log`). A Python `finally` restores both fixed files byte-for-byte against retained backups and reports SHA-256 values. The later model comment and storage EOF whitespace correction are nonsemantic; final identities are recorded separately when checks finish.
5. Repeat the focused suite: **155/155** (`final-focused.log`; before the additional top-level quoted-table positive assertion).
6. Add the Rust indirect-nesting assertion and positive quoted-table control before its repair. `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 tables_must_be_rectangular_unmerged_and_unnested -- --test-threads=1` -- **0 passed, 1 failed**, panic: `Nested table hidden in a blockquote must be rejected` (`rust-before.log`). This is an assertion failure after successful compilation, not a setup failure.
7. Preserve the exact pre-fix native test binary as `native-before-test`; SHA-256 `5068fd3650bd02b32abf2102b60f655aa06deccbb97878a93729b2926bffe826`. After repair, the full native suite passes **35 tests, 1 benchmark ignored** (`rust-fixed.log`). Re-executing the preserved original test binary with `--exact store::tests::tables_must_be_rectangular_unmerged_and_unnested --test-threads=1` fails the same assertion again, exit 101 (`rust-original-recheck.log`). Finally, the repaired current binary passes the same filtered test, exit 0 (`rust-final-focused.log`). This native negative control uses the retained pre-fix executable; it does not mutate repaired source.

## Broader qualification

- `npx tsc --noEmit -p .` -- exit 0 (`typecheck.log`).
- Default `npm test` -- **812 passed, 1 failed** across 44 files (`unit.log`). The failure is `src/export/document.test.ts`'s PDF explicit-break/bibliography test exceeding its unchanged 5,000 ms timeout (5,673 ms observed). Host load was over 370. This remains a failed run; no assertion or timeout was weakened. A serial-worker run is planned to reduce test contention, not to erase this evidence.
- Current-source `npx vitest run src/model.test.ts src/storage.test.ts src/assets src/adversarial-wp1.test.ts` -- **155 passed across 4 files**, exit 0 (`current-focused.log`). Includes the additional top-level quoted-table positive assertion.
- `npm test -- --no-file-parallelism --maxWorkers=1` -- **814 passed across 44 files**, exit 0, 133.42 seconds (`unit-serial.log`). Same assertions and timeouts; only file/worker concurrency changed. T004's agent added one inline-position note round-trip test during this pass, explaining 814 rather than 813. The earlier default-concurrency timeout remains retained as a failed run.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` -- **35 passed, 0 failed, 1 existing benchmark ignored**, exit 0 (`rust-fixed.log`). Includes the indirect nesting regression and existing sparse/full metadata, mirrors, history, migration, asset, snapshot and save/recovery cases. Main and doc-test targets also exit 0.
- `npm run build` -- exit 0, **1,981 modules transformed**, Vite build 31.78 seconds (`build.log`). Its `tsc -b` checks the final TypeScript source. Existing mixed static/dynamic plugin-dialog import and large-chunk warnings remain; no bundler settings were changed to suppress them.
- Scoped `git diff --check` -- exit 0. The final six changed source/test file hashes are recorded in `source-hashes.json` in the task cache. These are task-scope identities, not a whole-release attestation.

The fixed native run initially waited for Cargo's artifact lock. Read-only process inspection identified two external Terminal jobs; the remaining one was a `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml` started by an Antigravity language-server process. They finished naturally; no process was terminated. T003/T004 were notified to keep expensive checks serialized under the registered slot. The 7m08s Cargo elapsed time includes lock wait and is not a compile/performance benchmark.

## Evidence boundary and next action

Mocked native IPC/storage unit checks are not native WebKit/SQLite runtime proof. Browser asset tests use a fake IndexedDB and synthetic memory storage. Rust store tests use isolated fixtures; no GUI/native app has been launched by this task. T003/T005 and gates A/D retain actual browser/native crash, visual/export and final qualification work.

Next: another agent reviews the scoped repairs and evidence, reruns the focused commands under the serial-check slot, and approves/rejects T002. Do not approve it from this authoring chat. T003/T004 may acquire the released slot for their pending browser/round-trip checks. Final native app, browser/runtime, rendered-artifact and owner real-use qualification remain with their registered downstream tasks.
