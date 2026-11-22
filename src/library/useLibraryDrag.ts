import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { ROOT } from "./folders";
import { dropTarget, type DragItem, type Drop, type DropRect } from "./libraryDrag";

/** Pixels of travel before a press becomes a drag; a smaller move stays a click. */
const THRESHOLD = 4;

/** Presses here never start a drag: the trash button, a folder's chevron, the rename field. */
const NO_DRAG = ".delete-entry, .folder-chevron, input, textarea, [role='menu']";

function measure(tree: HTMLElement): DropRect[] {
  const rects: DropRect[] = [];
  for (const row of tree.querySelectorAll<HTMLElement>("[data-container] > [data-project-id]"))
    rects.push({
      id: row.dataset.projectId!,
      kind: "project",
      container: row.parentElement!.dataset.container!,
      rect: row.getBoundingClientRect(),
    });
  for (const heading of tree.querySelectorAll<HTMLElement>("[data-folder-heading]")) {
    const parent = heading.parentElement?.parentElement?.closest<HTMLElement>("[data-folder-id]");
    rects.push({
      id: heading.dataset.folderHeading!,
      kind: "folder",
      container: parent?.dataset.folderId ?? ROOT,
      rect: heading.getBoundingClientRect(),
    });
  }
  return rects;
}

/**
 * Pointer dragging on the Projects page (FB5 step 4). Spread `onPointerDown` on the tree. A press on
 * a project row or a folder heading that travels 4 px becomes a drag: `drag` names the source and
 * the current drop (from `dropTarget`; the caller draws `data-drag-state`, `data-drag-edge` and
 * `data-drop-into`). Release applies through `onDrop`; Escape or pointercancel cancels. Rows are
 * measured on every move, so scrolling mid-drag is fine. Nothing else moves while dragging, and the
 * click that ends a real drag is swallowed, so it neither opens a project nor toggles a folder.
 */
export function useLibraryDrag({
  tree,
  enabled,
  view,
  onDrop,
}: {
  tree: RefObject<HTMLElement | null>;
  /** Off while searching or before the library has loaded. */
  enabled: boolean;
  view: "list" | "cards";
  onDrop: (source: DragItem, drop: Drop) => void;
}): {
  drag: { source: DragItem; drop: Drop | null } | null;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
} {
  const [drag, setDrag] = useState<{ source: DragItem; drop: Drop | null } | null>(null);
  const latest = useRef({ view, onDrop });
  latest.current = { view, onDrop };
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
    const row = target.closest<HTMLElement>("[data-container] > [data-project-id]");
    const heading = row ? null : target.closest<HTMLElement>("[data-folder-heading]");
    const source: DragItem | null = row
      ? { id: row.dataset.projectId!, kind: "project" }
      : heading
        ? { id: heading.dataset.folderHeading!, kind: "folder" }
        : null;
    if (!source || !tree.current.contains(row ?? heading)) return;
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
      drop = dropTarget({ x: ev.clientX, y: ev.clientY }, measure(el), latest.current.view, source);
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
