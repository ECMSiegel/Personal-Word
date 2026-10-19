# Regression evidence

Behavioral fail-first checks accompany the source-alpha repair. Helper-export absence alone is a harness failure, not behavioral proof; the deadline UI defect-restoration run below supplies that proof.


# Personal Word alpha citation Q6 evidence

Scope: `src/research/citations.ts` and `src/research/citations.test.ts` only. The known pre-existing modification to `HANDOFF.md` was left untouched.

## Fail-first and reverse verification

- Command: `npm test -- --run src/research/citations.test.ts`
- Before implementation, the added test failed: expected `Smith, “Did It Work?”`, received `Smith, “Did It Work?.”`; 11 other tests passed.
- After implementation: all 12 tests passed.
- Temporarily restored the original citation punctuation defect and reran the same command; the test failed again with the same `? .` output. Full output: `/tmp/pw-alpha-citations-defect-restored.log`.
- Restored the implementation and ran the same command once more; all 12 tests passed, exit status 0. Full output: `/tmp/pw-alpha-citations-final.log`.

The original fail-first output was observed directly before the change. The final output and reverse-check output are saved in the paths above.

## Change

Short non-book citations now omit the appended period when the short title ends in `?` or `!`. Tests cover both punctuation marks, a locator, and page/chapter locators already containing `p.`, `pp.`, or `ch.`. The citation formatter passes supplied locator text through without adding a `p.` prefix.

The separate export-side locator prefix in `src/export/textExport.ts` is outside this task's assigned file ownership and was not changed.

## Book short-title edge case (integration follow-up)

The review integration found that short books still emitted a standalone period after a title ending in `?` or `!`. Added book cases for both endings.

- Fail-first command: `npm test -- src/research/citations.test.ts` — failed against the original branch with `Yu, What Matters?.`; 12 other tests passed. Full output: `/tmp/pw-alpha-citations-books-fail-first.log`.
- Fixed run: passed, 13 tests. Full output: `/tmp/pw-alpha-citations-books-fixed.log`.
- Temporarily restored the book defect and reran: failed again with `Yu, What Matters?.`. Full output: `/tmp/pw-alpha-citations-books-defect-restored.log`.
- Restored the fix and reran: passed, 13 tests, exit status 0. Full output: `/tmp/pw-alpha-citations-books-final.log`.

Book short notes now also omit the terminal period when their short title ends in `?` or `!`; ordinary book titles retain the period, and locators keep their existing formatting.


# Personal Word Q6 Markdown export evidence

Scope: `src/export/textExport.ts` and `src/export/textExport.test.ts` only. No package or Git changes. `HANDOFF.md` was already modified before this subtask began.

## Fail-first against the original exporter

Command: `npm test -- src/export/textExport.test.ts`

Result: exit 1; 1 test file failed, 2 failed / 9 passed. The newly added nested-list test showed `10. parent` followed by only two spaces before `- child` (expected four); the literal-marker test showed raw `-`, `+`, `>`, and `12.` line starts without escapes.

## Restored-defect regression run

Command: temporarily restore `src/export/textExport.ts` from `HEAD`, then run `npm test -- src/export/textExport.test.ts`.

Result: exit 1; 1 test file failed, 4 failed / 8 passed. The failing assertions covered ordered-list continuation/nesting width, nested-list marker width, escaped line-leading markers, and existing `p.`/`pp.`/`ch.` locators receiving an extra `p.` prefix. The file was then restored from `/tmp/pw-alpha-textExport-fixed.ts`.

## Fixed run after restoring the implementation

Command: `npm test -- src/export/textExport.test.ts` (after the final explicit ordered-start-1 and ordered-start-10 assertions)

Result: exit 0; 1 test file passed, 12 tests passed. The nested indentation assertions verify 3 spaces under `1. ` and 4 under `10. `; locator assertions cover `p.`, `pp.`, and `ch.` in both Markdown and plain text.

## Changes

- Nested Markdown and plain-text list indentation now accumulates the parent marker width (`- ` is 2 columns; `1. ` is 3; `10. ` is 4), including continuation paragraphs.
- Markdown prose escapes line-leading `-`, `+`, `>`, and ordered-list markers such as `12.`.
- Research-note locators already beginning with `p.`, `pp.`, or `ch.` keep that prefix in Markdown and plain-text exports.

Evidence reaches the automated-test rung for these serializer cases. Native WebKit behavior and user confirmation were not exercised.

## CommonMark `>` without a following space

Added `>literal quote without a space` and a lone `>` to the literal-marker regression case.

- Fail-first command: `npm test -- src/export/textExport.test.ts` — exit 1, 1 failed / 11 passed; output showed both lines were left unescaped.
- Fixed run: `npm test -- src/export/textExport.test.ts` — exit 0, 12 passed.
- Defect-restoration command: temporarily removed unconditional line-leading `>` escaping and restored the older whitespace-dependent marker pattern, then ran `npm test -- src/export/textExport.test.ts` — exit 1, 1 failed / 11 passed, on the unspaced and lone `>` assertion.
- Final restored-fix run: `npm test -- src/export/textExport.test.ts` — exit 0, 12 passed.


# Goal deadline defect restoration evidence

Owned files: `src/model.ts`, `src/model.test.ts`, `src/App.tsx`.

## Defect and fix

`patchGoal` now rejects a non-empty invalid deadline with `setError("Enter a valid deadline date.")` and returns before calling `mutate`. An empty date continues to clear the optional deadline. `isValidGoalDeadline` is shared by `patchGoal` and `validateProject`; it requires exactly `YYYY-MM-DD` and retains the loader's prior `Date.parse`/UTC round-trip calendar check, including acceptance of `0000-01-01`.

## Fail-first / restoration

- The helper regression table was first added before the helper existed; the focused model run failed on all six date cases, then passed after implementation.
- Root's browser regression exercised the actual settings mutation/reload path. With the guard removed, it failed as expected: invalid goal validation surfaced the wrong `Invalid writing goals` banner rather than rejecting the input at the UI boundary. Root restored the guard afterward.
- Cases covered: standard valid date, leap day valid in 2024, invalid leap day in 2026, impossible February 30, and a five-digit year. Loader coverage also asserts a valid leap date and preserves year zero behavior.

## Verification

- `npm test -- --run src/model.test.ts`: passed, 25 tests.
- `git diff --check`: passed before root's browser cycle.
- `npm run build`: root requested that I stop this run and let the integrating agent perform the final sequential build/unit checks; no build result is claimed here.
- Native persistence, WebKit runtime, and the full suite remain unverified by this subtask.


## Integrating deadline browser regression

Command: `npm run test:e2e -- tests/features.spec.ts --grep 'invalid extended-year' --workers=1`.

With the new App mutation guard removed, the regression failed: expected `Enter a valid deadline date.`, received `Error: Invalid writing goalsRetry`. Restoring the guard made the same test pass (1 test, 1.3 minutes). It checks rejection, saved-value preservation, reopening after reload, and clearing. Isolated browser storage does not prove native SQLite persistence.
