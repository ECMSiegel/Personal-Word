import { it, expect } from "vitest";
import { newProject } from "../model";
import { documentBlocks } from "./document";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { createExportFixture } from "./export-fixtures";
import { projectMarkdown, projectPlainText } from "./textExport";
import {
  JPG_ID,
  PNG_ID,
  cell,
  image,
  imageAssets,
  note,
  para,
  table,
  text,
} from "./media-fixtures";
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
it("uses the shared Ibid. context for DOCX/PDF notes only after opt-in", () => {
  const p = fixture();
  p.entries[0].content.content![0] = {
    type: "paragraph",
    content: ["n", "n2", "n3"].map((id) => ({ type: "footnoteReference", attrs: { id } })),
  };
  p.research!.footnotes = ["8", "8", "9"].map((locator, i) => ({ id: ["n", "n2", "n3"][i], text: "", sourceId: "s", locator }));
  p.research!.autoShortNotes = true;
  expect(documentBlocks(p).notes.map((n) => n.text).join("|")).not.toContain("Ibid.");
  p.research!.citationPolicy = { scope: "manuscript", repeats: "ibid" };
  const notes = documentBlocks(p).notes;
  expect(notes.map((n) => n.text).slice(1)).toEqual(["Ibid.", "Ibid., 9."]);
  expect(notes[1].parts).toEqual([{ text: "Ibid.", italic: undefined }]);
});
it("restarts full DOCX/PDF citations per section only under section scope", () => {
  const p = fixture();
  p.research!.footnotes = [{ id: "n", text: "", sourceId: "s", locator: "4" }, { id: "n2", text: "", sourceId: "s", locator: "8" }];
  const second = { ...p.entries[0], id: "second", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "n2" } }] }] } };
  p.entries.push(second);
  p.order.push("second");
  p.research!.citationPolicy = { scope: "manuscript", repeats: "short" };
  expect(documentBlocks(p).notes[1].text).toBe("Smith, A Book, 8.");
  p.research!.citationPolicy = { scope: "section", repeats: "ibid" };
  const notes = documentBlocks(p).notes;
  expect(notes.map((n) => n.number)).toEqual([1, 2]);
  expect(notes[1].text).toBe("Jane Smith, A Book (Press, 2026), 8.");
  expect(notes[1].parts.some((part) => part.italic && part.text === "A Book")).toBe(true);
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

it("refuses a footnote too long for one legacy PDF page instead of truncating it, while DOCX still exports", async () => {
  const p = fixture();
  p.research!.footnotes = [
    { id: "long", text: "A very long note sentence. ".repeat(600) },
  ];
  p.entries[0].content = {
    type: "doc",
    content: [para(text("Body"), note("long"))],
  };
  await expect(exportPdf(p)).rejects.toThrow(
    "A footnote is too long to fit on one PDF page. Export DOCX for flowing footnotes.",
  );
  const docx = await exportDocx(p);
  expect(docx.size).toBeGreaterThan(1000);
}, 20_000);

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

// --- images and tables ---------------------------------------------------
function mediaProject() {
  const p = fixture();
  p.research!.footnotes = [
    { id: "a", text: "Note A." },
    { id: "b", text: "Note B." },
    { id: "c", text: "Note C." },
  ];
  p.entries[0].content = {
    type: "doc",
    content: [
      para(text("Body one"), note("a")),
      image(PNG_ID),
      table(
        [cell("tableHeader", para(text("Head 1"))), cell("tableHeader", para(text("Head 2")))],
        [
          cell("tableCell", para(text("Cell"), note("b")), para(text("Second paragraph"))),
          cell("tableCell", para(text("Other"), note("c"))),
        ],
      ),
      image(JPG_ID, { width: 40, height: 20 }),
      para(text("Tail"), note("a")),
    ],
  };
  return p;
}
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const baseline = {
  blocks: "302960c29afbcf6f0012fedc8f4309014ac8b5764d3162600d39cd86bcbfaae5",
  doc: "85eff7993ecaa2d8d7998c82033d09e6a1ef5c6cbdc8da510aae5d15ec4542f0",
  fn: "921aab319d0fa36419743516cc40e15304b1600f7f216158780d49c6057aeb9d",
  md: "699c47590e5c74b38d98c99367c9f5e06fc848ba351b23cc72a5373e5f78c03b",
  txt: "bf7ec93d321aba309346be3e75d3d7f0cc87e45a3481a35dfaf069ed1b0b2bd0",
};
it("keeps documents without images or tables byte-identical to the pre-image exporters", async () => {
  const p = createExportFixture();
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  expect(sha(JSON.stringify(documentBlocks(p)))).toBe(baseline.blocks);
  expect(sha(await zip.file("word/document.xml")!.async("string"))).toBe(baseline.doc);
  expect(sha(await zip.file("word/footnotes.xml")!.async("string"))).toBe(baseline.fn);
  expect(sha(projectMarkdown(p))).toBe(baseline.md);
  expect(sha(projectPlainText(p))).toBe(baseline.txt);
});
it("fits images to the text width keeping aspect ratio and numbers table notes in document order", () => {
  const d = documentBlocks(mediaProject(), imageAssets());
  const [, big, tbl, small] = d.blocks;
  expect(big.kind).toBe("image");
  // Letter, default margins: 2000x1000 px would be 1500x750 pt; it must shrink.
  expect(big.image!.width).toBeLessThanOrEqual(612 - d.settings.marginInches * 144 + 0.001);
  expect(big.image!.width / big.image!.height).toBeCloseTo(2, 5);
  expect(big.image!.mime).toBe("image/png");
  expect(big.image!.alt).toBe("A red pixel");
  expect(small.image).toMatchObject({ mime: "image/jpeg", width: 30, height: 15 });
  expect(tbl.table!.columns).toBe(2);
  expect(tbl.table!.rows[0].every((c) => c.header)).toBe(true);
  expect(tbl.table!.rows[1][0].blocks.map((b) => b.kind)).toEqual(["paragraph", "paragraph"]);
  expect(d.notes.map((n) => [n.number, n.text])).toEqual([
    [1, "Note A."],
    [2, "Note B."],
    [3, "Note C."],
  ]);
  expect(tbl.table!.rows[1][0].blocks[0].runs.at(-1)!.footnote).toBe(2);
});
it("refuses to export when an image's bytes are missing", async () => {
  const p = mediaProject();
  expect(() => documentBlocks(p)).toThrow("An image is missing");
  await expect(exportDocx(p)).rejects.toThrow("An image is missing");
  await expect(exportPdf(p)).rejects.toThrow("An image is missing");
}, 30_000);
it("writes real Word images, a header-repeating table, and footnotes inside cells", async () => {
  const zip = await JSZip.loadAsync(
    await (await exportDocx(mediaProject(), imageAssets())).arrayBuffer(),
  );
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml.match(/<w:drawing>/g)).toHaveLength(2);
  expect(xml).toContain("<w:tbl>");
  expect(xml).toContain("<w:tblHeader");
  expect(xml.match(/<w:footnoteReference /g)).toHaveLength(4);
  expect(xml).toContain('descr="A red pixel"');
  const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
  expect(media.some((n) => n.endsWith(".png"))).toBe(true);
  expect(media.some((n) => n.endsWith(".jpg") || n.endsWith(".jpeg"))).toBe(true);
  // The 2000x1000 px PNG is shrunk to the 6.5 in text width (624 px, ratio 2:1).
  expect(xml).toMatch(/<wp:extent cx="5943600" cy="2971800"/);
  const notesXml = await zip.file("word/footnotes.xml")!.async("string");
  expect(notesXml).toContain("Note B.");
});
it("draws PDF images and a table grid, paging between rows", async () => {
  const p = mediaProject();
  const bytes = await (await exportPdf(p, undefined, imageAssets())).arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const objects = pdf.context.enumerateIndirectObjects().map(([, o]) => o);
  const images = objects.filter(
    (o): o is PDFRawStream =>
      o instanceof PDFRawStream && o.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
  );
  expect(images).toHaveLength(2);
  const content = pdf
    .getPages()
    .map((page) => {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray ? contents.asArray().map((r) => pdf.context.lookup(r)) : [contents];
      return streams
        .map((st) => Buffer.from(decodePDFRawStream(st as PDFRawStream).decode()).toString("latin1"))
        .join("\n");
    })
    .join("\n");
  // 2 cells x 2 rows of table borders.
  expect(content.match(/^h\nS$/gm)).toHaveLength(4);
  expect(pdf.getPageCount()).toBe(1);
  // Many rows must flow onto more pages, never splitting a row.
  const many = mediaProject();
  many.entries[0].content = {
    type: "doc",
    content: [
      table(
        ...Array.from({ length: 60 }, (_, i) => [
          cell("tableCell", para(text(`Row ${i} left`))),
          cell("tableCell", para(text(`Row ${i} right`))),
        ]),
      ),
    ],
  };
  const paged = await PDFDocument.load(await (await exportPdf(many)).arrayBuffer());
  expect(paged.getPageCount()).toBeGreaterThan(1);
}, 30_000);
it("moves an image that does not fit the rest of the page onto a new page", async () => {
  const p = mediaProject();
  p.entries[0].content = {
    type: "doc",
    content: [para(text("Intro")), image(PNG_ID, { width: 600, height: 600 }), image(PNG_ID, { width: 600, height: 600 })],
  };
  const pdf = await PDFDocument.load(
    await (await exportPdf(p, undefined, imageAssets())).arrayBuffer(),
  );
  expect(pdf.getPageCount()).toBe(2);
}, 30_000);
it("throws instead of clipping a table row taller than a page", async () => {
  const p = mediaProject();
  const long = Array.from({ length: 400 }, (_, i) => para(text(`Line ${i}`)));
  p.entries[0].content = { type: "doc", content: [table([cell("tableCell", ...long)])] };
  await expect(exportPdf(p)).rejects.toThrow("taller than one PDF page");
  // DOCX can still flow it.
  await expect(exportDocx(p)).resolves.toBeInstanceOf(Blob);
}, 30_000);
