import { describe, expect, it } from "vitest";
import { BIBTEX_MAX_CHARS, parseBibtex, texToText } from "./bibtexImport";
import { parseCslJson } from "./cslImport";
import type { Source } from "./types";

const fixture = `
Free text, an email me@example.com, and notes that are ignored.
@comment{ignored {nested} comment}
@preamble{"\\newcommand{\\x}{y}"}
@string{lup = "Louisiana State University Press"}
@string{city = {Baton Rouge}}
@string{pubfull = lup # ", " # city}

@book{smith2019,
  author = {Smith, Jane and Garc{\\'i}a, Jos{\\'e} Mar{\\'i}a},
  title = {{The} Art of {DNA} Sequencing: A {Practical} Guide},
  publisher = pubfull,
  address = city,
  year = 2019,
  month = mar,
  edition = {2nd},
  isbn = {978-0-306-40615-7},
}
@article{jones2021,
  author = "Jones, K. and M{\\\"u}ller, H. and others",
  title = {Tides and Time},
  journal = {Journal of Coastal Research},
  volume = {37}, number = {2}, pages = {101--118},
  year = {2021},
  doi = {https://doi.org/10.1234/ABC.def},
}
@incollection{chen2020,
  author = {Chen, Mina},
  editor = {Ng, Sam and {Research Collective}},
  title = {Estuaries \\& Deltas},
  booktitle = {Coastal Methods},
  publisher = {Oak Press}, year = 2020, pages = {5--20},
}
@inbook{lee2018, author={Lee, Ann}, title={Chapter Title}, booktitle={Whole Book}, year={2018}}
@phdthesis{ocon2015, author = {Fran\\c{c}ois O'Connor}, title = {Mar\\'ee}, school = {State University}, year = 2015}
@mastersthesis{pena2016, author = {Pe\\~na, Mar\\'ia}, title = {Stra\\ss e}, school = {Uni}, year = 2016}
@misc{misc1, author = {{World Health Organization}}, title = {Global Report}, year = 2022, howpublished = {Geneva}}
@online{web1, author = {Doe, Alex}, title = {A Page}, url = {https://example.org/a_b\\_c}, urldate = {2024-03-05}, date = {2023-11-02}, organization = {Example Org}}
@techreport{tr1, author = {Rivers, Pat}, title = {Water Report}, institution = {Hydro Lab}, number = {TR-9}, year = 2017}
@inproceedings{conf1, author = {Ito, Y. and Ng, B.}, title = {Fast Tides}, booktitle = {Proceedings of the Tide Conference}, year = 2014, pages = "1--9"}
`;

describe("BibTeX import", () => {
  const result = parseBibtex(fixture, []);
  const byId = (id: string) => result.sources.find((s) => s.cslId === id)!;

  it("reads every supported entry type and ignores comments, preamble and stray text", () => {
    expect(result.sources.map((s) => [s.cslId, s.kind])).toEqual([
      ["smith2019", "book"], ["jones2021", "journal"], ["chen2020", "chapter"], ["lee2018", "chapter"],
      ["ocon2015", "thesis"], ["pena2016", "thesis"], ["misc1", "other"], ["web1", "website"],
      ["tr1", "report"], ["conf1", "conference"],
    ]);
    expect(result.sources.every((s) => s.lookupNote === "Imported from BibTeX")).toBe(true);
    expect(result.review.newSources).toHaveLength(10);
  });
  it("expands @string macros with # concatenation and months", () => {
    expect(byId("smith2019")).toMatchObject({ publisher: "Louisiana State University Press, Baton Rouge", year: "2019", edition: "2nd", isbn: "978-0-306-40615-7" });
    expect((byId("smith2019").cslData as any).issued).toEqual({ "date-parts": [[2019, 3]] });
  });
  it("strips protective braces without losing letters and decodes accents", () => {
    expect(byId("smith2019").title).toBe("The Art of DNA Sequencing: A Practical Guide");
    expect(byId("smith2019").authors).toEqual(["Jane Smith", "José María García"]);
    expect(byId("ocon2015").authors).toEqual(["François O'Connor"]);
    expect(byId("ocon2015").title).toBe("Marée");
    expect(byId("pena2016")).toMatchObject({ authors: ["María Peña"], title: "Straße" });
    expect(byId("chen2020").title).toBe("Estuaries & Deltas");
  });
  it("maps article fields, en-dash pages and normalizes the DOI", () => {
    expect(byId("jones2021")).toMatchObject({ journal: "Journal of Coastal Research", volume: "37", issue: "2", pages: "101–118", doi: "10.1234/ABC.def" });
    expect(byId("jones2021").authors).toEqual(["K. Jones", "H. Müller"]);
    expect(result.warnings.some((w) => w.includes("and others"))).toBe(true);
    expect((byId("jones2021").cslData as any).bibtex.etAl).toBe(true);
  });
  it("keeps corporate and editor creators, and container for chapters and conferences", () => {
    expect(byId("misc1").creators).toEqual([{ role: "author", literal: "World Health Organization" }]);
    expect(byId("chen2020")).toMatchObject({ container: "Coastal Methods", publisher: "Oak Press" });
    expect(byId("chen2020").creators).toEqual([{ role: "author", given: "Mina", family: "Chen" }, { role: "editor", given: "Sam", family: "Ng" }, { role: "editor", literal: "Research Collective" }]);
    expect(byId("conf1")).toMatchObject({ container: "Proceedings of the Tide Conference", pages: "1–9" });
    expect(byId("tr1")).toMatchObject({ institution: "Hydro Lab", publisher: "Hydro Lab", issue: "TR-9" });
    expect(byId("ocon2015")).toMatchObject({ institution: "State University" });
  });
  it("reads url, dates and organization for online entries", () => {
    expect(byId("web1")).toMatchObject({ url: "https://example.org/a_b_c", accessed: "2024-03-05", year: "2023", website: "Example Org" });
  });
  it("keeps the raw fields in cslData", () => {
    const raw = (byId("jones2021").cslData as any).bibtex;
    expect(raw).toMatchObject({ key: "jones2021", type: "article" });
    expect(raw.fields.pages).toBe("101--118");
  });
  it("parses personal-name shapes: von, Jr and First Last", () => {
    const r = parseBibtex(`@book{a, title={T}, author={Ludwig van Beethoven and von Neumann, John and Smith, Jr., John Q. and Jean Pierre Dupont and Plato}}`);
    expect(r.sources[0].creators).toEqual([
      { role: "author", given: "Ludwig", family: "van Beethoven" },
      { role: "author", given: "John", family: "von Neumann" },
      { role: "author", given: "John Q.", family: "Smith" },
      { role: "author", given: "Jean Pierre", family: "Dupont" },
      { role: "author", family: "Plato" },
    ]);
    expect((r.sources[0].cslData as any).author[2].suffix).toBe("Jr.");
  });
  it("handles quoted values, nested braces, parenthesised entries and bare numbers", () => {
    const r = parseBibtex(`@article(k1, title = "A {nested {deep} brace} {\\"o}" # { more}, year = 1999, journal = {J})`);
    expect(r.sources[0]).toMatchObject({ year: "1999" });
    const r2 = parseBibtex(`@article{k2, title = {A {nested {deep {brace}}} title}, journal={J}}`);
    expect(r2.sources[0].title).toBe("A nested deep brace title");
  });
  it("decodes common LaTeX", () => {
    expect(texToText("{\\\"u}ber \\c{c}a \\~n \\ss{} \\'{\\i} \\v{s} 10--20 a---b \\&")).toBe("über ça ñ ß í š 10–20 a—b &");
  });
  it("renders composer-macro titles verbatim instead of dropping the command (fail-first: \\TeX used to yield 'The book')", () => {
    // Reproduced from tests/fixtures/sample.bib and the BibTeX import
    // production-preview browser case: title = {The {\TeX}book}.
    expect(texToText("The {\\TeX}book")).toBe("The TeXbook");
    expect(texToText("\\LaTeX")).toBe("LaTeX");
    // LaTeX swallows the space after a control word, so "A \BibTeX primer"
    // renders "A BibTeXprimer" (same rule the file already applies to \ss{}).
    expect(texToText("A \\BibTeX primer")).toBe("A BibTeXprimer");
    const r = parseBibtex(`@book{knuth1984texbook, title = {The {\\TeX}book}, author = {Knuth, Donald E.}, year = 1984}`);
    expect(r.sources[0].title).toBe("The TeXbook");
  });
  it("keeps unknown macro names as text and warns about them", () => {
    expect(texToText("The {\\METAFONT}book")).toBe("The METAFONTbook");
    expect(texToText("\\XeTeX")).toBe("XeTeX");
    // Formatting commands still just keep their argument.
    expect(texToText("An \\emph{important} \\textbf{study}")).toBe("An important study");
    const r = parseBibtex(`@book{mf, title = {The {\\METAFONT}book}, author = {Knuth, Donald E.}, year = 1986}`);
    expect(r.sources[0].title).toBe("The METAFONTbook");
    expect(r.warnings.some((w) => w.includes("\\METAFONT") && w.includes("The METAFONTbook"))).toBe(true);
  });
  it("resolves crossref for a missing booktitle", () => {
    const r = parseBibtex(`@incollection{c1, title={Ch}, author={A, B}, crossref={book1}, pages={1--2}}
@book{book1, title={The Big Book}, publisher={P}, year=2001}`);
    expect(r.sources[0]).toMatchObject({ container: "The Big Book", publisher: "P", year: "2001" });
  });
  it("warns and skips a malformed entry but imports the rest", () => {
    const r = parseBibtex(`@book{good1, title={Good One}, year=2000}
@book{bad, title={Never closed, year=2001
@book{good2, title={Good Two}, year=2002}
@book{notitle, year=2003}
@article{nokey title={x}}`);
    expect(r.sources.map((s) => s.title)).toEqual(["Good One", "Good Two"]);
    expect(r.warnings.filter((w) => /Skipped/.test(w)).length).toBeGreaterThanOrEqual(2);
    expect(r.skipped.invalid).toBeGreaterThanOrEqual(2);
  });
  it("keeps unknown entry types as generic records with a warning", () => {
    const r = parseBibtex(`@manual{m1, title={Manual Title}, author={Co, A}}`);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].kind).toBe("other");
    expect(r.warnings.some((w) => w.includes("@manual"))).toBe(true);
  });
  it("warns on duplicate keys and undefined macros but keeps both", () => {
    const r = parseBibtex(`@book{d, title={One}, publisher=nope}
@book{d, title={Two}}`);
    expect(r.sources).toHaveLength(2);
    expect(r.warnings.some((w) => w.includes("“d” appears more than once"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("“nope” is not defined"))).toBe(true);
  });
  it("enforces size, entry-count and nesting limits", () => {
    expect(() => parseBibtex("x".repeat(BIBTEX_MAX_CHARS + 1))).toThrow(/larger than 5 MB/);
    const many = Array.from({ length: 5001 }, (_, i) => `@misc{k${i}, title={T${i}}}`).join("\n");
    expect(() => parseBibtex(many)).toThrow(/more than 5000 entries/);
    expect(parseBibtex(many.split("\n").slice(0, 5000).join("\n")).sources).toHaveLength(5000);
    const deep = (n: number) => `@misc{k, title=${"{".repeat(n)}x${"}".repeat(n)}}`;
    expect(() => parseBibtex(deep(51))).toThrow(/nested more than 50/);
    expect(parseBibtex(deep(49)).sources[0].title).toBe("x");
    expect(() => parseBibtex("just some text")).toThrow(/does not contain any BibTeX/);
  });
  it("stops exponential macro growth", () => {
    let defs = '@string{a0 = "xxxxxxxxxx"}\n';
    for (let i = 1; i < 40; i++) defs += `@string{a${i} = a${i - 1} # a${i - 1}}\n`;
    const r = parseBibtex(defs + "@misc{k, title={t}, note=a39}\n@misc{k2, title={ok}}");
    expect(r.sources.map((s) => s.title)).toEqual(["t", "ok"]);
    expect(r.warnings.some((w) => w.includes("too long"))).toBe(true);
  });
  it("is safe with prototype-named keys, fields, types and macros", () => {
    const r = parseBibtex(`@string{__proto__ = "polluted"}
@__proto__{constructor, title = {Proto}, __proto__ = {x}, constructor = {y}, publisher = __proto__}
@book{__proto__, title = {Book}, toString = {z}}`);
    expect(r.sources).toHaveLength(2);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(Object.getPrototypeOf((r.sources[0].cslData as any).bibtex.fields)).toBe(Object.prototype);
    expect(r.sources[0].publisher).toBe("polluted");
    expect((r.sources[0].cslData as any).bibtex.fields.constructor).toBe("y");
    expect(r.sources[1].cslId).toBe("__proto__");
  });
  it("feeds duplicate detection exactly like an equivalent CSL JSON item", () => {
    const existing: Source[] = [
      { id: "e1", kind: "journal", title: "Other", authors: [], doi: "10.1234/abc.def" },
      { id: "e2", kind: "book", title: "Fresh", authors: [], isbn: "9780306406157", edition: "2" },
    ];
    const bib = `@article{x, title={Tides}, author={Jones, K.}, journal={J}, year=2021, doi={10.1234/ABC.def}}
@book{y, title={Fresh}, author={Smith, Jane}, edition={2}, isbn={978-0-306-40615-7}, year=2019}
@book{z, title={Brand New}, year=2020}`;
    const csl = [
      { id: "x", type: "article-journal", title: "Tides", author: [{ family: "Jones", given: "K." }], "container-title": "J", issued: { "date-parts": [[2021]] }, DOI: "10.1234/ABC.def" },
      { id: "y", type: "book", title: "Fresh", author: [{ family: "Smith", given: "Jane" }], edition: "2", ISBN: "978-0-306-40615-7", issued: { "date-parts": [[2019]] } },
      { id: "z", type: "book", title: "Brand New", issued: { "date-parts": [[2020]] } },
    ];
    const a = parseBibtex(bib, existing);
    const b = parseCslJson(JSON.stringify(csl), existing);
    const shape = (r: typeof a) => ({
      dup: r.review.exactDuplicates.map((d) => [d.candidateIndex, d.existingSourceIds, d.matchedBy]),
      news: r.review.newSources.map((n) => n.candidateIndex),
      possible: r.review.possibleMatches.map((p) => [p.candidateIndex, p.matches]),
      duplicates: r.duplicates,
    });
    expect(shape(a)).toEqual(shape(b));
    expect(shape(a).dup.length).toBeGreaterThanOrEqual(1);
    expect(a.sources.map((s) => ({ ...s, lookupNote: "", cslData: undefined }))).toEqual(b.sources.map((s) => ({ ...s, lookupNote: "", cslData: undefined })));
  });
});
