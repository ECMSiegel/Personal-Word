# REQUEST -- UI wave 7 (owner, 2026-11-04)

Verbatim:
"The scroll bars we added get bigger and smaller when you hover of them well, but they should do the same when you hover over the corresponding subsection. remove the word count from the sidebar entirely - will be just on the bottom. add the ruler (toggable) for margin adjustment -- in continuous view the top of the text is close to the top bar and that should be changeable. Remove the commandK next to find in project. The hierarchy of selected section being colored in and the sub section being bolded (bigger) seems off. remove the boxes from the zoom%, text type, and font on top bar. text spacing on the snapshot page isn't right. The floating sidebar doesnt seem left aligned properly like the non floating one"

Investigate only (may cost a lot, owner wants context):
1. "when I hover over the edges of the sidebar to widen them they go blue. doesnt show in screenshots so I am not sure if fixable"
2. "The floating sidebar seems more like a sidebar with the same color as the back round instead of floating text. I am wondering it could be more floating text not on a fake glass or transparency but literally floating text, maybe a spot where cost is greater than benefit but curious"

## Screenshots (shots/, not committed)
3, 4: sidebar rail; 3 hovering the rail (lines grow), 4 hovering a row (lines do not, split icon replaces word count). 5: Google Docs ruler reference. 6: sidebar in Color. 7: Find in project with Cmd-K. 8: Google Docs toolbar, the unboxed look wanted. 9: snapshot page spacing (title indented from text below). 10: docked sidebar. 11: floating sidebar, left edge differs.

## Lanes (no plan file; owner allowed direct workers)
| Lane | Model | Scope | Owns |
|---|---|---|---|
| A | Haiku | no sidebar word count; no Cmd-K hint; row hover grows its rail line | ProjectSidebar.tsx, scrollspy.ts, scrollspy.css, sidebar block of styles.css, their tests |
| B | Haiku | no boxes on toolbar zoom/type/font; snapshot page text spacing | toolbar dropdown CSS, history page CSS/component, their tests |
| C | Haiku | floating sidebar left alignment matches docked | floating.css, floating spec |
| R | Opus | research only: ruler design, hierarchy options, blue edge, floating text | writes docs/agent-work/2026-11-04-ui-wave-7/RESEARCH.md only |

## Owner decisions (2026-11-04, after RESEARCH.md)
- Ruler: linked sides. A drag changes the real document margin that exports use.
- Top gap in continuous view: top of the document only, scrolls away, screen-only, default 32 px, adjusted by a drag handle while the ruler is on.
- Hierarchy, in the owner's words: "I like heading leads lets do heading bold not colored (icon colored if color is on) and the list can go dimmer until one of them is hovered over than they should go white let the selected until one of them is selected then the rest go dim etc"
- Resize edges: no line at all on hover; only the cursor changes. Keyboard focus stays visible.
- Floating: try the small changes (no painted resize edge, list hugs its content).

## Status of lanes A, B, C (uncommitted in the tree, no independent review yet)
A sidebar word count, Cmd-K hint, row hover grows rail line. B toolbar boxes, snapshot spacing. C floating left alignment. Also uncommitted: `src/research/CitationCard.tsx` returns focus to Page after Cite here, with `tests/floating.spec.ts`.

## Owner follow-up (2026-11-04, small fixes, Haiku swarm, not a new wave)
"three more sidebar fixes: 1) the spacing of the snapshots/comments/manuscript and their lines aren't right 2) the split pane icon and the scroll bars are too close to each for the subsections that are in the middle of the section near the scroll bar if that makes sense 3) for section headers, the downward arrow should be right most (I think? open to suggestions)
research bar: I think we need horizontal lines between the zotero refresh and text-only sources to break them up . remove "Footnotes that cite no source. Place the cursor in your text before inserting" and "No sources yet. Look one up or enter it manually." I want to surface the ability to upload a pdf to the research section instead of burying it under enter manually - the enter manually button should stay there for when you want to enter something without uploading a pdf, but I think there should be another button [maybe, 'upload PDF'] where you can just click and upload - not sure if I think it should go in notes or research yet but open to hearing suggestion."

Shots: 16 split icon against rail, 17 section header, 18 bottom rows, 19 research panel. Coordinator recommendation, owner may overrule: chevron rightmost, then view toggle and + to its left; Upload PDF in the Sources tab beside Enter manually.

Owner correction on Upload PDF (2026-11-04): "No I want upload pdf taken out of that group so you can just have one not attached to a source. this should be a big rewire I don't think". Coordinator design: a separate PDFs section in Sources with Upload PDF and standalone rows in the sidebar; additive `research.pdfs`; the Rust asset reference set (store.rs:1000) must include them or they could be cleaned up.
