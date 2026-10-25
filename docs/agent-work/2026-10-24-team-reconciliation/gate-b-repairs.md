# Gate B repairs -- T034, T033, T035, T032 (agent-f22a, Claude Sonnet)

Date: 2026-10-25 | Status of everything below: CLAIMED (automated checks only; Chromium on a production preview, Node units; no WebKit, no native run, no owner real-use). Pinned Node v22.23.3 in every run. Task logs under `node_modules/.cache/personal-word-beta/team-<t>/`. Nothing committed or pushed.

## T034 -- F3: DOCX preview image count and orphan media

Files changed: `src/import/docxImport.ts`, `src/import/richImport.test.ts` (new describe "DOCX image accounting (Gate B F3)", 2 tests, built with JSZip in memory).

What changed in `docxImport.ts`:
- The preview pill now reports `counts.images` (image nodes in the final document), not `assets.length`. A picture shown twice counts 2.
- The media-staging step moved from before the body parse to just after the body element is found, so it can first collect which relationship ids the body's `a:blip` elements actually use (`referencedEmbeds`). Embedded media that no picture uses is no longer read, hashed, staged or returned as an asset; instead the preview warns "Embedded image '<target>' is not used in the document and was not imported."
- The `r:embed` lookup was pulled into one small helper, `blipEmbedId`, shared by the pre-scan and `parseDrawing` (behaviour unchanged).

Fail-first (pre-fix code, `failfirst-vitest.log`): `npx vitest run src/import/richImport.test.ts` -> exit 1, 2 failed / 19 passed. "counts a picture shown twice": `expected 1 to be 2` (`counts.images`). "does not stage embedded media that no drawing references": `expected 2 to be 1` (`counts.images`, i.e. 2 assets staged). `docxImport.ts` before the fix sha256 `6f03db25c07f...` (= the Gate B hash; backup `docxImport.orig.ts.bak` identical). After the fix `02704ec7ae35...`.

Commands after the fix (`team-t034/`):
| Command | Log | Result |
|---|---|---|
| `npx vitest run src/import src/adversarial-wp5.test.ts` | `vitest-after.log` | exit 0, 4 files / 83 tests |
| `npx tsc --noEmit -p .` | `tsc.log` | exit 0 |
| `npm run build` | `build.log` | exit 0 |
| `npx playwright test -c team-t034/browser.config.mjs tests/rich-import.spec.ts --workers=1` (production preview, port 1473) | `browser.log` | exit 0, 5 passed (the existing "1 image" pill case for rich-sample.docx still passes) |

Not covered: the pre-scan looks at every `a:blip`/`blip` in `word/document.xml`, while `parseDrawing` only reads the first blip of drawings in directly parsed positions; a blip in an unparsed spot (text box, `mc:Fallback`) would still be staged and become an orphan asset. Two relationships with identical bytes that are both used still push the same asset twice into `assets` (pre-existing, not changed). Unreferenced media that is also an unsupported format now gets the "not used" warning instead of the "unsupported format" one. No browser case for the unreferenced warning (unit only).

## T033 -- F2: Zotero Connect wording

Done by agent-f22a after agent-4d87 handed the task off (their prepared regression in `tests/zotero.spec.ts`, their proposed patch `team-t033/ResearchPanel-proposed.tsx`, and their notes in `zotero-status.md`; I verified `ResearchPanel.tsx` was byte-identical to their "before" copy, sha256 `608b27c9...`, before applying). `tests/zotero.spec.ts` (sha256 `b3b38413...`) is exactly their edit; I did not change it.

Files changed: `src/research/ResearchPanel.tsx` (sha256 `608b27c9...` -> `6210c3d5...`), `tests/zotero.spec.ts` (agent-4d87's edit).
- "Connect local Zotero" now only enables refresh and shows "Local Zotero refresh enabled -- not yet contacted." (no request is made).
- "Connected to local Zotero -- ..." appears only after a read succeeds: "-- received N item(s).", "-- library is up to date.", "-- no items found.". Errors still show the error text.
- New one-line hint under the section (existing `research-hint` class, so theme variables, sans-serif, flat): "In Zotero, enable the local API in Settings > Advanced before refreshing." The exact Zotero menu label is unverified (no real Zotero was used by rule).
- Tests: the mocked-refresh case now asserts the not-yet-contacted text and zero requests after Connect, then "Connected to local Zotero -- received 1 item." only after the mocked read; a new case "Zotero local refresh explains the required desktop setting" asserts the hint.

Fail-first (original source, dist built from it; `failfirst-browser.log`): `npx playwright test -c team-t033/baseline.config.mjs tests/zotero.spec.ts --workers=1` (port 1474) -> exit 1, 3 passed / 2 failed: "localhost refresh operates offline..." `Expected: "Local Zotero refresh enabled -- not yet contacted." Received: "Connected to local Zotero (127.0.0.1:23119)"`, and "explains the required desktop setting" (hint element not found).

After the fix (`team-t033/`):
| Command | Log | Result |
|---|---|---|
| `npx vitest run src/research` | `vitest-research.log` | exit 0, 11 files / 195 tests |
| `npx tsc --noEmit -p .` | `tsc.log` | exit 2, but every error is in the off-board `src/print/nativePdf.test.ts` (missing `buildProbeFixtures` export, implicit any); no error in any file this task touches |
| `npm run build` | `build.log` | exit 1: its `tsc -b` stage hit the same off-board file (also reported by agent-6029, message 84) |
| `npx vite build` (bundle only) | `vite-build.log` | exit 0; new string present in `dist` |
| `npx playwright test -c team-t033/final.config.mjs tests/zotero.spec.ts tests/research.spec.ts --workers=1` (production preview, port 1474) | `browser-after.log` | exit 0, 14 passed (zotero 5, research 9) |

Not covered: a doctored-source restore cycle (the baseline run against the unmodified source serves as the failing control; the source file was restored by copy from the proposed file, hashes above); Chromium only; native `zotero_read` path and a real Zotero untested; the Zotero setting label in the hint is from the previous author's draft and unverified; the full `npm run build` is red for a reason outside this task (so the `dist` used here is from `vite build` only).

## T035 -- F4: maintained test for external DOCX relationships

Files changed: `tests/rich-import.spec.ts`, new fixture `tests/fixtures/rich-import/external-image.docx` (2 446 bytes, sha256 `d80fdcd76ba4...`; built from `rich-sample.docx` by `node_modules/.cache/personal-word-beta/team-t035/make-external-image.mjs`: the picture relationship becomes `TargetMode="External"` `https://example.invalid/remote.png`, the embedded PNG is removed, and an External hyperlink run ("External link text" -> `https://example.com`) is added; this is the Gate B probe P2 input).

What changed in the spec:
- Title at old line 34 now reads "...in Chromium (production preview)" (no more "WebKit/Chromium").
- New case "DOCX with an External image relationship warns, makes no off-origin request, and keeps the remote URL out of the editor": import through `#import-writing-text`; the preview warning contains "External image reference (https://example.invalid/remote.png) was omitted"; no image pill; after 1.5 s zero off-origin requests; confirm Import; the editor shows "Sample Heading 1"; after 1.5 s still zero off-origin requests, editor HTML has no `example.invalid`, zero `figure.doc-image`, and the external hyperlink is kept as a link to `https://example.com` (never requested).
- New liveness case (port of probe P3): an in-page `fetch("https://example.invalid/leak.png")` is counted by the same off-origin watcher.
- Own mistake, fixed before the passing run: my first draft asserted zero `<img>` in the editor; it failed (`Expected 0, Received 1`, `browser-run1-fail.log`) because ProseMirror adds an empty `img.ProseMirror-separator` placeholder (the same thing Gate B P1 found). The assertion now counts `figure.doc-image`.

Fail-first (no product code was changed for T035, so the control is a doctored copy of the case): `team-t035/doctored/inverted.spec.mjs` has five variants, each with exactly one assertion inverted (warning absent, requests present during preview, requests present after confirm, `example.invalid` present in the editor, link href not `https://example.com`). Result (`doctored.log`): exit 1, 5 failed / 0 passed, each on the inverted assertion itself (e.g. `Expected: not []`, `Expected pattern: /example\.invalid/`, `Expected: not "https://example.com"`), so each real assertion discriminates and the watcher/warning/link all exist. The doctored copy lives only under the task folder; `tests/rich-import.spec.ts` was not doctored. sha256 of the spec before my edits `aa1c053ef79f...`; final `7ff713931d17...`.

Commands (`team-t035/`): `npx playwright test -c team-t035/browser.config.mjs tests/rich-import.spec.ts --workers=1` on a production preview (port 1474; dist from the T034 build, no product source changed since) -> `browser.log` exit 0, 7 passed (5 existing + 2 new). First run `browser-run1-fail.log`: 6 passed / 1 failed (the `<img>` assertion above).

Not covered: Chromium only (no WebKit); the same input through the browser path only (no native Tauri run); the hyperlink `href` assertion pins the current behaviour (external links are kept as link marks); no unit-level duplicate in `richImport.test.ts` (not registered to this task).

## T032 -- F1 repair after rejection (agent-2d3e, Claude Sonnet)

Reviewer agent-12aa rejected the maintained test, not the product change: a build whose `cancelImport` skipped `importAbort.current?.abort()` still passed `tests/import-cancel.spec.ts`, because the spec reloaded before the slowed read finished. Only `tests/import-cancel.spec.ts` changed (src/App.tsx and src/import/ImportPreview.tsx are byte-identical before/after: `team-t032-fix/sha-before.txt`, `sha-after.txt`).

What changed in the spec:
- Case 1 (cancel during the slowed read): the patched `File.arrayBuffer` sets `window.__readDone` when the delayed read resolves. After Cancel the test waits for that marker, yields the page 1.5 s (`settle`), and asserts BEFORE any reload that no "Import writing" dialog (and no dialog at all) exists and the project row count is unchanged. Existing reload assertions kept.
- Case 2 (new, cancel while `previewWriting` is running): a `.zip` import makes `previewWriting` dynamically import the markdown-bundle parser chunk. A Playwright route holds `markdownBundle-*.js` until released; the test awaits the "requested" promise (so the import is inside `previewWriting`), clicks "Cancel import", releases the chunk, awaits the route's delivered promise, settles, and asserts no preview dialog and no new project, before and after a reload.
- Control case unchanged.

Honest limit: there is no positive "parse finished" marker in the UI, so after the deterministic trigger (read resolved / chunk delivered) there is a fixed 1.5 s settle. The trigger itself is deterministic; only the "late enough" part is a bounded wait.

Fail-first (doctored copies of the current App.tsx substituted by a vite config; real source untouched; `team-t032-fix/mut/`, `vite-*.config.mjs`):
| Build | Log | Result |
|---|---|---|
| real (`npm run build`, port 1477) | `pw-real.log` | 3 passed |
| no-abort (`cancelImport` skips `abort()`) | `pw-noabort.log` | 2 failed (case 1 and case 2: "Import writing" dialog Expected 0, Received 1), control passed |
| no-signal (`previewWriting(buffer, file.name)`) | `pw-nosignal.log` | 3 passed -- NOT caught |

Why no-signal is not caught: `importWriting` re-checks `controller.signal.aborted` after `previewWriting` returns, so a parse that ignores the signal only wastes CPU and its result is discarded; nothing in the UI differs. The signal-forwarding itself is covered by the existing unit test "aborts parsing when AbortSignal is triggered" (not by Playwright).

Other runs: `npx tsc --noEmit -p .` exit 0 (`tsc.log`); `npm run build` exit 0 (`build.log`); Playwright import-cancel + import + rich-import + markdown-roundtrip on the real build: 23 passed (`pw-related.log`). `npm test` not rerun (no product change). Not done: abort on unmount/navigation away (optional item 4; Cancel/Escape only); Chromium only.
