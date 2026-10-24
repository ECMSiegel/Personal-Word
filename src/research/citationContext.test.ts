import { describe, expect, it } from "vitest";
import { footnoteIdsInOrder, resolveCitationContext, resolveNoteForms } from "./noteForms";
import { footnoteText } from "./citations";
import { importFragment } from "../organization/operations";
import type { Project } from "../model";
import type { Footnote, ResearchData } from "./types";

const ref = (id: string) => ({ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id } }] });
const project = (sections: string[][], research: ResearchData, fragments: string[][] = []) => ({
  order: sections.map((_, i) => `s${i + 1}`),
  entries: [
    ...sections.map((ids, i) => ({ id: `s${i + 1}`, kind: "section", content: { type: "doc", content: ids.map(ref) } })),
    ...fragments.map((ids, i) => ({ id: `f${i + 1}`, kind: "fragment", content: { type: "doc", content: ids.map(ref) } })),
  ],
  research,
}) as unknown as Pick<Project, "order" | "entries" | "research">;
const data = (footnotes: Footnote[], overrides: Partial<ResearchData> = {}): ResearchData => ({
  sources: [
    { id: "a", kind: "book", title: "Alpha Book", authors: ["Ann Author"], publisher: "Press", year: "2020" },
    { id: "b", kind: "book", title: "Beta Book", authors: ["Bea Writer"], publisher: "Press", year: "2021" },
    { id: "m", kind: "book", title: "Manual", authors: ["Max Hand"], manualFull: "Hand-written full.", manualShort: "Hand short." },
  ],
  notes: [],
  footnotes,
  autoShortNotes: true,
  ...overrides,
});
const forms = (p: ReturnType<typeof project>) =>
  Object.fromEntries(Object.entries(resolveCitationContext(p)).map(([id, c]) => [id, c.form]));
const note = (id: string, sourceId?: string, extra: Partial<Footnote> = {}): Footnote => ({ id, text: "", sourceId, ...extra });

describe("citation context without a policy", () => {
  it("matches the legacy resolver exactly for old projects", () => {
    const cases: ResearchData[] = [
      data([note("a1", "a"), note("b1", "b"), note("a2", "a")]),
      data([note("a1", "a"), note("a2", "a")], { autoShortNotes: undefined }),
      data([note("a1", "a", { form: "short" }), note("a2", "a", { form: "full" }), note("a3", "a", { shortened: true })]),
      data([note("t", undefined, { form: "short", shortened: true }), note("a1", "a"), note("a2", "a", { text: "See" })]),
    ];
    for (const research of cases) {
      const ids = research.footnotes.map((n) => n.id);
      const p = project([ids.slice(0, 2), ids.slice(2)], research);
      expect(forms(p)).toEqual(resolveNoteForms(footnoteIdsInOrder(p), research));
    }
  });
  it("numbers continuously in first-occurrence manuscript order and ignores fragments", () => {
    const p = project([["a1", "a1"], ["b1"]], data([note("a1", "a"), note("b1", "b"), note("x", "a")]), [["x"]]);
    const context = resolveCitationContext(p);
    expect(Object.keys(context)).toEqual(["a1", "b1"]);
    expect(context.a1).toMatchObject({ number: 1, sectionId: "s1" });
    expect(context.b1).toMatchObject({ number: 2, sectionId: "s2" });
  });
});

describe("citation policy", () => {
  it("restarts first full citations at each section and keeps numbers continuous", () => {
    const research = data([note("a1", "a"), note("a2", "a"), note("a3", "a")], { citationPolicy: { scope: "section", repeats: "short" } });
    const context = resolveCitationContext(project([["a1", "a2"], ["a3"]], research));
    expect(context.a1).toMatchObject({ number: 1, form: "full" });
    expect(context.a2).toMatchObject({ number: 2, form: "short" });
    expect(context.a3).toMatchObject({ number: 3, form: "full", sectionId: "s2" });
  });
  it("is authoritative over the legacy checkbox", () => {
    const research = data([note("a1", "a"), note("a2", "a")], { autoShortNotes: false, citationPolicy: { scope: "manuscript", repeats: "short" } });
    expect(forms(project([["a1"], ["a2"]], research))).toEqual({ a1: "full", a2: "short" });
  });
  it("uses Ibid. only for the same single source in the immediately previous note", () => {
    const research = data([
      note("a1", "a", { locator: "4" }), note("a2", "a", { locator: "4" }), note("a3", "a", { locator: "9" }),
      note("b1", "b"), note("a4", "a", { locator: "9" }),
    ], { citationPolicy: { scope: "manuscript", repeats: "ibid" } });
    const p = project([["a1", "a2", "a3", "b1", "a4"]], research);
    expect(forms(p)).toEqual({ a1: "full", a2: "ibid", a3: "ibid", b1: "full", a4: "short" });
    const r = p.research!;
    const context = resolveCitationContext(p);
    const text = (i: number) => footnoteText(r.footnotes[i], r, context[r.footnotes[i].id].form, context[r.footnotes[i].id].locator);
    expect(text(1)).toBe("Ibid.");
    expect(text(2)).toBe("Ibid., 9.");
    expect(text(4)).toBe("Author, Alpha Book, 9.");
  });
  it("never produces a false Ibid.", () => {
    const research = data([
      note("a1", "a", { locator: "4" }), note("a2", "a"),                       // locator dropped: would imply same page
      note("b3", "b"), note("t", undefined, { text: "Text only." }), note("a4", "a"), // text-only note intervenes
      note("a5", "a", { text: "Compare" }), note("a6", "a"),                     // previous is composite
      note("a7", "a", { text: "Also" }),                                          // current has own text
      note("a8", "a", { form: "short" }), note("a9", "a", { shortened: true }),  // explicit forms win
      note("m1", "m"), note("m2", "m"),                                           // manual citation source
    ], { citationPolicy: { scope: "manuscript", repeats: "ibid" } });
    const result = forms(project([research.footnotes.map((n) => n.id)], research));
    expect(Object.values(result)).not.toContain("ibid");
    expect(result).toMatchObject({ a2: "short", a4: "short", a6: "short", a7: "short", a8: "short", a9: "short", m2: "short" });
  });
  it("refuses Ibid. after a source that still needs a manual citation", () => {
    const research = data([note("r1", "r"), note("r2", "r"), note("a1", "a"), note("a2", "a")], { citationPolicy: { scope: "manuscript", repeats: "ibid" } });
    research.sources.push({ id: "r", kind: "report", title: "Unformatted report", authors: ["Rae Port"] });
    const p = project([["r1", "r2", "a1", "a2"]], research);
    expect(forms(p)).toEqual({ r1: "full", r2: "short", a1: "full", a2: "ibid" });
    expect(footnoteText(research.footnotes[1], research, "short")).toBe("[Manual short note required: Unformatted report]");
  });
  it("does not carry Ibid. across a section boundary in section scope but does in manuscript scope", () => {
    const footnotes = [note("a1", "a"), note("a2", "a")];
    expect(forms(project([["a1"], ["a2"]], data(footnotes, { citationPolicy: { scope: "section", repeats: "ibid" } })))).toEqual({ a1: "full", a2: "full" });
    expect(forms(project([["a1"], ["a2"]], data(footnotes, { citationPolicy: { scope: "manuscript", repeats: "ibid" } })))).toEqual({ a1: "full", a2: "ibid" });
  });
  it("recomputes after moving the first occurrence and deleting a reference", () => {
    const research = data([note("a1", "a"), note("a2", "a"), note("a3", "a")], { citationPolicy: { scope: "manuscript", repeats: "ibid" } });
    expect(forms(project([["a2", "a1"]], research))).toEqual({ a2: "full", a1: "ibid" });
    expect(forms(project([["a1", "a3"]], research))).toEqual({ a1: "full", a3: "ibid" });
  });
  it("treats an imported fragment's remapped source as a separate source, never Ibid.", () => {
    const policy = { scope: "manuscript", repeats: "ibid" } as const;
    const target = project([["a1"]], data([note("a1", "a", { locator: "4" })], { citationPolicy: policy })) as unknown as Project;
    const other = project([], data([note("a1", "a", { locator: "4" })]), [["a1"]]) as unknown as Project;
    const imported = importFragment(target, other, other.entries[0]);
    const fragment = imported.entries.at(-1)!;
    const newNote = imported.research!.footnotes.at(-1)!;
    expect(newNote.id).not.toBe("a1");
    expect(newNote.sourceId).not.toBe("a");
    expect(Object.keys(resolveCitationContext(imported))).toEqual(["a1"]);
    const promoted = { ...imported, entries: imported.entries.map((e) => e === fragment ? { ...e, kind: "section" as const } : e), order: [...imported.order, fragment.id] };
    expect(resolveCitationContext(promoted)[newNote.id]).toMatchObject({ number: 2, form: "full" });
  });
  it("stores prototype-named note ids as own properties", () => {
    const research = data([note("__proto__", "a"), note("constructor", "a")], { citationPolicy: { scope: "manuscript", repeats: "ibid" } });
    const context = resolveCitationContext(project([["__proto__", "constructor"]], research));
    expect(Object.keys(context)).toEqual(["__proto__", "constructor"]);
    expect(context["constructor"].form).toBe("ibid");
  });
});
