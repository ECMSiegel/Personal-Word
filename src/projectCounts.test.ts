import { describe, expect, it } from "vitest";
import { entry, words } from "./model";
import { projectCounts } from "./projectCounts";

const withText = (kind: "section" | "fragment", text: string) => ({
  ...entry(kind, "T"),
  text,
});

describe("projectCounts", () => {
  it("counts nothing for an empty project", () => {
    expect(projectCounts({ entries: [] })).toEqual({ wordCount: 0, sectionCount: 0 });
  });
  it("counts only sections, not fragments", () => {
    const entries = [
      withText("section", "one two three"),
      withText("fragment", "ignored words here now"),
      withText("section", "four five"),
    ];
    expect(projectCounts({ entries })).toEqual({ wordCount: 5, sectionCount: 2 });
  });
  it("counts a whitespace-only section as 0 words and 1 section", () => {
    expect(projectCounts({ entries: [withText("section", " \n\t ")] })).toEqual({
      wordCount: 0,
      sectionCount: 1,
    });
  });
  // Parity with the Rust list (store.rs list_counts_words_and_sections_from_the_manuscript_entries):
  // the same sample text must give the same count there.
  it("counts the shared Rust parity sample as 5 words", () => {
    expect(words("  one two\u00a0three\n\nfour\u3000five  ")).toBe(5);
  });
});
