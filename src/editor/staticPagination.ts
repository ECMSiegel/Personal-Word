// Page view for static (non-editor) DOM: Read and Bibliography. The same pure
// planner as the editor (`planPages`) decides the breaks; here the blocks are
// the direct children of a plain writing surface and the spacers are real
// elements inserted into that DOM (and removed exactly before every new pass).
import { glyphLines, planPages, type BlockBox, type PageGeometry } from "./pagination";

const SPACER = "page-spacer";

/** Client px per unzoomed layout px for `surface` (the paper's CSS zoom, when rects report it). */
function scaleOf(surface: HTMLElement) {
  const paper = surface.closest?.(".editor-paper");
  const zoom = paper ? parseFloat(getComputedStyle(paper).zoom) || 1 : 1;
  const rect = surface.getBoundingClientRect();
  const ratio = surface.offsetWidth ? rect.width / surface.offsetWidth : 1;
  return Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1;
}

const blocksOf = (surface: HTMLElement) =>
  Array.from(surface.children).filter(
    (el): el is HTMLElement => !el.classList.contains(SPACER),
  );

type Glyphs = ReturnType<typeof glyphLines>;
const glyphCache = new WeakMap<BlockBox, () => Glyphs>();

/**
 * One box per direct child of `surface`, in document order, in unzoomed px
 * from the surface's top. Headings are h1-h3 and `.read-title`; only
 * paragraphs report lines (so only they split between lines).
 */
export function measureStatic(surface: HTMLElement): BlockBox[] {
  const scale = scaleOf(surface);
  const surfaceTop = surface.getBoundingClientRect().top;
  return blocksOf(surface).map((el, pos) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    let glyphs: Glyphs | null = null;
    const glyphOf = () => (glyphs ??= glyphLines(el, (y) => y));
    const box: BlockBox = {
      pos,
      top: (rect.top - surfaceTop) / scale,
      height: rect.height / scale,
      mt: parseFloat(style.marginTop) || 0,
      mb: parseFloat(style.marginBottom) || 0,
      spacer: false,
      pageBreak: false,
      heading: /^h[1-3]$/.test(tag) || el.classList.contains("read-title"),
      lines:
        tag === "p"
          ? () => {
              // As in the editor: line k starts where line k-1's lowest glyph
              // ends plus the space the last line has below its glyphs.
              const { bottoms } = glyphOf();
              const end = rect.bottom - (bottoms[bottoms.length - 1] ?? rect.bottom);
              return [0, ...bottoms.slice(0, -1).map((y) => (y + end - rect.top) / scale)];
            }
          : undefined,
    };
    glyphCache.set(box, glyphOf);
    return box;
  });
}

/** The text node and offset of the first character in `el` whose box ends below client y `below`. */
function firstTextBelow(el: HTMLElement, below: number): { node: Text; offset: number } | null {
  const range = el.ownerDocument.createRange();
  const bottom = (node: Text, k: number) => {
    range.setStart(node, k);
    range.setEnd(node, k + 1);
    const rects = range.getClientRects();
    const r = rects[rects.length - 1];
    return r ? r.top + r.height : -Infinity;
  };
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const n = node.data.length;
    // A raised note number belongs to the line it is raised on.
    if (node.parentElement?.closest("sup") && el.contains(node.parentElement.closest("sup"))) continue;
    if (!n || bottom(node, n - 1) <= below) continue;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bottom(node, mid) > below) hi = mid;
      else lo = mid + 1;
    }
    return { node, offset: lo };
  }
  return null;
}

function spacer(doc: Document, height: number) {
  const el = doc.createElement("span");
  el.className = SPACER;
  el.dataset.static = "";
  el.setAttribute("aria-hidden", "true");
  el.style.height = `${height}px`;
  return el;
}

/** Removes every spacer `paginateStatic` inserted, joining any text it split. */
export function unpaginateStatic(surface: HTMLElement) {
  for (const el of Array.from(surface.querySelectorAll<HTMLElement>(`.${SPACER}[data-static]`))) {
    const before = el.previousSibling;
    const after = el.nextSibling;
    el.remove();
    if (el.dataset.split !== undefined && before?.nodeType === 3 && after?.nodeType === 3) {
      (before as Text).appendData((after as Text).data);
      after.parentNode?.removeChild(after);
    }
  }
}

/**
 * Lays `surface`'s blocks out on pages: removes the previous spacers, measures,
 * plans with `planPages` and inserts `span.page-spacer[data-static]` of the
 * planned heights (before a block, or inside a paragraph at the first character
 * of the line that moves). Returns the page count.
 */
export function paginateStatic(surface: HTMLElement, geometry: PageGeometry): number {
  unpaginateStatic(surface);
  const elements = blocksOf(surface);
  const blocks = measureStatic(surface);
  const plan = planPages(blocks, geometry);
  // Find every insertion point first: each insertion moves the layout below it.
  const inserts: { at: Node; height: number; split?: number }[] = [];
  for (const { pos, line, height } of plan.boundaries) {
    if (line === undefined) {
      inserts.push({ at: elements[pos], height });
      continue;
    }
    const { bottoms, lineHeight } = glyphCache.get(blocks[pos])!();
    const found = firstTextBelow(elements[pos], bottoms[line - 1] + lineHeight / 4);
    // A line start that cannot be found leaves the paragraph running across the gap.
    if (found) inserts.push({ at: found.node, height, split: found.offset });
  }
  // Last first, so a second split in the same text node still finds its offset.
  for (const { at, height, split } of inserts.reverse()) {
    const el = spacer(surface.ownerDocument, height);
    let next = at;
    if (split) {
      next = (at as Text).splitText(split);
      el.dataset.split = "";
    }
    next.parentNode!.insertBefore(el, next);
  }
  return plan.pageCount;
}
