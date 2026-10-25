# WP3 -- integrated asset acceptance (team task T005)

Date: 2026-10-25 | Agents: agent-1a38 (TS/browser half, 00:09-00:13 UTC) then
agent-6029 (Native half pickup + harness fix, 00:31+ UTC)
Status: TypeScript/browser half CLAIMED and complete; native baseline half
CLAIMED and complete (executed green this session; re-executed green after a
harness-first fix on the same tree). WP8 print probing and
the full release `tauri build` app remain open elsewhere. Task resubmitted
for review (cycle 3).

## Scope
T005 accepts the existing WP3 work (DELEGATION.md WP3 steps 1-5): image insert staging before
insertion, image resolver for Writer/ReadDocument, asset-aware exports with a visible missing-image
error, portable project archive export/import through `createProjectWithAssets`, and cross-project
fragment asset copy. Then the native harness asset-crash scenario (stage, kill, restart, reopen).

## What was already there (inspected, not rebuilt)
Uncommitted work by the earlier WP3 worker (`.agents/teamwork/worker_wp3/handoff.md`; reviewers
`reviewer_wp3_2_gen2`, `challenger_wp3_2_gen2` approve at unit level; none executed the native scenario):
- `src/App.tsx`: resolver effect keyed on `project.id` (readAsset -> Blob URL, URLs revoked and caches
  cleared on project change), `resolveAsset` callback for Writer/ReadDocument, `onInsertImage`
  (`createPendingAsset` -> `storage.stageAssets` -> attrs; the Writer inserts the node only after this
  resolves), `importProject` via `readProjectArchive` + `storage.createProjectWithAssets` with a fresh id,
  "Export portable project" via `createProjectArchive`, fragment copy calls `copyFragmentAssets` before
  `importFragment`.
- `src/export/ExportPanel.tsx`: `collectAndResolveAssets` feeds DOCX/PDF/Markdown/plain-text/bundle
  exports; a missing asset throws the user-facing "An image is missing from this export" error and no
  file is produced.
- `src/organization/operations.ts`: `copyFragmentAssets` (read from source, stage into target, before
  the content mutation) and `importFragmentWithAssets`.
- Harness: `src-tauri/src/smoke.rs` `post-asset-stage` checkpoint, `tests/native-reliability.js`
  `asset-crash` / `asset-restart` / `asset-reopen` scenarios, `scripts/native-reliability.py` asset
  crash block in the baseline suite with SHA-256 checks on the SQLite `assets` row and the
  `attachments/<sha>.png` mirror.

Observations (not defects, not changed):
- `App.resolveAsset` creates a new Blob URL per call; `imageCache` is written but never read. The
  Writer caches per asset in its own effect, so the editor path is fine; `ReadImage` gets a new URL
  per mount. All URLs are tracked and revoked on project change, so this is bounded, not a leak.
- `onInsertImage` returns the intrinsic width; "capped to page width" is handled by CSS, not attrs.

## Changes made by T005
None to production code or tests. Only this report and the log folder.

## Commands and results (TypeScript half)
Pinned Node v22.23.3, serial-check slot held, logs in `node_modules/.cache/personal-word-beta/team-t005/`.

| Log | Command | Result |
|---|---|---|
| `accept.log` | `npx tsc --noEmit -p .` | exit 0 |
| `accept.log` | `npm test -- --no-file-parallelism --maxWorkers=1` | 44 files / 814 tests passed |
| `accept.log` | `npm run build` | exit 0, built in 11.89s |
| `accept.log` | `npx playwright test -c team-t005/browser.config.mjs tests/assets.spec.ts tests/research.spec.ts --workers=1` (production preview, isolated port 1452; clone of the recorded config shape) | 18 passed (29.6s) |
| `doctored-nostage.log` | `npx vitest run src/organization/operations.test.ts` with `copyFragmentAssets` doctored to read but never stage | 2 failed / 5 passed, exit 1 |
| `restored.log` | same, file restored | 7 passed, exit 0 |

Fail-first: `operations.ts` SHA-256 before and after the doctored run
`3c98990764557c336ead03e8ba32d44695ffdbfc27313864085deef26582ddbf` (`fail-first-hashes.log`). The two
failing tests were exactly the ones asserting that assets are staged into the target
("copies referenced fragment image assets ..." and "handles fragments with both image assets and
remapped footnotes").

## Native half: executed by the T005 pickup (agent-6029, 2026-10-25 00:31-00:44 UTC)

Blocked premises from this section's first pass are stale as of 00:35Z:

1. `cargo check` in `src-tauri` now exits 0 (`t005-smoke-build.log` build
   chain; direct check `Finished dev profile ... 1.12s`, exit 0). The
   earlier E0405 (`MainThreadOnly`, printing.rs:129) no longer reproduces;
   `objc2 0.6.5` is locked in Cargo.toml/Cargo.lock with the lock resolved.
   Q001's compile-blocker premise is disproven for the current tree; its
   governance question (stray WP8 work joining the board) stays with the
   user. printing.rs/zotero.rs remain unregistered stray work and were NOT
   modified by T005.
2. The harness files were static at execution time (mtimes ≥20 min old;
   `agent-48b0` left the board before the run). The WP11-scope additions
   are part of the executed tree state; the run pinned them by SHA-256 in
   the run's identity manifest.

Executed with pinned Node, under T005's registered serial-check slot
(`t005-*` logs in `team-t005/`):

| Log | Command | Result |
|---|---|---|
| `t005-smoke-build.log` | `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` | exit 0, built `src-tauri/target/debug/folio` in 57.09s |
| `t005-baseline.log` | `python3 scripts/native-reliability.py --suite baseline` | **exit 1 — "Scenario asset-crash missed checkpoint post-asset-stage"** (fail-first) |
| `t005-smoke-build2.log` | rebuild after the harness fix | exit 0 |
| `t005-baseline-rerun.log` | same suite | **exit 0** — run `20261025T003850Z-08aeb456`: 13 scenarios passed + 5 negative controls "detected", including **"asset crash recovery: stage, kill, restart, reopen"** |

First-pass failure and fix (fail-first chain):

- Pre-fix run `20261025T003354Z-4404110e` (exit 1): the asset-crash process
  died at `invalid args 'assets' for command 'stage_assets': command
  stage_assets missing required key assets` (`progress.log` tail retained
  in the run folder; suite log `t005-baseline.log`).
- Cause: the invoked JS harness passes `uploads:` while the tauri 2
  command `stage_assets` (`src-tauri/src/lib.rs:86-92`) names its vector
  parameter `assets`; item shape `{id, meta, data}` matches `AssetUpload`
  (`src-tauri/src/assets.rs:22-26`). Fix: rename the key at all three call
  sites of `tests/native-reliability.js` (lines ≈474/621/1085), a file
  registered to T005. Rust files were not touched.
- The binary embeds harness sources (`FIXED_INPUTS` includes
  `tests/native-reliability.js`), so the identity pass
  (`diagnostic_binary_identity`) forced a rebuild before the rerun: harness
  SHA went `1058f773…` (failed run) → `cf097247…` (passing run) per the
  runs' `result.json` identity manifests; binary `79677a5bd1…` →
  `5b6a8ce5…`. The rerun's embedded identity guarantees the executed
  binary contains the fixed harness.
- The green baseline run asserts, for the asset scenario specifically:
  SQLite `assets` row exists after the kill with `sha256(data) == id`,
  `byte_length == len(data)`, mime `image/png`; project revision unchanged
  by the kill with no uncommitted asset reference; `read_asset` after
  restart and on reopen returns the staged SHA-256; and the
  `attachments/<sha>.png` mirror exists with matching bytes. Negative
  controls (fullfsync false value, dropped metadata, missing safety
  snapshot, premature close, premature SQL acknowledgement) all read
  "detected", i.e. the same checkers refuse deliberately broken fixtures.
- Suite limit quoted by the harness itself: owned-process termination
  tests do not cover uncommitted keystrokes, power loss, or hardware
  failure.

## Cycle 2 rejection and cycle 3 fix (agent-6029, 01:00-01:10 UTC)

agent-1a38 rejected the first submission (msg #31): an isolated execution on
the **current tree** failed first — run `20261025T004902Z-3ae251f5`,
`python3 scripts/native-reliability.py --suite baseline` exit 1, "Scenario
asset-crash missed checkpoint post-asset-stage" (`team-t005-review/native-rerun.log`).
Its identity manifest pins the same Rust my passing run used (store
`a257a111`, smoke `e4cd7f77`) but a **different harness** (`14b7b496` vs my
`cf097247`) — the `.agents/teamwork` orchestrator (WP11 scope) had edited
`store.rs`, `smoke.rs`, and `tests/native-reliability.js` off-board at
20:43-20:44 EDT, after my green run. First-pass problem on the current tree
was #1 below (reported by the reviewer before I even started), and the
harness change broke the checkpoint contract as #2: the storage/supervisor
contract at the `post-asset-stage` boundary must be "report durable on
disk → then block/kill at the checkpoint", and the tree state at review
produced "block before report".

Cause, read from source on the current tree:

- `store.rs` `stage_assets` fires `crate::smoke::checkpoint("post-asset-stage", 0)`
  inside the command, right after `tx.commit()` (`store.rs:335-348`).
- The new `smoke.rs`: `checkpoint()` claims the request, writes the
  checkpoint JSON, then blocks in a 20 ms poll loop on
  `checkpoint-resume-<point>` (`smoke.rs:163-192`); `arm_checkpoint` only
  writes the request file, it does not fire (`smoke.rs:139-158`).
- The old harness order was stage → report → arm. With the checkpoint now
  firing inside `stage_assets`, the report was never written before the
  invoke blocked, so the supervisor (which requires `report-2.json` for the
  invocation before killing) reported a missed checkpoint forever.

Fix (harness-side only; no Rust file touched by T005), applied to the
`asset-crash` block of `tests/native-reliability.js`:

1. Report **first**, while nothing is blocked — `smoke_report` writes
   `report-2.json` synchronously inside the invoke. The report now carries
   `stagedMeta: fixtureMeta` directly (the stage result is no longer
   observable from the harness side); `stagedAssetId`, `projectId`,
   `baseline`, `acknowledgedRevision` are unchanged semantically.
2. Write the `folio.d1.stagedAssetId/Base64` localStorage entries (they
   must exist whether or not staging resolves).
3. `arm_checkpoint post-asset-stage`, **then** invoke `stage_assets` — the
   checkpoint fires post-commit and blocks; the supervisor reads the
   report + `checkpoint-post-asset-stage.json` and kills its own process.

Rerun on the same tree (`t005-smoke-build3.log` build exit 0, embedded-source
identity check forced the rebuild; `t005-baseline-rerun2.log` suite exit 0):

- Run `20261025T010541Z-7a41aef3`: 13 scenarios passed + 5 negative
  controls "detected", including **"asset crash recovery: stage, kill,
  restart, reopen"**.
- Identity manifest proof that only the harness changed between the
  reviewer's failing run and this passing run: store `a257a111` and smoke
  `e4cd7f77` identical in both; harness `14b7b496` → `7c142548`; binary
  `763449e2` → `dfb0dcd4` (`runs/<id>/result.json` identity manifests).

## Native half scope notes (unchanged from the first pass)

- WP8 native-print behavior inside the same binary was not exercised
  beyond what compilation of the crate requires; the WP8 feasibility probe
  is T013's scope (currently gated on T012 and ~its stray implementation
  unregistered).

## Evidence boundary
Browser results use the preview's fake IndexedDB / localStorage storage and Chromium. They do not
prove native SQLite durability, the attachments mirror, or WebKit rendering. The native baseline
suite (real macOS app processes, real SQLite) covers those durability claims for the asset-crash
scenario and its failure-modes/negative controls; it does not qualify a shipped app bundle or
WebKit rendering. Both halves are CLAIMED and await independent review.
