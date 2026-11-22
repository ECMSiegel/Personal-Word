import { describe, expect, it } from "vitest";
import {
  LibraryVersionError,
  ROOT,
  addFolder,
  childFolders,
  containerOf,
  deleteFolder,
  emptyLibrary,
  fileProject,
  hasCustomOrder,
  moveFolder,
  moveProject,
  orderedFolders,
  orderedProjects,
  parseLibrary,
  renameFolder,
  reorderFolder,
  setFolderCollapsed,
  setFolderColour,
  type LibraryFolder,
  type LibraryState,
} from "./folders";

const folder = (id: string, parent: string | null, name = id): LibraryFolder => ({ id, name, parent });

describe("library folders", () => {
  it("parses valid state and returns a fresh empty value for invalid input", () => {
    expect(parseLibrary({ ...emptyLibrary, folders: [folder("f", null)] })).toMatchObject({
      version: 1,
      folders: [folder("f", null)],
    });
    expect(parseLibrary(null)).toEqual(emptyLibrary);
    expect(parseLibrary({ version: 1, folders: "bad" })).toEqual(emptyLibrary);
    expect(parseLibrary(null)).not.toBe(emptyLibrary);
  });

  it("drops only the malformed folder entries and keeps the rest of the library", () => {
    const state = parseLibrary({
      version: 1,
      folders: [
        folder("good", null),
        { id: 7, name: "bad id", parent: null },
        { id: "noname", parent: null },
        "not an object",
        { id: "good", name: "duplicate", parent: null },
        { id: "badColour", name: "x", parent: null, colour: 3 },
        folder("child", "good"),
        folder("orphan", "noname"),
      ],
      placement: { p1: "good", p2: "noname" },
      order: { good: ["p1"], "folders:root": ["good", "noname"] },
    });
    expect(state.folders.map(({ id, parent }) => [id, parent])).toEqual([
      ["good", null], ["child", "good"], ["orphan", null],
    ]);
    expect(state.placement).toEqual({ p1: "good", p2: "noname" });
    expect(containerOf(state, "p2")).toBe(ROOT);
    expect(state.order.good).toEqual(["p1"]);
  });

  it("keeps the folders when placement or order is missing or not an object", () => {
    for (const broken of [{}, { placement: "x" }, { order: [] }, { placement: null, order: 3 }]) {
      const state = parseLibrary({ version: 1, folders: [folder("f", null)], placement: { p: "f" }, order: { f: ["p"] }, ...broken });
      expect(state.folders).toEqual([folder("f", null)]);
    }
    const noPlacement = parseLibrary({ version: 1, folders: [folder("f", null)], order: { f: ["p"] } });
    expect(noPlacement.placement).toEqual({});
    expect(noPlacement.order).toEqual({ f: ["p"] });
    const badOrder = parseLibrary({ version: 1, folders: [folder("f", null)], placement: { p: "f" }, order: ["p"] });
    expect(badOrder.placement).toEqual({ p: "f" });
    expect(badOrder.order).toEqual({});
  });

  it("refuses a library of an unknown version instead of reading it as empty", () => {
    for (const raw of [
      { version: 2, folders: [folder("f", null)], placement: {}, order: {} },
      { version: "1", folders: [], placement: {}, order: {} },
      { folders: [folder("f", null)], placement: {}, order: {} },
    ])
      expect(() => parseLibrary(raw)).toThrow(LibraryVersionError);
    // Nothing saved yet, or something that is not a library object at all, still reads as empty.
    expect(parseLibrary(null)).toEqual(emptyLibrary);
    expect(parseLibrary("text")).toEqual(emptyLibrary);
  });

  it("breaks missing and cyclic parents at the root", () => {
    const state = parseLibrary({
      version: 1,
      folders: [folder("a", "b"), folder("b", "a"), folder("c", "missing")],
      placement: {},
      order: {},
    });
    expect(state.folders.map(({ id, parent }) => [id, parent])).toEqual([
      ["a", null], ["b", null], ["c", null],
    ]);
  });

  it("adds, renames, colors, and collapses immutably", () => {
    const added = addFolder(emptyLibrary, "  Writing  ", null);
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(added.state.folders[0]).toMatchObject({ id: added.id, name: "Writing", parent: null });
    expect(added.state).not.toBe(emptyLibrary);
    expect(renameFolder(added.state, added.id, " ")).toBe(added.state);
    expect(renameFolder(added.state, added.id, "Drafts").folders[0].name).toBe("Drafts");
    expect(setFolderColour(added.state, added.id, "blue").folders[0].colour).toBe("blue");
    expect(setFolderColour(added.state, added.id, undefined).folders[0]).not.toHaveProperty("colour");
    expect(setFolderCollapsed(added.state, added.id, true).folders[0].collapsed).toBe(true);
  });

  it("reports containers and ordered child folders", () => {
    const state: LibraryState = {
      ...emptyLibrary,
      folders: [folder("a", null), folder("b", "a"), folder("c", null)],
      placement: { p1: "a", p2: "missing" },
      order: { "folders:root": ["c", "a"] },
    };
    expect(containerOf(state, "p1")).toBe("a");
    expect(containerOf(state, "p2")).toBe(ROOT);
    expect(containerOf(state, "new")).toBe(ROOT);
    expect(childFolders(state, "a").map((f) => f.id)).toEqual(["b"]);
    expect(orderedFolders(state, null, [state.folders[0], state.folders[2]]).map((f) => f.id)).toEqual(["c", "a"]);
    expect(orderedFolders(state, null, [state.folders[0]]).map((f) => f.id)).toEqual(["a"]);
    expect(hasCustomOrder(state, "root")).toBe(false);
  });

  it("reorders folders and refuses moves into self or descendants", () => {
    const state: LibraryState = { ...emptyLibrary, folders: [folder("a", null), folder("b", null), folder("c", "a")] };
    const reordered = reorderFolder(state, null, ["a", "b"], "b", 0);
    expect(reordered.order["folders:root"]).toEqual(["b", "a"]);
    expect(moveFolder(state, "a", "a")).toBe(state);
    expect(moveFolder(state, "a", "c")).toBe(state);
    expect(moveFolder(state, "b", "a").folders.find((f) => f.id === "b")?.parent).toBe("a");
  });

  it("deletes a folder while preserving child folders and project placement", () => {
    const state: LibraryState = {
      ...emptyLibrary,
      folders: [folder("a", null), folder("b", "a")],
      placement: { p1: "a", p2: "b" },
      order: { "a": ["p1"], "b": ["p2"], "folders:a": ["b"] },
    };
    const next = deleteFolder(state, "a");
    expect(next.folders).toEqual([folder("b", null)]);
    // Top level is "no entry", never a literal "root" placement.
    expect(next.placement).toEqual({ p2: "b" });
    expect(deleteFolder(next, "b").placement).toEqual({});
    expect(next.order).not.toHaveProperty("folders:a");
  });

  it("files projects and removes them from every custom-order list", () => {
    const state: LibraryState = {
      ...emptyLibrary,
      folders: [folder("a", null)],
      placement: { p: "a" },
      order: { root: ["p"], a: ["p", "q"] },
    };
    const moved = fileProject(state, "p", null);
    expect(moved.placement).not.toHaveProperty("p");
    expect(moved.order).toEqual({ root: [], a: ["q"] });
    expect(state.order.root).toEqual(["p"]);
  });

  it("orders projects with unlisted projects first and rebuilds from the visible list", () => {
    const shown = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const state: LibraryState = { ...emptyLibrary, order: { root: ["c", "gone", "a"] } };
    expect(orderedProjects(state, ROOT, shown).map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(orderedProjects(emptyLibrary, ROOT, shown)).toEqual(shown);
    expect(hasCustomOrder({ ...emptyLibrary, order: { root: [] } }, ROOT)).toBe(true);
    expect(moveProject(state, ROOT, ["a", "b", "c"], "new", 1).order.root).toEqual(["a", "new", "b", "c"]);
    expect(moveProject(state, ROOT, ["a", "b", "c"], "b", 0).order.root).toEqual(["b", "a", "c"]);
  });
});
