# Gate A re-review with executed runtime evidence (team task T007)

Date: 2026-10-25 (02:30-02:45 UTC). Reviewer: agent-6029 (OpenCode; author of none of
the wave-0/WP1-WP4/keyboard work). Status: CLAIMED.
Task rule: no code edits; findings returned as review text; never silently rewrite
historical verdicts.

## What changed since the earlier Gate A approval

The 2026-10-24 Gate A approval (`03-imports/REVIEW.md` upper section) correctly
approved unit-level work but its browser evidence was discovery-only
(`playwright --list` counted tests, did not execute them), and native runtime
evidence was absent (see T001 inventory, REPORT.md #15). T007 requires actual
executed browser and isolated native results on the current tree.

Between then and now, the team board executed and independently approved:

| Area | Executed evidence (not `--list`) | Review approval |
|---|---|---|
| WP1 storage/model | T002: `cargo test` reproduced-store control + units; approved | independent (T002 review by 1a38) |
| WP2 editor/reading | T003: `tests/assets.spec.ts` 16/16 with `--repeat-each=2` on fresh production build; saved-image reopen regression; light/dark screenshots inspected | independent (aa30 repair + 1a38 approve; T025) |
| WP4 markdown notes | T004: 197 focused units + doctored negative controls (two refs-at-end variants, exit 1) | independent (T024 approved by 6029) |
| WP3 integrated assets | T005 TS/browser: 18 passed browser cases (isolated port 1453, retries 0) | independent (T026, c436) |
| WP3 native asset-crash | T005 native: `scripts/native-reliability.py --suite baseline` exit 0 — run 20261025T011905Z: 13 scenarios passed + 5 negative controls "detected", incl. "asset crash recovery: stage, kill, restart, reopen" | independent (T026 approved by 1a38) |
| Keyboard-only Home/indent | T006: `tests/ci-indent.spec.ts` 5 passed; keyboard cases ×10 = 20 passed; doctored Home→End control fails both cases at the DOM/PM offset-0 poll (2 failed, control.log) | independent (approved by 6029 with own spot run 4/4) |

## Fresh checks performed by this gate review (2026-10-25 ~02:40Z)

1. **Current source identity vs executed native run.** Recomputed SHA-256 for
   all 139 source inputs of run `20261025T011905Z-645bdbf2`'s identity
   manifest against the working tree: **no missing files, no mismatched
   hashes** (`python3` check in session log). The approved executed native
   baseline is therefore pinned to exactly the current tree, not a historical
   one. Binary `a67541dd82f01292…`, `ok: true`.
2. **Fail-first spot check.** Retained doctored-control logs re-read: 
   `team-t005/doctored-nostage.log` (vitest exit 1 on a stage descriptor
   gone), `team-t004/doctored-refs-at-end.log` (vitest exit 1),
   `team-t006/control.log` (2 failed at the offset-0 poll, received 27/31).
   None is a passing log dressed as a control; the acceptance assertions
   demonstrably fail when the behaviour is removed.
3. **Wave-0 commit comparison.** `git diff --stat 7b58acb..82d7ec9`: the I1
   machinery (assets.rs 188+, store.rs 281+, assets/media/tables/bibtex/
   markdownNotes/projectArchive modules + tests, exporter changes; 3,619
   insertions across 27 files) is present and unchanged in the current tree
   (its hashes are inside the 139/139 identity match above). Current dirty
   state (`git status --porcelain`) is **34 tracked-modified, 39 untracked,
   0 deleted** — pre-existing uncommitted work preserved per board rules
   (uncommitted by design; reviewer commits after approval).
4. **Preservation / history review.** No historical verdict section in
   `03-imports/REVIEW.md` (or `04-research/REVIEW.md`) has been rewritten;
   the dated Gate A and Gate B texts survive verbatim. This review appends a
   new dated section to `03-imports/REVIEW.md` instead. No project,
   recovery, snapshot, or fixture data was touched or deleted anywhere in
   the board's log for T002-T006.
5. **Required-checks-not-blocked check.** `cargo check` in `src-tauri`
   exits 0 (verified this session, 1.12s cached run earlier at T005 pickup;
   the smoke binary built twice afterward). The former E0405 blocker (stale
   mid-edit state; Q001) no longer reproduces. No required check for Gate A
   is blocked.

## Gaps this gate does NOT close (boundaries, not blockers to Gate A)

- Gate A scope is wave 0 + WP1-WP4 + keyboard acceptance, which the above
  covers. It does not qualify WP5-WP7/Gate B work (that is T008-T012).
- No hosted-CI evidence (excluded without owner authorization; nothing
  dispatched or pushed) and no macOS WebKit keyboard/editor rendering
  qualification (tests ran in Chromium; the native suite is Chromium-driven
  app content over real SQLite).
- All implementation behaviour remains CLAIMED until the owner confirms in
  real use; this review does not upgrade anything to VERIFIED.
- Q001 governance (stray WP8 files `printing.rs`/`zotero.rs`/Cargo edits)
  remains open for the owner; they are unclaimed, unmodified by the board,
  and functionally excluded from Gate A scope (crate compiles with them
  present).

## Verdict

**Gate A: PASS (conditional as above)** — the earlier approval's
discovery-only browser evidence and missing native evidence are superseded
by executed, identity-pinned runtime results on the current tree. The
gate's required checks are unblocked and satisfied; wave-0/WP1-WP4/keyboard
work may be treated as accepted at CLAIMED status, pending timestamps,
owner separation and real-use confirmation.

Dated addendum appended to `docs/agent-work/2026-10-20-beta-roadmap/03-imports/REVIEW.md`.
No source/file outside the two registered review paths was edited by T007.
