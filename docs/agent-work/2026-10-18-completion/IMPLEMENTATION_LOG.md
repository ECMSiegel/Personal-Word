# Implementation log -- 2026-10-18 completion

Base HEAD: `c62332c`. Dirty baseline captured under ignored `node_modules/.cache/personal-word-completion/`; earlier implementation/publication work is preserved. Status labels describe implementation evidence, not owner confirmation. Owner real-use confirmation is outstanding throughout.

| Task | Owner | Status |
| --- | --- | --- |
| T1 Reference and baseline | Root | DONE -- reference read; source baseline captured |
| T2 Save/recovery | Luna persistence, integrated by root | DONE for implementation and isolated native qualification; see `persistence-log.md` |
| T3 Export | Luna export, inspected by root | DONE for automated XML/content checks and rendered-artifact inspection; see `export-log.md` |
| T4 UI | Luna UI, acceptance run by root | DONE for the browser acceptance command; native WebKit and VoiceOver remain owner confirmation; see `ui-log.md` |
| T5 Import/App | Root | DONE for unit and browser acceptance |
| T6 Integration/review/delivery | Root; independent review left to the next agent | DELIVERED for integration, final checks, documentation, and the release bundle; `REVIEW.md` deliberately not written by the integrating agent |

## Authority and decisions

- User authorized finishing local work with subagents and explicitly permitted package installation. Root owns installs/shared types and logs integration here.
- Reviewed the reference rather than installing it. No donor source or data copied. Detailed assessment in `docs/ui-reference-assessment.md`.
- No commits, publication, remote/account changes, history rewriting, or user-data cleanup.
- Unit, browser, native, and owner evidence remain distinct. The isolated native harness now produces a passing three-phase run; that is automated native evidence, not the owner's real-use confirmation.

## Evidence

Per-track fail-first commands/results are in `persistence-log.md`, `export-log.md`, and `ui-log.md` beside this file. Root integration results:

- `npm run build` -- pass.
- `npx tsc -b` -- pass.
- `npm test` -- 77 tests passed in 10 files, including the new fail-first DOCX numbering case and the Markdown import suite.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml` -- 17 passed, 1 ignored.
- `npm run test:e2e -- --workers=1` -- 37 passed in Chromium in 1.7 minutes against a dev server owned by the runner. An earlier run reused a stale server that died mid-run and reported 29 `ERR_CONNECTION_REFUSED` failures; that is a tooling result, not a product one.
- `npm run tauri build` -- pass; fresh `src-tauri/target/release/bundle/macos/Personal Word.app` (2026-10-18 06:00, 14.92 MiB) with `CFBundleIdentifier=com.folio.writing`, `CFBundleName=Personal Word`, and no harness symbols in the shipped executable.
- `npm run render:export-fixtures` -- writes synthetic DOCX/PDF fixtures; both render in QuickLook with Greek/Cyrillic, strike, hard break, bullet, nested list start 4, a long-token split, and a footnote plus bibliography.
- Isolated native smoke (`--features native-smoke --config '{"identifier":"com.folio.smoke"}'`): all three phases passed against the same isolated data directory, including page fragmentation ("Section page 1 of 6"), quit flush, SQLite integrity, portable-mirror equality, journal recovery after deliberate termination, and snapshot restoration. Redacted summary in `docs/evidence/native-smoke-2026-10-18.json`.
- `python3 scripts/license-inventory.py` -- 254 npm and 456 Cargo packages, no missing declared license metadata.
- `git diff --check` -- clean.

## Blockers and repair rounds

- Repair round 1 (root, before review): fixed the smoke command's exit path (phases 1 and 3 skipped the frontend flush), the harness's page-view toggle polling, the phase-2 checkpoint debounce race, and the misleading "no report" timeout; added breadcrumb diagnostics. Details in `persistence-log.md`. This also removed an unused `@types/markdown-it` dev dependency, since `markdown-it` 15 ships its own declarations.
- Open environmental note: in this background agent session the isolated harness intermittently stalls after enabling page view, with the WebView page suspended and no report produced. The same binary completes the full run when the window renders; the passing run and a stalled run are both preserved in the ignored cache and described in `docs/validation.md`.

### Operational clarification

Playwright clears `test-results/`, so durable baseline/mutation/evidence copies live under `node_modules/.cache/personal-word-completion/`. Application starting source was recovered from the previous clean-source copy plus starting source reads; this is not claimed as a perfect byte-for-byte snapshot of all prior documentation. Git email/privacy, repository owner/name, visibility, publication, and Apple signing remain open user decisions.

### T5 fail-first

`npm test -- src/import/manuscript.test.ts`: 3 failed, 3 passed. All three new Markdown cases failed with the existing explicit `Markdown import requires ...` rejection. The earlier test expecting rejection was replaced because the approved task intentionally adds Markdown support; decoding and size checks remain.

### Review repair round 1 -- 2026-10-18

Written review: `REVIEW.md`, verdict CHANGES REQUIRED. Owner requires completion committed before writer-feature implementation; no feature source changes made.

| Finding | Action | Evidence |
| --- | --- | --- |
| 1: Invalid PDF embedded fonts | Fixed by Luna in pdf.ts/fonts.ts/document.test.ts | Bundled WOFF companions + subset:true emit PDF-compatible font programs; regression and Poppler pass, details below |
| 2: Automated results labelled VERIFIED | Fixed | persistence-log.md automated acceptance labels changed to CLAIMED, command outcomes retained |
| 3: smoke_progress registration scope | Explicit deviation recorded | T2's original lib.rs scope said instance-lock tests only; root integration additionally registered smoke_progress so the planned harness diagnostics reach its smoke-only IPC handler. This is diagnostic plumbing, not a normal-build persistence change; see lib.rs cfg(feature = "native-smoke") handler. |

Fresh independent-review checks before repair: build passed; unit 77/77 passed; Rust 17 passed, 1 ignored. Browser startup blocked by sandbox localhost bind EPERM; a permissioned rerun is planned after repair. Native smoke build remains the existing session 30828, log /tmp/pw-review-native-build.log; do not duplicate.

#### Finding 1 fail-first and repair evidence

- Luna reproduced invalid fonts with `npm run render:export-fixtures` then `pdftotext`: repeated `Embedded font file may be invalid`, stripped Latin/Greek/Cyrillic text.
- `npm test -- src/export/document.test.ts -t 'PDF-compatible font programs'` on WOFF2 + subset:false failed `expected false to be true` because font streams began `wOF2`. This regression inspects decoded embedded font bytes through existing pdf-lib, without a system-tool dependency.
- WOFF2 + subset:true also failed in fontkit's TTFSubset glyph encoder. Installed fontsource packages include WOFF companions: switching those imports in planned fonts.ts and keeping subset:true emitted TrueType subsets without new assets/dependencies.
- Same targeted command after repair passed (1 passed, 10 skipped); regression strengthened to require at least three font programs for the three-script fixture. Full `npm test -- src/export/document.test.ts` passed 11/11. Agent output not retained as a separate raw test log; integration final unit suite below is independently recorded.
- `npm run render:export-fixtures` passed; `pdftotext` and `pdftoppm` emitted no invalid-font errors. `/tmp/pdf-repair-after.txt` preserves Cafe (accented), Greek, Cyrillic, strike text, hard break, note, bibliography; `/tmp/pdf-repair-after-1.png` and `-2.png` show the actual pages. Integrator inspected both images: multilingual text, nested list, long token, footnote and bibliography legible. Reviewer also inspected them.
- Native smoke build passed after 14m54s; the existing harness run timed out in phase 1 after 180s before any progress.log, with LaunchServices/hiservices connection-invalid errors. Runner cleaned up its isolated app. Full logs `/tmp/pw-review-native-build.log` and `/tmp/pw-review-native-smoke.log`. No fresh native runtime result.
- `git diff --check` passed after repairs. Final post-repair gates still running.

### Proposed prerequisite commit scope -- NOT committed

Accumulated application/completion/publication-preparation work includes pre-existing changes from prior sessions. Explicit owner approval is required before committing this combined baseline. Excludes the parallel README draft/screenshots and writer-features role files. Exact proposed paths (62):

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/workflows/ci.yml`
- `.gitignore`
- `CONTRIBUTING.md`
- `HANDOFF.md`
- `LICENSE`
- `README.md`
- `ROADMAP.md`
- `SECURITY.md`
- `THIRD_PARTY.md`
- `docs/agent-work/2026-10-18-completion/IMPLEMENTATION_LOG.md`
- `docs/agent-work/2026-10-18-completion/PLAN.md`
- `docs/agent-work/2026-10-18-completion/REVIEW.md`
- `docs/agent-work/2026-10-18-completion/export-log.md`
- `docs/agent-work/2026-10-18-completion/persistence-log.md`
- `docs/agent-work/2026-10-18-completion/ui-log.md`
- `docs/app-history.md`
- `docs/architecture.md`
- `docs/dependency-licenses.json`
- `docs/evidence/current-workspace.png`
- `docs/evidence/native-smoke-2026-10-18.json`
- `docs/evidence/native-smoke.json`
- `docs/personal-word-v2.md`
- `docs/plans/application-improvement-plan.md`
- `docs/publication-readiness.md`
- `docs/ui-reference-assessment.md`
- `docs/validation.md`
- `package-lock.json`
- `package.json`
- `scripts/license-inventory.py`
- `scripts/native-smoke.py`
- `scripts/render-export-fixtures.mjs`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/smoke.rs`
- `src/App.tsx`
- `src/Writer.tsx`
- `src/app/ProjectDialogs.tsx`
- `src/components/Dropdown.tsx`
- `src/components/ProjectLibrary.tsx`
- `src/components/dropdown.css`
- `src/editor/editor.css`
- `src/editor/useFootnoteLayout.ts`
- `src/export/ExportPanel.tsx`
- `src/export/document.test.ts`
- `src/export/document.ts`
- `src/export/docx.ts`
- `src/export/export-fixtures.ts`
- `src/export/fonts.ts`
- `src/export/pdf.ts`
- `src/import/ImportPreview.tsx`
- `src/import/manuscript.test.ts`
- `src/import/manuscript.ts`
- `src/save-queue.test.ts`
- `src/save-queue.ts`
- `src/styles.css`
- `src/vite-env.d.ts`
- `tests/accessibility.spec.ts`
- `tests/import.spec.ts`
- `tests/native-smoke.js`

#### Final post-repair validation -- 2026-10-18

- `npm run build` exit 0; /tmp/pw-repair-build.log, Vite built in 42.90s.
- `npm test` exit 0; /tmp/pw-repair-unit.log: Test Files 10 passed (10), Tests 78 passed (78).
- `npm run test:e2e -- --workers=1` exit 0; /tmp/pw-repair-e2e.log: 37 passed (3.2m). Permissioned local owned server; /tmp/pw-repair-vite.log. Server cleaned up.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml` exit 0; /tmp/pw-repair-cargo.log: 17 passed; 0 failed; 1 ignored.
- `npm run render:export-fixtures` exit 0; /tmp/pw-repair-fixtures.log, nonfatal HMR EPERM. `pdftotext` preserves scripts; `pdftoppm` renders both pages without font errors (/tmp/pw-repair-render.log empty). Integrator inspected /tmp/pw-repair-final-{1,2}.png.
- Permissioned `qlmanage -t -s 1200 -o /tmp test-results/export-fixtures/export-fixture.docx` exit 0: produced one thumbnail. Inspected /tmp/export-fixture.docx.png; QuickLook remains limited for native footnotes/nested indentation, and Word itself is not qualified.
- `python3 scripts/license-inventory.py`: 254 npm, 456 Cargo; zero missing metadata. `git diff --check` exit 0.
- Native smoke build passed; runtime timeout remains recorded above.
- Normal `npm run tauri build` exit 0; /tmp/pw-repair-release.log: release target finished in 4m21s, 15.25 MiB Personal Word.app. Info.plist confirms Personal Word / com.folio.writing / 0.1.0 / folio; executable built 2026-10-18 15:43:25 America/New_York, newer than all src and src-tauri/src. strings finds no smoke_report/smoke_progress. No active qualification jobs remain.
