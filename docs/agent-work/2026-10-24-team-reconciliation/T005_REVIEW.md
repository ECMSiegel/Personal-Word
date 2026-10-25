# T005 independent review

Reviewer: agent-c436 (Codex), 2026-10-25. This chat authored neither WP3
integration nor T005's native harness repairs. Review task T026 reserves the
shared serial-check slot. No implementation files are edited by this review.

Verdict: APPROVE T005 for its scoped acceptance; implementation status CLAIMED.

## Scope and source inspection

Read T005's description, all handoff/rejection/submission notes, wp3.md, delegation
WP3/Common rules, current App/ExportPanel/fragment operations and their diffs,
asset-crash/restart/reopen scenarios, native checkpoint implementation, and the
Python supervisor's identity, isolation, SQLite and mirror assertions.

Reachability checked: Writer receives onInsertImage, which awaits stageAssets
before returning image attributes; reading/editor resolvers read project assets;
portable archive import calls createProjectWithAssets with a new identity; fragment
copy stages before the content mutation; every export resolves asset IDs before
writing and catches a missing-image error for visible presentation. Existing
rich-import/Markdown-bundle integration belongs to downstream tasks, not this
review's acceptance claim.

The repaired crash flow reports its fixture/baseline before arming the checkpoint,
then invokes stage_assets; Rust commits before firing the blocking checkpoint.
The supervisor waits for that checkpoint, validates the fresh invocation report,
terminates only its child, checks SQLite hash/length/mime and unchanged project
revision, restarts, saves an image reference, reopens, and checks the attachment
mirror SHA. Report metadata alone is not the proof: the direct SQLite and mirror
checks inspect persisted bytes. The native script currently checks image-file
presence conditionally and does not itself assert the final image-reference count;
the reviewer will additionally inspect the final reopened report for that content.

## Fail-first evidence inspected

- team-t005/doctored-nostage.log: 2 failures/5 passes when fragment staging was
  removed; restored.log: 7 passes; fail-first-hashes.log confirms exact restoration.
- team-t005-review/native-rerun.log: successful current-tree smoke build followed
  by a failed baseline at the missing post-asset-stage checkpoint. This pins the
  defect the harness ordering repair addresses; no test expectation was weakened.
- Prior passing native evidence is not substituted for this review's fresh run.

## Fresh execution

All logs/configs/hash records are in
node_modules/.cache/personal-word-beta/team-t005-independent-review/.
Pinned Node v22.23.3, serial checks, synthetic com.folio.smoke storage only.
The native smoke build invokes npm run build (including tsc -b) and completed
successfully: 1981 frontend modules, Vite 10.06s; Rust debug build 52.82s.
Existing chunk/plugin-dialog warnings only. This is a diagnostic executable,
not a normal release app offered to the owner.

- `python3 scripts/native-reliability.py --suite baseline` exited 0: fresh run
  `20261025T011905Z-645bdbf2`, 13 scenarios passed and all 5 negative controls
  detected. `native-baseline.log` retains the complete result; `native-result.json`
  preserves it separately from the shared latest pointer.
- All 139 source-input SHA-256 values in this run's identity match the current
  tree. The eight separately recorded reviewed-source hashes also remain equal.
- Inspected the run's final asset-crash/report-2.json: scenario asset-reopen,
  revision 3, one image node, staged asset ID referenced by the reopened project.
  This closes the conditional-path observation for this executed run, without
  claiming the harness assertion itself has stronger coverage than its code.

- `npm test -- --no-file-parallelism --maxWorkers=1` exited 0: 44 files / 814
  tests passed, 24.19s (`units.log`). No tests or expectations were changed.

## Boundaries

Review accepts the WP3 integration and native baseline asset-crash behavior only.
The unregistered WP8/WP11 work is preserved; its existence in the tested tree is
not an approval of those work packages or a resolution of Q001/Q002 governance.
It must receive its own task ownership and prescribed reviews. Current run hashes
are the exact evidence boundary if another agent changes these sources later.
No print probe, beta suite, power loss, hardware failure, owner real library,
normal release bundle or owner real-use confirmation is covered. Implementation
readiness remains CLAIMED under the project plan (rung 5 for tested behavior).

- Production-preview `npx playwright test -c node_modules/.cache/personal-word-beta/team-t005-independent-review/browser.config.mjs tests/assets.spec.ts tests/research.spec.ts --workers=1` exited 0: **18 passed, 27.3s** (`browser.log`), isolated port1453, retries0, one worker.
- Final eight reviewed source hashes equal the pre-review hashes. No implementation paths were edited; no check processes remain running.
