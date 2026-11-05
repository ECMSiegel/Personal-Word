import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { reportsUnzoomedRects, totalZoom } from "./components/floating";

/** Native WebKit reports a rect inside a CSS `zoom`ed element in that element's zoomed
 * space (drawn / zoom), while the scroller around it is unzoomed. ProseMirror compares the
 * two as if they were the same, so below zoom 1 the caret can end up behind the sticky ruler.
 * Everything here works in drawn pixels. Chromium reports drawn rects: `unzoomed` is false. */
export type Span = { start: number; end: number };
type Inset = { start: number; end: number };

export function drawnSpan(raw: Span, zoom: number, unzoomed: boolean): Span {
  return unzoomed && zoom !== 1 ? { start: raw.start * zoom, end: raw.end * zoom } : raw;
}

/** How far to scroll (drawn px, positive = content moves up) so `caret` sits inside `bounds`
 * less `threshold`, leaving `margin` clear. Same rule as ProseMirror's scrollRectIntoView. */
export function scrollDelta(caret: Span, bounds: Span, threshold: Inset, margin: Inset) {
  if (caret.start < bounds.start + threshold.start) return -(bounds.start - caret.start + margin.start);
  if (caret.end > bounds.end - threshold.end)
    return caret.end - caret.start > bounds.end - bounds.start
      ? caret.start + margin.start - bounds.start
      : caret.end - bounds.end + margin.end;
  return 0;
}

const MOVE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"]);

/** ProseMirror scrolls after a movement key only if the selection change lands within 50 ms of
 * the key. A busy moment misses that, and the caret can stay behind the sticky ruler until the
 * next press. This asks for the missed scroll, once per key. */
export const KeyCaretInView = Extension.create({
  name: "keyCaretInView",
  addProseMirrorPlugins() {
    let keyAt = 0;
    return [
      new Plugin({
        props: {
          handleKeyDown(_, event) {
            keyAt = MOVE_KEYS.has(event.key) ? Date.now() : 0;
            return false;
          },
          handleDOMEvents: {
            mousedown() {
              keyAt = 0;
              return false;
            },
          },
        },
        appendTransaction(transactions, before, after) {
          if (!keyAt || before.selection.eq(after.selection)) return null;
          const late = Date.now() - keyAt < 1000 && !transactions.some((t) => t.docChanged || t.scrolledIntoView);
          keyAt = 0;
          return late ? after.tr.scrollIntoView() : null;
        },
      }),
    ];
  },
});

const side = (v: unknown, name: "top" | "bottom" | "left" | "right", fallback: number) =>
  typeof v === "number" ? v : v && typeof v === "object" ? ((v as Record<string, number>)[name] ?? fallback) : fallback;

/** `handleScrollToSelection`: only when rects and scroller disagree (WebKit under zoom).
 * Everywhere else it returns false and ProseMirror scrolls as before. */
export function handleCaretScroll(view: EditorView): boolean {
  const zoom = totalZoom(view.dom);
  if (zoom === 1 || !reportsUnzoomedRects()) return false;
  const doc = view.dom.ownerDocument;
  const threshold = view.someProp("scrollThreshold") ?? 0;
  const margin = view.someProp("scrollMargin") ?? 5;
  const sel = view.state.selection;
  // Like ProseMirror's default: a selected node is scrolled by its own box, not by the line after it.
  const node = sel instanceof NodeSelection ? view.nodeDOM(sel.from) : null;
  const c = node instanceof Element ? node.getBoundingClientRect() : view.coordsAtPos(sel.head, 1);
  let y = drawnSpan({ start: c.top, end: c.bottom }, zoom, true);
  let x = drawnSpan({ start: c.left, end: c.right }, zoom, true);
  for (let parent: Node | null = view.dom; parent; ) {
    if (!(parent instanceof Element)) {
      parent = parent.parentNode;
      continue;
    }
    const atTop: boolean = parent === doc.body;
    const b = atTop
      ? { top: 0, bottom: doc.documentElement.clientHeight, left: 0, right: doc.documentElement.clientWidth }
      : parent.getBoundingClientRect();
    const moveY = scrollDelta(y, { start: b.top, end: b.bottom }, {
      start: side(threshold, "top", 0),
      end: side(threshold, "bottom", 0),
    }, { start: side(margin, "top", 5), end: side(margin, "bottom", 5) });
    const moveX = scrollDelta(x, { start: b.left, end: b.right }, {
      start: side(threshold, "left", 0),
      end: side(threshold, "right", 0),
    }, { start: side(margin, "left", 5), end: side(margin, "right", 5) });
    if (moveX || moveY) {
      if (atTop) doc.defaultView?.scrollBy(moveX, moveY);
      else {
        const sx = parent.scrollLeft;
        const sy = parent.scrollTop;
        if (moveY) parent.scrollTop += moveY;
        if (moveX) parent.scrollLeft += moveX;
        const dx = parent.scrollLeft - sx;
        const dy = parent.scrollTop - sy;
        x = { start: x.start - dx, end: x.end - dx };
        y = { start: y.start - dy, end: y.end - dy };
      }
    }
    const pos: string = atTop ? "fixed" : getComputedStyle(parent).position;
    if (pos === "fixed" || pos === "sticky") break;
    parent = pos === "absolute" ? (parent as HTMLElement).offsetParent : parent.parentNode;
  }
  return true;
}
