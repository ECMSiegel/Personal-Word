import { describe, expect, it } from "vitest";
import {
  LibraryVersionError,
  PIN_LIMIT,
  ROOT,
  addFolder,
  childFolders,
  containerOf,
  deleteFolder,
  emptyLibrary,
  fileProject,
  hasCustomOrder,
  itemKey,
  parseKey,
  placeBeside,
  savedItems,
  togglePin,
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

describe("combined order and pins", () => {
  const base = (over: Partial<LibraryState> = {}): LibraryState => ({
    ...emptyLibrary,
    folders: [folder("fa", null), folder("fb", null)],
    ...over,
  });

  it("builds and parses item keys, including project ids that look like keys", () => {
    expect(itemKey("folder", "x")).toBe("f:x");
    expect(itemKey("project", "x")).toBe("p:x");
    expect(parseKey("f:x")).toEqual({ kind: "folder", id: "x" });
    expect(parseKey(itemKey("project", "f:odd"))).toEqual({ kind: "project", id: "f:odd" });
    expect(parseKey(itemKey("folder", "p:odd"))).toEqual({ kind: "folder", id: "p:odd" });
    expect(PIN_LIMIT).toBe(3);
  });

  it("carries pins through parse, dropping bad and duplicate entries and capping at three", () => {
    const parsed = parseLibrary({ ...emptyLibrary, pins: ["p:a", "p:a", "x", 5, "f:", "f:b", "p:c", "p:d"] });
    expect(parsed.pins).toEqual(["p:a", "f:b", "p:c"]);
    expect(parseLibrary({ ...emptyLibrary, pins: "p:a" }).pins).toBeUndefined();
    expect(parseLibrary({ ...emptyLibrary }).pins).toBeUndefined();
  });

  it("keeps items: order lists through parse", () => {
    const parsed = parseLibrary({ ...emptyLibrary, order: { "items:root": ["f:a", "p:b"], "items:bad": [1] } });
    expect(parsed.order["items:root"]).toEqual(["f:a", "p:b"]);
    expect(parsed.order["items:bad"]).toBeUndefined();
  });

  it("keeps pins and items: lists through every mutation", () => {
    let s = base({ pins: ["p:a", "f:fa"], order: { "items:root": ["f:fa", "p:a"] } });
    const steps = [
      (x: LibraryState) => renameFolder(x, "fa", "Renamed"),
      (x: LibraryState) => setFolderColour(x, "fa", "red"),
      (x: LibraryState) => setFolderCollapsed(x, "fa", true),
      (x: LibraryState) => moveFolder(x, "fb", "fa"),
      (x: LibraryState) => fileProject(x, "zzz", "fb"),
      (x: LibraryState) => addFolder(x, "New", null).state,
      (x: LibraryState) => moveProject(x, ROOT, ["a", "b"], "a", 1),
      (x: LibraryState) => reorderFolder(x, null, ["fa", "fb"], "fb", 0),
      (x: LibraryState) => placeBeside(x, ROOT, ["f:fa", "p:a"], "p:a", "f:fa", "before"),
    ];
    for (const step of steps) {
      s = step(s);
      expect(s.pins).toEqual(["p:a", "f:fa"]);
      expect(s.order["items:root"]).toBeDefined();
    }
  });

  it("reads the saved order from items: first, else the old keys, else nothing", () => {
    expect(savedItems(base(), ROOT)).toBeNull();
    const old = base({ order: { "folders:root": ["fb", "fa"], root: ["p2", "p1"] } });
    expect(savedItems(old, ROOT)).toEqual(["f:fb", "f:fa", "p:p2", "p:p1"]);
    expect(savedItems(base({ order: { root: ["p2"] } }), ROOT)).toEqual(["p:p2"]);
    expect(savedItems(base({ order: { "folders:fa": ["fb"] } }), "fa")).toEqual(["f:fb"]);
    const both = base({ order: { "items:root": ["p:p1", "f:fa"], "folders:root": ["fb"], root: ["p2"] } });
    expect(savedItems(both, ROOT)).toEqual(["p:p1", "f:fa"]);
  });

  it("owner rule A: a saved order is the base, so the drop does not also move the others", () => {
    // Saved B, C, A while sorted by name shows A, B, C. Drag A after B: B, A, C.
    const s = base({ order: { "items:root": ["p:B", "p:C", "p:A"] } });
    const next = placeBeside(s, ROOT, ["p:A", "p:B", "p:C"], "p:A", "p:B", "after");
    expect(next.order["items:root"]).toEqual(["p:B", "p:A", "p:C"]);
    expect(s.order["items:root"]).toEqual(["p:B", "p:C", "p:A"]);
  });

  it("owner rule B: with no saved order the on-screen order is saved, with the move", () => {
    const next = placeBeside(base(), ROOT, ["p:A", "p:B", "p:C"], "p:C", "p:A", "before");
    expect(next.order["items:root"]).toEqual(["p:C", "p:A", "p:B"]);
  });

  it("starts from the old keys when there is no items: list, and leaves them alone", () => {
    const s = base({ order: { "folders:root": ["fb", "fa"], root: ["p2", "p1"] } });
    const next = placeBeside(s, ROOT, ["f:fb", "f:fa", "p:p2", "p:p1"], "p:p1", "f:fb", "before");
    expect(next.order["items:root"]).toEqual(["p:p1", "f:fb", "f:fa", "p:p2"]);
    expect(next.order["folders:root"]).toEqual(["fb", "fa"]);
    expect(next.order.root).toEqual(["p2", "p1"]);
  });

  it("adds on-screen rows missing from the saved order, in front as they display", () => {
    const s = base({ order: { "items:root": ["p:B"] } });
    const next = placeBeside(s, ROOT, ["p:A", "p:B", "p:C"], "p:B", null, "after");
    expect(next.order["items:root"]).toEqual(["p:A", "p:C", "p:B"]);
  });

  it("puts a row last when the neighbour is null, and touches no other container", () => {
    const s = base({ order: { "items:fa": ["p:x"] } });
    const next = placeBeside(s, ROOT, ["p:A", "p:B"], "p:A", null, "before");
    expect(next.order["items:root"]).toEqual(["p:B", "p:A"]);
    expect(next.order["items:fa"]).toEqual(["p:x"]);
  });

  it("pins up to three and ignores a fourth; toggling again unpins", () => {
    let s = base();
    for (const k of ["p:a", "p:b", "p:c"] as const) s = togglePin(s, k);
    expect(s.pins).toEqual(["p:a", "p:b", "p:c"]);
    expect(togglePin(s, "p:d")).toBe(s);
    expect(togglePin(s, "p:b").pins).toEqual(["p:a", "p:c"]);
    expect(s.pins).toEqual(["p:a", "p:b", "p:c"]);
  });

  it("deleting a pinned folder unpins it and cleans every items: list", () => {
    const s = base({
      pins: ["f:fa", "p:a"],
      placement: { a: "fa" },
      order: { "items:root": ["f:fa", "p:b", "f:fb"], "items:fa": ["p:a"], "items:fb": ["f:fa"] },
    });
    const next = deleteFolder(s, "fa");
    expect(next.pins).toEqual(["p:a"]);
    expect(next.order["items:fa"]).toBeUndefined();
    expect(next.order["items:root"]).toEqual(["p:b", "f:fb"]);
    expect(next.order["items:fb"]).toEqual([]);
  });

  it("filing a project removes it from every items: list", () => {
    const s = base({ order: { "items:root": ["p:a", "f:fa"], "items:fa": ["p:a", "p:b"] } });
    const next = fileProject(s, "a", "fb");
    expect(next.order["items:root"]).toEqual(["f:fa"]);
    expect(next.order["items:fa"]).toEqual(["p:b"]);
    expect(next.placement.a).toBe("fb");
  });
});
