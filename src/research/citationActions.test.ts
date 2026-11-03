import { describe, expect, it } from "vitest";
import { addCitation, addLookedUpSource, addManualSource, patchFootnote, patchSource, patchResearchNote, removeSource, sourceSummary, firstWords, kindLabels } from "./citationActions";
import type { ResearchData } from "./types";
const base: ResearchData = {
  sources: [{ id: "s1", kind: "book", title: "  Lamps  ", authors: ["Marguerite Halloway"], year: "2019" }],
  notes: [{ id: "n1", kind: "quote", text: "Quote", sourceId: "s1" }],
  footnotes: [{ id: "f1", text: "Text", sourceId: "s1" }],
};
describe("pure citation actions", () => {
  it("adds looked-up, manual and linked or text-only citations with injected ids", () => {
    const looked = addLookedUpSource(base, { kind: "website", title: "Site", authors: [] }, () => "s2");
    expect(looked.id).toBe("s2"); expect(looked.data.sources.at(-1)?.id).toBe("s2");
    expect(addManualSource(base, () => "s3").data.sources.at(-1)).toEqual({ id: "s3", kind: "book", title: "", authors: [] });
    expect(addCitation(base, "s1", () => "f2").data.footnotes.at(-1)).toEqual({ id: "f2", text: "", sourceId: "s1" });
    expect(addCitation(base, undefined, () => "f3").data.footnotes.at(-1)).toEqual({ id: "f3", text: "" });
  });
  it("never mutates its input", () => {
    const snapshot = JSON.stringify(base);
    addLookedUpSource(base, { kind: "website", title: "Site", authors: [] }, () => "s2"); addManualSource(base, () => "s3");
    addCitation(base, "s1", () => "f2"); patchSource(base, "s1", { title: "x" }); patchFootnote(base, "f1", { text: "x" });
    removeSource({ ...base, footnotes: [], notes: [] }, "s1");
    expect(JSON.stringify(base)).toBe(snapshot);
  });
  it("patches immutably and preserves unrelated records", () => {
    const next = patchFootnote(patchSource(base, "s1", { title: "New" }), "f1", { text: "Updated" });
    expect(next.sources[0].title).toBe("New"); expect(next.footnotes[0].text).toBe("Updated");
    expect(patchResearchNote(base, "n1", { text: "Changed" }).notes[0].text).toBe("Changed");
    expect(base.sources[0].title).toBe("  Lamps  "); expect(base.footnotes[0].text).toBe("Text");
  });
  it("keeps the linked-source refusal and removes an unlinked source", () => {
    expect(removeSource(base, "s1")).toEqual({ error: "Remove the quotes and footnotes linked to this source before deleting it. Footnotes can be unlinked." });
    expect(removeSource({ ...base, footnotes: [], notes: [] }, "s1")).toEqual({ data: { ...base, footnotes: [], notes: [], sources: [] } });
  });
  it("retains display helpers", () => {
    expect(sourceSummary(base.sources[0])).toBe("Halloway -- Lamps (2019)");
    expect(firstWords("one two three four five six seven")).toBe("one two three four five six…");
    expect(kindLabels.other).toBe("Other");
  });
});
