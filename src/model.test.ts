import { expect, it } from "vitest";
import { textOf, words, newProject, validateProject, isValidGoalDeadline } from "./model";
it("preserves paragraph boundaries in quoted and list fragment exports", () => {
  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  expect(
    textOf({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [paragraph("First"), paragraph("Second")],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [paragraph("Third"), paragraph("Fourth")],
            },
          ],
        },
      ],
    }),
  ).toBe("First\nSecond\nThird\nFourth");
});
it("rejects unsupported imported editor content before it can be opened", () => {
  const p = newProject("Import");
  p.entries[0].content = { type: "doc", content: [{ type: "unknown" }] };
  expect(() => validateProject(p)).toThrow();
});
it("starts new projects with automatic short notes enabled", () => {
  expect(newProject("x").research?.autoShortNotes).toBe(true);
});
it("rejects invalid footnote forms", () => {
  const p = newProject("x");
  p.research!.footnotes.push({ id: "n", text: "", form: "sometimes" as "full" });
  expect(() => validateProject(p)).toThrow("Invalid footnote form");
});
it.each([
  ["shortTitle", 42],
  ["cslId", 42],
])("rejects a non-string source %s", (field, value) => {
  const p = newProject("x");
  p.research!.sources.push({ id: "s", kind: "book", title: "T", authors: [] });
  (p.research!.sources[0] as Record<string, unknown>)[field] = value;
  expect(() => validateProject(p)).toThrow("Invalid research source.");
});
it("accepts a source with a valid PDF reference", () => {
  const p = newProject("x");
  p.research!.sources.push({
    id: "s", kind: "book", title: "T", authors: [],
    pdf: { assetId: "a".repeat(64), name: "t.pdf", byteLength: 10 },
  });
  expect(() => validateProject(p)).not.toThrow();
});
it.each([
  ["a string", "x.pdf"],
  ["an array", []],
  ["a short asset id", { assetId: "abc", name: "t.pdf", byteLength: 10 }],
  ["an uppercase asset id", { assetId: "A".repeat(64), name: "t.pdf", byteLength: 10 }],
  ["a numeric name", { assetId: "a".repeat(64), name: 5, byteLength: 10 }],
  ["a zero length", { assetId: "a".repeat(64), name: "t.pdf", byteLength: 0 }],
  ["a fractional length", { assetId: "a".repeat(64), name: "t.pdf", byteLength: 1.5 }],
])("rejects a source PDF that is %s", (_label, pdf) => {
  const p = newProject("x");
  p.research!.sources.push({ id: "s", kind: "book", title: "T", authors: [] });
  (p.research!.sources[0] as Record<string, unknown>).pdf = pdf;
  expect(() => validateProject(p)).toThrow("Invalid research source.");
});
it("rejects a non-boolean automatic short note preference", () => {
  const p = newProject("x");
  (p.research as { autoShortNotes?: unknown }).autoShortNotes = "yes";
  expect(() => validateProject(p)).toThrow("Invalid research data.");
});
it.each([
  [null], [[]], ["ibid"], [{ scope: "chapter", repeats: "short" }], [{ scope: "section", repeats: "op. cit." }],
  [{ scope: "section" }], [{ repeats: "ibid" }],
])("rejects an invalid citation policy %j", (citationPolicy) => {
  const p = newProject("x");
  (p.research as { citationPolicy?: unknown }).citationPolicy = citationPolicy;
  expect(() => validateProject(p)).toThrow("Invalid research data.");
});
it("accepts a valid citation policy, keeps extra fields, and allows none", () => {
  const p = newProject("x");
  expect(p.research?.citationPolicy).toBeUndefined();
  expect(() => validateProject(p)).not.toThrow();
  (p.research as { citationPolicy?: unknown }).citationPolicy = { scope: "section", repeats: "ibid", later: 1 };
  expect(() => validateProject(p)).not.toThrow();
});
it.each([
  null, [], "goal", { totalWords: 0 }, { dailyWords: -1 },
  { totalWords: 2.5 }, { dailyWords: "10" },
  { deadline: "tomorrow" }, { deadline: "2026-02-30" },
  { deadline: "2026-02-29" }, { deadline: "10000-01-01" },
])("rejects invalid writing goals: %j", (goals) => {
  expect(() => validateProject({ ...newProject("Goals"), goals })).toThrow("Invalid writing goals");
});
it("accepts additive writing goals and cleared goals", () => {
  expect(() => validateProject({ ...newProject("Goals"), goals: { totalWords: 1000, dailyWords: 50, deadline: "2026-10-31" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: { deadline: "2024-02-29" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: { deadline: "0000-01-01" } })).not.toThrow();
  expect(() => validateProject({ ...newProject("Goals"), goals: {} })).not.toThrow();
});

it.each([
  ["2026-02-28", true],
  ["2024-02-29", true],
  ["2026-02-29", false],
  ["2026-02-30", false],
  ["10000-01-01", false],
  ["0000-01-01", true],
])("validates goal deadline %s as %s", (date, valid) => {
  expect(isValidGoalDeadline(date)).toBe(valid);
});

it("accepts additive structured source data and retains raw prototype-named CSL fields", () => {
  const p = newProject("Sources");
  p.research!.sources.push({ id: "s", kind: "chapter", title: "T", authors: ["Organization"], creators: [{ role: "author", literal: "Organization" }], cslData: JSON.parse('{"__proto__":{"kept":true},"constructor":"raw"}'), edition: "2" });
  expect(() => validateProject(p)).not.toThrow();
  const restored = JSON.parse(JSON.stringify(p));
  validateProject(restored);
  expect(Object.hasOwn(restored.research!.sources[0].cslData!, "__proto__")).toBe(true);
  expect(({} as { kept?: boolean }).kept).toBeUndefined();
});
it.each([ { creators: "bad" }, { creators: [{ role: 7 }] }, { creators: [{ role: "author", literal: 7 }] }, { cslData: [] }, { manualFull: 7 }, { edition: 7 } ])("rejects malformed additive source data %j", (fields) => {
  const p = newProject("Sources");
  p.research!.sources.push({ id: "s", kind: "book", title: "T", authors: [], ...fields } as never);
  expect(() => validateProject(p)).toThrow("Invalid research source.");
});

const validAssetId = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

it("extracts image alt text as its own block in textOf and includes it in word count", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Before image" }] },
      { type: "image", attrs: { assetId: validAssetId, alt: "A scenic mountain landscape" } },
      { type: "paragraph", content: [{ type: "text", text: "After image" }] },
    ],
  };
  expect(textOf(doc)).toBe("Before image\nA scenic mountain landscape\nAfter image");
  expect(words(textOf(doc))).toBe(8);
});

it("extracts empty string for image with no alt text and adds no phantom words", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "First" }] },
      { type: "image", attrs: { assetId: validAssetId } },
      { type: "paragraph", content: [{ type: "text", text: "Second" }] },
    ],
  };
  expect(textOf(doc)).toBe("First\n\nSecond");
  expect(words(textOf(doc))).toBe(2);
});

it("separates table cells with whitespace and table rows with newlines in textOf", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Col A" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Col B" }] }] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Val 1" }] }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Val 2" }] }] },
            ],
          },
        ],
      },
    ],
  };
  expect(textOf(doc)).toBe("Col A Col B\nVal 1 Val 2");
  expect(words(textOf(doc))).toBe(8);
});

it("handles empty table cells without corrupting word count", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Alpha" }] }] },
              { type: "tableCell", content: [{ type: "paragraph" }] },
              { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Beta" }] }] },
            ],
          },
        ],
      },
    ],
  };
  expect(textOf(doc)).toBe("Alpha  Beta");
  expect(words(textOf(doc))).toBe(2);
});

it("validates project containing valid image and table nodes", () => {
  const p = newProject("Valid Media");
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { assetId: validAssetId, alt: "Alt text", width: 400, height: 300, title: null },
      },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Cell text" }] }],
              },
            ],
          },
        ],
      },
    ],
  };
  p.entries[0].text = textOf(p.entries[0].content);
  expect(() => validateProject(p)).not.toThrow();
  const quotedTable = p.entries[0].content.content![1];
  p.entries[0].content = {
    type: "doc",
    content: [{ type: "blockquote", content: [quotedTable] }],
  };
  p.entries[0].text = textOf(p.entries[0].content);
  expect(() => validateProject(p)).not.toThrow();
});

it("rejects nested tables inside a table cell", () => {
  const p = newProject("Nested Table");
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [
                  {
                    type: "table",
                    content: [
                      {
                        type: "tableRow",
                        content: [
                          {
                            type: "tableCell",
                            attrs: { colspan: 1, rowspan: 1 },
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Deep" }] }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  p.entries[0].text = textOf(p.entries[0].content);
  expect(() => validateProject(p)).toThrow(RangeError);
});

it.each([
  ["empty string", ""],
  ["short hex", "0123456789abcdef"],
  ["63 chars", "a".repeat(63)],
  ["65 chars", "a".repeat(65)],
  ["uppercase hex", "A".repeat(64)],
  ["non-hex chars", "g".repeat(64)],
  ["undefined", undefined],
  ["number", 12345],
  ["null", null],
])("rejects image with invalid assetId (%s)", (_desc, badId) => {
  const p = newProject("Bad Asset");
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { assetId: badId as unknown as string, alt: "Bad" },
      },
    ],
  };
  p.entries[0].text = textOf(p.entries[0].content);
  expect(() => validateProject(p)).toThrow(RangeError);
});

it("keeps sidebarHidden through a structuredClone and JSON round trip", () => {
  const project = {
    ...newProject("Sidebar switches"),
    sidebarHidden: ["comments", "history"],
  };
  const round = JSON.parse(JSON.stringify(structuredClone(project)));
  expect(round.sidebarHidden).toEqual(["comments", "history"]);
  expect(() => validateProject(round)).not.toThrow();
});
