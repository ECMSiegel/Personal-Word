import { describe, expect, it, vi } from "vitest";
import { DragController, clampOffset, dropEdge, insertionIndex, keyboardMove, moveWithin, reorder, reorderKind, shiftFor } from "./dragReorder";
import type { Entry } from "../model";

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

// Wave 5 A2: keyboard and per-kind reordering (docs/agent-work/2026-11-01-ui-wave-5/PLAN.md).
describe("moveWithin", () => {
  it("moves like reorder", () => {
    expect(moveWithin(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveWithin(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("clamps the target into the list instead of ignoring the move", () => {
    expect(moveWithin(["a", "b", "c"], 1, -4)).toEqual(["b", "a", "c"]);
    expect(moveWithin(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
  });
  it("returns an equal copy for an unknown source index", () => {
    const items = ["a", "b"];
    const out = moveWithin(items, 5, 0);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
});

const e = (id: string, kind: Entry["kind"]) => ({ id, kind }) as Entry;
const ids = (entries: Entry[]) => entries.map((x) => x.id);

describe("reorderKind", () => {
  // Sections and fragments interleaved: s1 f1 s2 f2 f3
  const entries = [e("s1", "section"), e("f1", "fragment"), e("s2", "section"), e("f2", "fragment"), e("f3", "fragment")];

  it("moves one fragment among fragments while sections keep their slots", () => {
    expect(ids(reorderKind(entries, "fragment", "f1", 2))).toEqual(["s1", "f2", "s2", "f3", "f1"]);
    expect(ids(reorderKind(entries, "fragment", "f3", 0))).toEqual(["s1", "f3", "s2", "f1", "f2"]);
  });
  it("moves sections among sections while fragments keep their slots", () => {
    expect(ids(reorderKind(entries, "section", "s2", 0))).toEqual(["s2", "f1", "s1", "f2", "f3"]);
  });
  it("clamps the target position", () => {
    expect(ids(reorderKind(entries, "fragment", "f1", 40))).toEqual(["s1", "f2", "s2", "f3", "f1"]);
    expect(ids(reorderKind(entries, "fragment", "f3", -3))).toEqual(["s1", "f3", "s2", "f1", "f2"]);
  });
  it("is a no-op copy for an unknown id or an id of another kind", () => {
    expect(ids(reorderKind(entries, "fragment", "nope", 0))).toEqual(ids(entries));
    expect(ids(reorderKind(entries, "fragment", "s1", 2))).toEqual(ids(entries));
  });
  it("keeps the entry objects themselves", () => {
    const out = reorderKind(entries, "fragment", "f1", 1);
    expect(out.find((x) => x.id === "f1")).toBe(entries[1]);
  });
});

describe("keyboardMove", () => {
  const key = (k: string, mods: Partial<{ altKey: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) => ({
    key: k,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  });
  it("Option+Up is -1 and Option+Down is 1", () => {
    expect(keyboardMove(key("ArrowUp", { altKey: true }))).toBe(-1);
    expect(keyboardMove(key("ArrowDown", { altKey: true }))).toBe(1);
  });
  it("plain arrows and other keys do nothing", () => {
    expect(keyboardMove(key("ArrowUp"))).toBe(0);
    expect(keyboardMove(key("ArrowDown"))).toBe(0);
    expect(keyboardMove(key("ArrowLeft", { altKey: true }))).toBe(0);
    expect(keyboardMove(key("Enter", { altKey: true }))).toBe(0);
  });
  it("any extra modifier cancels the chord", () => {
    expect(keyboardMove(key("ArrowUp", { altKey: true, shiftKey: true }))).toBe(0);
    expect(keyboardMove(key("ArrowDown", { altKey: true, metaKey: true }))).toBe(0);
    expect(keyboardMove(key("ArrowDown", { altKey: true, ctrlKey: true }))).toBe(0);
  });
});
