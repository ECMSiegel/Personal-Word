# WP2 task report (T003) — editor and reading-view acceptance

Owner: agent-6029 (OpenCode). Task: T003. Status: SUBMITTED FOR REVIEW.
All browser evidence below is CLAIMED until a reviewer (and later the
user in real use) confirms it; no claim is VERIFIED yet.
This is an acceptance/repair task over existing WP2 work, not a rebuild. All
implementation was authored by earlier wave-0 agents and reacts as
present-and-wired below; execution evidence is recorded per check.

## Range and rules applied

Owned files: `src/Writer.tsx`, `src/components/ReadDocument.tsx`,
`src/components/ReadDocument.test.ts`, `src/editor/editor.css`,
`tests/assets.spec.ts`, `src/adversarial-wp2.test.ts`,
`src/adversarial-wp2-1.test.ts`,
`docs/agent-work/2026-10-24-team-reconciliation/wp2.md` (this file).
No other file was edited. No packages, installs, commits, or pushes. The
`folio.*` storage keys, `com.folio.writing` schema, metadata fields and
SaveQueue semantics were not touched.

## Inspection of the current implementation (rungs 1-4: present, wired)

- `src/Writer.tsx` toolbar: "Insert image" opens a real file input restricted
  to `image/png,image/jpeg`; a pending image opens an inline alt-text field
  (`Image alternative text`, auto-focused) — no `window.prompt`. Insert calls
  the `onInsertImage(file)` callback prop; Writer calls no storage itself
  (lines ≈296-378, 987-1056).
- "Insert table" runs `insertTable({ rows: 3, cols: 3, withHeaderRow: true })`.
  When the caret is inside a table, a "Table controls" popover exposes
  keyboard-reachable buttons: Add row below, Delete row, Add column after,
  Delete column, Toggle header row, Delete table (lines ≈1059-1144).
- `setImageSourceResolver` is set in an effect keyed on `resolveAsset` and
  `item.id`, caching object URLs per `assetId` and revoking blob URLs and
  clearing the cache on unmount/project switch (lines ≈301-327).
- `src/components/ReadDocument.tsx` renders `image` (resolver + alt fallback
  span, width/height/title passthrough) and `table`/`tableRow`/
  `tableHeader`/`tableCell` with colspan/rowspan handling.
- `src/App.tsx` (read-only inspection, owned by WP3/T005) passes
  `resolveAsset` and `onInsertImage` to `Writer` and `resolveAsset` to
  `ReadDocument` — the chain is reachable end to end.

## Source and middle steps: precedent situation

- The reconciliation report (T001, reviewed) found every earlier "browser
  pass" for WP1-WP7 recorded only `--list` discovery of tests, never an
  executed run. Grep over `node_modules/.cache/personal-word-beta/*.log`
  found no log executing `tests/assets.spec.ts`. The Playwright run below is
  therefore the first executed browser evidence for this spec.
- Unit tests pre-existing from wave 0: `src/adversarial-wp2.test.ts` (448
  lines), `src/adversarial-wp2-1.test.ts` (808 lines),
  `src/components/ReadDocument.test.ts`. Wave-0 fail-first claims for these
  are CLAIMED history per the handoff; the passing run below is fresh in this
  session.

## Executed in this session (fresh, not rerouted through old logs)

- Pinned Node: `node --version` → v22.23.3 (pinned
  `node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin`).
- First executed browser run of `tests/assets.spec.ts` (8 tests)
  (command: `npx playwright test -c <wp2-isolated-config> tests/assets.spec.ts
  --workers=1`; log `node_modules/.cache/personal-word-beta/wp2/wp2-playwright.log` —
  see "browser evidence boundary" below): **6 passed, 2 failed (22.3s)**.
  Failures and their diagnosis:
  1. `keyboard navigation traverses table cells forward with Tab ... Shift-Tab
     across row boundaries` — real app bug, reproduced with three diagnostic
     probes (`wp2/tabprobe*.mjs` outputs retained in the task cache):
     `TextSelection.between($cell, moveCellForward($cell))` from
     prosemirror-tables' `goToNextCell` produces a text Range that spans out
     of the target cell across the isolation boundary (anchor in the previous
     cell's text); typing over that Range replaces the previous cell's
     content — demonstrated as "H3" being destroyed by a following "!". Also
     the first Tab after a mouse click into a cell sometimes acts on a
     stale editor state (indent keys claim it; nondeterministic between
     runs) — verified with `defaultPrevented`-after-dispatch instrumentation.
  2. `table manipulation controls insert and delete rows, columns, toggle
     header row, and delete table` — spec locator bug combined with a wrong
     interaction model: `getByRole("button", { name: "Table controls" })`
     substring-matched three project-nav buttons titled "Table Controls
     Test" (strict-mode violation), and the spec re-clicked the trigger
     before each command although the panel stays open after commands and
     only re-click closes it.

## Fixes applied (fail-first: the two failures above are the failing runs)

- `src/editor/tables.ts` (registered to T003 via `files add` before editing;
  it was unowned): `TableKeys` no longer delegates to `goToNextCell`. It now
  (1) resolves the source cell from the *DOM caret* when a view is mounted
  (the DOM caret is authoritative: PM state can lag one keystroke behind it
  after a mouse click, before PM processes `selectionchange`), falling back
  to the editor state's cell for headless contexts where no view exists,
  (2) computes the next/previous cell with the same layout formulas
  prosemirror-tables uses (merged cells cannot occur: schema forbids
  colspan/rowspan > 1), and (3) sets a collapsed caret *inside* the target
  cell via `TextSelection.findFrom` — content start for forward Tab, content
  end for Shift-Tab, so typing appends into the previous cell instead of
  replacing it. No cross-cell text Range is ever created, which removes both
  observed content-loss modes. Falling through to the indent keys (no cell
  found, last cell in the table, caret inside a list item) is unchanged.
- `tests/assets.spec.ts`: the table-controls trigger is now matched with
  `exact: true`, and the popover is opened once instead of being toggled
  before every command (commands keep the panel open; only Delete table
  closes it).

## Second rerun failure and its decision record

Rerun 2: **7 passed, 1 failed** (`wp2-playwright-rerun.log`; the keyboard
fix is verified end to end). Remaining failure: `Toggle header row` produced
**6 `th` (two header rows)** where the spec expects the header row cleared.

Root cause, read directly from `node_modules/prosemirror-tables/dist/index.js`:
`toggleHeaderRow` is `toggleHeader("row", {useDeprecatedLogic: true})`, and
the deprecated path toggles the *caret's* row: any cell of the selected row
that is a header cell is demoted, and if none were (all steps vacuous), the
row is promoted to header cells. In the spec's sequence the caret sits in a
body row at toggle time, so the command promoted a *second* header row:
`[th,td,td] → [th,th,td]`. Vendor-standard behavior, not state corruption.

State-first source (rerun 3 flake, caught by the third executed run): the
first fix resolved the source cell state-first with the DOM as a fallback
only when the state was outside a table. That still flaked: after a mouse
click into `th`1, the Tab keydown can run before PM processes the DOM
`selectionchange`, so the state still said th0 and navigated one cell
behind — every later cell drifted by one ("R1C1" landed in `th`2). The fix
now prefers the DOM caret whenever the view is mounted and the DOM
selection is inside it; the state residue is a fallback for headless
contexts (the pre-existing headless Tab unit exercises that path and still
passes). This is why the acceptance suite is run repeatedly (see
"Verification after the fixes").

Decision (documented, overridable): the editor's "Toggle header row" control
now uses the modern first-row semantics (`toggleHeader("row")` without
deprecated logic) — it toggles the *table's first row* between header and
body regardless of caret position, which matches the control's name, the
acceptance expectation (`th 0` cleared, then back to `th 3`), and this
schema (merges are forbidden, so "header row" is only ever row 0). The
alternative fix — clicking into a header cell before toggling so the legacy
caret-anchored semantics also pass — was rejected as preserving a real
user-facing footgun. Reviewers may overrule this choice; reverting to
`wrap(toggleHeaderRow)` plus a spec-side caret placement restores the legacy
behavior exactly.

## Verification after the fixes

- `npx tsc --noEmit -p .` → exit 0. VERIFIED.
- Focused suite `npx vitest run src/editor src/components/ReadDocument.test.ts
  src/adversarial-wp2.test.ts src/adversarial-wp2-1.test.ts` → 10 files,
  123 tests, all pass — including the pre-existing headless "Tab and
  Shift-Tab move between cells" unit on the state-based path. VERIFIED.
  (A scratch headless probe used during diagnosis,
  `src/adversarial-wp2-tabprobe.test.ts`, was deleted; diagnosis itself is
  documented above and in the browser cache.)
- Run 3 of the fixes (second rerun, `wp2-playwright-rerun2.log`): 7 passed,
  1 failed — the toggle-header test now passes, but the keyboard test
  flaked (caught its state-lag race at the click→first-Tab boundary; see
  the flake paragraph above). Fix: DOM-caret-first source resolution.
- Run 4 of the fixes (`wp2-playwright-rerun3.log`): whole suite executed
  twice back to back with `--repeat-each=2` → **16 passed, 0 failed
  (31.9s)**, after a fresh `npm run build` (exit 0,
  `wp2-build4.log`). The race fix is verified under doubled repetition.

## Browser evidence boundary

The recorded `c2r-full.config.mjs` (strictPort 1420) could not start: a
stray `vite` dev server (not a preview) was squatting on 1420, logged in
DISCOVERIES and not terminated. Playwright therefore ran against an
equivalent production-preview configuration isolated on port 1447
(`node_modules/.cache/personal-word-beta/wp2/wp2-preview.config.mjs`), same
testDir/timeouts/workers, fresh `npm run build` beforehand. This equivalence
gap is flagged for review per the plan's stale-configuration rule.

## Pending

- ~~Visual light/dark screenshots~~ Done: `screens.mjs` captured
  `editor-light.png`, `editor-dark.png`, `read-light.png`,
  `read-dark.png` in `node_modules/.cache/personal-word-beta/wp2/`, all four
  visually inspected in this session (fresh production build served on the
  isolated preview): table with header shading and typed content, image
  figure with a rendered 64×40 red PNG and its alt caption in the editor;
  reading view renders the same table faithfully and centers the figure in
  its cell. Light and dark are theme-consistent across sidebar, toolbar,
  table header shading, figure, and reading-view controls.
  (First capture attempt exposed one script bug — `Locator.toHaveText` is
  not callable outside the test runner — and one timing race, now handled
  by waiting for the alt dialog to detach and the figure's img to be
  visible rather than trusting the save-status text alone.)

## Fail-first controls

- New acceptance execution (not a code change): the historical gap is the
  check itself — prior evidence was discovery-only. The first executed run
  produced the two failures fixed above (retained in `wp2-playwright.log`
  and Playwright trace/error-context files).
- The `TableKeys` change follows the same fail-first chain: two executed
  browser failures demonstrating the defect, then the fix, then the rerun.
- No assertion was weakened: the keyboard test's expectations were kept
  verbatim ("H3!" must append, navigation must cross row boundaries); the
  table-controls test's command sequence and expectations were kept, only
  its locators and the open/close pattern were corrected.

## What is NOT covered here

- Image bytes/asset storage behaviour (WP3/T005), native image handling, and
  the storage layer (WP1/T002) — the browser suite covers the editor surface
  against preview storage only. Browser results do not prove native
  WebKit/SQLite behaviour.
- The keyboard-only Home/indent edge (T006) and comment selection.
- Screenshot inspection is a human-readable check of Chromium rendering; it
  does not qualify macOS WebKit (shared boundary in every wave).
- Visual observation recorded (not fixed, up for review): the editor figure
  always shows the alt caption below a loaded image; the reading view shows
  alt text only when the image fails to load (`ReadDocument` fallback). If
  one behavior is canonical, reviewers should pick and a follow-up task can
  port it.
- Native print/`src-tauri` work reported broken by an unregistered WP8 edit
  (see DISCOVERIES #17 warning): out of T003 scope; not touched, not counted.

## Scheduled repair: saved image display after project reopen (agent-aa30)

Independent review found a gap the original eight cases did not cover: inserting
an image, returning to Projects, and reopening the same project left a hidden
image with no `src`, although its persisted asset still existed. See the retained
request-changes report `T003_REVIEW.md`. This chat then claimed T003 for the repair;
its earlier independent review cannot approve this new implementation.

The image NodeView previously loaded only at construction or asset-ID changes.
Project resolvers are installed by effects, which can run after NodeView creation.
`src/editor/media.ts` now refreshes live image NodeViews when the resolver changes
and unregisters each NodeView on destruction. Existing request tokens suppress
superseded responses. Blob URL ownership remains with the resolver callers.
There are no App, storage, metadata, native-print or dependency changes in this
repair.

The maintained ninth `tests/assets.spec.ts` case generates a valid synthetic 1x1
PNG, confirms it decodes initially, exits/reopens the project, and reloads the full
page. Each reopened image must retain its asset ID, have a blob source, and decode
to its expected natural width. The pre-fix run fails on the missing source after
normal project reopen; the initial insertion and decode assertions pass. Logs,
configs, source backups and the defect-restore cycle live under
`node_modules/.cache/personal-word-beta/team-t003-repair/`. `baseline-valid.log`
records the meaningful failure and `fixed.log` records the first pass (1/1).
Final qualification results are recorded below after execution.

### Repair qualification commands and results

All commands used pinned Node v22.23.3 and the owned serial-check slot. Browser
runs used a fresh production preview on isolated port 1449, retries 0, one worker.
The explicit local-loopback sandbox permission was granted for each browser run.

- `npm run build` — passed before the first fixed run (`build.log`).
- `npx playwright test -c node_modules/.cache/personal-word-beta/team-t003-repair/baseline.config.mjs tests/assets.spec.ts --grep 'stored image displays' --workers=1`
  — failed on the original source for missing reopened image `src`
  (`baseline-valid.log`, exit 1); initial naturalWidth=1 passed.
- Same targeted invocation with `fixed.config.mjs` — 1 passed, 4.1s
  (`fixed.log`, exit 0).
- Restored the exact original `media-before.ts`, rebuilt successfully, and ran the
  same target with `restored-defect.config.mjs` — failed again on missing reopened
  `src` (`restored-defect.log`, exit 1). The controlled script restored the fixed
  source in `finally`; `cmp` confirmed byte equality with `media-fixed.ts`.
- `npm run build` after restoring the fix — passed, 1981 modules, Vite 8.68s
  (`final-build.log`, exit 0). Only existing chunk/plugin-dialog warnings.
- `npx playwright test -c node_modules/.cache/personal-word-beta/team-t003-repair/final.config.mjs tests/assets.spec.ts --workers=1`
  — **9 passed, 14.7s** (`final-assets.log`, exit 0), including project reopen
  and full-page reload with decoded image bytes. No assertion was weakened.

This reaches evidence rung 5 (tested with a demonstrated failing control) for the
Chromium preview reopen behavior; project readiness remains CLAIMED under the
team plan. Native WebKit/SQLite, long sessions, real-library use and owner real-use
confirmation are not established by these runs. The earlier four editor/reading
light/dark screenshots were actually inspected during the independent review;
this repair does not change layout. T003 requires a different chat to review the
repair, including the full original WP2 implementation. T025's original rejection
report remains an honest historical record, not a current approval.

- `npm test -- --no-file-parallelism --maxWorkers=1` — **44 files / 814 tests
  passed**, 23.19s (`final-units.log`, exit 0). All five recorded final source
  hashes remained unchanged after qualification (`final-source-hashes.json`).
