# Source alpha preparation

Baseline: `f43c09d` before approved identity rewriting. Execution follows the local handoff runbook; no new product scope is introduced.

## Owner decisions

- Rewrite existing local commit author/committer email to the supplied GitHub noreply address.
- Keep AGENTS.md and docs/agent-work; scrub personal paths; untrack and ignore HANDOFF.md.
- Source only, version 0.1.0, tag v0.1.0-alpha.1.
- No remote and no push.
- Fix deadline validation and all three minor citation/Markdown findings; document remaining limits.

## Implementation

- Promoted the public README and added the known alpha limits requested by the runbook.
- Removed the machine-specific path from the writer review; kept the session handoff local.
- Shared deadline validator preserves the loader's original strict date check; App rejects invalid nonempty deadlines before mutation. A browser regression checks rejection, saved-value preservation, reopening, and clearing.
- Short non-book notes preserve terminal question/exclamation punctuation. Markdown nested lists use marker widths; literal line-leading markers are escaped. Both text formats preserve supplied locator prefixes.
- Each serializer fix failed against the original implementation, passed after repair, then failed again after restoring the original defect. Evidence is consolidated below after qualification.
- Independent review found overbroad README privacy wording; corrected optional lookup disclosures, including follow-up Crossref requests from page metadata.
- Source validation and independent review results are recorded below. Local Git delivery follows this record; the ignored handoff records the actual resulting commit/tag, or any permission block.

## Evidence boundary

All application changes remain CLAIMED until the owner confirms them in real use. Automated results do not establish native WebKit behavior or native SQLite persistence. Historical agent file contents remain in history; only commit identity rewriting is authorized.

## Integration notes

- Deadline browser fail-first: removed only the new App guard; `npm run test:e2e -- tests/features.spec.ts --grep 'invalid extended-year' --workers=1` failed with `Error: Invalid writing goalsRetry` instead of the boundary rejection. Restored the guard; identical command passed (1 test, 1.3 minutes). This is meaningful behavioral evidence; missing-export helper failures are not counted as fail-first proof.
- Two redundant helper builds survived its completion report. Root identified their process trees and stopped them, retaining the final integrating build. No duplicate build result is counted as qualification.

- Integrating review found two missed boundary cases: book short titles ending in `?`/`!`, and Markdown `>literal`/lone `>` without a space. Both received additional fail-first and restored-defect checks and were repaired before final qualification. Final citation suite has 13 tests; exporter has 12.
- First frontend build passed; final serializer edge repairs overlapped that run. The required release rebuild will compile the final frontend again, and its result is the exact final source build evidence.


## Final source qualification

- `npm test`: 163/163, 17 files, 29.74 seconds. The run began after all final code edits.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored.
- Targeted deadline browser regression: passed after the original defect was reproduced.
- `npm run tauri build`: passed; its before-build frontend command rebuilt final source in 51.20 seconds; native optimized build finished in 4m37s. Fresh Personal Word.app is 15.25 MiB; see BUILD_EVIDENCE.json for identity and freshness checks.
- Independent Luna review: no remaining reviewed code findings, 50 focused tests passed. The integrator additionally reviewed the exporter and repaired its missing no-space quote case.
- Owner-reported Terminal run on October 19: `npm run test:e2e -- --workers=1` passed all 46 Chromium scenarios in 1.7 minutes. The owner supplied the complete passing output in chat. This closes the blocked browser gate; the integrating agent did not independently rerun it. Browser storage does not establish native WebKit or SQLite behavior.
- `git diff --check` and current-tree personal-path scan: passed. README's 13 local links/images resolve. Native GUI/persistence, Word/LibreOffice rendering, hosted CI, and public-history content review remain open.

## Local delivery procedure

Owner authorized a local commit, branch-history email rewrite and v0.1.0-alpha.1 tag, with no remote/push. The local noreply configuration is applied and the pre-rewrite backup bundle verified. Git finalization is performed after this source record is written; the ignored HANDOFF.md records the actual result. Only publishable branch/tag histories are rewritten; internal app refs and historical file contents are retained locally and are not a privacy-scrub claim.


## Owner browser qualification follow-up

All 46 scenarios passed in the owner’s Terminal run (1.7 minutes), including the deadline regression, accessibility undo test, save/recovery, citations, import and writing aids. Only documentation changed after the tested source commit `f324a7a`. A local backup of the previous alpha tag is preserved before updating the tag to this evidence commit. No remote or push is authorized. Native real-use and export-rendering checks remain open.


## Dated follow-up -- October 19, 2026 security/reliability pass

This historical source-alpha record and the owner's 46/46browser output remain point-in-time evidence. A later approved pass repairs native raw-argument Unicode prefix handling and accidental sidebar chrome selection, with fresh 163 unit/49 browser/19 Rust passes (1existing ignored benchmark), a 3-phase isolated native recovery pass, normal release rebuild, and clean-source Node 22 npm ci/build/unit rehearsal. The owner explicitly accepts the pending manual native-sidebar check for this source-only alpha; it remains unverified. See [the current log](../2026-10-19-alpha-security-reliability/IMPLEMENTATION_LOG.md) and [independent review](../2026-10-19-alpha-security-reliability/REVIEW.md) for current scope, findings, audit and local commit/tag delivery state. No push or binary distribution is authorized.
