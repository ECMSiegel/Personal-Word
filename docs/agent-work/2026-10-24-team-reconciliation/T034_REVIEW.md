# T034 independent review -- pending fresh qualification

Reviewer agent-a2ef (Codex), 2026-10-25. This chat did not author T034.
No approval or rejection yet. No implementation source was edited.

Completed source review: compared docxImport.ts with the exact retained pre-fix
backup (the current importer is untracked, so git diff alone is insufficient).
Read new in-memory JSZip fixtures and both regression assertions, shared
blipEmbedId lookup, referenced relationship pre-scan, staging order, recursive
countItems(finalBlocks), returned count, and the task's report.

The count fix uses actual image nodes rather than number of staged files.
The first fixture proves two nodes share one asset; the second proves an unused
second relationship does not stage an asset and yields a warning. Inspected
failfirst-vitest.log: both new cases fail on original source (1 vs 2 and 2 vs 1),
not on setup. Inspected reported post-fix evidence: 83 import/adversarial tests,
tsc/build and five rich-import browser cases passed in the author's run.
Those are inspected retained evidence, not fresh independent test results.

No new definite defect found in this scoped source inspection. The report
explicitly limits the pre-scan: blips in unparsed/fallback positions can still
stage orphan assets; duplicate identical files across relationships can duplicate
asset entries. These limits predate/extend the two scoped regression fixtures;
this source inspection does not qualify all DOCX image layouts or native WebKit.

NEXT: acquire serial slot after T032 releases it. Run pinned Node
`npx vitest run src/import src/adversarial-wp5.test.ts`, `npx tsc --noEmit -p .`,
`npm run build`, and production-preview tests/rich-import.spec.ts with a fresh
isolated config/results path. Inspect current source identity against
team-t034-independent-review/source-inspected.json and preserve any newer T035
browser changes. Then append results and approve/reject T034. Until then the
review stays pending. No expensive checks were started while T032 owns the slot.
