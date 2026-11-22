// Pure drop rules for dragging on the Projects page (FB5). The hook in useLibraryDrag.ts measures
// the rows and headings and calls this; nothing here touches the DOM.

export type DOMRectLike = { left: number; top: number; width: number; height: number };
export type DragItem = { id: string; kind: "project" | "folder" };
/** A project row (`container` = its folder id or "root") or a folder heading (`container` =
 *  its parent folder id or "root"). */
export type DropRect = DragItem & { container: string; rect: DOMRectLike };
export type Drop =
  | { kind: "before" | "after"; id: string; container: string }
  | { kind: "into"; folder: string };

const inside = (p: { x: number; y: number }, r: DOMRectLike) =>
  p.x >= r.left && p.x < r.left + r.width && p.y >= r.top && p.y < r.top + r.height;

/**
 * Where a drag released at `point` would land. A project over another project: before or after it
 * by the row's vertical midpoint (list) or the card's horizontal midpoint (cards). A project over a
 * folder heading: into that folder (none when it is already there). A folder over a sibling's
 * heading: before or after it by the heading's vertical midpoint. Anything else: null.
 */
export function dropTarget(
  point: { x: number; y: number },
  rects: DropRect[],
  view: "list" | "cards",
  dragged: DragItem,
): Drop | null {
  const self = (r: DragItem) => r.kind === dragged.kind && r.id === dragged.id;
  const hit = rects.find((r) => !self(r) && inside(point, r.rect));
  if (!hit) return null;
  const own = rects.find(self);
  const half = (horizontal: boolean) =>
    horizontal
      ? point.x < hit.rect.left + hit.rect.width / 2
      : point.y < hit.rect.top + hit.rect.height / 2;
  if (dragged.kind === "project") {
    if (hit.kind === "folder")
      return own?.container === hit.id ? null : { kind: "into", folder: hit.id };
    return { kind: half(view === "cards") ? "before" : "after", id: hit.id, container: hit.container };
  }
  if (hit.kind !== "folder" || !own || own.container !== hit.container) return null;
  return { kind: half(false) ? "before" : "after", id: hit.id, container: hit.container };
}
