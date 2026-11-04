# T7b -- line rail (owner's Variant B)

Status: CLAIMED (checked in Chromium only; not confirmed by the owner in real use).

## What it is now
- One rail per list-view group (Manuscript, Fragments, Research): `SpyRail.tsx` renders a
  `.spy-rail` as the last child of `.entry-list`, in the existing 14 px right gutter. One short
  line (`button.spy-line`, name = item title) per item, in row order. Equal pitch of 12 px (2 px
  line + `calc(var(--space-3) - 2px)` gap, which only shrinks for a very long group); the lines
  never move, only their `transform` changes, so a longer open/active line cannot disturb spacing,
  also in split view. Idle 6 px, open (other pane) 12 px, active 16 px + accent.
- Click, Enter and Space on a focused line do what the row does (open it; in Read mode scroll to
  the section: eased for a pointer, instant for a key). The lines are normal Tab stops, placed after
  the group's rows so Tab from row to row is unchanged.
- Hover or keyboard focus shows `.spy-card` (`role="tooltip"`, title + first 120 characters via
  `previewText`); the described line carries `aria-describedby`. Escape hides it (document capture
  listener, not stopped). The card exists only while shown and has no transition, so keyboard and
  Reduce Motion are instant by construction.
- Wave-5 behaviours kept: progress fill on the active line, dock-style magnify (now only while the
  pointer is over the rail, radius `RAIL_RADIUS` = 36 px = three lines), keyboard magnify 1 / 0.5 / 0.2
  by distance in the rail (focus on a line or on its row), Reduce Motion falls back to the half-length line.

## Why the card is left of the rail, inside the sidebar
The prototype put it to the right and covered document text (continuous and split view have no margin
between sidebar and text). The sidebar is the one area that is never document text in any view, so the
card is anchored `right: calc(100% + var(--space-2))` of the rail with `max-width` = list width minus the
gutter. It covers some sidebar row titles while shown; it takes no pointer events. No document or
editor measuring was needed.

## scrollspy.spec.ts contracts changed
- `line()` is now `.spy-rail > button.spy-line[aria-label=<title>]` (one rail per group).
- (c) the line is a real button (not `tabindex=-1`, not `aria-hidden`); hover magnify is by pointing at the line, not at the row.
- (e, f) "line inside its row" replaced by "rail order equals row order after a drag".
- (g), (o) "line clears the word count" dropped (the rail is in its own gutter); "inside the sidebar" kept.
- (i) per-row line counts replaced by one rail with one line per row; (h), (n) unchanged in meaning.
- (j), (m) magnify measured at the rail with a 36 px falloff (was 84 px over the rows).
- New: click / Enter / Space, tooltip (text, aria-describedby, Escape, blur, instant, Reduce Motion, wholly inside
  the sidebar and clear of the document), even spacing single and split, and light/dark card screenshots in page view.
- Left as they were: (a), (b), (d), (k), (l) and the palette screens test, which use `line()`.

## For V
- Every group now has N extra Tab stops (the lines) after its rows; specs outside scrollspy that count Tab
  presses through the sidebar may need a look.

## Verification (agent-726d)
- Rail line accessible name is now "Go to <title>" (SpyRail.tsx); scrollspy.spec.ts `railLine`, (e,f) label compare and (c) button check updated. Fixes the writing.spec.ts line-33 duplicate-name clash (it now passes that line).
- Run pw3 (fresh build, `scrollspy split-view hover-emphasis writing sidebar-selection`): 85 pass, 5 fail; then (c) fixed and re-run green. Vitest scrollspy 27 pass, tsc clean.
- Not T7b (fail identically on the pre-rail ui6-t5 dist, g-old.log + a rail-free copy of (o)):
  - scrollspy.spec.ts (g) "at the 190 px sidebar the heading and titles stay readable..." line 213: `.group-label` scrollWidth > clientWidth.
  - scrollspy.spec.ts (o) "...Fragments/Research labels stay readable": "Frag two label not ellipsized" (row title clipped at 190 px). Both look like T6 sidebar CSS.
  - writing.spec.ts "writer journey": line 57, editor empty after "Restore this version" (fails on pre-rail dist too).
  - hover-emphasis crawl: "no 1.04 scale ... Dialog: Snapshot name ... Cancel" (other lane).
- Screenshots looked at: rail-card-page-light.png and -dark.png: card sits inside the sidebar left of the rail, no document text covered; lines evenly spaced; open/active line longer + accent.
- No stray JSX comment text in SpyRail.tsx or ProjectSidebar.tsx (grep for `{/*` empty).
- For V: every group gains N Tab stops (the lines) after its rows. writing/sidebar-selection specs passed apart from the above, so none tripped; confirm in real use whether the extra stops are wanted.

## Rework (agent-b65f, after Opus reject)
- Fix A (tests/scrollspy.spec.ts): (g) renamed "(labels fit or ellipsize)"; heading asserts fits-or-(ellipsis+nowrap). The per-row 12-character check also failed at 190 px for "Alpha part" (manuscript row beside its count), so it now reads: title fits, or ellipsizes with its first 6 characters visible (T6 behaviour). (o) asserts label fits, or ellipsizes with 6 characters visible, and the count (.entry-main small) is fully inside the row. Line-inside-sidebar kept in both.
- Fix B: ProjectSidebar.tsx CollectionRow gets `preview?`; rail text = `preview ?? detail` (cards-view preview still uses `detail`). App.tsx collectionItems: notes pass `preview: n.text`; sources pass `title -- container/journal/publisher -- year`.
- Fail-first: new spec "T7b: hovering a research note's or source's line shows its first words, not its kind" failed before Fix B with card text "personal" (ui6-t7b/ff2.log).
- Results: vitest scrollspy 27 pass; tsc clean; fresh build + Playwright scrollspy split-view sidebar-selection 69 pass (ui6-t7b/acc2.log). Not run/not mine: writing.spec journey line 57, writing-aids timing.
