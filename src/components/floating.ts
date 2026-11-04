import { useEffect, useRef, useState, type RefObject } from "react";

export const FLOAT_GAP = 16;
export const SIDEBAR_MIN = 190;
export const CARD_MIN = 280;
export const CARD_MAX = 360;
// Focus mode reserves the reveal band above the content (toolbar-motion.css:58-68).
export const FOCUS_REVEAL_BAND = "calc(var(--control-height) + 2 * var(--space-1))";

/** documentOnScreen false (a destination page or Versions covers the document): does not fit.
 *  key: any change re-measures (App folds in the project, destination, entry, zoom and
 *  focus mode -- none of them resizes the observed elements). */
export type FloatContext = {
  mode: "write" | "read";
  paged: boolean;
  split: boolean;
  documentOnScreen?: boolean;
  key?: string;
  /** Layout zoom (%): page view divides it out of the sheet's zoom to get its fit-to-pane scale. */
  zoom?: number;
};
export type Fit = { fits: boolean; width: number };

export function marginFit(side: "left" | "right", marginPx: number, wanted: number): Fit {
  const min = side === "left" ? SIDEBAR_MIN : CARD_MIN;
  const max = side === "right" ? CARD_MAX : wanted;
  const width = Math.min(max, wanted, marginPx - 2 * FLOAT_GAP);
  return { fits: width >= min, width: Math.max(0, width) };
}

/** Native WebKit (unlike Chromium) reports the rect of an element under CSS `zoom`
 * (the page sheet, Writer.tsx) in that element's own zoomed space: drawn size / zoom.
 * Probed once with a zoomed element. */
let unzoomedRects: boolean | undefined;
function reportsUnzoomedRects() {
  if (unzoomedRects === undefined) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:1px;zoom:0.5";
    document.body.appendChild(probe);
    unzoomedRects = probe.getBoundingClientRect().width > 75;
    probe.remove();
  }
  return unzoomedRects;
}

/** The element's zoom times every ancestor's. */
function totalZoom(el: Element | null) {
  let zoom = 1;
  if (typeof window === "undefined") return zoom;
  for (let n = el; n; n = n.parentElement) zoom *= parseFloat(getComputedStyle(n).zoom) || 1;
  return zoom;
}

/** A column's left/right in drawn pixels. */
export function drawnEdges(r: { left: number; right: number }, zoom: number, unzoomed: boolean) {
  return unzoomed && zoom !== 1 ? { left: r.left * zoom, right: r.right * zoom } : { left: r.left, right: r.right };
}

/** Widest the measured column can grow, in px, when its pane is squeezed (continuous view:
 * `.editor-paper` has max-width var(--page-width) and fills a narrower pane; the text column
 * inside is that width less the paper padding). undefined: the column keeps its width. */
function columnMaxWidth(doc: HTMLElement, ctx: FloatContext, width: number, zoom: number, unzoomed: boolean) {
  if (ctx.paged || ctx.mode === "read") return undefined;
  const paper = doc.closest<HTMLElement>(".editor-paper");
  if (!paper) return undefined;
  const max = parseFloat(getComputedStyle(paper).maxWidth);
  if (!Number.isFinite(max)) return undefined;
  // Everything in drawn px: the CSS max-width is unzoomed, the paper is drawn at its zoom, and
  // native WebKit reports rect widths in zoomed space (see drawnEdges).
  const k = unzoomed ? zoom : 1;
  return drawnColumnMax(max, totalZoom(paper), paper.getBoundingClientRect().width * k, width * k);
}

/** Widest the column can grow, in drawn px: the paper's unzoomed CSS max-width drawn at its zoom,
 * less the paper padding (paper width minus column width, both already drawn px). */
export function drawnColumnMax(cssMax: number, paperZoom: number, paperDrawn: number, columnDrawn: number) {
  return cssMax * paperZoom - (paperDrawn - columnDrawn);
}

/** How the measured column follows the workspace width: it is the room inside the editor viewport
 * (the workspace less `pad`: viewport padding and scrollbar, plus the paper padding in continuous
 * view) up to `colMax` (drawn px). Page view: the sheet scales down to the pane (Writer.tsx fitScale),
 * so its widest is the drawn sheet / fitScale. undefined (Read): the column keeps its width. */
function columnGrowth(doc: HTMLElement, host: Element, ctx: FloatContext, width: number, zoom: number, unzoomed: boolean) {
  if (ctx.mode === "read") return undefined;
  const viewport = doc.closest<HTMLElement>(".editor-viewport");
  if (!viewport) return undefined;
  const vs = getComputedStyle(viewport);
  const available = viewport.clientWidth - parseFloat(vs.paddingLeft) - parseFloat(vs.paddingRight);
  const hostPad = host.getBoundingClientRect().width - available;
  const k = unzoomed ? zoom : 1;
  if (ctx.paged) {
    // The sheet's own zoom is layout zoom x fitScale; without the layout zoom assume it is unscaled.
    const own = parseFloat(getComputedStyle(doc).zoom) || 1;
    const colMax = ctx.zoom ? (width * k * ctx.zoom) / 100 / own : width * k;
    return { colMax, pad: hostPad };
  }
  const colMax = columnMaxWidth(doc, ctx, width, zoom, unzoomed);
  const paper = doc.closest<HTMLElement>(".editor-paper");
  if (colMax === undefined || !paper) return undefined;
  return { colMax, pad: hostPad + (paper.getBoundingClientRect().width - width) * k };
}

/** Measured elements: .editor-paper (paged), .writing-surface (continuous),
 * .read-prose (ReadDocument text column, App.tsx:2424), .format-bar and .pane-footer. */
export function documentEdges(root: ParentNode, ctx: FloatContext) {
  if (ctx.split || ctx.documentOnScreen === false) return null;
  const doc = ctx.mode === "read"
    ? root.querySelector<HTMLElement>(".manuscript-read .read-prose")
    : root.querySelector<HTMLElement>(ctx.paged ? ".editor-paper" : ".writing-surface");
  if (!doc) return null;
  const r = doc.getBoundingClientRect();
  const bar = root.querySelector<HTMLElement>(".format-bar");
  const footer = root.querySelector<HTMLElement>(".pane-footer");
  const focus = root.querySelector<HTMLElement>(".writer[data-focus-toolbar]");
  const barBottom = bar?.getBoundingClientRect().bottom ?? r.top;
  const writer = focus?.getBoundingClientRect();
  const band = focus ? parseFloat(getComputedStyle(focus).getPropertyValue("--control-height")) +
    2 * parseFloat(getComputedStyle(focus).getPropertyValue("--space-1")) : 0;
  const top = focus && writer ? writer.top + band : barBottom;
  const bottom = footer?.getBoundingClientRect().top ?? (typeof window === "undefined" ? 0 : window.innerHeight);
  const zoom = totalZoom(doc);
  const unzoomed = zoom !== 1 && reportsUnzoomedRects();
  const { left, right } = drawnEdges(r, zoom, unzoomed);
  const growth = "getBoundingClientRect" in root ? columnGrowth(doc, root as Element, ctx, r.width, zoom, unzoomed) : undefined;
  return { left, right, top, bottom, ...growth };
}

/** What the right and left of the workspace row can hold, in px. sidebar: the room the pinned
 * sidebar takes when it is docked (0 when it never docks). aside: the room an open right aside
 * takes (panel + resizer; 0 when none). asideStays: the card cannot replace it (fragment library,
 * full research panel), so it is there whatever the right side decides. */
export type Room = { sidebar: number; aside: number; asideStays: boolean };

/** The workspace row, measured the same in every state: row width, how the column follows the
 * workspace (pad/colMax; colMax alone: a fixed column), and skew = (left - right margin) / 2. */
export type Row = { row: number; colMax: number; pad?: number; skew: number };

const none: Fit = { fits: false, width: 0 };

/** Both sides decided together. Each candidate end state (both floating, sidebar only, card only,
 * neither) is laid out from the row alone -- workspace = row less what stays docked, column =
 * min(colMax, workspace - pad), centred -- and the most floating one whose margins fit wins.
 * Nothing here depends on what is docked now, so the result holds in the state it produces. */
export function jointFit(row: Row, room: Room, sidebarWanted: number) {
  for (const [floatLeft, card] of [[true, true], [true, false], [false, true], [false, false]]) {
    const ws = row.row - (floatLeft ? 0 : room.sidebar) - (room.aside && (room.asideStays || !card) ? room.aside : 0);
    const column = row.pad === undefined ? row.colMax : Math.min(row.colMax, ws - row.pad);
    const margin = (ws - column) / 2;
    const left = floatLeft ? marginFit("left", margin + row.skew, sidebarWanted) : none;
    const right = card ? marginFit("right", margin - row.skew, CARD_MAX) : none;
    if ((!floatLeft || left.fits) && (!card || right.fits)) return { left, right };
  }
  return { left: none, right: none };
}

const noRoom = (): Room => ({ sidebar: 0, aside: 0, asideStays: true });

export function useMarginFit(
  root: RefObject<HTMLElement | null>,
  ctx: FloatContext,
  enabled: boolean,
  sidebarWidth = 270,
  room: () => Room = noRoom,
) {
  const [value, setValue] = useState({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 });
  // The latest render's room (it reads App state), not the one from when the effect ran.
  const roomRef = useRef(room);
  roomRef.current = room;
  useEffect(() => {
    if (!enabled) { setValue({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 }); return; }
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const e = documentEdges(host, ctx);
      if (!e) { setValue({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 }); return; }
      const rect = host.getBoundingClientRect();
      const row = (host.parentElement ?? host).getBoundingClientRect().width;
      const skew = ((e.left - rect.left) - (rect.right - e.right)) / 2;
      const fit = jointFit({ row, colMax: e.colMax ?? e.right - e.left, pad: e.pad, skew }, roomRef.current(), sidebarWidth);
      setValue({ ...fit, top: e.top, bottom: e.bottom });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    const target = host.querySelector(ctx.mode === "read" ? ".manuscript-read .read-prose" : ctx.paged ? ".editor-paper" : ".writing-surface");
    if (target) observer.observe(target);
    window.addEventListener("resize", schedule);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [root, ctx.mode, ctx.paged, ctx.split, ctx.documentOnScreen, ctx.key, ctx.zoom, enabled, sidebarWidth]);
  return value;
}
