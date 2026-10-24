# IMPLEMENTATION LOG -- Broader sources and dependable research workflows
Plan: PLAN.md | Implementer: Codex | Base: 2bb181bebb567b7dc35f66332ea905b5feab9262 | Started: 2026-10-22

## Status
| Task | Status | Evidence |
|---|---|---|
| C1 | IN PROGRESS -- lossless CSL, additive duplicate review, structured creators and bounded chapter formatting implemented; acceptance in progress | Existing DOI/dedup/CSL/citation callers inspected; official Chicago18 bounded examples reviewed |
| C2 | PENDING | No source change |
| C3 | PENDING -- exact parser review/install approval required before implementation | No parser installed; Zotero remains disconnected |

## Baseline and ownership
Owner approved this plan with the beta roadmap. Existing dirty R1/D1/R2/E1/E2/E3 work is preserved; the editing qualification currently holds a source freeze. Root owns shared types/model/App/validators and renderer integration. No new package/tool/font/install/publication authorization inferred. This log begins with investigation only; no research feature is claimed built or tested.

## C1 -- investigation
- Existing lookup.normalizeDoi already recognizes doi.org, dx.doi.org and doi prefixes; do not claim this recognition as new. Formatter strips only doi.org and can double-prefix stored dx/doi forms. CSL owns a separate normalization helper.
- CSL already deduplicates IDs/DOIs, but title plus only first surname also silently suppresses records with different type/year/DOI. Current unit test blesses that fallback. New fail-first must distinguish those works and preserve them for explicit review.
- Types/validator and formatter have three legacy kinds; unsupported CSL is currently skipped and raw fields discarded. App acceptance only appends new source UUIDs; no field-level merge/update/reference-remap UI exists.
- Legacy formatting behavior must remain unchanged for old string-author records. Structured corporate/literal creators must retain identity; never infer surname by splitting a new literal field.

## Decisions taken -- named defaults, not silent citation invention
C1 explicitly allows retaining raw records and manual formatting while disputed fixtures remain pending. The free official Chicago18 guide supports bounded edited-book chapter, PhD dissertation, signed online newspaper, published broadcast interview and online video-talk examples. Chapter bibliography page-range rules differ from Turabian; target Chicago18 citation content while retaining instructor-layout overrides.

Exact notes/bibliography output for generic report, conference talk/poster versus published proceedings, unpublished-interview inclusion and generic media/other remains unresolved. The public report FAQ's concrete example is author-date; a table-of-contents heading is not a notes/bibliography template. Preserve fields/raw/manual overrides and leave disputed fixtures pending until reviewed; do not mark all-kind formatter acceptance complete by guessing.

Official sources inspected: [Chicago18 samples](https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html), [Chapter14 contents](https://www.chicagomanualofstyle.org/book/ed18/part3/ch14/toc.html), [report FAQ](https://www.chicagomanualofstyle.org/qanda/data/faq/topics/Documentation.html?page=2), [unpublished interview FAQ](https://www.chicagomanualofstyle.org/qanda/data/faq/topics/Documentation/faq0090.html), [Turabian comparison](https://www.chicagomanualofstyle.org/turabian/turabian-notes-and-bibliography-citation-quick-guide.html). Synthetic fixture drafts are private investigation, not reviewed production output.

## Fail-first and acceptance
Not run yet for C1. C2/C3 not started. No feature completion or citation-accuracy claim.

## BLOCKED -- questions for the architect or user
- Disputed formatting fixtures remain pending under the plan's explicit preserve/raw/manual default; this does not block identifiers, safe reviewed import or shared context work.
- C3 requires a concrete exact-version/license parser proposal and separate installation permission; none requested or installed yet. Real Zotero synthetic-library integration also needs owner permission later.
- Native WebView/profile creation remains owner-HELD. Pure Rust tests may run; no native UI round-trip claim.

## Final validation
Pending implementation. No full research-stage build/unit/browser/native/export acceptance yet.

## C1 initial implementation -- shared identifiers and DOI rendering

The editing checkpoint completed before this change: build, 223 units, 65 Chromium cases and 21 Rust tests passed (one Rust benchmark ignored); independent reviewer reran 110 units and 30 browser cases successfully. Its production freeze is lifted for C1. No blanket commit was made because the dirty tree also contains unfinished D1/R2 work.

Root extracted the existing lookup DOI normalizer and ISBN checksum validator into `identifiers.ts` and re-exported both old lookup APIs. Existing prefix recognition is unchanged. Citation links now use that helper for valid DOI values; stored suffix case/punctuation and legacy invalid-value fallback remain unchanged. Equality keys normalize case only for DOI comparisons and validate compact ISBN without a 10/13 crosswalk. CSL import has not yet migrated, so the full shared-policy acceptance remains open.

Commands used the approved cached Node 22 in PATH. All logs below are under `node_modules/.cache/personal-word-beta/`:

- `npm test -- src/research/citationFixtures.test.ts` before repair: **2 failed | 4 passed** (`c1-doi-baseline.log`). Both failures show the malformed double prefix: `https://doi.org/https://dx.doi.org/...` or `https://doi.org/doi: ...`. Existing lookup prefix tests already passed.
- `npm test -- src/research/citationFixtures.test.ts src/research/lookup.test.ts` after repair: **20 passed** (`c1-doi-fixed.log`).
- Restoring the original formatter stripping, same regression command: **2 failed | 4 passed**, same malformed URL assertions (`c1-doi-restored-defect.log`). Python finally restored the repaired file.
- Removing equality-key lowercasing, same regression command: **1 failed | 6 passed**, expected lowercase key received mixed-case key (`c1-key-negative.log`). Python finally restored the production helper. Reviewer initially read this temporary mutant; root notified reviewer to reread restored source. No mutant remains.
- `npm run build`: exit 0, TypeScript/Vite passed (`c1-doi-build.log`), existing non-fatal chunk/import warnings retained.
- `npm test` after restoring all production changes and adding key assertions: **230 tests passed in 21 files** (`c1-doi-unit-final.log`).
- `git diff --check`: exit 0.

This reaches tested unit behavior for the identifier/formatter regression only. No current C1 browser/export/native acceptance or broader source-type/merge qualification is claimed. `citationFixtures.test.ts` currently contains identifier fixtures, not approved Chicago source-type golden examples. Remaining C1 work is safe duplicate-review contracts, lossless source model/import and UI integration, plus renderer fixtures. C2/C3 remain pending. GitHub work remains deferred at the owner's request; no Support ticket was submitted.

## October 23 -- C1 source/import checkpoint (partial)

Ownership: root integrated types/model, CSL parser, review modal, research form, App additions, browser/model fixtures and the additive Rust fixture. `e2_prose` owned only sourceMerge.ts/test; `e3_diff` owned only citations.ts/citationFixtures.test.ts. Both leases are released. Existing unrelated beta work is preserved. No packages, native WebViews, profiles, publication or GitHub actions were started.

Implemented:
- The model accepts the additional planned source kinds and optional structured creators, edition/container/institution/event/date, original CSL data and exact per-form manual overrides. Legacy string-author records retain their formatter path.
- Valid titled CSL records retain full raw data, including unknown/custom fields. Unknown types become `other` with a warning and explicit manual-citation fallback. Invalid non-object or untitled items are counted and warned, rather than silently accepted as complete records. Imported literal corporate names are not inverted or reduced to a surname.
- Import no longer silently suppresses records by title/first surname or a bare CSL ID. The shared helper classifies valid DOI, strictly namespaced Zotero URI, and valid ISBN+explicit equal edition+kind matches; unlike valid DOIs block fallback exactness. Other metadata yields review suggestions only. Every candidate retains its index and remains selectable, including duplicates within an imported batch.
- The preview shows all records in 50-row pages. Identifier matches start unchecked; possible/new records remain checked. Users can keep existing records or add separate copies. Existing source UUIDs, local fields and citation references remain unchanged. **Per-field updates, explicit source-to-source merges and reference remapping remain unbuilt; C1 is incomplete.**
- Research editing exposes structured names, retained raw fields and manual full/short/bibliography text. Editing editor-only metadata preserves existing legacy authors.
- A bounded, complete print edited-book chapter fixture uses the official CMOS18 sample structure and omits chapter page ranges from bibliography. Other new kinds remain manual; chapters with URLs/DOIs, editions, missing required fields or other unqualified cases use a visible manual-required fallback. Broader official fixtures remain pending.

Fail-first and intermediate evidence (all paths relative to ignored `node_modules/.cache/personal-word-beta/`):
- `c1-import-baseline.log`: original parser **2 failed / 7 passed**, dropping both a distinct same-title/surname work and a distinct work sharing a bare CSL ID.
- `c1-raw-baseline.log`: original parser **4 failed / 7 passed**, additionally dropping unknown raw CSL and chapter metadata. Updated parser/model focused run **43 passed** (`c1-import-fixed.log`). The previous test that blessed title-based dropping was replaced with identifier-review/no-discard assertions using valid synthetic DOI syntax.
- `c1-model-baseline.log`: **7 failures / 25 passed** for additive kinds and malformed metadata; repaired validation **32 passed** (`c1-model-fixed.log`). Raw prototype-named keys are retained as data, never spread into model objects.
- Helper empty-stub baseline produced **5 behavior failures** (`e2/research/fail-first.log`); DOI-conflict mutant failed its guard (`conflict-mutant.log`); restored focused helper **7 passed** (`focused-delivery.log`).
- Chapter baseline failed the manual placeholder versus expected reviewed chapter output. Page-range, literal-author and manual-override mutants failed their intended assertions; restored citation suites **23 passed** (`e3/c1-focused-final.log`).
- Original production browser baseline **2 failed** (`c1-import-browser-baseline-permitted.log`) at retained-record counts; initial sandbox listener EPERM is recorded separately and is not a product failure. Permissioned loopback execution was allowed.
- Root reproduced a new integration defect: editor changes cleared a legacy author (**expected Mina Chen, received empty**, `c1-editor-baseline.log`). The field update now preserves legacy authors when no structured author exists.
- First integrated browser run **9 passed / 1 failed** (`c1-import-browser-current.log`). The failure compared an own `__proto__` key after Playwright object transport; the helper now returns the stored JSON string and parses it Node-side. That preserved key then passed. The focused attempt subsequently timed out on the test's nonexistent “Open Raw sources” button (`c1-raw-transport-fixed.log`); the locator now targets the actual project row. These are harness corrections, not product data-loss fixes. Full final run uses distinct report/results paths.
- Initial build caught two TypeScript errors: optional test metadata narrowing and helper matchedBy inferred as string[]. Both were corrected; no failed build is reported as passing.

### Repair round 1 -- October 23 independent review
| Finding | Action | Evidence |
|---|---|---|
| Chapter edition silently omitted by bounded automatic formatter | Fixed: nonempty edition now requires explicit manual formatting | `c1-chapter-edition-baseline.log` fails expected manual fallback; `c1-chapter-edition-fixed.log` passes 11; restoring omission fails again (`c1-chapter-edition-restored-defect.log`); production restored |

Current final source build (`c1-checkpoint-build.log`) passed and full units (`c1-checkpoint-unit.log`) passed **252 tests in 22 files**. Existing chunk/import warnings are non-fatal. A 17-path scoped SHA manifest is `c1-checkpoint-manifest.json`. Full Chromium, pure Rust, actual export artifacts and independent final qualification are still in progress at this log entry. No stage or beta completion claim.

### Integrated runtime update -- retained red run and comment setup correction
The first complete Chromium run finished **67 passed / 1 failed of 68**, with all three new research cases passing. The failure is the prior comment cursor setup: after Home, inserting `New ` produced `Echo gap EchoNew ` instead of `New Echo gap Echo`. This evidence is retained in `c1-checkpoint-browser-full.log` and distinct full-results traces; do not call that run green.

After independent static review of the installed Tiptap keymap, the comment workflow now uses its real macOS Ctrl+a/selectTextblockStart shortcut (selected by browser navigator.platform), or Home on other platforms. Exact DOM/ProseMirror zero-offset/empty selection assertions were added before the edit; every anchor/delete/reattach/persistence assertion remains. Dedicated Home behavior in ci-indent and editor-toolbar is unchanged. This is a comment-test setup correction, **not a Home bug fix**. The separate Home focus edge remains open. Focused comment workflow repeated **10/10 passed** with zero retries (`c1-comments-nativekey-repeat.log`).

Pure Rust full suite passed **21 / 1 ignored** (`c1-checkpoint-rust.log`), including current structured/raw/manual source metadata through incremental SQLite save, history, mirrored JSON and restart. The single ignored benchmark is still unqualified; no native WebView was run. Final full Chromium run after comment setup correction is active, with separate final results and an 18-path manifest. Actual export checks remain pending.

### Current bounded checkpoint results
- Final full production Chromium: **68/68 passed, 2.2 minutes**, one worker and zero retries (`c1-checkpoint-browser-final.log`, separate JSON report/results). The earlier 67/68 run remains retained as red evidence.
- Build and full units remain **252/22 passed**; pure Rust remains **21 passed / 1 ignored**. Production sources did not change during final browser/export qualification; the only test setup change was the documented platform key in comments. The 18-path manifest is scoped evidence, not a full release attestation.
- Current actual DOCX/PDF/Markdown/plain files generated by `c1-exports/render.mjs`. `check.py` passes exact native DOCX footnote strings, italic chapter container, bibliography entries and matching PDF/Markdown/plain text. Removing the first native DOCX footnote in an isolated control makes the checker fail the exact missing full-note assertion (`check-negative.log`); the original passes again untouched.
- Bundled LibreOffice DOCX render: 2 pages; native PDF Poppler render: 2 pages. All four page images inspected: full/short notes and exact manual text are visible, chapter container is italic, no clipping found. pdfplumber first-word top is 73.292pt on both DOCX-render pages and 75.516pt on native PDF pages. Inline image display can trim whitespace; underlying PDFs preserve margins. This is not Microsoft Word, native WebKit or exact-pagination parity acceptance.
- Light/dark import dialog and source form screenshots inspected. The earlier tall element capture was cropped by the scroll container and replaced by actual viewport captures. The narrow creator input scrolls its long value; wider creator layout remains a possible UI refinement, not claimed native acceptance.
- README corrected only for demonstrated citation/import behavior. It explicitly distinguishes development source, existing lookup recognition, current renderer normalization, raw/manual limits and pending per-field updates.

C1 remains partial. Next authorized work is explicit field updates to a selected matched source, preserving its UUID/references and all unselected local fields, with a safety snapshot and stale-state guard. Other named citation examples, C2/C3 and broader native/release gates remain open. Independent fresh focused qualification is in progress; no stage completion claim.

### Explicit field updates and review round 2 -- in progress
The reviewed import now supports an explicit existing target and selected incoming fields. Unselected metadata, UUID, manual forms, provenance and linked notes remain; authors/creators are one coherent selectable field and raw CSL is a visibly labelled whole-field replacement. App validates prospective data, flushes, reopens and compares the safety snapshot, rechecks current state, then mutates once. The modal closes after mutation before final flush to avoid repeat-add on persistence retry.

Helper19/19passed; empty/unsafe baseline11failed, ID mutant2failed and manual-field mutant1failed (e2/research/merge-fields-*.log). Initial normal build passed (c1-fields-build.log), focused research browser12/12passed (c1-fields-browser-current.log). An isolated compiled bundle with snapshot comparison removed failed the corrupt-snapshot test on its missing alert as intended (c1-fields-safety-negative.log); original source and dist were untouched.

Round2 review found ambiguous same-title target labels and legacy duplicate IDs could update multiple rows. Baselines c1-fields-target-baseline.log and c1-fields-identity-baseline.log fail the corresponding distinct-target and rejection assertions. Source now shows Record N/full creators/date/container with ordering hint; App rejects a target count other than1. Reviewer static addendum accepts both source repairs; current-source compiled acceptance remains pending.

Four further bounded citation examples are being integrated. Root review found missing no-locator short-note coverage and rich title italics; these remain under repair before final qualification. C3 read-only parser proposal is retained in ignored c3-parser-investigation.md; exact license/artifact/dependency compatibility gaps remain, no install performed.

### Reviewed formatting repairs and current qualification
- Four additional automatic cases are intentionally narrow: structured single-author ProQuest PhD dissertation, signed online newspaper with a full date/URL, broadcast audio interview with one interviewer and duration, and raw CSL speech/TED Talk with reviewed video fields. Unsupported cases retain raw data and the explicit manual-required fallback. Reports, conference works and broader subtypes remain on that named default.
- Root review caught double sentence punctuation in short notes without locators. Baseline `c1/no-locator-baseline.log` has3failures, restored-defect `c1/no-locator-mutant.log` fails, current16fixtures pass. Newspaper/program title italic rich parts are now checked separately.
- Independent review found dropped full-note locators. `c1/locator-baseline.log` reconstructs3failures; current16fixtures pass in `c1/locator-final.log`. Newspaper full notes retain supplied locator after the date/before URL. Full interview/TED notes with locators require manual text unless manualFull exists; short forms retain locators and bibliography omits them. This avoids inventing unreviewed full-note timestamp placement.
- Structured-only authors previously triggered a false missing-creator hint. `c1-creator-hint-baseline.log` fails with expected core-fields-present, actual creator-missing. The hint now recognizes nonblank author-role structured names/literals; its browser fixture also checks genuinely blank authors still warn.

Fresh current source commands, serialized with pinned Node22 for app qualification:
```
npm run build                    # c1-repaired-build.log: built successfully
npm test                         # c1-repaired-unit.log: 269 passed in22files
npm run test:e2e -- --config node_modules/.cache/personal-word-beta/c1-repaired-final.config.mjs --workers=1
                                 # c1-repaired-browser.log: 73passed (2.2m), zero retries
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1
                                 # c1-repaired-rust.log:21passed/1ignored
```
The earlier72/72 full run in c1-expanded-browser.log predates the locator/creator-hint repairs; retain it as intermediate evidence only. Current18-path source/test SHA manifest is c1-repaired-manifest.json. Build chunk/static-dynamic-import warnings and existing Rust warnings remain nonfatal. No native WebView/profile or normal app bundle was launched/built.

### Expanded actual export and preview checks
Ignored c1-expanded-exports/render.mjs generated16actual footnotes and6bibliography entries through current DOCX/PDF/Markdown/plain exporters, including four new qualified types, short notes without locators, newspaper full-page locator, chapter and exact manual forms. check.py uses independent literal expectations and requires italic chapter/newspaper/program titles separately in native DOCX notes and bibliography. Check passes (PDF3pages). Two isolated DOCX controls remove a native footnote or only newspaper italics from footnotes; both fail their intended assertions while originals stay untouched (missing-note-negative.log, missing-note-italic-negative.log).

Bundled LibreOffice rendered the actual DOCX to3pages; bundled Poppler rendered actual PDF3pages. All6pages inspected: expected text/italics present, readable, no overlap/clipping found. The inline image viewer sometimes crops repeated leading whitespace/text; direct pdfplumber geometry confirms full page2 text and first words at72pt margin/top73.3pt(DOCX) or75.5pt(PDF). Pagination differs between engines, as documented. This is not Microsoft Word/native WebKit acceptance.

preview-check.mjs exercised six source forms in actual production Chromium using isolated browser storage: exact full/short/bibliography strings and rich italic DOM checks pass. Actual light/dark interview preview and field-update-dialog captures inspected. The normal full73browser run also passed both same-title target discrimination and duplicate-ID rejection. Fresh independent final focused reruns are in progress; C1/stage/beta acceptance remains incomplete.

### C1 checkpoint closed -- 2026-10-23
Independent final review (REVIEW.md, "Independent final focused rerun") APPROVES the scoped C1 identifier/import/update and bounded citation-format checkpoint: 105/105 focused units (c1-independent-final-unit.log), 15/15 research/research-library Chromium (c1-independent-final-browser.log), all 18 manifest hashes matched before and after. Root rechecked the 18 hashes at session pickup: 0 differ. No open review findings. C1 as a whole stays incomplete (broader source kinds, native UI, hosted CI). Next: C2, blocked on owner scope answers (src/model.ts validation and the contract questions in c2-context-investigation.md).

### C2 owner scope answers (2026-10-23, in chat): (1) src/model.ts + model.test.ts IN scope for citationPolicy validation; missing policy stays legal. (2) When citationPolicy exists it is authoritative over autoShortNotes; absent policy = exact legacy resolveNoteForms. (3) Never ibid for: note with nonempty own text, explicit form full/short (or legacy shortened), source with manualFull/manualShort. (4) Ibid roman, "Ibid." same locator, "Ibid., <loc>." different; repeated non-adjacent source falls back to short.

## C2 -- shared citation context, section scope, opt-in Ibid. (2026-10-23, CLAIMED)
Files: types.ts (CitationPolicy, ResolvedNoteForm), noteForms.ts (sectionReferences, resolveCitationContext; footnoteIdsInOrder/resolveNoteForms kept, legacy behavior unchanged), citations.ts (footnoteParts/footnoteText accept "ibid" + resolved locator), App.tsx (one context from the project index; previous per-section list reused while unchanged so typing does not recompute), ResearchPanel.tsx (citationContext prop; opt-in "Use repeat citation rules" + two dropdowns; legacy checkbox hidden while rules are on), document.ts, textExport.ts, model.ts (+model.test.ts, owner-approved). New citationContext.test.ts; Ibid. cases in document/textExport tests; browser test in research.spec.ts. ReadDocument.tsx unchanged: it renders only numbers supplied by App. Rust untouched: research is opaque JSON in the flattened `extra` map, so citationPolicy survives native save by construction (not native-run tested; hold).
Conservative edges decided (not owner-specified): previous note with its own text breaks the Ibid. chain; current note without a locator after one with a locator falls back to short; section scope also breaks the Ibid. chain at a boundary, manuscript scope does not; missing footnote record breaks the chain; numbering stays continuous; duplicate footnote id counts once at first occurrence; fragment-only references unchanged (inline full).
Fail-first: c2-context-baseline.log (9/9 fail, resolver absent), c2-model-baseline.log (7/7 fail, no validation). Doctored controls, each restored by hash: reversed order (c2-doctor-order.log, 13 fail incl. both export suites), manual-source precedence removed (c2-doctor-manual.log), explicit form after Ibid. (c2-doctor-explicit.log), bare Ibid. after dropped locator (c2-doctor-locator.log) -- each fails "never produces a false Ibid."; App page-footnote wiring removed fails the browser test (c2-doctor-wiring-browser.log). Focused: 161/161 units, new browser test passes (c2-ibid-browser-first.log). C1 manifest hashes for citations.ts/ResearchPanel.tsx intentionally no longer match: C1 approval covered the frozen source, C2 supersedes it.
C2 qualification: build passes (c2-build.log, c2-build-final.log). Full unit 287/288 (c2-unit.log); the one failure was a 5 s timeout in a PDF export test under load and passes alone, 14/14 (c2-pdf-rerun.log). Full dev-server Chromium 71/74 (c2-browser.log); the 3 failures (2 100k-word perf timeouts, 1 undo-grouping) all pass on the production preview (c2-prod-perf.log, 6/6). The owner said the slowdowns are their Mac, not the change. The A/B agrees: a build with the new per-keystroke work stripped out failed the perf budget, and the real build passed in the same window (c2-ab-doctor.log, c2-ab-real.log; App.tsx restored, hash OK; load average 180-600). After the final UI change (label "Back-to-back repeat", dropdowns stacked so nothing clips): research suite 8/8 on the production preview (c2-prod-research.log); light/dark shots c2-rules-{light,dark}.png inspected. The full suite was not rerun after that label/layout change. No independent review yet. No native/WebKit run (hold).

## Repair rounds
### Round 1 - from REVIEW.md "C2 shared citation context review" 2026-10-23
Owner asked (in chat) to fix M1, M2 and L3.
| Finding | Action | Evidence |
|---|---|---|
| L3 bare Ibid. after manual-placeholder source | fixed | citations.ts marks manualRequired arrays (WeakSet) and exports needsManualNote; noteForms.ts ibidEligible refuses Ibid. when the source's full or short form is the placeholder. New test "refuses Ibid. after a source that still needs a manual citation": baseline fail r2 "ibid" (c2r-l3-baseline.log), fixed 122/122 (c2r-l3-fixed.log). |
| M2 stale docs | fixed | README.md:117, docs/personal-word-v2.md:56 now describe the default plus the opt-in section restart/Ibid. and its exclusions. |
| M1 coverage | fixed | Unit: DOCX/PDF section-scope test (numbers, text, italic part) and Markdown/plain section-scope test; both fail with the section reset removed (c2r-doctor-export-section.log). Imported-fragment fixture via real importFragment: remapped note/source ids, fragment unnumbered, promoted fragment's note is full not Ibid. Browser: new seeded two-section test checks page notes, research preview and the reader Notes list through legacy, opt-in Ibid. (incl. differing page "Ibid., 9."), section scope, drag reorder and reload. It fails when the reader drops the resolved locator (c2r-doctor-reader.log) or App lumps sections (c2r-doctor-sections.log); App.tsx restored by hash. The first Markdown expectation wrongly assumed italics; Markdown notes are plain text (pre-existing), so the expectation was corrected to real output, not loosened. |
| L4 plain-text editor/reader notes | pushed back (out of C2 scope) | Pre-existing; form and locator identical across renderers. Possible later-stage item. |
| L5 untrimmed legacy locators | pushed back (out of C2 scope) | Pre-existing citations.ts behavior; the Ibid. path trims. Question for a later stage. |
| L6 strict policy validation | no change | Owner-approved; a future scope value needs a migration note. |
| L7 noteForms.test.ts / ReadDocument.tsx unchanged | noted | Legacy noteForms tests pass unchanged (they are the compatibility oracle); ReadDocument renders only App-supplied numbers. |
Round 1 full validation after the last change (serial, pinned Node 22.23.3): `npx tsc --noEmit -p .` exit 0 (c2r-tsc.log); `npm test` 292/292 (c2r-unit.log); `npm run build` exit 0 (c2r-build.log); full Playwright on the production preview `-c c2r-full.config.mjs` 75/75 passed, 3.5m, exit 0 (c2r-browser.log). No native/WebKit run (hold). Nothing committed.
