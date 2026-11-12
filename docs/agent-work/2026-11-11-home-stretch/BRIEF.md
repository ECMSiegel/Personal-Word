# Home-stretch batch (owner hand-test of 2026-11-11, second round)

Coordinator checkpoint and worker brief. Project: "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
(Personal Word, Tauri/React/Tiptap). Always double-quote paths. Use `/usr/bin/find`, never plain `find`.

## State when this was written
- Old team board archived to docs/agent-work/2026-11-11-team-board-archive/team/ (owner approved). Fresh board in team/.
- Owner decisions: page numbers = position choice only (no header/footer text yet); default "sans" document
  font follows the interface font; sections = owner wants NEW TOP-LEVEL sidebar sections beside Manuscript
  (research running, built after this batch); checkboxes square everywhere.
- Nothing is committed. Never commit.

## Tasks (one worker each, all in parallel)
| ID | Task | Files you own (regions only where marked shared) |
|---|---|---|
| HS1 | Export menu opens above the format bar | src/export/export-menu.css, tests/hs1-export-menu.spec.ts |
| HS2 | Line-spacing popover: drop "pt", equal-width right-aligned boxes | src/Writer.tsx `case "spacing"` region (shared), src/editor/editor.css `.toolbar-field*` rules (shared), tests/hs2-spacing.spec.ts |
| HS3 | Square checkboxes everywhere | src/styles.css checkbox rules ~495-515 (shared), checkbox rules in src/research/research.css, src/editor/editor.css `.prose-check-panel` (shared), src/components/prose-issues.css, src/organization/organization.css, inline styles in src/research/CslImportPreview.tsx, docs/design-system.md (checkbox line only), tests/hs3-checkbox.spec.ts |
| HS4 | Docked sidebar: title aligns with the top bar, search aligns with the format bar | src/styles.css `.sidebar-title-row`, `.search`, `.sidebar-shell .sidebar` rules (shared), tests/hs4-sidebar-align.spec.ts (or tests/alignment.spec.ts additions) |
| HS5 | Text typed after a page break keeps the font and size | src/editor/pageBreakKeys.ts, src/Writer.tsx "Insert page break" handler region (shared), a unit test beside pageBreakKeys |
| HS6 | Floating sidebar in Read manuscript | src/components/floating.ts, src/components/floating.css, tests/floating.spec.ts |
| HS7 | "Sans" document font follows the interface font | src/Writer.tsx font-stack region ~325-340 (shared), src/styles.css `.writing-surface`/`.read-prose` font rule ~1950-1960 (shared), src/editor/editor.css ~545 and ~710 (shared), src/organization/fragments.css ~99, src/App.tsx reader font defaults (shared), src/export/* font selection, tests |
| HS8 | Page number position option | src/research/types.ts (DocumentSettings), src/Writer.tsx Page setup popover region (shared), src/export/ExportPanel.tsx, src/export/pdf.ts, src/export/docx.ts, their tests |

## Rules for every worker
- Read AGENTS.md first; read docs/design-system.md before touching CSS. Do exactly your one task.
- Shared files (src/styles.css, src/App.tsx, src/Writer.tsx, src/editor/editor.css): other workers are
  editing them right now. Edit tool only, small regions, re-read the region right before each edit,
  no rewrites, no formatter, never revert a change you did not make.
- Board (owner asked for board-run agents). Your prompt names your board task T<n>.
  1. `python3 team/team.py join --label "<label from your prompt>"`; note the ID; pass `--agent <ID>` on every
     command; run some team.py command at least every 10 minutes.
  2. `claim <T>` then `start <T>`. Read what it prints. If the claim is refused: report why, `leave`, stop.
  3. Change only the task's registered paths (`show <T>`) plus the SHARED-file regions your section names.
     For any other path first `files add <T> --agent <ID> "<path>"`; if that exits 2 do not touch it and say so.
     The SHARED files are registered on no task: src/styles.css, src/App.tsx, src/Writer.tsx, src/editor/editor.css.
  4. Finish: `done <T> --agent <ID> --note "<what changed, files, fail-first evidence, commands and results>"`,
     then `check-exit`, `leave`. At about 45 tool calls without finishing, or any limit:
     `handoff <T> --agent <ID> --note "..."` (form in team/PROTOCOL.md "The limit rule"), `check-exit`, `leave`.
  Your full task text is your section of docs/agent-work/2026-11-11-home-stretch/TASKS.md.
- Fail-first: write the test first, run it, keep the failing output in
  docs/agent-work/2026-11-11-home-stretch/notes/<ID>-fail-first.txt, then fix.
- Commands. First: `export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"`
  - Unit: `npx vitest run <your files>`. Types: `npx tsc -b` (errors in regions you do not own may be another
    worker mid-edit: wait a minute, rerun once, then list them; do not fix them).
  - Browser: `PLAYWRIGHT_PORT=<port from your prompt> npx playwright test <your spec files> --output test-results/<ID>`
  - SERIAL LOCK around every Playwright run (one browser run on the machine at a time; waiting is normal):
    `until mkdir node_modules/.cache/personal-word-beta/serial-check.lock 2>/dev/null; do sleep 20; done; echo "<ID>" > node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt`
    then run, then ALWAYS, even on failure:
    `rm node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt; rmdir node_modules/.cache/personal-word-beta/serial-check.lock`
    Keep each locked run short (your own spec files only) so others are not starved.
  - Anything over 2 minutes: background with a log, read the whole log. No GNU `timeout` on this Mac.
- Never: npm run build, npm run tauri build, PLAYWRIGHT_PREVIEW, any native or screen-taking script, git
  stash/checkout/reset/clean/commit, rm -rf, installing packages, a second hover weight or scale rule,
  @keyframes, fills for selection, renaming folio.* keys, opening the owner's real projects.
- Hover/emphasis has ONE rule guarded by src/hoverEmphasis.test.ts; motion is transform/opacity/clip-path
  only, <=220 ms (src/motion.test.ts). Square corners. UI dash is '--'.
- Finish: write docs/agent-work/2026-11-11-home-stretch/notes/<ID>.md (what changed, what the owner sees,
  limits, exact hand check). Report back in at most 10 lines: state, files changed, fail-first result,
  commands with pass/fail counts, anything validation must watch.

## After the workers (coordinator)
Top-level sections build -> one Opus review of the whole diff -> repairs -> tsc, build, npm test, full e2e
(serial lock, background) -> `touch src-tauri/src/lib.rs` + release build -> HANDOFF.md.
