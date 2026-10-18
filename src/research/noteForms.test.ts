import { describe, expect, it } from "vitest";
import { footnoteIdsInOrder, resolveNoteForms } from "./noteForms";
import type { Project } from "../model";
import type { ResearchData } from "./types";

const data = (overrides: Partial<ResearchData> = {}): ResearchData => ({
  sources: [
    { id: "a", kind: "book", title: "A", authors: ["A Author"] },
    { id: "b", kind: "book", title: "B", authors: ["B Author"] },
  ],
  notes: [],
  footnotes: [
    { id: "a1", text: "", sourceId: "a" },
    { id: "b1", text: "", sourceId: "b" },
    { id: "a2", text: "", sourceId: "a" },
  ],
  ...overrides,
});

describe("manuscript note forms", () => {
  it("makes first citations full and later citations of the same source short", () => {
    expect(resolveNoteForms(["a1", "b1", "a2"], data({ autoShortNotes: true }))).toEqual({
      a1: "full", b1: "full", a2: "short",
    });
  });
  it("keeps every note full when the flag is absent", () => {
    expect(resolveNoteForms(["a1", "a2"], data())).toEqual({ a1: "full", a2: "full" });
  });
  it("lets explicit forms and legacy shortened values win", () => {
    const d = data({ autoShortNotes: true, footnotes: [
      { id: "a1", text: "", sourceId: "a", form: "short" },
      { id: "a2", text: "", sourceId: "a", form: "full" },
      { id: "a3", text: "", sourceId: "a", shortened: true },
    ] });
    expect(resolveNoteForms(["a1", "a2", "a3"], d)).toEqual({ a1: "short", a2: "full", a3: "short" });
    expect(resolveNoteForms(["a3"], data({ footnotes: [{ id: "a3", text: "", sourceId: "a", shortened: true }] }))).toEqual({ a3: "short" });
  });
  it("keeps notes without a source full regardless of overrides", () => {
    expect(resolveNoteForms(["text"], data({ footnotes: [{ id: "text", text: "", form: "short", shortened: true }] }))).toEqual({ text: "full" });
  });
  it("stores note forms for prototype-named note ids as own properties", () => {
    const d = data({ autoShortNotes: true, footnotes: [
      { id: "__proto__", text: "", sourceId: "a" },
      { id: "constructor", text: "", sourceId: "a" },
    ] });
    const result = resolveNoteForms(["__proto__", "constructor"], d);
    expect(Object.keys(result)).toEqual(["__proto__", "constructor"]);
    expect(result["__proto__"]).toBe("full");
    expect(result.constructor).toBe("short");
  });
  it("recomputes forms when a later citation moves before the first", () => {
    expect(resolveNoteForms(["a2", "a1"], data({ autoShortNotes: true }))).toEqual({ a2: "full", a1: "short" });
  });
  it("skips fragments and repeated references while walking manuscript order", () => {
    const paragraph = (id: string) => ({ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id } }] });
    const project = {
      order: ["s1", "s2"],
      entries: [
        { id: "s1", kind: "section", content: { type: "doc", content: [paragraph("a1"), paragraph("a1")] } },
        { id: "s2", kind: "section", content: { type: "doc", content: [paragraph("a2")] } },
        { id: "f", kind: "fragment", content: { type: "doc", content: [paragraph("b1")] } },
      ],
    } as unknown as Project;
    expect(footnoteIdsInOrder(project)).toEqual(["a1", "a2"]);
  });
});
