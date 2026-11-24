# OB5a notes -- pure drop rules

Files: `src/library/outlineDrag.ts`, `src/library/outlineDrag.test.ts` (19 tests, all pass; written first, failed on the missing module).

## As built
```ts
export type RowRect = { key: ItemKey; kind: "folder" | "project"; container: string; depth: number;
  expandedWithRows: boolean; pinnedTop: boolean; ancestors: string[];
  rect: { left: number; top: number; width: number; height: number } };
export type Drop = { kind: "before" | "after"; key: ItemKey; container: string }
  | { kind: "into"; folder: string } | { kind: "end" };
export function outlineDropTarget(point: {x:number;y:number}, rects: RowRect[], dragged: ItemKey, listBottom: number): Drop | null
```

## Filling RowRect from the DOM (per `.outline-row`)
- `key` = itemKey(data-kind, id) (`data-project-id` / `data-folder-id`); `kind` = `data-kind`; `container` = `data-container`; `depth` = `data-depth`.
- `expandedWithRows` = folder is expanded AND has at least one visible child row (false for projects, collapsed and empty folders).
- `pinnedTop` = row is drawn in the pinned band.
- `ancestors` = ids of all folders containing the row, outermost first (a row in root has []). Folder ids only, no "f:" prefix.
- `rect` = getBoundingClientRect() in the same coordinate space as the pointer (client coords). `listBottom` = client Y of the bottom of the last row.

## Edge decisions
- `y >= listBottom` -> `{kind:"end"}` (checked first, regardless of x). Row hit-test is half-open [top, top+height) and requires x inside the row; otherwise null.
- Boundaries: project `t<0.5` before else after (exact middle = after). Folder `t<1/3` before, `t<2/3` into (unless expandedWithRows: everything past 1/3 is into), else after.
- "After" always carries the target row's own `container`, so after the last row of a folder stays in that folder.
- Dragging over yourself -> null. A dragged folder over any row whose `ancestors` include it -> null (checked before pinned handling).
- Pinned top row: folder -> `into` over its whole height; project -> null.
- Project dropped "into" the folder it is already in: ALLOWED (returns into; caller moves it to first). Before/after beside a neighbour that gives no actual change is also returned, not filtered.
- The function does not know whether the dragged row is itself pinned; the caller must not start a drag on pinned top rows.
