import { describe, it, expect } from "vitest";
import { entry, newProject } from "../model";
import { importFragment, mergeMissingResearch } from "./operations";
describe("fragment research integrity", () => {
  it("remaps copied footnotes and sources without overwriting target notes", () => {
    const a = newProject("Target"),
      b = newProject("Source"),
      f = entry("fragment", "Quote");
    a.research = {
      sources: [],
      notes: [],
      footnotes: [{ id: "same", text: "Target note" }],
    };
    b.research = {
      sources: [
        { id: "book", kind: "book", title: "A book", authors: ["A Writer"] },
      ],
      notes: [],
      footnotes: [{ id: "same", text: "Source note", sourceId: "book" }],
    };
    f.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "footnoteReference", attrs: { id: "same" } }],
        },
      ],
    };
    const result = importFragment(a, b, f);
    expect(result.research?.footnotes).toHaveLength(2);
    const copy = result.entries.at(-1)!;
    const id = copy.content.content![0].content![0].attrs!.id;
    expect(id).not.toBe("same");
    expect(result.research?.footnotes.find((n) => n.id === id)?.text).toBe(
      "Source note",
    );
    expect(f.content.content![0].content![0].attrs!.id).toBe("same");
  });
  it("section restore keeps newly added research", () => {
    expect(
      mergeMissingResearch(
        { sources: [], notes: [], footnotes: [{ id: "new", text: "New" }] },
        { sources: [], notes: [], footnotes: [{ id: "old", text: "Old" }] },
      ).footnotes.map((n) => n.id),
    ).toEqual(["new", "old"]);
  });
});
