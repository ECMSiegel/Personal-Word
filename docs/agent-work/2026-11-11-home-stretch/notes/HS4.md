# HS4 -- docked sidebar header lines up with the main pane
Changed: src/styles.css (one block after `.search`, scoped `.sidebar-shell:not(.is-floating):not(.is-overlay)`): sidebar top padding 0, title row 40 px, search row 40 px (margin-top 0, bottom 12 px). No new border lines (chose matching centres only). Floating/overlay untouched.
Tests: tests/hs4-sidebar-align.spec.ts (docked 1280, narrow 190, floating unchanged: title top 130, search centre 190, recorded before fix). Fail-first: HS4-fail-first.txt (title 68 vs topbar 54). After: hs4 + alignment.spec.ts 16 passed.
Before the fix the wide set (alignment + sidebar-*) was 64 passed, only my 3 new tests failed. The wide "after" run was skipped on coordinator instruction.
Limits: no before/after screenshot taken (extra locked run skipped); "Comments" destination title not separately checked.
Hand check: dock the sidebar; the project title sits on the line of the top bar, "Find in project" on the line of the undo/redo bar.
