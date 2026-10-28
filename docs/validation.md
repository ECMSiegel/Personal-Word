# First milestone validation — October 14, 2026

## Current status -- 2026-10-25 owner acceptance

**Beta: all nine owner real-use gates passed, confirmed directly by the owner.** See [owner results](agent-work/2026-10-24-team-reconciliation/OWNER_TEST_RESULTS.md). Earlier dated statements below about pending owner testing or an unopened app describe the pre-acceptance state. Q001-Q004 were also resolved; the legacy PDF exporter remains, and signing/download distribution remains outside beta scope.

This is a working local desktop slice, not a production durability certification.

## UI wave 3 -- 2026-10-28

Status: CLAIMED. Final validation (T151) ran 10:37Z-10:50Z on the final tree; full record and the owner hand-check sheet in [VALIDATION.md](agent-work/2026-10-28-ui-wave-3/VALIDATION.md), logs in `node_modules/.cache/personal-word-beta/ui3-final/`.

- tsc 0; unit 60 files, 1025 passed; `npm run build` 0; Playwright whole `tests/` 265 passed, 0 failed (1 worker, no retries, port 1620); cargo 63 passed, 1 ignored.
- Exports: a Shift+Enter page break gives one `w:pageBreakBefore` in DOCX and a 2-page PDF whose page 2 starts "After the break."
- App: `src-tauri/target/release/bundle/macos/Personal Word.app`, `com.folio.writing` 0.1.1, binary sha256 `31fff151b20c83626b9693e6b88711dd60eba7ed6f9c063a4ce288c747445479`, zero smoke markers.
- NOT RUN (screen locked): native reliability, native smoke, native screenshots and the P2 native gate; morning commands are in VALIDATION.md.

- Per-task evidence: `node_modules/.cache/personal-word-beta/ui3-*` (each task's own folder: build logs, Playwright `report.json`, screenshots). The done note for each task names its paths.
- Independent reviews: each task's review note on the team board (`team/tasks/T*.json`).
- Browser checks are Chromium (Playwright) against a production preview build; no native WebKit run is claimed here.

## Confirmed behavior

- **Native macOS WebView + SQLite:** the opt-in harness launched two real Tauri processes with an isolated application identifier and temporary project directory. Phase one created a project through the UI, wrote and switched sections, moved prose into a fragment, restored it, and created a named snapshot. It then typed immediately before invoking the real quit guard. Phase two reopened that final text and restored the named snapshot. Both processes exited successfully.
- **Database and portable copies:** after each native process exited, the runner verified `PRAGMA integrity_check = ok`, checked the expected manuscript content, compared `project.json` with the stored project, and verified snapshot counts, including the safety snapshot created before restoration. See [native evidence](evidence/native-smoke.json). Re-run on October 16, 2026 after the per-entry save path and schema version 2: both phases passed, and the runner rebuilt the project from the header and entry rows and matched it against `project.json` written at quit.
- **Browser end-to-end:** three passing Playwright scenarios cover the complete writer journey, recovery from a newer journal, and 5,004 words across sections with repeated switching, drag reordering, and reload. Browser persistence is explicitly separate from native SQLite.
- **TypeScript unit tests:** seventeen passing tests cover serialized saves, immediate journals, concurrent edits, retry after failed writes, unavailable journals, malformed/conflicting recovery copies, JSON key-order independence, text export boundaries, and malformed imports. Since October 16 they also cover per-entry journaling (a keystroke writes exactly the edited entry and the header), saves that send only changed entries with their base revision, a full resend after a failed save, recovery that combines the saved project with journaled entries, rebuilding a never-saved project from the journal, refusing an incomplete journal, and keeping journal keys while a newer edit is unsaved.
- **Rust persistence tests:** transactional extraction, restart/reopen, snapshot restoration, portable mirrors, online backups, stale/conflicting writes, SQL rollback, and repair after a failed mirror write are covered. A separate test rejects malformed rich text and future database schema versions. Since October 16: delta saves rebuilt from entry rows (with stale-base, missing-entry, stray-entry and deletion cases), history sharing unchanged entry versions and pruning by age, the time-bucket retention rule, and migration of a committed version 1 database fixture (`src-tauri/tests/fixtures/v1-project.sqlite3`, written by the version 1 code) including its history and snapshot.
- **Visual inspection:** inspected the [actual browser writing view](evidence/writing-view.png) after the long-manuscript test. This is a screenshot of the implemented editor with synthetic test prose, not a design mockup.
- **Dependencies:** the initial test-runner audit findings were resolved by updating Vitest; the subsequent npm install audit reported zero vulnerabilities.

## Important boundaries

- Native integration exercises the app's editor, IPC, SQLite, and quit guard. It is not a physical keyboard/menu automation test, a crash/power-loss test, or proof of all WebKit editing behavior.
- The 5,004-word scenario demonstrates persistence and navigation; it is not a latency benchmark or evidence for 50,000-word projects.
- No forced process kill, disk removal, power interruption, exhausted physical disk, or OS crash was induced. Failed SQL writes and portable-file failures were deliberately simulated in Rust tests.
- OS spellcheck, IME composition, extensive rich paste, accessibility/VoiceOver, long sessions, native file-dialog exports, and signed/notarized distribution still need focused manual qualification.
- Automatic recovery history keeps every save from the last 10 minutes, one per 5 minutes for a day, one per hour beyond that, up to 2,000 states; deliberate named snapshots are separate.
- The delivered local app bundle is a development build. A release build is available with `npm run tauri build`; distribution signing/notarization is not configured.

## Personal Word workspace update -- October 16, 2026

Re-run after the expanded workspace changes (see [personal-word-v2.md](personal-word-v2.md)):

- `npm run build`: passed.
- `npm test`: 34 unit tests passed in 6 files.
- `npm run test:e2e`: 11 Playwright scenarios passed (Chromium; browser storage only).
- `cargo test`: 14 Rust persistence tests passed, 1 ignored.
- Native smoke (fresh `native-smoke` debug build, macOS WebKit): both phases passed, including page fragmentation of an overflowing paragraph with a page count above one, the continuous/pages toggle, quit flush, process restart, snapshot restore, SQLite integrity, and portable JSON equality. See [native evidence](evidence/native-smoke.json).
- Release: `npm run tauri build -- --bundles app` produced `src-tauri/target/release/bundle/macos/Personal Word.app` (identifier `com.folio.writing` retained). The superseded debug `Folio.app` bundle was removed.

## Sidebar reorganization -- October 17, 2026

- Project-switch arrow removed (Projects opens from the library/home as before); collapse chevrons added next to Manuscript/Fragments/Research (title click still opens the panel; chevron is a separate button with label "Show/Hide {group}"); Read manuscript, Comments, Snapshots & history, Settings moved to the bottom of the sidebar; empty-document placeholder text removed.

## Application improvement implementation -- October 17, 2026

This is fresh evidence from the current working tree after the improvement changes. Generated artifacts remain ignored; the pre-existing untracked `.claude/` and `docs/plans/` were preserved.

- `npm test`: passed, 64 tests in 10 files. Added plain-text import cases and shared export representation checks for strike and nested list semantics.
- `npm run build`: passed after a TypeScript correction. Vite noted that `@tauri-apps/plugin-dialog` is both statically and dynamically imported; bundle completed successfully.
- `npm run test:e2e`: blocked before test execution because the sandbox denied Playwright’s dev-server bind: `listen EPERM: operation not permitted 127.0.0.1:1420`. No Chromium scenarios ran in this pass.
- `cargo test --manifest-path src-tauri/Cargo.toml --offline`: passed after the Unix instance lock change: 17 passed, 1 ignored; includes `advisory_lock_rejects_a_second_handle_and_releases_on_drop`. Rust tests are not native WebView UI verification.
- Isolated native smoke build: `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'` built `src-tauri/target/debug/folio`. `python3 scripts/native-smoke.py` did not observe the acknowledged SQLite checkpoint within its 150-second timeout. The child logged macOS LaunchServices and `com.apple.hiservices-xpcservice` connection-invalid errors. The interruption and second-instance lock check were not reached; app-level second-instance UX and current native editor/layout behavior therefore remain unverified.
- Fresh normal desktop bundle: `npm run tauri build` succeeded. Verified `Contents/Info.plist` reports `CFBundleIdentifier=com.folio.writing` and `CFBundleName=Personal Word`; executable `Contents/MacOS/folio` timestamp: 2026-10-17 16:22 local; bundle size reported by Tauri: 13.47 MiB. The app was rebuilt without the smoke feature.
- Export artifacts: current Vitest checks generated a DOCX ZIP and parsed the generated PDF page count, but did not inspect DOCX XML numbering/footnote relationships or visually render PDF/DOCX. No Word renderer was used. Those artifact acceptance checks remain open.
- Browser screenshots, native light/dark screenshots, VoiceOver, and native file-dialog export review were not performed in this pass.

### Export support matrix (current source behavior)

| Feature | DOCX | PDF |
| --- | --- | --- |
| Text, headings, bold, italic, underline, strike, links | Preserved as editable runs | Built-in Latin text, drawn underline/strike; unsupported glyphs rejected |
| Ordered/bulleted lists, nesting, ordered start | Native numbering definitions and nesting level | Visible numbering/bullets and nested indentation |
| Paragraph alignment, indentation, spacing | Preserved where represented by settings/attrs | Preserved where represented by settings/attrs |
| Page breaks | Paragraph page break | New PDF page |
| Footnotes and cited bibliography | Editable native footnotes and bibliography | Bottom-of-page notes and bibliography; note must fit on one page |
| Font family/size and export settings | Standard Word families plus run formatting | Standard built-in Latin families; not embedded, shaping/fallback unavailable |

This matrix describes implementation, not exhaustive visual qualification. The shared representation preserves strike/list semantics, but generated artifact XML and representative rendered layouts still need inspection.

### Remaining checks and limits

- Markdown import is incomplete because the maintained parser dependency could not be installed: `npm install unified remark-parse remark-gfm remark-rehype rehype-raw rehype-sanitize rehype-stringify` produced no dependency changes under the network-restricted environment and was interrupted. `.md`/`.markdown` selections return a clear error; only `.txt` import is implemented.
- PDF long tokens are split at code-point boundaries, but script shaping and font fallback were not implemented; PDF remains restricted to glyphs supported by pdf-lib’s built-in fonts. Long footnotes remain an explicit error before file output.
- The 2-second autosave maximum is a healthy-queue scheduling bound, not a strict durability guarantee. The new JavaScript timer behavior is covered by the general unit suite, but dedicated fake-timer continuous-typing/slow-I/O deadline tests have not yet been added.
- The fresh native smoke attempt did not produce UI evidence. Native forced termination, lock startup messaging, file-dialog export, native screenshot review, and VoiceOver remain blocked/unverified.
- Source ownership is documented and the source tree already has feature folders; the large App/Writer orchestration extraction proposed by the plan was not completed.
- No user data, existing app bundle, old release, or unrelated work was deleted. No publication preparation was done.
- `npm test`: 60 unit tests. `npm run test:e2e`: 31 Playwright scenarios.

## Footnotes, fragment split view, polish -- October 16, 2026 (late)

- `npm test`: 60 unit tests (adds footnote page assignment/reserve math). `npm run test:e2e`: 31 Playwright scenarios (adds footnotes and fragments-panel specs). `cargo test`: 16 passed, 1 ignored.
- Native smoke on a fresh `native-smoke` build: both phases passed.
- Chromium screenshots reviewed: footnote in continuous and page view (light/dark), fragments split view, settings page, sidebar cards, unpinned overlay over the toolbar.

## UI and research rework -- October 16, 2026 (evening)

- `npm run build`: passed. `npm test`: 52 unit tests (indent stepping, citation lookup parsing/mapping with inline fixtures, Chicago website dates).
- `npm run test:e2e`: 25 Playwright scenarios (adds toolbar, layout, and research specs; Chromium, browser storage only).
- `cargo test`: 16 Rust tests passed, 1 ignored (adds `lookup_fetch` scheme rejection).
- Native smoke on a fresh `native-smoke` build: both phases passed, including page fragmentation with the new Page view toggle and status-line page count in macOS WebKit.
- Typing cost (production build, Chromium, 1,200-word paragraph, insertText + frame): median ~17 ms before and after the rework.
- Light/dark screenshots reviewed in Chromium: writing screen, research panel, project list with open sort menu, unpinned sidebar. Native WebKit visuals beyond the smoke test were not screenshot-reviewed.
- Citation lookup was exercised only against mocked Crossref responses; live Crossref/Open Library/web requests were not run in tests.

## Save path at 100,000 words — October 16, 2026

`npm run bench` (`scripts/bench-save.sh`) builds a 100,000-word project (100 sections × 1,000 words) and times one keystroke in the middle section and one save. "Before" is commit 6f1e6e9 run with the same benchmark; three runs each on this Intel Mac, no other build running.

| Cost | Before | After |
| --- | --- | --- |
| Keystroke: App mutate + journal + sidebar word totals (Node) | 46–62 ms | 0.3–0.7 ms |
| Save, frontend: build and serialize the IPC payload (Node) | 7.5–9 ms, ~1.5 MB | 0.3–0.4 ms, ~29 KB |
| Save, Rust: SQLite commit including history (release) | 216–298 ms, plus three mirror files fsynced on every save | 8–9 ms |
| Portable copies (project.json + text), Rust | inside every save | ~200 ms per background pass, at most every 3 s, outside the store lock |
| Opening: rebuild and validate the project, Rust | ~46–54 ms | ~44–48 ms |

What changed: the keystroke no longer clones and stringifies the project (only the edited entry and a small header go to the journal), sidebar word counts are cached per unchanged entry, a save sends one entry instead of the project, Rust no longer rewrites the whole project blob or copies the whole project into history, and the portable copies moved off the save path.

Limits of these numbers: the keystroke and payload figures run in Node with an in-memory journal, so they leave out WebKit's localStorage write and React rendering; the old number additionally hid WebKit writing a ~1.5 MB journal value per keystroke. The Rust per-save figure is a 50-save loop on a fresh project; the old path got slower as its 100-row history filled. The edited section here holds 1,000 words, so both journal and save cost grow with the size of the section being edited, not the project.

## Reproduce

```sh
npm ci
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run bench
npx playwright install chromium
npm run test:e2e
npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'
python3 scripts/native-smoke.py
npm run tauri build -- --debug --bundles app
```

The native harness's temporary project directory is printed by the runner. Browser test reports are transient under `test-results/`. The committed evidence file preserves the successful native run without embedding any real writing.


## Source publication preparation -- October 17, 2026

This pass adds licensing, public-alpha documentation, issue forms, a GitHub Actions workflow, and a dependency license inventory. It preserves the pre-existing uncommitted application improvements.

- `npm run build`: passed.
- `npm test`: 64 passed across 10 files.
- `npm run test:e2e`: 31 passed in Chromium after allowing the local test server. The earlier sandbox startup block is not the current browser result.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 benchmark ignored.
- Fresh dependency installation, frontend build, and unit tests passed in a temporary source copy without pre-existing node_modules or build artifacts. This was repeated successfully with Node 22.23.3, matching CI's major version.
- Current synthetic workspace screenshot reviewed and saved as `docs/evidence/current-workspace.png`; the old `writing-view.png` remains historical evidence.
- Workflow/issue-form YAML parses; local documentation links and `git diff --check` pass. Hosted CI has not executed.
- License inventory covers 243 npm and 456 Cargo packages with no missing declared license metadata. Metadata completeness is not binary notice compliance.
- No native UI smoke, forced-termination qualification, VoiceOver review, or exported-artifact rendering was performed in this preparation pass. Their previously documented gaps remain. No fresh app bundle is offered by this pass.

See [publication readiness](publication-readiness.md) for the bounded source/history audit and remaining owner/hosting decisions.


## Completion pass -- October 18, 2026

Fresh evidence from the current working tree (`c62332c` plus this pass's uncommitted changes). Generated artifacts stay ignored; the pre-existing uncommitted work is preserved. Where this section names an October 17 statement it supersedes it.

- `npm run build`: passed (after adding `src/vite-env.d.ts` for the `?inline` bundled-font imports).
- `npx tsc -b`: passed; 89 TypeScript errors were fixed, including `markdown-it` typings, `ListInfo` export, `Set<PdfFontKey>`, and the document-settings fixture spread.
- `npm test`: 77 passed in 10 files, adding DOCX numbering/footnote/hard-break/strike XML cases, Markdown import cases, SaveQueue deadline and slow-I/O cases, and the export-fixture generator checks.
- `npm run test:e2e -- --workers=1`: 37 passed in Chromium in 1.7 minutes. This is browser storage only, not native WebKit evidence.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored.
- Isolated native smoke (fresh `--features native-smoke` debug build with `--config '{"identifier":"com.folio.smoke"}'` and an isolated data directory): **all three phases passed**. Phase 1 created a project, typed an acknowledged checkpoint, fragmented a 15,900-character paragraph in page view (`Section page 1 of 6`), toggled back to continuous, added a section, extracted and restored a fragment, saved a named snapshot, then typed a final edit and quit normally: SQLite held the final text, `PRAGMA integrity_check` returned `ok`, and the portable `project.json` matched the database. Phase 2 reopened after the normal quit with the latest edit, acknowledged a second checkpoint, queued a journaled edit, and was terminated by the harness. Phase 3 reopened, recovered the journaled edit from isolated WebView storage, restored the snapshot, and quit normally. Redacted summary: [native smoke 2026-10-18](evidence/native-smoke-2026-10-18.json); breadcrumb logs are in the ignored `node_modules/.cache/personal-word-completion/native-run/`.
- Native harness limit: in this background agent session the same binary intermittently stalls after enabling page view. Breadcrumbs stop at `ok native paragraph pagination`, the process stays alive at 0% CPU with the app and WebContent threads idle in their run loops, no crash report is written, and the runner then reports a missing report rather than a product failure. Runs that finish report `document.visibilityState` `visible` when the window was composited and `hidden` in a later phase, matching the macOS LaunchServices and `com.apple.hiservices-xpcservice` connection-invalid errors recorded on October 17. A separate agent session was concurrently working in this same folder during these runs (its draft plan `docs/agent-work/2026-10-18-writer-features/PLAN.md`, `README-draft.md`, and `docs/evidence/readme/` screenshots appeared at 05:47-05:48), so concurrent GUI and dev-server activity in that folder is a plausible contributor alongside the window-compositing state. The same code path renders six pages whenever the page is visible, so this is recorded as an environment limitation of a shared, background agent session rather than a product result. An interactive re-run on a quiet desktop session is still the owner's confirmation.
- Export artifacts: `npm run render:export-fixtures` wrote synthetic DOCX and PDF fixtures; both render in QuickLook (Greek, Cyrillic, strike, hard break, bullet, nested list starting at 4, a long token split across lines, a footnote, and a bibliography). Reading the DOCX XML with JSZip shows `<w:br`, `<w:strike`, `<w:footnoteReference`, and two `<w:numPr` instances (`numId` 2 and 3, `ilvl` 0 and 1). Limit: QuickLook is not Word; nested indentation present in the XML is not visible in the QuickLook render, and Word's own rendering is not verified.
- Markdown import: UTF-8 `.md`/`.markdown` up to 5 MB imports through a preview dialog; images, tables, and raw HTML arrive as literal text with warnings, only http/https/mailto links stay links, no remote resource is fetched, and cancelling creates nothing. This replaces the October 17 statement that Markdown import was incomplete.
- PDF fonts: export embeds bundled OFL Noto Serif/Sans/Mono subsets from `src/export/fonts.ts` covering Latin, Latin Extended, Greek, and Cyrillic instead of pdf-lib's built-in Latin fonts. This supersedes the October 17 support-matrix row that read "standard built-in Latin families"; text outside that coverage and a note that cannot fit its page are reported instead of silently degraded.
- License inventory: 254 npm and 456 Cargo packages with no missing declared license metadata. The unused `@types/markdown-it` stub was removed because `markdown-it` 15 ships its own declarations, so the October 17 count of 257 npm packages is superseded.
- Defects corrected in this pass, each with a failing check first where practical: the native smoke command's phases 1 and 3 called `finish_quit` directly, skipping the frontend save flush, so the final edit never reached SQLite; the harness page-view helper re-toggled the More formatting popover on every 40 ms poll and never verified page mode; phase 2 did not let the 250 ms debounce commit the acknowledged checkpoint before deliberate termination; DOCX export created one numbering instance per list item instead of one per list; and the dropdown listbox, TypeScript build, and editor toolbar hit areas needed the corrections detailed in `docs/agent-work/2026-10-18-completion/`.
- Browser dev-server note: one full-suite run reported 29 failures, all `page.goto: net::ERR_CONNECTION_REFUSED`, because Playwright's `reuseExistingServer` picked up a dev server that stopped about 85 seconds into the run. A second agent session was running its own browser tooling in this folder at the time, which is the likely cause. The same suite passed 37/37 once the runner owned a fresh server, so the failing run is not a product result.
- Still open, and required before any VERIFIED wording: native light and dark screenshots, VoiceOver, IME and rich paste, native file dialogs, Word's own rendering of the DOCX, an interactive second-instance lock check, and the owner's real-use confirmation. Automated native evidence above is CLAIMED, not VERIFIED.

## Pickup review and PDF repair -- October 18, 2026

The independent review reproduced a PDF defect missed by the earlier QuickLook check: embedded WOFF2 font bytes produced blank text in Poppler. The repair uses the already installed fontsource WOFF companions with fontkit subsetting. A regression inspects decoded embedded font programs and requires at least three TrueType/OpenType programs for Latin, Greek, and Cyrillic; it failed with the original wOF2 programs and passes after repair. No dependency or font asset was added.

Fresh post-repair evidence (automated CLAIMED, owner confirmation outstanding):

- `npm run build`: pass.
- `npm test`: 78 passed in 10 files.
- `npm run test:e2e -- --workers=1`: 37 passed in Chromium (3.2 minutes), with a permissioned runner-owned Vite server; initial sandbox attempt failed to bind localhost before tests. Browser storage only.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 benchmark ignored.
- `npm run render:export-fixtures`: pass, with a nonfatal Vite HMR bind warning. Poppler extraction preserves Latin/Greek/Cyrillic and rendering emits no invalid-font errors. Both PDF pages visually inspected: text, strike, nested list, long token, footnote and bibliography visible.
- Synthetic DOCX QuickLook thumbnail rendered and inspected. QuickLook does not establish Word's own rendering, and its thumbnail does not show the footnote area or nested indentation faithfully; native footnote/numbering XML tests pass.
- License inventory: 254 npm / 456 Cargo packages, zero missing declared license metadata. `git diff --check`: pass.
- Isolated native smoke build: pass. Harness phase 1 timed out after 180 seconds, before any progress breadcrumb, with LaunchServices/hiservices connection-invalid errors. Runner cleaned up its isolated process. Fresh native runtime is blocked; this does not replace the older successful run or establish current native behavior.
- `npm run tauri build`: pass. Result: `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25 MiB). Info.plist retains Personal Word / com.folio.writing / 0.1.0; executable folio built October 18 at 15:43 America/New_York, newer than all application source. Smoke diagnostic symbols absent. Unsigned/not notarized status unchanged.

Review and repair evidence: `docs/agent-work/2026-10-18-completion/REVIEW.md` and `IMPLEMENTATION_LOG.md`. No owner-confirmed VERIFIED status, commit, publication, or writer-feature implementation is claimed. Owner requires the completion work committed before starting the approved writer-features plan.

## Writer features implementation -- October 18, 2026 (evening)

This pass implements the six writer features from the approved plan `docs/agent-work/2026-10-18-writer-features/PLAN.md`: Zotero CSL JSON import, automatic short notes, quote capture, writing goals and focus mode, an optional local prose check, and whole-project Markdown/plain-text export. Fresh evidence from the current working tree (baseline `d8aa72c` plus this pass's uncommitted changes); generated artifacts stay ignored. Every claim here is **CLAIMED, not VERIFIED** -- the owner's real-use confirmation is outstanding. Execution evidence and the independent review are in `docs/agent-work/2026-10-18-writer-features/`.

- `npm run build`: pass.
- `npm test`: 149 passed in 17 files. New suites cover goal calculations and validation, CSL JSON import, manuscript note forms, quote text cleanup, the prose check, the writing-aids decorations, and whole-project text export.
- `npm run test:e2e -- --workers=1`: 45 passed in Chromium (2.9 minutes) on the confirming rerun. The first pass reported 44/45; the one failure, `tests/accessibility.spec.ts:93` ("page layout measurement preserves the editor element and undo history"), restored a partial undo instead of the full sentence because ProseMirror groups keystrokes within its 500 ms `newGroupDelay` differently under a loaded machine (a 502 ms measured input gap). The same suite passed that test immediately afterwards on an idle machine, so it is a load-only flake, not a product regression; the test and its threshold are unchanged. Browser storage only, not native WebKit.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored. No Rust, editor-schema, or dependency change -- the features are React/TypeScript only.
- Light/dark screenshots at 1440x900 of focus mode and the prose-check panel were regenerated and inspected: dotted-underline issue marks and the panel's counts render in both themes.
- Typing cost (production build, Chromium, in-page `performance.now()`, 1,200-word paragraph): aids off 20.4 ms median, focus + prose on 17.9 ms median -- within run-to-run noise, well under the plan's 25 ms limit. Realistic dense text is unaffected (4,875 words / 974 decorations measured 15.7 ms with aids on against 16.6 ms off). The cap below bounds the one previously unbounded factor.
- Isolated native smoke (fresh `--features native-smoke` debug build with `--config '{"identifier":"com.folio.smoke"}'`): **blocked by the environment, not qualified**. The harness launched a real app process, which reached `ok native paragraph pagination` and then stopped: no crash report, no progress past page pagination, and the runner timed out after 180 seconds with `NSSpellServer dataFromGeneratingCandidatesForSelectedRange timed out`. This is the same macOS-service stall recorded for the October 18 completion pass in a background agent session; the app and WebContent threads idle in their run loops rather than failing. An interactive re-run on a quiet desktop session remains the owner's confirmation. No native behaviour for the new features is claimed from this pass.
- Fresh normal release bundle: `npm run tauri build` passed; result `src-tauri/target/release/bundle/macos/Personal Word.app` (15.25 MiB). `Contents/Info.plist` reports `CFBundleIdentifier=com.folio.writing`, `CFBundleName=Personal Word`, `CFBundleShortVersionString=0.1.0`. Executable `Contents/MacOS/folio` built 2026-10-18 18:26 America/New_York, newer than every file under `src/` and `src-tauri/src/`; smoke diagnostic symbols absent (`strings` finds no `FOLIO_SMOKE`). This is the writer-features build; unsigned/not notarized as before.

Limits, stated explicitly:

- **Typed newline in a captured quote.** Multi-line text typed directly into the Capture quote dialog is stored exactly as typed; only pasting runs `cleanPastedQuote`. This is the plan's explicit rule ("never rewrite punctuation inside the user's text"), recorded here as a known limitation rather than changed.
- **Prose-check decoration cap.** `writingAids.ts` keeps at most `MAX_PROSE_DECORATIONS = 2000` decorations, choosing those nearest the cursor, and the panel notes "Only the issues closest to the cursor are shown." This bounds cost for pathological input (a single 10,000-word paragraph produced about 20,000 candidate issues and took 3.3 s per keystroke before the cap). Absolute per-keystroke timings on this machine are not trustworthy while the owner's other applications hold the load average between 30 and 600; only within-run comparisons (aids off versus aids on) were used, and a quiet-machine re-measurement is still required before any performance number is called verified.
- **Prose check is off by default** and never changes the saved document; unsupported CSL item types on Zotero import are counted and reported, never silently dropped.
- Owner confirmation required before any VERIFIED wording: automatic short notes across all renderers, Zotero import of a real export, quote capture and one-undo insertion, goal progress in real writing, focus mode and the prose panel on real prose, and the Markdown/plain-text export of a real project.


## October 19, 2026 -- local source-alpha repairs

The deadline settings mutation now uses the same strict date validation as project loading. Invalid extended years are rejected before mutation; clearing remains supported. Short citation titles ending in `?`/`!`, list indentation and literal Markdown markers, and research locator prefixes were repaired. See [regression evidence](agent-work/2026-10-18-source-alpha/EVIDENCE.md), [implementation log](agent-work/2026-10-18-source-alpha/IMPLEMENTATION_LOG.md), and [independent review](agent-work/2026-10-18-source-alpha/REVIEW.md).

- Full `npm test`: 163 passed in 17 files (29.74 seconds).
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`: 17 passed, one benchmark ignored.
- Targeted deadline browser regression: one passed after the original guard-removal defect produced the expected failure. It checks rejection, preserved valid value, reopening, and clearing in isolated browser storage.
- Final `npm run tauri build`: passed. The 15.25 MiB local Personal Word.app reports version 0.1.0 and identifier com.folio.writing. Executable timestamp 2026-10-19 00:11:34 America/New_York is newer than all 77 source files; smoke diagnostic symbols absent. See [build evidence](agent-work/2026-10-18-source-alpha/BUILD_EVIDENCE.json). This is an unsigned local build, not native GUI/persistence confirmation or a binary release.
- Owner-reported Terminal run on October 19: `npm run test:e2e -- --workers=1` passed all 46 Chromium scenarios in 1.7 minutes. The owner supplied the complete passing output in chat. This closes the blocked browser gate; the integrating agent did not independently rerun it. Browser storage does not establish native WebKit or SQLite behavior.

Application behavior remains CLAIMED until owner confirmation. Native WebKit/SQLite and Word/LibreOffice artifact qualification remain open; current browser checks do not replace them. No remote or public push is authorized.


## Source-alpha security and reliability follow-up -- October 19, 2026

This section supersedes earlier current-status statements for the repaired source; dated historical evidence above is retained. Full evidence, findings and independent review are in [the follow-up log](agent-work/2026-10-19-alpha-security-reliability/IMPLEMENTATION_LOG.md).

- Fresh Node 22.23.3 build passed; 163 unit tests in 17 files passed; 49 Chromium scenarios passed in 1.8 minutes; 19 Rust tests passed with 1 existing ignored benchmark. The new sidebar and native-argument regressions were seen failing before repair and with the defect restored, then passing with the fix.
- Before/after light/dark browser screenshots were visually inspected. Search/rename, editor and preview selection, same-row reorder after selection, group/entry order persistence, resize, pin/hover, collapse and keyboard controls passed. The earlier owner46/46Terminal result remains baseline evidence; it is not substituted for the new 49-scenario run.
- One freshly built isolated `com.folio.smoke` native rehearsal passed all 3 phases, including actual WebKit/SQLite quit/reopen, acknowledged checkpoint, harness-owned forced termination, journal recovery, snapshot restoration, integrity and project.json mirror parity. Synthetic temporary data only; no real projects/recovery were deleted or unowned processes terminated.
- A normal release build followed the diagnostic run: Personal Word.app, 15.25 MiB, 0.1.0, com.folio.writing, executable newer than 77 source files and without FOLIO_SMOKE. All 115 tested source hashes remained unchanged.
- Explicit 166-file clean candidate hashes matched. Redacted Gitleaks before install found 0 credentials; approved locked npm ci/build/163 unit tests then passed there with Node 22. No dependency/global-tool changes occurred in the project.
- Owner explicitly accepted the pending manual native-sidebar check for this source-only alpha. Native sidebar behavior remains unverified in real use. VoiceOver/IME, native file dialogs, Word/LibreOffice rendering, long sessions, exact editor/export page parity and physical power-loss guarantees are not established.
- No reproduced writing-loss finding; sparse metadata/history/mirror combinations, reopening the pre-restore safety copy and actual close-under-mirror-failure remain coverage gaps. User-initiated private/local HTTP(S) lookup/redirects and uncapped recovery JSON are explicitly accepted alpha limitations; see [publication readiness](publication-readiness.md).
- Export implementation is unchanged by the URL/sidebar repairs; conditional fixture rendering was not repeated. Prior artifact evidence and limits remain in force.
- After independent approval, the two confirmed historical strings were sanitized with verified backups and unchanged code/identities/dates. The final evidence commit and annotated local alpha tag are checked together against the tested source; post-sanitation audit found no home-prefix or Gitleaks hits. No remote/push or binary distribution is authorized.


## October 20, 2026 -- current source-alpha qualification

This section supersedes earlier current-status statements; older results remain historical. Frozen source `aad4c12` includes the DOCX scheme guard and corrected WOFF wording. Fresh sequential qualification under Node22.23.3: build passed; 164 unit tests/17files passed;49Chromium scenarios passed; locked offline Rust19passed/1existingignoredbenchmark. A fresh isolated native WebKit/SQLite run passed all3phases with checkpoint/termination/journal/snapshot/integrity/mirror assertions; no real data or unowned process used.

DOCX fail/fix/restored-defect/final-fix passed in an isolated copy. Generated DOCX contained exactly4allowed relationships (HTTP,HTTPS,uppercaseHTTPS,mailto),0unsafe, all8labels retained; doctored unsafe artifact correctly rejected. Baseline DOCX/PDF XML/text checks passed. Integrator and Luna independently inspected all5LibreOffice/Poppler page images without observed clipping, overlap or missing glyphs. This closes bounded synthetic headless LibreOffice rendering, not Microsoft Word or broader interactive/native export compatibility. PDF text assertion normalizes extraction whitespace only; the original failed extraction and unsafe-target negative controls are retained.

Normal release rebuild passed: Personal Word0.1.0,com.folio.writing,15.25MiB; executable newer than77sourcefiles, no FOLIO_SMOKE; SHA-256 `0c5740e853040f652e3ed2c3d61ba3a497ac314c08d9f742ea68f731f04c3865`. The115frozen source hashes remained unchanged. A167file isolated source/document snapshot passed hash/privacy checks before approved lockednpmci/build/164unit tests passed; no copied/symlinked dependencies. Final qualification documentation differs from that point-in-time snapshot only in recorded Markdown evidence.

Independent Luna reran13export tests and13sidebar/layout/toolbar browser scenarios, allpassed. Owner's explicit source-only-alpha acceptance of the native-sidebar gap remains in force; no native real-use confirmation is claimed. REL01/02/03, VoiceOver/IME, long sessions, Word, physical power loss and binary-distribution gates remain open. Existing opt-in private/local HTTP(S) and uncapped recovery JSON limitations remain accepted. Current evidence and review: [implementation log](agent-work/2026-10-19-alpha-security-reliability/IMPLEMENTATION_LOG.md), [qualification review](agent-work/2026-10-19-alpha-security-reliability/QUALIFICATION_REVIEW.md), and [publication readiness](publication-readiness.md). Local evidence commit/tag only; no remote or push.


## October 20, 2026 -- D1 durability work in progress

This section records the current D1 source work separately from the earlier native pass. The offline serial Rust suite passed (21 passed, 0 failed, 1 ignored); full output is preserved at `node_modules/.cache/personal-word-beta/d1/cargo-test.log`. The focused SaveQueue unit test passed (26 tests) after its setup was corrected to model sustained 200 ms enqueues while the persistence promise is blocked; the first failed run and passing rerun are preserved in the D1 cache. The native-smoke feature compiled with `--no-run` and emitted both test executables; full output is preserved at `node_modules/.cache/personal-word-beta/d1/cargo-native-smoke-no-run.log`. No diagnostic app build, benchmark, or diagnostic app launch has run. The serial command lease has been returned. The owner explicitly directed us to hold native WebView tests, so no diagnostic WebView launch or UUID profile creation is authorized. Nothing here qualifies the current binary.

The diagnostic supervisor is designed to use only `src-tauri/target/debug/folio` built with the `native-smoke` feature and the `com.folio.smoke` identifier. Each native scenario gets a unique persistent macOS WebKit `dataStoreIdentifier`; a restart within that scenario reuses the same identifier. The injected check queries the active WebKit stores before scenario actions. SQLite projects, logs, and reports stay under `node_modules/.cache/personal-word-beta/d1/`. WKWebView does not support a custom `dataDirectory` or deleting an individual store through Tauri on macOS, so WebKit manages the persistent profile outside that cache; unique IDs isolate synthetic data from the user's app profile, and those diagnostic stores are not deleted. This conflicts with the plan's owned-temp-root boundary. The owner explicitly directed us to hold native WebView tests, so do not create these UUID stores or launch either native harness. Reports include scenario, run, invocation, app, profile, binary, and source identities. A stale or failed invocation must not leave a prior `latest.json` marked as passing.

The planned serial checks are:

1. Focused SaveQueue tests and the serial offline Rust unit suite passed. The native-smoke cfg also compiled with `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml --features native-smoke --no-run --jobs 1`; this compile-only result does not qualify the native app.
2. Diagnostic build: `npm run tauri build -- --debug --features native-smoke --no-bundle --config '{"identifier":"com.folio.smoke"}'`.
3. Native matrix: `python3 scripts/native-reliability.py --suite baseline`, followed by `python3 scripts/native-smoke.py`. The matrix covers exact sparse metadata/history/mirror/restart equality, the generated pre-restore safety copy reopened in another process, actual close error and retry through the mirror writer, malformed/incomplete/conflicting journals, staged SQL rollback/disk-full/permission failures, fresh report IDs, and owned-process termination at the three SQLite/mirror checkpoints. The post-commit/pre-mirror restart checker requires SQLite and portable-copy equality; if the baseline leaves a stale mirror, record that failed result before considering a minimal repair.
4. Benchmark: `cargo test --release --locked --manifest-path src-tauri/Cargo.toml bench_save_100k_active_entry_100_saves -- --ignored --nocapture`. The acceptance bound is p95 at or below 150 ms for 100 active-entry delta saves on a 100,000-word project.
5. Rebuild the normal app and verify its identifier is `com.folio.writing`, no diagnostic/fault hooks are present, and its executable is newer than the source inputs. Then record the owner's Intel native sidebar, close/reopen, and long-session checks. Apple silicon real-use, signed/notarized distribution, physical loss guarantees, and other human checks remain separate gates.

The matrix does not assert that an uncommitted keystroke survives process termination. A report that an SQLite revision was committed does not establish that localStorage was durably flushed to disk, and a source-only pass does not satisfy the owner binary checks. Until the native matrix, benchmark, normal-binary inspection, and required owner results are recorded, D1 remains partial and no new binary reliability claim is made.


## 2026-10-25 beta board -- evidence by kind (CLAIMED, not qualified)

Task T020 rewrote this section on 2026-10-25. An earlier off-board draft here called the beta "qualified" and listed "print probe integration" as passed; it also quoted counts (818 tests in 44 files, 38 Rust tests, 18 + 8 native scenarios) that no board task produced. Those statements were removed. Nothing below is VERIFIED: VERIFIED needs the owner's confirmation in real use, and there is none yet. Every result is CLAIMED.

The board keeps four kinds of evidence apart. A result of one kind does not stand in for another.

1. **Browser** -- Chromium on a production preview (`npm run build`, then `vite preview` on a private port). Chromium is not WebKit, and browser storage is not the native SQLite store.
2. **Native harness** -- the diagnostic `native-smoke` build with the isolated identifier `com.folio.smoke`, driven by `scripts/native-reliability.py`. It uses real SQLite and the real WebKit window, but only synthetic data, and it is not the normal app.
3. **Rendered artifacts** -- exports from the real exporters, inspected as files (task T019). Poppler renders the PDF; the DOCX is read as XML and as a QuickLook thumbnail. Neither is Microsoft Word.
4. **Owner real use** -- none yet.

### Static and unit checks (current tree, task T018 and its review T042)
| Check | Result | Source |
|---|---|---|
| `npx tsc --noEmit -p .` | exit 0 | `wp11-matrix.md` section 6 (`final-tsc.log`); reviewer rerun, T042 |
| Full unit suite, `npm test -- --no-file-parallelism --maxWorkers=1` | **858 passed in 46 files** (T018 history; superseded by 865 in 47 files, see Gate D below) | `wp11-matrix.md` (`final-vitest-full.log`); reviewer rerun, T042 |
| Focused durability units | 183 passed in 9 files | `wp11-matrix.md` |
| Rust, `cargo test --locked --offline --jobs 1 -- --test-threads=1` | **48 passed, 0 failed, 1 ignored** (the 100,000-word benchmark) | `wp11-matrix.md`; reviewer rerun, T042 |

The 858 / 46 count is the figure at the end of T018. Task T043 (see below) later edited `src/export` and added 7 tests (`src/export/multiparagraphNote.test.ts`); its reviewer's focused run of `src/export`, the WP3 export adversarial file and the WP7 export panel file passed 180 tests, tsc and `npm run build` exited 0. The full-suite counts after T043 were recorded by T021 and the Gate D rerun: 865 tests in 47 files (see the 2026-10-25 Gate D section below). Earlier counts (837 in 44 files at Gate B, 847 in 45 at T038, 164 in 17 for the October 19 alpha) are history, not current.

### Native harness (isolated `com.folio.smoke`, synthetic data)
| Suite | Run ID | Result | Source |
|---|---|---|---|
| baseline | `20261025T084201Z-0cea2da3` | 13 scenarios passed, 5 negative controls detected | `wp11-matrix.md` |
| beta | `20261025T084244Z-642b9c8a` | 19 passed, 42 controls detected (61 entries; the 18 baseline entries run first) | `wp11-matrix.md` |
| beta, independent rerun | `20261025T084746Z-dadedb9c` | 19 passed, 42 detected, same manifest `2d7538f3...` and binary `be95ad1a...` | T042 approval note on T018 |

What the beta suite exercises, each time with a doctored-copy control that fails the same checker: a synthetic project (images, a table, notes, comments, goals, provenance) through creation, an incremental save, reload, history, mirrors, a named snapshot, a safety snapshot and an archive import; a kill after asset staging and before the edit that uses the asset; a kill after the SQL commit and before the portable copies, followed by repair; a kill after the safety snapshot during a source merge; a kill after the safety snapshot during a restore; and a project with a newer schema version, which must fail clearly and leave every file unchanged. The full matrix and its limits are in [wp11-matrix.md](agent-work/2026-10-24-team-reconciliation/wp11-matrix.md). Source merge and restore crashes drive the same store calls as the app; the CSL import dialog was not clicked natively. Older-schema migration is covered by Rust tests only.

### Browser (Chromium, production preview)
The per-task counts below are the history that led to the final run. On 2026-10-25 a single full-suite run on the final tree exists: 112 passed across 23 spec files (see the Gate D section below). The executed per-task counts, each from the task named:
| Task / report | Specs | Result |
|---|---|---|
| T003 (`wp2.md`, `T003_REVIEW.md`) | `tests/assets.spec.ts` | 16/16 with `--repeat-each=2` after the saved-image repair |
| T005 (`wp3.md`) | integrated asset cases | 18 passed |
| T006 (`keyboard.md`) | `tests/ci-indent.spec.ts` (5), keyboard cases x10 (20), editor-toolbar and comments (6) | all passed; a doctored Home-to-End control failed both keyboard cases |
| T011 / Gate B (`wave3-integration.md`, `gate-b.md`) | import 2, rich-import 5, markdown-roundtrip 11, research 9, zotero 4 | 31 passed; plus 3 review probes (image count, external image relationship, watcher liveness) |
| T032-T035 review (`gate-b-repairs.md`) | import-cancel, import, rich-import, markdown-roundtrip, zotero, research | 36/36 for T033-T035; the T032 cancel spec was repaired and re-approved with import-cancel and import at 5/5 |
| T019 (`artifact-acceptance.md`) | `tests/accessibility.spec.ts` | 4 passed |

### Rendered artifacts (task T019, approved by T044)
A synthetic project with images, a 46-row table, eight footnotes, a bibliography and mixed Latin, Greek and Cyrillic text was exported to PDF, DOCX, Markdown, plain text, a Markdown bundle and a portable archive, then compared across formats. All 12 PDF pages were viewed. See [artifact-acceptance.md](agent-work/2026-10-24-team-reconciliation/artifact-acceptance.md). Boundaries: PDF bytes carry a creation time, so compare content, not hashes; the DOCX was not opened in Word; the UI screenshots are Chromium, not WebKit; no VoiceOver, input-method or Apple silicon run.

### Native print probe (WP8) -- a documented STOP, not a passed feature
The native WKWebView print probe (task T013, reviewed in T014 and Gate C T017) paginated, drew headers and footers, flowed a long note and locked down external loads, but could not produce searchable Arabic. Words containing the lam-alef ligature were not found by PDFKit or `pdftotext`; 26 of the 28 installed fonts tried failed and only two decorative display fonts passed. Probe runs `20261025T070701Z-642a1146`, `20261025T072108Z-e51b1619` and `20261025T074258Z-7930e721` each ended `PROBE_RESULT: STOP`. The legacy pdf-lib exporter remains the only PDF path. WP9 and WP10 (exact PDF preview, flowing per-page footnotes) are cancelled pending owner question Q004. The native command exists only in the diagnostic smoke build. Records: [wp8.md](agent-work/2026-10-24-team-reconciliation/wp8.md), [feasibility.md](agent-work/2026-10-24-team-reconciliation/feasibility.md), [gate-c.md](agent-work/2026-10-24-team-reconciliation/gate-c.md). No claim of exact page parity is made.

### Save benchmark
The ignored 100,000-word active-entry delta-save benchmark was run three times in release mode with `fullfsync=ON` on this Intel Mac at load about 2: p95 116.57, 130.43 and 124.37 ms against the 150 ms budget, median about 108 ms (`node_modules/.cache/personal-word-beta/team-t018/logs/bench-release-{1,2,3}.log`; `wp11-matrix.md` section 5). This supersedes the earlier statement that the budget was not met (p95 346.55 ms with `fullfsync` on at load about 49, and 499.44 ms with it off at load about 107; D1 finding 3 in `agent-work/2026-10-20-beta-roadmap/06-durability/IMPLEMENTATION_LOG.md`, which stays as history, as does the "not met" line in `HANDOFF.md`). The D1 numbers were taken on a heavily loaded host. The new figures are one machine's measurements, not a guarantee. Apple silicon is unmeasured, and a loaded machine can still exceed the budget.

### Still pending
- Evidence manifest verification and the fresh normal `Personal Word.app` build: these were pending at T020 time and were run by task T021 on 2026-10-25 (see the Gate D section below). Gate D (T022) has reviewed them. The owner checklist (T023) was still open when this was written.
- T043 (multi-paragraph footnotes) is no longer open: found by T019 (the legacy PDF exporter refused any note containing a newline, and DOCX wrote one run with literal line feeds), repaired and independently reviewed (approved by agent-7cc8, board status done). Notes are now split into separate paragraphs in both formats. Not checked: Word rendering; DOCX continuation paragraphs have no indent while PDF's are indented. Its logs are in `node_modules/.cache/personal-word-beta/team-t043/` and `team-t043-review/`.
- Owner real use on the Intel Mac and on Apple silicon, Microsoft Word rendering, VoiceOver and input methods, long sessions, and physical power loss. Automated tests, native harness runs and rendered artifacts do not replace any of these. Physical power loss and hardware failure are not claimed; keep external backups.

## 2026-10-25 Gate D -- final qualification (CLAIMED, not beta ready)

Added by task T049 from `docs/agent-work/2026-10-24-team-reconciliation/evidence.md` (sections 1-4 and 7), `gate-d.md` and `docs/agent-work/2026-10-20-beta-roadmap/06-durability/REVIEW.md`. The earlier sections above are kept as history and the counts in them (858 units in 46 files; native runs `20261025T084201Z-0cea2da3`, `20261025T084244Z-642b9c8a`, `20261025T084746Z-dadedb9c`; "no single full-suite browser run") are superseded by this section. Nothing here is VERIFIED: only the owner's real use can make it so.

Task T021 (agent-dbd8) ran the final qualification serially on the current tree with Node v22.23.3 and wrote the verifier; task T046 repaired one stale browser test and reran the browser suite; task T022 (Gate D, agent-9e61, independent) reran the key checks and wrote the verdict. **Verdict: PASS for automated acceptance; beta readiness pending owner real use.** No check failed in the final state, none was waived, and nothing blocked was counted as passed.

| Check | Result | Log |
|---|---|---|
| `npx tsc --noEmit -p .` | exit 0 | T021 `logs/1-tsc.log`; Gate D rerun `team-t021-review/logs/1-tsc.log` |
| Unit suite, `npm test -- --no-file-parallelism --maxWorkers=1` | **865 passed in 47 files** (858 in 46 before T043) | T021 `logs/3-vitest.log`; Gate D rerun `team-t021-review/logs/2-vitest.log` |
| Production-preview Playwright, one worker, retries 0, Chromium only | **112 passed, 0 failed across 23 spec files** after T046 (T021's first run was 111/112; the failure was `tests/features.spec.ts:116` clicking a button that moved into the "More formatting" menu, repaired in T046 by using the spec's `toolbarButton()` helper) | `team-t046/`; Gate D rerun `team-t021-review/logs/4-playwright.log`, per-spec counts equal to `EVIDENCE.json` |
| Rust, `cargo test --locked --offline --jobs 1 -- --test-threads=1` | 48 passed, 0 failed, 1 ignored (the 100,000-word benchmark) | T021 `logs/5-cargo.log`; Gate D rerun `team-t021-review/logs/3-cargo.log` |
| Save benchmark, release mode | 100,000 words, 100 saves: median 108.12 ms, p95 117.98 ms (bound 150 ms); one Intel Mac at load about 2 | T021 `logs/9-bench.log` |
| Native baseline | run `20261025T093854Z-eb139b9b`: 13 scenarios passed + 5 negative controls detected | T021 `logs/7-native-baseline.log` |
| Native beta | run `20261025T093937Z-7c31d8de`: 19 passed + 42 negative controls detected | T021 `logs/8-native-beta.log` |
| Native beta, Gate D reviewer rerun | run `20261025T100024Z-93ccb1f1`: 19 passed + 42 detected, same identity and binary | `team-t021-review/logs/5-native-beta.log` |
| Native print matrix; `verify-release.py` | not run, not applicable (WP8 STOP, WP9/WP10 cancelled; release script needs a clean git tree and a DMG, distribution descoped) | -- |

Native identity: both native suites and the reviewer rerun ran against source identity `7e07795970ee8195846170a408c43f9e70b4135aecebe4527e0a5d76926f3e94` (143 inputs) and the diagnostic binary `9d4c24feeb89d3332069bafc38c20a4aa55121f1108a7054baf77e80e10de3a4`, on `macOS-15.7.9-x86_64`, with the isolated `com.folio.smoke` profile only (the real `com.folio.writing` library was never opened). The evidence source manifest `docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json` lists 207 files with digest `ed8ea16f12a9af75213b5a12b0e468ac65ca13c5bfed025d14671881d3cc9772` (superseded by `24fa1a86893ba3a6cf4cc08471b222949c5b7ec9eaf34840e0bed5720928e97c` after T048 regenerated the manifest; same 207 files, the digest is the manifest's own `manifestSha256` field, which the verifier recomputes) (regenerated by T046; the earlier digest `950a42bc...` is superseded). These documents are outside that manifest.

### Normal app (task T021, inspected by Gate D)
- Path: `src-tauri/target/release/bundle/macos/Personal Word.app` (absolute: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`), built with plain `npm run tauri build` (no features, no config override) on 2026-10-25 05:43-05:45 EDT; 15.49 MiB.
- Main binary `Contents/MacOS/folio`: sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`, Mach-O x86_64. `Info.plist`: name and display name "Personal Word", identifier `com.folio.writing`, version 0.1.1.
- Marker scan of the whole binary (by T021 and again by Gate D): zero hits for the diagnostic smoke markers (`smoke_beta_fixture`, `post-asset-stage`, `post-merge-safety-snapshot`, `post-restore-safety-snapshot`, `FOLIO_SMOKE`, `com.folio.smoke`, `native-print`, `native-smoke` and others); the same scan finds them in the smoke binary, so the scan works.
- Not signed, not notarized, not published. It has never been opened. Its first launch opens the real `com.folio.writing` library, so the owner does that, not an agent. The previous bundle (binary `86d9e980...`) was replaced; a copy is kept only in the cache folder for the stale-bundle control.

### Evidence verifier
`python3 scripts/verify-beta-evidence.py --evidence docs/agent-work/2026-10-20-beta-roadmap/06-durability/EVIDENCE.json --source-manifest docs/agent-work/2026-10-20-beta-roadmap/06-durability/SOURCE_MANIFEST.json` exits **2** ("consistent but incomplete"): no failed check, ten items pending (the independent review's own recording plus the nine owner items). Gate D's own run is `team-t021-review/logs/6-verify-real.log` (0 FAIL, 10 pending). Fail-first controls: T021 made 14 doctored or synthetic controls, each producing its own named reason; Gate D added more and found one weakness (the verifier accepted any "verdict: PASS" substring in a review file), filed as T048. After the owner's nine confirmations were recorded (OWNER_TEST_RESULTS.md), the verifier reached **exit 0** ("All required evidence verified") on 2026-10-25; see the cheap-fixes validation section below.

### Still pending after Gate D (owner only; none may be recorded as passed by an agent)
The nine owner items: keyboard-only editing and the duplicate-comment jump in the real app; blocked-close retry; the recovered image and its hash; reopening the pre-restore safety copy; Microsoft Word rendering of the exported DOCX; an Apple silicon run; VoiceOver and input methods; a long real writing session; native WebKit light/dark visuals. Open owner questions: Q001 (off-board WP8 edits), Q002 (off-board orchestrator edits), Q003 (zip header size limit, B4), Q004 (native print STOP options). The owner checklist (T023) and the verifier recording of the Gate D review (T048) are board work still outstanding when this was written.

### Boundaries that stay in force
Chromium only for browser results; Intel x86_64 and macOS 15.7.9 only; no Apple silicon, no hosted CI, no VoiceOver or input-method evidence; the DOCX was not opened in Word; kills are process kills at named checkpoints in an isolated store, not power loss or disk failure; the benchmark is one machine (p95 116-130 ms at load about 2, 141.69 ms at load about 20-26 on 2026-10-25); PDF tables do not repeat the header row (see the artifact section above and the README limitations). The image-gap and omitted-titles items in earlier lists were fixed on 2026-10-25 (tasks T053 and T054).

## Cheap-fixes validation (2026-10-25, task T070)

The eight cheap-fixes tasks (T050-T057 of `docs/agent-work/2026-10-25-cheap-fixes/PLAN.md`) were implemented, independently reviewed and approved on the team board (T050-T069, including two rework cycles: T051's harness assertion and T052's toast position). The final validation list then ran on the resulting tree, via the recorded T021 serial driver (`run-serial.sh` steps 1-8, then `run-final.sh` steps 9-10; logs and `steps.log` under `node_modules/.cache/personal-word-beta/team-t021/`):

- `tsc --noEmit`: exit 0. Full unit suite: **872 passed in 47 files** (serial, one worker). `npm run build`: exit 0.
- Production-preview Playwright, one worker, no retries: **120 passed** (4.1 min) across the full suite including the nine specs named by the plan (import, import-cancel, rich-import, zotero, research, features, editor-toolbar, notice, markdown-roundtrip).
- Offline serial Rust: **49 passed / 0 failed / 1 ignored**.
- Isolated smoke rebuild (`com.folio.smoke`, debug, `native-smoke`), then native suites: baseline run `20261025T213548Z-f99053d6` and beta run `20261025T213634Z-2cadf18d`, both exit 0 (13 scenarios + 5 detected controls; 19 scenarios + 42 detected controls).
- Save benchmark (step 9): p95 **141.69 ms** on the 100,000-word fixture, within the 150 ms budget, at moderate host load (load average about 20-26 on a machine up 12 days; the earlier 116.57-130.43 ms figures were taken at load about 2). The timing-sensitive baseline close-retry scenario passed in this run.
- Normal app (step 10): rebuilt `src-tauri/target/release/bundle/macos/Personal Word.app`, binary sha256 `0daf16f8fd6d13fa609455282db0fdc1809af507e73555252609aa75f04a6141`, `com.folio.writing` 0.1.1, marker scan zero hits. It supersedes the Gate D app (binary `66da1177...`).
- Evidence: `SOURCE_MANIFEST.json` rewritten from the current tree and `EVIDENCE.json` regenerated by `make_evidence.py`, then the Gate D review record (reviewer agent-9e61, REVIEW.md sha `0065be67...`) and the nine owner gates (passed, owner report) were re-recorded by hand; `verify-beta-evidence.py` exits **0** ("All required evidence verified"). Board questions Q001-Q005 are all resolved (Q005: Chicago's first page keeps no section-title heading, owner decision 2026-10-25).

Full task record: [cheap-fixes-validation.md](agent-work/2026-10-24-team-reconciliation/cheap-fixes-validation.md). Automated results remain CLAIMED until the owner confirms real use of the changed behaviour; the earlier nine beta gates stay VERIFIED by owner report.

## UI polish (2026-10-26, tasks T071-T096)

Status: CLAIMED. Nothing here is VERIFIED; only the owner's real use does that. Plan: [UI polish plan](agent-work/2026-10-25-ui-polish/PLAN.md); critique: [CRITIQUE.md](agent-work/2026-10-25-ui-polish/CRITIQUE.md).

**Built:** native screenshot tool and smoke capture (T071); type and spacing tokens (T072); full interaction states (T073); the design system document (T074); Appearance setting with the Mac title bar following it (T075); Palette setting, Plain and Color, with contrast tests (T076, darkened Color light values in T085); helper captions removed (T077); Projects screen search (T078); Start new project panel with Import a file… and Recover from a project.json file… (T079); drag-and-drop import with the `read_dropped_file` command (T080); critique pass and fixes (T086, T089, T091, T092, T094, T095, T096). T087 (Plain-dark primary contrast 2.45:1) is recorded only; T088 and T093 were withdrawn; T090 (native captures at 1x) is deferred to the later-fixes plan.

**How each was checked:**
- Browser: unit tests (`designTokens`, `appearance`, `palette`, `dropImport`) and the production-preview Playwright specs for each task, one worker, each with a recorded fail-first run on the old build; screenshots at 1440x900 light and dark, viewed.
- Native WebKit: `python3 scripts/native-screens.py` captures from the `com.folio.smoke` build, viewed (Projects, Writing, Research, Settings; Color palette, light; the open create panel is not captured). Native baseline run `20261026T043336Z-a967f58b` and beta run `20261026T043421Z-3ab67752` (T080) passed on the smoke rebuild that includes the drop command.
- Not established: the Finder drag path, the title bar following the app theme, and Cmd+Shift+L in the Mac app; these need the owner's hand checks.

**Final validation (T082, 2026-10-26), CLAIMED:** `tsc` exit 0 on Node v22.23.3; vitest 51 files / 899 tests passed; `npm run build` exit 0; production-preview Playwright, whole `tests/` folder, one worker, no retries, port 1550: 166 passed; offline serial cargo: 55 passed / 0 failed / 1 ignored; smoke rebuild (`com.folio.smoke`), native baseline run `20261026T060417Z-1233af68` (13 scenarios + 5 detected controls) and beta run `20261026T060516Z-9d1bb0f0` (19 + 42), both exit 0; native screens, Plain and Color, 16 PNGs captured and viewed; normal app rebuilt at `src-tauri/target/release/bundle/macos/Personal Word.app` (`com.folio.writing` 0.1.1, binary sha256 `af849a85582797ab1440acfd8cddf6af79fa1c979e42e3b7b4f6d587778052f4`), zero hits for `smoke_snapshot`, `native-screens`, `com.folio.smoke`, `FOLIO_SMOKE` (all found in the smoke binary). README screenshots regenerated at 2880x1800. Not established: the Finder drag path, title bar following the app theme, Cmd+Shift+L and Reduce Motion in the Mac app; the owner's hand-check sheet is in [VALIDATION.md](agent-work/2026-10-25-ui-polish/VALIDATION.md), which holds the full table, log paths and the 16 screenshot notes.

## UI wave 2 (2026-10-26/27, tasks T098-T129)

Status: CLAIMED. Nothing here is VERIFIED; only the owner's real use does that. Plan: [the wave-2 plan](agent-work/2026-10-26-ui-wave-2/PLAN.md).

**Built:** motion tokens and a motion engine with reduced-motion handling (T098, T099); elevation, control-height and icon tokens (T100); the shared Popover behind Dropdown, Sort and every toolbar panel (T101); the create menu morphing out of its button (T102); toolbar label mode and the labelled More menu (T103); sliding selection in the sidebar and Segmented with the new selected look (T104); the sidebar title row and the hover-reveal switch (T105); fixed bottom rows and per-project sidebar switches (T106); split view, its integration and the data-safety repairs (T110, T111); section colours (T119); hidden Essay and Story templates with Chicago renamed (T120); the Bibliography page and source list (T123); PDF attachments opened beside the draft (T125); and this documentation pass (T126). Placeholders T107-T109, T113 and T116-T118 were closed as superseded.

**How each was checked:**
- Browser and unit: each implementation task ran its own production-preview Playwright specs and focused Vitest files on a private build, with a recorded fail-first run on the previous build, under the serial check slot, and each was approved by a non-author reviewer. Logs, fail-first runs and screenshots are under `node_modules/.cache/personal-word-beta/ui2-uN/`.
- Native WebKit: native-reliability on the isolated `com.folio.smoke` build, baseline 13 scenarios + 5 controls PASS and beta 19 + 42 PASS (2026-10-27, `ui2-u19/native/`). Native smoke passed all three phases on the shared tree with an unlocked, visible session (2026-10-27, `t129-owner/smoke.log`); the earlier phase-1 hang was a locked window throttling WebKit requestAnimationFrame (T129, approved as environmental).
- Native screenshots for U19 (SMOKE(19)): Plain 10/10 in `t125-diag/` and Color 10/10 in `t125-diag-color/`, with the PDF probe reporting `application/pdf`; the coordinator's session produced them because a sandboxed process cannot drive a visible window (T125 review, approved by agent-5ffe).
- Not established: native menu motion, Mac Reduce Motion, native title-bar behaviour, and the owner hand checks. Browser checks are not evidence of native WebKit rendering or native persistence.

**Final validation (T127, 2026-10-27):** recorded in [VALIDATION.md](agent-work/2026-10-26-ui-wave-2/VALIDATION.md). Headline numbers: tsc clean; Vitest 56 files, 973 passed; build ok; production-preview Playwright whole folder 214 passed + 1 failed (`tests/writing.spec.ts:2`, a stale locator that clashed with the new open-beside button; filed as T130, fixed test-side, lone rerun 3 of 3 passed); cargo 57 passed, 1 ignored; native-reliability baseline 13 + 5 and beta 19 + 42 passed; native smoke passed all 3 phases (unlocked screen); native screenshots 10 Plain + 10 Color, all viewed, PDF drawn in the window; bibliography type order identical in the page, DOCX, PDF and Markdown; normal app rebuilt (`com.folio.writing`, zero smoke markers, binary sha256 13e98e8c...). The owner hand-check sheet is in that file with empty results. Everything is CLAIMED.
