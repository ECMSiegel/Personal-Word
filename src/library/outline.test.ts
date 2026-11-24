import { describe, expect, it } from "vitest";
import type { Summary } from "../model";
import {
  childFolders,
  containerOf,
  emptyLibrary,
  orderedFolders,
  orderedProjects,
  type LibraryFolder,
  type LibraryState,
} from "./folders";
import { buildOutline, siblings, type OutlineRow } from "./outline";

const folder = (id: string, parent: string | null, name = id, collapsed?: boolean): LibraryFolder => ({
  id, name, parent, ...(collapsed === undefined ? {} : { collapsed }),
});
const proj = (id: string, over: Partial<Summary> = {}): Summary => ({
  id, title: id, updatedAt: "2026-01-01T00:00:00Z", ...over,
});
const lib = (over: Partial<LibraryState> = {}): LibraryState => ({ ...emptyLibrary, ...over });
const input = (projects: Summary[], l: LibraryState, over: Record<string, unknown> = {}) => ({
  projects, lib: l, sort: "name" as const, fallbackSort: "name" as const, reverse: false, foldersFirst: true, ...over,
});
const keys = (rows: OutlineRow[]) => rows.map((r) => r.key);

describe("buildOutline", () => {
  it("shows today's Custom display for a library in the old order-key shape", () => {
    const projects = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => proj(id, { title: id }));
    const l = lib({
      folders: [folder("a", null), folder("b", null), folder("c", null), folder("d", "a")],
      placement: { p4: "a", p5: "a", p6: "a" },
      order: { "folders:root": ["b", "a"], root: ["p3", "p1"], a: ["p6", "p4"], "folders:a": ["d"] },
    });
    // Reference: how the page shows it today -- folders first, then projects, per container.
    const expected: string[] = [];
    const walk = (container: string) => {
      const parent = container === "root" ? null : container;
      const subs = orderedFolders(l, parent, childFolders(l, parent).slice().sort((x, y) => x.name.localeCompare(y.name)));
      for (const f of subs) { expected.push(`f:${f.id}`); walk(f.id); }
      const here = projects.filter((p) => containerOf(l, p.id) === container);
      for (const p of orderedProjects(l, container, here)) expected.push(`p:${p.id}`);
    };
    walk("root");
    const out = buildOutline(input(projects, l, { sort: "custom", reverse: true }));
    expect(keys(out.rows)).toEqual(expected);
    expect(expected.slice(0, 3)).toEqual(["f:c", "f:b", "f:a"]);
  });

  it("owner rule A displays the saved order under Custom", () => {
    const l = lib({ order: { "items:root": ["p:B", "p:C", "p:A"] } });
    const out = buildOutline(input([proj("A"), proj("B"), proj("C")], l, { sort: "custom" }));
    expect(keys(out.rows)).toEqual(["p:B", "p:C", "p:A"]);
  });

  it("puts rows missing from the saved order first, in fallback order", () => {
    const l = lib({ order: { "items:root": ["p:B", "p:A"] } });
    const out = buildOutline(input([proj("A"), proj("B"), proj("Z"), proj("M")], l, { sort: "custom" }));
    expect(keys(out.rows)).toEqual(["p:M", "p:Z", "p:B", "p:A"]);
  });

  it("shows the fallback sort when a container has no saved order, and ignores reverse under Custom", () => {
    const out = buildOutline(input([proj("B"), proj("A")], lib(), { sort: "custom", reverse: true }));
    expect(keys(out.rows)).toEqual(["p:A", "p:B"]);
  });

  it("ignores a saved order unless the sort is Custom", () => {
    const l = lib({ order: { "items:root": ["p:B", "p:A"] } });
    expect(keys(buildOutline(input([proj("A"), proj("B")], l)).rows)).toEqual(["p:A", "p:B"]);
  });

  it("folders on top is a stable partition; off, Mixed interleaves by name", () => {
    const projects = [proj("Apple"), proj("Cherry")];
    const l = lib({ folders: [folder("fb", null, "Banana"), folder("fd", null, "Damson")] });
    expect(keys(buildOutline(input(projects, l)).rows)).toEqual(["f:fb", "f:fd", "p:Apple", "p:Cherry"]);
    expect(keys(buildOutline(input(projects, l, { foldersFirst: false })).rows))
      .toEqual(["p:Apple", "f:fb", "p:Cherry", "f:fd"]);
  });

  it("foldersFirst partitions a Custom saved order without changing the order inside each group", () => {
    const l = lib({ folders: [folder("fa", null), folder("fb", null)], order: { "items:root": ["p:x", "f:fb", "p:y", "f:fa"] } });
    const projects = [proj("x"), proj("y")];
    expect(keys(buildOutline(input(projects, l, { sort: "custom" })).rows)).toEqual(["f:fb", "f:fa", "p:x", "p:y"]);
    expect(keys(buildOutline(input(projects, l, { sort: "custom", foldersFirst: false })).rows))
      .toEqual(["p:x", "f:fb", "p:y", "f:fa"]);
  });

  it("computes folder values from the whole subtree", () => {
    const l = lib({
      folders: [folder("a", null, "A"), folder("b", "a", "B")],
      placement: { p1: "a", p2: "b", p3: "b" },
    });
    const projects = [
      proj("p1", { wordCount: 100, updatedAt: "2026-03-01T00:00:00Z" }),
      proj("p2", { wordCount: 50, updatedAt: "2026-05-01T00:00:00Z" }),
      proj("p3", { updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    const rows = buildOutline(input(projects, l)).rows;
    const a = rows.find((r) => r.key === "f:a")!;
    const b = rows.find((r) => r.key === "f:b")!;
    expect(a.totals).toEqual({ words: 150, projects: 3, edited: "2026-05-01T00:00:00Z" });
    expect(b.totals).toEqual({ words: 50, projects: 2, edited: "2026-05-01T00:00:00Z" });
    expect(rows.find((r) => r.key === "p:p1")!.totals).toBeUndefined();
  });

  it("empty folders have no edited date", () => {
    const out = buildOutline(input([], lib({ folders: [folder("a", null)] })));
    expect(out.rows[0].totals).toEqual({ words: 0, projects: 0, edited: undefined });
  });

  it("sorts by Edited newest first with empty folders last, and by Added with folders by name", () => {
    const l = lib({ folders: [folder("fe", null, "Empty"), folder("ff", null, "Full")], placement: { p1: "ff" } });
    const projects = [proj("p1", { updatedAt: "2026-09-01T00:00:00Z" }), proj("p2", { updatedAt: "2026-08-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z" }), proj("p3", { updatedAt: "2026-10-01T00:00:00Z", createdAt: "2026-02-01T00:00:00Z" })];
    const edited = buildOutline(input(projects, l, { sort: "edited", foldersFirst: false }));
    expect(keys(edited.rows)).toEqual(["p:p3", "f:ff", "p:p1", "p:p2", "f:fe"]);
    const added = buildOutline(input(projects, l, { sort: "added", foldersFirst: true }));
    expect(keys(added.rows)).toEqual(["f:fe", "f:ff", "p:p1", "p:p3", "p:p2"]);
  });

  it("sorts by Words and Sections, undefined counts as 0, and reverse flips", () => {
    const projects = [proj("a", { wordCount: 5, sectionCount: 1 }), proj("b"), proj("c", { wordCount: 9, sectionCount: 3 })];
    expect(keys(buildOutline(input(projects, lib(), { sort: "words" })).rows)).toEqual(["p:c", "p:a", "p:b"]);
    expect(keys(buildOutline(input(projects, lib(), { sort: "sections" })).rows)).toEqual(["p:c", "p:a", "p:b"]);
    expect(keys(buildOutline(input(projects, lib(), { sort: "words", reverse: true })).rows)).toEqual(["p:b", "p:a", "p:c"]);
  });

  it("applies direction to folders and projects alike", () => {
    const l = lib({ folders: [folder("fa", null, "Alpha"), folder("fb", null, "Beta")] });
    const out = buildOutline(input([proj("x"), proj("y")], l, { reverse: true }));
    expect(keys(out.rows)).toEqual(["f:fb", "f:fa", "p:y", "p:x"]);
  });

  it("gives depth, container and the kind for a three-level tree, and skips collapsed folders", () => {
    const l = lib({
      folders: [folder("a", null), folder("b", "a"), folder("c", "b"), folder("z", null, "Z", true)],
      placement: { p1: "c", p2: "z", p3: "a" },
    });
    const rows = buildOutline(input([proj("p1"), proj("p2"), proj("p3")], l)).rows;
    expect(rows.map((r) => [r.key, r.depth, r.container])).toEqual([
      ["f:a", 0, "root"],
      ["f:b", 1, "a"],
      ["f:c", 2, "b"],
      ["p:p1", 3, "c"],
      ["p:p3", 1, "a"],
      ["f:z", 0, "root"],
    ]);
    expect(rows[0]).toMatchObject({ kind: "folder", id: "a", pinned: false });
    expect(rows[3]).toMatchObject({ kind: "project", id: "p1" });
    expect(rows[5].totals?.projects).toBe(1);
  });

  it("lifts pins into the band, once, and keeps folder totals whole", () => {
    const l = lib({
      folders: [folder("a", null, "Essays"), folder("b", null)],
      placement: { p1: "a", p2: "a" },
      pins: ["p:p1", "p:p9", "f:gone"],
    });
    const out = buildOutline(input([proj("p1", { wordCount: 10 }), proj("p2", { wordCount: 5 }), proj("p3")], l));
    expect(out.pinned.map((r) => [r.key, r.depth, r.pinned, r.path, r.container])).toEqual([["p:p1", 0, true, "Essays", "a"]]);
    expect(keys(out.rows)).toEqual(["f:b", "f:a", "p:p2", "p:p3"]);
    expect(out.rows[1].totals).toEqual({ words: 15, projects: 2, edited: "2026-01-01T00:00:00Z" });
    const all = [...keys(out.pinned), ...keys(out.rows)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("lifts a pinned folder with its subtree, restarting depth", () => {
    const l = lib({
      folders: [folder("a", null), folder("b", "a")],
      placement: { p1: "b" },
      pins: ["f:b"],
    });
    const out = buildOutline(input([proj("p1")], l));
    expect(out.pinned.map((r) => [r.key, r.depth])).toEqual([["f:b", 0], ["p:p1", 1]]);
    expect(out.pinned[0].path).toBe("a");
    expect(keys(out.rows)).toEqual(["f:a"]);
  });

  it("shows a pinned project inside a pinned folder once, inside that folder", () => {
    const l = lib({
      folders: [folder("a", null)],
      placement: { p1: "a", p2: "a" },
      pins: ["p:p1", "f:a"],
    });
    const out = buildOutline(input([proj("p1"), proj("p2")], l));
    expect(keys(out.pinned)).toEqual(["f:a", "p:p1", "p:p2"]);
    expect(out.rows).toEqual([]);
    expect(out.pinned[1].pinned).toBe(true);
  });

  it("keeps pins in pin order", () => {
    const l = lib({ pins: ["p:b", "p:a"] });
    expect(keys(buildOutline(input([proj("a"), proj("b")], l)).pinned)).toEqual(["p:b", "p:a"]);
  });

  it("siblings lists the keys of one container in order", () => {
    const l = lib({ folders: [folder("a", null)], placement: { p1: "a", p2: "a" } });
    const out = buildOutline(input([proj("p1"), proj("p2"), proj("p3")], l));
    expect(siblings(out.rows, "a")).toEqual(["p:p1", "p:p2"]);
    expect(siblings(out.rows, "root")).toEqual(["f:a", "p:p3"]);
    expect(siblings(out.rows, "nope")).toEqual([]);
  });
});
