import { describe, expect, it } from "vitest";
import { dropTarget, type DropRect } from "./libraryDrag";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

// List view: a folder heading "f" (top level) above two of its projects, then a sibling folder
// "g", a subfolder "s" inside "f", and two top-level projects.
const list: DropRect[] = [
  { id: "f", kind: "folder", container: "root", rect: box(0, 0, 800, 32) },
  { id: "s", kind: "folder", container: "f", rect: box(24, 32, 776, 32) },
  { id: "a", kind: "project", container: "f", rect: box(24, 64, 776, 50) },
  { id: "b", kind: "project", container: "f", rect: box(24, 114, 776, 50) },
  { id: "g", kind: "folder", container: "root", rect: box(0, 200, 800, 32) },
  { id: "c", kind: "project", container: "root", rect: box(0, 250, 800, 50) },
  { id: "d", kind: "project", container: "root", rect: box(0, 300, 800, 50) },
];

describe("dropTarget", () => {
  it("a project over another project lands before or after it by the row's vertical midpoint", () => {
    const dragged = { id: "c", kind: "project" as const };
    expect(dropTarget({ x: 100, y: 120 }, list, "list", dragged)).toEqual({ kind: "before", id: "b", container: "f" });
    expect(dropTarget({ x: 100, y: 160 }, list, "list", dragged)).toEqual({ kind: "after", id: "b", container: "f" });
    expect(dropTarget({ x: 100, y: 340 }, list, "list", dragged)).toEqual({ kind: "after", id: "d", container: "root" });
  });

  it("in cards the midpoint is horizontal", () => {
    const cards: DropRect[] = [
      { id: "a", kind: "project", container: "root", rect: box(0, 0, 230, 115) },
      { id: "b", kind: "project", container: "root", rect: box(246, 0, 230, 115) },
    ];
    const dragged = { id: "a", kind: "project" as const };
    // Low on the card but left of its middle: still before.
    expect(dropTarget({ x: 300, y: 110 }, cards, "cards", dragged)).toEqual({ kind: "before", id: "b", container: "root" });
    expect(dropTarget({ x: 400, y: 5 }, cards, "cards", dragged)).toEqual({ kind: "after", id: "b", container: "root" });
  });

  it("a project over a folder heading goes into that folder, unless it is already there", () => {
    expect(dropTarget({ x: 300, y: 210 }, list, "list", { id: "a", kind: "project" })).toEqual({ kind: "into", folder: "g" });
    expect(dropTarget({ x: 300, y: 40 }, list, "list", { id: "c", kind: "project" })).toEqual({ kind: "into", folder: "s" });
    expect(dropTarget({ x: 300, y: 10 }, list, "list", { id: "a", kind: "project" })).toBeNull();
  });

  it("a folder over a sibling folder heading lands before or after it on y", () => {
    const dragged = { id: "g", kind: "folder" as const };
    expect(dropTarget({ x: 300, y: 5 }, list, "list", dragged)).toEqual({ kind: "before", id: "f", container: "root" });
    expect(dropTarget({ x: 300, y: 25 }, list, "cards", dragged)).toEqual({ kind: "after", id: "f", container: "root" });
  });

  it("anything else is no drop", () => {
    // A folder over a folder that is not its sibling, over a project, or over itself.
    expect(dropTarget({ x: 300, y: 40 }, list, "list", { id: "g", kind: "folder" })).toBeNull();
    expect(dropTarget({ x: 300, y: 80 }, list, "list", { id: "g", kind: "folder" })).toBeNull();
    expect(dropTarget({ x: 300, y: 210 }, list, "list", { id: "g", kind: "folder" })).toBeNull();
    // A project over itself, or over empty space.
    expect(dropTarget({ x: 300, y: 80 }, list, "list", { id: "a", kind: "project" })).toBeNull();
    expect(dropTarget({ x: 300, y: 180 }, list, "list", { id: "a", kind: "project" })).toBeNull();
    expect(dropTarget({ x: 900, y: 80 }, list, "list", { id: "c", kind: "project" })).toBeNull();
  });
});
