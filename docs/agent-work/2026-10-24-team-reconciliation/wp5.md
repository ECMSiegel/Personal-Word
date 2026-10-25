# WP5 -- rich-import security and browser acceptance (team task T008)

Date: 2026-10-25 (02:50-03:15 UTC) | Agent: agent-6029 (OpenCode) | Status: submitted for review, CLAIMED.

## Scope

I2 acceptance per team/PLAN.md + 03-imports/PLAN.md: DOCX/HTML import content,
limits, security, no-worker/DOMParser deviations, cancellation, and executed
production-preview browser acceptance. No product code was changed by T008; the
only source edit is the registered harness file `tests/rich-import.spec.ts`.

## What was already there (inspected, not rebuilt)

- `src/import/importLimits.ts` pre-inflation defenses (compression ratio,
  entry count/size, path traversal, encryption detection, max bytes),
  `src/import/docxImport.ts` + `previewWriting` App entry, `htmlImport.ts`
  DOMParser-based inert import, `ImportPreview.tsx` modal, connected in
  `src/App.tsx` (`importWriting`/`confirmImport`) and
  `src/components/ProjectLibrary.tsx` (`#import-writing-text` input).
- Units: `src/import/richImport.test.ts` (all four security fixtures:
  encrypted / path-traversal / zip-bomb.docx rejected before inflation;
  unsupported-image warning), `src/adversarial-wp5.test.ts` (active-content
  stripping, on* handlers, remote-image omission, DOM depth/size limits).
- Prior evidence (orchestrator_3/Gate B) was unit-only; its "12 discovered
  browser scenarios" were `--list` output (T001 REPORT.md #16), so no runtime
  browser pass existed before this task.

## Commands and results (pinned Node v22.23.3, serial slot held)

| Log | Command | Result |
|---|---|---|
| `team-t008/tsc.log` | `npx tsc --noEmit -p .` | exit 0 |
| `team-t008/units.log` | `npx vitest run src/import src/adversarial-wp5.test.ts` | exit 0, 79/79 (4 files) |
| `tsc2.log` | tsc after the spec rewrite | exit 0 |
| `browser-pass1.log` | `npx playwright test -c team-t008/browser.config.mjs tests/rich-import.spec.ts` (production preview, port 1459) | **exit 1 -- 4 of 5 failed (fail-first)** |
| `browser-pass2.log` | same after the UI-path rewrite | exit 1, 4 failed (chooser harness error, label intercepts click) |
| `browser-pass3.log` | same after setInputFiles | exit 1, 1 failed (case-sensitive warning text) |
| `browser-pass4.log` | doubled | exit 1, 2 failed (second capitalization) |
| `browser-pass5.log` | same config, `--repeat-each=2` | **exit 0, 10/10 passed (7.5s)** |
| `control.log` | `team-t008/control/liveness.config.mjs` | exit 0 -- the page request listener provably counts an in-page request to `example.invalid` (so case 3's zero-request assertion is live) |

## Why the original spec could run only under a dev server (fail-first record)

`tests/rich-import.spec.ts` cases 2-5 imported the importers directly inside
`page.evaluate(import("/src/import/docxImport.ts"))`. Those URLs exist only in a
dev server: the production `vite build` bundles and hashes the modules
(`dist/` has no `/src` tree; verified). Pass 1 recorded the real failure:
all 4 non-accept-attribute cases died in ~0.5 s at the dynamic import (module
404), i.e. the prior Gate B "browser evidence" could never have executed on a
production preview. This was a harness gap, not a product violation.

## Repair (tests/rich-import.spec.ts only)

Cases now drive the app's actual bundled path end to end:
`ProjectLibrary` file input (`setInputFiles` on the hidden
`#import-writing-text` -- its `<label>` intercepts raw clicks, and Playwright
filechooser events need a native dialog) -> App `importWriting` ->
`previewWriting` in the production bundle -> `ImportPreview` modal ->
`Cancel` path. Expectations are equivalent or stronger than before:

- DOCX: modal visible, filename/format line, count pills (1 table / 1 image /
  1 note), preview text contains "Bold" and "Sample Heading 1".
- Malicious HTML: **zero network requests to `example.invalid`** via a real
  page-listener counter (liveness proven by the doctored control that makes
  one such request and observes the counter reach 1), `window.__pwned`
  undefined (no script execution), warnings list shows "Active content …"
  and "Remote image …", safe paragraph text survives.
- Pills case: same modal, all four pill families asserted.
- Cancellation safety: encrypted.docx -> `.error-banner` visible, NO import
  modal, project-row count unchanged (two stable observations); plus the
  previously-untested aborted half -- a valid import Cancelled from the modal
  creates no project row. Two flaky-text fixes (case-sensitive `toContainText`)
  recorded honestly in pass3/pass4.
- Repeatability: final run doubled with `--repeat-each=2` → 10/10, no sleeps.

## Boundaries

- Chromium-only browser evidence; no WebKit run in this task (shared team
  boundary; the suite is configured headless Chromium).
- Bundle-level `page.evaluate` can no longer reach importer internals from
  the page; file-chooser native dialog automation needs `setInputFiles`.
 Unit-level `AbortSignal` cancellation coverage exists (`richImport.test.ts`
 "aborts parsing when AbortSignal is triggered"); the UI path exposes only
 Cancel-before-confirm, which is what the browser case now asserts.
- `window.__pwned` as a script-execution tripwire is defined only if
  malicious fixture script executes; its undefined-ness is asserted in
  every run (weak battery for anything other than the briefed fixture —
  noted for reviewers).
- Hosted CI remains unavailable without owner authorization; nothing
  dispatched or pushed. No new packages; no commits.
