import { describe, expect, it } from "vitest";
import { entry, newProject, type Project } from "../model";
import { removeFootnoteMarkers, removeTextOnlyFootnote } from "./removeFootnote";

const mark = (id: string) => ({ type: "footnoteReference", attrs: { id } });
const para = (...content: any[]) => ({ type: "paragraph", content });
const text = (t: string) => ({ type: "text", text: t });
const doc = (...content: any[]) => ({ type: "doc", content });
const note = (id: string, sourceId?: string) => ({ id, text: "n " + id, ...(sourceId ? { sourceId } : {}) });

function fixture(): Project {
  const a = { ...entry("section", "One"), content: doc(para(text("before "), mark("t1"), text(" after "), mark("t2"))) };
  const b = { ...entry("section", "Two"), content: doc(para(mark("cited"), text("x"))) };
  const frag = { ...entry("fragment", "Idea"), content: doc(para(text("a"), mark("t1")), para(text("keep"))) };
  const p = newProject("Remove");
  return {
    ...p,
    entries: [a, b, frag],
    order: [a.id, b.id],
    research: { sources: [{ id: "s", kind: "book", title: "B", authors: [] } as any], notes: [], footnotes: [note("t1"), note("t2"), note("cited", "s"), note("orphan")] },
  };
}

describe("removeTextOnlyFootnote", () => {
  it("removes a marker in the middle of a paragraph and keeps the text around it", () => {
    const out = removeTextOnlyFootnote(fixture(), "t2")!;
    expect(out.entries[0].content).toEqual(doc(para(text("before "), mark("t1"), text(" after "))));
    expect(out.research!.footnotes.map((n) => n.id)).toEqual(["t1", "cited", "orphan"]);
  });

  it("leaves other markers and other entries untouched (same object)", () => {
    const p = fixture();
    const out = removeTextOnlyFootnote(p, "t2")!;
    expect(out.entries[1]).toBe(p.entries[1]);
    expect(out.entries[2]).toBe(p.entries[2]);
  });

  it("removes the marker from a fragment as well as a section", () => {
    const out = removeTextOnlyFootnote(fixture(), "t1")!;
    expect(out.entries[0].content).toEqual(doc(para(text("before "), text(" after "), mark("t2"))));
    expect(out.entries[2].content).toEqual(doc(para(text("a")), para(text("keep"))));
  });

  it("handles two markers of different notes in one entry, one at a time", () => {
    const once = removeTextOnlyFootnote(fixture(), "t1")!;
    const twice = removeTextOnlyFootnote(once, "t2")!;
    expect(twice.entries[0].content).toEqual(doc(para(text("before "), text(" after "))));
    expect(twice.research!.footnotes.map((n) => n.id)).toEqual(["cited", "orphan"]);
  });

  it("leaves an empty paragraph when the marker was its only child", () => {
    expect(removeFootnoteMarkers(doc(para(mark("x"))), "x")).toEqual(doc({ type: "paragraph" }));
  });

  it("removes an orphan record alone and changes no entry", () => {
    const p = fixture();
    const out = removeTextOnlyFootnote(p, "orphan")!;
    expect(out.research!.footnotes.map((n) => n.id)).toEqual(["t1", "t2", "cited"]);
    expect(out.entries).toEqual(p.entries);
  });

  it("never removes a cited footnote or its marker", () => {
    expect(removeTextOnlyFootnote(fixture(), "cited")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(removeTextOnlyFootnote(fixture(), "nope")).toBeNull();
  });

  it("skips entries the open editor will clean itself", () => {
    const p = fixture();
    const out = removeTextOnlyFootnote(p, "t1", new Set([p.entries[0].id]))!;
    expect(out.entries[0]).toBe(p.entries[0]);
    expect(out.entries[2].content).toEqual(doc(para(text("a")), para(text("keep"))));
    expect(out.research!.footnotes.some((n) => n.id === "t1")).toBe(false);
  });
});
