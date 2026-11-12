# Review: blank-page click fixes (wave 9, 2026-11-11)

Reviewer: independent read-only review (Claude Opus), 2026-11-11. No code changed, nothing built, nothing native or on screen run.
Subject: `src/editor/blankClick.ts` (45 lines, read whole) and `src/editor/blankClick.test.ts`, as they stand now
(current file is byte-identical to `node_modules/.cache/personal-word-beta/w9-n/blankClick.ts.fix2`).
Status of everything below: CLAIMED, never VERIFIED. Nothing here has been confirmed by the owner in the real app.

## Verdict

**Approve the two fixes, with should-fix follow-ups.** No blocker.

- The reported symptom (150 percent, A4, a click in the left margin beside line 2 put the caret at the end of the
  document) is shown fixed in the native WebKit app, using synthetic clicks. The before-and-after logs are real:
  - old handler: wrong;
  - fix 1 only: lands between paragraphs 2 and 3 (position 53);
  - both fixes: correct.
- The per-case diagnostics in `blank-fix2.log` back up the diagnosis. At every zoom other than 1, ProseMirror's own
  `posAtCoords` answers "after the block" (53/53/95/73), while `caretRangeFromPoint` gives the right answer
  (27/52/94/72).
- Chromium at any zoom, and WebKit at zoom 1, follow exactly the old code path (reasoning below).
- The should-fix items are mostly older gaps in the same handler that today's work did not create. Two are the same
  WebKit zoom defect in other features (table right-click menu, clicks in a page gap). One is a missing unit test that
  would pin "unchanged outside zoom".

## How I checked

- Read `blankClick.ts`, its test, `components/floating.ts`, `caretScroll.ts`, the wiring in `Writer.tsx`
  (`onMouseDown` on `.editor-viewport`, line 2080), `FootnoteArea.tsx`, `SideRuler.tsx` (root class `side-ruler`,
  confirmed), `pagination.ts` 520-640, and ProseMirror 1.42.6 `posAtCoords`/`posFromCaret`/`posAtDOM`
  (`node_modules/prosemirror-view/dist/index.js` 151-168, 405-525, 5846).
- Read `tests/native-smoke.js` 939-1143 (the `w9-blank-click` phase), NATIVE.md, the VALIDATION.md section, and parsed
  `blank-fix2.log` case by case.
- Ran `npx vitest run src/editor/blankClick.test.ts`: 17 passed. Ran `npx tsc -b`: exit 0 (Node 22.23.3 from the
  pinned tools folder).
- Ran one throwaway `node -e` with `prosemirror-model`/`prosemirror-state` (finding S1): a `TextSelection` created at
  a between-blocks position prints "TextSelection endpoint not pointing into a node with inline content". That is the
  mechanism only.
  - StarterKit 3.32.0 (used in `src/editor/extensions.ts:96`) adds TrailingNode by default, so the document normally
    ends in a paragraph. The below-the-text half of S1 is therefore probably unreachable.
- Vitest runs in its default node environment (no `environment` set in `vitest.config.ts`).
- Did not run Playwright, the native app or any mutation run. Statements marked "inferred" come from reading code, not
  from running it.

## Point 1: the handler, line by line (`src/editor/blankClick.ts`)

- **Line 8, plain left click only.** Middle/right button, Control, Command and Option are ignored. Unchanged.
- **Line 11, clicks inside the editor.** Any target inside `view.dom` (text, footnote markers, page spacers,
  images) goes back to ProseMirror. Unchanged, so clicks inside text are left alone.
- **Lines 12-17, the ignore list.** Rulers, spacer, footnote marker, `button`, `a`, form fields and sliders are
  ignored. The **page footnote rows are not covered**: `.footnote-body` is a `div role="button"`, and
  `.footnote-number`, `.footnote-rule` and the row padding match nothing. See S2.
- **Line 21, the zoom factor.** `scale` is the total zoom only when `reportsUnzoomedRects()` is true (native WebKit).
  Chromium always gets 1. WebKit at total zoom 1 also gets 1.
- **Line 29, when the new path runs.** `caretRangeFromPoint` is used only when `!belowText && scale !== 1`. That
  means only native WebKit with a total zoom other than 1. Toolbar 125/150 counts, and so does a fit-to-pane scale
  below 1 at toolbar 100, for example in a narrow window or split view.
  - With `scale === 1`, `caret` is `null`, `fromCaret` is -1, and the code runs the same `posAtCoords` line as
    before. The diff against `blankClick.ts.orig` confirms this. So **Chromium and WebKit at zoom 1 behave exactly as
    before**: correct.
- **Lines 24-26, below-the-text test and clamp.** Rects times `scale` against drawn `clientX/clientY` is the same
  rule as `drawnEdges`/`drawnSpan`. The native calibration (`elementFromPoint` at the computed line-2 point hits
  paragraph 2 at every zoom) supports that drawn = rect x zoom.
  - The clamp is 1 drawn px inside the text column. That is fine for `caretRangeFromPoint`, which takes drawn px.
- **Line 30, turning the hit into a document position.**
  - `view.dom.contains(startContainer)` guards against a range outside the editor (footnote rows, the paper). That
    case falls back to `posAtCoords`.
  - `posAtDOM` has no throwing path for a node inside `view.dom`. `docView.posFromDOM` returns a number, and -1 is
    already handled by `>= 0`.
  - A `null` range (`?.`) also falls back.
  - An empty paragraph returns `(p, 0)` natively and maps correctly (line-4 case, position 72).
- **Where it can still go wrong (S1):**
  - If WebKit returns the editor root itself, or a spot beside a block widget/leaf (the page spacer between pages, an
    image, a rule, a table edge), `posAtDOM` gives a position *between blocks*.
  - The fallback `posAtCoords` under zoom gives the same "after the block" answer (that is fix 1's measured 53).
  - Line 33 (below the text) uses `doc.content.size - 1`. That would not be inside text if the document ended in a
    list or table, but StarterKit's default TrailingNode keeps a paragraph last, so this is probably unreachable.
  - Lines 37-39 then build a `TextSelection` at that invalid spot. This was already true before today, in every
    engine.
- **Footnote marker inside a line** (`[data-footnote-id]`, an atom): if the range lands inside the marker,
  `posAtDOM` (default bias -1) resolves before it. ProseMirror's zoom-1 rule picks the nearer side instead.
  Harmless; note only.
- **Wrapped lines** (not tested): a right-margin click beside the first line of a wrapped paragraph gets the offset
  at the wrap point. ProseMirror draws that offset at the *start of the next line*, so the caret may look one line
  low. The same is likely true of the zoom-1 path. Note only, inferred.
- **Lines 37-39, Shift+click.** Extends from the existing anchor in both paths. Unchanged and untested under zoom.
- **Lines 41-43.** Dispatch with `scrollIntoView` (under zoom it goes through `handleCaretScroll`, already
  zoom-aware), then `preventDefault` and `focus`. Unchanged.

## Point 2: is the native check honest?

**What it gets right**

- The click points are computed in drawn px (rect x zoom). They are checked independently with `elementFromPoint`
  before use.
- Each case expects an exact position: start of line 2, end of line 2, end of the document, inside empty line 4. A
  caret one line off (paragraph 1 or 3), or between blocks (53), fails. The fix-1-only log shows exactly that.
- The fail-first is real: `blank-doctored2.log` with `scale` forced to 1 reproduces "end of document" at true 1.5.
- It also asserts `defaultPrevented`, so the handler actually ran.

**Where it is weaker than it reads**

- The click points use the same "rect x zoom" assumption as the handler. Only the calibration hit-test guards that
  assumption.
- "24/24" overstates the spread. `sidebar-125` and `sidebar-150` are the same zoom (1.1818), and both "100" layouts
  are zoom 1. So there are 4 distinct zooms (1, 1.18, 1.25, 1.5), and the zoom-1 cases do not touch the new path.
- It never checks `view.hasFocus()` or the DOM selection, and it never types. The owner's symptom was typing at the
  end of the document, so that is not tested.

**Synthetic click compared with a physical click**

- Both go through React's delegated `onMouseDown` on the viewport. The target is outside `view.dom` either way, so
  ProseMirror's own mousedown handler (`MouseDown` class) runs in neither.
- What a synthetic click leaves out:
  - the preceding `pointerdown` (no relevant listeners on the paper);
  - the browser's real default action (prevented anyway);
  - `isTrusted` (nothing checks it);
  - the real `click` (the viewport `onClick` only looks for footnote ids);
  - multi-click `detail` (a double or triple click in the margin is not handled specially).
- Equivalence is inferred, not shown.

**Not covered:** long wrapped lines; a second page, and clicks beside a page gap; scrolled documents; zoom below 1
(75 percent, or a fit-scale in a narrow or split pane); split view; continuous view under zoom; shift+click under zoom;
lists, tables, images or a document ending in a non-text block; clicks on page footnote rows; typing after the click;
physical mouse or trackpad.

## Point 3: do the unit tests pin the behaviour?

- 17/17 pass and `tsc -b` is clean. The fail-first for the new test is CLAIMED (NATIVE.md), not re-run here.
- Test "compares the click with drawn rects" fails if fix 1 is removed: unscaled, `225 > 190` sends the click down
  the below-the-text branch and `posAtCoords` is never called. **Pins fix 1.**
- Test "under zoom takes the position from caretRangeFromPoint" fails if fix 2 is removed (`posAtCoords` would be
  called). **Pins fix 2.**
- These changes would still pass every test (by reading, not run):
  - `scale !== 1` changed to `true`. Nothing proves that Chromium and zoom 1 skip `caretRangeFromPoint`. See S3.
  - Dropping `!belowText` from line 29.
  - Dropping the `view.dom.contains` guard.
  - Ignoring `startOffset` (the test uses 0).
  - Breaking Shift+click.
- The mocked `doc.resolve` always reports inline content, which hides S1.
- The tests use `vi.doMock`/`vi.doUnmock`. If an assertion fails before `doUnmock`, the mock can leak into later
  tests. Minor.

## Point 4: other places that mix pointer coordinates with WebKit's zoomed rects

### `src/Writer.tsx:687`: right-click table menu

- **Feature:** right-clicking a table cell opens the app's table menu (insert/delete row or column and so on).
- **Same space?** No.
  - `clientX/clientY` are drawn px.
  - Inside `posAtCoords`, `caretRangeFromPoint` and `elementFromPoint` find the right cell.
  - `posFromCaret` then compares each block's unzoomed rect with the drawn point. That is the same defect measured
    for the blank click. It walks up the paragraph, the cell and the table, and returns "after" the outermost block
    the point seems to be outside of: after the cell, or after the whole table.
  - `cellAround` (prosemirror-tables) on that position returns `null`, so the handler returns `false`.
- **What the user would see at 125/150 percent:** right-clicking a table cell does **not** open the table menu; the
  default WebKit menu or nothing appears instead.
- **How likely:** high for almost any table not at the very top of the window. The cell's drawn top only has to
  exceed about its own height / (zoom - 1), for example 60 px for a 30 px cell at 150 percent. Inferred, not measured.
- The fallback `posAtDOM(cell, 0)` only runs when `posAtCoords` returns `null`, not when it returns a wrong answer.
- **Should-fix S4** (cheap: the clicked `cell` is already known).

### `src/editor/pagination.ts:615`: Up/Down arrow across a page gap (`arrowAcrossGap`)

- **Feature:** in page view, Up from the first line of a page goes to the last line of the previous page, and Down
  does the reverse. This works around WebKit skipping a line.
- **Same space?** No, but mixed the other way round.
  - `caret.left` (from `coordsAtPos`) and `y` (from spacer and sibling rects) are all WebKit's *unzoomed* values.
    They agree with each other, so the "is the caret next to a gap?" test is fine.
  - They are then passed to `posAtCoords`, which starts with `caretRangeFromPoint`/`elementFromPoint`. Those want
    *drawn* px, so they hit a point up and to the left of the intended one (scaled by 1/zoom toward the window's
    top-left corner).
  - The result depends on what sits at that wrong point:
    - another line of text: the caret lands on the wrong paragraph, or between blocks and is then nudged by
      `Selection.near`;
    - the toolbar or sidebar: `posFromCaret` returns `null` and the pure-rect fallback happens to be right.
- **What the user would see at 125/150 percent:** pressing Up or Down at a page break jumps the caret to a wrong line
  (often several lines or paragraphs away) instead of the line just across the gap. Sometimes it works, by luck.
- **How likely:** medium to high whenever the caret crosses a page gap at a zoom other than 1. Inferred.
  - No native probe presses arrows at zoom other than 1. The `pages-zoom` phase's arrow cases run at the default
    zoom.
  - VALIDATION.md "Still needs a human" row 2 (real Up/Down at 75/100/150 percent) is open.
- **Should-fix S5.**

### Others found by grep (`posAtCoords`, `coordsAtPos`, `caretRangeFromPoint`, `elementFromPoint`, `getBoundingClientRect` against pointer coordinates in `src`)

- **`src/editor/pagination.ts:532-535`, `clickSpacer` (AT RISK, should-fix S6).**
  `local = (event.clientY - rect.top) * (height / rect.height)` mixes drawn `clientY` with WebKit's unzoomed
  `rect.top`.
  - Under WebKit zoom above 1, `local` comes out far too large, so a click in the white space at the bottom of a
    page (inside the text column, below that page's last line) always goes to the *next page's first line* instead
    of the end of the clicked page.
  - Chromium is right, because there the ratio converts drawn px to CSS px.
  - Inferred; likely, because clicking under the last line of a page is a common action.
- **`src/Writer.tsx:728`, keyboard-opened table menu (Context Menu key or Shift+F10). Low risk, note N1.**
  `coordsAtPos` (unzoomed inside the paper) minus the `.writer` rect (outside the zoom, so drawn). At 150 percent the
  menu opens noticeably above and to the left of the cell. It still opens and works.
- **Not at risk:**
  - `Writer.tsx:440` (focus-mode toolbar reveal): the host is outside the zoom.
  - `Writer.tsx:578-593` (ruler drags): deltas divided by `drag.scale` = layout zoom x fitScale, which is correct in
    both engines.
  - `caretScroll.ts:76`: already zoom-aware.
  - `useDragReorder`, `SplitDivider`, `ProjectSidebar`, `scrollspy`, `dock`: outside the zoomed page.
  - No other `caretRangeFromPoint`/`elementFromPoint` in `src`.
- **Outside `src`, same root cause, note N2.** ProseMirror's `posAtCoords` is also used, with drawn pointer
  coordinates, by:
  - drag-and-drop of text (drop position, drop cursor);
  - prosemirror-tables' `cellUnderMouse` (dragging across cells to select several).

  Under WebKit zoom other than 1 these may drop text at a block boundary, or fail to start a cell selection.
  Inferred, not checked. Plain clicks inside text are not affected: WebKit places that caret itself.

## Point 5: what the changes could break (Chromium spec `tests/w9-blank-click.spec.ts`)

Read, not run.
- The spec runs in Chromium at zoom 1. There `reportsUnzoomedRects()` is false and `scale` is 1, so line 29 never
  calls `caretRangeFromPoint` and the code path is the same as before.
- So its expectations are unaffected by construction:
  - below the last paragraph: end of the document, then typing appends;
  - left and right margin: start and end of paragraph two;
  - shift+click extends;
  - a click inside text stays with ProseMirror.
- It does not test zoom or WebKit, so it cannot show the new branch working.
- Nothing else calls `blankPageClick` (only `Writer.tsx:2081`).

## Findings, ranked

### Blockers

None.

### Should-fix

**S1. Caret can be placed at an invalid "between blocks" spot.** `src/editor/blankClick.ts:31-39`. Older than today's
fixes, all engines. Inferred from reading; the mechanism is shown by `node -e`, but no app document was tried.
- It can happen when the hit lands beside a block widget or leaf:
  - the page spacer, when clicking the margin beside a page gap;
  - an image, a rule, or a table edge.
- It also happens whenever the zoom fallback `posAtCoords` runs (that fallback measured 53, between blocks).
- Effect: ProseMirror warns, and typing can go somewhere odd (inferred).

Work order:
1. In `src/editor/blankClick.ts`, change line 3 to
   `import { Selection, TextSelection } from "@tiptap/pm/state";`
2. Replace lines 37-39 with:
   ```ts
   // A position between blocks (a list, table or image at the end, a page-gap widget) is moved to the nearest text.
   const $pos = view.state.doc.resolve(pos);
   const head = $pos.parent.inlineContent
     ? pos
     : (Selection.findFrom($pos, -1, true) ?? Selection.findFrom($pos, 1, true))?.head ?? pos;
   const selection = event.shiftKey
     ? TextSelection.create(view.state.doc, view.state.selection.anchor, head)
     : TextSelection.create(view.state.doc, head);
   ```
3. In `src/editor/blankClick.test.ts`, add one test inside the "under WebKit's unzoomed rects" describe block.
   - Set it up the same way as the existing zoom tests: `vi.resetModules()`, `vi.doMock("../components/floating", ...)`,
     then a dynamic import. The suite runs in node, so the real `reportsUnzoomedRects()` would touch `document`.
   - Use a **real** document: `getSchema(documentExtensions())` from `@tiptap/core`, the same as
     `src/betaDurability.test.ts:2,24`. Build two paragraphs, "one" and "two".
   - Mock `caretRangeFromPoint` and make `posAtDOM` return 5, the position between the two paragraphs.
   - Give the view mock a real `state` (`EditorState.create({ doc })`) and a `dispatch` that records the transaction.
   - Assert that the dispatched selection's `$head.parent.type.name === "paragraph"`, and that `head` is 4 (end of
     "one", from `findFrom(-1)`).
4. Prove it: run the new test against the old lines 37-39 first and see it fail (head 5, parent `doc`), then apply the
   change and run
   `export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"; npx vitest run src/editor/blankClick.test.ts && npx tsc -b`.

**S2. Clicks on a page footnote row move the main caret, and may scroll away.** `src/editor/blankClick.ts:14`.
- In page view, `.page-footnotes` rows sit inside the paper but outside `view.dom`. A mousedown on the note text
  (`div.footnote-body role="button"`), the number or the rule runs the blank-click handler, which moves the document
  caret, scrolls, and steals focus before the note's own click opens its editor.
- Under WebKit zoom, `caretRangeFromPoint` lands in the note (outside the editor), so the fallback `posAtCoords` runs.
  It can return `null`, which means the end of the document plus a scroll to it. That is the original symptom, on the
  way to editing a footnote (inferred).

Work order:
1. Line 14: add `.page-footnotes, .footnote-area, [role='button']` to the selector string, so it reads
   `".document-ruler, .side-ruler, .page-spacer, [data-footnote-id], .page-footnotes, .footnote-area, button, [role='button'], a, input, textarea, select, [role='slider']"`.
2. Add `["page footnotes", ".page-footnotes"]` and `["role button", "[role='button']"]` rows to the `it.each` table at
   `src/editor/blankClick.test.ts:40-51`.
3. Prove it with the same vitest command (the new rows fail before step 1).

**S3. No test pins "unchanged outside WebKit zoom".** `src/editor/blankClick.test.ts`.

Work order: add a test that copies the second zoom test (lines 95-126) but mocks
`reportsUnzoomedRects: () => false, totalZoom: () => 1.5` (that is Chromium) and clicks at `clientX: 120, clientY: 150`.
That point is inside the unscaled column (100..500 x 100..200) and above the last child's bottom (190). Assert:
- `caretRangeFromPoint` was **not** called;
- `posAtCoords` was called with `{ left: 120, top: 150 }`.

Add a second copy with `reportsUnzoomedRects: () => true, totalZoom: () => 1` (WebKit at 100 percent) and the same two
assertions.

Prove it: temporarily change line 29's `scale !== 1` to `true` and see the new test fail; restore; run the vitest
command.

**S4. Right-click table menu likely does not open at zoom other than 1 in the Mac app.** `src/Writer.tsx:687-693`.

Work order:
1. Replace lines 687-691 with:
   ```ts
   let position = view.posAtCoords({ left: mouse.clientX, top: mouse.clientY })?.pos;
   // Native WebKit under zoom: posAtCoords can answer "after the table"; the clicked cell is known.
   if (position == null || !cellAround(view.state.doc.resolve(position))) position = view.posAtDOM(cell, 0);
   ```
   Lines 692-693 stay as they are.
2. This is engine-neutral. Where `posAtCoords` already gives a cell, nothing changes.
This change only adds a fallback, so it is safe to apply before the native reproduction.
3. Prove it: the existing table context-menu Playwright spec must still pass (`npx playwright test` on the spec that
   right-clicks a table cell; find it with `grep -rln "Table actions\|contextmenu" tests/*.spec.ts`).
4. Native: in the smoke build, page view at 150 percent with a 3x3 table placed below a few paragraphs, dispatch
   `contextmenu` on a middle cell, and expect the table menu (`[role="menu"]`) to appear. A human right-click at
   150 percent is the real proof.

**S5. Up/Down across a page gap under WebKit zoom.** `src/editor/pagination.ts:601-626`.

Work order. **Gate:** first reproduce the fault natively (step 4 with the current code). If it does not reproduce, do
not change the code; record the result instead.
1. In `pagination.ts`, import `reportsUnzoomedRects, totalZoom` from `"../components/floating"`.
2. Inside `arrowAcrossGap`, before line 615, compute
   `const s = reportsUnzoomedRects() ? totalZoom(view.dom) : 1;`
3. Replace line 615 with a lookup in drawn px:
   ```ts
   const range = s !== 1 ? view.dom.ownerDocument.caretRangeFromPoint?.(caret.left * s, y * s) : null;
   const found = range && view.dom.contains(range.startContainer)
     ? { pos: view.posAtDOM(range.startContainer, range.startOffset) }
     : view.posAtCoords({ left: caret.left, top: y });
   ```
   Keep lines 616-634. `charRect` and `y` are both unzoomed, so the comparison at line 625 stays consistent.
4. Reproduce, then prove: native smoke build, page view at 150 percent, the `pages-zoom` document. Put the caret on page 2's first
   line, dispatch `keydown` ArrowUp the way `tests/native-smoke.js:287-291` does, and expect the head on page 1's last
   line. Do it fail-first with `s` forced to 1. A human pressing real arrows at 150 percent (VALIDATION row 2) is the
   real proof.

**S6. Click in a page gap's white space goes to the wrong page under WebKit zoom.** `src/editor/pagination.ts:532-534`.

Work order. **Gate:** first reproduce natively (step 4 with the current code). Only then change the code. The Chromium
spec only shows that nothing regressed; it cannot prove this fix.
1. With the same import as S5, replace line 534 with
   `const s = reportsUnzoomedRects() ? totalZoom(spacer) : 1;`
   `const local = (event.clientY - rect.top * s) * (height / (rect.height * s || height));`
2. Chromium is unchanged (`s` is 1).
3. Prove it: the existing Chromium page-gap click spec still passes (`grep -rln "page-spacer" tests/*.spec.ts`).
4. Native: at 150 percent, click inside the column just below page 1's last line and expect the caret at the end of
   page 1. Do it fail-first with `s` forced to 1.

### Notes

- **N1.** `Writer.tsx:728`: the keyboard-opened table menu is placed in mixed spaces under WebKit zoom (offset up and
  left). Fix it the same way: multiply `coords` by `totalZoom(view.dom)` when `reportsUnzoomedRects()`.
- **N2.** ProseMirror/prosemirror-tables internals (drop position, drop cursor, cell drag-selection) use `posAtCoords`
  with drawn pointer coordinates and probably share the defect under WebKit zoom. Not checked.
- **N3.** The native check counts 24 cases but covers only 4 distinct zooms (the two "sidebar" 125/150 runs are both
  1.18). It reads the selection only: no focus check, no typing.
- **N4.** Wrapped lines: a right-margin click beside a wrapped line may show the caret at the start of the next line
  (wrap-point position). Inferred; worth one human look.
- **N5.** The new code uses only `caretRangeFromPoint`. ProseMirror prefers `caretPositionFromPoint` when present.
  WebKit has `caretRangeFromPoint`, and if it ever went away the code falls back to the broken-under-zoom
  `posAtCoords`, silently. Acceptable.
- **N6.** A margin click beside a page footnote block: if the block paints over the text column, the clamped point
  lands on the note. The handler then falls back to the `posAtCoords` path, which is broken under zoom. A click in
  the top margin above line 1 is also untested. Both inferred.

## What a human must still confirm in the real app

Use the release `Personal Word.app` that contains both fixes, on the owner's real project.

1. **The reported bug.** Page view, A4, 2-inch margins, 150 percent. Click in the left margin beside line two: the
   caret blinks at the start of line two. **Type a word: it appears there.** Repeat for the right margin (end of line
   two) and below the last line (end of the document).
2. **The same at 125 percent and 100 percent**, and once with the window narrow enough that the page shrinks to fit
   (a zoom below 1).
3. **A long paragraph that wraps.** Click in the left and right margins beside its second visual line; note which
   line the caret shows on.
4. **Page 2, and the gap between pages.**
   - Click the margin beside a line on page 2.
   - Click the white space just below the last line of page 1, inside the text column: does the caret stay on page 1
     (S6)?
   - Press Up from page 2's first line and Down from page 1's last line at 150 percent (S5).
5. **Shift+click in the margin** at 150 percent extends the selection from where the caret was.
6. **Split view and continuous view** at 150 percent: one margin click each.
7. **Right-click a table cell** at 100 and 150 percent: does the table menu open (S4)?
8. **Click a footnote's text** at the bottom of a page at 150 percent: the note opens for editing without the
   document jumping (S2). Also click the margin beside a footnote block, and the top margin above line 1.
