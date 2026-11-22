# FB9 -- Research collapse controls

## Changes

- Added the app-wide `personal-word.researchCollapsed` preference with validated reads and storage-failure handling.
- Added keyboard-operable chevrons for Note, Shortened note, Bibliography and Used in. The content remains visible when expanded; collapse state is shared across sources and survives source close/reopen and reload.
- `Preview` renders its original label and citation paragraph when `onToggle` is omitted, so the citation-card call sites keep their existing markup.
- Added unit coverage and a browser regression spec.

## Fail-first

Command (built preview, before wiring the controls):

```sh
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/fb-research-collapse.spec.ts --workers=1 --trace off --output test-results/fb-FB9-fail-first
```

Result: 1 failed at `tests/fb-research-collapse.spec.ts:37`; the exact Note toggle button was absent. This is the expected pre-fix failure.

## Verification

- `npx tsc -b`: passed on the final source tree.
- `npx vitest run src/research/collapsePreferences.test.ts src/hoverEmphasis.test.ts src/layoutPrimitives.test.ts`: 3 files, 16 tests passed. Includes an SSR compatibility assertion that `Preview` without collapse props keeps the citation-card markup unchanged.
- First built-preview acceptance command: 24 passed, 2 failed. `fb-research-collapse.spec.ts` had a strict locator matching source and child disclosures; `w9-research-panel.spec.ts` showed the shared source-chevron padding had enlarged the new label controls.
- First focused rerun: both still failed. The new-source flow opens its row automatically, so the test's extra click closed it; and the base button padding still added 12 px beyond the existing Research-panel geometry assertion. The test now asserts the initial open state, and the collapse button resets its padding to zero; the final focused run passes below.
- Final focused built-preview command: `PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npx playwright test tests/fb-research-collapse.spec.ts tests/w9-research-panel.spec.ts --workers=1 --trace off --output test-results/fb-FB9-acceptance-r3` → 2 passed. The remaining acceptance specs `tests/w9-used-in.spec.ts` and `tests/research.spec.ts` passed in the first built-preview run (24 of 26 tests passed there).

Evidence boundary: Chromium production preview only; no native WebKit, citation-card manual run, screenshots, or owner real-use confirmation.
