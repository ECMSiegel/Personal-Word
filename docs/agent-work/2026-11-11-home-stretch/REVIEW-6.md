# Review 6 -- T303 (HS12: toolbar buttons return focus to the editor at once)

Reviewer: agent-bb67 (Opus reviewer HS12). Code read first, then one locked browser probe (Chromium, dev, port 1449).

## Verdict
REJECT. The mouse fix is right and works, but font size +/- now breaks keyboard use: pressing Space (or Enter) on
"Increase font size" a second time types into the document and, with a selection, deletes the selected text. The brief
says keyboard activation must not change. Two popover buttons were also missed. Fixes are each a line or two.

## What is right
- Changed handlers (src/Writer.tsx): shared `iconButton` onClick `:1248-1253`; Undo `:1273-1276`; Redo `:1288-1291`;
  font size -/+ `:1426-1429`, `:1449-1452`; Remove link `:1486-1489`; indent -/+ `:1694-1697`, `:1708-1711`.
- Split view: `editor` is the Writer's own instance and the toolbar renders only for `side === focusedPane`
  (src/App.tsx:1994), so focus goes to the focused pane's editor.
- Selection, scroll, history: `view.focus()` makes no transaction and focuses with preventScroll. Probe: selection 359-361
  before and after clicking Bold, scroll position 447 before and after, one Cmd+Z removed the bold and kept the text.
- Disabled Undo/Redo fire no click; there is no read-only toolbar path.
- Keyboard for icon buttons, Undo/Redo, indent, Remove link: unchanged. Their old handlers already used Tiptap's
  `.focus()`, which moves focus to the editor one frame later (node_modules/@tiptap/core/src/commands/focus.ts:61-63;
  `changeIndent` does the same, src/editor/indent.ts:130-141). The toolbar has no roving tabindex or arrow keys: every
  button is a Tab stop, and the dock only scales on :focus-visible (src/components/dock.ts:67). Probe: Enter on Bold,
  Increase font size and Increase indent left the text "Hello", one block, and focus in the editor.
- Earlier batch edits intact: spacing popover labels without "pt" (`:1748-1783`), Insert page break in Page setup
  (`:1978-1989`), interface-font default (`:340`), Page numbers + Position rows (`:1938-1977`), HS11 focus calls
  (`:1347`, `:1366`, `:1411`).
- Fail-first is real: 7 of the 8 new cases failed before the fix with focus still on the button (notes/HS12-fail-first.txt).

## Findings
1. **high -- font size +/- keyboard regression.** src/Writer.tsx:1426-1429 and :1449-1452. `setSize` (`:1162-1166`)
   never focused the editor, so a keyboard user could press Space or Enter on "Increase font size" again and again. Now
   the first press moves focus into the text and the next press is typed there. Probe: select "Beta" in "Alpha Beta",
   focus "Increase font size", press Space three times. Press 1: text "Alpha Beta". Press 2: "Alpha  " (Beta replaced
   by a space). Press 3: "Alpha   ".
   Fix: focus the editor only for pointer clicks: `onClick={(e) => { setSize(size + 1); if (e.detail > 0) editor.view.focus(); }}`
   (same for -). Keyboard clicks have `detail === 0`. Tests: the spec's `el.focus(); el.click()` also has `detail === 0`,
   so for +/- dispatch `new MouseEvent("click", { bubbles: true, detail: 1 })` instead. Add a keyboard case: select a word,
   focus "+", press Space 3 times, text unchanged, size box +3, focus still on the button.
2. **low -- audit missed two popover buttons that close their popover.**
   - "Delete table" (src/Writer.tsx:1669-1672): `setPanel(null)` then `.chain().focus().deleteTable()`. The notes say the
     table popover was left because it "stays open", but this button closes it. Probe: focus in the same task was BUTTON.
   - "Insert page break" (src/Writer.tsx:1982-1986): `setPanel(null); editor.commands.focus(); insertPageBreak(editor)` has
     the same one-frame gap, and typing right after a page break is the usual next step. Not in the notes' list.
     (My browser probe for it timed out on the locator, so this one is from code reading only.)
   Fix: add `editor.view.focus();` after the command in both, as done for Insert table (`:1603`), and list them in HS12.md.
3. **low -- unexplained probe observation, check once.** Enter on a focused "Bullet list" button left the text check
   passing ("Hello"), but the document went from 1 top-level block to 2 and innerText became "Hello\n\n\n". Enter on Bold,
   + and indent stayed at 1 block. Unknown whether the old code did the same; one comparison run would settle it.
4. **low -- test gaps** in tests/hs11-font-focus.spec.ts:
   - the selection case (`:68-89`) checks only that "Big" is still selected, not that its size changed;
   - the Undo case (`:57-66`) asserts `toContainText("Hello")`, which holds whether or not the undo happened;
   - the Space-on-Bold case passed before the fix too, so it is a guard, not fail-first evidence.

## What I ran
- `npx tsc -b`: clean. `npx vitest run src/editor`: 12 files, 147 passed.
- Locked Playwright (dev, Chromium): tests/hs11-font-focus.spec.ts plus a throwaway probe spec: 17 passed, 1 failed (the
  page-break probe locator). All 10 hs11-font-focus cases passed. The probe spec was deleted with `rm` afterwards.
  Note: the probe file sat in tests/ from about 20:03 to 20:40 UTC; if the coordinator's full e2e run collected it, ignore
  `review6-tmp` results.

## Unverified
- Native WebKit (Tauri) focus timing for click, Enter and Space. WebKit buttons usually do not take focus on click.
- The page-break gap in the browser (code reading only).
- What caused the extra block after Enter on Bullet list (finding 3).

## Round 2 (rework by agent-7c69; reviewer agent-d20d)
Verdict: APPROVE. All four round-1 findings are resolved.

1. Font size keyboard regression: fixed. Every new `editor.view.focus()` is guarded by `e.detail > 0`: iconButton
   `src/Writer.tsx:1253`, Undo `:1276`, Redo `:1291`, size -/+ `:1429`/`:1452`, Remove link `:1489`, Delete table `:1673`,
   indent -/+ `:1698`/`:1712`, Insert page break `:1988`. Probe (the REVIEW-6 case: select "Beta", press Space three times
   on "Increase font size"): text "Alpha Beta" unchanged, size 12 -> 15, focus still on the button.
2. Keyboard behaviour is the same as before HS12. With detail 0, each handler runs exactly its old code: Tiptap's
   one-frame `.focus()` for the icon buttons, Undo/Redo, Remove link, Delete table, indent (`changeIndent`) and page break
   (`commands.focus()`), and no focus move for size -/+. The worker's per-button table in notes/HS12.md is correct.
3. Pointer clicks now focus the editor at once. Probe with real Playwright mouse clicks, typing straight afterwards:
   - Delete table: "X1" typed into the text, focus still on the editor 300 ms later.
   - Insert page break: "After" typed after the break, focus still on the editor.
   - Popover.tsx has no focus-restore on close (checked), so `setPanel(null)` does not pull focus back after React re-renders.
   - Double click on Bold: the second click has detail 2, so focus stays in the editor ("HelloZ").
   Is `e.detail > 0` a sound test for "this was a pointer"? Yes. Mouse, trackpad and touch taps give detail >= 1. A click
   started by a label (none here), by a script, or by assistive tech has detail 0, so it gets the old behaviour, which is
   safe: it is never worse than before HS12.
4. Finding 3: confirmed, not a bug. StarterKit registers TrailingNode by default (node_modules/@tiptap/starter-kit/src/starter-kit.ts:267-268;
   src/editor/extensions.ts:96 does not turn it off). A real mouse click on Bullet list also gives `bulletList,paragraph`.
   This is older than HS12 and unrelated to it.
5. Tests: the pointer cases dispatch a click with detail 1, and there are Space-three-times cases for -/+. The Undo case
   now asserts `toHaveText("Hello")` after " more" was typed. The selection case asserts the size box went up by 1. Fail-first:
   notes/HS12-rework-fail-first.txt, where 4 genuine failures turned into passes.
   Minor and not blocking: `pointerClick` calls `el.focus()` before the click. In WebKit a real click does not focus the
   button, but that only makes the test stricter than the real app.

Ran: `npx tsc -b` clean. One locked Playwright run (dev, port 1449) of tests/hs11-font-focus.spec.ts plus a throwaway probe:
20 passed, 0 failed. The probe file existed only while I held the lock and was removed with `rm`.
Unverified: native WebKit (Tauri) focus timing; assistive-tech activation was reasoned from the code, not tested.
