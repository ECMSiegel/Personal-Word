# UI wave 5 -- owner request (2026-11-01, after testing wave 4)

Screenshots beside this file (8.png, 10-16.png). Owner report = ground truth.

## A. Fixes
1. Research panel spacing (12.png-16.png): "Review required details" wraps into a narrow column; Notes tab spacing ("Add note" then an unlabelled textarea with no gap); the "Full citation again" dropdown menu is clipped off the panel's left edge (16.png). Fix all spacing in the research panel to the design system.
2. Left sidebar Research rows (8.png, 11.png) sit at a different indent from Manuscript/Fragments rows (Bibliography, sources, PDF row, note rows misaligned). One consistent indent.
3. Scrollspy lines: (a) missing in Fragments and Research -- add them to every group's rows; (b) they don't magnify or feel like an actual scroll -- magnify by pointer proximity with neighbour falloff (like the dock), and the active line shows progress through its section as you scroll.
4. Remove the up/down move arrows on sidebar groups and rows. Reorder by dragging everywhere (groups, Manuscript sections, Fragments, Research sources and notes as appropriate), with a keyboard path (Option+Up/Down on the focused row/group) per the owner rule that every hover interaction has keyboard access.

## B. Floating layout (new setting, off by default)
Ideate outcome: owner chose idea 1 with all defaults ("that is all good").
- Settings toggle "Floating sidebar and research" (wording to plan).
- Sidebar: same pinned/unpinned/hover-reveal behaviour, but no panel -- no background fill, no border, no shadow; just the text sitting on the page's own background (grey desk in page view, white in continuous). Hover/focus use the shared text-emphasis rule (no grey boxes). It floats in the empty margin; when there is not enough room (narrow window) it falls back to the normal panel so text never overlaps the document.
- Research: instead of the right panel, a single citation card in the TOP RIGHT. One citation at a time: lookup (DOI/ISBN/URL) or enter manually -> preview -> Cite here. "Add another" swaps in a fresh card. Clicking a footnote number in the text opens that citation's card for editing. A link on the card opens the full research panel.
- Defaults accepted: card at top right (not at the cursor); clicking a footnote opens its card; floating sidebar has no background at all (hover = shared emphasis rule, never a fill).

## Run
Same as wave 4 without the team board: plan -> owner approval -> subagents -> reviews -> Fable review -> native checks on an unlocked screen -> commit (and push only if asked).
