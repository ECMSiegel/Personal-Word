# REVIEW-6 -- independent look at T333 (FB15) and T334 (FB16), the REVIEW-5 repairs

Reviewer: Claude Opus (independent, agent-0f14), 2026-11-19. Read-only: no source or test file changed.
Probe spec lived in `test-results/fb-review6-probe/` (own config, dev server, serial lock, pinned Node 22.23.3, workers=1) and was deleted afterwards.
My screenshots and numbers: `test-results/fb-review6/` (`measurements.json`).
Evidence boundary: Chromium (Playwright) against the dev server only. No native WebKit, no owner use. Everything is CLAIMED at best.

## Summary

| Task | Verdict |
|---|---|
| T333 / FB15 research toggles + Delete source PDF pane | **approve** (no finding above low) |
| T334 / FB16 Projects meta + macOS-style sort menu | **approve** (no finding above low) |

## Checks I ran myself
- `npx tsc -b`: clean, no output.
- `npx vitest run src/layoutPrimitives.test.ts src/designTokens.test.ts src/hoverEmphasis.test.ts src/motion.test.ts`: 4 files, **39 passed**.
- `npx playwright test tests/fb-research-collapse.spec.ts tests/w9-research-panel.spec.ts tests/w9-used-in.spec.ts tests/fb-research-drag.spec.ts tests/sidebar-context-menu.spec.ts tests/fb-projects-meta.spec.ts tests/fb-sort-menu.spec.ts tests/popover-bounds.spec.ts tests/t10-dropdown-label.spec.ts --workers=1`: **43 passed, 4 skipped** (the four env-gated screenshot cases in sidebar-context-menu), 0 failed.
- `npx playwright test tests/layout-invariants.spec.ts -g "Projects|T5" --workers=1`: **7 passed** (includes T5 "cards sit in a grid with a 16 px gap both ways", i.e. three cards in a row at the default window). `git diff` of that file shows only FB1/FB2-era locator updates; the T5 assertion is not loosened.
- My probe: 7 cases passed (results below).

## T333 / FB15 -- approve

Diff read: `research.css` (`justify-self: start`; `.research-panel .research-subhead > button.research-collapse-toggle { color: inherit; font-size: inherit }`), `Cite.tsx` `Preview` and `ResearchPanel.tsx` Used in (label `<span>` then `ChevronRight 14`), `App.tsx` `deleteSource` (after `mutate`, `prune(splitRef.current, entryIds, researchPdfHolderIds(after))` then `splitRef`/`setSplit`, mirroring `remove()`; `mutate` updates `current.current` synchronously, so `after` is the post-delete project).

REVIEW-5 findings:
- FB9 #1 (toggles centred): **gone.** Screens `test-results/fb-FB15/collapsed-*.png`: Note, Shortened note, Bibliography labels start on the citation text's left edge; spec asserts +-1 px.
- FB9 #2 (chevron first): **gone.** Chevron trails each label, matching the design-system rule "label, then ... the chevron".
- FB9 #3 ("Used in" grey): **gone.** "Used in" is bold in the text colour like "Citation" in light and dark; spec asserts equal computed colour and size and equal x.
- FB8 #1 (PDF pane left open): **gone.** Probe: alpha.pdf beside -> delete Alpha source -> exactly one `.split-pane`, the editor, and no "This PDF is not stored" text (`delete-source-pdf-closed.png`).

Extra behaviour probes (all as wanted):
- alpha.pdf beside, delete **Beta** source -> still two panes (editor + alpha.pdf): prune does not over-close.
- A different section open beside, delete a source -> both entry panes left alone (`delete-source-entry-beside-kept.png`).
- "Open" on a PDF row also opens it beside; deleting its source closes that pane and leaves the editor (no "not stored" text).

Lows (not blocking):
1. Low -- evidence only: the worker's `open-*` shots stop after "Shortened note" with a blank area below, and `collapsed-*` have a blank band at the top (element screenshot of a scrolled aside). Bibliography preview and an open "Used in" are not shown in the open state. Product looked right in my probe; next time take a page screenshot with the aside scrolled to the citation zone.
2. Low -- carried from REVIEW-5 FB8 #2 / #3, still not done (owner's call): the "linked" refusal shows the shared banner's Retry button; no "deleted, a safety snapshot keeps it" notice after Delete source.

## T334 / FB16 -- approve

Diff read: `styles.css` project-list regions (cards `minmax(256px, 1fr)`; cards `.project-dates` `grid-template-columns: 1fr 7.25em; gap: var(--space-1) var(--space-2); white-space: nowrap`; the <=700 px block drops `max-width: 160px` and uses `10.5em 7.5em`, nowrap), `folders.css` nested cap `minmax(256px, 256px)`, `Dropdown.tsx` (`coverOffset`, `morph="anchor"` + `anchorOffset` only when `cover`), `dropdown.css` (`.dropdown-menu-cover { min-width: 100%; --edge: calc(var(--space-2) - 1px) }`), `Popover.tsx` (`anchorOffset`).

Popover blast radius: the only other `morph="anchor"` popover is the Projects "Start new project" panel (`ProjectLibrary.tsx`). It passes no `anchorOffset`, so `o = {0,0}`, no inline left/top is set (the cleared `style.left/top` were never set before), and the clip-path reduces to the old `inset(0 calc(100% - W) calc(100% - H) 0)`. `morph="edge"` popovers never reach the new code. `popover-bounds.spec.ts` (5 cases incl. "toolbar popovers keep their recorded untouched-tree placement") passed.

REVIEW-5 findings:
- FB1 #1 (mid-date wraps at <=700): **gone.** Probe with the widest date the font produces ("May 28" measured widest of 24 candidates, 118.8 px) plus "999,999 words" and "999 sections", top level and inside a folder and subfolder, at 600/680/700 px, list and cards: every span one line, nothing clipped, right column on one x.
- FB1 #2 (card dates wrap 720-870): **gone.** Same worst-case text at 720/800/870/1100/1440 cards: one line, no clipping, nested 256 px cards included.
- FB1 #3 (4 px card gap): **fixed to the coordinator's 8 px** (measured exactly 8.0 px at 256 px cards with the widest date; the 12 px of REVIEW-5 was superseded by the coordinator's keep-256 decision, so not judged against it).
- Three cards per row at 1440: **yes** (`projects-cards-1440-*.png`, my `worst-top-cards-1440.png`; T5 invariant passes).
- FB2 #1 / #2 (menu text jump; two bold rows): **gone.** Keyboard probe at 1100 px: current row text left/top equal the trigger text exactly (737.58, 162.5) and (756.11, 162.5); spec covers all four sorts and the pointer resting on the current row.

Behaviour probes:
- Keyboard: focus trigger, Enter opens (focus moves into the listbox), ArrowDown + Enter picks the next sort, focus returns to the trigger; Space opens likewise; Escape closes and focus returns to the trigger. All pass.
- Near the bottom of a 230 px window (Name current): menu 84-222, every row hit-testable (`sort-short-bottom.png`).
- Near the top, the real case (30 projects, 400 px window, `.library` scrolled so the trigger is 6 px under the tab strip, Custom current): menu top 31, every row visible and hit-testable (`sort-scrolled-top.png`). The worker's own top-clamp test used `position: fixed`, which skips the scroller; this probe covers the real path.

Lows (not blocking):
1. Low -- in **list** view at >=720 px, "999,999 words" is 0.61 px wider than its 7em track (`styles.css` `.project-list--list ... grid-template-columns: 10.5em 7em 7em 10.5em`, FB1's tracks). Not clipped (overflow is visible, into the 12 px gap), it just ends 0.6 px right of the other rows' right edge -- invisible in `worst-folders-list-1440.png`. Fix if wanted: second track `7.25em`, as was done for cards.
2. Low -- at <=700 px the old `.project-dates { gap: 3px !important }` still wins, so the date-to-counts space is 3 px plus track slack: 7.3 px with the widest date, not 8 (`worst-*-cards-680.png`, `worst-*-list-680.png`). Reads fine. Fix if wanted: delete `gap: 3px !important` from that media rule (the base/cards gap then applies; the budget only goes down).
3. Low -- the clamp is against the window (8 px), not the scroller, so with the page scrolled to the top the menu's top edge sits 1 px over the tab strip (menu y 31, strip ends 32). Nothing hidden.
4. Low, pre-existing -- after a keyboard open (or a mouse open right after an Escape) the whole menu shows the blue focus ring (`dropdown.css` `.dropdown-menu:focus-visible`, in HEAD). Seen in `sort-custom-*.png` and my `kbd-open.png`; a plain mouse open shows none (`sort-last-edited-*.png`).
5. Low, inherited from FB1 -- at 720-870 px top-level cards are wider than the 256 px nested cards, so the counts column sits at the far right of top-level cards but right after the dates in nested ones (`projects-cards-800-*.png`). Consistent within each grid.
6. Info, pre-existing -- `morph="anchor"` placement is not re-run on window resize while the menu is open.

## Steps for the owner to confirm
1. Projects page, cards, normal window: three cards per row; dates and counts each on one line with a clear space between.
2. Narrow the window to about 650 px, list and cards: no date breaks across lines.
3. Click the sort button: the current sort's word stays exactly where it was; only that row is bold. Tab to it, press Enter, arrow, Enter: the sort changes and focus is back on the button.
4. Open a source's PDF beside, delete the source from its right-click menu: the PDF pane closes, the writing pane stays.
5. Open a source in the research bar: Note / Shortened note / Bibliography labels sit on the text's left edge with the chevron after; "Used in" looks like "Citation".
