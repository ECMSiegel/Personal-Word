# Independent review -- T004 Markdown note round trips

Date: 2026-10-24. Reviewer: agent-07d0 (Codex, not the T004 author). Coordination task: T024.

## Verdict

APPROVE T004 within its unit/typecheck acceptance scope. No blocking source or regression-test finding. Application behaviour remains CLAIMED pending the separate browser/native/artifact and owner checks; this review does not approve those gates.

## Inspected work

Read T004's description, submission note, `wp4.md`, actual diffs for `src/export/textExport.ts`, `src/export/textExport.test.ts`, `src/import/manuscript.ts`, `src/import/manuscript.test.ts`, and the existing adversarial cases. Read the real `src/import/markdownNotes.ts` parser and exporter, and check the App -> previewWriting -> previewManuscript caller chain. T004's new work is one exact-reference-position regression; existing exporter/importer implementation was preserved.

The new test resolves newly generated note identities and compares exact paragraph node order and surrounding text, including a repeated reference and a multi-paragraph note. It would catch references moved to paragraph ends rather than merely checking that notes exist. Existing continuation-indentation tests cover paragraphs leaking out of a definition; the plain-text import branch remains separate from Markdown note conversion.

The five inspected implementation/test paths were unowned by live tasks before review. Their SHA-256 hashes match before and after the fresh checks; this review edited none of them. Generated manifests/logs are in `node_modules/.cache/personal-word-beta/team-t004-independent-review/`.

## Fresh verification

Commands use the pinned Node v22.23.3 path, run sequentially under T024's registered shared serial-check slot:

- `npx tsc --noEmit -p .` -- exit 0, no diagnostics (`typecheck.log`).
- `npx vitest run src/import src/export src/adversarial-wp4.test.ts` -- exit 0, **197 passed across 9 files**, 18.76 seconds (`focused.log`). Includes manuscript/parser and Markdown bundle round trips, not just the new test.
- Compared `source-before.json` and `source-after.json` -- zero mismatches for the five reviewed source/test paths.
- Scoped `git diff --check` -- exit 0.
- `python3 team/team.py doctor --agent agent-07d0` -- `OK`.

## Negative-control evidence inspected

The author's `team-t004/doctored-noindent.log` records 23 assertion failures exposing unindented multi-paragraph note continuations; `doctored-refs-at-end.log` records exactly two assertion failures, including the new inline-position test showing body text followed by all references. These are behaviour assertion failures, not missing imports or setup errors.

The author's `fail-first-hashes.log` records distinct mutant hashes and identical restored exporter hashes after each run. The current exporter SHA-256 matches the reported original/restored hash: `87827f719e34bde9db11e53faf00914a9d75de0369a28d6bf5e5f3fedd2800f1`. Its restored suite passed 197 tests, independently confirmed above. I inspected these negative controls; I did not doctor shared source or claim to have freshly repeated them.

## Scope and limitations

No production changes were made during this review, and no browser, native WebKit, app bundle or rendered export acceptance was run. Those remain in T003/T005/T010 and the later gates. Existing Markdown limitations are explicit in `wp4.md`: soft breaks collapse to spaces, sections re-import as one entry, and rendered citation-note text does not reconstruct source metadata; project archives are the separate lossless metadata route.

Nonblocking documentation detail: `wp4.md` calls the adversarial file “23 cases”, while the inspected current run lists 21 cases in that file. The combined acceptance total of 197 is correct and was independently reproduced. Use the current runner counts rather than that historical per-file count.

Next: record T004 approval through the team tool. T002 still needs a different reviewer because this chat authored T002; no new agent registration makes that review independent. T003 can acquire the released serial slot for its browser checks after T024 is submitted.
