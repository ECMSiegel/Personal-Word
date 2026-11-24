import { describe, expect, it } from "vitest";
import type { ItemKey } from "./folders";
import { outlineDropTarget, type RowRect } from "./outlineDrag";

const H = 40;
const row = (
  key: ItemKey,
  top: number,
  extra: Partial<RowRect> = {},
): RowRect => ({
  key,
  kind: key.startsWith("f:") ? "folder" : "project",
  container: "root",
  depth: 0,
  expandedWithRows: false,
  pinnedTop: false,
  ancestors: [],
  rect: { left: 0, top, width: 800, height: H },
  ...extra,
});

// Layout (each row 40 tall):
//   0   f:open   expanded folder with rows (root)
//  40     f:sub  collapsed subfolder of open
//  80     p:in   project in open
// 120   p:a       root project
// 160   f:empty   collapsed/empty folder (root)
// 200   p:b       root project
const rects: RowRect[] = [
  row("f:open", 0, { expandedWithRows: true }),
  row("f:sub", 40, { container: "open", depth: 1, ancestors: ["open"] }),
  row("p:in", 80, { container: "open", depth: 1, ancestors: ["open"] }),
  row("p:a", 120),
  row("f:empty", 160),
  row("p:b", 200),
];
const bottom = 240;
const at = (y: number, dragged: ItemKey, list = rects, x = 100) =>
  outlineDropTarget({ x, y }, list, dragged, bottom);

describe("outlineDropTarget", () => {
  it("project row: top half is before", () => {
    expect(at(125, "p:b")).toEqual({ kind: "before", key: "p:a", container: "root" });
  });
  it("project row: bottom half is after", () => {
    expect(at(150, "p:b")).toEqual({ kind: "after", key: "p:a", container: "root" });
  });
  it("project row: the exact middle is after", () => {
    expect(at(140, "p:b")).toEqual({ kind: "after", key: "p:a", container: "root" });
  });
  it("collapsed or empty folder: top third is before", () => {
    expect(at(165, "p:a")).toEqual({ kind: "before", key: "f:empty", container: "root" });
  });
  it("collapsed or empty folder: middle third is into", () => {
    expect(at(180, "p:a")).toEqual({ kind: "into", folder: "empty" });
  });
  it("collapsed or empty folder: bottom third is after", () => {
    expect(at(195, "p:a")).toEqual({ kind: "after", key: "f:empty", container: "root" });
  });
  it("expanded folder with rows: top third is before", () => {
    expect(at(5, "p:a")).toEqual({ kind: "before", key: "f:open", container: "root" });
  });
  it("expanded folder with rows: the rest is into, down to its bottom edge", () => {
    expect(at(20, "p:a")).toEqual({ kind: "into", folder: "open" });
    expect(at(38, "p:a")).toEqual({ kind: "into", folder: "open" });
  });
  it("after the last row of a folder stays in that folder", () => {
    expect(at(115, "p:a")).toEqual({ kind: "after", key: "p:in", container: "open" });
  });
  it("a point below listBottom is end", () => {
    expect(at(240, "p:a")).toEqual({ kind: "end" });
    expect(at(500, "f:open")).toEqual({ kind: "end" });
  });
  it("a folder never targets itself", () => {
    expect(at(20, "f:open")).toBeNull();
    expect(at(5, "f:open")).toBeNull();
  });
  it("a folder never targets anything in its own subtree", () => {
    expect(at(50, "f:open")).toBeNull();
    expect(at(95, "f:open")).toBeNull();
    expect(at(60, "f:open")).toBeNull();
  });
  it("a folder may still target rows outside its subtree, and its sibling's neighbours", () => {
    expect(at(125, "f:open")).toEqual({ kind: "before", key: "p:a", container: "root" });
    expect(at(180, "f:open")).toEqual({ kind: "into", folder: "empty" });
  });
  it("a project already in a folder dropped into that same folder is allowed (it moves to first)", () => {
    const list = [row("f:sub", 0, { container: "open" }), row("p:in", 40, { container: "sub", depth: 1, ancestors: ["sub"] })];
    expect(outlineDropTarget({ x: 100, y: 20 }, list, "p:in", 80)).toEqual({ kind: "into", folder: "sub" });
  });
  it("dragging over yourself gives null", () => {
    expect(at(130, "p:a")).toBeNull();
    expect(at(150, "p:a")).toBeNull();
  });
  it("a pinned top folder gives only into, over its whole height", () => {
    const list = [row("f:pin", 0, { pinnedTop: true }), row("p:a", 40)];
    expect(outlineDropTarget({ x: 5, y: 3 }, list, "p:a", 80)).toEqual({ kind: "into", folder: "pin" });
    expect(outlineDropTarget({ x: 5, y: 20 }, list, "p:a", 80)).toEqual({ kind: "into", folder: "pin" });
    expect(outlineDropTarget({ x: 5, y: 38 }, list, "p:a", 80)).toEqual({ kind: "into", folder: "pin" });
  });
  it("a pinned top project gives null", () => {
    const list = [row("p:pin", 0, { pinnedTop: true }), row("p:a", 40)];
    expect(outlineDropTarget({ x: 5, y: 3 }, list, "p:a", 80)).toBeNull();
    expect(outlineDropTarget({ x: 5, y: 30 }, list, "p:a", 80)).toBeNull();
  });
  it("a folder dragged over a pinned top folder inside its own subtree is refused", () => {
    const list = [row("f:pin", 0, { pinnedTop: true, ancestors: ["dragged"] })];
    expect(outlineDropTarget({ x: 5, y: 20 }, list, "f:dragged", 40)).toBeNull();
  });
  it("a point in no row and above listBottom gives null", () => {
    const gap = [row("p:a", 0), row("p:b", 60)];
    expect(outlineDropTarget({ x: 100, y: 50 }, gap, "p:z", 100)).toBeNull();
    expect(outlineDropTarget({ x: 900, y: 10 }, gap, "p:z", 100)).toBeNull();
  });
  describe("Folders on top (foldersFirst)", () => {
    const go = (y: number, dragged: ItemKey, on = true) =>
      outlineDropTarget({ x: 100, y }, rects, dragged, bottom, on);
    it("a project over a collapsed or empty folder row gets into over the whole row", () => {
      for (const y of [165, 180, 195]) expect(go(y, "p:a")).toEqual({ kind: "into", folder: "empty" });
    });
    it("a project over an expanded folder's top third gets into, not before", () => {
      expect(go(5, "p:a")).toEqual({ kind: "into", folder: "open" });
    });
    it("a folder over a project row gets no target", () => {
      expect(go(125, "f:empty")).toBeNull();
      expect(go(150, "f:empty")).toBeNull();
    });
    it("a folder over a folder row and a project over a project row are unchanged", () => {
      expect(go(165, "f:open")).toEqual({ kind: "before", key: "f:empty", container: "root" });
      expect(go(125, "p:b")).toEqual({ kind: "before", key: "p:a", container: "root" });
    });
    it("the blank area under the list is still the end", () => {
      expect(go(500, "f:empty")).toEqual({ kind: "end" });
    });
    it("off (Mixed with projects) nothing changes", () => {
      expect(go(165, "p:a", false)).toEqual({ kind: "before", key: "f:empty", container: "root" });
      expect(go(125, "f:empty", false)).toEqual({ kind: "before", key: "p:a", container: "root" });
    });
  });
});
