// Scrollspy line navigation for the sidebar's Manuscript rows.
// Reference: https://kit.cuedesign.space/components/scrollspy-line-navigation
// Source repo: https://github.com/aloksivastava1025-prog/cue-foundations (README: MIT)
// owner: free to use (owner statement 2026-10-28: both are free to use). Adapted for Personal Word:
// the one-third-viewport rule, the "last section at the bottom" rule and the easeInOutQuart
// scroll are kept; the fixed page-level placement, the tooltip and the viewport hiding are
// dropped (the lines live inside the sidebar rows). Scripted scroll is requestAnimationFrame
// on scrollTop, never CSS motion. No new packages.
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../motion";

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

/** Active section id while `enabled` (Read mode), from one passive capture scroll listener and a ResizeObserver. */
export function useReadSpy(
  enabled: boolean,
  ids: string[],
  getScroller: () => HTMLElement | null,
): string | undefined {
  const [active, setActive] = useState<string | undefined>(undefined);
  const key = ids.join("\u0000");
  useEffect(() => {
    if (!enabled || ids.length === 0) {
      setActive(undefined);
      return;
    }
    const measure = () => {
      const scroller = getScroller();
      if (!scroller) return;
      const base = scroller.getBoundingClientRect().top;
      const tops = ids.map((id) => {
        const el = document.getElementById(`read-${id}`);
        return el ? el.getBoundingClientRect().top - base : Number.POSITIVE_INFINITY;
      });
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 50;
      const next = ids[activeIndex(tops, scroller.clientHeight, atBottom)];
      setActive((prev) => (prev === next ? prev : next));
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
  return enabled ? active : undefined;
}
