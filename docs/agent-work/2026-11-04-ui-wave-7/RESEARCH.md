# UI wave 7 research: ruler, hierarchy, blue edges, floating text

Read-only research, 2026-11-03. No code changed, nothing built or run in the app. Line numbers are from when this was read; lanes A, B and C are editing some of these files, so they may drift.
**Verified** means I read it in the code or measured it. **Inferred** means reasoning that has not been tried in the app. Nothing below has been seen working in the Mac app.

## 1. Ruler

**What exists today (verified)**
- Yes, a margin setting exists, and it is already a real document setting. It is one number for all four sides, stored twice and kept in sync: `pageLayout.margin` in pixels and `documentSettings.marginInches` (`App.tsx:1774-1782`, `App.tsx:2450-2459`).
- You can change it today in the toolbar's page setup menu, which offers 1/2, 3/4 and 1 inch (`Writer.tsx:1691-1706`), and in the export panel, which allows 0.5 to 2 inches (`ExportPanel.tsx:192-207`).
- Exports obey it: Word `docx.ts:262-266`, PDF `pdf.ts:193`, text width `document.ts:144`. The native print code has its own check (`nativePdf.ts:156`, `printing.rs:230`), but the only caller of `buildPrintHtml` I found is the test probe, so ordinary PDF export goes through `pdf.ts`.
- Page view and continuous view both draw the side margins from it through `--page-margin` (`Writer.tsx:964`, `editor.css:415`, `editor.css:449`).
- **The top gap in continuous view is not the margin at all.** It is a fixed 32 px (`editor.css:415`, `padding: 32px var(--page-margin)`), plus 2 px of viewport padding (`editor.css:401-404`). It also shrinks with zoom: about 26 px at 75 %.
- Reading settings are a separate thing (`personal-word.reader`, `App.tsx:281-297`) and do not touch margins.
- Existing mismatch: the screen limits margins to 0.25-1.5 inches (`formatting.ts:126`), the export panel allows 0.5-2 and native print 0.25-2. So a 2 inch margin set in the export panel draws as 1.5 on screen and exports as 2. Found by reading, not run.

**Does the ruler change exports?** It should, and that does not break the AGENTS.md rule. That rule protects exports from *reading* preferences. Margins are already a document setting, and the toolbar dropdown already changes exports today. The catch is that a stray drag now also changes your PDF and Word output, and Cmd-Z will not undo it, because margins live outside the editor's undo history (inferred from `App.tsx:1774`, which saves them as a project change). So the drag should show the value as you go, for example "1.25 in".

**The options**

| | What you get | Size | Downside |
|---|---|---|---|
| **A. Linked ruler (recommended)** | Drag either margin marker and both sides move together. Same single number, so top and bottom in page view and exports follow too. | Medium | Dragging a side also moves top and bottom. Google Docs lets the two sides differ; this does not. |
| B. Separate left and right | Works like shot 5. Needs new additive fields, then changes to `paperGeometry`, the CSS, footnote placement (`Writer.tsx:1939`), `document.ts`, `docx.ts`, `pdf.ts` and the sync code. | Large | Touches every export path, so export checks must be rerun. Can follow A later without undoing it. |
| C. Display-only ruler | Changes the column on screen only. | Small to medium | The screen stops matching the export, so the ruler adjusts nothing you can print. Not recommended. |

In shot 5 the blue triangles are Google's paragraph indent markers, not its margins (from my knowledge of Docs, not checked in this repo). Indent attributes exist here (`formatting.ts:59-67`), but you asked for margins, so I left indent markers out. They would add about a medium.

**The top gap: a horizontal ruler can't do it, so three ways**
- **T1. Follow the margin:** make the top padding `var(--page-margin)`, as page view already does. One line, nothing new to save (small). But the default gap jumps from 32 to 96 px, and you could only change it by also changing your print margins. Not recommended on its own.
- **T2. A drag handle in the gap (recommended):** only while the ruler is on, a small handle sits in the space above the first line. The gap you set stays when the ruler is off. Drag it to move the text down; arrow keys do the same. No vertical ruler is needed, because continuous view has no page height to measure. This is screen-only and never reaches exports (small on top of the ruler; add a field in page setup only if you want one).
- **T3. A real vertical ruler like Word's:** only meaningful in page view, where it would change the shared margin. Medium, and in continuous view it would show a single number on a long strip. Not recommended.

One thing to check against what you meant: padding scrolls away with the text. Any of these fixes the gap at the top of the document. Once you scroll, text still runs up under the bar. Keeping a gap while scrolling would be a different change, a fade or band under the bar (small, inferred).

**Toggle:** one icon button in the toolbar's `view` group, beside Page view (`Writer.tsx:1570`). Lucide's `Ruler` icon is installed. `aria-pressed` shows its state. At narrower windows the group moves into More with a label, as the others do (`design-system.md:87-100`). Add a command palette entry. Keep it as a global preference next to `folio.workspace.sidebar`, off by default.

**Zoom, split view and WebKit**
- **Zoom:** the sheet's scale is `zoom x fitScale` (`Writer.tsx:970`). Best design: give the ruler the same CSS `zoom` and the same width rules as the paper, so the browser lines them up and nothing needs measuring. That avoids the native WebKit quirk in `floating.ts:32-57`, where measured sizes come back in zoomed units. If something must be measured, use those helpers (two of them are not exported yet).
- **Ticks:** draw them as real elements or SVG, never a repeating gradient. WebKit ignores zoom on gradient pixel stops, the same bug that broke the page bands in wave 4 (`design-system.md:245`).
- **Dragging:** convert pointer movement to inches using `zoom x fitScale`. Inferred; must be tested in the Mac app at 75, 100 and 150 %.
- **Placement:** put it as the first item inside `.writer-scroll`, stuck to the top. Then a visible scrollbar narrows it and the page equally and they stay lined up (inferred). Only as wide as the page, so it stays clear of the floating sidebar's margin.
- **While dragging:** move only a guide line and save on release. Margin changes repaginate (`Writer.tsx:805`) and each save is one project revision, so saving every pixel would be slow.
- **Split view:** each pane gets its own ruler, because each has its own scale. Both show the same margins, since they are per project; dragging one moves both. If this proves costly, it is the first thing to cut.
- **Focus mode, printing:** hide it in focus mode and in the print CSS (`editor.css:495-525`).
- **Floating:** in continuous view a wider margin narrows the text, which widens the room beside it, so the sidebar can switch between floating and docked when you let go (`floating.ts:186-189`). This is correct behaviour, just worth knowing.

**Saving and "Preserve writing"**
- Option A plus a global toggle adds no project data apart from the top gap.
- The top gap should be an additive `pageLayout` field. Rust keeps unknown project fields through its flattened map (`store.rs:54-55`, covered for `pageLayout` by the test at `store.rs:1888`). Existing code spreads `pageLayout`, so the field survives (`App.tsx:2456`, `Writer.tsx:308`). `model.ts:229-236` would need a check for the new field; old projects simply use 32 px.
- Exports read only `paper` from `pageLayout`, so they cannot pick up the gap (`document.ts:142`, `pdf.ts:191`, `docx.ts:158`).
- No editor schema change, so the Rust rich-text allowlist is not involved. Needs a native save-and-reload check, because browser tests don't prove native persistence.
- Fix the range mismatch at the same time: use 0.5-2 inches everywhere by raising the limit in `formatting.ts:126` (small).

**Recommendation:** A + T2 + toolbar toggle. Medium overall.

## 2. Hierarchy

**Why it reads off (verified, and it is measurable)**
1. **The child really is bigger than its parent.** Section headers are 12 px (`.group-heading`, `styles.css:1675`). Entry titles are 13 px (`.entry-main span`, `styles.css:722-730`). Shot 10 agrees (I scanned the drawn pixels and halved them, as the shot is 2x): "Manuscript" is 70 px wide, matching Futura Bold at 12 px (70.7), and "Opening" is 50.5 px, matching Futura Medium at 13 px (51.9). Headers are smaller than their rows even when not selected.
2. **"Semibold" does not exist in Futura.** The installed family has only Medium and Bold (measured on this Mac). So weight 600 should render as full Bold on both header and entry (the browser's normal font matching; the widths above agree). Weights 400 and 500 both come out as Medium.
3. **Bold makes a word about 15 % wider.** "Opening" at 13 px goes from 51.9 to 59.8 px. That is your "bolded (bigger)": it does get bigger, and it jumps when you switch sections.
4. **Colour doesn't rescue the parent.** In dark mode the entry is near-white, the brightest thing in the list; the tinted header is dimmer (shots 3, 6, 10). So the eye lands on the child first.
5. **Too many signals at once:** coloured bold header, bold entry, bold word count (it inherits the weight, shots 3 and 6), and the active rail line in blue. Lane A removes the count. Its removal also ends the stated reason for the 13 px step, which was so the title outranks the count (`styles.css:725-727`).
Hover adds a stroke and a 4 % grow on top (`styles.css:473-474`), so a hovered open row gets louder still.

**Three alternatives**
- **H1. Same roles, fixed proportions (recommended).** Sections and rows are all 13 px. Picture: "Manuscript" in bold colour, clearly the largest thing in its group. Below it, "Opening" sits at its normal width and is only slightly thicker than its neighbours, using the same faux bold as hover, so nothing changes width when you switch. Closest to what you asked for in wave 4 (`2026-10-28-ui-wave-4/REQUEST.md:15`). Small. Costs: `src/hoverEmphasis.test.ts` allows only one stroke rule, so it needs a narrow exception; the hover stroke no longer adds anything on an open row, though the grow remains; and how the stroke looks in Futura in the Mac app is still unconfirmed (`design-system.md:118`).
- **H2. Parent leads, the rest step back.** Header bold and coloured at 13 px. No entry is ever bold. Unopened rows go grey (`--muted`) and the open one stays full white. Picture: a dim list with one bright line under a coloured heading. Calmest, with no width jumps at all. Small. Cost: the whole list is dimmer at rest. `--muted` measured 4.78:1 on the grey surface, which passes but is the lowest figure measured for the sidebar.
- **H3. Child leads.** Header stays plain, and the open entry alone takes the colour at normal weight. Picture: one coloured word in the list, like Finder's current item without the fill. Clearest about where you are, but it is the wave-3 rule you asked to replace in wave 4, and a collapsed section would show nothing lit. Small.

All three change `tests/sidebar-selection.spec.ts:470-483` and `design-system.md:181-182`. **H2 and H3 change the AGENTS.md sidebar rule, and H1 changes its entry wording (semibold). All need your approval.** A quick real-app capture of H1 and H2 side by side would be under an hour, the same way you picked the rail in wave 6. I recommend that rather than choosing from words.

## 3. Blue edges (investigate only)

**Verified: this is our CSS.** It is not macOS. There is no transition, so it snaps on.
- Sidebar: `.sidebar-resize:hover, :focus-visible { background: var(--accent) }`, a 7 px strip the full window height (`styles.css:1807-1821`).
- Research panel: the same on a 6 px strip (`styles.css:2139-2151`).
- Split divider: the same on 7 px (`styles.css:962-975`). It is a 1 px line at rest and turns into a 7 px bar on hover.
- `--accent` is our own fixed blue (`#64A8FF` in Plain dark), which is why it is so loud in dark mode, and it does not follow your Color section tints. The cursor is just the standard `col-resize` arrow, which is never blue. The floating sidebar has the same strip, with no override in `floating.css`, so the bar appears in empty space there.
- It is documented as intended for the split divider (`design-system.md:235`). Tests find these elements but none checks the colour (grep of `tests/`).

**Inferred: why screenshots miss it.** The Mac screenshot tool takes over the pointer, so the app stops seeing a hover and the strip goes back to normal before the picture is taken. A timed screenshot with the pointer resting on the edge should catch it, if you want to confirm.

**Fixable: yes, easily.** Three small CSS rules plus a docs edit (small).
| Option | Result | What you lose |
|---|---|---|
| **Quiet line (recommended)** | Hover draws a 1 px grey line, the same 7 px grab area stays. Blue only for keyboard focus, or while dragging if you want it. | Nothing that matters: the cursor change and the line both still say "draggable". |
| Nothing on hover | Only the cursor changes. | Slightly harder to find the edge, especially on the floating sidebar. |
| Thin blue line | Same geometry, still blue. | Still blue, but far less loud. |

Keyboard focus must keep a visible cue on all three, since these handles can be moved with arrow keys. In floating mode, I'd paint nothing on hover.

## 4. Floating text (investigate only)

**The main finding (verified by sampling pixels in the shots).** In shot 11 the area behind the floating sidebar is `#28282c`. In shot 10 the docked sidebar is also `#28282c`. They are the same colour, so your read is exactly right: in that view, the floating sidebar is the docked sidebar minus its 1 px line.
- The docked sidebar is filled with `--surface` (`styles.css:1594`). Page view's grey desk is also `--surface` (`editor.css:444-445`). So the fill was removed correctly (`floating.css:37-46`), but what shows through is the same grey.
- `design-system.md:299` says "the page's own background". That only holds in continuous view, where the workspace is `--paper` (`styles.css:802`). Shot 11 looks like page view (inferred from that colour).
- **Free test:** turn on continuous view at a zoom and window where it still floats, and compare. It sits on a different colour there.

**What else makes it read as a panel, even with the colour fixed**
- A ceiling and a floor: it hangs from the toolbar's rule (`floating.ts:116`) and stops at the footer, and it is always full height.
- Bottom rows pinned to the bottom, because the list above stretches (`.sidebar-groups { flex: 1 }`, `styles.css:1658-1663`). This is what most makes it a column.
- Interface furniture: the search row with its icon, a column of icons, the rail lines at the right edge, chevrons and + on hover.
- The blue resize bar on hover, the one moment it is literally a panel with an edge.
- Not causes: there is no line in shot 11 (a full-width pixel scan at one row found only `#28282c`), and no reserved column (the shell takes no space, `floating.css:12-21`). Note that "the toolbar starts after it" happens in docked mode; in floating the toolbar runs the full width over it.

**Changes, cheapest first** (none of 1-5 touches `jointFit`, which only reasons about width)
| # | Change | Size | Risk or cost |
|---|---|---|---|
| 0 | No word counts, no Cmd-K (lane A) | Done by lane A | None |
| 1 | No paint on the resize edge while floating | Small | None; the cursor still changes |
| 2 | **Let the list hug its content:** bottom rows follow straight after Research instead of pinning to the window bottom | Small, likely one rule | Bottom rows move when you collapse a group. Needs a check on short windows, where the list must still scroll and end above the bottom rows (`design-system.md:299`) |
| 3 | Hide the search row until hover or focus | Small | Harder to discover; the shortcut remains. Must stay reachable by keyboard |
| 4 | Hide icons and rail at rest, show on hover or focus | Small to medium | Biggest look change. You lose source versus note icons and Color's tints; rail stops being glanceable; alignment tests need changes |
| 5 | Dim the whole thing at rest, full strength on hover or focus | Small | Goes below the 4.5:1 contrast the app holds at rest. Your call, since it is your eyes |
| 6 | Align the title with the document's first line | Medium | Only lines up at the top of the document; once you scroll it is arbitrary |
| 7 | Start the toolbar after the margin | Large | Disturbs the toolbar overflow widths and the bar's shared rule, for little gain |
| 8 | Scroll it with the document | Large | Navigation vanishes as you scroll. Defeats the purpose of a sidebar |
| 9 | Put text on the white sheet's margin | Not possible as is | A 1 inch margin is 96 px at 100 % zoom, and the sidebar needs at least 190. It would crowd the page and break the never-overlap rule's spirit |

Hit targets stay as they are for 1-5, since rows keep their full-width invisible button.

**Honest verdict.** Worth a small try, not a project. Items 1 and 2, and optionally 3, are under an hour together and take the biggest bites out of the "column" look. Past that, cost beats benefit. It is navigation with real controls (rename, collapse, add, reorder, rail), so stripping those to get pure text trades away what it's for. Two more limits: in page view the canvas is the same grey as the panel, so colour alone can never separate them; and this wave's lane C aligns it to match the docked sidebar, which by design makes it look more like one. Floating is also off by default and only appears in wide margins, so few moments would benefit. If items 1 and 2 don't satisfy you, I'd stop and leave it.

## Decisions only the owner can make
1. **Ruler margins:** linked sides (A, medium) or separate left and right (B, large)?
2. **Exports:** are you happy that dragging the ruler changes PDF and Word margins, as the toolbar dropdown already does?
3. **Top gap:** is a gap at the top of the document enough, or should space stay under the bar while scrolling? Should the default stay at today's 32 px?
4. **Hierarchy:** H1, H2 or H3, or see H1 and H2 side by side first? Any of them changes the AGENTS.md rule.
5. **Blue edges:** quiet grey line, or nothing at all on hover?
6. **Floating:** try items 1 and 2 (and 3?), or leave it alone?
