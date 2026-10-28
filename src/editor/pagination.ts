// Vertical page view: one ProseMirror flow drawn as stacked pages. The plugin
// measures top-level blocks and inserts a spacer widget before the first block
// of each new page, so the editor keeps one DOM, one undo history and normal
// caret movement. Geometry comes from CSS variables on `.editor-paper`.
import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * A page boundary at `pos`: before a block, or (`inline`) before the first
 * character of a paragraph's line when the paragraph runs on to the next
 * page. `height` is the spacer's height in unzoomed layout px; `split` is
 * where, from the spacer's top, the page above ends (a click above it belongs
 * to that page, below it to the next).
 */
export type Boundary = {
  pos: number;
  height: number;
  split: number;
  inline?: boolean;
};
/** A planned boundary: before block `pos`, or before its line `line`. */
export type PlannedBoundary = Omit<Boundary, "inline"> & { line?: number };
type PaginationState = {
  boundaries: Boundary[];
  pageCount: number;
  decorations: DecorationSet;
  /** Document range edited since the spacers were last placed. */
  dirty: { from: number; to: number } | null;
};
export const paginationKey = new PluginKey<PaginationState>("pagination");

const px = (style: CSSStyleDeclaration, name: string) =>
  parseFloat(style.getPropertyValue(name)) || 0;

/**
 * Unzoomed layout offset of `el` from the top of `ancestor` (which must be
 * positioned), in whole px. offsetTop is reported in unzoomed CSS px in both
 * Chromium and WebKit, so it never drifts with zoom.
 */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    y += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    if (parent === ancestor) return y;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return node === ancestor ? y : NaN;
}

function build(doc: EditorState["doc"], boundaries: Boundary[]) {
  if (!boundaries.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    boundaries.map((b, index) =>
      Decoration.widget(
        b.pos,
        () => {
          const el = document.createElement(b.inline ? "span" : "div");
          el.className = "page-spacer";
          if (b.inline) el.dataset.inline = "true";
          el.contentEditable = "false";
          el.setAttribute("aria-hidden", "true");
          el.dataset.page = String(index + 2);
          el.dataset.index = String(index);
          el.dataset.split = String(b.split);
          el.style.height = `${b.height}px`;
          return el;
        },
        {
          side: -1,
          key: `page-spacer-${b.inline ? "i" : "b"}${index}-${b.height}-${b.split}`,
          ignoreSelection: true,
        },
      ),
    ),
  );
}

const same = (a: Boundary[], b: Boundary[]) =>
  a.length === b.length &&
  a.every(
    (x, i) =>
      x.pos === b[i].pos &&
      !!x.inline === !!b[i].inline &&
      Math.abs(x.height - b[i].height) < 0.5 &&
      Math.abs(x.split - b[i].split) < 0.5,
  );

let marginCache = new WeakMap<Element, { mt: number; mb: number }>();

/** One top-level block as rendered, in unzoomed px from the surface top. */
export type BlockBox = {
  pos: number;
  top: number;
  height: number;
  mt: number;
  mb: number;
  /** A page spacer currently sits directly above this block. */
  spacer: boolean;
  pageBreak: boolean;
  heading: boolean;
  /**
   * For a paragraph, the tops of its line boxes from the block's top
   * (unzoomed px, first line 0), measured lazily: only a paragraph that
   * crosses a page end needs them.
   */
  lines?: () => number[];
};
export type PageGeometry = {
  pageHeight: number;
  gap: number;
  margin: number;
  reserve: number;
};

/**
 * Page boundaries for measured blocks (pure arithmetic). Coordinates are
 * relative to the writing surface: page p's text area starts at p * pitch.
 *
 * Rules, as Word lays out a page by default: a paragraph that does not fit the
 * space left on its page splits between lines when at least two lines stay on
 * each page (widow and orphan control), so a paragraph of three lines or fewer
 * moves whole; a paragraph taller than a page splits as often as it needs.
 * Any other block that does not fit moves whole to the next page. A heading
 * (or a run of headings) keeps with the block after it: it moves with that
 * block when the block moves whole. A page break starts a new page. The first
 * block on a page never moves, so a block taller than a page that cannot
 * split starts a page and runs across the gap. One pass, no retries.
 */
export function planPages(
  blocks: BlockBox[],
  { pageHeight, gap, margin, reserve }: PageGeometry,
): { boundaries: PlannedBoundary[]; pageCount: number } {
  if (!blocks.length || !(pageHeight > 0))
    return { boundaries: [], pageCount: 1 };
  const contentHeight = pageHeight - 2 * margin;
  const pitch = pageHeight + gap;
  const limitOf = (page: number) => page * pitch + contentHeight - reserve;
  const paperBottomOf = (page: number) => page * pitch + contentHeight + margin;
  // ys[i] is block i's top in the paginated layout. Distances between
  // neighbours come from the rendered layout; across a current spacer the
  // natural (collapsed) margin replaces the spacer.
  const ys: number[] = [];
  // extra[i]: height of the spacers inside block i (a split paragraph).
  const extra: number[] = [];
  const bottomOf = (i: number) => ys[i] + blocks[i].height + extra[i];
  const boundaries: PlannedBoundary[] = [];
  let page = 0;
  let pageFirst = 0;
  const naturalTop = (i: number) => {
    const b = blocks[i];
    const p = blocks[i - 1];
    const between = b.spacer ? Math.max(p.mb, b.mt) : b.top - p.top - p.height;
    return bottomOf(i - 1) + between;
  };
  /** Starts a new page with block k; returns its top. */
  const startPage = (k: number) => {
    const prev = blocks[k - 1];
    const spacerTop = bottomOf(k - 1) + prev.mb;
    const ended = page;
    let target = (page + 1) * pitch;
    while (target - spacerTop - blocks[k].mt < 0) target += pitch;
    page = Math.round(target / pitch);
    boundaries.push({
      pos: blocks[k].pos,
      height: target - spacerTop - blocks[k].mt,
      split: Math.max(0, paperBottomOf(ended) - spacerTop),
    });
    pageFirst = k;
    return target;
  };
  /**
   * How many of block i's lines, from line `from`, stay on the current page:
   * at least two, and two must be left for the next page; at a page's start
   * any number that fits, even one (so the split always moves on).
   * 0 means none can stay.
   */
  const keepLines = (i: number, lines: number[], from: number, atStart: boolean) => {
    const n = lines.length;
    const lineBottom = (k: number) => (k + 1 < n ? lines[k + 1] : blocks[i].height);
    let fit = from;
    while (fit < n && ys[i] + extra[i] + lineBottom(fit) <= limitOf(page) + 0.5) fit++;
    if (fit >= n) return n - from;
    const keep = Math.min(fit, n - 2) - from;
    if (keep >= 2) return keep;
    return atStart ? Math.min(fit - from, Math.max(keep, 1)) : 0;
  };
  let forceNext = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    extra[i] = 0;
    let top = i === 0 ? b.top : naturalTop(i);
    ys[i] = top;
    if (i > 0 && i !== pageFirst) {
      const fits = top + b.height <= limitOf(page) + 0.5;
      const lines = !fits && !forceNext ? b.lines?.() : undefined;
      if (forceNext) top = startPage(i);
      else if (!fits && !(lines && keepLines(i, lines, 0, false) >= 2)) {
        // k = first of the headings directly above block i on this page.
        let k = i;
        while (k - 1 >= pageFirst && blocks[k - 1].heading) k--;
        if (k === i) top = startPage(i);
        else if (k > pageFirst) {
          // Move the heading run; block i follows it and is never moved
          // again (a unit taller than a page runs across the gap).
          const moved = startPage(k);
          const delta = moved - ys[k];
          for (let j = k; j < i; j++) ys[j] += delta;
          top = naturalTop(i);
        }
        // else: only headings stand above block i on this page; keeping them
        // together means block i runs across the page gap.
      }
    }
    forceNext = b.pageBreak;
    ys[i] = top;
    // A paragraph that still crosses its page's end splits between lines.
    let from = 0;
    while (b.lines && bottomOf(i) > limitOf(page) + 0.5) {
      const lines = b.lines();
      const keep = keepLines(i, lines, from, from > 0 || i === pageFirst);
      if (keep < 1 || from + keep >= lines.length) break;
      from += keep;
      const spacerTop = top + extra[i] + lines[from];
      const ended = page;
      let target = (page + 1) * pitch;
      while (target < spacerTop) target += pitch;
      page = Math.round(target / pitch);
      boundaries.push({
        pos: b.pos,
        line: from,
        height: target - spacerTop,
        split: Math.max(0, paperBottomOf(ended) - spacerTop),
      });
      extra[i] += target - spacerTop;
    }
    page = Math.max(page, Math.floor(bottomOf(i) / pitch));
  }
  return { boundaries, pageCount: page + 1 };
}

/**
 * A paragraph's lines in client px: the lowest glyph bottom on each line and
 * the tallest glyph box. Text boxes whose centres sit within three quarters of
 * a glyph box of each other share a line, so a raised footnote number stays on
 * its line.
 */
function glyphLines(el: HTMLElement, natural: (y: number) => number) {
  const rects: { top: number; bottom: number; height: number }[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const r of range.getClientRects())
      if (r.height > 0) {
        const top = natural(r.top);
        rects.push({ top, bottom: top + r.height, height: r.height });
      }
  }
  const lineHeight = Math.max(0, ...rects.map((r) => r.height));
  rects.sort((a, b) => a.top + a.bottom - b.top - b.bottom);
  const bottoms: number[] = [];
  let center = -Infinity;
  for (const r of rects) {
    const c = (r.top + r.bottom) / 2;
    if (c - center > (lineHeight * 3) / 4) {
      bottoms.push(r.bottom);
      center = c;
    } else bottoms[bottoms.length - 1] = Math.max(bottoms[bottoms.length - 1], r.bottom);
  }
  return { bottoms, lineHeight };
}

/** Document position of the first character below client y `below` in `el`. */
function firstCharBelow(
  view: EditorView,
  el: HTMLElement,
  below: number,
  natural: (y: number) => number,
) {
  const range = document.createRange();
  const bottom = (node: Text, k: number) => {
    range.setStart(node, k);
    range.setEnd(node, k + 1);
    const rects = range.getClientRects();
    const r = rects[rects.length - 1];
    return r ? natural(r.top) + r.height : -Infinity;
  };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const n = node.data.length;
    // Text drawn by an atom (a footnote number) has no position of its own.
    if (node.parentElement?.closest('[contenteditable="false"]') !== null &&
      el.contains(node.parentElement!.closest('[contenteditable="false"]')))
      continue;
    if (!n || bottom(node, n - 1) <= below) continue;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bottom(node, mid) > below) hi = mid;
      else lo = mid + 1;
    }
    try {
      return view.posAtDOM(node, lo);
    } catch {
      return null;
    }
  }
  return null;
}

/** Measures the editor's top-level blocks and plans its pages. */
export function computeBoundaries(view: EditorView): {
  boundaries: Boundary[];
  pageCount: number;
} {
  const none = { boundaries: [], pageCount: 1 };
  const surface = view.dom as HTMLElement;
  const paper = surface.closest<HTMLElement>(".editor-paper");
  const scroller = surface.closest<HTMLElement>(".is-paged");
  if (!paper || !scroller) return none;
  // A spacer inside a paragraph forces a line break. Where the paragraph was
  // edited, or after the text width changed, that break may no longer fall
  // where the line would wrap, so those spacers are hidden while measuring.
  const state = paginationKey.getState(view.state);
  const dirty = clean.get(view) === state?.dirty ? null : state?.dirty;
  const all = rewrap.has(view);
  const hidden: HTMLElement[] = [];
  for (const spacer of surface.querySelectorAll<HTMLElement>(".page-spacer[data-inline]")) {
    const b = state?.boundaries[Number(spacer.dataset.index)];
    let stale = all || !b;
    if (!stale && dirty && b!.pos <= view.state.doc.content.size) {
      const $pos = view.state.doc.resolve(b!.pos);
      if ($pos.depth >= 1)
        stale = $pos.before(1) <= dirty.to && $pos.after(1) >= dirty.from;
    }
    if (stale) {
      spacer.style.display = "none";
      hidden.push(spacer);
    }
  }
  if (!hidden.length) return measure(view, surface, paper);
  const scrollTop = scroller.scrollTop;
  try {
    return measure(view, surface, paper);
  } finally {
    const moved = scroller.scrollTop !== scrollTop;
    for (const spacer of hidden) spacer.style.display = "";
    if (moved) scroller.scrollTop = scrollTop;
  }
}

function measure(
  view: EditorView,
  surface: HTMLElement,
  paper: HTMLElement,
): { boundaries: Boundary[]; pageCount: number } {
  const none = { boundaries: [], pageCount: 1 };
  const vars = getComputedStyle(paper);
  // Sub-pixel unzoomed px: rect offsets from the surface divided by the
  // paper's exact CSS zoom. Engines differ on whether rects include zoom, so
  // the rendered/layout width ratio picks zoom or 1; offsetTop (whole px,
  // unzoomed in every engine) guards the result.
  const surfaceRect = surface.getBoundingClientRect();
  const zoom = parseFloat(vars.zoom) || 1;
  const ratio = surface.offsetWidth ? surfaceRect.width / surface.offsetWidth : 1;
  const scale = Math.abs(ratio - zoom) <= Math.abs(ratio - 1) ? zoom : 1;
  // Spacers inside a paragraph push its later lines and every later block
  // down. Planning works on the layout without them, so their heights (client
  // px) are taken back out: `inner` maps each paragraph to its spacers and
  // `above` is the total of the spacers in earlier paragraphs.
  const inner = new Map<Element, { top: number; height: number }[]>();
  for (const spacer of surface.querySelectorAll<HTMLElement>(".page-spacer[data-inline]")) {
    if (spacer.style.display === "none") continue;
    let block: Element | null = spacer;
    while (block && block.parentElement !== surface) block = block.parentElement;
    if (!block) continue;
    const r = spacer.getBoundingClientRect();
    const list = inner.get(block) ?? [];
    list.push({ top: r.top, height: r.height });
    inner.set(block, list);
  }
  let above = 0;
  const blocks: BlockBox[] = [];
  const doms: HTMLElement[] = [];
  const glyphOf: (() => ReturnType<typeof glyphLines>)[] = [];
  const naturalOf: ((y: number) => number)[] = [];
  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    let margins = marginCache.get(dom);
    if (!margins) {
      const style = getComputedStyle(dom);
      margins = {
        mt: parseFloat(style.marginTop) || 0,
        mb: parseFloat(style.marginBottom) || 0,
      };
      marginCache.set(dom, margins);
    }
    const rect = dom.getBoundingClientRect();
    const layoutTop = offsetWithin(dom, surface);
    const preciseTop = (rect.top - surfaceRect.top) / scale;
    const precise = Math.abs(preciseTop - layoutTop) <= 1.5;
    const own = inner.get(dom) ?? [];
    const ownHeight = own.reduce((sum, s) => sum + s.height, 0);
    // Client y inside this paragraph as it would be without its spacers.
    const natural = (y: number) =>
      own.reduce((v, s) => (s.top < y - 0.5 ? v - s.height : v), y);
    const height = (precise ? rect.height : dom.offsetHeight * scale) / scale - ownHeight / scale;
    let measured: ReturnType<typeof glyphLines> | null = null;
    const glyphs = () => (measured ??= glyphLines(dom, natural));
    blocks.push({
      pos: offset,
      top: (precise ? preciseTop : layoutTop) - above / scale,
      height,
      mt: margins.mt,
      mb: margins.mb,
      spacer: !!dom.previousElementSibling?.classList.contains("page-spacer"),
      pageBreak: node.type.name === "pageBreak",
      heading: node.type.name === "heading",
      lines:
        node.type.name === "paragraph"
          ? () => {
              // Line box k ends where its lowest glyph ends plus the same
              // space the last line has below its glyphs.
              const { bottoms } = glyphs();
              const bottom = rect.bottom - ownHeight;
              const end = bottom - (bottoms[bottoms.length - 1] ?? bottom);
              return [0, ...bottoms.slice(0, -1).map((y) => (y + end - rect.top) / scale)];
            }
          : undefined,
    });
    doms.push(dom);
    glyphOf.push(glyphs);
    naturalOf.push(natural);
    above += ownHeight;
  });
  if (blocks.some((b) => Number.isNaN(b.top))) return none;
  const plan = planPages(blocks, {
    pageHeight: px(vars, "--page-height"),
    gap: px(vars, "--page-gap"),
    margin: px(vars, "--page-margin"),
    reserve: px(vars, "--footnote-reserve"),
  });
  const boundaries: Boundary[] = [];
  for (const { line, ...b } of plan.boundaries) {
    if (line === undefined) {
      boundaries.push(b);
      continue;
    }
    const index = blocks.findIndex((x) => x.pos === b.pos);
    const { bottoms, lineHeight } = glyphOf[index]();
    const pos = firstCharBelow(
      view,
      doms[index],
      bottoms[line - 1] + lineHeight / 4,
      naturalOf[index],
    );
    // A line start that cannot be found leaves the paragraph running across the gap.
    if (pos !== null) boundaries.push({ ...b, pos, inline: true });
  }
  return { boundaries, pageCount: plan.pageCount };
}

const pending = new WeakMap<EditorView, boolean>();
/** Views whose text width changed: every spacer inside a paragraph is re-measured. */
const rewrap = new WeakSet<EditorView>();
/** The dirty range each view last measured, so an unchanged layout is not re-measured as edited. */
const clean = new WeakMap<EditorView, PaginationState["dirty"]>();

/**
 * Measure now and dispatch new spacers if they changed. Synchronous. While an
 * input method is composing (accents, press-and-hold, CJK) nothing is
 * dispatched; the plugin measures again when the composition ends.
 * `fresh` drops cached margins after a layout or document-setting change.
 */
export function paginate(view: EditorView, fresh = false): boolean {
  if ((view as EditorView & { isDestroyed?: boolean }).isDestroyed) return false;
  if (fresh) {
    marginCache = new WeakMap();
    rewrap.add(view);
  }
  if (view.composing) {
    pending.set(view, true);
    return false;
  }
  pending.delete(view);
  const next = computeBoundaries(view);
  const current = paginationKey.getState(view.state);
  rewrap.delete(view);
  clean.set(view, current?.dirty ?? null);
  if (
    current &&
    same(current.boundaries, next.boundaries) &&
    current.pageCount === next.pageCount
  )
    return false;
  view.dispatch(
    view.state.tr.setMeta(paginationKey, next).setMeta("addToHistory", false),
  );
  return true;
}

/** Click on a spacer: above the page's lower edge = end of that page, else the next page's start. */
function clickSpacer(view: EditorView, event: MouseEvent) {
  const spacer = (event.target as Element | null)?.closest?.(".page-spacer");
  if (!(spacer instanceof HTMLElement) || !view.dom.contains(spacer))
    return false;
  const boundary =
    paginationKey.getState(view.state)?.boundaries[Number(spacer.dataset.index)];
  if (!boundary) return false;
  const rect = spacer.getBoundingClientRect();
  const height = parseFloat(spacer.style.height) || rect.height || 1;
  const local = (event.clientY - rect.top) * (height / (rect.height || height));
  const before = local < Number(spacer.dataset.split);
  // Inside a paragraph the page's last line ends at the same position the next
  // page's first line starts, and the caret there is drawn on the next page;
  // one character back keeps it on the page that was clicked.
  const $pos = view.state.doc.resolve(
    before && boundary.inline ? Math.max(boundary.pos - 1, view.state.doc.resolve(boundary.pos).start()) : boundary.pos,
  );
  const target = Selection.near($pos, before ? -1 : 1);
  const selection =
    event.shiftKey && target instanceof TextSelection
      ? TextSelection.create(
          view.state.doc,
          view.state.selection.anchor,
          target.head,
        )
      : target;
  event.preventDefault();
  view.focus();
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  return true;
}

/**
 * Client rectangle of the character after `pos`, if it is text. At a mark or
 * spacer boundary the DOM position is between elements, so the first text
 * after it (outside widgets and atoms) is used.
 */
function charRect(view: EditorView, pos: number) {
  let { node, offset } = view.domAtPos(pos, 1);
  if (node.nodeType !== Node.TEXT_NODE || offset >= (node as Text).data.length) {
    const block = view.domAtPos(view.state.doc.resolve(pos).start()).node;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const start = node.nodeType === Node.TEXT_NODE ? node : node.childNodes[offset] ?? null;
    let text: Node | null = null;
    if (start) {
      walker.currentNode = start;
      text = start.nodeType === Node.TEXT_NODE && start !== node ? start : walker.nextNode();
    } else if (node !== block) {
      walker.currentNode = node;
      text = walker.nextNode();
      while (text && node.contains(text)) text = walker.nextNode();
    }
    while (text && text.parentElement?.closest('[contenteditable="false"]'))
      text = walker.nextNode();
    if (!text || !(text as Text).data.length) return null;
    node = text;
    offset = 0;
  }
  const range = document.createRange();
  range.setStart(node, offset);
  range.setEnd(node, offset + 1);
  const rects = range.getClientRects();
  return rects[rects.length - 1] ?? null;
}

/**
 * Up or Down from a line next to a page gap moves to the nearest line across
 * the gap. WebKit's own line movement skips page 1's last line when it moves
 * up from page 2's first line, so the plugin moves the caret itself there.
 */
function arrowAcrossGap(view: EditorView, event: KeyboardEvent) {
  const up = event.key === "ArrowUp";
  if ((!up && event.key !== "ArrowDown") || event.altKey || event.metaKey || event.ctrlKey)
    return false;
  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection)) return false;
  const caret = view.coordsAtPos(selection.head);
  const line = caret.bottom - caret.top;
  for (const spacer of view.dom.querySelectorAll<HTMLElement>(".page-spacer")) {
    const rect = spacer.getBoundingClientRect();
    if (!rect.height) continue;
    const prev = spacer.dataset.inline ? null : spacer.previousElementSibling;
    // Bottom of the last line above the gap, top of the first line below it.
    const next = spacer.dataset.inline ? null : spacer.nextElementSibling;
    const above = prev instanceof HTMLElement ? prev.getBoundingClientRect().bottom : rect.top;
    const below = next instanceof HTMLElement ? next.getBoundingClientRect().top : rect.bottom;
    let y: number | null = null;
    if (up && caret.top >= below - 1 && caret.top - below < line) y = above - 2;
    else if (!up && caret.bottom <= above + 1 && above - caret.bottom < line) y = below + 2;
    if (y === null) continue;
    const found = view.posAtCoords({ left: caret.left, top: y });
    if (!found) return false;
    let pos = found.pos;
    const $found = doc.resolve(pos);
    if ($found.parent.inlineContent && pos > $found.start() && pos < $found.end()) {
      // A position where a line wraps (or a page breaks inside a paragraph) is
      // drawn at the start of the lower line; one character back when the
      // target is the upper line (the line of the character before it).
      const end = charRect(view, pos - 1);
      const start = charRect(view, pos);
      if (end && start && end.top !== start.top && Math.abs(y - (end.top + end.bottom) / 2) < Math.abs(y - (start.top + start.bottom) / 2))
        pos -= 1;
    }
    const $pos = doc.resolve(pos);
    const target =
      event.shiftKey && $pos.parent.inlineContent
        ? TextSelection.create(doc, selection.anchor, pos)
        : Selection.near($pos, up ? -1 : 1);
    view.dispatch(view.state.tr.setSelection(target).scrollIntoView());
    return true;
  }
  return false;
}

export const Pagination = Extension.create({
  name: "pagination",
  addProseMirrorPlugins() {
    let schedule: () => void = () => {};
    return [
      new Plugin<PaginationState>({
        key: paginationKey,
        state: {
          init: () => ({
            boundaries: [],
            pageCount: 1,
            decorations: DecorationSet.empty,
            dirty: null,
          }),
          apply(tr, value, _old, newState) {
            const meta = tr.getMeta(paginationKey) as
              | { boundaries: Boundary[]; pageCount: number }
              | undefined;
            if (meta)
              return {
                ...meta,
                decorations: build(newState.doc, meta.boundaries),
                dirty: null,
              };
            if (!tr.docChanged) return value;
            const { mapping } = tr;
            let dirty = value.dirty && {
              from: mapping.map(value.dirty.from, -1),
              to: mapping.map(value.dirty.to, 1),
            };
            const widen = (from: number, to: number) => {
              dirty = dirty
                ? { from: Math.min(dirty.from, from), to: Math.max(dirty.to, to) }
                : { from, to };
            };
            tr.steps.forEach((step, i) => {
              const rest = mapping.slice(i + 1);
              mapping.maps[i].forEach((_oldStart, _oldEnd, start, end) =>
                widen(rest.map(start, -1), rest.map(end, 1)),
              );
              // Mark and attribute steps change no positions but can change
              // where lines wrap (bold is wider), so their range counts too.
              const { from, to, pos } = step as { from?: number; to?: number; pos?: number };
              const after = mapping.slice(i);
              if (from !== undefined && to !== undefined)
                widen(after.map(from, -1), after.map(to, 1));
              else if (pos !== undefined) widen(after.map(pos, -1), after.map(pos + 1, 1));
            });
            return {
              ...value,
              dirty,
              boundaries: value.boundaries.map((b) => ({
                ...b,
                pos: tr.mapping.map(b.pos, -1),
              })),
              decorations: value.decorations.map(tr.mapping, tr.doc),
            };
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state)?.decorations,
          handleKeyDown: arrowAcrossGap,
          handleDOMEvents: {
            mousedown: (view, event) => clickSpacer(view, event),
            compositionend: () => {
              // ProseMirror clears `composing` right after this handler.
              schedule();
              return false;
            },
          },
        },
        view: (view) => {
          let frame = 0;
          let width = 0;
          // A dispatch moves later blocks; re-check a couple of times so
          // rounding and the footnote reserve settle, then stop.
          let followUps = 0;
          const run = () => {
            frame = 0;
            const changed = paginate(view);
            if (changed && followUps < 2) {
              followUps += 1;
              frame = requestAnimationFrame(run);
            }
          };
          schedule = () => {
            followUps = 0;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(run);
          };
          const observer = new ResizeObserver(() => {
            const w = (view.dom as HTMLElement).offsetWidth;
            if (w !== width) {
              width = w;
              rewrap.add(view);
              schedule();
            }
          });
          observer.observe(view.dom);
          document.fonts?.ready.then(() => {
            rewrap.add(view);
            schedule();
          });
          schedule();
          return {
            update(view, prev) {
              if (view.state.doc !== prev.doc) schedule();
              else if (pending.get(view) && !view.composing) schedule();
            },
            destroy() {
              observer.disconnect();
              cancelAnimationFrame(frame);
            },
          };
        },
      }),
    ];
  },
});
