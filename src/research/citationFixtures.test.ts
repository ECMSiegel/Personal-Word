import { describe, expect, it } from "vitest";
import { bibliography, citationParts, formatCitation } from "./citations";
import { normalizeDoi } from "./lookup";
import { doiKey, isbnKey } from "./identifiers";
import type { Source } from "./types";

// Identifier regression fixtures only; broader Chicago examples remain pending C1.
describe("citation DOI identifiers", () => {
  const source: Source = { id: "doi-fixture", kind: "journal", title: "Estuaries", authors: ["Mina Chen"], journal: "Coastal Studies", year: "2024" };
  it("uses valid canonical equality keys without changing display identifiers", () => {
    expect(doiKey("DOI: 10.1234/AbC(1)")).toBe("10.1234/abc(1)");
    expect(doiKey("not-a-doi")).toBeNull();
    expect(isbnKey("0-8044-2957-x")).toBe("080442957X");
    expect(isbnKey("978-0-306-40615-7")).toBe("9780306406157");
    expect(isbnKey("978-0-306-40615-8")).toBeNull();
    expect(isbnKey("not-an-isbn")).toBeNull();
  });
  it.each(["10.1234/AbC(1)", "https://doi.org/10.1234/AbC(1)", "https://dx.doi.org/10.1234/AbC(1)", "doi: 10.1234/AbC(1)"])("keeps lookup normalization for %s", (doi) => {
    expect(normalizeDoi(doi)).toBe("10.1234/AbC(1)");
  });
  it.each(["https://dx.doi.org/10.1234/AbC(1)", "doi: 10.1234/AbC(1)"])("formats one canonical DOI URL for %s", (doi) => {
    for (const mode of ["full", "bibliography"] as const) {
      const citation = formatCitation({ ...source, doi }, mode);
      expect(citation).toContain("https://doi.org/10.1234/AbC(1)");
      expect(citation.match(/https?:\/\//g)).toHaveLength(1);
      expect(citation).not.toContain("doi: ");
    }
  });
});

describe("Chicago 18 edited-book chapter fixture", () => {
  const chapter: Source = {
    id: "chapter-fixture",
    kind: "chapter",
    title: "Mapping Estuaries",
    authors: [],
    creators: [
      { role: "author", given: "Mina", family: "Chen" },
      { role: "editor", given: "Ravi", family: "Patel" },
    ],
    container: "Coastal Methods",
    publisher: "Harbor Press",
    year: "2024",
    pages: "10–25",
  };

  it("requires manual review when a chapter carries an edition outside the bounded fixture", () => {
    for (const mode of ["full", "short", "bibliography"] as const)
      expect(formatCitation({ ...chapter, edition: "2" }, mode)).toContain("[Manual ");
  });

  // Official Chicago 18 Notes & Bibliography sample, "Chapter or other part of an edited book":
  // https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html
  // It specifies the chapter note's locator and omits the chapter page range from the bibliography.
  it("formats the edited-book chapter note, short note, and bibliography entry", () => {
    expect(formatCitation(chapter, "full", "12")).toBe(
      "Mina Chen, “Mapping Estuaries,” in Coastal Methods, ed. Ravi Patel (Harbor Press, 2024), 12.",
    );
    expect(formatCitation(chapter, "short", "13")).toBe(
      "Chen, “Mapping Estuaries,” 13.",
    );
    expect(formatCitation(chapter, "bibliography")).toBe(
      "Chen, Mina. “Mapping Estuaries.” In Coastal Methods, edited by Ravi Patel. Harbor Press, 2024.",
    );
    expect(citationParts(chapter, "bibliography")).toContainEqual({
      text: "Coastal Methods",
      italic: true,
    });
  });
});

describe("structured creators and manual citation overrides", () => {
  it("preserves literal corporate authors in full, short, and bibliography forms", () => {
    const corporateBook: Source = {
      id: "corporate-author-fixture",
      kind: "book",
      title: "Coastal Indicators",
      authors: [],
      creators: [{ role: "author", literal: "World Health Organization" }],
      publisher: "Harbor Press",
      year: "2024",
    };

    expect(formatCitation(corporateBook, "full")).toBe(
      "World Health Organization, Coastal Indicators (Harbor Press, 2024).",
    );
    expect(formatCitation(corporateBook, "short")).toBe(
      "World Health Organization, Coastal Indicators.",
    );
    expect(formatCitation(corporateBook, "bibliography")).toBe(
      "World Health Organization. Coastal Indicators. Harbor Press, 2024.",
    );
  });

  it("uses exact manual text for each form and preserves bibliography punctuation", () => {
    const reviewed: Source = {
      id: "manual-forms-fixture",
      kind: "report",
      title: "A Difficult Report",
      authors: [],
      manualFull: "Reviewed full note: exact punctuation!",
      manualShort: "Reviewed short note; exact form.",
      manualBibliography: "Reviewed bibliography -- preserve this; exactly!",
    };

    expect(formatCitation(reviewed, "full")).toBe("Reviewed full note: exact punctuation!");
    expect(formatCitation(reviewed, "short")).toBe("Reviewed short note; exact form.");
    expect(formatCitation(reviewed, "bibliography")).toBe("Reviewed bibliography -- preserve this; exactly!");
    expect(bibliography({ sources: [reviewed], notes: [], footnotes: [] })[0].text).toBe(
      "Reviewed bibliography -- preserve this; exactly!",
    );
  });
});

// The bounded source-type examples below follow Chicago 18's free Notes & Bibliography
// citation guide. Raw CSL fields are used only where the exact documented example qualifies.
// https://www.chicagomanualofstyle.org/tools_citationguide/citation-guide-1.html
describe("Chicago 18 qualified thesis, newspaper, interview, and media fixtures", () => {
  const thesis: Source = {
    id: "thesis-fixture",
    kind: "thesis",
    title: "Listening to Cities: Harbor Cases",
    shortTitle: "Listening",
    authors: [],
    creators: [{ role: "author", given: "Rafael", family: "Ortiz" }],
    institution: "Lakeside University",
    year: "2024",
    cslData: { type: "thesis", genre: "PhD diss.", archive: "ProQuest", archive_location: "9876543" },
  };
  const newspaper: Source = {
    id: "newspaper-fixture",
    kind: "newspaper",
    title: "A New Ferry Line",
    shortTitle: "Ferry Line",
    authors: [],
    creators: [{ role: "author", given: "Maya", family: "Rao" }],
    container: "Harbor Daily",
    publishedDate: "2025-05-06",
    url: "https://example.org/ferry-line",
    cslData: { type: "article-newspaper" },
  };
  const interview: Source = {
    id: "interview-fixture",
    kind: "interview",
    title: "Listening to the Harbor",
    shortTitle: "Harbor",
    authors: [],
    creators: [
      { role: "author", given: "Nora", family: "Bell" },
      { role: "interviewer", given: "Eli", family: "Park" },
    ],
    container: "Civic Hour",
    publisher: "Public Radio",
    publishedDate: "2025-05-06",
    url: "https://example.org/audio",
    cslData: { type: "interview", medium: "audio", dimensions: "37:58" },
  };
  const talk: Source = {
    id: "talk-fixture",
    kind: "media",
    title: "Tidal Futures",
    shortTitle: "Tidal Futures",
    authors: [],
    creators: [{ role: "author", given: "Ilan", family: "Mercer" }],
    event: "TED Talk",
    url: "https://example.org/talk",
    cslData: {
      type: "speech",
      genre: "TED Talk",
      "event-place": "Boston, MA",
      "event-date": { "date-parts": [[2025, 4]] },
      medium: "video",
      dimensions: "9 min., 15 sec.",
    },
  };

  it("formats qualified PhD dissertation notes and bibliography", () => {
    expect(formatCitation(thesis, "full", "17")).toBe(
      "Rafael Ortiz, “Listening to Cities: Harbor Cases” (PhD diss., Lakeside University, 2024), 17, ProQuest (9876543).",
    );
    expect(formatCitation(thesis, "short", "18")).toBe("Ortiz, “Listening,” 18.");
    expect(formatCitation(thesis, "short")).toBe("Ortiz, “Listening.”");
    expect(formatCitation(thesis, "bibliography")).toBe(
      "Ortiz, Rafael. “Listening to Cities: Harbor Cases.” PhD diss., Lakeside University, 2024. ProQuest (9876543).",
    );
  });

  it("formats qualified signed online newspaper notes and bibliography", () => {
    expect(formatCitation(newspaper, "full")).toBe(
      "Maya Rao, “A New Ferry Line,” Harbor Daily, May 6, 2025, https://example.org/ferry-line.",
    );
    expect(formatCitation(newspaper, "short", "at 5")).toBe(
      "Rao, “Ferry Line,” at 5.",
    );
    expect(formatCitation(newspaper, "short")).toBe("Rao, “Ferry Line.”");
    expect(formatCitation(newspaper, "full", "page 21")).toBe(
      "Maya Rao, “A New Ferry Line,” Harbor Daily, May 6, 2025, page 21, https://example.org/ferry-line.",
    );
    expect(formatCitation(newspaper, "bibliography", "page 21")).toBe(
      "Rao, Maya. “A New Ferry Line.” Harbor Daily, May 6, 2025. https://example.org/ferry-line.",
    );
    expect(formatCitation(newspaper, "bibliography")).toBe(
      "Rao, Maya. “A New Ferry Line.” Harbor Daily, May 6, 2025. https://example.org/ferry-line.",
    );
    expect(citationParts(newspaper, "full")).toContainEqual({ text: "Harbor Daily", italic: true });
    expect(citationParts(newspaper, "bibliography")).toContainEqual({ text: "Harbor Daily", italic: true });
  });

  it("formats qualified broadcast interview notes and bibliography", () => {
    expect(formatCitation(interview, "full")).toBe(
      "Nora Bell, “Listening to the Harbor,” interview by Eli Park, Civic Hour, Public Radio, May 6, 2025, audio, 37:58, https://example.org/audio.",
    );
    expect(formatCitation(interview, "short", "at 4:12")).toBe("Bell, interview, at 4:12.");
    expect(formatCitation(interview, "full", "at 4:12")).toBe("[Manual note required: Listening to the Harbor]");
    expect(formatCitation({ ...interview, manualFull: "Reviewed interview note." }, "full", "at 4:12")).toBe("Reviewed interview note.");
    expect(formatCitation(interview, "bibliography")).toBe(
      "Bell, Nora. “Listening to the Harbor.” Interview by Eli Park. Civic Hour, Public Radio, May 6, 2025. Audio, 37:58. https://example.org/audio.",
    );
    expect(citationParts(interview, "full")).toContainEqual({ text: "Civic Hour", italic: true });
    expect(citationParts(interview, "bibliography")).toContainEqual({ text: "Civic Hour", italic: true });
  });

  it("formats a qualified online TED Talk and preserves a supplied event title and locator", () => {
    expect(formatCitation(talk, "full")).toBe(
      "Ilan Mercer, “Tidal Futures,” TED Talk, Boston, MA, April 2025, 9 min., 15 sec., https://example.org/talk.",
    );
    expect(formatCitation(talk, "short", "at 6:09–17")).toBe(
      "Mercer, “Tidal Futures,” at 6:09–17.",
    );
    expect(formatCitation(talk, "short")).toBe("Mercer, “Tidal Futures.”");
    expect(formatCitation(talk, "full", "at 6:09–17")).toBe("[Manual note required: Tidal Futures]");
    expect(formatCitation({ ...talk, manualFull: "Reviewed talk note." }, "full", "at 6:09–17")).toBe("Reviewed talk note.");
    expect(formatCitation(talk, "bibliography", "at 6:09–17")).toBe(
      "Mercer, Ilan. “Tidal Futures.” TED Talk, Boston, MA, April 2025. Video, 9 min., 15 sec. https://example.org/talk.",
    );
    expect(formatCitation(talk, "bibliography")).toBe(
      "Mercer, Ilan. “Tidal Futures.” TED Talk, Boston, MA, April 2025. Video, 9 min., 15 sec. https://example.org/talk.",
    );
    expect(formatCitation({ ...talk, event: "TEDx Boston" }, "full")).toContain(
      "TEDx Boston, Boston, MA, April 2025",
    );
  });

  it("keeps unqualified or unsupported source records on the manual-required path", () => {
    const unsupported = [
      { ...thesis, cslData: { ...thesis.cslData, genre: "Master's thesis" } },
      { ...thesis, cslData: { type: "thesis", genre: "PhD diss.", archive: "ProQuest" } },
      { ...newspaper, publishedDate: "2025-02-30" },
      { ...newspaper, creators: [] },
      { ...newspaper, url: undefined },
      { ...interview, cslData: { ...interview.cslData, dimensions: "37:99" } },
      { ...interview, url: "file:///recording.wav" },
      { ...interview, creators: [{ role: "author", given: "Nora", family: "Bell" }] },
      { ...talk, cslData: { ...talk.cslData, type: "motion_picture" } },
      { ...talk, cslData: { ...talk.cslData, "event-date": { "date-parts": [[2025, 13]] } } },
      { ...talk, cslData: { ...talk.cslData, medium: "film" } },
      { ...talk, cslData: { ...talk.cslData, "event-place": "" } },
      { ...talk, cslData: { ...talk.cslData, dimensions: "9 min., 99 sec." } },
      { ...talk, cslData: { ...talk.cslData, dimensions: "0 min., 15 sec." } },
      { ...talk, cslData: { ...talk.cslData, "event-date": { "date-parts": [[0, 4]] } } },
    ] as Source[];
    for (const source of unsupported) {
      for (const mode of ["full", "short", "bibliography"] as const)
        expect(formatCitation(source, mode)).toContain("[Manual ");
    }
  });
});
