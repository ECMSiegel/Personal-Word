# Independent review -- T168, page view splits paragraphs like Word

Reviewer: Fable (final independent review, 2026-10-28). Scope: `src/editor/pagination.ts`, `src/editor/pagination.test.ts`, `tests/pages.spec.ts`, `tests/native-smoke.js`, the docs touched by T168, and where T168 meets footnote layout, `Writer.tsx`, undo, save and export. Pre-change copies and diffs read from `node_modules/.cache/personal-word-beta/ui3-wordsplit/`. Nothing in the project was edited; only this file was written.

## Verdict: SHIP WITH FIXES

The arithmetic is right, the spacers never touch the document, and the evidence logs say what the summary said they say (second Playwright run finished 270/270; the single failure in run 1 was `motion.spec.ts (e)`, unrelated, and passed on rerun). Three things need fixing before the caret behaviour can be called trustworthy: a class of edits that leaves a stale forced line break (1), a caret that is drawn on the wrong page at the positions the new feature creates (2), and a native check that was loosened so that it can no longer tell a right caret from a wrong one (3).

## Findings

### 1. major -- Mark-only edits never dirty the paragraph, so the forced break goes stale
`src/editor/pagination.ts:597-612` (`apply`), `:331-347` (stale hiding).

The dirty range is built only from `mapping.maps` ranges. `AddMarkStep`, `RemoveMarkStep`, `AddNodeMarkStep`, `RemoveNodeMarkStep` and `AttrStep` all inherit `Step.getMap()`, which is `StepMap.empty` (checked: `new AddMarkStep(1,5,mark).getMap()` has 0 ranges, prosemirror-transform 1.12.2). `tr.docChanged` is true, so `apply` runs, but `dirty` is unchanged and the paragraph's spacer stays displayed while measuring.

Failing scenario: a paragraph is split across pages 1 and 2. Select a bold word on the last line of page 1 and press Cmd+B to un-bold it (or shrink it with a font-size text-style mark, remove a link, remove a comment mark, anything that makes the line narrower). The natural wrap now falls later, but the `display:block` spacer still forces the break at the old position. `measure()` reads that layout as natural: the plan returns the same line index, `firstCharBelow` returns the same position, `same()` is true, nothing is dispatched. Page 1 ends with a visibly short line and page 2 starts with words that fit on page 1, and it stays that way until the paragraph is typed in or the width changes. This is exactly the defect the dirty mechanism exists to prevent (the doctored run `pw-doctored.log` shows what it looks like: a 356 px gap), reached through a different door. Making text wider (adding bold) self-corrects in one follow-up, because the plan then picks a new position from the extra short line; making it narrower does not.

Fix: in `apply`, also widen `dirty` for steps whose map has no ranges: for each `step` in `tr.steps` with numeric `from`/`to` (mark steps) or `pos` (node-mark and attr steps), fold `mapping.slice(i + 1).map(from, -1)` .. `map(to, 1)` into `dirty`. A one-line alternative that is safe but coarser: if `tr.docChanged` and no map produced a range, `rewrap.add(view)` on the next measure.

### 2. major -- At a mid-paragraph page break the caret is drawn on the wrong page
`src/editor/pagination.ts:79` (`side: -1`), `:521-523` (`clickSpacer`), `:562-567` (`arrowAcrossGap`).

An inline split makes the end of page N's last line and the start of page N+1's first line the same document position. ProseMirror has no caret affinity; its `setSelection` places the DOM caret with `domFromPos(anchor, -1)`, which for a widget with `side: -1` returns the DOM point after the widget (prosemirror-view 1.42.6 `viewdesc.domFromPos` lines 943-958; `WidgetViewDesc.domAtom` is true, so the "enter previous" branch is skipped). So a selection at the boundary position is always drawn at the top of the next page. Consequences, none covered by a test because the tests only read `selection.from`:

- `marginClickToPage1End` / "a click in the page's bottom margin goes to the end of that page": for an inline gap, `prev === pos`, so the caret appears at the start of page N+1's first line, not at the end of page N. The pages.spec assertion `from === prev` passes while the user sees the opposite.
- Up from page N+1's first line when the caret column is to the right of where page N's last line ends: `posAtCoords` returns the boundary position; the caret is redrawn where it started (column 0). Up appears to do nothing.
- End on page N's last line (and any transaction that re-syncs the selection while the caret is there) jumps the caret to page N+1.
- Down landing at the end of a line that ends in a soft wrap (common: the target line is shorter than the caret column) sets a collapsed selection at a wrap offset; browsers draw a programmatically set caret downstream, i.e. at the start of the following line, so Down appears to skip a line. The native run shows this landing: `inline down` head 3935 reads as either line 583 or line 607 (`native-gate-results.json`, p2 runs 1 and 2).

Fix: in `arrowAcrossGap`, after `found`, if `found.pos` equals an inline boundary position, or `coordsAtPos(found.pos, -1).top !== coordsAtPos(found.pos, 1).top`, step one character toward the intended line (`pos - 1` when landing at a line end going down, `pos + 1` when landing at a line start going up) so the caret stays on the line the user asked for; in `clickSpacer`, for an inline boundary send the margin click to `pos - 1` (before the wrapping space) or accept and document that it goes to the next page's start. Add the single-position ambiguity to `docs/limitations.md`.

### 3. major -- The native-smoke pass rule now accepts either of two readings, and the drawn caret is not measured
`tests/native-smoke.js` (`press` returns `tops = [top(head), coordsAtPos(head).top]`; `pass` uses `tops.includes(...)`).

Two of the twelve recorded moves disagree between readings: `block up` head 1692 reads 292 (next-character rect, equals `page1Last`) or 268 (ProseMirror `coordsAtPos`, one line higher); `inline down` reads 607 or 583 (`page2First`). `upFromPage2ToPage1Last` is the check that failed in both `w1-gate.log` runs; in `w2-gate.log` it passes only because the new reading is accepted. Which reading matches what WebKit draws depends on canonicalisation and affinity at a node boundary (1692 is one: `coordsAtPos` takes the upstream branch only when `offset == nodeValue.length`), and nothing in the harness measures it. As written, the rule cannot fail for a caret drawn one line off, so it does not prove the claim in `docs/changelog.md` that "Up and Down cross a page gap to the adjacent line in WebKit too".

Fix: record the native caret rectangle after each move (`getSelection().getRangeAt(0).getClientRects()[0]`, falling back to `modify("extend","forward","character")`, read, restore) and gate on that single number. Keep both readings as diagnostics. Until then the WebKit caret claim is CLAIMED on position only, not on what is drawn.

### 4. minor -- Down across a block gap ignores the next block's top margin
`src/editor/pagination.ts:557-560`.

`below = rect.bottom` is the spacer's bottom; the first line below a block spacer starts at `rect.bottom + marginTop (+ half-leading)`. The test passes with 16 px margins and 24 px lines because `16 + 3 < 24`. A heading after a gap whose top margin is at least its line box (an h2 with `margin-top: 32px`) is outside `caret.top - below < line`, so the plugin steps aside and WebKit's own skipping movement returns, silently. Mirror `above`: use `spacer.nextElementSibling.getBoundingClientRect().top` for `below` when the spacer is a block spacer.

### 5. minor -- `TextSelection.create` on a `posAtCoords` result that may not be inline
`src/editor/pagination.ts:564-566`.

If the first block below a gap is an image figure, a table or a horizontal rule, `posAtCoords` returns a position in block context and `TextSelection.create` produces a selection ProseMirror warns about and renders oddly. Use `Selection.near(doc.resolve(found.pos), up ? -1 : 1)` for the plain move, and for Shift only extend when `$pos.parent.inlineContent`, otherwise return false and let the browser handle it.

### 6. minor -- `docs/design-system.md:184` still describes the pre-T168 open question
"The whole-block rule is CLAIMED, not VERIFIED: the owner's hand-check sheet asks whether ... a paragraph should split across the page gap instead." That question is answered by T168 four lines above it. Replace with the current state (paragraph split CLAIMED; caret across gaps CLAIMED on position, drawn caret not yet measured natively, per finding 3). `docs/limitations.md` is accurate as far as it goes; add the caret ambiguity from finding 2.

### 7. nit -- `firstCharBelow` and text inside atoms
`src/editor/pagination.ts:298-315`. The tree walker visits text inside inline node views (a footnote reference's number). If a line happens to start with such a node, `posAtDOM` returns the atom boundary (possibly after it), so the spacer lands after the reference and the number is pulled up to the previous page's line. Rare; skip text nodes whose nearest `pmViewDesc` is a leaf node view, or accept.

### 8. nit -- `keepLines` at a page start can keep a single line
`src/editor/pagination.ts:187-196`. With `atStart`, `keep` falls to 1 when only one line fits (a footnote reserve close to a page). Degenerate and bounded; mention only because the doc comment says "at least two".

## Checked and fine

- `planPages`: every loop terminates (`fit` advances to `n`; the split loop advances `from` by at least 1 and breaks at `n`; `target` loops are bounded by `pitch` steps). Widow/orphan arithmetic matches the tests (18 unit tests re-run here, all pass) and hand checks: 3 lines move whole; 4+ split 2/2 minimum; an 80-line paragraph splits twice and each continuation starts at its page's first line; the footnote reserve is subtracted for lines and blocks; headings stay above a paragraph that can split and move with one that cannot; a heading run at a page start never separates; a page break forces a new page; `pageCount` follows the last block's bottom; `pageFirst` is left at the block that started the page so a heading run after a split paragraph still walks back correctly.
- Measurement: `above`/`ownHeight`/`natural()` subtract inline spacer heights consistently in client px and divide by `scale` once; the `precise` fallback and the zoom/ratio choice are unchanged from before; `lines()` derives line-box tops from glyph bottoms plus the last line's half-leading; `firstCharBelow` is monotone over logical order (holds for bidi, surrogate pairs and combining marks because both halves of a glyph share one rect and the first index wins); whitespace is unambiguous because Tiptap injects `white-space: break-spaces` on `.ProseMirror`, so a wrapping space has a definite line and the forced break reproduces the natural layout; hidden spacers are skipped by `inner` and the scroll position is restored after measuring; `rewrap` survives a composing early-return; `clean` stops a `same()` result from re-hiding the same range.
- Data safety: spacers are widget decorations only (`contentEditable=false`, `aria-hidden`, `ignoreSelection`, `WidgetViewDesc.parseRule` returns `ignore: true`, so DOMObserver never reads them as content); pagination dispatches carry `addToHistory: false`; no code in `src/` reads `innerText`, `textContent` of the surface, or `window.getSelection()` for counts, saves or exports; copy and drag go through ProseMirror's doc-based serialisation; print CSS hides spacers; exporters build from the document, not the DOM.
- Footnote layout: `useFootnoteLayout` assigns each reference by its own `offsetWithin`, so a reference on a line that moved to the next page is listed on that page; the native gate shows `refPageMismatches 0` and page starts within 1 px at the 585 px pane.
- `Writer.tsx` calls `paginate(view, true)` on layout and document-setting changes, which sets `rewrap`; the ResizeObserver and `fonts.ready` also set it.
- Undo: typing at the top of page 2 then undo is covered by the spec; boundaries and decorations are mapped with the same `-1` association as the widget side.
- IME: `handleKeyDown` is not invoked during composition; `paginate` defers while composing.
- Evidence logs match the summary: `full.log` tsc 0, unit 1042, build 0, cargo 63, release app built; `pw-full.log` 269/1 (motion (e)), `pw-full2.log` 270/270; `pw-pages-old.log` fails the new spec on the old build at the inline count; `pw-doctored.log` fails the rewrap test at 356 px without dirty hiding. Both fail-first runs are genuine.

## Not established

- What WebKit actually draws for a caret at a wrap or node boundary after the plugin's `setSelection` (finding 3); the harness records two readings and the drawn caret is not measured. All WebKit caret claims are CLAIMED on document position only.
- Appearance of justified paragraphs at a split (the line before a forced block break is laid out as a last line and not stretched); documented in limitations, not seen.
- Whether a hard break (`<br>`) immediately before an inline spacer produces an empty line box in WebKit; Chromium does not, WebKit not checked.
- RTL and mixed-direction paragraphs were reasoned about, not run.
- Behaviour with `hyphens: auto` (not used by the editor today).
- Nothing here was confirmed in the real app by the owner; status stays CLAIMED.

## Re-check (after the coordinator's fixes, 2026-10-28 17:05)

Read: `node_modules/.cache/personal-word-beta/ui3-wordsplit/diff-fixes-pagination.patch`, current `src/editor/pagination.ts`, `tests/pages.spec.ts`, `tests/native-smoke.js`, `docs/limitations.md`, `docs/design-system.md`; logs `ui3-p2/native-gate-results.json` (latest), `ui3-wordsplit/pw-doctored2.log`, `ui3-wordsplit/full2.log` (tsc 0, unit 1042 passed; build/Playwright/cargo/app still running when this was written). `npx vitest run src/editor/pagination.test.ts`: 18 passed.

| # | Finding | Status |
|---|---|---|
| 1 | Mark-only edits never dirtied the paragraph | **Fixed.** `apply` now widens `dirty` from every step's own `from`/`to` or `pos` mapped through `mapping.slice(i)` (correct coordinates: the step's own map is included, and `tr.mapping.maps[i]` is aligned with `tr.steps[i]` because `Transform.addStep` appends one map per step). ReplaceSteps are counted twice (map ranges and from/to), which is harmless. Regression test added (bold then unbold the last 60 characters before the spacer); fail-first on the doctored build is genuine but marginal: 104.4 px against a 100 px threshold (see new nit A). |
| 2 | Caret drawn on the wrong page at the shared position | **Partly fixed.** The margin click now goes to `pos - 1` (both specs and the smoke expect it; limitations and design-system say so). The nudge in `arrowAcrossGap` handles a wrap inside one text node, and the native run confirms it (`inline down` now lands 3934, drawn 583 = page 2's first line, where it landed 3935 before). It does not handle the case the finding led with: `charRect(view, pos)` uses `view.domAtPos(pos)` with the default `side = 0`, and at the inline boundary (text | widget | text) or at any mark boundary `domFromPos` returns an element position (`{node: <p>, offset}`), so `charRect` returns `null` and no nudge happens. Remaining scenarios: (a) Up from page N+1's first line with the caret column past the end of page N's last line: `posAtCoords` returns the boundary, nothing nudges, the caret is drawn back at the top of page N+1 (Up appears to do nothing); (b) Down landing at a line end where the wrap coincides with a mark boundary (bold ends at the line end): drawn one line lower. Neither is exercised by the tests (`after = pos + 2` keeps the column near the left edge). Fix: in `charRect`, when `node` is an element take `node.childNodes[offset]` (for `start`) / `node.childNodes[offset - 1]` (for `end`), skipping non-text children, and read the first/last character of that text node; or, simpler, treat `pos` equal to an inline boundary position in plugin state as "wrap" and nudge when `up`. The End-key case is now documented as a limitation; acceptable. |
| 3 | Native smoke accepted either reading | **Fixed.** Pass rule is `drawn` (WebKit's bounding rect of the live DOM selection). The diagnostics settle the question I could not: `block up` still reads `tops [292, 268]` but `drawn 292` = page 1's last line, so WebKit draws the downstream line and the earlier failures were a reading error, not a line skip. All six flags true for inline and block in both p2 runs. Note the `extend` rows read `drawn` from a non-collapsed range (its top is the anchor's line), which is why they are not gated on it; fine. |
| 4 | Down ignored the next block's margin-top | **Fixed.** `below` is the next sibling's rect top for block spacers. |
| 5 | `TextSelection.create` outside inline content | **Fixed.** `Selection.near($pos)` for the plain move; Shift extends only when `$pos.parent.inlineContent`, otherwise collapses via `Selection.near` (acceptable; the browser default would also have been fine). |
| 6 | design-system.md stale paragraph | **Fixed.** Replaced with the Q018 decision and the shared-position note; limitations.md carries the same. |
| 7 | `firstCharBelow` text inside atoms | **Fixed.** Text under a `contenteditable="false"` element inside the paragraph is skipped. The guard reads oddly (`closest(...) !== null && el.contains(closest(...))`) but is correct: text nodes from a tree walker always have a parent element. |
| 8 | `keepLines` doc comment | **Fixed.** |

### New defects introduced by the fixes
- **A. nit -- fail-first margin for the mark regression is 4 px.** `pw-doctored2.log` fails at 104.4 px against `< 100`. A font or fixture change could let a build without the widening pass by accident. Bold a longer range (the whole last two lines) or assert the line's right edge moved back to within a few px of where it was before the bold, rather than a fixed 100 px.
- **B. nit -- `Selection.near($pos)` in the non-Shift path uses bias 1.** When the nudged `pos` sits before an inline atom (footnote reference), `near` with bias 1 lands after the atom; harmless but worth `up ? -1 : 1` for symmetry with `clickSpacer`.
- No new data-safety, history or measurement risk: the only measurement change is the atom skip in `firstCharBelow`; `apply` still sets no history meta and spacers remain decorations.

### Final verdict: SHIP WITH FIXES (one small one)
Findings 1 and 3 to 8 are fixed and the native drawn-caret evidence now supports the WebKit claim for the tested moves. Finding 2 is partly fixed; the remaining gap is a one-function change in `charRect` (handle element positions at node boundaries). Status stays CLAIMED until the owner uses it; the full check run in `full2.log` had passed tsc and unit only at the time of writing, so Playwright, cargo and the release build for this revision are not yet confirmed here.

## Re-check 2 (2026-10-28 17:15)

Read: current `charRect` and `arrowAcrossGap` in `src/editor/pagination.ts` (lines 552-600), the new "End then ArrowUp" step in `tests/pages.spec.ts` (line 344) and `upFromEnd` in `tests/native-smoke.js` (lines 341-385), the mark regression now bolding 150 characters (`pages.spec.ts:429`), `ui3-p2/native-gate-results.json` (latest), `ui3-wordsplit/full3.log` (only tsc 0 at the time of writing). `npx vitest run src/editor/pagination.test.ts`: 18 passed.

**Finding 2 -- Fixed.** `charRect` now asks `domAtPos(pos, 1)` and, at an element position, walks to the first text node after it inside the textblock: at the spacer boundary `childNodes[offset]` is the text after the widget; at a mark boundary the walker descends into the mark element; text under `contenteditable="false"` is skipped; a text node at its end falls through to the next text node; the `node !== block` branch correctly skips the element's own descendants. The caller's guards (`inlineContent`, `pos > start`, `pos < end`) keep `pos - 1` inside the block. `Selection.near($pos, up ? -1 : 1)` closes nit B. The native run exercises the case I raised: `upFromEnd` (lineboundary, then ArrowUp from page 2's first line) lands drawn 295 = page 1's last line for the inline gap and drawn 292 for the block gap, both runs, all flags true. The Chromium step is honestly described as not able to show the bug; the native check is the one that proves it.

**charRect, new defects:** none that break behaviour. Two observations:
- The inline `upFromEnd` result is `from 3862` with the boundary at 3864 and the margin-click target at 3863. If 3863 is the position after the line's final space, 3862 sits before that space, i.e. after the last word, which is right; if 3863 is instead before the final letter, the caret is one letter inside the word. Not established from here; worth one glance in the app (End on page 2's first line, Up, type a letter: it should land after the last word of page 1's last line).
- `charRect` builds a TreeWalker per call; it runs at most twice per arrow press next to a gap. No performance concern.

**Mark regression:** the bolded range is now 150 characters, so the fail-first margin should be well clear of the 100 px threshold (not re-run here; nit A is addressed on paper).

### Final verdict: SHIP
All eight findings and both nits are fixed or addressed; the native drawn-caret evidence covers down, up, up-from-end, shift-extend, gap click and margin click for both gap kinds. Status stays CLAIMED until the owner has used it, and `full3.log` had only passed tsc when this was written, so Playwright, cargo and the release build for this final revision are not confirmed in this review.
