# OF8 hover blur: text-shadow faux bold (T291, agent-3250, Claude Sonnet)

## What changed
- `src/styles.css`: `--emph-stroke: 0.04em` is now `--emph-bold: 0.3px`. The single shared "Text-control emphasis" rule
  sets `text-shadow: var(--emph-bold) 0 0 currentColor` instead of `-webkit-text-stroke`. The label-input reset is now
  `text-shadow: none`. Block comment updated. Still exactly one emphasis rule; `--emph-scale: 1` and the press scale untouched.
  Icon magnify and the toolbar dock were not touched.
- `src/hoverEmphasis.test.ts`: (a), (c), (d), (e) now check the text-shadow rule, ban `-webkit-text-stroke` (except `0`),
  allow no other `text-shadow` except `none`, expect `--emph-bold: 0.3px` and no `--emph-stroke`.
- Browser specs switched from `webkitTextStroke*` to `text-shadow`: `tests/hover-emphasis.spec.ts`, `tests/hover-helpers.ts`
  (field names `stroke`/`strokeColor` kept, now read from `text-shadow`; the parse is inlined in each `evaluate` because
  page functions cannot call imported helpers), `editor-toolbar`, `motion`, `sidebar-selection`, `scrollspy`,
  `sidebar-search`, `w9-projects-page` specs. The crop reference in hover-emphasis sets `text-shadow: none`.
- `AGENTS.md` hover sentence and `docs/design-system.md` (token line, States line, "Text emphasis" paragraph) updated.
- `tests/native-smoke.js` left alone (probe variants).

## What the user sees
Hovered or keyboard-focused text controls get a bolder look drawn as a second copy of the text 0.3 px to the right, which
WebKit paints as normal smoothed text, so stems stay sharp instead of getting a grey halo. No width change, no neighbour
moves, danger stays red.

## Limits
- Chromium specs only prove the computed styles and no layout shift, not sharpness.
- At 2x (Retina) the 0.3 px cue may be faint: unmeasured.

## To run at close-out (need a build, not mine)
1. `tests/native-smoke.js` blur probe: `touch src-tauri/src/lib.rs`, standard SMOKE build with window pinned to a 1x screen
   (command in BLUR-DIAGNOSIS.md section 9), check the binary sha256 changed, then
   `python3 node_modules/.cache/personal-word-beta/blur/blur-run.py` and `blur-check.py <run dir>` (must print `RESULT PASS`).
2. 2x step: one more smoke build with `"x":100,"y":40`, confirm dpr 2, run `analyze.py <run dir>`.

## Hand check
In the rebuilt app on the external monitor, hover a sidebar row, a Projects row title, the project title, a tab and the
toolbar zoom menu, and Tab to them. Text should look bolder and as sharp as at rest; nothing beside it should move.
If too light or still soft: fallback in BLUR-DIAGNOSIS.md section 10 (1 px at 1x, 0.5 px at 2x).

## Verification
See the task done note: fail-first in BLUR-fail-first.txt (3 of 7 unit tests failed against the old CSS); tsc, vitest and
Playwright results recorded in the `done` note.

## Results
- Fail-first: src/hoverEmphasis.test.ts against old CSS: 3 failed (a, c, d), 4 passed. Browser specs were not run against the old rule (one Playwright run, after the fix).
- `npx tsc -b`: clean. `npx vitest run`: 83 files, 1277 tests passed (one earlier run, made while Playwright was queued, showed 2 unrelated PDF-export failures; the rerun was all green).
- Playwright (port 1461, output test-results/OF8): hover-emphasis, editor-toolbar, motion, sidebar-selection, scrollspy, sidebar-search, w9-projects-page: 96 passed, 8 skipped (sidebar-search screenshot tests), 0 failed. Log: BLUR-playwright.log. Note: the shared scratchpad pw.sh was overwritten by another agent mid-run, so the log has stray "$LOG: ambiguous redirect" lines at the end; the test results above are complete. Lock released by hand.
