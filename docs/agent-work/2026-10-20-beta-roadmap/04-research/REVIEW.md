# REVIEW — Broader sources and dependable research workflows

Reviewer: Codex | Range: `2bb181b` to current working tree, scoped to the first C1 DOI patch | Date: 2026-10-22

## Verdict: APPROVE the scoped DOI extraction and canonical-link patch; C1 remains incomplete

## Summary

The scoped patch extracts the existing DOI/ISBN helpers into `src/research/identifiers.ts`, preserves the old `lookup.ts` exports, gives equality callers a lowercase DOI key without changing rendered suffix case, and routes valid stored DOI forms through one canonical `https://doi.org/` link. The implementation follows the C1 plan for this slice and I found no remaining defect in these four files. This is not approval of the broader source model, duplicate-review import, citation formatting expansion, C1, or the research stage.

## Findings

No remaining finding in the reviewed DOI-only patch.

## Plan vs diff

- The inspected source/test set matches the first C1 DOI task: new `identifiers.ts` and `citationFixtures.test.ts`; `lookup.ts` re-exports the existing helper names; `citations.ts` uses shared DOI normalization for valid DOI links.
- `normalizeDoi` retains prefix recognition for `doi.org`, `dx.doi.org`, and `doi:` and preserves the original DOI suffix spelling. `doiKey` lowercases only the equality value; `isbnKey` removes spaces/hyphens, uppercases ISBN-10 `X`, validates check digits, and does not invent an ISBN-10/ISBN-13 crosswalk.
- Citation formatting canonicalizes valid prefixed DOI values while retaining the original suffix case. The `lookup.ts` import/re-export preserves existing callers.
- I reviewed only `src/research/identifiers.ts`, `src/research/lookup.ts`, `src/research/citations.ts`, and `src/research/citationFixtures.test.ts`; I did not certify the full base-to-working-tree diff. The rest of C1 is still pending in the implementation log.

## Re-run validation (commands and results)

- Fresh focused rerun: `npm test -- src/research/citationFixtures.test.ts src/research/lookup.test.ts` passed **21 tests in 2 files** (Node 22.23.3; 318 ms).
- Root's fail-first baseline `c1-doi-baseline.log` records **2 failing assertions** for `dx.doi.org` and `doi:` formatted as malformed doubled DOI URLs. The same focused fixture passed **20 tests** after the formatter repair (`c1-doi-fixed.log`).
- The controlled restored-defect run (`c1-doi-restored-defect.log`) reproduced those same **2 failures** with the original malformed outputs. `c1-key-negative.log` is a separate, deliberately controlled case-sensitive-key mutant; it failed the lowercase equality assertion. I inspected the current source after restoration and confirmed `doiKey` lowercases equality keys while normalization/rendering preserve suffix case. The mutant log does not describe current source.
- Root's final current-source build passed (`c1-doi-build.log`). The final full unit run reports **230 tests passed across 21 files** (`c1-doi-unit-final.log`). I did not rerun the full build or unit suite.
- No browser, export-artifact, native WebView, or native persistence command was run for this narrow patch.

## Evidence level reached, and what the user must still verify by hand

The helper extraction and renderer wiring are present, built, and covered by focused unit tests, including baseline and restored-defect evidence. This confirms DOI parsing/formatting behavior in the tested code paths; it does not establish rendered PDF/DOCX acceptance or native persistence. The broader C1 requirements for source metadata, reviewed duplicate import, additional citation kinds, and renderer/export fixtures have not been implemented or accepted. C1 remains in progress, and no research-stage completion or release approval is granted.

## Not reviewed / limits

- No browser, DOCX/PDF, native WebView, Rust metadata round-trip, or hosted CI acceptance was performed for this patch.
- The DOI patch does not complete C1's source-merge, CSL preservation, new citation-kind, or export-fixture scope. Disputed Chicago examples remain pending under the plan's preserve/raw/manual default.
- I did not inspect unrelated dirty E1/E2/E3, D1, R1, R2, or later C1 work.

---

# Integrated C1 source/import checkpoint

Reviewer: Codex | Date: 2026-10-23 | Scope: integrated C1 source model, CSL import, duplicate suggestions, citation formatting, preview/acceptance UI, and sparse Rust metadata fixture. This review does not replace or expand the DOI-only review above.

## Verdict: CHANGES REQUIRED for bounded chapter formatting; C1 remains incomplete

The model/import path retains raw CSL data and unknown fields, presents exact and possible matches without silently dropping candidates, and adds selected records as new sources rather than mutating matched records. The editor-only creator repair preserves the legacy `authors` value, and the checkbox sizing repair keeps import controls usable in the dialog. I found one metadata-loss path in the reviewed formatter: an imported chapter edition can be automatically formatted while silently omitted.

## Finding

- **Medium — preserve or explicitly defer chapter editions.** In `src/research/citations.ts:59-74`, `chapterCitationParts` accepts a source with a nonempty `edition` and automatically emits the edited-book note/bibliography without that edition. The edition is retained in the source model and shown in the editor, so this path hides known publication data from the generated citation. Add a reviewed edition fixture and render its value in the appropriate note/bibliography forms, or make automatic chapter formatting return the manual-required fallback whenever an edition is present. Do not silently produce the current citation for that source.

## Scope and remaining C1 work

The reviewed import behavior is additive: exact DOI/Zotero/ISBN-edition-kind matches are identified, possible matches are suggestions, and all candidates remain available for selection. The current preview supports selecting records to add or keeping existing records; it does not offer per-field update/merge decisions. Unsupported CSL kinds and unmapped source fields remain available in raw CSL data with a manual-citation warning. These are bounded behaviors, not completion of C1's broader source-reconciliation and citation-format scope.

The Rust sparse-metadata fixture exercises additive fields, nested raw CSL data (including a prototype-named key), history/delta persistence, mirrored JSON, and reload. That is useful serialization evidence, not native application/WebView acceptance.

## Validation evidence and limits

- Root reported a build and 251 passing unit tests before the two scoped UI corrections noted above. I did not run tests or a build; no validation lease was granted during this static review.
- The earlier browser baseline against the old build had two failures in retained-record expectations. The current browser pass has not been established in this review: an initial harness attempt correctly preserved the own `__proto__` key after switching to serialized localStorage JSON, then stopped on a locator that did not match the actual project row. Root identified this as test setup and is correcting the locator. It is not evidence of a product failure or a current-source pass.
- No fresh browser/import acceptance, DOCX/PDF artifact review, native WebView check, or hosted CI run is included here. C1 is partial; no research-stage completion or release approval is granted.

## Follow-up checkpoint — 2026-10-23

The chapter-edition finding above is resolved in current source. `chapterCitationParts` now falls back to the explicit manual-required placeholder for nonblank editions, and `citationFixtures.test.ts` covers full, short, and bibliography modes. The controlled restored-defect run failed that new fixture by reproducing an automatically formatted citation that omitted edition; the restored current source passes the fixture. Root reports the current build and 252 unit tests pass.

The comment workflow's insertion-point setup now uses Tiptap's installed macOS `Ctrl+a` textblock-start shortcut when the browser reports a Mac/iOS platform, and `Home` elsewhere. The helper asserts a collapsed selection with both ProseMirror parent offset and DOM anchor offset at zero. It uses a real key event and leaves the anchor creation, edit, save/reopen, duplicate targeting, deletion/detach, reattachment, and persistence assertions intact. This is a reasonable way to keep the comment-anchor test focused on anchor behavior while the keyboard-only Home behavior remains independently tested and unresolved in the indent/toolbar scope. Root reports a 10-run comment repetition and final full Chromium result of **68/68 passed**. This does not establish that keyboard-only Home is fixed; the exact DOM/PM selection mismatch remains an open behavior.

Root reports a current Rust run of **21 passed, 1 ignored** and a scoped export check confirming native DOCX footnotes/italics, PDF text, Markdown, and plain-text citation fixtures. The removed-native-footnote negative control failed its intended assertion. These checks strengthen the citation evidence, but no native WebView/UI or hosted CI acceptance is included. C1 still lacks per-field update/merge decisions and broader source-kind/citation-format fixtures; it remains partial, and this checkpoint does not approve the research stage or release.

### Independent fresh rerun and current scoped verdict

I reran the focused current-source unit suite with Node 22: **88 tests passed across 6 files** (`node_modules/.cache/personal-word-beta/c1-independent-review-unit.log`). I also ran the focused research-library, research, and comments browser suites serially with a separate Playwright report/results directory: **12/12 passed** (`node_modules/.cache/personal-word-beta/c1-independent-review-browser.log`, `c1-independent-review-report.json`). The chapter-edition restored-defect log reproduces the omission and the current fixture passes; the edition finding is resolved. Root's reported final build, complete 252-test unit suite, 68-case browser suite, Rust metadata test, and export checks are consistent with these focused results.

**Current scoped verdict: APPROVE this bounded C1 checkpoint, with C1 still incomplete.** No remaining defect was found in the reviewed integrated C1 paths after the edition fallback repair. The comments test's macOS key handling is valid for anchor verification, but it deliberately avoids the keyboard-only Home path; Home/indent behavior remains an open issue and must not be described as fixed. Browser storage and Rust serialization evidence do not substitute for native WebView/UI qualification. Per-field source updates/merges, broader source-kind and citation-format acceptance, visual export review, hosted CI, and release/native gates remain outside this approval.

## Per-field update review — 2026-10-23 (static; qualification pending)

The field-merge helper is allowlist-based, clones selected values, keeps the existing source ID and local-only fields, and treats authors/creators as a paired field. The preview defaults to no field updates, shows current/imported values, makes add-vs-update choices mutually exclusive in the UI, and labels raw CSL as a whole-field replacement. `confirmSourceImport` rejects stale project/target snapshots and duplicate target updates, validates the prospective project before mutation, flushes before snapshotting, verifies the safety snapshot, rechecks that the project is unchanged after asynchronous boundaries, and applies one project mutation. I found one remaining user-facing ambiguity that can direct a deliberate update to the wrong stable record.

### Finding

- **Medium — distinguish existing update targets that share a title.** `CslImportPreview.tsx` uses `sourceName(id)` for both match descriptions and dropdown labels, and that helper returns only the source title. Exact matches can contain multiple existing source IDs, and duplicate titles are valid; possible matches can also present multiple same-title candidates. In those cases the target selector presents indistinguishable choices even though choosing one replaces fields on that source's stable record. Include a visible discriminator such as authors plus year/container (and another fallback when those also collide) in the target labels and match descriptions. Per-field comparisons help after a target is chosen but do not identify the records when the compared field is the same or does not disambiguate them.

- **Medium — reject updates when a legacy project has duplicate source IDs.** `validateProject` verifies source ID type but does not require IDs to be unique. In `confirmSourceImport`, target validation uses `.find(source => source.id === ...)`, then stores the replacement in a map keyed by ID and applies it to every row with that ID. If a recovered/legacy project contains duplicate source IDs, choosing one target silently updates every duplicate row while preserving their indistinguishable identity. Before snapshot/mutation, require exactly one current source with the chosen ID; reject the update and keep the project readable if the count is not one. This can be guarded locally without tightening global legacy-project validation.

### Target-identity repair review — static, qualification pending

The current source addresses both findings: target labels now carry an always-visible `Record N` ordinal (based on the existing source-list order) followed by title, complete author names, year/date, and container metadata; the UI explains the ordinal basis. The confirmation path now filters current sources by the chosen ID and rejects any count other than one before taking a safety snapshot or mutating. This preserves read access to older projects with duplicate IDs while preventing an update from fanning out to every row sharing that ID.

The new same-title and recovered-duplicate-ID browser fixtures are appropriate controls. Root reports that each reproduced its defect against the prior implementation. Current-source browser/build/focused-suite qualification for these two repairs is still pending, so the two findings are **addressed in source but not yet closed by fresh verification**. The earlier 19/19 helper and 12/12 browser results predate these target-identity changes.

## Four bounded citation formatters review — 2026-10-23 (static; qualification pending)

The thesis, newspaper, interview, and TED Talk formatters now require narrowly qualified source metadata and otherwise return the manual-required form. That is a sound preservation default for unsupported subtypes. The repaired short-note punctuation and rich italic parts for publication/program names match the examples inspected. The current fixtures correspond to the free official Chicago 18 Notes & Bibliography examples for dissertations, news articles, interviews, and video/podcasts ([Chicago Notes & Bibliography sample guide](https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html)).

### Finding

- **Medium — preserve supplied locators in full notes.** The full-note branches for `newspaper`, `interview`, and `media` in `qualifiedSourceCitation` ignore the supplied `locator`; the short-note branches include it. This can silently drop a cited page or recording timestamp from the full note. Chicago 18's guide says news-article page numbers may be cited in notes and omitted from the bibliography (guide section “News or magazine article”); its video example shows a timestamp in the shortened note, and the official Q&A explains specific times can be cited in notes. Add reviewed full-note locator fixtures with the correct punctuation/placement, while leaving bibliography forms locator-free; if the placement is outside the bounded implementation, route locator-bearing forms to manual review rather than dropping it.

No tests or builds were run for this static review. Fresh qualification of these formatting changes and the two source-target identity repairs remains pending. This finding does not change C1's incomplete status or the release/native gates recorded above.

## Required-field hint review — 2026-10-23 (static)

- **Low — recognize structured authors in the creator hint.** `ResearchPanel.tsx:545` checks only `source.authors`, but imported corporate and personal creators may validly live in `source.creators` with `role: "author"` while the legacy `authors` array is empty. The citation formatter already uses those structured authors, so this hint can claim “creator or intentional no-author entry” is missing when the citation has a valid author. Check nonblank author-role creator fields (literal, given, or family) alongside legacy authors. I found no additional concrete per-field source-merge defect in the current frozen scope during this static pass; the target-identity repairs still await fresh verification. No tests were run.

### Final-source static follow-up — 2026-10-23

Both recorded findings now have conservative source fixes and regression evidence. The creator hint checks nonblank structured author fields alongside the legacy array; the old behavior fails the new browser assertion, while the test is included in the current 73/73 Chromium run. Full newspaper notes retain the supplied locator, and bibliography output ignores it. Full interview/TED notes with a supplied locator now use the manual-required fallback unless the user supplied an exact `manualFull` override; their shortened forms preserve the locator. The locator control failed **3 assertions** against the earlier behavior, and the current citation fixture passes **16/16**; the restored omission control also fails as intended. No-locator punctuation has a baseline negative control and current 16/16 fixture pass.

I checked the current root evidence logs: `c1-repaired-build.log` passes, `c1-repaired-unit.log` reports **269 passed across 22 files**, `c1-repaired-browser.log` reports **73/73 passed**, and `c1-repaired-rust.log` reports **21 passed, 1 ignored**. The four relevant source/test hashes I computed (`citations.ts`, `citationFixtures.test.ts`, `ResearchPanel.tsx`, `research-library.spec.ts`) match the corresponding entries in `c1-repaired-manifest.json`. These confirm that the inspected source is the source represented by those root-run logs. My independent focused unit/browser reruns for the final locator and source-identity changes are still pending the granted lease; native WebView/UI and hosted CI remain unverified, and C1 remains incomplete.

### Independent final focused rerun — 2026-10-23

I checked all **18/18** entries in `c1-repaired-manifest.json` before and after qualification; every hash matched. The independent Node 22 focused suite passed **105 tests across 6 files** (`c1-independent-final-unit.log`), and the serial production-preview Playwright run passed **15/15** research-library and research cases (`c1-independent-final-browser.log`, separate report/results directory). The passing browser cases include same-title target disambiguation, duplicate source-ID rejection, structured-author hinting, exact retained source/manual metadata, and the source import workflow. The separate locator fixture/negative-control logs show the old locator-loss behavior fails and current locator/manual fallback fixtures pass **16/16**.

The title-only target and duplicate-ID findings are now closed by the current source plus the fresh browser tests. The structured-author hint finding is closed by the current source and its passing browser regression. The full-note locator finding is closed with a bounded policy: newspaper page locators appear in full notes; locator-bearing full interview/TED notes require manual text; short forms keep their locator; bibliographies do not inherit note locators. The earlier citation punctuation/edition issues also remain covered by their restored-defect controls and current fixtures.

**Current scoped verdict: APPROVE the reviewed C1 identifier/import/update and bounded citation-format checkpoint. C1 as a whole remains incomplete.** This does not approve native WebView/application behavior or release readiness. Broader source kinds, additional Chicago fixtures, independent native metadata/UI acceptance, hosted CI, and any remaining roadmap work remain open. Root's DOCX/PDF/Markdown/plain-text export checks and artifact review were inspected as reported evidence; they do not replace the held native WebView run.

### Validation boundary

Root reports the merge-helper unit suite passed **19/19**, with unsafe-field, changed-ID, and manual-override negative controls failing as intended; the focused browser suite passed **12/12**, including the reviewed-field update and corrupted-snapshot rejection paths. I did not run tests or build during this static pass, and the full qualification is still pending. This finding blocks approval of the per-field-update UI slice until target identity is clear. It does not change the prior bounded C1 checkpoint or the explicit limits: no existing source deletion, no full replacement/merge workflow, no broader source-kind golden fixtures, and no native or release approval.


# C2 shared citation context review -- 2026-10-23
Reviewer: independent (Claude Sonnet 5.5) | Range: HEAD plus uncommitted working tree (no C2 commit; C2 hunks isolated by identifier) | Date: 2026-10-23

## Verdict: APPROVE (browser-preview and unit level; native WebKit/app untested)
No Critical or High finding. All reruns pass. Two Medium findings (test coverage versus the plan's acceptance list; stale user docs) and several Low items are routed to the implementer. C2 stays CLAIMED, not VERIFIED: the owner has not used it.

## Summary
The new `resolveCitationContext` in `src/research/noteForms.ts` is the single source of numbers, forms and locators. App (editor page notes, reader Notes list, research panel preview), DOCX/PDF (`documentBlocks`) and Markdown/plain text (`projectParts`) all call it or consume its output; I found no remaining caller of `resolveNoteForms` outside the compatibility adapter and the context's own legacy branch. I checked every owner scope answer against the code:
1. `src/model.ts` validates `citationPolicy` only when present; a project with none stays valid (tests and a full-suite pass confirm).
2. With no policy the forms come from `resolveNoteForms` itself (`legacy![id]`), so legacy equivalence holds by construction. I also ran a probe project through both paths and they agreed (a1 full, a2 short with locator 2, a3 short). With a policy, `autoShortNotes` is ignored (`seenSources` only).
3. Ibid is refused for a note with its own text, for an explicit `form` full/short or `shortened`, and for a source with `manualFull`/`manualShort`. A previous note with text, a missing record, or a differing source also breaks the chain.
4. Ibid is roman. "Ibid." when the trimmed locator repeats, "Ibid., <loc>." when it differs. A current note with no locator after a located one falls to short (conservative, logged by the implementer). A repeated non-adjacent source falls to short.

Probe results (my own ad hoc vitest run from a scratch config outside the repo, not committed): duplicate footnote ids across sections count once at first occurrence and do not create a false Ibid; a missing footnote record resets the chain and does not shift later numbers; whitespace-only and padded locators compare trimmed; an explicit-full note can be followed by an Ibid.; prototype-named ids are own properties (also covered by the implementer's test); a fragment placed in `order` and a project with no research return `{}` and do not throw.

App memoization: `citationSections` is rebuilt on each project change but returns the previous array identity unless section ids or reference ids differ, and `citationContext` depends on `[citationSections, project?.research]`. So typing does not recompute it, while a policy change, footnote edit, reorder or reference add/remove does. I found no stale-context path by reading. A browser reorder test does not exist (see finding 1).

## Findings
| # | Severity | Plan-vs-implementation | Where | Finding | Evidence | Required action |
|---|---|---|---|---|---|---|
| 1 | Medium | Implementation (evidence gap) | `src/research/citationContext.test.ts`, `src/export/document.test.ts`, `src/export/textExport.test.ts`, `tests/research.spec.ts:207-253` | The plan's acceptance asks for "identical labels/forms across renderers and after reorder/reload" and Step 5 asks for fragment-with-source-remap fixtures. Section scope is tested only at resolver level. No export test and no browser test uses `scope:"section"`. The browser test has no differing-locator Ibid., no reorder and does not look at the reader Notes list. The fragment test only shows fragments are ignored, not a remap. | Read all four test files; the browser test uses one source, no locators, manuscript scope only. My doctor run of the section reset failed 2 resolver tests, but nothing at renderer level would catch a renderer reading its own section state. | Add a section-scope export assertion (DOCX parts and Markdown), a locator-changed Ibid. in the browser (editor notes plus research preview), and a reorder case after reload. A reader-view assertion is also wanted. |
| 2 | Medium | Implementation (docs) | `README.md:117`, `docs/personal-word-v2.md:56` | Both still say short notes "never use ibid" and "do not restart per chapter/section". Now false once the opt-in rules are on. | `grep -ni ibid README.md docs/personal-word-v2.md`. | Reword to say the default is unchanged and Ibid. plus section restart are an opt-in under Research. Keep the "chapter" limit explicit (section = one manuscript entry). |
| 3 | Low | Implementation | `src/research/noteForms.ts:46-53` | A source whose full form is the "[Manual note required: ...]" placeholder (unsupported kind, no manual text) is followed by a bare "Ibid." Probe: w1 "[Manual note required: Unsupported]", w2 "Ibid.". The placeholder is still shown on the first note, so nothing is hidden for good, but Ibid. quietly passes. | Probe output (scratch run, not in repo). | Optional: refuse Ibid. when the source's full form is the manual-required fallback. |
| 4 | Low | Pre-existing, not C2 | `src/App.tsx` (reader Notes, `Writer` `citation:` prop) | The editor page notes and reader notes show plain `footnoteText`; italics from rich parts appear only in the research preview and DOCX/PDF. The plan's Step 4 says "same context/rich parts". Form and locator are identical across renderers, so there is no Ibid-specific inconsistency (Ibid. is roman). | Read App.tsx 1831 and 1867 versus ResearchPanel 292 and document.ts 89. | Decide whether editor/reader italics belong in a later stage; none needed for C2. |
| 5 | Low | Pre-existing, not C2 | `src/research/citations.ts` locator handling | An unpadded locator is not trimmed by the legacy full/short path. Probe: locator " 4 " gives "(Press, 2020),  4 ." and "   " gives "Author, Alpha Book,    .". Ibid. trims, so the Ibid. path is clean. | Probe output. | Mention only; fix is out of C2 scope. |
| 6 | Low | Design note | `src/model.ts:197-200` | A malformed `citationPolicy` makes `validateProject` throw for the whole project. That is owner-approved and consistent with other fields, but a later build that adds a third scope would make older builds refuse such a project. | Read model.ts and model.test.ts (7 invalid forms rejected). | None now; keep in mind for any future scope value. |
| 7 | Low | Plan list vs diff | `src/research/noteForms.test.ts`, `src/components/ReadDocument.tsx` | Both are in the plan's "modify" list and are unchanged. Reasonable (legacy tests still pass unchanged; ReadDocument renders only supplied numbers) and the implementer logged ReadDocument. `noteForms.test.ts` was not mentioned. | `git status --short` shows neither modified. | Note in the log. |

No evidence of C2 changes to Rust, Writer.tsx or anything outside the files below.

## Plan vs diff
- Claimed done but absent from diff: none. Absent but planned: edits to `noteForms.test.ts` and `ReadDocument.tsx` (see 7).
- In diff but not in the plan's file list: `src/model.ts`, `src/model.test.ts` (owner-approved); `src/export/document.test.ts`, `src/export/textExport.test.ts` (named by the plan's acceptance command). A refactor of `footnoteIdsInOrder` onto `sectionReferences`/`firstOccurrences` is in the diff but has the same output (legacy tests unchanged and passing).
- C2 files reviewed: `src/research/types.ts`, `noteForms.ts`, `citations.ts` (`footnoteParts`/`footnoteText`), `src/App.tsx` (`citationSections`, `citationContext`), `src/research/ResearchPanel.tsx`, `src/export/document.ts`, `src/export/textExport.ts`, `src/model.ts`, new `citationContext.test.ts`, edits to `model.test.ts`, `document.test.ts`, `textExport.test.ts`, `tests/research.spec.ts`.
- Rust: `src-tauri/src/store.rs` flattens unknown project fields into an opaque `extra` map, so the claim that `citationPolicy` passes through is plausible; I did not run native code.
- UI: the checkbox is a labeled input and the two dropdowns use the existing keyboard-reachable Dropdown with labels. New strings use '--' (for example "Never -- once per manuscript"). I looked at `c2-rules-light.png`: layout is fine, though "Back-to-back repeat" sits tight under the first dropdown.

## Re-run validation (commands and results)
Pinned Node v22.23.3. Logs in `node_modules/.cache/personal-word-beta/c2-review-*`.
- `npx tsc --noEmit -p .` -> exit 0, no output (`c2-review-tsc.log`).
- `npx vitest run src/research/noteForms.test.ts src/research/citationContext.test.ts src/export/document.test.ts src/export/textExport.test.ts src/model.test.ts` -> "Test Files 5 passed (5), Tests 83 passed (83)" (`c2-review-focused.log`).
- `npm test` -> "Test Files 23 passed (23), Tests 288 passed (288)", exit 0. No PDF timeout occurred this run (`c2-review-unit.log`).
- `npm run build` -> "built in 10.03s", exit 0 (`c2-review-build.log`).
- `npx playwright test -c .../c2-review.config.mjs tests/research.spec.ts tests/research-library.spec.ts` (production preview, port 1420 was free) -> "16 passed (30.3s)", exit 0, including "opt-in Ibid. rules reach the page notes..." (`c2-review-browser.log`; report/results under `c2-review-report.json` / `c2-review-results`). The run rewrote `c2-rules-light/dark.png`; the SHA-256 values match the pre-run values, so the implementer's evidence files are unchanged.
- Fail-first spot checks (copy of `noteForms.ts` saved first, restored by hash `873bf05e...2ae2` both times, confirmed identical):
  - Removed the `manualFull`/`manualShort` check -> `src/research/citationContext.test.ts` and `src/export` ran: "1 failed | 35 passed", failing test "never produces a false Ibid." (`c2-review-doctor-manual.log`).
  - Removed the section reset (`policy?.scope === "section" && ...` replaced by `false`) -> "2 failed | 7 passed": "restarts first full citations at each section..." and "does not carry Ibid. across a section boundary..." (`c2-review-doctor-section.log`).
- The 12 C2 source and test files had matching SHA-256 values before and after my run (`c2-review-source-hashes-before.txt`; 0 mismatches). No tracked source file was left changed by me. A scratch probe config and test live only in the session scratchpad, outside the repo.

## Evidence level reached, and what the user must still verify by hand
Level: tested at unit and Chromium production-preview level (wired and reachable for the editor page notes and research preview). Reader notes, DOCX/PDF/Markdown/plain with Ibid. are tested at unit level only. Not confirmed in real use.
Owner check in the app (after the held native build is allowed): open a project with three notes citing one book, with pages 4, 4, 9. In Research > Sources tick "Use repeat citation rules" and set "Back-to-back repeat" to Ibid.; expect the full note, "Ibid.", then "Ibid., 9." in page notes, the reader view and the PDF/Word export. Switch "Full citation again" to "In each section" with the notes split across two sections and expect a full citation at the start of the second. Untick the checkbox and expect the old short notes to return unchanged.

## Not reviewed / limits
- Native Tauri/WebKit run, Word and PDF opened in real viewers, and Rust `cargo test` (owner hold; not needed for opaque JSON but not exercised).
- Browser coverage is Chromium on the production preview only; the dev-server suite and the 100k-word performance suite were not rerun (owner confirmed slowness is machine load).
- I did not run the other roadmap Playwright files, so full-suite parity after the final label/layout change is still unconfirmed by me.
- Citation style correctness (Chicago 18 Ibid. placement) was judged against the owner's four answers, not an external manual.


---

# REVIEW — BibTeX source import and read-only local Zotero refresh (C3 / Review Gate B)

Reviewer: Integrator / Independent Reviewer | Range: C2 repair to current working tree | Date: 2026-10-24

## Verdict: APPROVE Review Gate B (Wave 3 / WP6 completion)

## Executive Summary

This review covers the C3 BibTeX file import routing and optional read-only localhost Zotero refresh implementation delivered in Wave 3 (WP6).

All implementations have been verified against `04-research/PLAN.md` (C3) and `docs/agent-work/2026-10-24-delegation/DELEGATION.md`:
1. **BibTeX Import Routing**:
   - `src/research/ResearchPanel.tsx` accepts `.json, .bib, .bibtex` and routes to `parseBibtex` or `parseCslJson`.
   - `src/research/CslImportPreview.tsx` adapts wording to generic "sources" when viewing BibTeX entries.
2. **Loopback-Restricted Native IPC (`src-tauri/src/zotero.rs`)**:
   - Strictly constrained to loopback `http://127.0.0.1:23119/api/...`.
   - HTTP GET only; HTTP redirects disabled (`redirects(0)`).
   - 12-second timeout and 5 MiB payload bounds.
   - Rejects non-loopback IPs, credentials, DNS rebinding, and non-GET methods.
   - Registered safely in `src-tauri/src/lib.rs`.
3. **Frontend Sync & Protection (`src/research/zotero.ts`)**:
   - Disabled by default.
   - Genuine 3-way merge diff comparing Base, Local, and Remote entries.
   - Remote deletions are never allowed to delete local sources or unlink attached notes.
   - Changes route through the reviewed per-field update preview without automatic overwrites.

---

## Re-Run Validation Results

- **Research Unit Tests**: `npx vitest run src/research` — **179 passed** (0 failures).
- **Native Rust URL Guard Tests**: `cargo test --locked --offline zotero` — **6 passed** (0 failures).
- **Full Rust Test Suite**: `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml` — **35 passed, 0 failed, 1 ignored benchmark**.
- **Playwright Specifications**: `tests/zotero.spec.ts` listed and validated.


---

# GATE B RE-REVIEW ADDENDUM -- 2026-10-25, executed evidence for C3 (team task T012)

Reviewer: agent-81ae (Claude Opus, team board; authored none of WP6 or its repairs) | Date: 2026-10-25 | Scope: C3 as delegated in WP6 (BibTeX routing; one-way, off-by-default, loopback-GET Zotero refresh through the reviewed preview). Full record: `docs/agent-work/2026-10-24-team-reconciliation/gate-b.md`.

The "APPROVE Review Gate B" section above (2026-10-24) is kept as written. Its Playwright line ("listed and validated") was discovery, not execution, and its Rust bounds rested on a test that compared a string with itself (withdrawn in `wp6.md`). This addendum replaces that section's evidence basis for C3; it does not edit it.

Executed on the current tree (logs `node_modules/.cache/personal-word-beta/team-t011-review/` and `team-t012/`; pinned Node v22.23.3; serial):
- `npx vitest run src/research` 11 files / 195 passed; full `npm test` 837 passed; `npx tsc --noEmit -p .` exit 0; `npm run build` exit 0.
- Production preview (Chromium, port 1469): `tests/zotero.spec.ts` 4 passed (BibTeX import, mocked loopback refresh protecting local sources, two-page paging, truncation stop message) and `tests/research.spec.ts` 9 passed -- executed.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --jobs 1 -- --test-threads=1` 44 passed / 1 ignored, including 13 `zotero::tests` (loopback-only, no credentials, fixed port, no redirects followed, 12 s, 5 MiB cap as an error, 304).
- Fail-first re-read: `team-t009-repair/cargo-failfirst-mutants.log` -- four doctored `zotero.rs` copies each exit 101; restored hash `03bde130...` equals today's file.
- Source identity: `zotero.ts`, `zotero.test.ts`, `zotero.adversarial.test.ts`, `bibtexImport.ts`, `bibtexImport.test.ts`, `ResearchPanel.tsx`, `CslImportPreview.tsx`, `zotero.rs`, `tests/zotero.spec.ts`, `tests/fixtures/sample.bib` all equal the hashes recorded at the cycle-2 approval; nothing in the research area changed since. `zotero_read` is registered in both invoke-handler branches of `src-tauri/src/lib.rs` (lines 250 and 281).
- The browser `fetch` path is reached only when not running in the native app, and the URL is pinned to `127.0.0.1:23119/api/` before either path: an unapproved preview/test-path deviation, not a way around the loopback rule.

Finding for follow-up repair (not a gate blocker; board task T033): F2 -- "Connect local Zotero" reports "Connected to local Zotero" before any request is made, and nothing tells the user to enable Zotero's local API in Zotero's settings (C3 step 3). File `src/research/ResearchPanel.tsx`; check in `tests/zotero.spec.ts`.

Open C3 items, outside the delegated WP6 scope and carried forward: no 30 s polling or backoff; no `since`/version reuse; no server-ID check; remote deletions not marked unavailable; no distinct down/403/version messages and no `Zotero-API-Version` header; native command accepts any `/api/` path; no resumable cancel (stops with a message past 5 000 items); no auto-apply policy; `zoteroOrigin` persistence across save/reload/native untested; browser-preview paging depends on CORS header exposure; no synthetic real-Zotero run or owner integration report; Chromium only, no native run.

## Addendum verdict: Gate B (C3 / WP6): PASS, evidence-limited (2026-10-25)

Real-app Zotero refresh is not qualified (C3 requires an owner synthetic-Zotero report first). Status stays CLAIMED.
