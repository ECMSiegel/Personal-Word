# Independent review -- T003 editor and reading view

Date: 2026-10-24. Reviewer: agent-aa30 (Codex; not the T003 author). Review coordination: T025.

## Verdict: REQUEST CHANGES

The table navigation/header fixes pass the existing acceptance suite, but an additional real browser fixture reproduces missing editor images after a normal project exit/reopen. Asset bytes remain in IndexedDB; this is a display/rehydration failure, not demonstrated data loss. Repair before accepting the editor image lifecycle.

## Blocking finding -- P2: saved images remain placeholders after reopening a project

Reproduction on the current fresh production build, without mocking storage or changing source:

1. Create a synthetic Blank project, insert a PNG with alt text, and wait for its editor image to have a `blob:` source and for Saved status.
2. Click Projects in the open-project tab bar, then reopen the same project tab.
3. Confirm the figure's asset ID still has a stored row in that project's IndexedDB asset store.
4. The reopened editor contains `<img width="1" hidden="" height="1" alt="Delayed image"/>` with no `src`. The visible node stays an alt-text placeholder rather than displaying the stored image.

Runnable unmocked regression: `node_modules/.cache/personal-word-beta/team-t003-independent-review/reopen.spec.mjs`. Run with pinned Node:

```sh
npx playwright test -c node_modules/.cache/personal-word-beta/team-t003-independent-review/reopen.config.mjs --workers=1
```

Observed result: **1 failed**, specifically the final `toHaveAttribute('src', /^blob:/)` assertion, after the stored-asset assertion passed (`reopen.log`, trace and error context under `reopen-results/`). No sleep, retry, source mutation or test timeout change was used.

Source explanation (inferred from the inspected caller sequence): image NodeViews call `load()` on construction and only retry on an asset-ID change. If no global resolver is registered at construction they return immediately. The global setter in `src/editor/media.ts` changes the resolver without refreshing existing NodeViews, while Writer/App register it in passive effects. Ensure existing nodes can resolve once the correct project resolver becomes available; retain cross-project cleanup and avoid broad filesystem/network access. Add a maintained regression through the normal project exit/reopen path. Register additional files before repair, coordinating any App integration needs with T005.

Also inspect pending async-resolution cleanup while repairing this lifecycle: current Writer/App caches can receive a late URL after their cleanup. That is a static risk, not a confirmed runtime leak from this review; do not label it reproduced by the probe below.

## Checks that passed

Run sequentially under T025's registered serial-check slot with Node v22.23.3:

- `npx tsc --noEmit -p .` -- exit 0 (`typecheck.log`).
- `npx vitest run src/editor src/components/ReadDocument.test.ts src/adversarial-wp2.test.ts src/adversarial-wp2-1.test.ts` -- **123 passed across 10 files**, exit 0 (`units.log`).
- `npm run build` -- exit 0, 1,981 modules, Vite 10.45 seconds (`build.log`); existing chunk/plugin-dialog warnings retained.
- Actual production-preview `tests/assets.spec.ts --workers=1` on isolated port 1448 -- **8 passed**, exit 0, 16.4 seconds (`browser.log`). Config and results are isolated from the author's 1447 run and the unrelated dev server on 1420.
- Eight reviewed source/test hashes match before/after the review (`source-before.json`, `source-after.json`); no implementation source was edited.

All logs/configs/probes above live under `node_modules/.cache/personal-word-beta/team-t003-independent-review/`.

## Inspected evidence and design

Read T003's description/submission/report, actual `tables.ts` diff, relevant Writer insertion/resolver/toolbar handlers, ReadDocument, media NodeViews, and browser/unit tests. The author's first browser log records actual table typing loss (`H3!` expected, `!` received), not a test-discovery pass. Later logs record the header-row and stale-caret failures and 16 passing repeated scenarios after repair. Exact trigger matching and one-open-popover interactions preserve the table-control assertions.

Collapsed target-cell selection and DOM-caret-first navigation address the recorded table reproduction, and the headless state fallback still passes. Modern first-row header toggling is consistent with the tested single-header-row UI; no independent blocking finding for that choice was established here. Native WebKit and broader keyboard-focus qualification remain separate tasks.

Inspected all four actual light/dark editor/reader PNGs in the author's `wp2/` cache. Tables/header shading, text and the red image are visible and legible in those captures. Editor placeholder text is also visible below the loaded image whereas the reader shows the image without that text, matching the report's stated observation. These Chromium captures do not prove native rendering or the untested reopen lifecycle.

## Diagnostic boundaries

An initial cached TypeScript probe did not load because Node cannot strip types under node_modules (`lifecycle.log`); it is a harness setup error. The JavaScript deferred-read variant ran but never reached its queued-read checkpoint (`lifecycle-js.log`); it does not prove a URL leak. That led to the simpler unmocked reopen regression above, whose precise failure is a confirmed product display issue. All diagnostic failures are retained rather than recast as passes.

## Next action

Reject T003 with the unmocked reproduction, let an owning implementer repair/register the relevant image lifecycle files and rerun its acceptance plus the new maintained regression. T005 remains dependency-gated until this is resolved and reviewed. Q001 about separate native-print work remains unresolved and was not altered by this review. No native app was launched, no real user writing was touched, and no package, commit, push or source repair occurred during review.
