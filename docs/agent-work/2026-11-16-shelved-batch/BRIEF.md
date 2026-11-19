# Shelved batch -- checkpoint (2026-11-16)

Owner request (2026-11-16): handle these shelved items; Sonnet/Haiku helpers allowed; review or ideate where a whole plan is needed.

1. Long card titles run under the trash icon (Projects, cards view; REVIEW-9 finding 2 in ../2026-11-12-layout-primitives/).
2. Table right-click menu does not flip upward in a short window (REVIEW-4 note 6, REVIEW-7 line 106).
3. Focus rings clipped in the Prose issue list (REVIEW-7 finding 2).
4. Page header / Page footer text and on-screen page numbers.
5. Three motion transitions (M1-M3 in ../2026-11-05-ui-wave-8/IDEAS.md section 3; recommended forms).
6. Projects page (IDEAS.md section 4; stale: view/sort already persist).
7. Stop whole-suite reruns after every small repair.

## State
- Item 7: DONE in the tree, not committed. playwright.config.ts workers 1 -> 3; rule added to AGENTS.md "Verification and delivery". One earlier 3-worker run: 670 passed, 0 failed, 9.8 min. Two confirming runs: test-results/sb-baseline/e2e1.log, e2e2.log.
- Items 2, 3: one Sonnet worker each, fail-first spec, own files only.
- Items 4, 5, 6: read-only Sonnet research first. Item 4 goes through `ideate` and waits for the owner's pick. Item 6 waits for the owner's pick (A + D, or also B / C). Item 1 folds into the Projects worker. Item 5 runs after item 6, one worker, M1 then M2 then M3 (all touch src/App.tsx).
- End: Opus review, one full suite run, release rebuild, hand-test list. Nothing committed without the owner's word.

## Order and ownership
| Step | Who | Files |
|---|---|---|
| Prose focus rings | Sonnet | src/components/prose-issues.css, src/components/ProseIssues.tsx, tests/w9-prose-menu.spec.ts |
| Table menu flip | Sonnet | src/editor/TableContextMenu.tsx, src/components/ContextMenu.tsx, one new spec |
| Projects page + card titles | Sonnet, after owner pick | src/components/ProjectLibrary.tsx, its css, tests/projects-screen.spec.ts |
| Motion M1-M3 | Sonnet, after Projects | src/App.tsx regions, src/motion.ts, css, tests/motion.spec.ts |
| Page header/footer | after ideate + plan | to be decided |
