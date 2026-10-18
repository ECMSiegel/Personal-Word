# Current authorization -- 2026-10-18

Owner now requests "implement/commit everything uncommitted or unbuilt that is planned". Commit accumulated planned baseline, then execute approved writer plan with Luna subagents, qualify/rebuild/review/commit. This supersedes pending commit-authorization statements below. Native smoke limitation remains explicit.

# Latest pickup state -- 2026-10-18

This section supersedes conflicting next-step/status claims below; preserve both earlier sessions as history.

## Owner instruction and gate
- Owner: "Implement the plan with Luna sub agents". Writer-features PLAN.md is now APPROVED with its four named defaults.
- T0 question explicitly asked whether to build on the uncommitted completion tree. Owner answered: **"Wait until the completion work is committed"**. No writer-feature source edits have started. Do not bypass this gate. No new commit authorization was given; propose exact scope for approval after prerequisite qualification.

## Done this pickup (do NOT redo) -- CLAIMED
- Luna independent reviewer wrote completion/REVIEW.md, found a High defect: PDF embedded WOFF2 bytes were invalid font programs and rendered nearly blank in Poppler. Also found two documentation issues.
- Luna repair: src/export/fonts.ts uses existing bundled .woff companions; pdf.ts embeds with subset:true. WOFF2+subset:true hit a fontkit encoder error. No installs, new font assets, or dependency changes.
- Added portable regression in document.test.ts that fails original WOFF2 font signatures and passes at least 3 TrueType/OpenType programs for Latin/Greek/Cyrillic.
- Corrected automated VERIFIED labels in persistence-log.md to CLAIMED, and explicitly documented smoke_progress/lib.rs scope deviation in completion IMPLEMENTATION_LOG.md. Reviewer checked both.
- Fresh post-repair checks: npm run build PASS; npm test 78/78 PASS; owned-server permissioned browser suite 37/37 PASS; cargo test --locked --manifest-path src-tauri/Cargo.toml 17 passed, 1 ignored.
- Regenerated fixtures; Poppler text extraction and both page renders pass with multilingual text, nested list, strike, note, bibliography. Integrator visually inspected both pages. License inventory 254 npm / 456 Cargo, 0 missing metadata. git diff --check PASS.
- Native smoke build PASS; harness phase 1 timed out after 180s with LaunchServices/hiservices errors, before progress.log. Harness cleaned up its isolated app. Fresh native runtime remains BLOCKED, not a product success or confirmed defect.

## In progress / next concrete action
1. Normal release rebuild PASS (/tmp/pw-repair-release.log), Personal Word.app at src-tauri/target/release/bundle/macos/Personal Word.app (15.25 MiB). Info.plist: Personal Word / com.folio.writing / 0.1.0 / folio. Executable built 2026-10-18 15:43:25 America/New_York, newer than all app source; no smoke symbols. No active build jobs.
2. Final reviewer reassessment complete: all three code/documentation findings resolved; bundle independently inspected. REVIEW verdict remains CHANGES REQUIRED solely for the blocked native smoke rerun (LaunchServices/hiservices timeout before injection). Other final gates pass. Owner may decide whether to commit the source baseline with this explicit runtime limitation.
3. Ask owner to approve prerequisite accumulated commit: exact 62 paths recorded under "Proposed prerequisite commit scope" in completion IMPLEMENTATION_LOG.md. Includes prior app/completion/publication prep. Excludes README-draft.md, docs/evidence/readme/, writer-features role files. No staging/commit performed. Respect workspace ban on committing another session's files absent explicit approval.
4. After prerequisite commit, execute writer PLAN T0 then T1-T10 with Luna subagents and explicit file ownership. No new dependencies planned.

## Evidence and current state
- main at c62332c, dirty original 55 paths plus review/writer log updates. All modifications uncommitted. Historical persistence keys preserved.
- /tmp/pw-repair-{build,unit,e2e,vite,cargo,fixtures}.log; /tmp/pw-repair-final.txt; /tmp/pw-repair-final-{1,2}.png; /tmp/pw-review-native-{build,smoke}.log. Fixture generator emits nonfatal HMR EPERM but exits 0.
- Native build session 30828 belonged to reviewer agent and is finished; root cannot poll another agent's exec session. Its harness is finished too. Root release session 15782 finished too; no active qualification commands remain.
- Completion repair round evidence and commit scope are in docs/agent-work/2026-10-18-completion/IMPLEMENTATION_LOG.md.

---

# HANDOFF -- Personal Word completion pass, 2026-10-18

> **Two sessions recorded here.** The section below is the completion pass (app code, tests, bundle). A parallel session's state (README draft, competitor research, writer-features plan) is appended at the end under "Parallel session -- README draft and writer-features plan". Read both.

Current state of `Project 13 - Word Processor` for whoever continues this work. Read `AGENTS.md`
(project and workspace), `docs/agent-work/2026-10-18-completion/PLAN.md`, and `docs/validation.md`
(the new 2026-10-18 section) before changing anything.

## What this session did

Finished the remaining work from the approved plan: completed the browser and native qualification,
fixed what failed, refreshed the license inventory, reconciled documentation, and rebuilt the normal
desktop bundle. It deliberately stopped short of independent review: **there is no `REVIEW.md`, and no
`independent-review`/`review-repair` pass has been run.** That is the next step.

## Tree state

- Branch `main`, base commit `c62332c`. **Every change from this pass is uncommitted working-tree
  content.** Nothing was committed, pushed, published, deleted, or renamed.
- The working tree also holds pre-existing uncommitted work (tabs, page view, research, publication
  files). It was preserved, not reorganised.
- Historical persistence identifiers are untouched: `com.folio.writing`, `folio.*` storage keys, and
  native event names.
- The plan records that the user authorised committing reviewed accumulated changes. No commit was
  made because review is deferred. Decide this before committing anything.
- A parallel agent session is active in this folder. Its files (`README-draft.md`,
  `docs/evidence/readme/*.png`, `docs/agent-work/2026-10-18-writer-features/PLAN.md`) are not part of
  this pass and were left untouched; see the environment facts below before re-running anything.

## What changed

Frontend, build, and product fixes (each backed by a test where practical):

- `src/vite-env.d.ts` (new): `vite/client` reference so the `?inline` bundled-font imports type-check.
- `src/import/manuscript.ts`: `markdown-it` typing, `String(t.attrGet("href") ?? "")`, and a local
  `lastIndexWhere` helper (avoids raising the TypeScript lib target to ES2023).
- `src/export/document.ts`: exported `ListInfo`; DOCX now emits **one numbering instance per list**
  with its start value instead of one per list item (fail-first test in `src/export/document.test.ts`).
- `src/export/pdf.ts`, `src/export/export-fixtures.ts`: `Set<PdfFontKey>` and document-settings spread.
- `src/components/Dropdown.tsx`: one keyboard handler shared by the trigger and the focusable listbox.
- `src/editor/useFootnoteLayout.ts` (new): footnote placement extracted from `Writer`.
- `src/app/ProjectDialogs.tsx` (new): dialog rendering/focus handling extracted from `App`.
- `src/editor/editor.css`: `.toolbar-icon` 28x32 px hit area, `.footnote-overflow` banner, and
  `:focus-visible` outlines for toolbar controls.
- `src/save-queue.ts`: 2,000 ms maximum wait from the first pending edit, and immediate persistence
  when the recovery-journal write fails.
- `src/App.tsx`, `src/Writer.tsx`: wiring for the extractions, `folio:quit-requested` flush path,
  page-layout status, footnote-overflow fallback.

Native harness (the substantive repair work of this pass):

- `src-tauri/src/smoke.rs`: phases 1 and 3 now call `app.exit(0)` and let the real `ExitRequested`
  guard ask the frontend to `queue.flush()` before `finish_quit`. Previously they called
  `finish_quit` directly, which synced mirrors but skipped the frontend flush, so the final edit never
  reached SQLite and phase 1 could not pass. Also removed the dead `__SMOKE_CHECKPOINTED__` assignment
  and added a `smoke_progress` command that appends breadcrumbs to the harness data directory.
- `src-tauri/src/lib.rs`: registered `smoke_progress` in the smoke-only handler list; unchanged
  advisory instance lock.
- `tests/native-smoke.js`: opens the More formatting popover once instead of re-toggling it on every
  40 ms poll, waits for `.editor-viewport.is-paged` before asserting page mode, lets the 250 ms
  debounce commit the phase-2 acknowledged checkpoint before the deliberate kill, and reports
  geometry diagnostics plus breadcrumbs.
- `scripts/native-smoke.py`: timeout and missing-report failures now print the last breadcrumbs.

Documentation and inventory: `README.md` intro, new dated section in `docs/validation.md`,
`ROADMAP.md`, `THIRD_PARTY.md` and regenerated `docs/dependency-licenses.json` (**254 npm, 456 Cargo**;
the unused `@types/markdown-it` stub was removed because `markdown-it` 15 ships its own declarations),
`docs/plans/application-improvement-plan.md` (checklist plus a 2026-10-18 execution log), and the
`docs/agent-work/2026-10-18-completion/` logs (`persistence-log.md`, `export-log.md`, `ui-log.md`,
`IMPLEMENTATION_LOG.md`).

## Evidence: what is claimed, what is not

Reproduced in this session (CLAIMED, automated):

- `npm run build` and `npx tsc -b` pass.
- `npm test`: 77 passed in 10 files.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml`: 17 passed, 1 ignored.
- `npm run test:e2e -- --workers=1`: **37/37 passed** in Chromium in 1.7 minutes, against a dev server
  the runner owned.
- Isolated native smoke (debug `--features native-smoke`, `com.folio.smoke`, isolated data directory):
  **all three phases passed.** Page 1 fragmented a 15,900-character paragraph in page view
  (`Section page 1 of 6`), then quit flush, SQLite integrity, portable-mirror equality, journal
  recovery after deliberate termination, and snapshot restore. Redacted summary:
  `docs/evidence/native-smoke-2026-10-18.json`. Breadcrumb logs (ignored):
  `node_modules/.cache/personal-word-completion/native-run/`.
- Export artifacts: DOCX XML contains `<w:br`, `<w:strike`, `<w:footnoteReference`, and two
  `<w:numPr` instances (`numId` 2 and 3, `ilvl` 0 and 1); both DOCX and PDF render in QuickLook.
- License inventory regenerated with no missing declared metadata.

Not verified, and out of scope for automated proof:

- Anything needing a real desktop session or the owner: native light/dark screenshots, VoiceOver,
  IME and rich paste, native file dialogs, Word's own rendering of the exported DOCX, an interactive
  second-instance lock check, and real-use durability. Keep the wording CLAIMED until the owner
  confirms in real use. Never upgrade to VERIFIED on automated evidence alone.

## Three environment facts worth knowing before you re-run anything

1. **Another agent session is working in this folder.** During this pass a separate session created
   `docs/agent-work/2026-10-18-writer-features/PLAN.md` (a DRAFT checkpoint for Zotero import, short
   notes, quote capture, goals and focus, prose check, and whole-project text export), `README-draft.md`,
   and `docs/evidence/readme/*.png` screenshots. Those files are its work, not this pass's, and were left
   untouched. Two consequences: the parallel session's browser and GUI activity is the likely cause of the
   server and WebView flakiness below, and its future `src/` edits would invalidate the evidence here
   (no `src/` file changed after 04:53, so the results above do match the current source). It also drafted
   a replacement README, so this pass's `README.md` intro edit may conflict with that draft -- reconcile
   deliberately rather than letting one overwrite the other.
2. **Native harness can stall.** The same binary intermittently stopped progressing right after enabling
   page view: breadcrumbs end at `ok native paragraph pagination`, the process stays alive at 0% CPU, both
   the app and the WebContent process sit idle in their run loops, no crash report is written, and the
   runner reports a missing report rather than a product failure. Finished runs log
   `document.visibilityState` `visible` when the window was composited and `hidden` in a later phase,
   matching the macOS LaunchServices and `com.apple.hiservices-xpcservice` connection-invalid errors
   recorded on 2026-10-17. The same code path renders six pages whenever the page is visible, so this is
   an environment limitation of a shared, background agent session, not a product result. Re-run on a
   quiet desktop session; the harness now tells you where it stopped.
3. **Browser suite needs a live server.** `playwright.config.ts` sets `reuseExistingServer: true`. One
   full run reported 29 failures, all `page.goto: net::ERR_CONNECTION_REFUSED`, because it reused a dev
   server that died about 85 seconds in (while the other session was running its own browser tooling).
   Start `npm run dev` yourself (or set `reuseExistingServer: false`) before running the suite; with an
   owned server it passes 37/37.

## Exact commands to reproduce

```sh
cd "Project 13 - Word Processor"
npm ci
npx tsc -b && npm run build
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
nohup npm run dev > /tmp/vite-dev.log 2>&1 &   # own the server, then:
npx playwright test --workers=1
npm run render:export-fixtures                 # synthetic DOCX/PDF under test-results/
npm run tauri build -- --debug --features native-smoke --no-bundle \
  --config '{"identifier":"com.folio.smoke","build":{"beforeBuildCommand":""}}'
python3 scripts/native-smoke.py                # prints its isolated data directory
npm run tauri build                            # normal release bundle
```

`test-results/` is cleared by each Playwright run; durable copies of the native evidence and fixture
renderings live under `node_modules/.cache/personal-word-completion/`.

## Release bundle

`npm run tauri build` produced `src-tauri/target/release/bundle/macos/Personal Word.app`, rebuilt
2026-10-18 06:00 local (14.92 MiB reported by Tauri, executable `Contents/MacOS/folio`, 15.6 MB).
Verified in `Contents/Info.plist`: `CFBundleIdentifier=com.folio.writing`,
`CFBundleName=Personal Word`, `CFBundleShortVersionString=0.1.0`. The harness is not in this build:
`strings` finds no `smoke_report`/`smoke_progress` symbol in the shipped executable. The bundle is
unsigned and not notarized, and it is a fresh build, not the older `Folio.app`.

## Suggested review focus

- Does the diff match the plan, and is every behaviour change backed by a test that was seen failing
  first?
- Are the two corrected accessibility assertions legitimate rather than weakened? The toolbar's format
  action intentionally returns focus to the editor, and ProseMirror groups undo steps by time, so the
  undo case needs a settle before asserting.
- Is the `smoke.rs` exit path sound end to end: `app.exit(0)` -> `ExitRequested` prevent -> emit
  `folio:quit-requested` -> frontend `queue.flush()` -> `finish_quit` -> exit?
- Does the 600 ms settle in native phase 2 conflict with the 2,000 ms maximum-wait claim, or does it
  only give the 250 ms trailing debounce time to commit?
- Does one numbering definition per list preserve ordered-list restart semantics in Word?
- Are documentation claims scoped honestly (present -> referenced -> built -> wired -> tested ->
  owner-confirmed), with no CLAIMED promoted to VERIFIED?

## Open decisions for the owner

Nothing is needed to continue the technical work. Outstanding owner decisions are the previously
recorded publication items (remote and repository owner/name, visibility, signing/notarization) and
the interactive confirmation checks listed under Evidence.


---

# Parallel session -- README draft and writer-features plan (2026-10-18, about 06:30)
Session goal was: plan the next stage for publishing Personal Word as a resume project, draft a newcomer README, research competitors, and plan six new writer features.

## Done this session (do NOT redo)
- **README draft**: `README-draft.md` (new file; `README.md` untouched). It covers the intended writer, screenshots, platform, setup, a 6-step workflow, alpha status, and limitations, with claims checked against source. CLAIMED; the owner hasn't reviewed it. It says the latest native run on 2026-10-17 timed out, but the completion pass above now reports all three native phases passing, so update that line before merging.
- **Screenshots**: `docs/evidence/readme/{writing-light,writing-dark,research-light,projects-light}.png`, 2880x1800, browser preview, made-up writing. The script that made them was a throwaway in the session scratchpad and wasn't kept.
- **Competitor research** (Scrivener, Ulysses, iA Writer, Zettlr, Obsidian, Dabble, Atticus, Vellum, Lex, and others). The finding: no competitor does live Chicago footnotes well, and that's Personal Word's opening. It lives only in this conversation; the plan below carries what it decided.
- **Implementation plan**: `docs/agent-work/2026-10-18-writer-features/PLAN.md`. It's complete, self-reviewed, and advisor-checked, with Status DRAFT. Tasks T0-T10 cover Zotero CSL JSON import, automatic Chicago short notes with short titles, quote capture, writing goals, focus mode, a local prose check, and whole-project Markdown or plain-text export. Note: the completion-pass section above calls it a "checkpoint"; it's now the full plan.

## Open tasks (in order)
1. Owner approves the plan or edits it. Next action: the owner answers the four open questions at the end of PLAN.md or accepts the defaults, and chooses Subagent-driven (recommended) or Native execution.
2. Commit or review the completion pass first. Plan T0 blocks until that work is committed, or until the owner says to build on top of it. Next action: run `independent-review` on the completion pass, as its section above recommends.
3. Optionally run `pick-model` on PLAN.md before execution.
4. Reconcile `README-draft.md` with the completion pass's `README.md` intro edit. Merge deliberately; don't let one overwrite the other.

## UI issues seen (not fixed, not in any plan)
- Word/PDF export is only on the Settings page. The top-right download icon saves project JSON, which is hard to discover.
- The book title in the editor's bottom-of-page footnote isn't italic, though the Research panel preview shows italics.
- The Projects screen is sparse: two plain rows on a mostly empty page.

## Rules & traps
- Don't overwrite the other session's files or this file's completion-pass section. Never commit another session's files.
- Plan Status stays DRAFT until the owner approves; implementers start only from APPROVED.
- Existing projects must keep `autoShortNotes` absent (off) so exports don't change silently. Never rename `shortened` or `folio.*`.
- New editor aids go only in the Writer editor, never in `documentExtensions()`, which builds the validation schema.
- Machine: use `/usr/bin/find`; there's no `timeout` command; `~/Downloads` is blocked.

## Verified state at handoff (checked 2026-10-18)
- git: `main` at `c62332c`, dirty (55 paths). Untracked from this session: `README-draft.md`, `docs/evidence/readme/`, `docs/agent-work/2026-10-18-writer-features/`.
- The completion pass's `IMPLEMENTATION_LOG.md` marks T6 DELIVERED, and there's no `REVIEW.md`.
- No app source was edited by this session.

## Next-session prompt
You're continuing Personal Word (Project 13, a Tauri/React local writing app) in "<home>/Local Projects/VC Projects/Project 13 - Word Processor". Read the workspace and project `AGENTS.md`, then `HANDOFF.md`, both sections. Two threads are open. The completion pass is uncommitted and needs `independent-review`. The writer-features plan at `docs/agent-work/2026-10-18-writer-features/PLAN.md` is DRAFT and waiting for owner approval and an execution choice. Don't start the plan until the completion pass is committed or the owner says otherwise. Don't redo the competitor research or the README draft.
