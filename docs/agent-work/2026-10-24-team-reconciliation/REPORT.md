# Beta task-board reconciliation

Date: 2026-10-24. Task: T001. Author: agent-45fb (Codex team setup).
Status: CLAIMED; independent review required. This is a read-only implementation inventory and task-board setup, not fresh application qualification.

## Scope and current state

The owner approved the goal, scope, exclusions, architecture, verification sequence and completion checklist in `team/PLAN.md`, then explicitly requested every open task on the board. `docs/agent-work/2026-10-24-delegation/DELEGATION.md` governs work-package ownership/order; referenced child plans govern behaviour within its stated precedence.

Current HEAD is `ee2fe3a` (delegation baseline documentation), following wave-0 checkpoint `82d7ec9` and D1 checkpoint `7b58acb`. `git status --short`, `git log -4 --oneline`, `git diff --stat`, `git diff --numstat` and selected real diffs were inspected. There are 24 pre-existing tracked modified files (1,976 insertions, 138 deletions), many untracked application tests/modules, and existing `.agents/teamwork/` reports. The handoff's clean-state claim is stale. No pre-existing code, report, generated app, recovery data or history was changed by this task.

## Evidence reconciliation

- `HANDOFF.md` records R1, E1-E3, C1/C2 and D1 as prior reviewed checkpoints and wave 0 as implemented. These are historical claims; do not rebuild them or silently promote them to owner-confirmed behaviour.
- `.agents/teamwork/orchestrator_2/GATE_STATUS.md` reports WP1-WP4/Gate A passed. Its `handoff.md` acceptance matrix treats eight tests discovered with `--list` as a browser pass, and cites restricted native/runtime access. This cannot establish executed browser or native acceptance.
- `.agents/teamwork/orchestrator_3/GATE_STATUS.md` reports WP5-WP7 and Gate B passed. `.agents/teamwork/worker_m4_integration/handoff.md` and `.agents/teamwork/victory_auditor_gate_b/handoff.md` report 811 units, 35 Rust tests, typecheck/build and 12 discovered browser tests. Their browser evidence is again `--list`; no current browser runtime pass is established by those commands. The audit also refers to previous external execution without identifying current matching runtime evidence.
- `docs/agent-work/2026-10-20-beta-roadmap/03-imports/REVIEW.md` approves gates A and B but its listed browser commands only discover tests. The appended C3/Gate B section in `04-research/REVIEW.md` has the same boundary. Preserve these as dated history and append precise current evidence rather than rewriting old verdicts.
- Real source/diff inspection confirms asset adapter methods in `src/storage.ts`, note parsing in `src/import/manuscript.ts`, asset-aware exports and Markdown ZIP action in `src/export/ExportPanel.tsx`, rich import/atomic project creation calls in `src/App.tsx`, and Zotero command registration in both handlers of `src-tauri/src/lib.rs`. This establishes presence and identifiable callers, not successful current runtime behaviour.
- `scripts/native-reliability.py:583` onward and `tests/native-reliability.js:448` onward contain asset-stage/kill/restart/reopen scenarios and hash/mirror assertions. Execute them rather than reimplementing them or assuming their presence proves native durability.
- `src/print/` is absent, and the native print/probe/beta-evidence files are not present in the inspected file inventory. WP8-WP11 therefore retain implementation work rather than only acceptance work.
- The editing implementation log's later checkpoint records 65 Chromium passes and a diagnosis distinguishing pointer-text entry from keyboard-only recent-focus behaviour. The keyboard-only Home/selection edge remains explicitly open in the handoff. Earlier failed save-readiness runs are historical; T006 must reproduce current behaviour before changing code.
- Owner decisions in the root roadmap supersede the older native hold and download/signing requirements. Native testing is allowed only in isolated smoke storage; R2/R3/distribution remain excluded. This chat additionally excludes new packages. Any conflict requiring a new dependency or permission must be surfaced, not silently resolved.

## Complete task mapping

All created tasks require independent review. Existing implementation is to be inspected, accepted or minimally repaired; none of T002-T012 authorizes speculative replacement. Task descriptions contain acceptance checks, owned paths and reports.

| Area | Tasks | Remaining outcome |
| --- | --- | --- |
| Current-state reconciliation | T001 | Review this inventory and seeded board before dependent work |
| WP1 | T002 | Storage/model acceptance and reproduced gaps |
| WP2 | T003 | Actual editor/reader browser, keyboard, reload and visual acceptance |
| WP4 | T004 | Markdown note round-trip acceptance |
| WP3 | T005 | Integrated assets/archive/fragments/exports plus executed native asset crash matrix |
| Earlier R1/E keyboard edge | T006 | Keyboard-only Home/indent and comment selection qualification; hosted evidence remains external/pending |
| Gate A, including wave 0 | T007 | Independent review with actual runtime evidence |
| WP5 | T008 | Rich import content/security/cancellation and executed browser acceptance |
| WP6 | T009 | BibTeX, reviewed merge, synthetic Zotero protocol and executed browser acceptance |
| WP7 | T010 | Markdown ZIP/content/hash/security browser round trip |
| Wave 3 shared integration | T011 | App/ProjectLibrary/native registration/config gaps reported by WP5-WP7 |
| Gate B | T012 | Independent actual-execution review of rich import/research/bundle work |
| WP8/L1 | T013 | Implement actual isolated native-print feasibility probe |
| Feasibility decision | T014 | Independently review explicit PASS or prescribed STOP |
| WP9/L2 | T015 | Conditional exact PDF preview/font policy/legacy opt-in |
| WP10/L3 | T016 | Conditional native measured footnote continuation |
| Gate C | T017 | Review L1-L3 or precise plan-prescribed unavailable outcome |
| WP11/D2 matrix | T018 | Full new-field/media persistence/recovery/fault coverage |
| WP11 artifacts/native UI | T019 | Actual rendered exports/screenshots and explicit manual coverage gaps |
| WP11 documentation | T020 | Evidence-based limitations, architecture/recovery/readiness docs |
| WP11 final checks/build/evidence | T021 | Strict evidence verifier, full sequential qualification, current normal app |
| Gate D | T022 | Independent final evidence/artifact/source review and repair routing |
| Owner testing preparation | T023 | Concrete pending manual checklist and final handoff |

R2/R3, signing/notarization, distribution, pushing/publishing, new packages and unrelated redesign are deliberately excluded, not forgotten tasks. Existing R2 material is preserved. Owner real-use outcomes are still pending; T023 prepares their exact steps after the app is built rather than fabricating pass results or prematurely requesting testing.

## Dependencies and coordination

T002/T003/T004 depend on independent approval of T001 and may then run in parallel on disjoint paths. T005 joins them; T006 and gate A follow. WP5/WP6 then run in parallel; WP7, shared integration and gate B follow. Layout, durability and final evidence are ordered behind these gates. Shared production paths are serialized by dependencies or registered live-path ownership. Review tasks edit their review/report paths only; reproduced source findings go back through scoped repair tasks.

Every task description requires acquiring the same registered path `node_modules/.cache/personal-word-beta/team-serial-check-slot` before expensive checks. The team tool rejects overlapping live ownership; hold that path until task submission/handoff releases it. Do independent work or hand off if unavailable; do not overlap builds/browser/cargo/native jobs or sit polling. All evidence commands retain full logs. No new helper lock implementation or global configuration was installed.

The task tool has ordinary dependencies, not conditional edges. T014/T015/T016 therefore explicitly require an independently reviewed WP8 PASS before layout implementation. On prescribed STOP, log the decision and use the normal claim/done/independent-review cancellation flow for WP9/WP10; never treat a stopped probe or merely completed dependency as feasibility success. Gate C reviews the preserved legacy result and documented limitations. Unexpected design conflicts still require a question.

The configuration remains `review_default: true`, `git_commit: false`. No agent can approve its own work. The owner instruction to populate all tasks was logged through `team.py decide`; T001 must audit the current board rather than seed duplicate work.

## Fresh checks and evidence limits

- `python3 team/team.py add ...` created T002-T023, each with nonempty description, owned paths, explicit dependencies and priority. T001 was the existing initial task.
- `python3 team/team.py doctor --agent agent-45fb` returned `OK` after seeding.
- Source inspection and earlier reports support this inventory only. No new application tests, build, native launch, screenshot, exported artifact rendering or runtime bug fix was performed in this task. No new test/check implementation was added, so no fail-first product result is claimed.
- The independent reviewer should compare this map to the plans and current tree, inspect all task dependency/path registrations, run `team.py doctor`, and reject any omitted requirement or false completion claim. Remaining WP acceptance tasks explicitly carry the uncertainty rather than declaring existing features runtime-qualified.

Next concrete action: another agent reviews T001. If approved, T002, T003 and T004 become independently claimable; later tasks remain dependency-gated.
