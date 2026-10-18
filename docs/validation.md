# First milestone validation — October 14, 2026

This is a working local desktop slice, not a production durability certification.

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
