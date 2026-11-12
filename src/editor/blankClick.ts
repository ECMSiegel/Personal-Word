// A click on blank page area places the caret.
import type { EditorView } from "@tiptap/pm/view";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { reportsUnzoomedRects, totalZoom } from "../components/floating";

/** Returns true when it handled the click. */
export function blankPageClick(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return false;

  const target = event.target as Element | null;
  if (target && target !== view.dom && view.dom.contains(target)) return false;
  if (
    target?.closest?.(
      ".document-ruler, .side-ruler, .page-spacer, [data-footnote-id], .page-footnotes, .footnote-area, button, [role='button'], a, input, textarea, select, [role='slider']",
    )
  )
    return false;

  // The click is in drawn px. Native WebKit reports rects inside the zoomed page in
  // drawn / zoom, so bring them to drawn px before comparing (Chromium: scale is 1).
  const scale = reportsUnzoomedRects() ? totalZoom(view.dom) : 1;
  const rect = view.dom.getBoundingClientRect();
  const lastChild = view.dom.lastElementChild;
  const belowText = lastChild && event.clientY > lastChild.getBoundingClientRect().bottom * scale;
  const left = Math.max(rect.left * scale + 1, Math.min(event.clientX, rect.right * scale - 1));
  const top = Math.max(rect.top * scale + 1, Math.min(event.clientY, rect.bottom * scale - 1));
  // Under zoom ProseMirror's posAtCoords also compares WebKit's drawn / zoom block rects with
  // drawn px and answers "after the block" (native run T278); caretRangeFromPoint takes drawn px.
  const caret = !belowText && scale !== 1 ? view.dom.ownerDocument?.caretRangeFromPoint?.(left, top) : null;
  const fromCaret = caret && view.dom.contains(caret.startContainer) ? view.posAtDOM(caret.startContainer, caret.startOffset) : -1;
  const pos =
    belowText
      ? view.state.doc.content.size - 1
      : fromCaret >= 0
        ? fromCaret
        : view.posAtCoords({ left, top })?.pos ?? view.state.doc.content.size - 1;
  // A position between blocks (a list, table or image at the end, a page-gap widget) is moved to the nearest text.
  const $pos = view.state.doc.resolve(pos);
  const head = $pos.parent.inlineContent
    ? pos
    : (Selection.findFrom($pos, -1, true) ?? Selection.findFrom($pos, 1, true))?.head ?? pos;
  const selection = event.shiftKey
    ? TextSelection.create(view.state.doc, view.state.selection.anchor, head)
    : TextSelection.create(view.state.doc, head);

  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  event.preventDefault();
  view.focus();
  return true;
}
