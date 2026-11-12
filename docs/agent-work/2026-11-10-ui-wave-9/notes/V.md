# T277 W9 V -- validation run (agent-575d)

Steps 1-5 run once, in order, under one serial lock (released). Full record: ../VALIDATION.md. CLAIMED, not VERIFIED.
- Build exit 0; unit 1237/1237; cargo 70 passed, 1 ignored; Cargo.lock +2 dependency-list lines, no new package.
- E2E on the built app: 546 passed, 6 failed, 16 skipped (24.5 min). The four markdown-roundtrip tests passed.
- Failures with 3 solo reruns: popover-bounds:57 2/3, popover-bounds:174 0/3, sidebar-context-menu:319 2/3, w9-export-menu:55 1/3,
  w9-research-panel:15 0/3, w9-settings-nav:100 0/3 (imports a /src path absent from the production bundle).
- git status: only T251's files (src/editor/extensions.ts, tests/t251-marker-image.spec.ts, docs/agent-work/2026-11-11-t251-marker-image/) are not in the wave 9 plan.
- Step 6 review and steps 7-8 not done. Logs: node_modules/.cache/personal-word-beta/w9-v/.
- Rerun 2026-11-11 (agent-3b1a): build 0; unit 1242/1242; cargo 70 passed, 1 ignored. Built-app e2e 551 passed, 1 failed, 16 skipped; all six earlier failures passed; repeat-each 5 on fixed specs 135/135.
- Remaining: command-palette.spec.ts:147 failed once in the full run ("hello worXld"), 3 of 3 solo reruns passed. Details in VALIDATION.md "Rerun after fixes".
