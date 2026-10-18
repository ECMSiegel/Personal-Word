# Personal Word application improvement plan

Created: 2026-10-17

Status: implementation pass in progress; see the dated execution log and checklist below. Several platform- and parser-dependent acceptance items remain blocked or incomplete.

## Objective and scope

Improve the existing application before undertaking public-repository preparation. Deliver a dependable local writing workflow: create or import writing, edit and organize it, recover earlier work, and export with predictable results. Preserve the existing restrained Mac-first design and functionality.

This plan authorizes application engineering, focused source organization, internal documentation, verification, and a fresh local desktop build. The user has explicitly requested execution of the plan.

Publication preparation is a separate later project. Do not create a remote, publish or push, select a license, add contribution/security policies, set up CI, rewrite Git history, sign/notarize a distribution, or perform a publication-oriented secrets/history audit as part of this plan. Do not build cloud sync, accounts, billing, collaboration, or a general Word replacement.

Do not turn folder organization into disk cleanup. Preserve user writing, recovery data, existing release bundles, unrelated work, and the currently untracked `.claude/` directory. Do not delete caches, other agents' worktrees, or old applications. Generated artifacts remain out of Git. No commits or staging are required by this plan unless separately requested.

## Required starting context

Read `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/personal-word-v2.md`, and `docs/validation.md`. Inspect the current diff and commit history before editing. File paths and counts below describe the reviewed checkout and may have changed; verify them rather than overwriting newer work.

The review baseline was commit `c62332c` with an untracked `.claude/` directory. Recent commits introduced project tabs, research/citations, export, page layout, fragment editing, footnotes, and sidebar changes. The review found:

- `npm run build` passed; `npm test` passed 60 tests in 9 files.
- The browser suite passed 30 of 31 cases; the rename/delete/recovery case reached its final storage check and timed out at 90 seconds. It passed on an isolated rerun. Do not call this a confirmed application defect or silently describe the full run as clean.
- Fresh Chromium light/dark screenshots were inspected. These do not qualify native macOS rendering.
- The Rust dependency rebuild was stopped before completion. Prior recorded Rust/native smoke successes are historical evidence, not fresh verification.
- `src/App.tsx` was about 2,024 lines; `src/Writer.tsx` about 1,182; `src/research/ResearchPanel.tsx` about 797. Line count motivates inspection, not arbitrary size targets.
- `src/save-queue.ts` uses a resettable 250 ms trailing debounce with no maximum wait.
- `src/export/document.ts` omits strikethrough and flattens list structure to text prefixes. PDF has explicit font, Unicode, long-token, and footnote limitations. Export tests establish basic generation, not complete fidelity.
- The project library exposes JSON recovery import but no general manuscript import.
- Documentation contains contradictory historical/current statements, including references to absent research/export features and a removed reading-progress bar.

Run expensive browser, frontend-build, and native-build jobs sequentially on this machine. The prior concurrent run was very slow; resource contention is a possible contributor, not a proven cause of its timeout. Prefer existing dependencies and focused checks before broad qualification.

## Non-negotiable compatibility rules

1. Keep `com.folio.writing`, existing `folio.*` keys, other existing preference keys, native event names, database paths, and persisted field meanings compatible. Branding cleanup is not permission to rename persistence identifiers.
2. Keep immutable project changes, increasing revisions, serialized SaveQueue writes, navigation/quit flushes, and safety snapshots before destructive restoration or edits.
3. Preserve all project/entry metadata through native serialization, deltas, journals, snapshots, mirrors, imports, and exports that promise full-project preservation. Manuscript formats do not promise to carry all app metadata; explain that distinction.
4. Use the shared editor schema for import validation and update Rust validation for any genuinely new nodes/marks. Prefer existing representations and avoid an unnecessary schema migration.
5. Use isolated test storage and an isolated native application identifier. Never repair tests by deleting real writing or recovery data. Forced termination tests may target only the harness-owned process and temporary data directory.
6. Preserve live system appearance, reduced motion, sans-serif UI, blue semibold sidebar selection, global sidebar sizing/pinning, per-project collection preferences, and independent manuscript-reading settings.
7. Do not promise identical editor, DOCX, and PDF pagination or physical power-loss durability. Distinguish verified behavior, known limits, and unverified cases.
8. Work serially by default. If the user later authorizes parallel agents, assign explicit file ownership; one integrating agent owns shared types, dependency changes, and integration.

## Execution and reporting

Work in the phases below. Keep a progress checklist in this file, recording completed work, changed paths, verification evidence, and unresolved limitations. Separate mechanical moves from behavior changes so regressions are traceable. Revalidate affected behavior after each phase, and run the full final gates once integration is complete.

Use reasonable implementation judgment without repeatedly asking about reversible details. If a real platform or tooling blocker prevents verification, document the exact blocker and finish independent work. Never mark a blocked acceptance criterion complete. Do not replace an agreed feature with a documentation disclaimer merely to finish faster.

### Phase 0 -- Establish the baseline and behavioral contracts

Starting points: existing tests, `src/model.ts`, `src/save-queue.ts`, `src/storage.ts`, `src/editor/extensions.ts`, `src-tauri/src/store.rs`, and the native smoke harness.

- Inspect current status and identify other agents' changes. Preserve unrelated edits.
- Run the existing unit suite and focused browser workflows. Reproduce a failure in isolation before deciding whether it is a defect, stale assertion, or test-timing issue.
- Inventory editor nodes/marks, paragraph attributes, project metadata, import/export support, and settings ownership. Use this inventory to drive export/import acceptance, not incidental implementation details.
- Capture representative synthetic projects: plain prose; mixed formatting and nested lists; research/footnotes/comments/fragments; long documents; and multilingual text.
- Record starting performance and native verification availability. Avoid committing generated bulk fixtures or machine-specific evidence paths unnecessarily.

Acceptance: a concise baseline exists in the progress log; preservation invariants and representative fixtures are identified; no real user data is used.

### Phase 1 -- Bound autosave delay and strengthen recovery

Starting points: `src/save-queue.ts`, its tests, `src/storage.ts`, `src-tauri/src/store.rs`, `scripts/native-smoke.py`, and `tests/native-smoke.js`.

- Retain the responsive trailing debounce, but introduce a named maximum wait from the first pending unsaved edit. Start with a 2-second maximum scheduling interval; adjust only with measured justification.
- Continuous input must not reset this deadline indefinitely. Do not overlap writes. If persistence is already running, retain the newest pending state and drain it promptly afterward.
- Define the promise accurately: the maximum interval bounds when a healthy queue attempts persistence; slow I/O, errors, suspension, and blocked event loops can exceed the interval. Never present it as a strict maximum possible data-loss duration.
- Handle both timers consistently on flush, success, failure, project switch, and close. Preserve retries, revision/base-revision checks, incremental payloads, and journal retention until corresponding data is confirmed saved.
- Examine journal-write failure behavior: attempt disk persistence promptly, keep failures actionable, and avoid error messages that claim protection the code is not providing.
- Add deterministic tests for continuous edits faster than the debounce, normal pause-to-save, edits during slow persistence, failures/retry, newest-journal retention, and switching/closing with pending work.
- Extend isolated native testing to acknowledge a committed checkpoint, continue typing, forcibly terminate only the test process, reopen, and verify at least the acknowledged checkpoint survives with valid metadata. Verify database integrity and mirror reconciliation; a mirror may legitimately lag after a kill.
- Check behavior when more than one app process opens the same project. Verify conflict rejection; if the single-writer assumption is not enforced adequately, add an appropriate instance/project ownership guard with a clear user message. Do not claim cross-process support from an in-process mutex alone.

Acceptance: continuous typing produces periodic successful native saves under healthy conditions; no overlapping writes or stale-revision overwrite; recovery tests preserve committed writing and metadata; quit/switch failure guards still work. Record the separate browser-journal, SQLite-commit, and mirror durability boundaries.

### Phase 2 -- Make export preservation explicit and reliable

Starting points: `src/export/document.ts`, `docx.ts`, `pdf.ts`, `ExportPanel.tsx`, existing export tests, and editor extensions.

- Create a support matrix covering every currently supported editor node/mark and relevant setting across DOCX and PDF. Include strike, links, headings, nested ordered/bulleted lists and start values, blockquotes, code, hard/page breaks, alignment, indentation, spacing, font family/size, footnotes, and bibliography.
- Preserve strikethrough in the shared representation and both exporters.
- Retain list nesting and numbering semantics in the intermediate representation. Emit genuine editable DOCX lists; render correct nesting/numbering in PDF. Do not flatten semantic information early and attempt to reconstruct it afterward.
- Fix other silent formatting loss exposed by the matrix. Preserve supported formatting or surface a specific pre-export limitation for genuinely unsupported features. Warnings must not become a blanket substitute for implementing existing editor features.
- Improve PDF font support using legally embeddable bundled open fonts or another justified local solution. Do not bundle proprietary installed fonts. Support common non-ASCII manuscript text beyond the current standard-font restriction; explicitly detect remaining unsupported scripts/glyphs before writing a file. Correct shaping and fallback are required before claiming support for a script.
- Wrap long words/URLs without dropping characters or producing invalid layout. Add flowing long-footnote support where practical within the exporter; if it requires a major layout-engine replacement, retain explicit rejection, explain the exact limitation before export, and document that portion as deferred rather than solved.
- Preserve independent reading preferences and export settings. Present font substitution, pagination differences, and remaining limitations before export/preview when relevant. On failure, leave the project unchanged and offer a useful alternate format.
- Strengthen tests: unzip DOCX and inspect actual footnote definitions/references, numbering relationships, strike/format runs, and supported settings. For PDF, check content preservation, page bounds/overflow, footnotes, and unsupported-character handling. A ZIP signature or page count alone is insufficient.
- Render representative PDF and DOCX artifacts for visual review, including long paragraphs, nested lists, mixed formatting, Unicode, multiple notes, and a long note. Follow applicable document/PDF skills when rendering artifacts. Record the renderer; do not claim Word application verification from a different renderer.

Acceptance: known strike/list losses are fixed; the support matrix matches implementation; exported content and representative layouts are verified; no silent truncation or unannounced destructive substitution; remaining genuine format limitations are visible and documented.

### Phase 3 -- Add a straightforward manuscript import workflow

Starting points: `src/components/ProjectLibrary.tsx`, import logic in `src/App.tsx`, `src/model.ts`, and the editor schema.

- Add a clearly labeled `Import writing` action accepting UTF-8 `.txt`, `.md`, and `.markdown`. Keep full-project JSON recovery available and distinguish it from manuscript import.
- Show a lightweight preview with inferred title, file type, and any warnings. Import into a new project by default, leaving the source file and existing projects untouched. Do not auto-split headings into sections without an explicit option.
- Preserve paragraphs, line breaks, Unicode, and punctuation in plain text. For Markdown, support headings, emphasis, strong, strike where recognized, links, lists, quotes, code, and breaks using the shared schema.
- Use a maintained parser when appropriate; do not implement a Markdown parser with ad hoc regular expressions. Disable raw HTML execution and automatic remote fetching. Unsupported images, tables, or syntax must retain meaningful text/markup with a warning instead of vanishing.
- Validate before persisting, allocate a fresh identity, retain imported content through native save/restart, and report decoding/size/parse failures without leaving a partially created project. Set and document a sensible input-size policy with a useful error rather than risking a hang.
- Test empty files, CRLF/LF, UTF-8 BOM, non-ASCII prose, malformed input, unsupported constructs, nested Markdown, cancel, and restart after import.

Acceptance: a writer can import an existing text/Markdown manuscript without copy/paste; original files are untouched; supported content survives native reopening; JSON recovery still preserves app metadata.

DOCX import is explicitly a later enhancement, not required in this pass. Do not advertise it or add a nonfunctional option.

### Phase 4 -- Clarify page view and improve everyday usability

Starting points: `src/Writer.tsx`, `src/editor/FootnoteArea.tsx`, `footnoteLayout.ts`, toolbar controls, sidebar, dropdowns, and related CSS.

- Keep continuous view the approachable default for new projects, while preserving existing users' selected views. Label page counts as belonging to the current section. Explain once, near relevant controls, that export pagination is independent.
- Preserve horizontal page navigation if replacing it would require an unrelated editor rewrite. Make navigation obvious and keyboard-accessible, keep caret/selection visible, and prevent horizontal layout drift at supported window sizes and zoom levels.
- Inspect footnote reserve and overflow behavior. Avoid clipped/inaccessible note content; provide an actionable fallback to continuous view for notes the page renderer cannot accommodate. Do not imply an improved per-page layout algorithm unless it is actually implemented and verified.
- Improve small secondary text and control hit areas without overcrowding the document. Use a consistent type/spacing scale; aim for 12-13 px secondary UI and at least 28-32 px common control hit areas where layout permits. Validate at the minimum supported window size as well as typical desktop sizes.
- Make icon controls understandable through accessible names, tooltips, shortcut hints, and logical grouping. Ensure the More menu contains all overflowed actions. Keep infrequent actions out of the main writing path.
- Add brief contextual first-use guidance for fragments, research, import, and save status. Keep guidance dismissible, keyboard-accessible, and free of slogans or decorative onboarding.
- Audit custom dropdown semantics, focus visibility/restoration, Escape behavior, dialogs, tab order, resizers, hover-only controls, and drag alternatives. Test zoom, light/dark, reduced motion, and long labels. Perform a native VoiceOver check when available.
- Preserve independent manuscript-reading settings, project/entry selection, undo history across view changes, and the current selected-sidebar style.

Acceptance: core workflows can be completed by keyboard; controls remain reachable at supported sizes; light/dark screenshots show usable sizing/contrast; page-view limits are understandable; native editor/layout checks pass or are explicitly recorded as blocked.

### Phase 5 -- Refactor ownership and organize the source tree

Do focused extraction alongside earlier phases when it reduces risk; finish the structural pass after behavior is stabilized. Avoid a blanket rewrite or a new state-management framework merely for organization.

Proposed destination structure (adapt names to actual ownership; create no empty placeholder directories):

```text
src/
  app/                 # shell, navigation, project lifecycle, dialogs
  domain/              # project/entry model, invariants, templates
  persistence/         # storage adapter, SaveQueue, journals/recovery
  editor/              # Writer, schema, toolbar, layout, footnotes
  components/          # genuinely shared controls and workspace widgets
  research/            # source management, citations, lookup
  organization/        # fragments, comments, revision comparison
  import/              # manuscript parsing, validation, import flow
  export/              # document representation, renderers, export UI
  styles/              # shared tokens and global/base styles
docs/
  architecture.md      # current system and directory map
  personal-word-v2.md  # current feature/limitation guide, retained link
  app-history.md       # verified history and major decisions
  validation.md        # dated verification evidence and limits
  plans/               # implementation plans and progress
  evidence/            # small intentional synthetic evidence only
tests/                 # browser/native workflow tests
scripts/               # development and verification scripts
```

- Keep `src/main.tsx` as the entry point. Move `App.tsx`, model/storage/queue/templates, and Writer only as justified by the ownership structure; update all imports, scripts, test configuration, and documentation atomically.
- Extract project opening/switching/closing/recovery orchestration, dialog handling, and navigation from App. Maintain one authoritative project mutation/save path; do not create competing copies of project state.
- Extract editor layout measurement, footnote placement, and toolbar composition from Writer without remounting the editor on routine view/setting changes or breaking undo/selection/IME behavior.
- Consolidate global design tokens and conflicting repeated CSS rules. Keep feature styles near their feature. Preserve visual output during mechanical moves; do not combine unrelated redesign with a rename.
- Split Rust storage code only where a genuine responsibility boundary helps review (validation, history, mirrors, persistence tests). Do not require a Rust file split solely to meet line-count targets.
- Keep unit tests beside the relevant module and browser/native tests in `tests/`. Fix stale comments, misleading test names, and obsolete import paths. Avoid unnecessary barrel exports and circular dependencies.
- Document dependency direction: domain code should not import React views; persistence should not depend on UI components; app orchestration joins these boundaries.

Acceptance: source layout has clear ownership; behavioral tests remain green after moves; no duplicated state/save authority; architecture documentation points to real modules; no user-data or unrelated-folder cleanup occurred.

### Phase 6 -- Reconcile documentation and add app history

- Update `docs/architecture.md` to describe the current model, multiple fragment editors where applicable, research, import/export, bounded saves, backend boundaries, folder organization, and verified limits. Remove contradictions rather than appending another correction section.
- Update `docs/personal-word-v2.md` as the current feature/limitation guide. Keep existing links valid; do not rename it just for tidiness.
- Correct stale functional claims and instructions in README, including obsolete reading-progress text. This is factual maintenance, not the later public-facing marketing/portfolio rewrite.
- Create `docs/app-history.md` from verified Git history and existing evidence. Cover the initial local-first workspace, durability changes, display-name transition, expanded writing workflows, UI/footnote/fragment iterations, and this improvement pass.
- Each history milestone should give date/commit references, what changed for writers, the relevant architectural decision, verification actually performed, and any material limits. Do not invent author attribution, release versions, dates, or test results. Separate initial implementations from later corrections.
- Explain why legacy storage identifiers remain, why browser preview differs from desktop, and why local-first operation and independent export pagination are deliberate boundaries.
- Keep history concise and useful; Git remains the detailed source history. `app-history.md` is not a transcript dump. Current instructions belong in current docs, not buried in history.
- Update `docs/validation.md` with exact commands/results and browser/native/export distinctions. Prefer source revision and relative evidence links over private machine paths. Explain any retries/timeouts and unresolved manual checks.

Acceptance: the current docs agree with each other and the implementation; app history is traceable; no historical test result is presented as fresh evidence; publication preparation remains deferred.

### Phase 7 -- Integrated qualification and local delivery

Run sequentially after integration:

```sh
npm run build
npm test
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
```

Use the documented isolated native smoke build and harness, extended by Phase 1. Run native editor/layout/import/export/save/restart checks against a freshly built binary. Verify temporary storage isolation before executing interruption tests. Restore a normal non-smoke build for delivery.

- Exercise a realistic research-heavy project through import, editing, fragments, comments, notes, snapshots, export, quit, and reopen. Compare content/metadata with the expected fixture.
- Repeat long-manuscript measurements with approximately 100,000 words distributed across sections and a separate large-single-section case. Measure UI responsiveness and save costs separately; do not present the old Node-only benchmark as WebKit latency. Record environment and workload, investigate material regressions, and avoid hardware-independent promises.
- Review actual light/dark native screenshots for key views and exported PDF/DOCX artifacts. Chromium-only results cannot close native layout acceptance. If native screenshots, VoiceOver, or a DOCX renderer are unavailable, record those precise gaps.
- Rebuild the desktop app with `npm run tauri build` after all source changes. Verify the output is the fresh `src-tauri/target/release/bundle/macos/Personal Word.app`, built without native-smoke. Do not offer a stale bundle or delete older bundles.
- Inspect the final diff and Git status. Keep generated binaries, large reports, temporary manuscripts, and test storage out of Git; preserve unrelated untracked content.

Final report must identify delivered changes, exact check results, remaining limitations/blockers, documentation paths, and the verified fresh app path. Distinguish completion of this application plan from readiness for public distribution. Do not publish anything.

## Completion checklist

- [x] Baseline and compatibility contracts recorded; see Execution log.
- [x] Autosave maximum wait and recovery behavior implemented and fully verified. (2 s scheduler with dedicated fake-timer deadline/slow-I/O cases plus an isolated three-phase native recovery run.)
- [x] Native interruption and single-writer behavior qualified. (Unix advisory lock with a Rust handle test; the isolated native harness passed quit flush, SQLite integrity, portable-mirror equality, journal recovery after deliberate termination, and snapshot restoration. Owner real-use confirmation is still outstanding.)
- [x] Export strike/list preservation fixed; support matrix and artifact checks added. (DOCX XML inspected with JSZip and both artifacts rendered in QuickLook; Word rendering remains owner verification.)
- [x] PDF Unicode/font and long-token handling improved; remaining limits explicit. (Bundled Noto subsets cover Latin, Latin Extended, Greek, and Cyrillic; other scripts are rejected, and a note that cannot fit its page is reported rather than silently degraded.)
- [x] Safe text/Markdown manuscript import delivered. (UTF-8 `.txt` and `.md`/`.markdown` up to 5 MB with a sanitized preview; remote images are never fetched.)
- [x] Page-view expectations, footnote overflow, and navigation clarified in UI/docs.
- [ ] UI sizing, discoverability, keyboard/focus behavior, and accessibility improved. (Focusable dropdown listbox, focus-visible outlines, toolbar overflow handling, and four accessibility browser scenarios added; native light/dark screenshots and VoiceOver remain owner confirmation.)
- [ ] App/editor responsibilities extracted and source organization documented. (Footnote layout moved to `src/editor/useFootnoteLayout.ts`, dialog rendering to `src/app/ProjectDialogs.tsx`, and the dependency direction documented; the wider App orchestration and Rust storage layout are unchanged by design.)
- [x] Current docs reconciled and `docs/app-history.md` created from evidence, with verification limitations recorded.
- [x] Full integrated checks, native checks, and artifact review recorded. (`npm run build`, `npx tsc -b`, `npm test` 77/77, `cargo test` 17 passed/1 ignored, `npm run test:e2e -- --workers=1` 37/37, an isolated three-phase native run, DOCX XML inspection, and QuickLook renders of both artifacts. Owner interaction checks and Word rendering remain open; see `docs/validation.md`.)
- [x] Fresh normal desktop build verified and delivery path recorded.
- [x] Publication work remains deferred; unrelated work and user data preserved.

## Execution log

Append phase outcomes here during implementation. Include evidence and outstanding work; checkboxes alone are not proof of completion.

### 2026-10-17 execution log

- **Phase 0 baseline:** inspected clean tracked state at `c62332c` with pre-existing untracked `.claude/` and `docs/plans/`; read all required docs. Legacy `com.folio.writing`, `folio.*` journal keys, metadata maps, native schema, and event names were preserved. Historical baseline in plan is distinguished from fresh current results. No real user data was used.
- **Phase 1 changes:** `src/save-queue.ts` now retains a 250 ms trailing debounce and adds a 2,000 ms max scheduling timer from first pending edit; flush clears both. `src-tauri/src/lib.rs` takes a Unix advisory lock on the data root and rejects a concurrent owner with a user-facing message; a Rust test checks exclusive ownership and release after handle drop. Rust tests pass (17 passed, 1 ignored). Dedicated queue deadline tests and end-to-end second-instance verification remain outstanding. Native smoke did not reach an SQLite checkpoint, so interruption recovery is not qualified.
- **Phase 2 changes:** `src/export/document.ts` now carries strike and nested ordered/bullet list kind, level, and start number. DOCX maps strike and native numbering; PDF maps strike lines, list markers/indentation, and splits overlong tokens at code-point boundaries. Added shared representation test and `docs/validation.md` support matrix. Unit export tests generate a DOCX ZIP and PDF, but DOCX XML relationships and visual PDF/DOCX review were not performed. PDF font shaping/fallback and flowing long footnotes remain limitations.
- **Phase 3 partial:** added `src/import/manuscript.ts`, a 5 MB UTF-8 `.txt` parser preserving blank-line paragraphs, hard line breaks, BOM, and Unicode; wired a distinct library action that creates a new project. JSON recovery remains separate. Tests cover text, empty/BOM, invalid UTF-8, size limit, and explicit Markdown rejection. Markdown remains incomplete because parser package installation could not complete in this network-restricted environment.
- **Phase 4 partial:** changed page indicator to “Section page … of …” and clarified independent export pagination plus PDF note/font limitations in UI/docs. No browser screenshots, native light/dark review, window-size/zoom QA, VoiceOver, or full accessibility audit ran. Existing footnote layout still reserves equal tallest-note space and does not split long notes; PDF rejects too-long notes.
- **Phase 5 partial:** documented existing feature-folder boundaries and dependency direction. No empty directories or blanket source moves were introduced. App/Writer responsibility extraction was not completed; preserving behavior without browser/native integration was judged too risky to claim done.
- **Phase 6 complete:** updated `README.md`, `docs/architecture.md`, `docs/personal-word-v2.md`, this validation log, and created `docs/app-history.md` using checked-in Git dates/commits and existing evidence. History differentiates old records from fresh checks.
- **Phase 7 results:** `npm test` passed (64 tests/10 files); `npm run build` passed; `cargo test --manifest-path src-tauri/Cargo.toml --offline` passed (17 passed, 1 ignored). `npm run test:e2e` was blocked before tests by sandbox `listen EPERM` on 127.0.0.1:1420. Smoke binary built with `com.folio.smoke`; native harness timed out before checkpoint after macOS service connection-invalid errors. `npm run tauri build` passed without smoke feature and produced a 13.47 MiB fresh bundle at `src-tauri/target/release/bundle/macos/Personal Word.app`, verified with `CFBundleIdentifier=com.folio.writing` and `CFBundleName=Personal Word`. No screenshot or exported-artifact visual review was done. Publication actions remained deferred; pre-existing `.claude/` and plan directory were preserved.

### 2026-10-18 execution log

- **Scope:** finished the remaining work from the approved plan as the integrating agent: complete the browser and native qualification, fix what failed, refresh the license inventory, reconcile documentation, and rebuild the normal desktop bundle. Review is deliberately left to a separate agent; `REVIEW.md` was not written here.
- **Fixes found by running the suite:** the TypeScript build was broken by the bundled-font `?inline` imports and `markdown-it` typing (89 errors, fixed); DOCX export created one numbering instance per list item (fail-first test added); the dropdown trigger and listbox did not share keyboard handling; the native smoke command's phases 1 and 3 bypassed the frontend save flush; the native harness re-toggled the More formatting popover while polling and never verified page mode; phase 2 killed the process before the acknowledged checkpoint's debounce committed.
- **Integrated results:** `npm run build` and `npx tsc -b` pass; `npm test` 77/77 in 10 files; `cargo test --locked` 17 passed, 1 ignored; `npm run test:e2e -- --workers=1` 37/37 in Chromium; the isolated native harness passed all three phases (page fragmentation, quit flush, SQLite integrity, mirror equality, journal recovery after deliberate termination, snapshot restore). One full-suite browser run failed 29 tests with `ERR_CONNECTION_REFUSED` because a reused dev server stopped mid-run; the suite passed once the runner owned the server.
- **Artifacts:** synthetic DOCX/PDF regenerated and reviewed; DOCX XML carries the footnote reference, strike, hard break, and two numbering instances, and both render in QuickLook. QuickLook is not Word, so Word's own rendering stays open.
- **Docs and inventory:** `README.md`, `docs/validation.md` (new dated section), `ROADMAP.md`, `THIRD_PARTY.md` and `docs/dependency-licenses.json` (254 npm / 456 Cargo; unused `@types/markdown-it` removed), and the `docs/agent-work/2026-10-18-completion/` logs were updated. Nothing was committed; all changes remain in the working tree.
- **Remaining:** native light/dark screenshots, VoiceOver, IME and rich paste, native file dialogs, Word rendering, an interactive second-instance lock check, and the owner's real-use confirmation. Status wording stays CLAIMED until the owner confirms.
