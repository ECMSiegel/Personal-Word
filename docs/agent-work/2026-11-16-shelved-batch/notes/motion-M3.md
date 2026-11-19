# M3 -- Keep as Fragment, the snip is visible

Pointer click on the scissors only: icon turns -12 deg and back (two 80 ms press beats, transform), the new Fragments row slides in with `staggerIn` (transform only); if Fragments is collapsed its heading gets the same nudge. Shortcut, palette, Reduce Motion: nothing. Editor content is never animated.

## Changes
- `src/research/snipMotion.ts` (new): `turnScissors(svg)` (two `play` calls, the return delayed 80 ms with fill backwards) and `useNewFragmentRow(scopeRef, id)` (layout effect, runs once per new id, skips the id present at mount, finds the row by `data-row-id` or falls back to the Fragments heading, calls `staggerIn`).
- `src/App.tsx`: imports; `newFragmentId` state; at the end of `extract`, `if (pointerInput.current)` turn the `.extract svg` (found from the focused `.extract` button, else the first) and set the id; `newFragmentId` passed to `ProjectSidebar`.
- `src/components/ProjectSidebar.tsx`: `newFragmentId` prop, import, one hook call after `const aside`.
- `src/Writer.tsx` not touched by this worker.

## Evidence (tests/sb-motion-fragment.spec.ts)
Fail first (before the code): pointer and collapsed tests failed (icon animations 0 of 2, heading 0 of 1); shortcut and Reduce Motion passed trivially (nothing animated yet). After: 4/4 pass.
Probe ignores CSSTransition/CSSAnimation (the app's own hover/press styles animate the icon already).
Also pass: tests/fragments-panel.spec.ts (6), tests/editor-toolbar.spec.ts (17).
