import { describe, it, expect } from "vitest";
import {
  FetchFailure,
  isValidIsbn,
  lookupIdentifier,
  mapCrossref,
  mapOpenLibrary,
  normalizeDoi,
  parseHtmlMetadata,
  parseIdentifier,
} from "./lookup";
import { formatCitation, bibliography } from "./citations";
import type { Source } from "./types";

const crossrefFixture = {
  status: "ok",
  message: {
    type: "journal-article",
    DOI: "10.1234/example",
    URL: "https://doi.org/10.1234/example",
    title: ["Narrative Structure in Practice"],
    "container-title": ["Journal of Examples"],
    author: [
      { given: "Jane", family: "Smith" },
      { given: "Omar", family: "Reyes" },
    ],
    volume: "12",
    issue: "3",
    page: "45-67",
    issued: { "date-parts": [[2024, 5, 2]] },
  },
};

const openLibraryFixture = {
  "ISBN:9780593321041": {
    title: "Interior Chinatown",
    subtitle: "A Novel",
    authors: [{ name: "Charles Yu", url: "https://openlibrary.org/a" }],
    publishers: [{ name: "Pantheon Books" }],
    publish_date: "March 2020",
  },
};

const page = `<!doctype html><html><head>
<title>Fallback &amp; Title</title>
<meta name="citation_title" content="Waiting for the Harbor &amp; Other Stories">
<meta name="citation_author" content="Reyes, Omar">
<meta name="citation_author" content="Ada Lovelace">
<meta property="og:site_name" content="Harbor Journal">
<meta name="citation_publication_date" content="2025/03/04">
<meta name="citation_doi" content="10.5555/page-doi">
</head><body></body></html>`;

describe("identifier parsing", () => {
  it("strips DOI URL and doi: prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.1234/abc")).toBe("10.1234/abc");
    expect(normalizeDoi("doi:10.1234/abc")).toBe("10.1234/abc");
    expect(normalizeDoi(" 10.1234/abc ")).toBe("10.1234/abc");
    expect(normalizeDoi("https://example.com/10.1234/abc")).toBeNull();
  });

  it("validates ISBN-10 and ISBN-13 checksums", () => {
    expect(isValidIsbn("0-306-40615-2")).toBe(true);
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true);
    expect(isValidIsbn("0-306-40615-3")).toBe(false);
    expect(isValidIsbn("978-0-306-40615-8")).toBe(false);
  });

  it("parses each identifier kind and rejects everything else", () => {
    expect(parseIdentifier("doi:10.1234/abc")).toEqual({
      kind: "doi",
      doi: "10.1234/abc",
    });
    expect(parseIdentifier("ISBN 978-0-306-40615-7")).toEqual({
      kind: "isbn",
      isbn: "9780306406157",
    });
    expect(parseIdentifier("https://example.org/post")).toEqual({
      kind: "url",
      url: "https://example.org/post",
    });
    expect(() => parseIdentifier("   ")).toThrow(
      "Enter a DOI, ISBN, or web address",
    );
    expect(() => parseIdentifier("example.com")).toThrow(
      "Enter a DOI, ISBN, or web address",
    );
    expect(() => parseIdentifier("ftp://example.com")).toThrow(
      "Enter a DOI, ISBN, or web address",
    );
    expect(() => parseIdentifier("978-0-306-40615-8")).toThrow(
      "doesn't check out",
    );
  });
});

describe("Crossref mapping", () => {
  it("maps a journal article and formats it without throwing", () => {
    const draft = mapCrossref(crossrefFixture, "10.1234/example");
    expect(draft).toMatchObject({
      kind: "journal",
      title: "Narrative Structure in Practice",
      authors: ["Jane Smith", "Omar Reyes"],
      journal: "Journal of Examples",
      volume: "12",
      issue: "3",
      pages: "45–67",
      year: "2024",
      doi: "10.1234/example",
    });
    expect(draft.url).toBeUndefined();
    const source: Source = { id: "x", ...draft };
    expect(formatCitation(source, "full", "50")).toContain("Jane Smith");
    expect(formatCitation(source, "bibliography")).toContain(": 45–67.");
  });

  it("maps books and website-like records", () => {
    const book = mapCrossref(
      { message: { type: "monograph", title: ["Book"], publisher: "Press" } },
      "10.1/b",
    );
    expect(book.kind).toBe("book");
    const web = mapCrossref(
      {
        message: {
          type: "posted-content",
          title: ["Report"],
          issued: { "date-parts": [[2023, 1, 9]] },
          publisher: "Agency",
        },
      },
      "10.1/w",
    );
    expect(web).toMatchObject({ kind: "website", year: "2023-01-09" });
  });

  it("reports a missing record", () => {
    expect(() => mapCrossref(null, "10.1/x")).toThrow(
      "No match found for that DOI",
    );
  });
});

describe("Open Library mapping", () => {
  it("maps title, subtitle, author, publisher, year, and ISBN", () => {
    const draft = mapOpenLibrary(openLibraryFixture, "9780593321041");
    expect(draft).toEqual({
      kind: "book",
      title: "Interior Chinatown: A Novel",
      authors: ["Charles Yu"],
      publisher: "Pantheon Books",
      year: "2020",
      isbn: "9780593321041",
    });
    const source: Source = { id: "b", ...draft };
    expect(formatCitation(source, "bibliography")).toBe(
      "Yu, Charles. Interior Chinatown: A Novel. Pantheon Books, 2020.",
    );
  });

  it("reports an ISBN with no record", () => {
    expect(() => mapOpenLibrary({}, "9780593321041")).toThrow(
      "No match found for that ISBN",
    );
  });
});

describe("HTML metadata parsing", () => {
  it("prefers citation tags, decodes entities, and reads a journal name", () => {
    const draft = parseHtmlMetadata(
      page.replace(
        "</head>",
        '<meta name="citation_journal_title" content="Harbor Review"></head>',
      ),
      "https://example.org/a",
    );
    expect(draft).toMatchObject({
      kind: "journal",
      title: "Waiting for the Harbor & Other Stories",
      authors: ["Omar Reyes", "Ada Lovelace"],
      journal: "Harbor Review",
      year: "2025",
      doi: "10.5555/page-doi",
    });
  });

  it("falls back to Open Graph and the title tag for websites", () => {
    const draft = parseHtmlMetadata(
      "<html><head><title>Fallback &amp; Title</title>" +
        '<meta property="og:title" content="Social Title">' +
        '<meta property="og:site_name" content="Harbor Journal">' +
        '<meta property="article:author" content="https://example.org/u">' +
        '<meta property="article:author" content="Ada Lovelace">' +
        "</head></html>",
      "https://www.example.org/post",
    );
    expect(draft).toMatchObject({
      kind: "website",
      title: "Social Title",
      authors: ["Ada Lovelace"],
      website: "Harbor Journal",
      url: "https://www.example.org/post",
    });
    const fallback = parseHtmlMetadata(
      "<title>Fallback &amp; Title</title>",
      "https://www.example.org/post",
    );
    expect(fallback.title).toBe("Fallback & Title");
    expect(fallback.website).toBe("example.org");
  });

  it("formats a parsed website through the Chicago helpers", () => {
    const draft = parseHtmlMetadata(page, "https://example.org/a");
    const source: Source = {
      id: "p",
      ...draft,
      kind: "website",
      accessed: "2026-10-16",
    };
    expect(formatCitation(source, "full")).toContain("March 4, 2025");
    expect(
      bibliography({ sources: [source], notes: [], footnotes: [] }),
    ).toHaveLength(1);
  });
});

describe("lookupIdentifier with injected fetch", () => {
  it("uses the DOI from a web page and labels the provider", async () => {
    const seen: string[] = [];
    const result = await lookupIdentifier("https://example.org/a", {
      today: "2026-10-16",
      fetchText: async (url) => {
        seen.push(url);
        if (url.startsWith("https://api.crossref.org/"))
          return JSON.stringify(crossrefFixture);
        return page;
      },
    });
    expect(seen).toEqual([
      "https://example.org/a",
      "https://api.crossref.org/works/10.5555/page-doi",
    ]);
    expect(result.provider).toBe("Crossref");
    expect(result.source.lookupNote).toBe("Found on Crossref");
  });

  it("maps an ISBN through Open Library and reports a Crossref miss", async () => {
    const isbn = await lookupIdentifier("978-0-593-32104-1", {
      fetchText: async (url) => {
        expect(url).toContain("bibkeys=ISBN:9780593321041");
        return JSON.stringify(openLibraryFixture);
      },
    });
    expect(isbn.source.title).toBe("Interior Chinatown: A Novel");
    await expect(
      lookupIdentifier("10.1234/missing", {
        fetchText: async () => {
          throw new FetchFailure("HTTP 404", 404);
        },
      }),
    ).rejects.toThrow("No match found for that DOI");
  });

  it("sets the access date for websites and explains browser blocks", async () => {
    const result = await lookupIdentifier("https://example.org/plain", {
      today: "2026-10-16",
      fetchText: async () => "<title>Plain</title>",
    });
    expect(result.source).toMatchObject({
      kind: "website",
      title: "Plain",
      accessed: "2026-10-16",
    });
    await expect(
      lookupIdentifier("https://example.org/blocked", {
        fetchText: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    ).rejects.toThrow("This site can't be read from the browser preview");
  });
});
