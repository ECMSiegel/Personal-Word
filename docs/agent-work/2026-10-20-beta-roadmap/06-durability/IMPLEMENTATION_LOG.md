# D1 implementation log

Date: 2026-10-20
Status: PARTIAL -- the serial offline Rust suite and focused JS tests passed, and the native-smoke cfg compiled; native runs, benchmark, normal-binary inspection, and owner checks remain open.

## Scope and constraints

Implemented only the approved D1 scope and exact file lease: `src-tauri/src/store.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/smoke.rs`, `scripts/native-smoke.py`, `scripts/native-reliability.py`, `tests/native-smoke.js`, `tests/native-reliability.js`, `src/save-queue.test.ts`, `docs/architecture.md`, `docs/validation.md`, `docs/recovery.md`, and this log. The production `src/App.tsx` close guard and `src/save-queue.ts` save behavior were not changed. No package was installed, no user project was opened, no credential was read, and no diagnostic/release app build, benchmark, commit, or push was run; one authorized offline Rust correctness test was run and is recorded below.

The approved serial command lease has been returned to the integrating agent after the focused JS test and native-smoke compile-only check. The owner explicitly directed us to hold native WebView tests, so neither native harness may be launched and no UUID WebKit profile may be created.

## Implemented source work

- Every macOS SQLite connection keeps WAL and `synchronous=FULL` and now requests `fullfsync=ON` plus `checkpoint_fullfsync=ON`. The passed Rust suite includes live pragma assertions and a false-value rejection assertion. The diagnostic command also queries live connection values; its native `fullfsync-off` control remains held with the WebView matrix.
- Added a native-smoke-only two-entry sparse metadata fixture and a store unit test for metadata through incremental save, history, mirror, and reopen. The 100,000-word/100-save benchmark asserts p95 at or below 150 ms; it remains unrun.
- The actual `WindowEvent::CloseRequested` observer remains behind `cfg(feature="native-smoke")`; no unconditional Rust close prevention was added. The positive close control now marks mirrors pending and injects its one-shot error at the mirror writer invoked by the normal close path. Retry is expected to pass the same writer. The negative control bypasses exit only after that same close writer reports an error; the runner requires both consumed fault markers and calls the same close acceptance checker.
- Added isolated journal fixtures for malformed, incomplete, and conflicting copies. The incomplete fixture includes a synthetic entry ID absent from both the saved project and entry journal, so it exercises missing-copy rejection instead of falling back to an already-saved entry. The runner requires the raw journal to remain until the explicit recovery choice, then compares the full current project and SQLite project with the pre-choice baseline.
- Added deterministic SQL rollback, disk-full, and permission-denied hooks after staged SQL writes and before commit. The runner inspects the project and database while the owned app is still alive, requires the user-visible error and retained failed-edit journal, then kills only that child process and compares the database again.
- Added a post-commit/pre-mirror restart scenario. It first verifies the expected stale mirror boundary and then requires full portable JSON equality after reopening. Static inspection shows the fresh `Store` begins with an empty dirty set, so this checker may record a baseline failure. No mirror-reconciliation production change has been made before that failure is reproduced.
- Isolated diagnostic WebKit storage is configured with a per-scenario 16-byte `dataStoreIdentifier`, stable across that scenario's restart pair. The diagnostic app must have identifier `com.folio.smoke`; it validates the active WebKit store before test actions and refuses to clear or reuse a mismatched `localStorage` profile. The older broad `localStorage.clear()` was removed. The macOS identifier API is supported on macOS 14 and later; the native runner refuses a non-macOS host. Tauri/WKWebView does not support setting `dataDirectory` or deleting an individual persistent store on macOS, so WebKit profile files would be system-managed outside the D1 cache. This conflicts with the plan's owned-temp-root boundary. The owner explicitly directed us to hold native WebView tests; no diagnostic WebView launch or UUID profile creation is authorized.
- Reports are bound to the current scenario, stable scenario run ID, unique process invocation ID, diagnostic app identity, protocol version, and active WebKit store. The supervisor removes only the prior report in its harness-owned scenario folder before a new invocation, writes a `running` latest result before work, records failures to that result on exceptions, and records binary/source hashes plus a source-mtime freshness check on success. The source manifest includes the Rust build inputs, package manifests, and persistence/UI source inputs that feed the diagnostic binary.
- Added writer-facing save/recovery/backup guidance in `docs/recovery.md`; architecture and validation notes distinguish SQLite acknowledgement, scheduled local journal writes, portable mirrors, and external backups. Validation records current D1 status as pending, with no source-only waiver for the owner binary checks.

## Verification evidence

| Check | Status | Evidence |
| --- | --- | --- |
| Static source inspection | Passed | Python AST, JavaScript syntax, and `git diff --check` passed; approved source scope and plan reviewed. The WebKit profile API is confirmed from local Tauri source, but its owner-directed native hold remains a separate gate. |
| `npm test -- src/save-queue.test.ts` | Passed | 26 passed. The first run exposed a test setup error: a single enqueue allowed the intended 250 ms idle debounce to fire before the 2 s max-wait boundary. The test now enqueues every 200 ms during the blocked persistence promise and verifies no attempt at 1,999 ms and one attempt at 2,000 ms. Failed and passing logs: `node_modules/.cache/personal-word-beta/d1/npm-save-queue-test.log` and `node_modules/.cache/personal-word-beta/d1/npm-save-queue-test-rerun.log`. |
| `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` | Passed | 21 passed, 0 failed, 1 ignored benchmark. Full output: `node_modules/.cache/personal-word-beta/d1/cargo-test.log`; first dependency compile took 15m18s. Nonfatal warnings: diagnostic-only helper/flag unused in normal cfg and two unnecessary `mut` bindings. |
| `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --features native-smoke --no-run --jobs 1` | Passed (compile only) | Finished in 5m10s and emitted both library and binary test executables. No native process was launched. Full output: `node_modules/.cache/personal-word-beta/d1/cargo-native-smoke-no-run.log`; one nonfatal unnecessary `mut` warning in a test. |
| Diagnostic native build | Not run | Awaiting command lease. |
| `python3 scripts/native-reliability.py --suite baseline` | Held | Owner explicitly said not to launch native WebView tests or create UUID WebKit profiles; separate from the command lease. |
| `python3 scripts/native-smoke.py` | Held | Owner explicitly said not to launch native WebView tests or create UUID WebKit profiles; separate from the command lease. |
| 100k-word/100-save benchmark | Not run | Awaiting serial release-mode benchmark lease. |
| Normal app rebuild and fault-hook exclusion | Not run | Must follow diagnostic checks. |
| Owner Intel sidebar, close/reopen, long session | Pending | Human binary check; no source-only substitute. |
| Apple silicon real use, signing/notarization | Pending | Environment/owner gates. |

Planned command sequence is recorded in [validation.md](../../../validation.md). The diagnostic build command is `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'`; run it only after the integrating agent releases the lease and the owner hold is resolved. Then run the focused JS unit test, any needed diagnostic compile, both native runners only if explicitly authorized, the ignored benchmark only under a suitable load/lease, and normal-build inspection in the order recorded there.

## Remaining D1 work

1. Focused JS tests and the native-smoke cfg compile-only check passed under the returned serial command lease. A diagnostic app build remains unrun and requires a fresh lease after the native hold is resolved.
2. Keep both native runners held unless the owner changes the explicit hold and resolves the owned-temp-root conflict caused by WebKit-managed profile files outside the D1 cache.
3. After native execution is authorized, build the diagnostic binary and confirm the actual app identifier and active per-scenario WebKit store before any test mutates its own synthetic project. Run the native matrix; preserve any post-commit/pre-mirror baseline failure before considering a minimal production change.
4. Confirm SQL, journal, close, metadata, snapshot, checkpoint, stale-report, and FULLFSYNC negative controls fail through the same acceptance checks used by positive runs.
5. Record the p95 benchmark, rebuild the normal app, inspect its identity/version and absence of diagnostic hooks, and obtain the owner binary results. D1 cannot be marked complete while these are missing.
