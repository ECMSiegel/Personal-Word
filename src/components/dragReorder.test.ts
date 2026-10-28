import { describe, expect, it, vi } from "vitest";
import { DragController, clampOffset, dropEdge, insertionIndex, reorder, shiftFor } from "./dragReorder";

// Four rows of height 20 stacked from y=100: tops 100,120,140,160.
const tops = [100, 120, 140, 160];
const heights = [20, 20, 20, 20];

describe("insertionIndex", () => {
  it("returns the row under the pointer, by midpoints", () => {
    expect(insertionIndex(105, tops, heights)).toBe(0);
    expect(insertionIndex(129, tops, heights)).toBe(1);
    expect(insertionIndex(131, tops, heights)).toBe(2);
    expect(insertionIndex(169, tops, heights)).toBe(3);
  });
  it("clamps above the first and below the last row", () => {
    expect(insertionIndex(-500, tops, heights)).toBe(0);
    expect(insertionIndex(9999, tops, heights)).toBe(3);
  });
  it("handles unequal heights", () => {
    // rows: 0-10, 10-50, 50-60 -> midpoints 5, 30, 55
    expect(insertionIndex(29, [0, 10, 50], [10, 40, 10])).toBe(1);
    expect(insertionIndex(31, [0, 10, 50], [10, 40, 10])).toBe(2);
  });
  it("a row's own centre maps to its own index", () => {
    for (let i = 0; i < 4; i++) expect(insertionIndex(tops[i] + 10, tops, heights)).toBe(i);
  });
  it("returns 0 for no rows", () => {
    expect(insertionIndex(10, [], [])).toBe(0);
  });
});

describe("reorder", () => {
  it("moves down and up without mutating", () => {
    const a = ["a", "b", "c", "d"];
    expect(reorder(a, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorder(a, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(a).toEqual(["a", "b", "c", "d"]);
  });
  it("is a no-op for equal or out-of-range indexes", () => {
    expect(reorder(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(reorder(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("clampOffset", () => {
  it("keeps the lifted row inside the list", () => {
    expect(clampOffset(-999, 1, tops, heights)).toBe(-20);
    expect(clampOffset(999, 1, tops, heights)).toBe(40);
    expect(clampOffset(7, 1, tops, heights)).toBe(7);
  });
});

describe("shiftFor", () => {
  it("shifts siblings between from and to by the lifted row's height", () => {
    // lift row 0, hover row 2: rows 1 and 2 move up
    expect([0, 1, 2, 3].map((i) => shiftFor(i, 0, 2, heights))).toEqual([0, -20, -20, 0]);
    // lift row 3, hover row 1: rows 1 and 2 move down
    expect([0, 1, 2, 3].map((i) => shiftFor(i, 3, 1, heights))).toEqual([0, 20, 20, 0]);
  });
  it("shifts nothing when to equals from", () => {
    expect([0, 1, 2, 3].map((i) => shiftFor(i, 2, 2, heights))).toEqual([0, 0, 0, 0]);
  });
});

describe("dropEdge", () => {
  it("marks the bottom of the target when moving down, the top when moving up", () => {
    expect(dropEdge(0, 2)).toEqual({ index: 2, edge: "bottom" });
    expect(dropEdge(3, 1)).toEqual({ index: 1, edge: "top" });
  });
  it("marks nothing when the order would not change", () => {
    expect(dropEdge(2, 2)).toBeNull();
  });
});

describe("DragController", () => {
  const make = (threshold = 5) => {
    const onReorder = vi.fn();
    return { c: new DragController(threshold, onReorder), onReorder };
  };

  it("stays idle until the pointer travels past the threshold", () => {
    const { c, onReorder } = make();
    c.down(110, 0, tops, heights);
    expect(c.move(113)).toBeNull();
    expect(c.up()).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("activates past the threshold and tracks the target", () => {
    const { c } = make();
    c.down(110, 0, tops, heights);
    const s = c.move(150);
    expect(s).toEqual({ from: 0, to: 2, dy: 40 });
  });

  it("commits once on release", () => {
    const { c, onReorder } = make();
    c.down(110, 0, tops, heights);
    c.move(150);
    expect(c.up()).toBe(true);
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
    expect(c.snapshot()).toBeNull();
  });

  it("does not call onReorder when dropped where it started", () => {
    const { c, onReorder } = make();
    c.down(110, 0, tops, heights);
    c.move(120);
    c.move(110);
    expect(c.up()).toBe(true);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("cancel discards the drag", () => {
    const { c, onReorder } = make();
    c.down(110, 0, tops, heights);
    c.move(150);
    c.cancel();
    expect(c.snapshot()).toBeNull();
    expect(c.up()).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("clamps at the first and last positions", () => {
    const { c } = make();
    c.down(170, 3, tops, heights);
    expect(c.move(-900)).toEqual({ from: 3, to: 0, dy: -60 });
    expect(c.move(900)).toEqual({ from: 3, to: 3, dy: 0 });
  });
});

describe("DragController release outside the row", () => {
  it("a move with no button down disarms a pending press, so a later move never lifts", () => {
    const c = new DragController(5, vi.fn());
    c.down(110, 0, tops, heights);
    expect(c.move(130, 0)).toBeNull();
    expect(c.move(140, 1)).toBeNull();
    expect(c.up()).toBe(false);
  });
  it("a move with no button down ends an active drag without reordering", () => {
    const onReorder = vi.fn();
    const c = new DragController(5, onReorder);
    c.down(110, 0, tops, heights);
    expect(c.move(150, 1)).not.toBeNull();
    expect(c.move(150, 0)).toBeNull();
    expect(c.up()).toBe(false);
    expect(onReorder).not.toHaveBeenCalled();
  });
});
