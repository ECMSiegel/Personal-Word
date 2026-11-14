# Layout-primitives batch: rules for every worker

Project: "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor" (Personal Word, Tauri/React/Tiptap),
git branch `layout-primitives`. Always double-quote paths. Use `/usr/bin/find`, never plain `find`. No GNU `timeout`.

1. Read AGENTS.md, then docs/design-system.md, then in docs/agent-work/2026-11-12-layout-primitives/PLAN.md ONLY:
   "Goal", "Non-goals", "Rules in force", "Approach" (incl. "The system"), "Notes for the implementer", and YOUR task
   section (T<n>). Follow your task exactly. If the plan and the code disagree, do not invent: `block` and report.
2. Board. Your prompt names your board task. `python3 team/team.py join --label "<label from your prompt>"`; pass
   `--agent <ID>` on every command; run some team.py command at least every 10 minutes. `claim <T>` then `start <T>`.
   Change only your task's registered paths plus the shared-file selectors your task owns. For any other path first
   `files add <T> --agent <ID> "<path>"`; if that exits 2, do not touch it and say so. Finish with
   `done <T> --agent <ID> --note "<what changed, files, fail-first evidence, commands and results>"`, `check-exit`,
   `leave`. At your tool-call cap or any limit: `handoff <T> --agent <ID> --note "..."` (form in team/PROTOCOL.md
   "The limit rule"), `check-exit`, `leave`.
3. Shared files, registered on no task, edited by several workers at once: src/styles.css, src/App.tsx, src/Writer.tsx,
   src/editor/editor.css, src/components/ProjectSidebar.tsx, src/layoutBudget.json, tests/layout-invariants.spec.ts,
   docs/design-system.md. Ownership is by SELECTOR / JSX region / JSON key / test `describe`, as your task says.
   Edit tool only, small regions, re-read the region right before each edit, no rewrites, no formatter.
   NEVER revert, restore from a backup, or `git checkout`/`git stash` any file -- not even briefly for a fail-first run.
4. Fail-first: write or un-fixme the test first and run it BEFORE your change; save the failing output to
   docs/agent-work/2026-11-12-layout-primitives/notes/T<n>-fail-first.txt. Then implement.
5. Commands. First: `export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"`
   - Unit: `npx vitest run <files>`. Types: `npx tsc -b` (errors in regions you do not own may be another worker
     mid-edit: wait a minute, rerun once, then list them; do not fix them).
   - Browser: `PLAYWRIGHT_PORT=<port from your prompt> npx playwright test <spec files> --output test-results/<T>`
   - SERIAL LOCK around every Playwright run (one browser run on the machine at a time; waiting is normal):
     `until mkdir node_modules/.cache/personal-word-beta/serial-check.lock 2>/dev/null; do sleep 20; done; echo "<T>" > node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt`
     then run, then ALWAYS, even on failure:
     `rm node_modules/.cache/personal-word-beta/serial-check.lock/owner.txt; rmdir node_modules/.cache/personal-word-beta/serial-check.lock`
     Lock only the spec files your task lists, and keep the number of locked runs small (aim for three: fail-first,
     after, final). Do NOT run wide "before" baselines of other specs.
   - Tests must also work against the built app: no `import("/src/...")` inside page.evaluate; wait for a popover's
     reveal animation to finish before measuring or hit-testing.
   - Anything over 2 minutes: background with a log, read the whole log.
6. Never: npm run build, npm run tauri build, PLAYWRIGHT_PREVIEW, cargo, any native or screen-taking script, git
   stash/checkout/reset/clean/commit, rm -rf, installing packages, a new hover weight or scale rule, @keyframes, fills
   for selection, renaming folio.* keys, opening the owner's real projects, tasks T250/T253/T278. Do not change
   behaviour, wording, colours, fonts or motion unless your task says so. Do not raise a number in
   src/layoutBudget.json.
7. LOOK at what you built: take a light and a dark screenshot of your surfaces into
   docs/agent-work/2026-11-12-layout-primitives/notes/ (inside one of your locked runs) and open them with the Read
   tool. Fix what looks wrong before `done`.
8. Finish: write docs/agent-work/2026-11-12-layout-primitives/notes/T<n>.md (what changed, what the owner sees, old
   and new numbers, limits, exact hand check). Report back in at most 12 lines: board state, files changed,
   fail-first result, commands with pass/fail counts, budget before/after for your files, anything the review or the
   other workers must know.

## Addendum after T0 (read this too)
- T0 is done: tokens in the `:root` block of src/styles.css, classes in src/components/layout.css, helpers in
  tests/layout-helpers.ts, counting rule in notes/T0.md (any non-zero margin/padding/gap/height/min-height counts,
  var() included; document selectors and print are skipped).
- Budget file: lower the line of every file you own ALONE in the same change. For the files several workers edit
  (src/styles.css, src/editor/editor.css, src/research/research.css, src/organization/organization.css,
  src/components/library.css, src/export/export-menu.css) do NOT edit the budget line: the coordinator sets those at
  the end. `src/layoutPrimitives.test.ts` will therefore report "lower the budget" for those files while work is in
  flight: expect it, ignore that message for those files only, and report in your notes how many declarations you
  removed from each (count before and after within your own selectors).
- tests/layout-invariants.spec.ts: edit only the `describe` block(s) tagged with your task id; un-fixme them and adjust
  selectors to what you actually built. If your task has no block there, add one tagged with your id at the end.
- The eight migration tasks T1..T8 run at the same time. Expect `npx tsc -b` and unrelated specs to wobble while
  others are mid-edit; judge only your own surfaces and specs.

## Addendum 2 (from the Opus review of T0, REVIEW-1.md)
- CSS load order: almost every component stylesheet loads BEFORE src/components/layout.css (src/main.tsx imports App
  first), so a primitive wins a tie against a single-class component rule, and a single-class component override of
  a primitive loses silently. Therefore: DELETE the old height/padding/gap/margin declarations instead of relying on
  either side winning (a leftover block padding makes a `.row` taller than 32). Two-class rules (`.writer >
  .format-bar`, `.writer .toolbar-popover`, `.sidebar-shell .sidebar`) still beat primitives: remove or reduce them.
  Stylesheets that load AFTER layout.css: prose-issues.css, icon-magnify.css, appearance-settings.css, side-ruler.css.
- `.bar` and `.row` now honour `.gap-N` (their gap is `var(--gap, var(--space-2))`). `.menu` now pins
  `--row-height` to 32 so a dropdown opened inside a `.panel` keeps 32px rows.
- Comparing columns: a 14px chevron sits 1px inside a `.flush-end` edge. In invariants compare SLOT BOXES for column
  alignment and use ink only for text/16px icons.
- `ink()` cannot measure inputs, selects or checkboxes: use the element's bounding box for those.
