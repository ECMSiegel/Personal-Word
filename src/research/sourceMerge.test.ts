import { describe, expect, it } from "vitest";
import { mergeSourceFields, reviewSourceImport, type SourceImportField } from "./sourceMerge";
import type { Source } from "./types";
import type { SourceDraft } from "./lookup";

const candidate = (fields: Partial<SourceDraft> = {}): SourceDraft => ({
  kind: "book",
  title: "A Work",
  authors: ["Jane Smith"],
  ...fields,
});

const existing = (id: string, fields: Partial<Source> = {}): Source => ({
  id,
  ...candidate(),
  ...fields,
});

describe("reviewSourceImport", () => {
  it("reports normalized valid DOI duplicates and preserves candidate identity", () => {
    const draft = candidate({ doi: "https://dx.doi.org/10.1234/Example(2)" });
    const reviewed = reviewSourceImport([draft], [
      existing("doi-match", { doi: "DOI: 10.1234/example(2)" }),
    ]);

    expect(reviewed.exactDuplicates).toEqual([{
      candidateIndex: 0,
      candidate: draft,
      existingSourceIds: ["doi-match"],
      matchedBy: ["doi"],
    }]);
    expect(reviewed.newSources).toEqual([]);
  });

  it("does not suppress identical candidates within the imported batch", () => {
    const first = candidate();
    const second = candidate();
    const reviewed = reviewSourceImport([first, second], []);

    expect(reviewed.newSources).toEqual([
      { candidateIndex: 0, candidate: first },
      { candidateIndex: 1, candidate: second },
    ]);
    expect(reviewed.exactDuplicates).toEqual([]);
  });

  it("requires a valid ISBN, same source kind, and explicit equal edition for exactness", () => {
    const isbn = "978-0-306-40615-7";
    const draft = candidate({ isbn, edition: "2nd" });
    const sameEdition = existing("same-edition", { isbn: "9780306406157", edition: " 2ND " });
    const otherEdition = existing("other-edition", { isbn, edition: "3rd" });
    const otherKind = existing("other-kind", { isbn, edition: "2nd", kind: "chapter" });
    const missingEdition = existing("missing-edition", { isbn });

    const exact = reviewSourceImport([draft], [sameEdition]);
    const suggestions = reviewSourceImport([draft], [otherEdition, otherKind, missingEdition]);

    expect(exact.exactDuplicates[0]).toMatchObject({
      existingSourceIds: ["same-edition"],
      matchedBy: ["isbn-edition-type"],
    });
    expect(suggestions.possibleMatches[0].matches).toEqual(expect.arrayContaining([
      { existingSourceId: "other-edition", reasons: expect.arrayContaining(["isbn"]) },
      { existingSourceId: "other-kind", reasons: expect.arrayContaining(["isbn"]) },
      { existingSourceId: "missing-edition", reasons: expect.arrayContaining(["isbn"]) },
    ]));
    expect(suggestions.possibleMatches[0].matches).not.toContainEqual(
      expect.objectContaining({ existingSourceId: "same-edition" }),
    );
  });

  it("accepts only a verified Zotero item URI as exact external identity", () => {
    const verifiedDraft = candidate({ cslId: "https://www.zotero.org/users/42/items/AbC123" });
    const unverifiedDraft = candidate({ title: "Another work", cslId: "https://example.test/users/42/items/AbC123" });
    const bareDraft = candidate({ title: "Third work", cslId: "AbC123" });
    const portDraft = candidate({ title: "Fourth work", cslId: "https://zotero.org:8443/users/42/items/AbC123" });
    const verified = existing("verified", { cslId: "http://zotero.org/users/42/items/AbC123" });
    const arbitraryUrl = existing("arbitrary", { title: "Another work", cslId: "https://example.test/users/42/items/AbC123" });
    const bareId = existing("bare", { title: "Third work", cslId: "AbC123" });
    const portUrl = existing("port", { title: "Fourth work", cslId: "https://zotero.org:8443/users/42/items/AbC123" });

    const reviewed = reviewSourceImport([verifiedDraft, unverifiedDraft, bareDraft, portDraft], [verified, arbitraryUrl, bareId, portUrl]);

    expect(reviewed.exactDuplicates[0]).toMatchObject({
      existingSourceIds: ["verified"],
      matchedBy: ["external-id"],
    });
    expect(reviewed.possibleMatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidateIndex: 1, matches: expect.arrayContaining([
      { existingSourceId: "arbitrary", reasons: expect.arrayContaining(["unverified-csl-id"]) },
      ]) }),
      expect.objectContaining({ candidateIndex: 2, matches: expect.arrayContaining([
        { existingSourceId: "bare", reasons: expect.arrayContaining(["unverified-csl-id"]) },
      ]) }),
      expect.objectContaining({ candidateIndex: 3, matches: expect.arrayContaining([
        { existingSourceId: "port", reasons: expect.arrayContaining(["unverified-csl-id"]) },
      ]) }),
    ]));
  });

  it("keeps title-only and complete creator/year/type matches as suggestions", () => {
    const draft = candidate({
      creators: [
        { role: "author", given: "Jane", family: "Smith" },
        { role: "editor", literal: "Research Group" },
      ],
      year: "2020",
    });
    const titleOnly = existing("title-only", { title: "  A   Work " });
    const complete = existing("complete", {
      title: "Different title",
      creators: [
        { role: "author", given: "Jane", family: "Smith" },
        { role: "editor", literal: "Research Group" },
      ],
      authors: [],
      year: "2020",
    });
    const sharedSurname = existing("same-surname", {
      title: "Unrelated work",
      creators: [{ role: "author", given: "John", family: "Smith" }],
      authors: [],
      year: "2020",
    });

    const reviewed = reviewSourceImport([draft], [titleOnly, complete, sharedSurname]);

    expect(reviewed.exactDuplicates).toEqual([]);
    expect(reviewed.possibleMatches[0].matches).toEqual(expect.arrayContaining([
      { existingSourceId: "title-only", reasons: expect.arrayContaining(["title"]) },
      { existingSourceId: "complete", reasons: expect.arrayContaining(["creators", "year", "kind"]) },
    ]));
    expect(reviewed.possibleMatches[0].matches).not.toContainEqual(
      expect.objectContaining({ existingSourceId: "same-surname" }),
    );
  });

  it("blocks ISBN and external-ID exact fallback when valid DOIs conflict", () => {
    const draft = candidate({
      title: "Imported title",
      doi: "10.1234/first",
      isbn: "9780306406157",
      edition: "1st",
      cslId: "https://zotero.org/users/42/items/AbC123",
    });
    const previous = existing("conflict", {
      title: "Existing title",
      doi: "10.1234/second",
      isbn: "978-0-306-40615-7",
      edition: "1st",
      cslId: "https://www.zotero.org/users/42/items/AbC123",
    });

    const reviewed = reviewSourceImport([draft], [previous]);

    expect(reviewed.exactDuplicates).toEqual([]);
    expect(reviewed.newSources).toEqual([]);
    expect(reviewed.possibleMatches[0].matches).toEqual([{
      existingSourceId: "conflict",
      reasons: expect.arrayContaining(["isbn", "external-id", "conflicting-doi"]),
    }]);
    expect(reviewed.warnings).toEqual([
      "The imported source “Imported title” has a DOI that differs from “Existing title”. Review both records before choosing.",
    ]);
  });

  it("does not mutate source records or candidate drafts", () => {
    const draft = candidate({ creators: [{ role: "author", given: "A", family: "Writer" }] });
    const old = existing("old", { creators: [{ role: "author", given: "A", family: "Writer" }] });
    const beforeDraft = structuredClone(draft);
    const beforeOld = structuredClone(old);

    reviewSourceImport([draft], [old]);

    expect(draft).toEqual(beforeDraft);
    expect(old).toEqual(beforeOld);
  });
});

describe("mergeSourceFields", () => {
  it("defaults to preserving the existing source, including identity and local metadata", () => {
    const old = {
      ...existing("stable-id", {
        title: "Local title",
        manualFull: "Local full note",
        manualShort: "Local short note",
        manualBibliography: "Local bibliography",
        lookupNote: "Found locally",
      }),
      localExtension: { keep: true },
    } as Source & { localExtension: { keep: boolean } };
    const imported = Object.assign(candidate({ title: "Imported title" }), { id: "attacker-id", localExtension: "imported" });

    const merged = mergeSourceFields(old, imported, []);

    expect(merged).toEqual(old);
    expect(merged).not.toBe(old);
  });

  it("copies only explicitly selected fields and replaces raw CSL only as one selected field", () => {
    const old = {
      ...existing("stable-id", {
        title: "Local title",
        doi: "10.1234/local",
        year: "1999",
        manualFull: "Local full note",
        manualShort: "Local short note",
        manualBibliography: "Local bibliography",
        lookupNote: "Found locally",
        cslData: { local: "preserve unless selected" },
      }),
      localExtension: "keep",
    } as Source & { localExtension: string };
    const imported = Object.assign(candidate({
      title: "Imported title",
      doi: "10.1234/imported",
      year: "2024",
      cslData: { id: "raw-id", custom: { preservedAsRaw: true } },
    }), { id: "attacker-id", manualFull: "Overwrite", localExtension: "overwrite", injectedTopLevel: true });

    const merged = mergeSourceFields(old, imported, ["title", "cslData"]);

    expect(merged.id).toBe("stable-id");
    expect(merged.title).toBe("Imported title");
    expect(merged.doi).toBe("10.1234/local");
    expect(merged.year).toBe("1999");
    expect(merged.cslData).toEqual({ id: "raw-id", custom: { preservedAsRaw: true } });
    expect(merged).not.toHaveProperty("raw-id");
    expect(merged).not.toHaveProperty("custom");
    expect(merged).not.toHaveProperty("injectedTopLevel");
    expect((merged as Source & { localExtension: string }).localExtension).toBe("keep");
    expect(merged.manualFull).toBe("Local full note");
    expect(merged.manualShort).toBe("Local short note");
    expect(merged.manualBibliography).toBe("Local bibliography");
    expect(merged.lookupNote).toBe("Found locally");
  });

  it("copies authors and structured creators together, clearing stale creators when absent", () => {
    const old = existing("stable-id", {
      authors: ["Old Author"],
      creators: [{ role: "author", given: "Old", family: "Author" }, { role: "editor", literal: "Old Editor" }],
    });
    const structured = candidate({
      authors: ["New Author"],
      creators: [{ role: "author", given: "New", family: "Author" }, { role: "editor", literal: "New Editor" }],
    });
    const importedWithoutCreators = candidate({ authors: ["Legacy Imported Author"] });

    expect(mergeSourceFields(old, structured, ["authorsAndCreators"])).toMatchObject({
      id: "stable-id",
      authors: ["New Author"],
      creators: [{ role: "author", given: "New", family: "Author" }, { role: "editor", literal: "New Editor" }],
    });
    expect(mergeSourceFields(old, importedWithoutCreators, ["authorsAndCreators"])).toMatchObject({
      id: "stable-id",
      authors: ["Legacy Imported Author"],
    });
    expect(mergeSourceFields(old, importedWithoutCreators, ["authorsAndCreators"])).not.toHaveProperty("creators");
  });

  it("allows explicitly selected empty values but preserves absent optional fields", () => {
    const old = existing("stable-id", { title: "Local title", cslId: "local-csl-id", isbn: "9780306406157" });
    const imported = candidate({ title: "", authors: [], creators: [], isbn: "" });

    const merged = mergeSourceFields(old, imported, ["title", "authorsAndCreators", "isbn", "cslId"]);

    expect(merged.title).toBe("");
    expect(merged.authors).toEqual([]);
    expect(merged.creators).toEqual([]);
    expect(merged.isbn).toBe("");
    expect(merged.cslId).toBe("local-csl-id");
  });

  it.each(["id", "__proto__", "constructor", "manualFull", "manualShort", "manualBibliography", "lookupNote", "unexpected"])(
    "rejects unsupported selected token %s",
    (token) => {
      const old = existing("stable-id", { manualFull: "Keep" });
      const before = structuredClone(old);
      expect(() => mergeSourceFields(old, candidate({ title: "Imported" }), [token as SourceImportField])).toThrow(/unsupported source import field/i);
      expect(old).toEqual(before);
    },
  );
});
