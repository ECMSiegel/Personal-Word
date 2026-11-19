# M2 -- Projects <-> document, the page comes forward

Entrance-only form, no `usePresence` (it would need the outgoing tree kept mounted for an exit; the brief does not ask for an exit, and `saveAll`/`setProject(null)` order stays untouched).

- Pointer open: only `.app .editor-paper` (the sheet) runs translateY(4px)->none + opacity 0->1, base (180 ms), ease-out. Sidebar and header: zero animations.
- Pointer return to Projects: `.app > .library` fades opacity 0->1 (fast, 120 ms, out); each `.project-row` gets `staggerIn` (translateY only, 15 ms steps, capped at 6).
- Enter on a row, Enter on the Projects tab, palette, Reduce Motion, first paint: nothing (the hook only runs on a change of `!!project` and only when `pointerInput.current` is true).

## Changes
- `src/research/pageMotion.ts` (new): `useProjectSwapMotion(projectOpen, wasPointer)`; finds the elements by selector, so no wrapper elements and no edits to ProjectLibrary.tsx.
- `src/App.tsx`: import and one call beside `useResearchAsideEntrance`.

## Evidence (tests/sb-motion-projects.spec.ts)
Fail first: pointer open (sheet 0 of 1) and pointer return (library 0 of 1) failed; keyboard and Reduce Motion tests passed trivially. After: 6/6 pass. One test needed a fix of its own (wait for the earlier open animation to end before emulating Reduce Motion).
Also pass: tests/motion.spec.ts (7), tests/w9-research-motion.spec.ts (4), tests/projects-screen.spec.ts (43), tests/w9-projects-page.spec.ts (10). `npx tsc -b` clean; `npx vitest run` 1334 passed.
Not verified: native WebKit (Chromium only); opening a project by tab switch (left immediate by design, hook keys on open/closed only).
