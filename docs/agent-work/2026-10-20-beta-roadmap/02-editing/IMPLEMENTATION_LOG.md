# IMPLEMENTATION LOG -- Editing and annotations
Plan: PLAN.md | Integrator: Codex with Luna helper | Base: 2bb181bebb567b7dc35f66332ea905b5feab9262 | Started: 2026-10-20

## Status
| Task | Status | Evidence |
|---|---|---|
| E1 | IN PROGRESS | Exact browser regressions captured; helper and App/Writer/model integration under construction |
| E2 | IN PROGRESS | Incremental index, goal preferences and asynchronous issue worker/panel implemented; integration and performance qualification pending |
| E3 | IN PROGRESS | Guarded block restore/word diff and safety-snapshot verification implemented for existing schema; browser/native acceptance pending |

## E1 fail-first and implementation
Owner's native WebView hold remains in force; these are Chromium and unit checks only. Test setup uses actual keyboard selection and explicit focus, avoiding the R1 transient DOM/PM race. Root selected the concrete reattach route: comment card -> manuscript -> select passage -> Attach/Cancel -> Comments.

`npm test -- src/editor/commentAnchors.test.ts` initially exited1 because the new helper module was absent; this establishes missing implementation only, not a reproduced behavior. Full ignored log beta/e1/baseline-unit.log.

`npm run test:e2e -- tests/comments.spec.ts --workers=1` first exited1 on an unrequired auto-focus assertion and quote paragraph count. Test setup/assert ordering refined before production changes. The same exact command then exited1 on the intended bugs (beta/e1/baseline-browser-targeted.log):
```
2 failed
comment anchors retain the second duplicate...
Expected: 13
Received: 4
multi-paragraph captured quote keeps the citation...
Expected: 1
Received: 0
```
The second assertion counts footnote references inside the blockquote. Both baseline failures precede any E1 production helper/wiring changes.

Luna implemented pure anchor/range/migration/quote and mutation-boundary helpers and CommentsPanel; root owns additive model fields/validation and App/Writer integration. Existing 100-word block quote threshold retained; long quotations split paragraphs and put the note in the final one. Metadata-only changes preserve entry content revisions; unmapped direct content edits conservatively detach anchors. Quote note metadata joins its content transaction in one project mutation.

Initial helper review added actual regression cases before repairs. Exact `npm test -- src/editor/commentAnchors.test.ts src/organization/operations.test.ts` exited1 (beta/e1/helper-first-unit.log):
```
Test Files 1 failed | 1 passed (2)
Tests 3 failed | 17 passed (20)
```
Failures: unique legacy cross-paragraph migration, same-text replacement revision/detach, and exact transaction anchor mapping. The third exposed ProseMirror schema identity: separately constructed schemas make Node.eq reject structurally equal transaction documents. Luna is repairing and retesting against the actual transaction schema. No helper acceptance claim yet.

## Acceptance / remaining work
Pending helper repaired unit/negative controls, full TypeScript build, browser regression/research cases, restored-defect controls, screenshots/artifact checks, independent review, and separate native D2 metadata routes. No E1 DONE/real-use claim. E2/E3 untouched. No commit/push.

## Current integration checkpoint
Helper's initial three failures and review context/unchanged-parse failures were repaired after capture; isolated copies reintroduced each defect and failed its specific regression. Current full unit suite includes the final wrong-context-before-map case. Entry and annotation metadata remain additive. Source-only scoped SQLite test now carries actual anchor/contentRevision plus unknown fields through current/history/mirror/reopen (no generated safety-copy/UI claim).

Actual commands/output inspected by integrator:
```
npm run build
  tsc -b && vite build
  built in 45.54s (Vite phase; whole command slower under host load)
npm test
  Test Files 18 passed (18)
  Tests 189 passed (189)
npm run test:e2e -- tests/comments.spec.ts tests/research.spec.ts --workers=1
  9 passed (1.6m)
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 sparse_metadata_survives_history_mirrors_and_restart -- --test-threads=1
  1 passed; 0 failed; 21 filtered out
```
First full build failed two R1 command-context type errors; repaired with a narrow state/tr/dispatch contract without runtime behavior changes. First D1 added max-wait test failed because its idle debounce correctly saved at250ms; test now models continued200ms enqueues, preserving2000ms max-wait and production SaveQueue unchanged. D1 focused26pass and native-smoke compile-only passed; no WebView launch.

Full Chromium completed once: **52 passed, 2 failed (4.6m)**, exit1; output beta/e1/browser-full.log. Both failures are the R1 Blank/Chicago `watchForSavedWrite` precondition (`Expected the project to be saved before the edit.`); all E1 comment/research cases passed. Root cause remains unresolved. R1 repeat70 and hosted jobs remain pending. Light/dark screenshots, exported artifacts, native WebView/owner checks and remaining D2 paths are unqualified. Native hold explicitly remains; no current app bundle/tag/download/push. Independent REVIEW.md now records a qualified local E1 checkpoint with no remaining source finding in that scope, not overall acceptance. E1 stays IN PROGRESS and whole roadmap remains partial. No expensive command remains active; beta work is uncommitted pending repair of the red full-suite qualification.

## October 22 -- resumed E2/E3 preparation

- Owner authorized beta continuation and explicitly approved necessary E2 Writer.tsx wiring (omitted from E2's original file list). No other plan scope expansion is assumed. Root owns App/model/goals/index; Luna prose owns Writer, writingAids/proseCheck, worker/panel and writing-aids browser tests; separate Luna diff owns revisionDiff/comparison/css and revision tests. Independent R1 reviewer owns only downloads REVIEW.md. Heavy test/build lease remains serial under root.
- E2 index/goals fail-first: Node22.23.3 `npm test -- src/derived/projectIndex.test.ts src/goals.test.ts`, exit1: **3failed/8passed**. Failures expose rescanning unchanged entries, recounting unchanged text on formatting, and ignored explicit manuscript-and-fragments goal scope. Naive uncached reference implementation saved under ignored `r1/resume-20261022/projectIndex-baseline.ts`; original goals implementation remains in Git and working file until browser frozen run finishes. Actual log: `r1/resume-20261022/e2-baseline.log`.
- Cache now keys content traversal by immutable content identity and word count by entry ID plus exact text; deletion/kind/order paths covered by tests. Not yet integrated into App or accepted. Prose browser baseline and E3 controls await the serial command lease.


### E2/E3 source checkpoint (October 22; supersedes earlier pending labels)

- Root index/goals initial positive: `npm test -- src/derived/projectIndex.test.ts src/goals.test.ts` **15passed**, exit0 (`e2-index-goals-fixed.log`). Controlled restoration of uncached traversal and ignored scope: **5failed/10passed**, exit1 (`e2-index-goals-restored-defect.log`), including exact scan/count/scope/order identity assertions. Restoring fixes: **15passed**, exit0 (`e2-index-goals-final.log`). A later enum-validation test is added and awaits the next run; totals above are dated results, not current final totals.
- App consumes immutable per-entry summaries for manuscript/all word totals and stable reference order, memoizing footnote numbering/forms. Goals add optional manuscript-and-fragments and UTC modes; old manuscript/local keys retained. Profile changes and time-zone/day changes create explicit fresh baselines; midnight/focus plus a bounded minute clock refresh handle clock changes. Browser coverage authored for toggle-back, reload, zone change, and real 100k/60section/1000note paired200edit workloads (ordinary and pathological active10k-word paragraph); none accepted before running.
- New complete prose-index/rule-control browser baseline: `npm run test:e2e -- tests/writing-aids.spec.ts --grep 'issue index|prose rules' --workers=1`, **2failed**, exit1, both expected missing feature assertions (`e2/prose/baseline-browser.log`). Main-thread decorations are bounded while worker holds the complete result index; reply identity/doc guards, mapped block changes and one-in-flight/latest-pending queue are under integration review. Initial focused20unit tests passed before later edge-case repairs; not final source qualification.
- E3 `npm test -- src/organization/revisionDiff.test.ts src/organization/operations.test.ts`: **13passed**, exit0 (`e3/unit-final2.log`). Wrong historical-index mutant fails aligned-live-target assertion; removed revision guard fails stale-project assertion; same-length content mutant fails content-guard assertion. Full outputs read by root. The first content mutant failed indirectly on range validity and was replaced with the same-length direct assertion; only corrected control is counted. Subsequent total-bounds/selected-passage UI edits will require rerun.
- Root App restore captures current project state, validates proposed restore, flushes, creates a safety snapshot, reopens and canonical-compares all saved metadata/prose, rechecks current state after awaits, then mutates and flushes. Guarded paragraph patches use actual current PM positions and exact revision/content token; whole-section fallback preserves current annotations and merges missing historical sources/footnotes. E1 handles the resulting contentRevision/detachment once. Unsupported assets remain unimplemented, not silently stripped.
- First integrated `npm run build` failed3TypeScript errors limited to prose test Fragment construction and nullable worker. Log `e2/integration/build-first.log`. Worker author repairing these; no passing integrated build claimed yet. No native WebView/profile creation, app bundle build, push, tag or publication performed.

### October 22 production qualification and repair

- Final pre-caret-repair `npm run build` passed (Vite6.79s), full `npm test` **223passed/20files** exit0. Source/test/config freeze map111paths saved `e2/integration/first-code-manifest.json` (scoped compiled code/tests/config, not a release-source completeness manifest).
- Full Chromium **production preview** command with `e2/integration/production.config.mjs`: **60passed/3failed (1.7m)**, exit1. No retries. Complete log/report preserved as `browser-production-full.log` / `first-browser-production-report.json`; first failure traces retained under `browser-production-results/`. Failures: Chicago Home stayed DOM+PMoffset31; comment reattachment selected `w E` rather than `Echo`; oversized comparison readonly-field test matched both excerpt aria-label and textarea. Last is locator ambiguity; label matching made exact without changing readonly/value assertions.
- Both production paired200edit workloads passed strict25msmedian/50msp95 input-to-editor-update budgets. Actual fixture100000words/60sections/1000notes, active10000words: ordinary aids-off median2.6ms/p953.5ms, on2.5/3.0ms; single repeated-word paragraph off4.8/5.6ms, on4.6/6.0ms. Worker completion checked separately by visible live annotations before on-sampling. Host x86_64/macOS15.7.9/8logicalCPUs, initial load2.65/7.53/27.40. These are bounded Chromium input measurements, not native or all-paragraph-size guarantees; current final source rerun pending.
- Production selection failures exposed E2's redundant `item.contentRevision` refresh effect in Writer. Each typing transaction advanced the model revision, then a React effect dispatched metadata using the old PM selection, potentially overwriting browser Home/selection changes before selectionchange was consumed. Removed that dependency; a separate analysis-context ref increments once synchronously before onEdit and reconciles monotonically with props. Never mutate the immutable Entry object. Pre-fix Writer and complete pre-fix compiled dist retained for controlled regression restoration.
- After caret repair, build again passed and full223unit tests passed. Same two exact production keyboard cases repeated5each: **10passed (41.8s)** (`caret-focused-fixed.log`). The old compiled preview restoration control is running separately; production source is not being overwritten to serve that control.
- Additional independent-review repairs: accumulated dirty block IDs are pruned to live blocks (real inserted/deleted-before-send PM regression failed/fixed/restored/finalpass); dedupe uses exact kind/from/to Set preserving all9999repeat ranges in a10000-token fixture (collapsed-key mutant fails). Focused prose suites **27passed** after repairs. Large-quote-span algorithmic behavior is not covered by the supplied typing fixtures; no universal latency guarantee.
- E3 total serialized-size and text-size bounds precede precomputed-fingerprint alignment. Oversized comparison uses bounded grapheme-safe excerpts with read-only source fields and cancel; naive UTF16slice fails emoji-boundary test, fixed and restored/final cycle recorded. Final focused E3 helper+operations **15passed** (`e3/unit-unicode-final.log`). E3 four browser cases passed before Unicode follow-up; later full production run passed restore/ambiguous/safety cases and found only the corrected readonly locator.
- Actual light/dark region PNGs reviewed. Diff dialog legible with marked changed words and safe-restore controls. Prose panel total/rule summary clipped at420px; author scoped wrapping and added exact rows-shown/total; fresh post-repair images await rerun. No native WebView/UUIDprofile/appbundle/signing/publication work performed.
- Restored pre-ref-fix compiled preview control completed **8passed/2failed (42.3s)** with the same comment reattachment selected-text assertion (`caret-restored-defect.log`). This proves the runtime check detects a regression in that retained build, not that all keyboard races were resolved.
- Second full production run after revision-ref fix: **61passed/2failed (2.0m)**. The remaining comment reattachment selected `w` instead of `Echo`; no final keyboard acceptance claimed. The readonly-field exact getByLabel test still failed, although the accessibility snapshot exposes textboxes named Snapshot passage/Current passage. Explicit aria-labels now align those names without changing expected readonly/value checks; next build pending.
- Root inspected actual Tiptap `useEditor.ts` compareOptions/onRender. Inline extension instances, changing content object and recreated editorProps force setOptions/view updates on selection renders. Prose author is stabilizing these option identities using immutable initial content and current callback/settings/editor refs; the existing actual-keyboard checks remain unchanged. This is an in-progress production-selection repair, not a test retry/sleep change.
- Added goal scope/dayMode/unknown nested goal metadata to the existing sparse native Rust metadata fixture; full Rust test command awaits the serial heavy lease. No native app/WebView launch is planned.

### Owner scope approval and stable editor options (October 22)
Owner explicitly answered **“Yes, include the Writer.tsx wiring”** to the E2 file-list omission. This authorizes the required issue-panel/worker wiring and its editor integration; no plan header or other scope was silently changed.

The remaining comment-selection failure after removing per-edit refresh was traced to recreated Tiptap options: installed `@tiptap/react` compares extension, editorProps and content identities, and `Editor.setOptions` updates the view. Writer now holds initial content, extension instances and editorProps stable for its keyed mount, reading dynamic callbacks/settings from refs. Existing same-entry content replacement paths increment `editorEpoch`; ordinary selection and input do not remount. Independent static review found no stale-closure regression.

Commands with pinned approved Node22, serialized:
```
npm run build > beta/e2/integration/build-options-fix.log
# exit 0
npm test > beta/e2/integration/unit-options-fix.log
Test Files  20 passed (20)
Tests  223 passed (223)
```
Full paths use ignored `node_modules/.cache/personal-word-beta/`, abbreviated above as `beta/`. Focused production keyboard repeat is currently running; no final browser/latency acceptance claimed. Host load rose to195.02/109.30/60.95 on eight logical CPUs, then228.53/126.02/68.71; this cannot establish quiet-machine timing. Native WebView/profile creation remains owner-HELD.

### Stable-options browser qualification -- still red
```
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/caret-focused.config.mjs --grep 'Chicago inherited|comment anchors' --repeat-each=5 --workers=1
10 passed (2.0m)
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/restored-options.config.mjs --grep 'Chicago inherited|comment anchors' --repeat-each=5 --workers=1
10 passed (1.2m)
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/production-options.config.mjs --workers=1
1 failed
tests/ci-indent.spec.ts:99:1 > Chicago inherited indent uses left indent and survives undo, redo, and reload
62 passed (2.3m)
```
Logs: `beta/e2/integration/caret-options-fixed.log`, `caret-options-restored.log`, `browser-options-full.log`; report `browser-options-report.json`, preserved traces `browser-options-results/`. Both old/new short repeats passed, so **stable options is not runtime proof of fixing the intermittent selection race**. Full run still shows DOM and PM parentOffset31 after one Home (expected0). No assertions weakened, retries/sleeps added or result upgraded. Diagnostic copied test now instruments `element.editor`/view update+dispatch and actual selection/key events, asserts nonempty event capture, and attaches JSON. Prior `.pmViewDesc.view` diagnostic remains invalid.

Both 200-edit paired synthetic workloads passed strict25msmedian/50msp95 budgets in this full run, but host-before-options.json records148.29/153.46/93.09 load on8logicalCPUs; **quiet-machine acceptance remains open**. Scoped112file code/config hashes in options-code-manifest.json are not a complete release attestation. Source remains frozen while runtime diagnostics execute.

### Further correctness/artifact checks, October22
```
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1
test store::tests::sparse_metadata_survives_history_mirrors_and_restart ... ok
test result: ok. 21 passed; 0 failed; 1 ignored
```
`beta/e2/integration/rust-options.log` includes goal scope/dayMode/unknown goal metadata after incremental native SQLite save/history/mirror/restart. Pure Rust only; no WebView/profile created.

Actual synthetic102word/two-paragraph quotation generated with current `buildQuoteInsertion`, empty citation-note text/formauto matching App's actual capture path, and actual current DOCX/PDF exporters. Initial fixture incorrectly copied multiline quote text into footnote text, provoking existing PDF shaping rejection; corrected synthetic fixture only, no exporter change. Vite SSR first hit sandbox local-socket restriction; permissioned fixture run passed. Structural checker (`beta/e2/exports/check-quote-xml.py`) asserts complete two paragraphs and one final-paragraph native footnote resolving to footnotes.xml; removing that citation from in-memory XML gives expected failure, original passes again.
```
PASS: both complete quote paragraphs; native footnote inside final paragraph and resolves.
EXPECTED FAIL on removed-citation control: Citation is absent from final quote paragraph
PASS: original exported DOCX remains unchanged and passes again.
```
Bundled document renderer/LibreOffice produced3pages; bundledPoppler produced3nativePDFpagePNGs. Root visually inspected all6pages: fullquote/endcitation/footnotes/bibliography readable, no clipped content seen. DOCX-rendered PDF words onpages2/3 begin73.292pt fromtop (pdfplumber measurement); page1firsttitle82.292pt. DOCX andPDF paginate differently; no nativeWord/WebKit or exactparityclaim. Artifacts/logs remain ignored under beta/e2/exports.

Root inspected actual light/dark issue-panel images afterwrapfix: totals2100, page2of21, rowcontrols/readability intact; diff light/dark images previously inspected. No user real-use confirmation implied.

Latency negativecontrol (`performance-negative.config.mjs`, isolated copied test listener busywait60ms) failed median62.60ms against unchanged25ms budget; sourceunchanged. Restored originalpaired tests: `npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/production-options.config.mjs tests/performance.spec.ts --grep '100k words' --workers=1` =>2passed19.7s. Load5.43/5.50/4.37 recorded afterrun; notnativeWebKit or universalparagraph guarantee.

Evidence retention correction: that focusedpositive command mistakenly reused browser-options-results and cleared newestChicago trace. Full63case report copied intact to browser-options-full-report.json beforefocusedreportreplacement, fulltextlog retained, earlier failingtraces retained. Newdiagnostics use separateoutputs. Latest browser-options-report.json now describes only2performancecases, **not** the63casefullsuite.

Valid runtime selectiondiagnostic v2 =>10passed41.2s withnonemptyattachments. Example399events showsHomeDOMselection0 whilePM31, thenDOMobserverselectiontransactionupdatesPM0; no editor.setOptions calls. This demonstratesnormalpath only, nottheintermittentfailure. FirstdiagnosticafterEach failedbecause successfulpage.reload clearedwindow capture; correctedcopiedtestcapturesbefore reload. Those10harnessfailures are notproductfailures. Low-overhead bounded40case diagnostic sequence isrunning next; production source remainsunchanged.

### Actual Home entry-path diagnosis and final automated checkpoint
Low-overhead real-editor diagnostic: `selection-minimal.log`39passed/1failed; `selection-focus.log`38passed/2failed. Captured `selection-failing-focus-events.json`: Home makesDOM0whilePM31; DOMObserver.flush at169msafterfocus, withnoeditorclick, restoresDOM31withoutdispatch/updateState. Installed prosemirror-view/src/domobserver.ts recent-focus recovery condition matches exactly. This establishes that observed path; it does not prove a universal Home defect in our editor.

A root-surface click beforetyping was insufficient: pointer-focus-repeat.log39passed/11failed(Chicago10,comment1), and pointerdiagnostic5failed Home-noop withfocus327ms/click330ms (outside the recent-focus condition). We did not treat this as a fix. Targeting the actual paragraph beforetyping isolated5/5passed, then the original five indent/comment cases50/50passed1.9m. Test caret/indent/Echo/persistence assertions, one Home, no sleeps and zero retries remain. The older toolbar case reproduced sameend-offset19; matching actual-paragraph setup10/10passed18.1s. These qualify pointer-text entry paths only; keyboard-only recent-focus behavior/native WebKit remain open. No production indentation semantics changed.

### UTC baseline race -- separate demonstrated product repair
A later fullrun reached62/63 with goalpostreloadfailure; at lateeveningNYtheUTCdayisnextday. App's initial local goalDay state could overwrite the UTC baseline before its refresh effect. The existinggoaltest now pinsNYtimezone and2026-10-23T02:00Z, making the failure deterministic. Samepostreloadassertion: expected1of10, received0of10. Derive goalDay synchronously from loadedmode/zone andmemo clocktick/project/profile; timer/focus refresh tick, avoiding perkeystroke calendarformatting.
```
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/goal-evening-baseline.config.mjs tests/performance.spec.ts --grep 'goal scope' --workers=1
1 failed -- postreload expected1of10 received0of10
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/goal-clock-fixed.config.mjs tests/performance.spec.ts --grep 'goal scope' --repeat-each=3 --workers=1
3 passed (9.6s)
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/goal-clock-restored.config.mjs tests/performance.spec.ts --grep 'goal scope' --workers=1
1 failed -- exactsameassertion againstpreservedpre-fixcompileddist
```
Additionallocallegacy/UTCtimer tests advance acrossmidnight, require freshbaseline2words/progress0, thennewwordprogress1. Bothpass4.2s. Controlled App schedulecallbackdisabled (one line, no third-party edits) makesbothfail: expected0, received2local/1UTC. Pythonfinally restoredApp byteexactbackup beforefinalrebuild/fullunits; SHAe97db070bbf0198e82beeb1f6cd99fe059e050afabb3961f7b86f09a1844da02. Allmutantsrestored, notcurrentproductsource. Logs goal-midnight-mutant.log, build-goal-clock-final.log, unit-goal-clock-final.log.

### Current full sequential automated results (not native/release acceptance)
```
npm run build
# exit0; build-goal-clock-final.log
npm test
Test Files 20 passed (20)
Tests 223 passed (223)
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/e2/integration/browser-stage-final.config.mjs --workers=1
65 passed (1.5m)
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1
test result: ok. 21 passed; 0 failed; 1 ignored
```
Logs browser-stage-final-full.log/rust-stage-final.log and JSONreport browser-stage-final-report.json underbeta/e2/integration; all read.63became65because two midnighttimer tests added. Zero skips/retries/unexpectedcases inbrowser.112scopedsource/config hashes stage-final-code-manifest.json matchcurrentfiles; notcompletereleaseattestation. Onlytestfileschanged afterfinalAppbuild.

Paired200samplesaids-off/on on100kactualwords/60sections/1000notes/10kactivewords: ordinaryoff median2.6/p953.7ms,on2.5/3.6; repeated10k-wordparagraph off4.7/5.7,on4.6/6.0. Budgets25msmedian/50msp95 unchanged. HostmacOS15.7.9,x86_64,MacBookPro15,2,i5-8279U2.40GHz,8GiBRAM,8logicalcores; hosthardwarelogafterload2.89/3.70/7.00. Beforeload inhost-before-stage-final.json. Input-keydown-to-editorupdate Chromium scope; notnativeWebKit/paint/workercompletionoruniversalparagraphguarantee. Priorhigh-load runs retained separately.

Independent reviewer now holds freshfocusedunit/browserlease withproductionfreeze. OverallE1/E2/E3 acceptance remains open forheldnativechecks/ownerreal-use; no appbundle, commit, push, tag orreleaseclaim.
