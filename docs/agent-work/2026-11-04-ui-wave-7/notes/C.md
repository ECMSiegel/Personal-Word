# Wave 7, lane C: floating sidebar left alignment

## Root cause
The docked sidebar (`.sidebar-shell .sidebar` in `src/styles.css`) starts at the window's left edge and its padding is `--space-3` (12 px), so the search icon sits 12 px in. The floating sidebar box was placed at `left: var(--space-4)` (16 px) in `src/components/floating.css`, so every floating item sat 16 px further right (search icon 12 px docked, 28 px floating).

## Change
- `src/components/floating.css`: the floating `.sidebar` now starts at `left: 0` (the shell's left edge), so its padding lands the contents where the docked ones are.
- Floating edge strip (`.sidebar-edge`) narrowed from 16 px to the docked 8 px. A 16 px strip would sit over the first 4 px of the search icon and the first rows (the strip has a higher z-index).
- Header comment in that file updated to match.

Not changed: the docked sidebar, `floating.ts` (`jointFit`, `marginFit`), `ProjectSidebar.tsx`. The fit reads margins from the document, not the sidebar DOM, so the fit is unaffected. The floating box's right edge moves 16 px left with its left edge, so it still sits at least FLOAT_GAP clear of the text column (the spec's `expectClear` checks this).

## Test
`tests/floating.spec.ts`, "UI wave 7 C: at one window size the floating contents line up with the docked ones". At 1600 x 900, page view: measures the left edges of `.search svg`, `.sidebar-groups .group-title svg`, `.sidebar-groups .entry-main svg` and `.sidebar-bottom-groups .group-title`, docked then floating (same window), and asserts each pair is within 1 px.

Setup note: init scripts run on every load, so a reload re-applies the seeded floating value. The test sets the floating flag through a session flag so only the post-reload load floats. The page view is toggled off and on after the reload so the margin fit re-measures.

## Fail-first
Before the CSS change: `search: docked 12 floating 28, Expected <= 1, Received 16`. (Log: `node_modules/.cache/personal-word-beta/ui7-c/fail-first-4.log`.)
Two earlier fail-first attempts failed in the test's own setup (the reload did not float), not on the assertion; they were fixed in the test before the recorded run.

## Verification
See the commands and results in the final report.

## Results (final tree)
- `npx tsc --noEmit -p .`: exit 0.
- `npx vitest run src/components/floating.test.ts`: 10 of 10 pass.
- `tests/floating.spec.ts` full file (Chromium, port 1933, build of the final tree): 37 pass, 2 fail.
  - Fail: "citation card › Add another gives an empty lookup with focus" and "citation card › keyboard only: manual entry, Cite here, Add another, Escape returns focus". Both wait for `.footnote-input` to take focus and it is never rendered.
  - These fail the same way with the original HEAD `floating.css` (A/B run, same spec file), so they are not caused by this lane. Not fixed here: the cause is in the citation card's focus handling, outside `floating.css`.
- The new alignment test passes with the fix (it failed before: search icon 12 px docked, 28 px floating).

## Assertion changed in an existing test
`expectClear` (tests/floating.spec.ts) used to assert `side.left >= 16` (the sidebar box sat one gap in from the window edge). The box now starts at the window edge on purpose, so that line now asserts `side.left <= 0.5`. The overlap and gap checks on the column and bars are unchanged.
