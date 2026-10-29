// Magnifying dock for the formatting bar's icons.
// Reference: https://bencho.dev/blocks/dock and https://bencho.dev/?c=dock&theme=dark
// owner statement 2026-10-28: both are free to use. Re-implemented/adapted for Personal Word:
// the block's source is not readable from the page, so this is the standard dock curve
// (cosine falloff) with the plan's constants (peak 1.5, radius 84 px). No framer-motion:
// the scale is written as the CSS variable --dock-scale and animated by a CSS transition
// (src/editor/toolbar-motion.css). Reduce Motion: no magnification at all.
import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "../motion";

export const DOCK_RADIUS = 84;
export const DOCK_PEAK = 1.5;

/** 1 at or beyond the radius, `peak` at 0, cosine in between. */
export function dockScale(distancePx: number, radius = DOCK_RADIUS, peak = DOCK_PEAK): number {
  const d = Math.abs(distancePx);
  if (!(d < radius)) return 1;
  return 1 + (peak - 1) * (0.5 + 0.5 * Math.cos((Math.PI * d) / radius));
}

/** Keyboard focus: the focused icon peaks, its neighbours step down by index distance. */
export function keyboardScale(indexDistance: number): number {
  const d = Math.abs(indexDistance);
  if (d === 0) return DOCK_PEAK;
  if (d === 1) return 1.25;
  if (d === 2) return 1.1;
  return 1;
}

const ICONS = ".toolbar-icon:not([data-popover-item])";

export function useDock(bar: RefObject<HTMLElement | null>, remountKey?: unknown): void {
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;
    const icons = () => Array.from(el.querySelectorAll<HTMLElement>(ICONS));
    const reset = () => {
      for (const icon of icons()) icon.style.removeProperty("--dock-scale");
    };
    const flush = () => {
      frame = 0;
      const p = pending;
      pending = null;
      if (!p) return;
      for (const icon of icons()) {
        const r = icon.getBoundingClientRect();
        const dist = Math.hypot(p.x - (r.left + r.width / 2), p.y - (r.top + r.height / 2));
        icon.style.setProperty("--dock-scale", dockScale(dist).toFixed(3));
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || prefersReducedMotion()) return;
      el.removeAttribute("data-dock-key");
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onLeave = () => {
      pending = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (!el.hasAttribute("data-dock-key")) reset();
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (prefersReducedMotion() || !target?.matches?.(`${ICONS}:focus-visible`)) return;
      const list = icons();
      const at = list.indexOf(target);
      if (at < 0) return;
      pending = null;
      el.setAttribute("data-dock-key", "");
      list.forEach((icon, i) =>
        icon.style.setProperty("--dock-scale", keyboardScale(i - at).toString()),
      );
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && el.contains(next) && next.matches?.(ICONS)) return; // focusin re-sets
      el.removeAttribute("data-dock-key");
      reset();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      if (frame) cancelAnimationFrame(frame);
      el.removeAttribute("data-dock-key");
      reset();
    };
  }, [bar, remountKey]);
}
