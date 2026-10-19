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
  it("writes website dates in Chicago form and omits the access date when dated", () => {
    const site: Source = {
      id: "w",
      kind: "website",
      title: "A Page",
      authors: ["Jane Doe"],
      website: "Example",
      year: "2025-03-04",
      accessed: "2026-10-16",
      url: "https://example.org/page",
    };
    expect(formatCitation(site, "full")).toBe(
      "Jane Doe, “A Page,” Example, March 4, 2025, https://example.org/page.",
    );
    expect(formatCitation({ ...site, year: "" }, "full")).toBe(
      "Jane Doe, “A Page,” Example, accessed October 16, 2026, https://example.org/page.",
    );
  });
  it("sorts bibliography by author", () =>
    expect(
      bibliography({
        sources: [book, { ...book, id: "a", authors: ["Amy Abel"] }],
        notes: [],
        footnotes: [],
      }).map((x) => x.id),
    ).toEqual(["a", "b"]));
  it("uses the main title before a colon in short notes", () => {
    expect(formatCitation({ ...book, title: "Lamps and Ledgers: Keeping the Coastal Lights", authors: ["Marguerite Halloway"] }, "short", "48")).toBe("Halloway, Lamps and Ledgers, 48.");
  });
  it("prefers an explicit short title", () => {
    expect(formatCitation({ ...book, title: "Lamps and Ledgers: Keeping the Coastal Lights", shortTitle: "Ledgers", authors: ["Marguerite Halloway"] }, "short", "48")).toBe("Halloway, Ledgers, 48.");
  });
  it("uses short titles in journal notes", () => {
    expect(formatCitation({ id: "j", kind: "journal", title: "On Testing: A Method", shortTitle: "Testing", authors: ["Jane Smith"] }, "short", "12")).toBe("Smith, “Testing,” 12.");
  });
  it("does not add a period after a short title ending in question or exclamation punctuation", () => {
    const article: Source = {
      id: "j",
      kind: "journal",
      title: "Did It Work? An Evaluation",
      shortTitle: "Did It Work?",
      authors: ["Jane Smith"],
    };
    expect(formatCitation(article, "short")).toBe("Smith, “Did It Work?”");
    expect(formatCitation({ ...article, shortTitle: "Why Now!" }, "short")).toBe(
      "Smith, “Why Now!”",
    );
    expect(formatCitation(article, "short", "p. 12")).toBe(
      "Smith, “Did It Work?,” p. 12.",
    );
  });
  it("does not add a period after a short book title ending in question or exclamation punctuation", () => {
    expect(
      formatCitation({ ...book, title: "What Matters?", shortTitle: "What Matters?" }, "short"),
    ).toBe("Yu, What Matters?");
    expect(
      formatCitation({ ...book, title: "Why Now!", shortTitle: "Why Now!" }, "short"),
    ).toBe("Yu, Why Now!");
  });
  it("preserves supplied page and chapter locator prefixes in short notes", () => {
    expect(formatCitation(book, "short", "p. 12")).toBe(
      "Yu, Interior Chinatown, p. 12.",
    );
    expect(formatCitation(book, "short", "pp. 12–14")).toBe(
      "Yu, Interior Chinatown, pp. 12–14.",
    );
    expect(formatCitation(book, "short", "ch. 3")).toBe(
      "Yu, Interior Chinatown, ch. 3.",
    );
  });
  it("uses the untitled-source placeholder in shortened notes", () => {
    expect(formatCitation({ id: "u", kind: "book", title: "", authors: [] }, "short")).toBe("[Untitled source].");
    expect(formatCitation({ id: "u", kind: "book", title: "", authors: [] }, "short", "12")).toBe("[Untitled source], 12.");
    expect(formatCitation({ id: "uj", kind: "journal", title: "", authors: [] }, "short")).toBe("“[Untitled source].”");
  });
  it("uses Chicago short author forms for two authors and et al.", () => {
    expect(formatCitation({ ...book, authors: ["Yu", "Lee"] }, "short")).toMatch(/^Yu and Lee, /);
    expect(formatCitation({ ...book, authors: ["Yu", "Lee", "Kim"] }, "short")).toMatch(/^Yu et al\., /);
  });
});
