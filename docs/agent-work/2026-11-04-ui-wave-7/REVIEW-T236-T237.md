# REVIEW -- T236 (sidebar hierarchy, resize edges, floating) and T237 r2 (ruler)

Reviewer: agent-571b (Claude Opus). Date: 2026-11-04. Separate verdicts:

- **T236: REJECT** (2 firm small defects and 1 reading for the owner; the hierarchy itself is right, do not touch it).
- **T237: REJECT** (D1-D8 are fixed; one new defect hides the line being typed, and the 8 px gap should go in the same pass).

Evidence is Chromium with real Futura, from one private build (scratch `node_modules/.cache/personal-word-beta/ui7-rv-de`, port 1942). The tree did not change between build and full suite (`tree-at-build.txt`, `tree-at-full.txt`). Numbers are in `art/audit-e.log`, `art/audit-d.log`, `art/audit-2-main.log`; screenshots in `art/`. Probes: `audit/`, `audit2/`. No source or test was edited. Nothing here is native WebKit. Status of everything below: CLAIMED at most.

Scope: `src/styles.css`, `src/Writer.tsx` and `tests/split-view.spec.ts` also hold other sessions' edits (lane A word count and Cmd-K, lane B snapshot spacing, an Insert-table focus change, a "select all" test). Those were not reviewed here.

## T236: defects

Order is firmness: 1 and 2 are firm; 3 is a reading of the owner's words that the owner can settle.

**T236-1 (firm). Tests that can no longer fail, and dropped hover checks.** The behaviour is right today; the tests would not notice if it broke.
- `split-view.spec.ts:881` and `:891` assert `title(...)` `not.toHaveCSS("font-weight", "600")`. A lit heading is now 700, so they cannot fail. They should assert 500. Lines 883, 886, 890, 892 should assert 400 for the same reason.
- `sidebar-selection.spec.ts` W7 Plain dropped the 1.04 transform and stroke checks on an open row, on hover and on focus. That goes beyond the owner's rule change: the behaviour is still there (measured `matrix(1.04...)`, stroke 0.52 px, weight 400), so restore them.
- Nothing tests "nothing lit" on Comments, Read or Bibliography. Only Settings is covered. Add them; Bibliography after a mouse click must fail on today's code.

**T236-2 (firm). The Bibliography row's look depends on where focus was left.** `styles.css:1709` lights a row on `:focus-within`, and a clicked row keeps focus. The same open destination is `--text` with focus and `--muted` after blur.
- Measured, Bibliography on screen, pointer away, all four palette and scheme combinations: row in `--text`, `data-open` absent, all three headings 500. After `blur()` it returns to `--muted` (`art/audit-2-main.log`).
- AGENTS.md: while Bibliography is on screen "nothing in the three sections is lit".
- Fix: `.entry-row:has(:focus-visible)` instead of `:focus-within` on that rule, so it is consistently dim after a click and keyboard focus keeps the cue. The `.entry-row:focus-within` rules for action buttons are different and stay. Alternative if the owner prefers: light it consistently through `.selected`, and change the AGENTS.md sentence. Today's behaviour is wrong either way.

**T236-3 (worker's reading vs mine; owner to settle). The split divider's resting line disappears on hover, drag and focus.** At rest it draws a 1 px `--line` gradient. `.split-divider:hover, :active` and `:focus-visible` set `background: transparent`, and the new test asserts `background-image: none`.
- Both readings fit the owner's words "no line at all on hover; only the cursor changes". The worker took "no line at all" literally. I take "only the cursor changes" to mean nothing visible changes.
- Measured: rest `linear-gradient(...)`, hover and drag `none`. Rest and hover screenshots differ. The sidebar and research handles are pixel-identical.
- `art/edge-split-drag.png` is my argument: during a drag the two panes run together with nothing between them.
- Default fix unless the owner says otherwise: delete the `background` overrides on the divider's hover, active and focus-visible states (the old blue fill was what had to go), keep the focus outline, and assert rest equals hover.

## T236: what held up

**Hierarchy, Plain and Color, light and dark** (computed values, `art/audit-d.log`; `h-*.png` viewed):
- Lit heading: 700, 13 px, `--text`, in all four. Unlit heading: 500, 13 px, `--text`.
- Icons: section tint in Color (blue, green, orange), never in Plain.
- Rows: 13 px, weight 400 always. `--muted` at rest; `--text` on hover, keyboard focus and open. No row fill.
- Split: both panes' headings and both open rows are lit, and nothing else.
- Settings, Comments, Read: nothing in the three sections lit. Bottom rows keep their own look (12 px, 600 when open; tint in Color).

**Shared hover rule:** rows, open rows and the lit heading all show the 1.04 grow plus 0.52 px stroke, with no real weight change on rows. No second rule added.

**Contrast, recomputed:** 4.53 light and 6.25 dark on the sidebar, as claimed. Floating sits on other backgrounds: 4.78 and 6.01 on `--surface`, 5.2 and 6.66 on `--paper`.

**The heading's own width change: acceptable, not a defect.** Going bold widens only the label: Manuscript 65.8 to 76.6 px, Fragments 60.3 to 72.9, Research about 13 px. Chevron and action buttons stay at x 192 and 217, and no row moves. Avoiding it would need a reserved-width trick or all headings bold. The owner asked for "heading bold"; worth one look in their test.

**Old assertions:** `appearance:92, :263, :353, :392`, `layout:27` and the colour lines of `split-view:866` changed only because the owner's rule changed. The exceptions are in T236-1.

**Resize handles:** sidebar and research panel paint nothing on hover or drag (screenshots identical). Keyboard focus shows a solid outline on all three. Hit areas 7, 6, 7 px. Drag works: sidebar 270 to 230, research panel 390 to 430, split 615 to 576. Arrow keys work on the sidebar and split.

**Floating:**
- List hugs its content; bottom rows follow Research (`float-1900x1000-n2-cont.png`).
- 30 sections: the list scrolls, and the bottom rows stay fully above the footer at heights 1000 and 560. The window minimum is 600.
- At 400 px high the list shrinks to 8 px, but that is below the app's minimum window height. The last row stays reachable by scroll.
- Sidebar and text never overlap in any case measured; no background, in both views.
- Reveal strip: 8 px, reveals on hover, stays revealed over a row. `floating.spec` passes in the full suite.

**AGENTS.md bullet:** accurate. It dropped "never a fill", which is still the rule; put those words back. `docs/design-system.md` Sidebar selection (lines 177-188) is now stale, as are its lines on `⌘K` and word counts: for T240's docs merge.

Cards view: dim rule reaches title and preview; the open card's title goes to `--text`. Fine.

## T237: defects

**T237-N1 (must fix). The sticky ruler hides the line being typed.** ProseMirror does not know about the ruler, so moving the caret up leaves it behind the ruler. Measured with one ArrowUp at a time through a 60 paragraph document at 100%:

| View | Ruler on: caret fully hidden | Ruler off |
|---|---|---|
| Page | 95 of 110 moves; caret sits 23 px above the ruler's bottom edge | 0 |
| Continuous | 6 of 110, 12 partly, each time the scroller moves | 0 |

Typing there does not rescue it: after typing "TYPED", the caret was at y 115-136 with the ruler's bottom at 138, and the word is not visible (`art/caret-hidden-page.png`). Nothing else in the app hides the writing line, and it applies to anyone who leaves the ruler on.

Fix: pass ProseMirror `scrollMargin` (with a matching `scrollThreshold`) in `editorProps`, with top = the ruler's measured height (`rulerRef.current.getBoundingClientRect().height`, not 24 x zoom, since drawn height is 18 to 36 and native WebKit reports zoomed rects) plus a few px, only while the ruler shows. The `.scrollIntoView()` calls in `Writer.tsx` go through the same view, so one setting covers them. Add a test: ArrowUp through a long document in both views, and the caret's top never goes above the ruler's bottom. Check after typing too, and in a split pane. It must fail today.

**T237-N2 (fix in the same pass). The first glyph sits 8 px inside the ruler's margin in continuous view.** Yes, the owner would see it. Measured marker point minus first glyph: -6, -8, -10, -12 px at 75, 100, 125, 150%, and 0 in page view (`letter-cont-100.png`: triangle at x 543, text at x 551).
- A ruler exists to show where the text starts, this one is off by a visible amount, and the text appears to jump 8 px against the same markers when switching views. On the page view side it is exact.
- `ruler.spec.ts` measures the `.ProseMirror` box rather than the glyph, so it cannot see this.
- Fix: in `editor.css`, `.is-continuous .editor-paper .writing-surface { padding-left: 0; padding-right: 0 }`. Do not touch the shared `.writing-surface` rule in `styles.css`.
- I tried this with an injected style: glyph offset 0, and lists and blockquotes moved with the text with nothing crossing the margin (`eight-before.png`, `eight-after.png`).
- Cost: the continuous text column grows from 608 to 624 px at a 1 inch margin, so some lines rewrap. 624 is the width of page view and exports, so this removes a small mismatch rather than adding one. Measure the glyph in the alignment test.

**Minor (do not block alone):**
- At gap below 12 px the handle sits on the ticks (gap 0: handle y 128-140, ruler 116-140). It also passes over the ruler during a short scroll (its z-index is above the ruler's). The test title "keeps ... the gap handle off the ticks" overclaims.
- Pressing Ruler shifts its neighbour by 3 px (Insert page break 135.6 to 132.7) because the weight change resizes `flex: 1 1 auto` buttons.
- By reading, not run: a drag of under half a pixel rounds back to the start but still calls `setLayout` with an equal margin, one extra revision (`finishRulerDrag` compares unrounded values).
- Still from the first review: `.sr-only` duplicates `.visually-hidden`; repeated 24, 192, 200 literals; a drag has no value readout.

## T237: D1-D8 from the first review (all re-measured)

| | Result | Evidence |
|---|---|---|
| D1 alignment | **Fixed.** Ruler box = paper, tick 0 = paper left, both marker points = text box, all 0.0 px. Letter and A4, page and continuous, 75, 100, 125, 150%, 2 inch margin, 850 px window, both split panes in both views | `audit-2-main.log` |
| D2 horizontal scroll | **Fixed.** scrollWidth minus clientWidth 0 everywhere measured | same |
| D3 text through ruler | **Fixed** for drawing: opaque `--paper`, own 24 px (scaled by zoom: 18 to 36), first line below it at gap 0. It is what causes N1 | `sticky-*.png`, gap0 |
| D4 sticky in page view | **Fixed.** Pinned at y 0 after scroll in both views, light and dark | `audit-e.log` |
| D5 right button | **Fixed.** `ruler.spec` passes; `button !== 0` returns | spec, code |
| D6 marker point | **Fixed.** 0.0 px at all zooms | matrix |
| D7 toolbar | **Fixed.** No More at 1440; `popover-bounds:166` passes with the baseline untouched | full suite |
| D8 tests | **Mostly fixed.** Alignment compares real edges. Guard test shown to fail on a mutant by the worker (not repeated). The `document.xml` identity is real. Blind to the glyph (N2) and to the caret (N1) | `ruler.spec.ts` |

**`overflow-x: clip` (the real risk): no effect found.** Same probe on this build and on a copy with the old `hidden/auto` rule patched in, windows 1440, 1100, 850, 700, 520 at 100, 125, 150%: numbers identical, paper 16 px clear on each side, no horizontal scroll, table inside the paper (`audit-2-main.log`, `audit-2-baseclip.log`). The fit-to-pane scale keeps the sheet inside the pane, so there was never anything to scroll sideways: 150% at 1440 is drawn at 139.5%, as before. Sheets are not cut off. At 520 px the scale is 0.27, also as before.

**Page variables on the viewport: no side effect found.** All uses are inside the paper or the ruler (grep). `.writer-slot` (`var(--page-width, 816px)`) is outside the viewport, and `.fragment-text` is in the sidebar. The footer page number is the same ruler on and off at every scroll position tried.

**Ruler toggle in Page setup:** keyboard works: Page setup, Enter, four Tabs (Paper, Margins, Insert page break, Ruler), Space toggles, Escape returns focus to Page setup. Reachable through More at 900 px. Findable only if you open Page setup, with no palette entry, which is further than the owner's "toggle on the toolbar" (task text). This is a deviation the worker declared, and the owner should choose: keep it, or say what moves into More.

**Other checks:**
- Drag scale in a fitted page view: +20 screen px at zoom 0.855 gives 119, expected 119.4.
- Focus mode hides the ruler. Floating sidebar and ruler don't touch (270 vs 542 at 1900).
- Print: not re-measured this round; the first review measured it, and the print rules are present.

**Exports and persistence, real downloads:**

| Export | DOCX `w:pgMar` | PDF first word xMin | PDF pages |
|---|---|---|---|
| a: base | 1440 | 72 | 2 |
| b: gap 200 only | 1440, `document.xml` byte-identical to a | 72, same text | 2 |
| c: ruler drag to 2 in | 2880 | 144 | 4 |

Gap-only change keeps `marginInches` 1; the drag sets 2. Both and `topGap` 200 survive browser reload, as does the ruler preference. `cargo test`: 63 passed, 1 ignored (Rust untouched; no test sets `topGap`).

## Suite (one fresh build)

- `npx tsc --noEmit -p .`: pass. `npm test`: 68 files, 1137 passed. `vite build`: pass.
- Full Playwright: **466 passed, 2 failed, 16 skipped** (19.1 min).

| Failure | Result | Owner |
|---|---|---|
| `ci-indent:227` keyboard focus: Home key did not move the caret in time | passes 5 of 5 alone. Also failed in `ui7-full`. Load-dependent | Neither task. Flake with no owner; pre-existing; T240 to note |
| `sidebar-context-menu:319` Reduce Motion menu opacity 0 | passes 5 of 5 alone | Neither task. Flake with no owner; T240 to note |

No failure is T236's or T237's. Note the suite passing does not catch any defect above.

## Could not verify
Native WebKit and SQLite (all of it). Footnotes at a 2 inch margin. A pointer released outside the window. Whether `:has(:focus-visible)` behaves the same in native WebKit (T240). The `App.tsx` guard mutant was not repeated (the worker's result is cited). Arrow keys on the research panel handle (my probe measured the wrong box).

## For T240 (native), after the fixes
1. Alignment: ruler 0, both markers and the first glyph at 75, 100, 150%, page and continuous, Letter and A4, both split panes, with a visible scrollbar.
2. `position: sticky` with CSS `zoom`, and `overflow-x: clip` on the paged viewport: pinned while scrolling, sheets not cut off at narrow widths.
3. Caret never behind the ruler: ArrowUp and typing through a long document, both views, at 75 and 150%. `scrollMargin` in zoomed WebKit is untested.
4. Drags with trackpad and mouse at each zoom, release outside the window, right-click inert. Margin, gap, sidebar, research and split handles.
5. Resize handles: no line on hover or drag; split divider keeps its resting line; clicking a handle shows no focus ring, keyboard does.
6. Sidebar in Plain and Color, light and dark: Futura weights (700 vs 500 vs 400), dim row legibility, heading widening. Bibliography row dim after a click.
7. Floating: list hug, 30 sections at the 600 px minimum height, reveal strip, in both views.
8. SQLite: margin and top gap through save, quit, relaunch, snapshot and restore, recovery journal, project export and import; `topGap` absent if never set; a gap-only change leaves `marginInches` alone.
9. A 2 inch margin with a footnote, and a 0.25 inch margin, through native DOCX and PDF export and `printing.rs`.
10. Toggle: Tab order in Page setup; Page setup from More at narrow widths.
11. Docs merge: design-system Sidebar selection, split divider line, toolbar widths, ruler section.
