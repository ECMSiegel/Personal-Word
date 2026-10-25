# Cheap-fixes validation record (T070, 2026-10-25)

Agent: agent-fb4d (OpenCode) | Status: CLAIMED pending independent review

## Scope
Ran the Validation list of `docs/agent-work/2026-10-25-cheap-fixes/PLAN.md` (steps 1-8) on the final
tree after T050-T057 were done and independently reviewed (board tasks T050-T069; rework cycles:
T051 cycle 2 for the native-harness assertion, T052 cycle 2 for the toast position, T054 cycle 2 for
the Chicago first-page decision, closed by owner answer Q005). Executed through the recorded T021
serial driver so the evidence pipeline consumes the run directly:
`bash node_modules/.cache/personal-word-beta/team-t021/run-serial.sh` (steps 1-8) then
`bash .../run-final.sh` (steps 9-10). Serial slot held 21:26-21:48 UTC; `steps.log` and all step logs
under `node_modules/.cache/personal-word-beta/team-t021/`.

## Results (all steps rc=0)
| Step | Result |
|---|---|
| 1 tsc | exit 0 |
| 2 build | exit 0 (`tsc -b && vite build`) |
| 3 vitest | **872 passed / 47 files** (serial; was 865 before the cheap fixes) |
| 4 playwright | **120 passed**, 4.1 min, one worker, no retries, port 1490 production preview; covers the nine specs the plan names (import, import-cancel, rich-import, zotero, research, features, editor-toolbar, notice, markdown-roundtrip) |
| 5 cargo | **49 passed / 0 failed / 1 ignored** (offline, serial) |
| 6 smoke build | exit 0 (debug, `native-smoke`, `com.folio.smoke`, no bundle) |
| 7 native baseline | run `20261025T213548Z-f99053d6`, exit 0 (13 scenarios + 5 detected controls) |
| 8 native beta | run `20261025T213634Z-2cadf18d`, exit 0 (19 scenarios + 42 detected controls) |
| 9 bench | p95 **141.69 ms** on the 100,000-word fixture (budget 150 ms); host load ~20-26, machine up 12 days; the earlier 116.57/130.43/124.37 ms figures were taken at load ~2. The timing-sensitive baseline close-retry scenario passed in this run's baseline. |
| 10 release build | exit 0 |

## Normal app
- Path: `src-tauri/target/release/bundle/macos/Personal Word.app`, rebuilt 21:45-21:48 UTC by plain
  `npm run tauri build`.
- Binary `Contents/MacOS/folio` sha256
  `0daf16f8fd6d13fa609455282db0fdc1809af507e73555252609aa75f04a6141`; `com.folio.writing` 0.1.1.
- Marker scan over `Contents/`: zero hits for smoke/diagnostic markers. Supersedes the Gate D app
  (binary `66da1177...`), which was built before the cheap fixes.

## Evidence
1. `verify-beta-evidence.py --write-source-manifest` rewrote `06-durability/SOURCE_MANIFEST.json`
   from the current tree (exit 0; `team-cf-validation/write-manifest.log`).
2. `make_evidence.py` regenerated `06-durability/EVIDENCE.json` from the step logs (exit 0), which
   resets review and owner gates to pending by design.
3. The Gate D review record (reviewer `agent-9e61`, REVIEW.md sha `0065be67...c582e2`) and the nine
   owner gates (state passed, owner report `OWNER_TEST_RESULTS.md`) were restored by hand from the
   captured pre-regeneration values (`team-cf-validation/review-and-gates.json`), per the recorded
   procedure (evidence.md section 6; make_evidence must not be re-run afterwards).
4. `verify-beta-evidence.py` exits **0**: "All required evidence verified (automated results remain
   CLAIMED until the owner confirms real use)." The task description anticipated exit 2 with nine
   pending owner items because it was written before the owner's confirmations were folded into
   EVIDENCE.json; the stronger result is recorded here.

## Board question
Q005 (Chicago first-page section title) was answered by the owner in the live chat on 2026-10-25 and
recorded with `resolve --agent user`: keep the approved cycle-2 behaviour (Chicago's first page
prints no section-title heading; every other section keeps its heading; non-Chicago projects print
project + section titles). The shipped, reviewed implementation stands; no further code change.

## Documentation updates (this task)
- `README.md`: removed the fixed limitation sentences (import label "up to 20 MB", Jr. suffix raw-only,
  browser-preview Zotero fetch path, PDF image stacking, exports omit titles, toast covering Export PDF,
  "Folio" error string); narrowed the abandon-dialog sentence to what remains uncovered (leaving the
  screen); added the new titles behaviour with the Q005 note; added this run's benchmark figure with
  its load context.
- `docs/validation.md`: removed the fixed items from the boundary list; updated the verifier paragraph
  (exit 0 reached after owner reports); added this dated section.
- `06-durability/IMPLEMENTATION_LOG.md`: appended the T070 entry.

## Not covered (unchanged boundaries)
Chromium-only browser evidence; Intel x86_64 / macOS 15.7.9; no Apple silicon, hosted CI, VoiceOver,
IME, Word rendering of the new DOCX headings, or native WebKit visual inspection of the new export
output; the later-fixes plan (`2026-10-25-later-fixes/PLAN.md`, DRAFT) items remain open by design.

## Review cycle 2 (2026-10-25, agent-9142)

Reviewer agent-563d rejected cycle 1 because `make_evidence.py` had reset `meta.status` to `incomplete` and `meta.implementationStatus` to the pre-acceptance CLAIMED wording, undoing commit d499b88's summary while the nine owner gates and the review record were restored. Fix: both fields set back to their HEAD values, with "; cheap-fixes automated results of 2026-10-25 (task T070) are CLAIMED" appended to `implementationStatus`; `make_evidence.py` was not rerun. `scripts/verify-beta-evidence.py` still exits 0. Also: README "Exports print titles" now says Chicago prints neither the project title nor the first section's title (matches `src/export/document.ts`); docs/validation.md boundary gives the benchmark load numbers instead of "low load". Reviewer's notice spec run at host load 61-71 had 3 load-sensitive failures (4 passed); the same spec passed 7/7 in the T070 run at load 20-26 (board discovery). Six `notice*.png` files in the project root were written by the notice spec (no `NOTICE_SHOTS` set) and await the owner's say-so before removal.
