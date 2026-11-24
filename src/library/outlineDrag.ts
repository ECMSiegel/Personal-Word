import { parseKey, type ItemKey } from "./folders";

export type RowRect = {
  key: ItemKey;
  kind: "folder" | "project";
  container: string;
  depth: number;
  expandedWithRows: boolean;
  pinnedTop: boolean;
  ancestors: string[];
  rect: { left: number; top: number; width: number; height: number };
};

export type Drop =
  | { kind: "before" | "after"; key: ItemKey; container: string }
  | { kind: "into"; folder: string }
  | { kind: "end" };

/**
 * Where a dragged row would land if released at `point`. Pure: the caller measures the rows.
 * Zones (Decision 10): project row -> top half before, bottom half after. Folder row that is
 * collapsed or empty -> thirds before / into / after. Expanded folder with rows -> top third
 * before, the rest into. A point at or below `listBottom` is the blank area: top level, last.
 * Null means "no drop here". With `foldersFirst` the display keeps folders grouped above projects,
 * so a before/after of the other kind would draw a line where the row will not end up: a project
 * over a folder row gets "into" over the whole row, a folder over a project row gets null.
 */
export function outlineDropTarget(
  point: { x: number; y: number },
  rects: RowRect[],
  dragged: ItemKey,
  listBottom: number,
  foldersFirst = false,
): Drop | null {
  if (point.y >= listBottom) return { kind: "end" };
  const row = rects.find(
    (r) =>
      point.x >= r.rect.left &&
      point.x < r.rect.left + r.rect.width &&
      point.y >= r.rect.top &&
      point.y < r.rect.top + r.rect.height,
  );
  if (!row || row.key === dragged) return null;
  const drag = parseKey(dragged);
  if (drag.kind === "folder" && row.ancestors.includes(drag.id)) return null;

  const folderId = parseKey(row.key).id;
  if (foldersFirst && row.kind !== drag.kind) {
    return row.kind === "folder" ? { kind: "into", folder: folderId } : null;
  }
  if (row.pinnedTop) return row.kind === "folder" ? { kind: "into", folder: folderId } : null;

  const t = (point.y - row.rect.top) / row.rect.height;
  if (row.kind === "project") {
    return { kind: t < 0.5 ? "before" : "after", key: row.key, container: row.container };
  }
  if (t < 1 / 3) return { kind: "before", key: row.key, container: row.container };
  if (row.expandedWithRows || t < 2 / 3) return { kind: "into", folder: folderId };
  return { kind: "after", key: row.key, container: row.container };
}
