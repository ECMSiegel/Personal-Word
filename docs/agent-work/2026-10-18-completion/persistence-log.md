# T2 -- Save scheduler and native recovery qualification

Status: CLAIMED for source changes and frontend unit evidence; the isolated native three-phase run passed (see "Root integration follow-up" and `docs/validation.md`), while an interactive run on a normal desktop session is still the owner's confirmation. Base HEAD: `c62332c`.

## Changes

- Added fake-timer coverage for the 2,000 ms maximum wait under edits every 200 ms, the 250 ms trailing debounce, slow serialized persistence with a later queued edit, retry after failure, retention of the newest journal while an earlier write is in flight, and explicit flush.
- When an immediate recovery-journal write fails, `SaveQueue.enqueue` now starts persistence immediately. A disk failure remains visible in the status callback, retains the pending project, and can be retried.
- Reworked the native smoke harness into three isolated phases: clean quit and mirrored-data checks; normal reopen followed by an acknowledged SQLite save and one unsaved journaled edit before deliberate harness termination; then journal recovery, snapshot restoration, and clean quit. The harness kills the phase-2 process immediately after the report appears, before checking SQLite, to keep inspection time from turning the debounce into a save. The subprocess is launched in its own process group and the harness cleans up that group on failure. Its database path and WebView origin must both be isolated by the smoke build configuration.
- The opt-in Rust smoke command now lets phase 2 remain open for deliberate termination; other phases call the actual mirror and quit guards. Existing `src-tauri/src/lib.rs` instance-lock tests were reviewed; this task did not alter that file.

## Fail-first evidence

Evidence logs and exact pre-mutation source copies are under ignored `node_modules/.cache/personal-word-completion/`, because Playwright removed `test-results/completion-baseline/` during the task.

- Maximum-wait mutation: changed `MAX_WAIT_MS` from `2_000` to `60_000`, then ran `npm test -- src/save-queue.test.ts -t 'maximum wait despite continuous edits'`. It failed at the expected assertion: `expected "vi.fn()" to be called 1 times, but got 0 times`. Restored `src/save-queue.ts` with the saved exact copy and verified `cmp` passed.
- Journal-write mutation: disabled the immediate `flush()` call, then ran `npm test -- src/save-queue.test.ts -t 'journal cannot be written'`. It failed at the expected assertion: `expected [] to have a length of 1 but got +0`. Restored `src/save-queue.ts` with the saved exact copy and verified `cmp` passed.

## Acceptance evidence

- `npm test -- src/save-queue.test.ts` -- **CLAIMED**, exit 0: `Test Files 1 passed (1)`; `Tests 25 passed (25)`.
- `node --check tests/native-smoke.js` -- **CLAIMED**, exit 0 (no output).
- Python syntax parse for `scripts/native-smoke.py` -- **CLAIMED**, exit 0 (no output).
- `git diff --check -- src/save-queue.ts src/save-queue.test.ts scripts/native-smoke.py tests/native-smoke.js src-tauri/src/smoke.rs` -- **CLAIMED**, exit 0 (no output).
- Native harness and Rust test suite -- **NOT RUN by this task**. Root owns the fresh isolated build and native launch. Do not report native recovery, WebKit behavior, normal app quit, or instance lock as tested until that run completes. The smoke build must use a distinct application identifier such as `com.folio.smoke` so WebView localStorage cannot reach the user's normal app storage.

## Limits and manual confirmation

Automated scheduler tests reach rung 5 for the tested queue behavior. The native harness code is built/reachable only after root's smoke build and remains untested in a real native run. Owner confirmation is still required before native behavior can be called VERIFIED. The harness's forced termination is synthetic and does not model power loss or all OS crash modes.

## Root integration follow-up (2026-10-18, after the first native attempts)

The first native attempts exposed harness defects rather than product defects. Root corrected them:

- `src-tauri/src/smoke.rs`: phases 1 and 3 previously called `finish_quit` directly, which syncs mirrors from the Rust store but never runs the frontend save flush, so the last edit was absent from SQLite and phase 1's database assertion could not hold. They now use `app.exit(0)` and let the real `ExitRequested` guard ask the frontend to flush first. Phase 2 still stays open for deliberate termination.
- `tests/native-smoke.js`: the page-view helper re-clicked More formatting on every 40 ms poll (toggling the popover repeatedly) instead of opening it once, and nothing verified that page mode was actually active; the paragraph `getClientRects()` wait alone is satisfied by a wrapped paragraph. It now opens the popover once, waits for `.editor-viewport.is-paged`, and reports measured geometry on failure.
- Phase 2 typed the acknowledged checkpoint and immediately continued while the save status could still read "Saved" from the previous save, so the harness killed the process before the 250 ms debounce committed the checkpoint. It now waits for the trailing debounce (600 ms, below the 2 s maximum wait) before the journaled edit that deliberately stays unsaved.
- Added read-only diagnostics: a `smoke_progress` command appends step, wait, and geometry breadcrumbs to `progress.log` in the harness-owned data directory, and the Python runner prints the last breadcrumbs instead of a bare timeout.

Native results from these attempts are recorded in `docs/validation.md` under 2026-10-18. Breadcrumb and report copies are in the ignored `node_modules/.cache/personal-word-completion/native-run/`. A parallel agent session was active in this folder during the runs, which is a plausible contributor to the intermittent WebView stall and to one browser run losing its dev server; both are recorded as environment limits rather than product results.
