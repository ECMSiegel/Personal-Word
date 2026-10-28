// Pure maths and state for pointer-based drag-to-reorder (vertical lists).
// The hook in useDragReorder.ts wires this to pointer events; nothing here touches the DOM.

/** Index a row dragged to `pointerY` would land at: the number of row midpoints above it, clamped to the list. */
export function insertionIndex(pointerY: number, rowTops: number[], rowHeights: number[]): number {
  const n = Math.min(rowTops.length, rowHeights.length);
  if (n === 0) return 0;
  let above = 0;
  for (let i = 0; i < n; i++) if (rowTops[i] + rowHeights[i] / 2 < pointerY) above++;
  return Math.min(above, n - 1);
}

/** A new array with the item at `from` moved to `to`. Returns an equal copy for no-op or out-of-range moves. */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** Limits the lifted row's offset so it never leaves the list's top or bottom edge. */
export function clampOffset(dy: number, from: number, rowTops: number[], rowHeights: number[]): number {
  const last = rowTops.length - 1;
  const min = rowTops[0] - rowTops[from];
  const max = rowTops[last] + rowHeights[last] - (rowTops[from] + rowHeights[from]);
  return Math.max(min, Math.min(max, dy));
}

/** translateY for a sibling row while row `from` is hovering over slot `to`: rows between them step aside by the lifted row's height. */
export function shiftFor(index: number, from: number, to: number, rowHeights: number[]): number {
  if (index === from || from === to) return 0;
  if (from < to && index > from && index <= to) return -rowHeights[from];
  if (from > to && index >= to && index < from) return rowHeights[from];
  return 0;
}

/** Which row gets the drop line, and on which edge (after shifting, the line sits where the lifted row will land). */
export function dropEdge(from: number, to: number): { index: number; edge: "top" | "bottom" } | null {
  if (from === to) return null;
  return { index: to, edge: to > from ? "bottom" : "top" };
}

export type DragSnapshot = { from: number; to: number; dy: number };

/**
 * One drag from pointer-down to release. Below `threshold` px of travel it is only a press (clicks keep working);
 * past it, it tracks the lifted row. `cancel` (Escape, pointercancel) discards without reordering.
 */
export class DragController {
  private pending: { startY: number; from: number; tops: number[]; heights: number[] } | null = null;
  private active: DragSnapshot | null = null;

  constructor(
    private readonly threshold: number,
    private readonly onReorder: (from: number, to: number) => void,
  ) {}

  down(pointerY: number, from: number, rowTops: number[], rowHeights: number[]): void {
    this.active = null;
    this.pending = { startY: pointerY, from, tops: rowTops, heights: rowHeights };
  }

  /**
   * Returns the current drag, or null while still below the threshold or idle. A move with no button down
   * (`buttons === 0`) means the release happened somewhere we did not see: the press is discarded.
   */
  move(pointerY: number, buttons = 1): DragSnapshot | null {
    const p = this.pending;
    if (!p) return null;
    if (buttons === 0) {
      this.reset();
      return null;
    }
    const raw = pointerY - p.startY;
    if (!this.active && Math.abs(raw) < this.threshold) return null;
    const dy = clampOffset(raw, p.from, p.tops, p.heights);
    const center = p.tops[p.from] + p.heights[p.from] / 2 + dy;
    this.active = { from: p.from, to: insertionIndex(center, p.tops, p.heights), dy };
    return this.active;
  }

  /** Ends the drag. Returns true when a drag (not just a press) happened; calls onReorder if the slot changed. */
  up(): boolean {
    const a = this.active;
    this.reset();
    if (!a) return false;
    if (a.to !== a.from) this.onReorder(a.from, a.to);
    return true;
  }

  cancel(): void {
    this.reset();
  }

  snapshot(): DragSnapshot | null {
    return this.active;
  }

  private reset(): void {
    this.pending = null;
    this.active = null;
  }
}
