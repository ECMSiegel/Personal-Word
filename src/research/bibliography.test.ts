import { describe, expect, it } from "vitest";
import { newProject } from "../model";
import {
  bibliographyItems,
  citedSourceOrder,
  SOURCE_KIND_HEADINGS,
} from "./bibliography";
import { bibliography } from "./citations";
import { documentBlocks, type ExportProject } from "../export/document";
import { projectMarkdown, projectPlainText } from "../export/textExport";
import type { Source } from "./types";

function createBibliographyFixture(): ExportProject {
  const project = newProject("Bibliography Fixture");

  // Two sections
  const first = project.entries[0];
  first.title = "Section One";
  first.content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "First paragraph with a footnote citing Beta." },
          { type: "footnoteReference", attrs: { id: "fn-beta" } },
        ],
      },
    ],
  };

  const second = {
    ...project.entries[0],
    id: "section-2",
    title: "Section Two",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second section paragraph citing Alpha." },
            { type: "footnoteReference", attrs: { id: "fn-alpha" } },
          ],
        },
      ],
    },
  };
  project.entries.push(second);
  project.order.push(second.id);

  // Five sources across three kinds: book, journal, website
  const sources: Source[] = [
    {
      id: "source-alpha",
      kind: "book",
      title: "Book Alpha",
      authors: ["Alpha, Alice"],
      publisher: "Academic Press",
      year: "2020",
    },
    {
      id: "source-beta",
      kind: "journal",
      title: "Journal Beta",
      container: "Journal of Testing",
      authors: ["Beta, Bob"],
      year: "2021",
    },
    {
      id: "source-gamma",
      kind: "website",
      title: "Website Gamma",
      authors: ["Gamma, Grace"],
      url: "https://gamma.org",
      year: "2022",
    },
    {
      id: "source-delta",
      kind: "book",
      title: "Book Delta",
      authors: ["Delta, David"],
      publisher: "Delta Press",
      year: "2023",
    },
    {
      id: "source-epsilon",
      kind: "journal",
      title: "Journal Epsilon",
      container: "Journal of Code",
      authors: ["Epsilon, Edward"],
      year: "2024",
    },
  ];

  project.research = {
    sources,
    notes: [],
    footnotes: [
      { id: "fn-beta", text: "Note citing Beta.", sourceId: "source-beta" },
      { id: "fn-alpha", text: "Note citing Alpha.", sourceId: "source-alpha" },
    ],
  };

  return project;
}

describe("bibliographyItems and export bibliography", () => {
  it("citedSourceOrder follows first markers in section order", () => {
    const project = createBibliographyFixture();
    // In section-1, fn-beta appears first. In section-2, fn-alpha appears.
    expect(citedSourceOrder(project)).toEqual(["source-beta", "source-alpha"]);
  });

  it("author order equals old bibliography() output for the cited set", () => {
    const project = createBibliographyFixture();
    const citedItems = bibliographyItems(project, {
      bibliographyOrder: "author",
      bibliographyScope: "cited",
    });

    // Alphabetical author: Alpha before Beta
    expect(citedItems.map((x) => x.id)).toEqual(["source-alpha", "source-beta"]);

    // Regression check: identical text list to legacy bibliography() on the cited sources
    const legacy = bibliography({
      ...project.research!,
      sources: project.research!.sources.filter((s) =>
        ["source-alpha", "source-beta"].includes(s.id),
      ),
    });
    expect(citedItems.map((x) => x.text)).toEqual(legacy.map((x) => x.text));
  });

  it("cited order follows first markers", () => {
    const project = createBibliographyFixture();
    const items = bibliographyItems(project, {
      bibliographyOrder: "cited",
      bibliographyScope: "cited",
    });
    // Cited order: Beta (cited in section 1), then Alpha (cited in section 2)
    expect(items.map((x) => x.id)).toEqual(["source-beta", "source-alpha"]);
  });

  it("type order yields headings in sourceKinds order with author order inside", () => {
    const project = createBibliographyFixture();
    const items = bibliographyItems(project, {
      bibliographyOrder: "type",
      bibliographyScope: "cited",
    });

    // Cited sources: Alpha (book), Beta (journal).
    // sourceKinds order: book before journal.
    expect(items.map((x) => x.id)).toEqual([
      "heading:book",
      "source-alpha",
      "heading:journal",
      "source-beta",
    ]);

    expect(items[0]).toMatchObject({
      id: "heading:book",
      text: SOURCE_KIND_HEADINGS.book,
      heading: true,
    });
    expect(items[2]).toMatchObject({
      id: "heading:journal",
      text: SOURCE_KIND_HEADINGS.journal,
      heading: true,
    });
  });

  it("scope all adds uncited sources per the rule", () => {
    const project = createBibliographyFixture();

    // 1. author order + scope all: all 5 sources sorted by author
    const authorAll = bibliographyItems(project, {
      bibliographyOrder: "author",
      bibliographyScope: "all",
    });
    expect(authorAll.map((x) => x.id)).toEqual([
      "source-alpha",
      "source-beta",
      "source-delta",
      "source-epsilon",
      "source-gamma",
    ]);

    // 2. cited order + scope all: cited first (Beta, Alpha), then uncited in author order (Delta, Epsilon, Gamma)
    const citedAll = bibliographyItems(project, {
      bibliographyOrder: "cited",
      bibliographyScope: "all",
    });
    expect(citedAll.map((x) => x.id)).toEqual([
      "source-beta",
      "source-alpha",
      "source-delta",
      "source-epsilon",
      "source-gamma",
    ]);

    // 3. type order + scope all: books (Alpha, Delta), journals (Beta, Epsilon), websites (Gamma)
    const typeAll = bibliographyItems(project, {
      bibliographyOrder: "type",
      bibliographyScope: "all",
    });
    expect(typeAll.map((x) => x.id)).toEqual([
      "heading:book",
      "source-alpha",
      "source-delta",
      "heading:journal",
      "source-beta",
      "source-epsilon",
      "heading:website",
      "source-gamma",
    ]);
  });

  it("absent settings equal author order and cited scope", () => {
    const project = createBibliographyFixture();
    const defaultItems = bibliographyItems(project);
    const explicitItems = bibliographyItems(project, {
      bibliographyOrder: "author",
      bibliographyScope: "cited",
    });
    expect(defaultItems).toEqual(explicitItems);
  });

  it("Markdown and plain text exports contain heading and entry lines in exactly bibliographyItems order for all three orders and both scopes", () => {
    const orders: ("author" | "cited" | "type")[] = ["author", "cited", "type"];
    const scopes: ("cited" | "all")[] = ["cited", "all"];

    for (const order of orders) for (const scope of scopes) {
      const project = createBibliographyFixture();
      project.documentSettings = {
        font: "serif",
        fontSize: 12,
        lineSpacing: 2,
        marginInches: 1,
        firstLineIndent: true,
        bibliography: true,
        pageNumbers: true,
        bibliographyOrder: order,
        bibliographyScope: scope,
      };

      const expected = bibliographyItems(project, project.documentSettings);

      // Markdown export
      const md = projectMarkdown(project);
      expect(md).toContain("## Bibliography");
      let lastMdIndex = md.indexOf("## Bibliography");
      for (const item of expected) {
        const needle = item.heading ? `### ${item.text}` : `- ${item.text}`;
        const idx = md.indexOf(needle);
        expect(idx, `Missing ${needle} in Markdown for ${order}/${scope}`).toBeGreaterThan(lastMdIndex);
        lastMdIndex = idx;
      }

      // Plain text export (sections joined with \n\n, so header and underline are separated)
      const txt = projectPlainText(project);
      expect(txt).toContain("Bibliography");
      let lastTxtIndex = txt.indexOf("Bibliography");
      for (const item of expected) {
        const needle = item.text;
        const idx = txt.indexOf(needle, lastTxtIndex);
        expect(idx, `Missing ${needle} in Plain text for ${order}/${scope}`).toBeGreaterThan(lastTxtIndex);
        lastTxtIndex = idx;
      }

      // documentBlocks().bibliography equals bibliographyItems
      const d = documentBlocks(project);
      expect(d.bibliography).toEqual(expected);
    }
  });
});
