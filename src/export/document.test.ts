import { it, expect } from "vitest";
import { newProject } from "../model";
import { documentBlocks } from "./document";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  decodePDFRawStream,
  PDFRawStream,
} from "pdf-lib/cjs/core/index.js";
function fixture() {
  const project = newProject("Export fixture");
  project.research = {
    sources: [
      {
        id: "s",
        kind: "book",
        title: "A Book",
        authors: ["Jane Smith"],
        publisher: "Press",
        year: "2026",
      },
      { id: "unused", kind: "book", title: "Unused", authors: [] },
    ],
    notes: [],
    footnotes: [
      { id: "n", text: "A supporting note.", sourceId: "s", locator: "4" },
    ],
  };
  project.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Writing with a note." },
          { type: "footnoteReference", attrs: { id: "n" } },
        ],
      },
      { type: "pageBreak" },
      {
        type: "paragraph",
        content: [{ type: "text", text: "A second page." }],
      },
    ],
  };
  return project;
}
it("numbers references by encounter and includes only cited sources", () => {
  const d = documentBlocks(fixture());
  expect(d.notes[0].number).toBe(1);
  expect(d.notes[0].text).toContain("Jane Smith");
  expect(d.blocks[1].kind).toBe("pageBreak");
  expect(d.bibliography.map((x) => x.id)).toEqual(["s"]);
});
it("uses automatic short notes in export notes", () => {
  const p = fixture();
  p.research!.autoShortNotes = true;
  p.research!.sources[0].title = "Lamps and Ledgers: Keeping the Coastal Lights";
  p.research!.sources[0].authors = ["Marguerite Halloway"];
  p.entries[0].content.content![0] = {
    type: "paragraph",
    content: [
      { type: "footnoteReference", attrs: { id: "n" } },
      { type: "footnoteReference", attrs: { id: "n2" } },
    ],
  };
  p.research!.footnotes.push({ id: "n2", text: "", sourceId: "s", locator: "8" });
  const notes = documentBlocks(p).notes;
  expect(notes[1].text).toMatch(/^Halloway, Lamps and Ledgers/);
  expect(notes[1].text).not.toContain("Press, 2026");
});
it("refuses dangling footnote references", () => {
  const p = fixture();
  p.research!.footnotes = [];
  expect(() => documentBlocks(p)).toThrow("matching note");
});
it("retains strike and nested list semantics in the shared document", () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "outer", marks: [{ type: "strike" }] },
                ],
              },
              {
                type: "orderedList",
                attrs: { start: 4 },
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "inner" }],
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
  const blocks = documentBlocks(p).blocks;
  expect(
    blocks.map((b) => ({
      kind: b.list?.kind,
      level: b.list?.level,
      number: b.list?.number,
    })),
  ).toEqual([
    { kind: "bullet", level: 0, number: undefined },
    { kind: "ordered", level: 1, number: 4 },
  ]);
  expect(blocks[0].runs[0].strike).toBe(true);
});
it("creates an actual DOCX ZIP with native footnotes", async () => {
  const blob = await exportDocx(fixture());
  expect(blob.type).toContain("wordprocessingml");
  expect(
    Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 2)),
  ).toEqual([80, 75]);
});
it("creates PDF pages with explicit page breaks and bibliography", async () => {
  const blob = await exportPdf(fixture());
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  expect(pdf.getPageCount()).toBe(3);
});

it("embeds bundled fonts for Latin extended, Greek, and Cyrillic PDF text", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Café — Ελληνικά — Кириллица" }],
      },
    ],
  };
  const bytes = new Uint8Array(await (await exportPdf(p)).arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
});

it("embeds PDF-compatible font programs for multilingual text", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Café — Ελληνικά — Кириллица" }],
      },
    ],
  };
  const pdf = await PDFDocument.load(
    await (await exportPdf(p)).arrayBuffer(),
  );
  const fontPrograms = pdf.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .map((stream) => decodePDFRawStream(stream).decode().slice(0, 4))
    .map((program) => String.fromCharCode(...program))
    .filter((signature) =>
      ["wOF2", "wOFF", "OTTO", "true", "\u0000\u0001\u0000\u0000"].includes(
        signature,
      ),
    );
  expect(fontPrograms.length).toBeGreaterThanOrEqual(3);
  expect(
    fontPrograms.every((signature) =>
      ["\u0000\u0001\u0000\u0000", "OTTO", "true"].includes(signature),
    ),
  ).toBe(true);
}, 20_000);

it("rejects scripts that need shaping instead of exporting corrupted PDF text", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "العربية" }] },
    ],
  };
  await expect(exportPdf(p)).rejects.toThrow("needs script shaping");
});

it("writes footnotes, strike, nested numbering, and hard breaks as native DOCX XML", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "struck", marks: [{ type: "strike" }] },
                  { type: "hardBreak" },
                  { type: "text", text: "after break" },
                  { type: "footnoteReference", attrs: { id: "n" } },
                ],
              },
              {
                type: "orderedList",
                attrs: { start: 4 },
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "nested" }],
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
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const main = await zip.file("word/document.xml")!.async("string");
  const notes = await zip.file("word/footnotes.xml")!.async("string");
  const numbering = await zip.file("word/numbering.xml")!.async("string");
  expect(main).toContain("<w:strike");
  expect(main).toContain("<w:br");
  expect(main).toContain("<w:footnoteReference");
  expect(main.match(/<w:numPr>/g)?.length).toBe(2);
  expect(notes).toContain("A supporting note.");
  expect(numbering).toContain('<w:start w:val="4"/>');
});

it("preserves ordered-list restart values in DOCX numbering", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "orderedList",
        attrs: { start: 7 },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "seventh" }],
              },
            ],
          },
        ],
      },
    ],
  };
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const numbering = await zip.file("word/numbering.xml")!.async("string");
  expect(numbering).toContain('<w:start w:val="7"/>');
});

it("keeps every item of one ordered list in a single DOCX numbering instance", async () => {
  const p = fixture();
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "orderedList",
        attrs: { start: 7 },
        content: ["seventh", "eighth", "ninth"].map((text) => ({
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text }] },
          ],
        })),
      },
    ],
  };
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const main = await zip.file("word/document.xml")!.async("string");
  const numbering = await zip.file("word/numbering.xml")!.async("string");
  // One shared instance is what makes Word continue 7, 8, 9 instead of
  // restarting the same start value on every paragraph.
  const numIds = [...main.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map(
    (match) => match[1],
  );
  expect(numIds).toHaveLength(3);
  expect(new Set(numIds).size).toBe(1);
  expect(numbering.match(/<w:start w:val="7"\/>/g)?.length).toBe(1);
});

it("exports only http, https, and mailto links as DOCX hyperlinks", async () => {
  const p = fixture();
  const linked = (text: string, href: string) => ({
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href } }],
  });
  p.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          linked("web ", "https://example.com/a"),
          linked("mail ", "mailto:writer@example.com"),
          linked("script ", "javascript:alert(1)"),
          linked("local", "file:///etc/passwd"),
        ],
      },
    ],
  };
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
  const main = await zip.file("word/document.xml")!.async("string");
  expect(rels).toContain('Target="https://example.com/a"');
  expect(rels).toContain('Target="mailto:writer@example.com"');
  expect(rels).not.toContain("javascript:");
  expect(rels).not.toContain("file:");
  // Unsafe links keep their words as plain text.
  expect(main).toContain("script ");
  expect(main).toContain("local");
});
