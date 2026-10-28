# P1 -- Vertical pagination feasibility spike

Board task T146, agent-987c, 2026-10-28. Status: CLAIMED, in review (spike done; nothing in `src/` changed).
Scratch copy: `node_modules/.cache/personal-word-beta/ui3-p1/` (`app/` = prototype on `b3a151a`, `base/` = untouched `b3a151a`, `out/` = JSON results and PNGs, `run*.log` = logs).

## Verdict

**GO for P2 in Chromium, with native WebKit as P2's first gate.**

- Chromium evidence is good: pages stack vertically, nothing scrolls sideways (also in a 585 px pane), footnotes sit at the foot of their page, manual page breaks start a new page, undo is unaffected, the caret crosses page gaps correctly, and typing in page view is no slower than today's page view.
- Native WebKit (the real app) was **not** tested. This spike had no native GUI runs (coordinator only), and no Playwright WebKit is installed. So the plan's "latency for both engines" line is only half met. **P2's first step must be a native check before the full rewrite lands**: smoke build with the plugin, type in page view on a long document, and check the caret across a gap (see "Native checks P2 must run first"). If that fails, use the plan's fallback: keep multi-column, map the mouse wheel to vertical, fit-to-width zoom.
- **Owner-visible consequence (the coordinator should confirm this is what the owner accepted):** pagination works per block, so **a paragraph never splits across two pages any more**. A paragraph that does not fit the space left on a page moves whole to the next page, so a page can end with blank space up to one paragraph tall (see `out/proto-boundary.png`). Only a block taller than a whole page straddles the gap (`out/proto-giant-straddle.png`). Today's multi-column view does split paragraphs line by line. Plan open question 3 talks about "taller than the remaining space", while the plan's Approach and the coordinator brief say "taller than a page". The prototype follows the brief: push whole, straddle only when taller than a page.

## Evidence (all Chromium headless 1248, production preview build, 1240 x 840 window; native WebKit: not measured)

Fixture: one section of about 29,000 words (640 paragraphs, a heading every 12, a footnote every 40) = **90 letter pages** in the prototype (86 columns in today's view). Latency sampling is the same as `tests/performance.spec.ts`: 200 "x" keystrokes, time from keydown to the editor `update` ("sync"). The spike adds "paint" = keydown to the second animation frame, which includes the pagination re-measure that runs after the update. Budget: median <= 25 ms, p95 <= 50 ms (sync). The machine was shared with other agents' builds, so the runs were interleaved (proto, base, proto, base) and both runs are shown.

| Measure (Chromium) | Today's multicol page view (base) | Prototype page view | Notes |
|---|---|---|---|
| Typing at doc start, sync p50 / p95 (run 1, run 2) | 13.4 / 29.6; 11.8 / 21.2 ms | 15.6 / 60.8; 10.6 / 14.0 ms | Run-1 prototype p95 was under load: continuous mode with the plugin idle had p95 67.4 in the same run |
| Typing mid-doc (page ~45), sync p50 / p95 | 14.0 / 30.9; 15.0 / 52.6 ms | 13.3 / 35.9; 11.0 / 12.9 ms | |
| Typing at start, paint p50 / p95 | 45.6 / 94.7; 39.8 / 95.0 ms | 40.5 / 187.9; 32.5 / 48.4 ms | |
| Plugin measure per keystroke p50 / p95 | -- | 3.0-3.9 / 3.4-13.3 ms | 1 measure per keystroke; boundaries re-dispatched only 3-6 times in 200 keystrokes |
| Horizontal scroll at 1240 | yes (scrollWidth 72,928 / client 970) | none (970 / 970) | |
| Horizontal scroll in a 585 px pane | yes | none (585 / 585); page scaled to 0.678 with CSS `zoom`, 553 px wide | `out/proto-narrow.png` |
| Page 2's first line, layout px from paper top | -- | 1184.00 (expected 1184 = 1056 + 32 + 96) | |
| Blocks crossing a page bottom (besides taller-than-page blocks) | -- | 0 of 700 | |
| Page count | 86 (columns) | 90 = 89 spacers + 1; giant variant: 94 pages, 90 spacers (the taller-than-a-page paragraph spans several pages with no spacer inside) | |
| Heading kept with the next block | -- | 0 of 54 headings left alone at a page foot; 16 headings start a page (`run5.log`, `out/results-proto-headings.json`) | |
| Footnotes at the foot of their page | -- | 16 of 16 page blocks inside the bottom half of the page that holds the reference | `out/proto-footnote.png` |
| Manual page break | -- | next block starts at 1184.00, expected 1184; undo removes break, spacers back to 89 | `out/proto-pagebreak.png` |
| Undo after typing at the top of page 2 | -- | one Cmd+Z restores the text exactly; 89 spacers before and after; no extra history steps (spacer transactions use `addToHistory: false` and change no document) | |
| Caret, widget variant | -- | Down from page 1's last line -> page 2's first line; Up back; Up from page 2 -> page 1's last line; Right/Left step across the boundary (1846 <-> 1848); Cmd+Left/Right = line start/end on page 2; Shift+Down extends the selection across the gap; clicking in the gap -> start of page 2 | Clicking in page 1's bottom margin also lands on page 2's start (Word would use page 1's end) -- small P2 fix |
| Caret, margin variant (node decoration with a big margin-top instead of a spacer div) | -- | **broken**: Down from page 1's last line stays put; Up jumps two lines | Rejected |
| Current page from scrolling | -- | the paged viewport grows to full height; the scroller is the ancestor `div.writer-scroll`. Tracking scroll on the document (capture) from the paper's rect gives "page 42 of 90" at scrollTop 30166 in the 585 px pane (expected ~41-42) | Today's `onScroll` on `.editor-viewport` never fires in the vertical model |
| Drift at zoom 0.678 | -- | page starts drift up to 4 px by page 90 (0 px at zoom 1) | P2 fix, see Risks |

## Design for P2

**Plugin** `src/editor/pagination.ts` (prototype: `ui3-p1/app/src/editor/pagination.ts`, about 260 lines with spike counters), Tiptap `Extension` named `pagination`, `PluginKey("pagination")`.

- **State:** `{ boundaries: { pos, height, before }[], pageCount, decorations }`. When a transaction changes the document, boundary positions are mapped through it and the `DecorationSet` is mapped. A meta transaction replaces the state; it uses `addToHistory: false` and never changes the document, so Tiptap's `update` event does not fire and nothing is saved.
- **Decorations:** one `Decoration.widget(pos, div.page-spacer, { side: -1, key: "page-spacer-<index>-<height>", ignoreSelection: true })` before the first block of each new page. The spacer has `contenteditable=false`, `aria-hidden`, `pointer-events: none`, and an inline height = the rest of the page (including the previous block's bottom margin) + bottom margin + gap + top margin. The stable key lets ProseMirror reuse the spacer elements. CSS `.is-paged .page-spacer + * { margin-top: 0 !important }` stops margins collapsing into the spacer, so the arithmetic is exact (page 2 lands at 1184.00).
- **Measure (plugin view):** run on `requestAnimationFrame` after each document change, after a width change (ResizeObserver on `view.dom`, width only), on `document.fonts.ready`, and when the Writer calls `paginate(view)` after layout settings change. It reads the rect of each top-level `view.nodeDOM(offset)`, and the margins from a per-element `WeakMap` cache (this cut the measure from about 10 ms to 3 ms). It works out where each block would sit with no spacers at all, so spacers never feed back into the measure. Rules: a block that does not fit moves to the next page. A heading moves with the block that follows it, which replaces `break-after: avoid-column`. `pageBreak` forces the next block onto a new page. A block taller than a page straddles, and the next block goes on the page that holds its bottom. `pageCount = max(last page + 1, ceil(contentBottom / pitch))`. The scale comes from `surfaceRect.width / --content-width`, never from the computed zoom. Geometry comes from CSS variables on `.editor-paper` (`--page-height`, `--page-gap`, `--page-margin`, `--content-width`, `--footnote-reserve`), so the plugin never needs React props. It dispatches only when the boundaries change.
- **Exports:** `Pagination`, `paginationKey`, `paginate(view)` (synchronous measure + dispatch).
- **CSS (`editor.css`, replaces today's `.is-paged` multi-column block):** `.is-paged { overflow-x: hidden; overflow-y: auto }`. `.is-paged .editor-paper { position: relative; width: var(--page-width); min-height: calc(var(--page-count) * (var(--page-height) + var(--page-gap)) - var(--page-gap)); background: repeating-linear-gradient(to bottom, paper 0 .. --page-height, transparent .. + --page-gap) }`. `.is-paged .writing-surface { width: var(--content-width); min-height: 0; padding: 0 }`, with no `column-*` and no fixed height. `.manual-page-break` keeps height 0 and loses `break-after: column`. Print hides `.page-spacer`. `--page-height` and `--page-gap` already exist in `pageStyle`. Only `--page-scale` is new.
- **Writer:**
  - Page count is read from `paginationKey.getState(editor.state).pageCount` on `transaction`; this replaces the `countPages(scrollWidth...)` effect.
  - Fit to a narrow pane: a ResizeObserver on the viewport sets `fitScale = clamp(0.25, 1, (clientWidth - 32) / (pageWidth * zoom))`. `pageStyle.zoom = zoom/100 * fitScale` in page view only, and `--page-scale = fitScale`. The scale is set in JS rather than `calc()` inside `zoom`, which is safer in WebKit.
  - Current page: a capture `scroll` listener on `document`. `page = floor((scrollerTop - paperTop + pitch/3) / pitch) + 1`, where `pitch = (height + gap) * zoom * fitScale`. The `onScroll`/`scrollLeft` prop goes.
  - Page footnote blocks: `left = margin`, `top = page * (height + gap) + margin + contentHeight - reserve + 8`.
- **Footnotes (`useFootnoteLayout.ts`):** keep the uniform reserve (today's documented approximation; per-page reserves are out of scope). Read reference **tops**, not lefts. `assignPages(tops, surfaceRect.top, height + gap, 0, scale)` works unchanged as a vertical pitch. Two required changes, both proven by the spike:
  1. Start each measure from the reserve already applied, not from 0. Starting from 0 made every keystroke flip the reserve 0 -> 29 px and re-dispatch spacers twice (p95 measure 94 ms, 1.4-2 dispatches per keystroke). With the fix: 0.03 dispatches per keystroke.
  2. Call `paginate(editor.view)` after changing `--footnote-reserve`, only when it changed, so references are read after the spacers move.
- **`formatting.ts`:** `countPages` becomes unused; delete it and its unit test, or keep a vertical `ceil` helper for the plugin. `PageBreak` rendering is unchanged.
- **Shift+Enter (E2)** inserts `pageBreak` and needs nothing more: the plugin treats it as a forced boundary.

## File plan for P2 (by function or region; line numbers moved under E1-E3)

- create `src/editor/pagination.ts`: copy the prototype, drop the `spike` counters, the `__paginationSpike` global and the margin-mode branch.
- `src/editor/extensions.ts`: nothing. Add `Pagination` in `Writer.tsx`'s `editorExtensions` `useMemo`, not in `documentExtensions()`, which import validation and exports share.
- `src/editor/editor.css`: replace the `.is-paged` block (from `.is-paged {` to just before `@media print`). In print, drop `columns: auto` and add `.page-spacer { display: none }`.
- `src/Writer.tsx`: the `countPages` effect becomes the pagination-state reader (deps include `fitScale`). Add the fit-scale effect, the `--page-scale` and `zoom` in `pageStyle`, and the document-capture scroll effect. Remove the viewport `onScroll` prop. Change the `page-footnotes` `style`. Keep the `onPageStatus` effect as E1 left it.
- `src/editor/useFootnoteLayout.ts`: tops, pitch, starting reserve, `paginate` call (as above).
- `src/editor/footnoteLayout.ts`: rename the `assignPages` parameters (column -> page pitch); the maths is unchanged. Update `footnoteLayout.test.ts` if it names columns.
- `src/editor/formatting.ts`: `countPages` (and its test) as above.
- Tests to change:
  - `tests/features.spec.ts` (page-view test around "Line and paragraph spacing" / "Page count"): it asserts the first paragraph has `getClientRects().length > 1`, which is multi-column line splitting. **That premise is gone, not updated.** Replace it with: page count of 2 or more and at least one `.page-spacer`.
  - `tests/native-smoke.js` phase 1: it waits for "native paragraph pagination" (`p.getClientRects().length > 1`) after typing one long paragraph. In the vertical model that paragraph has one rect and **the smoke would hang**. Wait instead for `.page-spacer`, or for the page count 2+ (one 300-repeat paragraph is taller than a page, so the count still reaches 2+). `diagnostics()` reads the paper's `width` and `scrollWidth`; record height instead.
  - `tests/footnotes.spec.ts` (page-1 footnote in the bottom half, around line 180): passes unchanged on page 1.
  - `tests/accessibility.spec.ts` (page-view toggle keeps the editor and undo): should pass unchanged. Undo was verified in the spike.
  - `tests/performance.spec.ts`: add a page-view variant of the latency test. The 25/50 ms budget has never been measured in page view.
  - New `tests/pages.spec.ts` (plan P2): use the spike's checks, all in `ui3-p1/app/tests/pagination-spike.spec.ts`: `scrollWidth === clientWidth` at 1240 and 585; page 2's first block at `pitch + margin` within 1 px; spacers + 1 = page count when no block is taller than a page; footnote block inside its page's bottom half; a page break moves the next block to the next page; Down/Up across a gap; zero `.page-spacer` after returning to continuous view.
- `docs/limitations.md`: the limits below.

## Limits to document
1. Paragraphs do not split across pages in page view. A paragraph that does not fit moves to the next page and can leave blank space at a page's foot. Exports keep their own pagination, which does split lines.
2. A block taller than a whole page (very long paragraph, large table, tall image) runs straight across the page gap and the margins. Text is drawn over the grey gap (`out/proto-giant-straddle.png`).
3. One footnote reserve for every page, sized for the page with the most notes (unchanged approximation).
4. Page view and PDF/Word pagination still use different engines; no page parity (unchanged).
5. In a narrow pane the page is scaled down (CSS `zoom`), not reflowed.

## Risks for P2
- **Native WebKit unproven** (the gate). Specifically:
  - Typing latency in page view on a 90-page section.
  - Caret Up/Down across a `contenteditable=false` spacer: ProseMirror's vertical motion falls back to the browser, and WebKit has a history of odd behaviour around non-editable blocks.
  - `getBoundingClientRect` under CSS `zoom` (the scale is derived from the rendered width, which should hold either way).
  - Scroll feel.
- **Rounding drift under zoom:** up to 4 px by page 90 at scale 0.678 (0 at scale 1). Fix in P2: after dispatching, compare one page start with its expected `p * pitch` and fold the error into the next spacers. Or measure in unzoomed layout px (`offsetTop` relative to the surface). Test at a 585 px pane with page starts within 1 px.
- Measure cost grows with block count: about 3 ms for 700 blocks in Chromium, once per keystroke after the update. A 300-page section would cost about 10 ms. Later option: measure only from the first changed block onward.
- The first `paginate` after a mode switch runs one frame after paint, so continuous text can flash unspaced for one frame. Not seen in screenshots; check native.
- Footnote reserve and spacers interact. The steady state is stable with the starting-reserve fix; without it, typing thrashes (measured).

## Native checks P2 must run first (unlocked screen, coordinator or owner)
1. Smoke build with the plugin, a 90-page section in page view: type 200 characters at the top and mid-document; record sync and paint p50/p95 the same way as here. Budget sync p50 <= 25, p95 <= 50 ms.
2. Caret: press Down on the last line of page 1, Up on the first line of page 2, Shift+Down across the gap, click in the gap.
3. Narrow split pane: no sideways scrollbar; the page is scaled; page starts line up with the paper.
4. The footer page number follows scrolling.

## Not established
Native WebKit anything; Playwright WebKit (not installed); tables, images and lists as page-start blocks (only paragraphs and headings in the fixture); RTL; documents above 90 pages; split view with two paged panes at once (the 585 px case was a forced viewport width, not a real split).

## Reproduce
Pinned Node 22.23.3. From the project root:
```
S=node_modules/.cache/personal-word-beta/ui3-p1
(cd $S/app && npx tsc --noEmit -p . && npx vite build --outDir "$PWD/dist" --emptyOutDir)
node_modules/.bin/esbuild $S/app/tests/pagination-spike.spec.ts --format=esm --target=es2022 --outfile=$S/spec/pagination-spike.spec.mjs
SPIKE_BUILD=proto SPIKE_OUT="$PWD/$S/out" npx playwright test --config "$S/app.config.mjs"
SPIKE_BUILD=base  SPIKE_OUT="$PWD/$S/out" npx playwright test --config "$S/base.config.mjs"
```
(Playwright cannot load `.ts` from inside `node_modules`, so the spike spec is transpiled to `.mjs`. Port 1646.) Logs: `run3.log` (final interleaved runs), `run4.log` (straddle screenshot), `run5.log` (headings). Results: `out/results-proto-r1.json`, `-r2`, `out/results-base-r1.json`, `-r2`.
