import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ItemKey } from "./folders";
import { outlineDropTarget, type Drop, type RowRect } from "./outlineDrag";

/** Pixels of travel before a press becomes a drag; a smaller move stays a click. */
const THRESHOLD = 4;

/** Presses here never start a drag: the trash button, a folder's chevron, the rename field. */
const NO_DRAG = ".delete-entry, .folder-chevron, input, textarea, [role='menu']";

/** What the outline model knows about a drawn row and the DOM does not (OB5a's RowRect less `rect`). */
export type DragRowInfo = Omit<RowRect, "rect">;

/** Every drawn `.outline-row` with its box; rows the model does not know are left out. */
function measure(tree: HTMLElement, info: (key: ItemKey) => DragRowInfo | undefined) {
  const rects: RowRect[] = [];
  let listBottom = -Infinity;
  for (const row of tree.querySelectorAll<HTMLElement>(".outline-row[data-key]")) {
    const known = info(row.dataset.key as ItemKey);
    const r = row.getBoundingClientRect();
    listBottom = Math.max(listBottom, r.bottom);
    if (known) rects.push({ ...known, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
  }
  return { rects, listBottom };
}

/**
 * Pointer dragging on the Projects outline (OB5). Spread `onPointerDown` on the outline root. A
 * press on a row that travels 4 px becomes a drag (rows in the pinned band never drag): `drag`
 * names the source and the current drop from `outlineDropTarget` (the caller draws the state).
 * Release applies through `onDrop`; Escape or pointercancel cancels. Rows are measured on every
 * move, so scrolling mid-drag is fine. Nothing else moves while dragging, and the click that ends
 * a real drag is swallowed, so it neither opens a project nor toggles a folder.
 */
export function useLibraryDrag({
  tree,
  enabled,
  info,
  foldersFirst,
  onDrop,
}: {
  tree: RefObject<HTMLElement | null>;
  /** Off while searching or before the library has loaded. */
  enabled: boolean;
  /** The model's facts about a drawn row (container, depth, ancestors, pinned band...). */
  info: (key: ItemKey) => DragRowInfo | undefined;
  /** Folders on top: a before/after of the other kind is not offered (outlineDropTarget). */
  foldersFirst: boolean;
  onDrop: (source: ItemKey, drop: Drop) => void;
}): {
  drag: { source: ItemKey; drop: Drop | null } | null;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
} {
  const [drag, setDrag] = useState<{ source: ItemKey; drop: Drop | null } | null>(null);
  const latest = useRef({ info, onDrop, foldersFirst });
  latest.current = { info, onDrop, foldersFirst };
  const stop = useRef<(() => void) | null>(null);
  const end = useCallback(() => {
    stop.current?.();
    stop.current = null;
    setDrag(null);
  }, []);
  useEffect(() => end, [end]);
  useEffect(() => {
    if (!enabled) end();
  }, [enabled, end]);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || e.button !== 0 || !e.isPrimary || !tree.current) return;
    const target = e.target as Element;
    if (target.closest(NO_DRAG)) return;
    const row = target.closest<HTMLElement>(".outline-row[data-key]");
    if (!row || !tree.current.contains(row)) return;
    const source = row.dataset.key as ItemKey;
    const known = latest.current.info(source);
    if (!known || known.pinnedTop) return;
    end();
    const start = { x: e.clientX, y: e.clientY };
    let active = false;
    /** Escape ended the drag; the release still must not click. */
    let cancelled = false;
    let drop: Drop | null = null;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (ev.buttons === 0) return end();
      if (cancelled) return;
      if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
      if (!active) window.getSelection()?.removeAllRanges();
      active = true;
      const el = tree.current;
      if (!el) return end();
      const { rects, listBottom } = measure(el, latest.current.info);
      drop = outlineDropTarget({ x: ev.clientX, y: ev.clientY }, rects, source, listBottom, latest.current.foldersFirst);
      const now = drop;
      setDrag((old) =>
        old && JSON.stringify(old.drop) === JSON.stringify(now) ? old : { source, drop: now },
      );
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dropped = active ? drop : null;
      const dragged = active || cancelled;
      end();
      if (!dragged) return;
      // The click that ends a drag must not open the project or toggle the folder.
      const swallow = (c: Event) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      if (dropped) latest.current.onDrop(source, dropped);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || !active) return;
      ev.preventDefault();
      ev.stopPropagation();
      active = false;
      cancelled = true;
      drop = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("keydown", key, true);
    stop.current = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("keydown", key, true);
    };
  };

  return { drag, onPointerDown };
}
