# IMPLEMENTATION LOG -- Writer features

Plan: PLAN.md | Integrator: Codex | Workers: Luna | Base: c62332c (main, dirty) | Started: 2026-10-18

## Status

| Task | Status | Evidence |
|---|---|---|
| T0 | DONE | Committed baseline d8aa72c; unchanged source qualified build / 78 unit / 37 browser / 17 Rust |
| T1-T5 | IN PROGRESS | Luna writer_citations; exclusive research/App/model/document ownership |
| T6 | IN PROGRESS | Root goals engine and integration after shared-file release |
| T7-T8 | IN PROGRESS | Luna writer_aids; exclusive Writer/editor/styles ownership |
| T9 | IN PROGRESS | Luna writer_text_export; exclusive textExport/ExportPanel ownership |
| T10 | PENDING | Root documentation and native qualification |

## Authorization and defaults

Owner requested "Implement the plan with Luna sub agents" on 2026-10-18. Plan approved for implementation with named defaults: existing projects keep automatic short notes off; text export includes fragments/research appendices; all four prose categories, disabled by default; daily goals reset at local midnight. No commits, installation, publication, or user-data operations authorized.

## T0 -- Preconditions and baseline

- `git log -3 --oneline`: c62332c Sidebar: collapse chevrons, features at the bottom, no switch arrow or placeholder; f292dfc Footnotes in the editor, fragment split view, visual polish; 3fb5abe One-row toolbar, flat dropdowns, Word-style indent, research rework with citation lookup.
- `git status --short`: 55 dirty paths before this log/approval annotation; matches HANDOFF.md. Existing work preserved.
- Independent completion review is running with sole ownership of completion/REVIEW.md and exclusive expensive qualification runtime. Its fresh baseline checks will be recorded before implementation begins.
- No feature source edits yet.

## BLOCKED -- questions for the architect or user

Owner answered the T0 question: "Wait until the completion work is committed". No feature implementation until that prerequisite is satisfied. The completion review must finish first; commit scope and authority must be resolved without committing another session's files. Completion review found malformed PDF embedded fonts; Luna repaired that prerequisite defect with bundled WOFF fonts and subsetting, plus a fail-first structural regression. Final post-repair build passes, unit suite passes 78/78, browser suite passes 37/37. Native smoke build passed but phase 1 timed out before breadcrumbs with LaunchServices/hiservices errors. Rust rerun passes 17 tests (1 ignored); normal release rebuild passes and metadata inspected. Completion reviewer independently inspected bundle; all findings resolved. REVIEW retains CHANGES REQUIRED solely for blocked native runtime smoke. Prerequisite commit not yet authorized; writer-feature implementation remains blocked at T0. No writer-feature source edits made.

## Final validation

Pending.

## Repair rounds

None yet.

## Updated authorization -- 2026-10-18

Owner: "implement/commit everything uncommitted or unbuilt that is planned". This explicitly authorizes committing the accumulated planned baseline (including prior-session application/publication prep and parallel README draft/screenshots/plan), then implementing, building, reviewing, and committing the approved writer features. Preserve the documented native runtime limitation. No push or publication requested.

## T0 completed -- baseline and execution ownership

`git commit` created d8aa72c, 69 files changed; accumulated planned application/publication/docs/research-plan baseline. `git status` was inspected before staging; all paths were within approved accumulated scope. Prior identical-source qualification logs /tmp/pw-repair-{build,unit,e2e,cargo}.log establish baseline build pass, 78/78 unit, 37/37 browser, 17 Rust passed /1 ignored. No application source changed between those tests and baseline commit; avoid redundant expensive qualification. Native runtime limitation explicitly preserved.

Luna agents have disjoint file ownership. Shared App/model/document files remain exclusively citations agent until released; root will then add goals/preferences/filter labels. Root owns goals.ts/test and tests/features.spec.ts. Agents do not commit or install; root integrates/logs/commits. Full browser/native/build qualification runs sequentially by root.

## T6 -- Goals engine (in progress)

Fail-first: missing module run /tmp/pw-writer-goals-before.log, then behavioral stub run /tmp/pw-writer-goals-stub-before.log: all four tests failed (0 vs5 manuscript words, undefined vs expected daily/deadline data). After implementation `npm test -- src/goals.test.ts` passes four tests, /tmp/pw-writer-goals-after.log. Model validation/App settings/status wiring pending citations file release.

## T1-T5 -- Citation/research implementation (acceptance pending)

Luna writer_citations changed only assigned research/App/model/document/test files, then released App/model/document to root. T1 first failing missing-module run /tmp/pw-writer-citations-T1-fail.log, followed by 32 passing research/model tests. T2 three expected short-title assertion failures /tmp/pw-writer-citations-T2-fail.log, then passing targeted suite. T3 document note test failed on full citation /tmp/pw-writer-citations-T3-unit-fail.log and later passed12 document tests /tmp/pw-writer-citations-T3-unit-pass.log. Parser/quote targeted pass /tmp/pw-writer-citations-T4T5-pass.log. Root captured all3 browser failures /tmp/pw-writer-research-before.log: second note still full, Zotero button absent, Capture quote button absent. The first agent browser attempt was sandbox-blocked before execution; not counted as a fail-first result.

Integration corrections: source-less notes always full; legacy research fallbacks keep autoShortNotes absent/off; paste cleanup applies only on paste and replaces textarea selection, not on save; prototype-named CSL types are counted safely and arbitrary note IDs are own properties. Targeted regressions19passed /tmp/pw-writer-citations-regressions2.log. Root added native Markdown/plain-text filter labels to saveExport after document.ts ownership released.

## T6 -- Model and App integration

Nine invalid goals cases failed before validation (9failed/5passed /tmp/pw-writer-goals-validation-before.log); model now accepts only positive integer word goals and real yyyy-mm-dd dates. `npm test -- src/goals.test.ts src/model.test.ts` passes18 /tmp/pw-writer-goals-validation-after.log. UI baseline /tmp/pw-writer-features-before.log failed for missing Daily word goal field. Root integrated immutable goal writes, section-only counts/status, per-project persisted daily baseline and local-midnight/focus date rollover. CSS compact-width named fallback hides daily/deadline below1000px and keeps total. Added planned styles to existing styles.css through its owner; no new UI architecture.

## T7-T8 -- Editor aids (acceptance pending)

Luna writer_aids implemented local heuristics and Writer-only PM decorations. T7 stub behavior failures /tmp/pw-writer-aids-t7-fail.log then8passed. T8 initial harness needed EditorState from headless Editor extension plugins because unmounted Editor has no mounted state; no DOM dependency installed. Doctored-empty decoration behavior failed2 cases /tmp/pw-writer-aids-t8-fail.log, restored implementations pass. Added UTF16 quoted-emoji ranges, exact passive exclusions, hardBreak/footnote position preservation and nested-list blockquote exclusion regressions; /tmp/pw-writer-aids-positions-fail.log has2pre-fix failures; final targeted prose/decorations15passed.

Three initial T7 worker runs remained spinning on an earlier sentence-boundary loop after its source was fixed. Root verified exact command/ownership and terminated only those8test PIDs; no app/user processes touched. No new install. Browser baseline helper initially waited for missing More when all controls fit; root interrupted that owned run and corrected helper. /tmp/pw-writer-aids-browser-before2.log tests2/3 fail missingFocus; test1 had a title/label collision and was corrected by naming the fixture Focused writing. Writer controls were then added. Root integrated default-off boolean global preferences via effects and planned Writer props.

## T9 -- Whole-project text export (acceptance pending)

Luna writer_text_export added direct rich-text serializers and ExportPanel buttons. /tmp/pw-writer-text-fail.log captures missing module before implementation; root UI baseline /tmp/pw-writer-features-before.log fails absent Export Markdown button. Added behavioral regressions /tmp/pw-writer-text-regressions-fail.log for dropped later list paragraphs, embedded backtick fences, fragment-only note references, and research locator preservation; targeted final9tests pass. All list-item paragraphs retained; code fences chosen from actual content. Fragment-only notes serialize inline as [Note: ...] while shared manuscript refs keep numbers: this fills the appendix representation detail without changing section-only numbering. Truly missing note data still raises error. No existing DOCX/PDF assertions changed by T9.

## Integration acceptance

Root running feature/research/writing-aids Playwright batch with exclusive owned Vite server. All source edits paused for result. Full qualification/review/rebuild/commits pending.

### First acceptance batch and harness correction

`npx playwright test tests/features.spec.ts tests/research.spec.ts tests/writing-aids.spec.ts --workers=1` /tmp/pw-writer-acceptance.log:11passed,4failed. All goals/export/citation/Zotero flows passed. Quote/citation/page/one-undo assertions passed; its subsequent preview test hit default5s while UI showed Preparing export, no error. Citation agent inspected/confirmed this was an asynchronous first-load wait, not failed undo. New test now waits bounded30s for Preview PDF to re-enable, preserving preview-visible assertion; no export performance requirement was in plan.

Three aids failures were incorrect test setup/locators: cursor left in second paragraph while expecting second dim, project title Prose check matched three buttons, On substring also matched Reveal sidebar on hover. Aids agent agreed with diagnosis; fix moves cursor first, distinguishes fixture title and exact checkbox label. Product assertions retained and keyboard issue test strengthened to check actual selected text.

### Usage checkpoint and restoration metadata

Owner requested a handoff if usage may run out. Live tool reports92% of5hour window used; HANDOFF.md refreshed with exact remaining gates/active commands. Root focus diagnostic /tmp/pw-writer-focus-debug.log confirms Cmd+Home did not move browser caret; plugin correctly dimmed first paragraph while caret remainedsecond, and ArrowUp+Home movedfirst and dimmedsecond. Focus test setup now uses ArrowUp+Home. Rerun pending.

A required metadata-preservation path omitted by the plan file list was found in existing mergeMissingResearch: section restoration reconstructed research arrays and discarded the new autoShortNotes flag. Added a regression to existing operations.test.ts; /tmp/pw-writer-restore-before.log failed1/passed2 (expectedtrue, receivedundefined). Added ...a to existing returned object, preserving current project metadata while keeping legacy fallback literals unchanged. This small scope extension is required by project additive-metadata preservation rules; no API/schema/dependency change. Full checkpoint unit/build now running, not yet final qualification.

### Checkpoint broad unit run

`npm test` /tmp/pw-writer-checkpoint-unit-default-failure.log:141passed,2failed in17files. Both failures are existing5second PDF test timeouts under parallel worker load (6.8s/5.9s), not changed assertions or export mismatch. Root reruns `npm test -- --maxWorkers=1` with identical thresholds, then npm run build; active session86022. No claim of final qualification yet.

## Resume pass (pickup, 2026-10-18 evening)

The paused checkpoint session never finished; its build had in fact failed. This pass resumed, corrected two real defects, and re-ran qualification.

### Defect 1 -- TypeScript build was broken (fixed)

`npm run build` failed on the working tree: `src/Writer.tsx(886,42)` and `(888,96)` `TS2339: Property 'type' does not exist on type 'Decoration'`. The prose issue list read kind and message from `decoration.type.attrs`, which exists at runtime but is not part of prosemirror-view's public `Decoration` type (only `from`, `to`, `spec` are). Browser tests passed because Playwright drives the Vite dev server, which does not type-check.

Fix (no runtime behaviour change; decoration DOM class and title unchanged): `src/editor/writingAids.ts` now passes the issue as the decoration spec (`Decoration.inline(from, to, { class, title }, issue)`), and `src/Writer.tsx` reads `decoration.spec.kind` / `decoration.spec.message`. Evidence: `/tmp/pw-writer-checkpoint-build.log` exit0; `npx vitest run src/editor/writingAids.test.ts src/editor/proseCheck.test.ts` 15passed; `npx playwright test tests/writing-aids.spec.ts --workers=1` 3passed (including "prose check lists issues and Enter on an issue selects it").

### Defect 2 -- optional new source/research metadata was not type-checked (fixed, fail-first)

The open concern recorded in HANDOFF.md was real: `validateProject` checked source `id`/`title`/`authors`/`kind`, note `id`/`text` and footnote `form`, but not `shortTitle`, `cslId` or `autoShortNotes`. Every load path goes through it (`src/storage.ts`, `src/save-queue.ts`, `src/import/manuscript.ts`, `src/App.tsx`). A malformed `shortTitle: 42` reaches `shortTitle()` in `citations.ts` (`.trim()` on a number) and a truthy `autoShortNotes: "false"` would silently turn short notes on for a legacy project, contradicting the plan's "no existing export changes silently" mitigation.

Fail-first: added three cases to `src/model.test.ts`; `/tmp/pw-writer-metadata-before.log` = 3failed/14passed. Then added present-only type checks to `src/model.ts`; `/tmp/pw-writer-metadata-after.log` = 17passed. Additive scope extension using the existing `form` check pattern; no field is dropped or renamed.

### Checkpoint results after the fixes

- `npm run build`: exit 0 (`/tmp/pw-writer-checkpoint-build.log`).
- `npm test`: 143passed/143 in 17 files, 15.71s (`/tmp/pw-writer-final-unit.log`). The earlier 2 PDF timeouts did not reproduce; they were machine-load timeouts (load average exceeded 600 during the paused checkpoint). Isolated confirmation: `npx vitest run src/export/document.test.ts` 12passed, tests 5.03s.
- `npm run test:e2e -- --workers=1`: 45passed (`/tmp/pw-writer-final-e2e.log`), above the 37 baseline.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 17passed, 1ignored (`/tmp/pw-writer-final-cargo.log`).
- Focus browser test rerun with the corrected ArrowUp/Home setup: passed, and passed again inside the full browser suite.
- Typing cost (production build, Chromium, 1,200-word paragraph, insertText + frame, in-page `performance.now()`): aids off median19.1ms, focus+prose on median19.7ms (`scripts/tmp-writer-aids-measure.mjs`, temporary untracked helper to delete before commit). The plan's 25ms limit is not approached, so the named 20-textblock fallback is not needed. An earlier run of the same script measuring from Node under load average 612 reported median36ms; that number measures machine load plus the CDP round trip, not the editor.
- Light/dark focus+prose screenshots at 1440x900 inspected: `test-results/writing-aids/focus-prose-{light,dark}[-editor].png`. Decorations render as dotted underlines in both themes, the prose panel shows its counts and issues, and the theme variables resolve. Observation, not fixed: the excerpt button for a long-sentence issue holds the whole sentence, so that one button is a wall of clipped text.
- Export fixtures (`npm run render:export-fixtures`): legacy projects render unchanged. `pdftotext` extraction of the new PDF is byte-identical to the baseline repair extraction (`diff /tmp/pw-repair-final.txt /tmp/pw-writer-final-fixtures.txt` empty). DOCX XML is identical to the stored baseline XML except `docProps/core.xml` timestamps (`diff -r -x core.xml` empty). PDF page 1 and the DOCX QuickLook thumbnail were re-inspected: Latin/Greek/Cyrillic, strike, hard break, bullet, nested list starting at 4, split long token, footnote and bibliography all present. QuickLook still does not show the footnote area or nested indentation faithfully.

## Repair pass (independent review, 2026-10-18 evening)

The independent review is `REVIEW.md` (same folder); it approved the work for local commit and raised one new defect, one risk, and several low items. Each was verified before acting.

### D1 -- shortened note for an untitled source printed a bare period (fixed, fail-first)

`citations.ts:60` falls back to `[Untitled source]` for the full form, but line 61 sent the short form straight through `shortTitle(s)`, which returns `""` for an empty title. A title-less source cited twice produced the note "." (review repro: new project, Enter manually, Cite here twice). Fixed by `shortTitle(s) || title`. Fail-first: `/tmp/pw-writer-untitled-before.log` = `expected '.' to be '[Untitled source].'`, 1failed/9passed; after the fix the citations suite is 10passed, and citations+noteForms+document are 29passed (`/tmp/pw-writer-untitled-after.log`).

### R4 -- per-day figure could be negative (fixed, fail-first)

`goals.ts` computed `perDayNeeded` whenever a total goal and a future deadline existed, so a writer past their total goal saw e.g. "3 days left, -1 a day". Fixed by requiring `goals.totalWords > done`. Fail-first: `/tmp/pw-writer-goals-met-before.log` = `expected -1 to be undefined`, 1failed/4passed; after the fix `src/goals.test.ts` passes.

### R5 -- dangling label in the Capture quote dialog (fixed)

`CaptureQuote.tsx` had `<label htmlFor="capture-source">` while the `Dropdown` renders its own generated id, so the label pointed at nothing. Replaced with `<span className="field-label">Source</span>`, matching how every other `Dropdown` in the app is labelled (e.g. `ResearchPanel.tsx`). The two native inputs in the dialog keep their real `htmlFor`.

### R3 -- pushed back (working as designed)

Typed multi-line text in the quote dialog is stored as typed; only paste runs `cleanPastedQuote`. That is the plan's explicit rule ("Never rewrite punctuation inside the user's text. Only `cleanPastedQuote` touches text, and only on paste into the capture dialog"), so this was not changed.

### R1 -- prose-check cost, verified, decision left to the owner

Verified on a low-load machine (`uptime` load 5.8). `scripts/tmp-writer-aids-perf.mjs` (temporary, delete before commit), in-page `performance.now()`, production build:

| Fixture | Words | Decorations | Typing median, aids off | aids on |
| --- | --- | --- | --- | --- |
| 12-word cycle paragraph | 1,200 | 1 | 16.6 ms | 16.6 ms |
| filler-heavy prose | 1,875 | 374 | 16.7 ms | 22.3 ms |
| filler-heavy prose, 25 paragraphs | 4,875 | 974 | 16.6 ms | 15.7 ms |
| "the the the ..." one paragraph | 1,000 | 1,995 | 16.6 ms | 15.8 ms |
| "the the the ..." one paragraph | 10,000 | 19,995 | 16.6 ms | **3,276.9 ms** (max 8,958 ms) |

So the reviewer's risk is real above roughly 20,000 decorations, and it is decoration *count*, not word count: realistic density (about one hit per five words) costs nothing at 4,875 words. The plan's named fallback (analyse 20 textblocks around the cursor) would not fix the worst case, because one long paragraph is one textblock. The earlier 19.1/19.7 ms figure was decoration-light (the cycle fixture produces one decoration), which is why it did not see this. Implementer's recommendation: a bounded decoration cap near the cursor, with a fail-first test; the review's numbers versus mine were not reproduced at realistic density, so the owner decides whether to spend the change.

### R2 -- stale count corrected

The resume-pass headline said 143/143, which was true before the three metadata tests landed. The review's fresh run measured 146/146; this repair pass adds two more tests, so the final qualification run below is authoritative.

### R1 resolution -- bounded prose decoration cap (implemented at the owner's instruction)

Owner chose "Add a bounded cap near the cursor". Scope extension beyond the plan, taken deliberately because the plan told the implementer to stop and ask in exactly this case.

- `writingAids.ts`: `MAX_PROSE_DECORATIONS = 2000`; `proseDecorations(doc, selection, enabled)` now collects candidates with their distance from the cursor, keeps the nearest 2000, then sorts by position. `ProseCheck` passes the selection through; the plugin's compute hook already received `state.selection.head`.
- `Writer.tsx` shows "Only the issues closest to the cursor are shown." when the panel's decoration count reaches the cap, so the counts cannot silently under-report.
- Fail-first: `/tmp/pw-writer-prose-cap-before.log` = 1failed/5passed (`expected 2100 to be undefined`, because the constant did not exist); after the fix `src/editor/writingAids.test.ts` is 6passed and `npm run build` exits 0 (`/tmp/pw-writer-prose-cap-build.log`).
- Cost, production build, Chromium, 10,000-word single paragraph of "the", about 20,000 candidate issues. Before the cap: aids off 16.6 ms, aids on 3,276.9 ms median per keystroke within the same run (load average 5.8). After the cap the same fixture renders 3,999 elements instead of about 40,000, and the within-run ratio falls from roughly 200x to between 10x and 90x.
- Limit, stated plainly: absolute per-keystroke figures are not trustworthy on this machine while the owner's other applications keep the load average between 30 and 600. The identical capped configuration measured a 111 ms minimum and then a 1,249 ms minimum minutes apart, and a capped 5,000-word run measured slower than a capped 10,000-word run, which cannot be right. Only the within-run comparison (aids off versus aids on) survives that noise. A quiet-machine re-measurement is still required before any performance claim is called verified. What the cap does establish is a hard bound on the one previously unbounded factor, decoration count.
- Realistic text is unaffected: a 4,875-word filler-heavy section with 974 decorations measured 15.7 ms with the aids on against 16.6 ms off, and 1,875 words with 374 decorations 22.3 ms against 16.7 ms.

## Final qualification (2026-10-18 evening, after all repairs)

Fresh run on the repaired tree, all four gates. Logs under `/tmp/pw-writer-final-qualification.log` (unit/e2e/cargo sections), `/tmp/pw-writer-e2e-rerun.log` (browser rerun).

- `npm run build`: exit 0 (`/tmp/pw-writer-prose-cap-build.log`, re-confirmed by the qualification run).
- `npm test`: **149 passed / 149 in 17 files** (this supersedes the 143/143 and 146/146 headlines; the two R-fixes and the cap test are the additions).
- `cargo test --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored.
- `npm run test:e2e -- --workers=1`: first pass 44 passed / 1 failed.
  - Failure: `tests/accessibility.spec.ts:93` "page layout measurement preserves the editor element and undo history" -- the single undo restored only "Undo remains available. after lay" instead of the full sentence, so the assertion timed out. This is the same test that has been load-fragile throughout (ProseMirror's 500 ms `newGroupDelay` grouping keystrokes differently under a loaded machine; a 502 ms input gap was measured in an earlier probe).
  - Full-suite rerun immediately after, machine idle: **45 passed in 2.9 minutes, exit 0** (`/tmp/pw-writer-e2e-rerun.log`), the failing test passing at 3.1 s. So the failure is a load-only flake, not a product regression; the test and its threshold are unchanged.
- Browser total 45 is above the 37 baseline; the writing-aids spec contributes three of the new tests.
- Native smoke (fresh `--features native-smoke` debug build, `--config '{"identifier":"com.folio.smoke"}'`): built and launched, but the environment stalled it at the known point. Breadcrumbs stopped at `ok native paragraph pagination`; the runner timed out after 180 s with `NSSpellServer dataFromGeneratingCandidatesForSelectedRange timed out`, no crash report, process idle. Log: `/tmp/pw-writer-native-smoke-run.log`. Environment limit, as in the October 18 completion pass; not a product result.
- Fresh normal release bundle: `npm run tauri build` passed. `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25 MiB); `Info.plist` keeps `com.folio.writing` / Personal Word / 0.1.0; `Contents/MacOS/folio` built 2026-10-18 18:26 America/New_York, newer than all source; no smoke symbols. Log: `/tmp/pw-writer-release-build.log`.
- CLAIMED, not VERIFIED. Every number here is a static/automated check; the owner's real-use confirmation is still outstanding.
