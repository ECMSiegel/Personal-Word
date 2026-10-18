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
  it("counts unsupported item types", () => {
    expect(parseCslJson(JSON.stringify([{ type: "chapter" }, { type: "thesis" }]), []).skipped).toEqual({ chapter: 1, thesis: 1 });
  });
  it("counts prototype-named unsupported item types safely", () => {
    const skipped = parseCslJson(JSON.stringify([{ type: "__proto__" }, { type: "constructor" }, { type: "toString" }]), []).skipped;
    expect(skipped["__proto__"]).toBe(1);
    expect(skipped["constructor"]).toBe(1);
    expect(skipped["toString"]).toBe(1);
    expect(Object.keys(skipped)).toHaveLength(3);
  });
  it("skips duplicates by Zotero id, DOI, and title plus first author", () => {
    const existing: Source[] = [
      { id: "e1", kind: "book", title: "A Book", authors: ["Jane Smith"], cslId: "z1" },
      { id: "e2", kind: "journal", title: "DOI title", authors: [], doi: "10/doi" },
      { id: "e3", kind: "website", title: "Known title", authors: ["Alex Doe"] },
    ];
    const items = [book, { type: "book", title: "Different", DOI: "https://doi.org/10/doi" }, { type: "webpage", title: "Known title", author: [{ family: "Doe", given: "Alex" }] }, { type: "book", title: "New", author: [] }];
    const result = parseCslJson(JSON.stringify(items), existing);
    expect(result.duplicates).toBe(3);
    expect(result.sources.map((s) => s.title)).toEqual(["New"]);
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
