import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { DragController, dropEdge, shiftFor } from "./dragReorder";
import type { DragSnapshot } from "./dragReorder";

type Options<T> = {
  items: readonly T[];
  onReorder: (from: number, to: number) => void;
  axis?: "y";
  /** Pixels of travel before a press becomes a drag (smaller moves stay clicks). */
  threshold?: number;
};

type RowProps = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  style: CSSProperties | undefined;
  "data-drag-index": number;
  "data-drag-state"?: "lifted" | "shifted";
  "data-drag-edge"?: "top" | "bottom";
};

/**
 * Pointer-based drag-to-reorder for a vertical list (see drag-reorder.css; import it once where rows render).
 * Spread `rowProps(index)` on every row; rows must share one parent and sit in list order. Only `transform` is
 * animated. The lifted row follows the pointer, siblings step aside, the target row shows a 2 px accent drop line.
 * Escape or pointercancel cancels. Keyboard reordering stays on the caller (the existing move buttons), and the
 * click that ends a real drag is swallowed so the row's own action does not fire.
 */
export function useDragReorder<T>({ items, onReorder, threshold = 5 }: Options<T>) {
  const [snap, setSnap] = useState<DragSnapshot | null>(null);
  const heights = useRef<number[]>([]);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const controller = useMemo(() => new DragController(threshold, (f, t) => onReorderRef.current(f, t)), [threshold]);
  const captured = useRef<{ el: HTMLElement; id: number } | null>(null);

  const release = useCallback(() => {
    const c = captured.current;
    captured.current = null;
    if (c && c.el.hasPointerCapture?.(c.id)) c.el.releasePointerCapture(c.id);
  }, []);

  const cancel = useCallback(() => {
    controller.cancel();
    release();
    setSnap(null);
  }, [controller, release]);

  useEffect(() => {
    if (!snap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [snap !== null, cancel]);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    const rows = Array.from(parent.querySelectorAll<HTMLElement>(":scope > [data-drag-index]"));
    if (rows.length !== items.length) return;
    const rects = rows.map((r) => r.getBoundingClientRect());
    heights.current = rects.map((r) => r.height);
    // A release outside the row never reaches the row's onPointerUp: disarm on any window release too.
    const disarm = () => {
      window.removeEventListener("pointerup", disarm, true);
      window.removeEventListener("pointercancel", disarm, true);
      if (!captured.current) controller.cancel();
    };
    window.addEventListener("pointerup", disarm, true);
    window.addEventListener("pointercancel", disarm, true);
    controller.down(e.clientY, index, rects.map((r) => r.top), heights.current);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = controller.move(e.clientY, e.buttons);
    if (!s) {
      if (e.buttons === 0 && snap) cancel();
      return;
    }
    if (!captured.current) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      captured.current = { el: e.currentTarget, id: e.pointerId };
    }
    setSnap((old) => (old && old.from === s.from && old.to === s.to && old.dy === s.dy ? old : { ...s }));
  };

  const onPointerUp = () => {
    const dragged = controller.up();
    release();
    setSnap(null);
    if (dragged) {
      const swallow = (ev: Event) => ev.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    }
  };

  const rowProps = (index: number): RowProps => {
    const base: RowProps = {
      onPointerDown: onPointerDown(index),
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      style: undefined,
      "data-drag-index": index,
    };
    if (!snap) return base;
    if (index === snap.from) {
      return { ...base, style: { transform: `translateY(${snap.dy}px)` }, "data-drag-state": "lifted" };
    }
    const shift = shiftFor(index, snap.from, snap.to, heights.current);
    const edge = dropEdge(snap.from, snap.to);
    const out: RowProps = { ...base, style: { transform: `translateY(${shift}px)` }, "data-drag-state": "shifted" };
    if (edge && edge.index === index) out["data-drag-edge"] = edge.edge;
    return out;
  };

  return { rowProps, dragging: snap ? { from: snap.from, to: snap.to } : null };
}
