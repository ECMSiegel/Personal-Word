# Wave 7 independent review: lanes A, B, C and Cite here focus

Reviewer: agent-9461 (GPT-6), 2026-11-04. Read-only review of the current uncommitted changes against `REQUEST.md`, `RESEARCH.md`, the lane notes and `docs/design-system.md`. No implementation files edited.

## Verdict

No blocker found in lane A's rail-row hover, word-count removal or Cmd-K hint removal; lane B's intended toolbar and snapshot changes; lane C's floating alignment; or the Cite here focus sequence. **One medium, confirmed scope regression** was found in lane B and entered as repair task **T241**. The full coordinator verification is still in progress; this review does not treat its eventual result as independently observed.

## Finding -- medium (T241)

**Page setup's Paper size and Page margins controls lose their borders too.** `src/editor/editor.css` applies `border: 0` to `.writer .format-bar .dropdown-button`. The Page setup `Popover` is rendered as a descendant of the format bar (`src/editor/ToolbarControls.tsx`, `PanelButton`'s `Popover` child), and its Paper size and Page margins dropdowns are in that subtree (`src/Writer.tsx`, Page setup case). Thus the selector also removes the boxes from these two popover controls, although the request named the top-bar zoom, text-type and font controls. The current toolbar spec checks only those three requested triggers, so it does not catch the extra effect.

Task T241 asks to preserve Page setup dropdown boxes, add regression assertions for Paper size and Page margins, and retain the three intended unboxed controls. The screenplay paragraph-style dropdown is within the requested “text type” control and is not treated as a defect.

## Checks by area

### Lane A -- sidebar word count, Cmd-K hint, row hover

- `ProjectSidebar.tsx` removes the sidebar word-count markup and unused `entryWords` import; the sidebar search no longer renders the `⌘K` hint. The Cmd-K shortcut itself is unchanged, and the updated search spec still checks that it focuses Find in project.
- `scrollspy.ts` maps the hovered `.entry-main[data-row-id]` to the matching `.spy-line` in that row's group. For row hover, magnification uses the associated line's own visual center, which is the same origin as pointing at that line; touch and Reduce Motion continue to avoid writing magnification.
- The new scrollspy test samples transform scales on the actual `.spy-line` elements, compares the entire rail's scales for line hover versus row-text hover, checks leaving, and separately checks reduced motion. This is a meaningful regression test, not merely an assertion that a row is hovered.
- Existing lane evidence in `ui7-a/green.log` reports 50 passed / 8 skipped. Not rerun in this review because the coordinator owns the serial lock.
- Non-blocking, inferred edge: moving from a row onto its separate Open-beside/reorder control clears the row-derived magnification; a still pointer while the list scrolls may also leave the previous row's line as the anchor until another pointer move. Neither is required by the direct row-text hover behavior nor shown to fail the new spec.

### Lane B -- toolbar and snapshot spacing

- The target zoom, paragraph-style and font triggers are unboxed; the fixed-width wrapper is unchanged, and focus styling remains the existing dropdown outline. The font-size control is not changed. The screenplay style dropdown is another paragraph-style/text-type control in the format bar, so its unboxed appearance follows the owner's wording.
- Snapshot spacing changes address the reported text-edge mismatch: comparison buttons lose browser-default padding, paragraph padding becomes vertical, and the margin selector is narrowed to direct preview sections instead of also matching comparison columns. The new spec measures six rendered text edges against the help text.
- Existing lane evidence in `ui7-b/pw-full2.log` reports 20 passed; screenshots `toolbar-{light,dark}.png` and `snapshot-{light,dark}.png` were visually inspected.
- The Page setup overreach is the T241 finding above. Small text-only restore buttons also have reduced padding; no requirement or measured failure establishes a target-size regression, so this is not raised as a separate finding.

### Lane C -- floating left alignment

- The floating sidebar's box and its 8 px reveal strip now begin at the window edge; the existing 12 px sidebar padding aligns its content with the docked sidebar.
- `expectClear` still checks the sidebar-to-document gap and non-intersection with the format bar and topbar. Only the old `left >= FLOAT_GAP` condition changed to `left <= 0.5`; the new alignment test additionally compares actual content edges against the docked state within 1 px. Moving the box left increases the right-side clearance; it does not weaken the document-overlap assertions.
- The alignment test uses a 1600 x 900 page-view setup. Broader floating overlap coverage is in the existing suite; lane C notes report 37 passes and two failures in earlier tests that still expected the pre-v0.2.1 footnote field to auto-open. The current tests were updated for the v0.2.1 behavior; final current-tree verification remains with the coordinator.
- The lower-bound assertion `left <= 0.5` alone would accept a sidebar moved farther off-screen, but the new content alignment check would fail in that case. The shell retains an extra 16 px of width after its child moved left; it has `pointer-events: none`, so this is harmless.

### Cite here focus

- The released `Writer.tsx` behavior no longer auto-opens an empty sourced-footnote text field, avoiding the citation being hidden. In `CitationCard.tsx`, Cite here sets the pending target to Page; after the editor's insertion focus runs, the card schedules focus back to its Page/locator control on the next animation frame.
- The updated keyboard test checks Cite here → Page focus → page entry → Add another → lookup focus → Escape → Research heading focus, and verifies the locator persists. The other Cite here test checks the Page field rather than the absent footnote editor.
- This is browser evidence only. `requestAnimationFrame` ordering is a timing assumption, and native WebKit behavior was not independently tested here; V handles native coverage.

## Verification boundary

- Reviewed diffs and lane notes; checked the cited selectors and render tree directly.
- Available lane artifacts: A's targeted Playwright log (50 passed / 8 skipped); B's targeted Playwright log (20 passed) and four screenshots; C's earlier full-file log (37 passed / 2 failures from expectations later changed for v0.2.1).
- Did not run build, Vitest or Playwright: `serial-check.lock` was held by the coordinator's W7 full verification. The coordinator's run had not completed when this review was recorded; T240 should verify the final tree, including current Cite here tests and T236's in-progress sidebar CSS changes.
- No native WebKit screenshots or app run in this review.
