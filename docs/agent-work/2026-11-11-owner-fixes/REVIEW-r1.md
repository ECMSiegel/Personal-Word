# Owner fixes -- independent review, round 1

Reviewer: agent-17f6 (Claude Opus reviewer owner-fixes r1), 2026-11-11.
Scope: T287 (OF4), T289 (OF6), T285 (OF2), T290 (OF7), T284 (OF1). T286 (OF3) and T288 not reviewed.

## Whole-tree checks (run by the reviewer)
- `npx tsc -b`: exit 0 (clean; the earlier App.tsx:3021 error is gone). Log: notes/REVIEW-r1-tsc.log
- `npx vitest run` (whole suite): 83 files, 1277 tests passed. Log: notes/REVIEW-r1-vitest.log
- Playwright, one run, port 1460, serial lock, output test-results/OFR1: see "Browser run" at the end.
  Log: notes/REVIEW-r1-playwright.log

## T287 (OF4) Projects sort row -- APPROVE
Evidence: `git diff` of src/components/ProjectLibrary.tsx against the last commit shows the Sort
dropdown, the reverse arrow and the view toggle in the same place in the toolbar's right group as
before wave 9; the caption row is gone from both the component and library.css. Remembered
preferences (libraryPreferences.ts: sort, direction, view) are wired through `changePrefs`, which
writes to storage on every change. The new same-row test failed first (55.5 px off) and passes now.
Small difference from before wave 9: the arrow and view buttons now carry `icon-button icon-grow`
(kept from wave 9), so they look like the other toolbar icons rather than plain buttons.
Owner hand check: Projects page -- Sort, the arrow and the list/cards icon are at the right end of
the top bar, level with "Start new project". Change all three, reload: they stay.

## T289 (OF6) Recent fonts in the font menu -- APPROVE
Evidence: src/fonts/recent.ts (newest first, at most 5, each once, `folio.recentFonts`, tolerant of
bad data); Dropdown.tsx adds heading/separator rows that the arrows, Home/End, type-ahead and clicks
skip, and the highlight is mapped to the item rank, so menus without such rows are unchanged.
Writer.tsx edit is the Font family case plus one import line. Unit tests and of6 spec pass.
Popover-bounds ruling: the "Page setup x moved ~33 px" failure is not caused by this task. T286 (OF3)
put a second ruler toggle into the Page setup popover, which widened it from 232 to about 265 px; the
popover is right-aligned to its button, so its left edge moved left by about 33 px (T286's own
hand-in reports old x 1113 w 232 -> new x 1079.56 w 265.44). Font family is unchanged. So yes: the
"Page setup" entry in tests/fixtures/popover-baseline-rects.json legitimately needs re-recording
once T286 lands (the owner already approved re-recording only that entry, under T286). The reviewer
did not touch the fixture.
Limits the owner should know: picking the font that is already current does not move it to the top
of Recent; a recent font is listed twice (Recent and the full list).
Owner hand check: pick Georgia, then Arial; reopen Font family: RECENT, Arial, Georgia, grey line,
full list. Arrow keys never stop on the label or the line.

## T285 (OF2) fragment title with floating sidebar -- APPROVE
Ruling on the worker's reading: convincing. The reviewer measured the owner's own screenshots
2.webp (section) and 3.webp (fragment), same 2000x1030 size: the "Hello Angela" ink box is
identical in both (x 15-82, y 62-72), and every sidebar row sits at the same height. The title crops
12.png and 13.png also match (ink x 73-159 vs 73-160, y 27-43: a 1 px anti-aliasing difference).
What does differ is the background: in the fragment, everything above y ~79 is white (255) instead of
the grey desk (246,245,248), because the "Kept from" strip lives in the white scroll area. The title
therefore sits on a white band whose lower edge cuts just under it, which reads as "moved / spacing
isn't right". No real offset remains unaddressed.
The fix (one rule in src/components/floating.css) paints the paged scroll area with the same token
the desk already uses (`var(--surface, var(--line))`), only while the sidebar is floating. The spec
fails first on the background colour and also pins title x/y and sidebar top.
Minor, not blocking: the rule does not have a print exception (the desk's own background is removed
in `@media print`); printing from the editor normally does not print backgrounds.
The page itself still starts ~40 px lower in a fragment because the strip takes that room; that is
by design (the strip stays).
Owner hand check: Settings > floating sidebar on, page view, open a fragment: the area behind
"Hello Angela" and the "Kept from" line is the same grey as beside the page, and the title does not
appear to jump when switching between a section and a fragment.

## T290 (OF7) two WebKit zoom bugs -- APPROVE
Evidence: `git diff -- src/editor/pagination.ts` has only three hunks: imports, `clickSpacer`
(exported; spacer top/height scaled by `totalZoom` only under `reportsUnzoomedRects()`), and the new
`menuPositionInCell`. The ArrowUp/ArrowDown code is untouched. In Chromium or at zoom 1 the scale is
1, so the old arithmetic is unchanged; `menuPositionInCell` only differs from the old rule when
WebKit-zoomed and posAtCoords missed the cell. Writer.tsx change is the table context-menu
`position` block plus the import name. vitest src/editor and whole suite pass; fail-first saved.
Not yet proven: native WebKit. The S4/S6 native probes must still be run on a rebuilt app.
Owner hand check (native app, 150 percent): right-click inside a table cell opens the table menu;
click just under page 1's last line with the page gap low in the window: caret stays on page 1.

## T284 (OF1) text-only footnotes to Notes tab + delete -- REJECT (one small fix)
What is right:
- Block moved to the Notes tab; "Delete footnote" is a real button (Tab, Enter, Space), red `is-danger`.
- Delete opens the app's existing confirm dialog; Cancel and Escape close it without running anything
  (ProjectDialogs only runs the action on the action button).
- Order on confirm: flush saves (rejects on failure, so nothing is deleted), safety snapshot
  "Before deleting a footnote" (a failure throws before any change), then an open editor removes its
  own markers (all of them, in one transaction), then one mutation removes the record and the markers
  in every other section/fragment. Same pattern as Delete section. Errors surface through `run`.
- Cited footnotes are never removed: guarded in App (`record.sourceId` -> return) and in
  `removeTextOnlyFootnote` (returns null, mutation becomes a no-op); the button is only on text-only rows.
- A note whose marker appears twice loses both markers (documented). Orphan records (no marker, like
  the first three rows in the owner's 1.png) are removed alone. Numbering is computed from document
  order, and the spec checks the survivor becomes footnote 1.
- The six existing specs only gained a "click the Notes tab" line (plus Sources tab back in one place);
  research.spec's rule-geometry check now measures against the Bibliography block, with the same
  assertions. No assertion was weakened. App.tsx edits are small (import, handler, one prop).

Defect (why rejected): `renderFootnote` gained a second parameter `extraActions`, but the Sources tab
still calls it as `{footnotes.map(renderFootnote)}` (src/research/ResearchPanel.tsx:361). Array.map
passes the index as the second argument, so every cited footnote under a source now renders its
index ("0", "1", "2"...) as stray text next to "Unlink source". TypeScript does not catch it
(a number is a valid ReactNode).
Fix list:
1. src/research/ResearchPanel.tsx:361: `{footnotes.map((note) => renderFootnote(note))}`.
2. Optional but recommended: one assertion in tests/of1-text-notes.spec.ts or tests/research.spec.ts
   that a cited footnote's actions area contains only "Unlink source" (no digit), shown failing first.
Not tested anywhere: editor Cmd+Z right after a delete in an open section would bring the marker back
without its note text; the snapshot is the real undo (documented by the worker).
Owner hand check after the fix: Research > Notes, Delete footnote on a note in a section that is not
open: dialog names the section; Cancel and Escape change nothing; confirm removes the row and the
marker, remaining notes renumber, Snapshots & history lists "Before deleting a footnote". Then open a
source with citations on the Sources tab: no stray numbers beside "Unlink source".

## Browser run
One Playwright invocation under the serial lock (lock released afterwards), port 1460:
of1-text-notes, of2-fragment-title, of6-recent-fonts, w9-projects-page, footnotes, w9-research-panel,
t251-marker-image: 30 passed, 0 failed (4.1 min). Chromium only; native WebKit not checked.
None of these specs looks at a cited footnote's action row, which is why the T284 defect passed.
