import { describe, expect, it } from "vitest";
import { parseCslJson } from "./cslImport";
import type { Source } from "./types";

const book = { id: "z1", type: "book", title: "A Book", author: [{ family: "Smith", given: "Jane" }], publisher: "Press", issued: { "date-parts": [[2019]] } };
describe("Zotero CSL JSON import", () => {
  it("maps books and journal articles", () => {
    const result = parseCslJson(JSON.stringify([book, { id: "z2", type: "article-journal", title: "An Article", author: [{ family: "Jones" }], "container-title": "Journal", volume: 4, issue: 2, page: "10-20", DOI: "10/test" }]), []);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({ kind: "book", title: "A Book", authors: ["Jane Smith"], year: "2019", publisher: "Press", cslId: "z1", lookupNote: "Imported from Zotero" });
    expect(result.sources[1]).toMatchObject({ kind: "journal", journal: "Journal", authors: ["Jones"], volume: "4", issue: "2", pages: "10-20", doi: "10/test" });
  });
  it("keeps literal institutional authors and tolerates no author", () => {
    const result = parseCslJson(JSON.stringify([
      { type: "book", title: "Institution", author: [{ literal: "World Health Organization" }] },
      { type: "webpage", title: "No author" },
    ]), []);
    expect(result.sources.map((s) => s.authors)).toEqual([["World Health Organization"], []]);
    expect(JSON.stringify(result)).not.toContain("undefined");
  });
  it("counts invalid records without titles", () => {
    expect(parseCslJson(JSON.stringify([{ type: "chapter" }, { type: "thesis" }]), []).skipped).toEqual({ invalid: 2 });
  });
  it("retains prototype-named types safely as raw other records", () => {
    const result = parseCslJson(JSON.stringify(["__proto__", "constructor", "toString"].map((type) => ({ type, title: type }))), []);
    expect(result.sources.map((source) => source.kind)).toEqual(["other", "other", "other"]);
    expect(result.sources.map((source) => source.cslData!.type)).toEqual(["__proto__", "constructor", "toString"]);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it("reports exact DOI matches for review without discarding any candidate", () => {
    const existing: Source[] = [
      { id: "e1", kind: "book", title: "A Book", authors: ["Jane Smith"], cslId: "z1" },
      { id: "e2", kind: "journal", title: "DOI title", authors: [], doi: "10.1234/doi" },
      { id: "e3", kind: "website", title: "Known title", authors: ["Alex Doe"] },
    ];
    const items = [book, { type: "book", title: "Different", DOI: "https://dx.doi.org/10.1234/DOI" }, { type: "webpage", title: "Known title", author: [{ family: "Doe", given: "Alex" }] }, { type: "book", title: "New", author: [] }];
    const result = parseCslJson(JSON.stringify(items), existing);
    expect(result.duplicates).toBe(1);
    expect(result.sources.map((source) => source.title)).toEqual(["A Book", "Different", "Known title", "New"]);
    expect(result.review.exactDuplicates[0]).toMatchObject({ candidateIndex: 1, existingSourceIds: ["e2"], matchedBy: ["doi"] });
    expect(existing.map((source) => source.id)).toEqual(["e1", "e2", "e3"]);
  });
  it("retains different works with the same title and first surname", () => {
    const existing: Source[] = [{ id: "old", kind: "journal", title: "Shared title", authors: ["Jane Smith"], year: "2020", doi: "10.1234/old" }];
    const result = parseCslJson(JSON.stringify([{ type: "article-journal", title: "Shared title", author: [{ given: "John", family: "Smith" }], issued: { "date-parts": [[2024]] }, DOI: "10.1234/new" }]), existing);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].doi).toBe("10.1234/new");
  });
  it("does not treat a bare CSL id from another export as globally unique", () => {
    const result = parseCslJson(JSON.stringify([{ ...book, title: "Another work", DOI: "10.1234/new" }]), [{ id: "old", kind: "book", title: "Old work", authors: [], cslId: "z1", doi: "10.1234/old" }]);
    expect(result.sources).toHaveLength(1);
  });
  it("retains unsupported raw CSL records and corporate creator identity", () => {
    const item = { id: "raw-1", type: "custom-record", title: "Corporate archive", author: [{ literal: "Coastal Research Council" }], custom: { nested: ["保留", 17] } };
    const result = parseCslJson(JSON.stringify([item]), []);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ kind: "other", cslData: item, creators: [{ role: "author", literal: "Coastal Research Council" }] });
  });
  it("preserves chapter type, edition, editor and full issued date", () => {
    const item = { type: "chapter", title: "Estuaries", author: [{ given: "Mina", family: "Chen" }], editor: [{ literal: "Research Collective" }], "container-title": "Coastal Methods", edition: "2", issued: { "date-parts": [[2024, 5, 2]] } };
    const result = parseCslJson(JSON.stringify([item]), []);
    expect(result.sources[0]).toMatchObject({ kind: "chapter", container: "Coastal Methods", edition: "2", publishedDate: "2024-05-02", creators: [{ role: "author", given: "Mina", family: "Chen" }, { role: "editor", literal: "Research Collective" }], cslData: item });
  });
  it("rejects text that is not a CSL JSON array", () => {
    expect(() => parseCslJson("{bad", [])).toThrow("This file is not a CSL JSON export from Zotero.");
    expect(() => parseCslJson("{}", [])).toThrow("This file is not a CSL JSON export from Zotero.");
  });
  it("reads raw-only dates and title-short", () => {
    const result = parseCslJson(JSON.stringify({ items: [{ type: "post-weblog", title: "Post", "title-short": "Short", issued: { raw: "2019" }, accessed: { raw: "2024-01-02" } }] }), []);
    expect(result.sources[0]).toMatchObject({ kind: "website", title: "Post", shortTitle: "Short", year: "2019", accessed: "2024-01-02" });
  });
});
