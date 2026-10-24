# IMPLEMENTATION LOG — Reliable checks and installable Mac downloads

Plan: `docs/agent-work/2026-10-20-beta-roadmap/01-downloads/PLAN.md` | Implementer: Codex | Base: `2bb181bebb567b7dc35f66332ea905b5feab9262` | Started: 2026-10-20

## Status

| Task | Status | Evidence |
|---|---|---|
| R1 — Reproduce and repair hosted indentation failure | IN PROGRESS | Local 70-case repeat and independent 7-unit/7-browser review pass; hosted split-job qualification remains pending |
| R2 — Build a complete distributable candidate | IN PROGRESS | Packaging helper, root configuration/version/workflow changes exist; builds, source archive, and legal/source gates remain pending |
| R3 — Sign, qualify installation, and prepare publication | BLOCKED | Coordinator reports no Developer account and Intel qualification host; local preparation only |

## R1 — Reproduce and repair the hosted indentation failure

- **Files changed:** `src/editor/indent.ts`, `src/editor/indent.test.ts`, `tests/editor-toolbar.spec.ts`, new `tests/ci-indent.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.
- **Local environment captured:** baseline source `2bb181bebb567b7dc35f66332ea905b5feab9262`; macOS 15.7.9, x86_64; pinned Node v22.23.3; Playwright 1.64.1. The working package version during the final local browser attempts was 0.1.1. Chromium's binary version and the prior hosted job environments were not captured. Hosted run IDs referenced by the planning record could not be queried from this environment; no hosted dispatch or push was performed.
- **Fail-first evidence:** baseline unit tests passed 3/3. The original browser setup failed against the exact `/text-indent/` assertion with `margin-left: 0.5in`; the baseline repeat10 run yielded 9 pass and 1 fail. See `node_modules/.cache/personal-word-beta/r1/baseline-tab-browser-permissioned.log` and `diagnostic-root-repeat10.log`.
- **Restored baseline evidence:** an isolated copy made from the baseline commit retained the original production helper and DOM-only Home polling setup. Its original `/text-indent/` assertion failed on repetition 9/10. At the failing keydown the DOM anchor and ProseMirror `parentOffset` were both 19, and the result was `margin-left: 0.5in`. The preceding Home poll had observed DOM `anchorOffset=0`; that observation did not guarantee the selection used by Tab. See `node_modules/.cache/personal-word-beta/r1/isolated-old-setup-repeat10-node22.log`.
- **Cause and correction:** the mismatch was test readiness, not a demonstrated product behavior defect. The old test repeatedly sent Home and treated a transient DOM offset as proof of ProseMirror's command position. The toolbar browser test now types actual text, sends Home once, and asserts exact first-line indent plus Shift+Tab reset. Separate deterministic unit cases use explicit ProseMirror selections at paragraph start, inside a paragraph, and with inherited indentation. `indentTextSelection` extracts the existing selection decision into a command for direct unit coverage; the original command behavior is preserved. No `src/Writer.tsx` change or temporary instrumentation remains.
- **Coverage added/preserved:** Blank and Chicago indentation assert distinct `firstLineIndent`/`indentLeft` rendering, undo/redo, a SaveQueue `pending` → `saved` acknowledgment, and reload. The Chicago test reopens its existing project tab after reload before selecting Introduction. Screenplay Tab cycling and the existing nested-list behavior remain covered. No sleeps, retries, accept-either selection assertions, or weakened style assertions were added.
- **CI changes:** frontend and Rust checks run as separate jobs; browser checks use one worker, zero retries, trace-on-failure, and `reuseExistingServer: false`. Existing pinned action references and least-privilege contents-read permissions are retained. No workflow was dispatched.
- **Unit validation:** `npm test -- src/editor/indent.test.ts` — exit 0, 7/7 tests (`indent-unit-final.log`).
- **Focused browser validation:** actual Home/Tab — exit 0, 1/1 (`home-focused-final.log`); Screenplay Tab — 1/1 (`screenplay-home-focused.log`); Chicago before save-ack/reload additions — exit 0, 1/1 (`chicago-focused.log`). Blank with the SaveQueue acknowledgment — test passed, 35.2 seconds, in the first run of the subsequent repeat command.
- **Reload/ack follow-up:** the first acknowledged Chicago run confirmed content, undo, and redo each reached pending → saved, then exposed that reload opens the Projects library with the project tab still open. The test was updated to click that tab and verify Introduction is visible. The corrected focused Chicago case emitted a pass at 1.2 minutes; its runner was interrupted during teardown (exit 130), so a clean command summary is absent. Logs: `indent-browser-repeat10-ack-reload-fail.log` and `chicago-ack-reload-focused.log`.
- **Repeat10 status:** the exact plan command was started twice. The first run (before the post-reload tab correction) reached 14/70 passing tests before stopping. The second run passed Blank, then the Chicago reload locator timed out; it was stopped to avoid repeating that known failure. Those partial logs are `indent-browser-repeat10-pre-ack.log` and `indent-browser-repeat10-ack-reload-fail.log`. The final repeat10 was not run: the coordinator reported host load averages of 806.57/579.74/334.88 and directed that further repeat runs stop pending process diagnosis. A green repeat10 result is not claimed.
- **Hosted jobs:** pending. R1 is not complete until the corrected revision has distinct green frontend/browser and Rust hosted jobs. Hosted execution, push, and dispatch were not authorized.
- **Deviations:** corrected test setup after evidence showed ProseMirror's existing behavior matched the selection. Final repeat10 is pending due severe host load; no product-fix claim is made.

## BLOCKED — questions for the architect or user

No new product decision is needed for R1. The remaining R1 evidence requires a stable host for the final repeat10 and a hosted workflow run after an authorized commit/push.

## Final validation

Pending exact repeat10, hosted green jobs, and the broader downstream release qualification. No full build, native test suite, or hosted workflow was run as part of R1.

## Repair rounds

1. Reproduced the original setup failure; logged DOM and ProseMirror positions; isolated the baseline setup and recorded the 1/10 failure.
2. Replaced polling with one real Home key and added deterministic ProseMirror command tests. Focused Home, Screenplay, Chicago, and unit tests passed.
3. Added explicit SaveQueue acknowledgment checks. The repeat run found and corrected the post-reload project-tab activation assumption. Corrected Chicago passed at test level; final repeat10 awaits stable host load.

## Integrated full-suite follow-up
The coordinator's current integrated build and 189 unit tests passed. Full Chromium finished **52 passed, 2 failed (4.6m)**, exit1. Both new `ci-indent.spec.ts` tests fail before the watched edit: `Expected the project to be saved before the edit.` at call sites line64 (Blank) and line100 (Chicago), from `watchForSavedWrite`. Original toolbar tests passed. This is unresolved save-readiness setup evidence, not a diagnosed product defect. Full log: ignored `node_modules/.cache/personal-word-beta/e1/browser-full.log`; traces remain under `test-results/`. Investigate these exact failures before the planned repeated/hosted qualification. No further runs were launched; R1 remains incomplete.

## October 22 resume -- save-acknowledgment repair (in progress)

- Owner resumed beta implementation; base remains `2bb181b`, existing beta changes preserved. Native WebView/profile hold, no binary publication, and no package installation remain in force.
- Preserved both October 20 indent failure traces and contexts under ignored `node_modules/.cache/personal-word-beta/r1/resume-20261022/` before running Playwright.
- Read the complete prior full-suite log and extracted trace events. Blank watcher `bngs@765` completed at 43118.857ms, before Home at 45813.417ms and Tab at 45855.348ms; undo watcher started at 45957.159ms while the final transaction was pending. The observer acknowledged an intermediate typing save. Observer installation was also not awaited before input.
- Fresh original-source reproduction: `npm run test:e2e -- tests/ci-indent.spec.ts --workers=1`, Node22.23.3, exit1: **1 failed, 2 passed (18.9s)**. Blank failed the identical save-readiness precondition at line64. Full output: `resume-20261022/baseline-permissioned.log`. The initial sandbox attempt failed to bind localhost (`EPERM`); permissioned run executed the actual tests.
- Repair limited to `tests/ci-indent.spec.ts`: `savedEdit` awaits observer installation, runs the complete action, then requires an observed pending state, current saved state, and cleared recovery-header keys. Each content/undo/redo action is serialized through this helper. All style, focus, undo/redo and reload assertions remain; no sleeps or retries added. Production SaveQueue behavior unchanged.
- Planned 70-case repeat run started serially; no result claimed yet. Host load at initial inspection: 40.17/88.03/70.06, so quiet-host performance qualification is not implied.
- First watcher-repaired repeat was stopped after **4passed/1failed/1interrupted/64notrun** (exit130) when `editor-toolbar.spec.ts` reproduced the original `margin-left: 0.5in` instead of first-line indent. The list test was interrupted, not diagnosed as a product failure. Traces preserved at `resume-20261022/repeat10-results/`.
- The existing isolated original setup log (`isolated-old-setup-repeat10-node22.log`) already records DOM0 before Tab with actual PM parentOffset19 at Tab. New browser tests now send Home exactly once and explicitly require DOM0 **and** Tiptap PM empty-selection parentOffset0 before sending Tab. No production selection command or repeated Home is injected; original indent expectations retained.
- An additional cached instrumented browser copy passed10/10 (`selection-diagnostic-js.log`), but its event attachments were empty: the listener referenced the wrong internal view property. This is NOT valid additional selection-diagnostic evidence and is not used for root-cause claims. The first cached TS attempt failed because Node cannot strip types inside node_modules; the transpiled copy ran. Current source uses the actual Tiptap `element.editor` property for its readiness assertion.
- Fresh exact70case repeat with both readiness corrections running at `resume-20261022/repeat10-pm.log`; final result pending.

- Final October22 R1 plan command completed exit0: **70passed (4.1m)**, no retries. Independent Luna reran `npm test -- src/editor/indent.test.ts` (7passed) and focused7browser cases (7passed19.0s), read all output, and found no source implementation defect. Review remains CHANGES REQUIRED for the unrun hosted split jobs; not a release approval. See `01-downloads/REVIEW.md` and ignored `review-indent-unit.log` / `review-indent-browser.log`.

### October22 actual-paragraph local qualification
Root observed recentfocusDOMrecovery resetting Home without editortransaction; separate root-surfaceclick variant stillfailed. Actualparagraphclick beforetyping retainsrealHome andDOM+PM0assertions; Blank/Chicago/Screenplay/comments/quotecases50/50passed, toolbarTab10/10passed. Finalproductionfull65/65passed1.5m afterseparategoalUTCloadrepair. Noindentproductionsemanticschange, retry/sleep/selectioninjectionorassertionloosening. Pointer-text path scope; keyboard-onlyrecentfocus/nativeWebKit unqualified. Freshindependentreviewcommandleaseactive; hosted split CI stillunrun, R1notrelease-complete. Details/evidence under02-editing/IMPLEMENTATION_LOG andignoredbeta/e2/integration.
