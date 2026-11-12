import { describe, expect, it } from "vitest";
import { entry, newProject, validateProject, type Project } from "../model";
import {
  addGroup,
  addSectionEntry,
  deleteGroup,
  groupOf,
  groupTitle,
  manuscriptGroupOrder,
  moveEntryToGroup,
  normalizeOrder,
  normalized,
  renameGroup,
  reorderInGroup,
  topGroupOrder,
} from "./groups";

/** A project with sections A, B, C in Manuscript and custom section "Part two" (id g1). */
function seeded(): Project {
  const p = newProject("Groups");
  const [a] = p.entries;
  const b = entry("section", "B");
  const c = entry("section", "C");
  return addGroup(
    { ...p, entries: [{ ...a, title: "A" }, b, c], order: [a.id, b.id, c.id] },
    "Part two",
    "g1",
  );
}
const titles = (p: Project) =>
  p.order.map((id) => p.entries.find((e) => e.id === id)!.title);

describe("top-level sections (HS9)", () => {
  it("leaves a project with no custom sections untouched (same order array)", () => {
    const p = newProject("Plain");
    const b = entry("section", "B");
    const plain = { ...p, entries: [...p.entries, b], order: [b.id, p.entries[0].id] };
    expect(normalizeOrder(plain)).toBe(plain.order);
    expect(normalized(plain)).toBe(plain);
    expect(manuscriptGroupOrder(plain)).toEqual(["manuscript"]);
    expect(topGroupOrder(plain)).toEqual(["manuscript", "fragments", "research"]);
    expect(JSON.stringify(normalized(plain))).toBe(JSON.stringify(plain));
  });

  it("adds a custom section after the three built-ins and keeps the project valid", () => {
    const p = seeded();
    expect(p.groups).toEqual([{ id: "g1", title: "Part two" }]);
    expect(topGroupOrder(p)).toEqual(["manuscript", "fragments", "research", "g1"]);
    expect(manuscriptGroupOrder(p)).toEqual(["manuscript", "g1"]);
    expect(() => validateProject(structuredClone(p))).not.toThrow();
  });

  it("adds a section entry into a custom section and orders Read by sidebar order", () => {
    let p = seeded();
    const x = entry("section", "X");
    p = addSectionEntry(p, x, "g1");
    expect(groupOf(p, p.entries.find((e) => e.id === x.id)!)).toBe("g1");
    expect(titles(p)).toEqual(["A", "B", "C", "X"]);
    // The custom section moves above Manuscript in the sidebar: its entries come first.
    p = normalized({ ...p, sidebarOrder: ["g1", "manuscript", "fragments", "research"] });
    expect(titles(p)).toEqual(["X", "A", "B", "C"]);
    expect(() => validateProject(structuredClone(p))).not.toThrow();
  });

  it("adds a section below a given entry in that entry's section", () => {
    const p = seeded();
    const y = entry("section", "Y");
    const next = addSectionEntry(p, y, "manuscript", p.order[0]);
    expect(titles(next)).toEqual(["A", "Y", "B", "C"]);
  });

  it("moves an entry to another section (last in it) and back to Manuscript", () => {
    let p = seeded();
    const [a, b] = p.order;
    p = moveEntryToGroup(p, a, "g1");
    p = moveEntryToGroup(p, b, "g1");
    expect(titles(p)).toEqual(["C", "A", "B"]);
    expect(p.entries.find((e) => e.id === a)!.group).toBe("g1");
    p = moveEntryToGroup(p, a, "manuscript");
    expect("group" in p.entries.find((e) => e.id === a)!).toBe(false);
    expect(titles(p)).toEqual(["C", "A", "B"]);
    expect(() => validateProject(structuredClone(p))).not.toThrow();
  });

  it("reorders within one section by the index among that section's entries", () => {
    let p = seeded();
    const [a, b, c] = p.order;
    p = moveEntryToGroup(moveEntryToGroup(p, b, "g1"), c, "g1");
    expect(titles(p)).toEqual(["A", "B", "C"]);
    p = reorderInGroup(p, c, 0);
    expect(titles(p)).toEqual(["A", "C", "B"]);
    expect(p.order[0]).toBe(a);
  });

  it("treats an unknown or missing group id as Manuscript, so no entry is invisible", () => {
    const p = seeded();
    const orphan = { ...p.entries[1], group: "gone" };
    const q = { ...p, entries: p.entries.map((e) => (e.id === orphan.id ? orphan : e)) };
    expect(groupOf(q, orphan)).toBe("manuscript");
    expect(() => validateProject(structuredClone(q))).not.toThrow();
    // A whole-version restore to a project without groups: every grouped entry falls back.
    const restored = { ...q, groups: undefined };
    expect(q.entries.every((e) => groupOf(restored, e) === "manuscript")).toBe(true);
  });

  it("deletes a custom section: its entries move to Manuscript and nothing is deleted", () => {
    let p = seeded();
    p = moveEntryToGroup(p, p.order[0], "g1");
    p = { ...p, sidebarOrder: ["g1", "manuscript", "fragments", "research"] };
    p = normalized(p);
    expect(titles(p)).toEqual(["A", "B", "C"]);
    const next = deleteGroup(p, "g1");
    expect(next.entries).toHaveLength(3);
    expect(next.entries.some((e) => "group" in e)).toBe(false);
    expect("groups" in next).toBe(false);
    expect(next.sidebarOrder).toEqual(["manuscript", "fragments", "research"]);
    expect(titles(next)).toEqual(["A", "B", "C"]);
    expect(() => validateProject(structuredClone(next))).not.toThrow();
  });

  it("renames custom and built-in headings; the default name restores the built-in", () => {
    let p = renameGroup(seeded(), "g1", "Appendix");
    expect(groupTitle(p, "g1")).toBe("Appendix");
    p = renameGroup(p, "manuscript", "Chapters");
    expect(p.groupTitles).toEqual({ manuscript: "Chapters" });
    expect(groupTitle(p, "manuscript")).toBe("Chapters");
    expect(groupTitle(p, "fragments")).toBe("Fragments");
    expect(() => validateProject(structuredClone(p))).not.toThrow();
    p = renameGroup(p, "manuscript", "Manuscript");
    expect("groupTitles" in p).toBe(false);
    p = renameGroup(renameGroup(p, "research", "Notes"), "research", "  ");
    expect(groupTitle(p, "research")).toBe("Research");
  });
});
