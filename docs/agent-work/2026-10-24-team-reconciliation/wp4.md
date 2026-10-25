# WP4 -- Markdown note round-trip acceptance (team task T004)

Date: 2026-10-24 | Agent: agent-1a38 (Claude Code, Fable 5.1) | Status: CLAIMED (submitted for independent review)

## Scope
Task T004 on the team board: accept or repair the existing WP4 work (DELEGATION.md WP4 steps 1-3):
multi-paragraph note continuation indentation in the Markdown exporter, `parseMarkdownNotes` wired
into the manuscript importer, and an export -> import round trip that preserves note content, order
and reference positions. Owned paths: `src/export/textExport.ts`, `src/export/textExport.test.ts`,
`src/import/manuscript.ts`, `src/import/manuscript.test.ts`, `src/adversarial-wp4.test.ts`, this
report, and the log folder `node_modules/.cache/personal-word-beta/team-t004/`.

## What was already there (inspected, not rebuilt)
Uncommitted work by the earlier WP4 worker (`.agents/teamwork/worker_wp4/handoff.md`), reviewed by
`reviewer_wp4_1`, `reviewer_wp4_2`, `challenger_wp4_1`, `challenger_wp4_2`, `auditor_wp4_1`
(all approve/clean, all unit-level, none under the team tool):
- `src/export/textExport.ts`: `formatMarkdownFootnote()` splits a note on blank lines, escapes each
  continuation line and indents it by four spaces; `projectMarkdown` uses it for the `## Notes` block.
- `src/import/manuscript.ts`: `.md` files go through `parseMarkdownNotes(normalized, md => markdownDocument(md, warnings))`;
  footnotes land in `project.research.footnotes` (`emptyResearch()` spread, additive), parser warnings
  are merged into the preview warnings; `.txt` keeps the legacy paragraph/hard-break import untouched.
- Tests: 3 new exporter tests, 5 new importer tests, and `src/adversarial-wp4.test.ts` (23 cases).

Static review findings (read against `src/import/markdownNotes.ts`, which T004 does not own):
- Export escaping and import unescaping are symmetric for `\ * _ [ ] #`, `>` and list markers, so a
  note line that looks like a definition, heading, list item or quote stays inside its note.
- Numbering is by first reference in project order on export and by first reference on import, so
  order survives, including repeated references to one note.
- Reachability (static): `src/App.tsx` imports `previewWriting` from `src/import/docxImport.ts`,
  whose non-DOCX/HTML fallback calls `previewManuscript`, so `.md` imports from the app go through
  `parseMarkdownNotes`. Presence and wiring only; no runtime UI check in this task.
- Gap in the WP4 tests: the WP4 exporter/importer/adversarial tests asserted note order and
  containment, but not the inline position of a reference relative to the surrounding text. The
  parser's own suite (`src/import/markdownNotes.test.ts`, "round-trips notes exported by
  projectMarkdown") does pin positions, but calls the parser directly and uses single-paragraph
  notes only; nothing pinned positions through `manuscript.ts` (the WP4 wiring) with a
  multi-paragraph note. Added one test (see below).

## Changes made by T004
- `src/import/manuscript.test.ts`: added "keeps every note reference at its exact inline position
  after export and re-import" (two paragraphs, two notes, one repeated reference; asserts the exact
  `[text, ref, text, ref, text]` shape of each imported paragraph).
- No production code changed by T004. `src/export/textExport.ts` SHA-256 before and after the
  doctored runs: `87827f719e34bde9db11e53faf00914a9d75de0369a28d6bf5e5f3fedd2800f1` (byte-identical;
  see `team-t004/fail-first-hashes.log`).

## Commands and results
Run from the project root with the pinned Node (`node --version` = v22.23.3 in every log), one at a
time under the team serial-check slot, logs in `node_modules/.cache/personal-word-beta/team-t004/`.
Note: the plan's acceptance command `npx vitest run src/import src/export` does not pick up
`src/adversarial-wp4.test.ts` (it sits in `src/`), so that file is passed explicitly.

| Log | Command | Result |
|---|---|---|
| `accept.log` | `npx tsc --noEmit -p .` | exit 0, no errors |
| `accept.log` | `npx vitest run src/import src/export src/adversarial-wp4.test.ts` | 9 files, 197 tests passed, exit 0 |
| `doctored-noindent.log` | same vitest command, exporter doctored (no continuation indent) | 23 failed / 174 passed, exit 1 |
| `doctored-refs-at-end.log` | same vitest command, exporter doctored (references moved to paragraph end) | 2 failed / 195 passed, exit 1 |
| `restored.log` | same vitest command, exporter restored | 9 files, 197 tests passed, exit 0 |

Not run in this task: `npm test` (full units), `npm run build`, Playwright, cargo, native harness.
T002's serial full-unit run (814 passed, per its handoff message #11) included the new T004 test;
that is T002's log, not T004 evidence.

## Fail-first evidence
The earlier worker recorded 7 failures before the WP4 code existed (`.agents/teamwork/worker_wp4/handoff.md`,
section 1.2). T004 redid the check against doctored copies of the current exporter (backup, doctor, run,
restore, hash; `src/import/markdownNotes.ts` was never touched since T004 does not own it):

1. **Original defect reintroduced** (`formatMarkdownFootnote` without the 4-space continuation indent,
   `doctored-noindent.log`): 23 tests fail, all multi-paragraph round trips -- 14 in
   `src/adversarial-wp4.test.ts`, 3 in `src/export/textExport.test.ts`, 2 in `src/import/manuscript.test.ts`
   (including the new position test, because the leaked continuation becomes an extra body paragraph),
   and 4 in `src/export/markdownBundle*.test.ts` (WP7's bundle round trip depends on the same exporter).
   Single-paragraph tests still pass, as expected.
2. **Reference-position defect** (paragraph case of `markdownBlocks` emits all `[^n]` at the paragraph end,
   `doctored-refs-at-end.log`): exactly 2 tests fail -- the new T004 test and the parser suite's
   "round-trips notes exported by projectMarkdown". Every order-only and containment-only test still
   passes, which is what the new test was added to cover.
3. Restore: SHA-256 of `src/export/textExport.ts` after each restore equals the pre-doctor hash
   (`fail-first-hashes.log`); `git diff --stat` shows the same 10+/1- as before T004 started.

## Known limitations (unchanged behaviour, documented honestly)
The first item is confirmed by test (`src/adversarial-wp4.test.ts`, section 8.2). The rest are inferred
from reading `src/import/markdownNotes.ts` and `formatMarkdownFootnote`, not exercised by a test.
- A single line break inside one note paragraph is a Markdown soft break: it comes back as a space.
  Paragraph boundaries (`\n\n`) survive exactly.
- A blank line that contains only spaces or a tab inside a note is normalised to a plain blank line.
- Multi-section projects export as `##` headings and re-import as one entry (manuscript import
  has always produced a single entry).
- A note that carries a source citation exports its rendered text; on import it is a plain-text
  note with no `sourceId` link.
- Leading indentation inside a note paragraph (4+ spaces) is consumed by the continuation indent.

## Needed from files T004 does not own
Nothing required. Observation for WP7/Gate B (not a defect): the Markdown bundle round trip
(`src/export/markdownBundle*.test.ts`) depends on this exporter's continuation indent, so any later
change to `formatMarkdownFootnote` must rerun those tests too.

## State of registered paths at submission
- `src/export/textExport.ts`: uncommitted edits (earlier WP4 worker's; unchanged by T004, hash above)
- `src/export/textExport.test.ts`: uncommitted edits (earlier WP4 worker's; unchanged by T004)
- `src/import/manuscript.ts`: uncommitted edits (earlier WP4 worker's; unchanged by T004)
- `src/import/manuscript.test.ts`: uncommitted edits (worker's tests plus one new T004 test)
- `src/adversarial-wp4.test.ts`: untracked, unchanged by T004
- `docs/agent-work/2026-10-24-team-reconciliation/wp4.md`: this report, untracked
- `node_modules/.cache/personal-word-beta/team-t004/`: logs (`accept.log`, `doctored-noindent.log`,
  `doctored-refs-at-end.log`, `restored.log`, `fail-first-hashes.log`), not under Git

## Evidence boundary
Node unit tests and `tsc` only. No browser (Playwright) run and no native (Tauri/WebKit/SQLite)
run were part of this task; the import path's UI (ImportPreview) is covered by other tasks.
Status: CLAIMED pending owner real-use confirmation.
