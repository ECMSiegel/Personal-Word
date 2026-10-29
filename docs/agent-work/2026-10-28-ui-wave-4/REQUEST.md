# UI wave 4 -- owner request (2026-10-28 evening, after testing the wave-3 app)

Owner screenshots are beside this file (1.png-7.png, 6.webp). Owner report = ground truth.

## Owner feedback (verbatim intent, lightly tidied)

1. **Page view loses the break when zoomed out** (1.png): at a zoom below 100% the page breaks are not kept (text that belongs on page 2 sits at the foot of page 1 / pages look wrong).
2. **Page view is only a visualization** (3.png): you can put things (caret, empty lines) in the grey gap between pages. It should behave as real separate pages.
   - Owner decision: **real page boxes** -- still one ProseMirror document, but nothing can sit in the gap: caret, empty lines and Enter presses always land on a page; blank lines at a page's end flow to the next page like Word. Undo, find and selection keep working across pages. (Not separate editors.)
3. **Hover feedback missing** (2.png, 7.png): "Delete note" does not change on hover or click; same in many places, including the top bar and Snapshot.
   - Owner decision: text buttons go **bold and grow slightly** on hover/focus (danger stays red); no grey boxes.
4. **Snapshot button's lines look bad** (7.png): the box/border around Snapshot looks wrong.
5. **Split view divider line is slightly misaligned** (4.png): the vertical split line and the pane-header bottom rule don't meet cleanly.
6. **Remove "Give these words a home"** (5.png) from a fragment shown in split view. Keep it when the fragment is opened from the right-side bar.
7. **Sidebar selection rethink**: when you click an entry inside a section, the **section header** is bold and coloured, and the **clicked entry** is bold only. When you open an entry in the split pane, its section header is bold and coloured and the split-pane entry is bold too. (This replaces the wave-3 rule "entry semibold in section tint, header not emphasised".)
8. **Split view footers**: in split view, each pane shows its own "Section page N of M" left-aligned and its own word count right-aligned, for that pane's section (6.webp shows one shared footer today).
9. **Footer placement looks unfinished** (6.webp): the page number / word count sit indecisively near the bottom; needs a deliberate treatment (maybe a rule), decided by design.
10. **Magnifying dock for the top toolbar**: like https://bencho.dev/?c=dock&theme=dark (icons magnify on hover with neighbour falloff).
11. **Scrollspy line navigation for the sidebar**: like https://kit.cuedesign.space/components/scrollspy-line-navigation (expanding line indicators tracking position).
    - Licence for both references is not stated on the pages: re-implement the behaviour; do not copy their code unless a licence permitting it is found and recorded.
12. **Focus mode** (currently dims every paragraph except the caret's): owner decision -- also **hide the top toolbar until the pointer nears the top** (or keyboard focus enters it / a toolbar shortcut is used).
13. **Question answered**: source PDFs are attached under Research > Sources > (pick a source) > PDF field (drop a PDF or choose one); "Open beside" opens it in the split pane. Consider whether this needs to be more discoverable.

## Owner decisions this round
- Run as wave 4 on the team board, then a Fable review, then commit (no push unless asked).
