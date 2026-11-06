# Independent review of the three CI failures (run 42091100976)

Reading only, under a 10 minute cap. I ran no Playwright, no build, no native test and did not take the serial lock.
I read the uncommitted `git diff`, the source, node_modules sources, and the three CI artifacts. Everything below is
CLAIMED at most. The new test's "failed on the old build" result is the author's report; I did not repeat it.

## Verdicts

| Claim | Verdict | Blocking? |
|---|---|---|
| 1. footnotes:134 is a real app bug, fixed by synchronous focus | Diagnosis supported. Fix right, but it drops one behaviour (D1) | No, D1 should be fixed before commit |
| 2. ci-indent:186 is a test-speed issue | Confirmed. Not hiding a meaningful bug | No |
| 3. pages-gap:295 is a test race | Supported by numbers and code; not proven. The poll cannot hide a stuck selection | No |

## Claim 1: footnotes.spec.ts:134

**The symptom is real.** CI's `error-context.md` shows the inline field gone, `button "a"` in the Footnotes region, and
in the document `Evidence here.`, marker `1`, then `text: b`. Note text `a`, document text `b`.

**How the field closes.** `src/editor/FootnoteArea.tsx:148-154`: the `Footnote 1 text` textarea has `autoFocus` and
`onBlur={onDone}`, and `onDone` is `setEditingNote(null)` (`src/Writer.tsx:2146`). So any focus theft closes it, and the
next key lands in the editor. Note this is the inline field, not the panel's `Footnote text` field that `setPendingFocus`
targets (`src/research/ResearchPanel.tsx:130-138`).

**The thief.** `node_modules/@tiptap/core/src/commands/focus.ts`: with the editor unfocused (button just clicked),
`view.focus()` runs in `requestAnimationFrame`. The new test's reported result fits this.

**CI timing.** Click 355417-355432, field confirmed focused at 355494, `ab` typed 355499-355521. The steal landed in that
roughly 22 ms window, at least 67 ms after the click. That needs a frame delayed by several frames: plausible on a loaded
runner, but the trace has no frame or focus events, so this link is inferred.

**Open: normal order.** By my reading the click's React updates flush synchronously, which would mount the field before any
frame and make the old code fail every time, yet it passes locally. So something defers the mount past the frame, and I
did not find what. `tests/footnotes.spec.ts:108-109` already notes that this depends on effect ordering. The fix removes the
race either way.

### What the fix keeps and loses

| Thing chain().focus() gave | After the fix |
|---|---|
| Selection restored | Kept. `view.focus()` calls `selectionToDOM` (prosemirror-view `index.js:5754-5760`), and it runs now rather than later |
| Insert at remembered caret, or stale selection from a panel field | Unchanged. Both versions insert at `state.selection`, which blur does not change. The old insert also ran before focus |
| Stored marks | No difference: no selection is set now, and the node insert behaves the same |
| Safari/WebKit preventScroll | Kept. `focusPreventScroll` (`index.js:307`) passes `preventScroll: true`. Tiptap's Safari branch was already focusing synchronously, then still ran the frame's `view.focus()`, so by reading the native app had the same bug. Not run in WebKit |
| "Focus asynchronously in React" (tiptap issue 1520 comment) | No sign of a problem: this runs in a click handler, and `Writer.tsx:1529` already does the same |
| **Scroll into view** | **Lost. See D1** |

### Defects

**D1 (should fix, not blocking, regression): caret no longer scrolled into view.** `src/App.tsx:1596-1597`. The old frame
callback also ran `editor.commands.scrollIntoView()` (default on, `focus.ts`). `view.focus()` prevents scrolling and
`insertContentAt.ts` does not scroll. So: scroll away from the caret, then press Cite here (panel or card). The marker goes
in off screen and the document no longer moves. Text-only notes are partly covered because the browser scrolls to the
autofocused field, but cited notes open no field in the document. Likely one-line repair, untested:
`editor.chain().insertContent({...}).scrollIntoView().run()` after `view.focus()`. It keeps Writer's
`handleScrollToSelection` (`Writer.tsx:660`). No test I read covers this.

**D2 (minor, wording): `src/research/CitationCard.tsx:77`.** The new comment is true, but it no longer says why a frame is
waited, and target `"page"` is also used when the card opens on a footnote (`CitationCard.tsx:52,60`), not only after Cite
here. Tiptap's frame is gone from this path, so the old wording was right to go.

### Callers

- **ResearchPanel `insertTextOnly` (`:167-170`):** this is the failing path. Fixed.
- **ResearchPanel `citeHere` (`:162-165`):** `setPendingFocus` focuses the panel's `Footnote text`, and the editor can no
  longer take it back. Focus now reliably ends in that panel field, so keys typed after Cite here go to the note, never the
  document. If the normal-frame order above holds, that is what already happened on normal frames. I could not tell from
  reading alone. No test asserts it either way; the ones after Cite here use `fill` or clicks. Worth a look by the user.
- **CitationCard `citeHere` (`:97-104`):** fine. Editor focus is now synchronous and the Page field wins a frame later. The
  old order relied on Tiptap's frame being queued first. `floating.spec.ts:634,883` assert the Page field. A key typed
  in that frame still goes to the document, as it did before.
- `src/research` has no `onBlur` or `focusout` logic that the earlier blur could disturb (only tooltip toggles at
  `ResearchPanel.tsx:498-499,550-551`).

### The new test

Fair for the mechanism. Patching `window.requestAnimationFrame` catches Tiptap's bare call, the 300 ms delay lands inside the
600 ms of typing, and it checks both the note value and the document text. Any other frame-delayed focus thief would fail it too.

Its limit: it proves a delayed frame produces the CI symptom, not that a delayed frame is what happened on CI (the symptom
matches exactly; the delay is inferred). It does not cover scrolling (D1) or the cited paths.

### Other chain().focus() followed by focus moving elsewhere (not fixed)

Same race, only if the insert opens the inline field while the editor is unfocused. All inferred, all narrow:
- `src/App.tsx:1218-1222` fragment insert, if the fragment holds a new, empty, text-only note whose record exists.
- `src/Writer.tsx:1236` and `:1248` toolbar undo and redo, if they bring back a marker with an empty text-only record and the
  editor had lost focus.

Checked and not affected:
- `App.tsx:1668` (a cited insert opens no field; a plain note has no footnote).
- `Writer.tsx:817` and `:522`, `:2011`, `App.tsx:241`, `Writer.tsx:1401` (the editor is meant to end with focus).
- `Writer.tsx:1524-1529` (already synchronous, but its chain's frame still fires; harmless, same target).
- `closePanel` (`Writer.tsx:1088`), called only from Escape paths, with no chain focus.

General hazard, not listed call by call: after any unfocused `chain().focus()`, a click or Tab within the frame gets pulled
back to the editor.

## Claim 2: ci-indent.spec.ts:186

Confirmed.
- **Code:** `prosemirror-view/dist/index.js:4879`. The condition needs no DOM change, focus within 200 ms, no click within
  300 ms, a collapsed selection, and a caret at the document start. It then writes the state's selection back.
- **Trace:** last Tab 78307-78312, `type` 78333-78443, Home 78449-78452. That is 137-145 ms from focus to Home. The claim
  said about 129 ms; my reading of the same trace is a little longer, and still under 200. Typing 27 characters in 110 ms
  is what makes it possible.
- **Final state:** state offset 27, DOM offset 27. That fits the write-back, but alone it also fits a lost key.
- **Stronger evidence:** `REVIEW-T238-r2.md:81`, real spec x30: tree 4 failed, heuristic disabled 0 failed. Local, not CI.

The 250 ms wait is deterministic: it starts after typing, so Home is always over 200 ms past focus. The comment is accurate.
Pointer tests at `:70` and `:117` are safe: the click and focus happen together, so the 300 ms and 200 ms conditions can never
both hold. The other `press("Home")` callers I read (ruler, appearance, research) are on a slider, a button group, or just
after an editor click.

**Real bug for a person?** No meaningful one. It needs Tab or a programmatic focus, then a key that lands on the very start of
the document within 200 ms. Then the caret stays put, `lastFocus` is cleared, and a second press works. No text is affected.

## Claim 3: pages-gap.spec.ts:295

Supported, not proven.
- **Numbers:** `Expected >= 316, received 284`. With `nextStart` 316 and the usual 2-position boundary, `prevEnd` is 314, and
  314 - 30 = 284, the anchor. So head was the unmoved caret. The 2-position gap is inferred; `blockGap` was not logged.
- **Code:** `LeftMouseDown` sets `allowDefault = event.shiftKey` (`index.js:3430`), and `up` only sets the origin (`:3491`).
  The browser extends the selection, and ProseMirror state learns later through `selectionchange`.
- **Trace:** click action 885479-885482, evaluate at about 885485. That is about 3 ms after mouseup, which fits reading too early.
- **Not captured:** the DOM selection at failure. The old test read state only, so a stuck selection cannot be ruled out from
  the artifact.

**The poll is honest:** a selection that truly stayed unextended would still fail after 5 s, so the change cannot hide that.
The anchor is read after the poll, which is right.

**Could a real Shift+click stay unextended?** Not on this path: `src` has no Shift handling for editor clicks (`shiftKey`
grep), and `select` waits for focus, so no focus handler is pending at the click. One theoretical path this test does not
exercise: Shift+click while the editor is **unfocused**. The focus handler's 20 ms timer (`index.js:3930-3933`) writes state
back to the DOM if `selectionchange` has not arrived. Read only, never reproduced, and not a blocker.

## How far the evidence goes

Read and traced, not run. No native run, no run of my own, no CI rerun. CI going green is the real test of claims 2 and 3, and
of claim 1's flaky symptom. Claim 1's CI cause and claim 3's race are inferred from timing and code.

Not checked: every `chain().focus()` in `src/editor/TableContextMenu.tsx` and `indent.ts` (all target the editor by reading the
grep lines only), and the other failing artifacts in that folder.
