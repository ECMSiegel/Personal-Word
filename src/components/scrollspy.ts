// Scrollspy line navigation for the sidebar's Manuscript rows.
// Reference: https://kit.cuedesign.space/components/scrollspy-line-navigation
// Source repo: https://github.com/aloksivastava1025-prog/cue-foundations (README: MIT)
// owner: free to use (owner statement 2026-10-28: both are free to use). Adapted for Personal Word:
// the one-third-viewport rule, the "last section at the bottom" rule and the easeInOutQuart
// scroll are kept; the fixed page-level placement, the tooltip and the viewport hiding are
// dropped (the lines live inside the sidebar rows). Scripted scroll is requestAnimationFrame
// on scrollTop, never CSS motion. No new packages.
//
// Wave 5 A3: lines on every Manuscript, Fragments and Research row, magnified by pointer
// proximity (useSpyDock, the formatting bar's dock curve) and filled by scroll progress.
// Which element scrolls the editor (measured 2026-11-01, Chromium 1280x800, step 2 of A3,
// node_modules/.cache/personal-word-beta/ui5-a3/scroller-probe.log): `.writer-scroll` in
// continuous view, in page view and in each split pane; `.editor-viewport.is-paged` never
// scrolls (its scrollHeight equals its clientHeight). A single pane also sits inside
// `.split-pane[data-side="left"]`, so the focused pane's scroller is
// `.split-pane[data-side=<focused>] .writer-scroll`. Read mode scrolls `.manuscript-read`.
import { useEffect, useRef, useState, type RefObject } from "react";
import { DOCK_PEAK, dockScale } from "./dock";
import { prefersReducedMotion } from "../motion";

/** Pointer distance (px) at which a line stops growing: about two and a half rows. */
export const SPY_RADIUS = 84;

/** 0..1 magnification of a line `dyPx` from the pointer: 1 at 0, 0 at or beyond `radius`,
 *  the dock's cosine falloff rescaled from 1..DOCK_PEAK. */
export function spyMagnify(dyPx: number, radius = SPY_RADIUS): number {
  return (dockScale(dyPx, radius) - 1) / (DOCK_PEAK - 1);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** How far a scroll view is scrolled, 0..1; 1 when nothing scrolls. */
export function scrollProgress(scrollTop: number, clientHeight: number, scrollHeight: number): number {
  const max = scrollHeight - clientHeight;
  return max <= 0 ? 1 : clamp01(scrollTop / max);
}

/** How far the one-third line of the viewport is through a section (0..1). `top` is the
 *  section's top from the top of the view; `atBottom` (scrolled to the end, last section) is 1. */
export function sectionProgress(top: number, height: number, viewportHeight: number, atBottom: boolean): number {
  if (atBottom) return 1;
  const into = viewportHeight / 3 - top;
  if (height <= 0) return into > 0 ? 1 : 0;
  return clamp01(into / height);
}

/**
 * Index of the active section. `tops` are the sections' top edges measured from the top of
 * the scroll view (negative = scrolled past). Active = the last section whose top is at or
 * above one third of the viewport; the last section when scrolled to the bottom; 0 if none.
 */
export function activeIndex(tops: number[], viewportHeight: number, atBottom: boolean): number {
  if (tops.length === 0) return 0;
  if (atBottom) return tops.length - 1;
  const line = viewportHeight / 3;
  let found = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) found = i;
  return found;
}

/** Ease-in-out quartic: 0 -> 0, 0.5 -> 0.5, 1 -> 1. Input clamped to 0..1. */
export function quartic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

/**
 * Scrolls `scroller` to `top` with the quartic ease (600 ms by default). Instant when
 * `opts.instant` or Reduce Motion. Returns a cancel function; `onDone` runs when the scroll finishes on its own; the caller may also cancel
 * on wheel or touch to make the scroll interruptible.
 */
export function easedScrollTo(
  scroller: HTMLElement,
  top: number,
  opts: { duration?: number; instant?: boolean; onDone?: () => void } = {},
): () => void {
  if (opts.instant || prefersReducedMotion()) {
    scroller.scrollTop = top;
    opts.onDone?.();
    return () => {};
  }
  const duration = opts.duration ?? 600;
  const from = scroller.scrollTop;
  const start = performance.now();
  let cancelled = false;
  let handle = 0;
  const step = (now: number) => {
    if (cancelled) return;
    const p = Math.min(1, (now - start) / duration);
    scroller.scrollTop = p >= 1 ? top : from + (top - from) * quartic(p);
    if (p < 1) handle = requestAnimationFrame(step);
    else opts.onDone?.();
  };
  handle = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(handle);
  };
}

/** Active section id and how far the reader is through it while `enabled` (Read mode), from
 *  one passive capture scroll listener and a ResizeObserver. */
export function useReadSpy(
  enabled: boolean,
  ids: string[],
  getScroller: () => HTMLElement | null,
): { id: string | undefined; progress: number } {
  const [active, setActive] = useState<{ id: string | undefined; progress: number }>({ id: undefined, progress: 0 });
  const key = ids.join("\u0000");
  useEffect(() => {
    if (!enabled || ids.length === 0) {
      setActive({ id: undefined, progress: 0 });
      return;
    }
    const measure = () => {
      const scroller = getScroller();
      if (!scroller) return;
      const base = scroller.getBoundingClientRect().top;
      const boxes = ids.map((id) => document.getElementById(`read-${id}`)?.getBoundingClientRect());
      const tops = boxes.map((b) => (b ? b.top - base : Number.POSITIVE_INFINITY));
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 50;
      const index = activeIndex(tops, scroller.clientHeight, atBottom);
      const box = boxes[index];
      const progress = box
        ? sectionProgress(tops[index], box.height, scroller.clientHeight, atBottom && index === ids.length - 1)
        : 0;
      const next = ids[index];
      setActive((prev) =>
        prev.id === next && Math.abs(prev.progress - progress) < 0.001 ? prev : { id: next, progress },
      );
    };
    measure();
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    const scroller = getScroller();
    const ro = typeof ResizeObserver === "function" && scroller ? new ResizeObserver(measure) : null;
    if (ro && scroller) ro.observe(scroller);
    return () => {
      document.removeEventListener("scroll", measure, { capture: true });
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return enabled ? active : { id: undefined, progress: 0 };
}

/** Write mode: how far the focused pane's editor is scrolled (scrollProgress). One passive
 *  capture scroll listener, throttled to a frame; content growth (typing, switching entry or
 *  pane) is caught by a ResizeObserver on the scroller's content and a re-measure per render. */
export function useWriteProgress(enabled: boolean, getScroller: () => HTMLElement | null): number {
  const [progress, setProgress] = useState(0);
  const latest = useRef(getScroller);
  latest.current = getScroller;
  const remeasure = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let observed: Element | null = null;
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedule()) : null;
    const measure = () => {
      frame = 0;
      const el = latest.current();
      if (!el) return;
      const content = el.firstElementChild;
      if (ro && content !== observed) {
        if (observed) ro.unobserve(observed);
        if (content) ro.observe(content);
        observed = content;
      }
      const next = scrollProgress(el.scrollTop, el.clientHeight, el.scrollHeight);
      setProgress((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    remeasure.current = schedule;
    measure();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      remeasure.current = () => {};
      document.removeEventListener("scroll", schedule, { capture: true });
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [enabled]);
  // A render may switch the entry or the focused pane: measure again on the next frame.
  useEffect(() => remeasure.current());
  return enabled ? progress : 0;
}

const LINES = ".spy-rail > button.spy-line";

/** Pointer distance (px) at which a rail line stops growing: three lines (the rail's pitch is 12 px). */
export const RAIL_RADIUS = 36;

/** A text's first words: whitespace collapsed, at most `max` characters, "..." when cut. */
export function previewText(text: string | undefined, max = 120): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "\u2026" : flat;
}

/** Keyboard focus: the focused line peaks, its neighbours step down by distance in the rail. */
function keyboardMagnify(rowDistance: number): number {
  const d = Math.abs(rowDistance);
  return d === 0 ? 1 : d === 1 ? 0.5 : d === 2 ? 0.2 : 0;
}

/** The rail line a focused element stands for: the line itself, or the row button with its id. */
function lineFor(container: HTMLElement, target: HTMLElement | null): HTMLElement | null {
  if (!target) return null;
  if (target.matches(LINES)) return target;
  const id = target.matches(".entry-main[data-row-id]") ? target.getAttribute("data-row-id") : null;
  if (!id) return null;
  const group = target.closest(".sidebar-group");
  return (
    Array.from((group ?? container).querySelectorAll<HTMLElement>(LINES)).find(
      (l) => l.getAttribute("data-row-id") === id,
    ) ?? null
  );
}

/** Proximity magnify for the sidebar's rail lines: writes `--spy-mag` (0..1) on the lines of the
 *  rail under the pointer (spyMagnify, RAIL_RADIUS); a row under the pointer counts as its own
 *  line, so hovering a row magnifies that row's line exactly as the pointer on the line would. Keyboard focus on a line or its row sets
 *  1 / 0.5 / 0.2 by distance in the rail at once (`data-spy-key` turns the transition off).
 *  Touch and Reduce Motion: nothing is written. */
export function useSpyDock(container: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let frame = 0;
    // `line` is set when a row stands in for the pointer: its line's centre is the pointer's y.
    let pointer: { y: number; rail: Element; line?: HTMLElement } | null = null;
    const lines = () => Array.from(el.querySelectorAll<HTMLElement>(LINES));
    const reset = () => {
      for (const line of lines()) line.style.removeProperty("--spy-mag");
    };
    const flush = () => {
      frame = 0;
      if (!pointer) return;
      const anchor = pointer.line?.getBoundingClientRect();
      const y = anchor ? anchor.top + anchor.height / 2 : pointer.y;
      for (const line of lines()) {
        if (line.parentElement !== pointer.rail) {
          line.style.removeProperty("--spy-mag");
          continue;
        }
        const r = line.getBoundingClientRect();
        if (!r.height) continue;
        // The line's resting centre: a transform does not move its layout box's centre.
        line.style.setProperty("--spy-mag", spyMagnify(y - (r.top + r.height / 2), RAIL_RADIUS).toFixed(3));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const clearPointer = () => {
      pointer = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (!el.hasAttribute("data-spy-key")) reset();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || prefersReducedMotion()) return;
      const target = e.target as Element | null;
      const rail = target?.closest?.(".spy-rail") ?? null;
      // Over a row (not the rail), its own line stands in for the pointer: the rail magnifies
      // exactly as if the pointer were on that line, and the anchor keeps it there on scroll.
      const row = rail ? null : (target?.closest?.(".entry-main[data-row-id]") as HTMLElement | null | undefined);
      const rowLine = row ? lineFor(el, row) : null;
      const rowRail = rowLine?.parentElement ?? null;
      if (rowLine && rowRail && el.contains(rowRail)) {
        el.removeAttribute("data-spy-key");
        pointer = { y: e.clientY, rail: rowRail, line: rowLine };
        schedule();
        return;
      }
      if (!rail || !el.contains(rail)) {
        if (pointer) clearPointer();
        return;
      }
      el.removeAttribute("data-spy-key");
      pointer = { y: e.clientY, rail };
      schedule();
    };
    const onScroll = () => {
      if (pointer) schedule();
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (prefersReducedMotion() || !target?.matches?.(":focus-visible")) return;
      const own = lineFor(el, target);
      if (!own?.parentElement) return;
      const list = Array.from(own.parentElement.children).filter((c) => c.matches(".spy-line")) as HTMLElement[];
      const at = list.indexOf(own);
      if (at < 0) return;
      pointer = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.setAttribute("data-spy-key", "");
      for (const line of lines()) line.style.removeProperty("--spy-mag");
      list.forEach((line, i) => line.style.setProperty("--spy-mag", keyboardMagnify(i - at).toString()));
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!el.hasAttribute("data-spy-key")) return;
      const next = e.relatedTarget as HTMLElement | null;
      if (next && el.contains(next) && lineFor(el, next)) return;
      el.removeAttribute("data-spy-key");
      reset();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", clearPointer);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", clearPointer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      if (frame) cancelAnimationFrame(frame);
      el.removeAttribute("data-spy-key");
      reset();
    };
  }, [container]);
}
