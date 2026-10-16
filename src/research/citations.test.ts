import { describe, it, expect } from "vitest";
import { formatCitation, bibliography } from "./citations";
import type { Source } from "./types";
const book: Source = {
  id: "b",
  kind: "book",
  title: "Interior Chinatown",
  authors: ["Charles Yu"],
  publisher: "Pantheon Books",
  year: "2020",
};
describe("Chicago 18 common-source citations", () => {
  it("omits publication city and produces full and short book notes", () => {
    expect(formatCitation(book, "full", "45")).toBe(
      "Charles Yu, Interior Chinatown (Pantheon Books, 2020), 45.",
    );
    expect(formatCitation(book, "short", "48")).toBe(
      "Yu, Interior Chinatown, 48.",
    );
  });
  it("inverts the first bibliography author", () =>
    expect(formatCitation(book, "bibliography")).toBe(
      "Yu, Charles. Interior Chinatown. Pantheon Books, 2020.",
    ));
  it("uses article page ranges only in bibliography and prefers DOI", () => {
    const s: Source = {
      id: "j",
      kind: "journal",
      title: "Article",
      authors: ["Jane Smith"],
      journal: "Journal",
      volume: "5",
      issue: "2",
      year: "2025",
      pages: "1–20",
      doi: "10.1234/example",
      url: "https://example.org",
    };
    expect(formatCitation(s, "full", "8")).toBe(
      "Jane Smith, “Article,” Journal 5, no. 2 (2025): 8, https://doi.org/10.1234/example.",
    );
    expect(formatCitation(s, "bibliography")).toContain(": 1–20.");
  });
  it("sorts bibliography by author", () =>
    expect(
      bibliography({
        sources: [book, { ...book, id: "a", authors: ["Amy Abel"] }],
        notes: [],
        footnotes: [],
      }).map((x) => x.id),
    ).toEqual(["a", "b"]));
});
