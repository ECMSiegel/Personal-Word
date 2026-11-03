import { useEffect, useState, type RefObject } from "react";

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
  const { left, right } = drawnEdges(r, zoom, zoom !== 1 && reportsUnzoomedRects());
  return { left, right, top, bottom };
}

export function useMarginFit(root: RefObject<HTMLElement | null>, ctx: FloatContext, enabled: boolean, sidebarWidth = 270) {
  const [value, setValue] = useState({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 });
  useEffect(() => {
    if (!enabled) { setValue({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 }); return; }
    const host = root.current;
    if (!host) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const e = documentEdges(host, ctx);
      if (!e) { setValue({ left: { fits: false, width: 0 }, right: { fits: false, width: 0 }, top: 0, bottom: 0 }); return; }
      const leftMargin = e.left - host.getBoundingClientRect().left;
      const rightMargin = host.getBoundingClientRect().right - e.right;
      setValue({ left: marginFit("left", leftMargin, sidebarWidth), right: marginFit("right", rightMargin, CARD_MAX), top: e.top, bottom: e.bottom });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    const target = host.querySelector(ctx.mode === "read" ? ".manuscript-read .read-prose" : ctx.paged ? ".editor-paper" : ".writing-surface");
    if (target) observer.observe(target);
    window.addEventListener("resize", schedule);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [root, ctx.mode, ctx.paged, ctx.split, ctx.documentOnScreen, ctx.key, enabled, sidebarWidth]);
  return value;
}
