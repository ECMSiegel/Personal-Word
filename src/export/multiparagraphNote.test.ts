import { afterEach, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { PDFArray, PDFDocument, PDFPage, type PDFRawStream, type PDFRef } from "pdf-lib";
import { decodePDFRawStream } from "pdf-lib/cjs/core/index.js";
import { newProject } from "../model";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import { note, para, text } from "./media-fixtures";

// T043: footnotes whose text has blank-line paragraph breaks.
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const THREE =
  "First paragraph of the note.\n\nSecond paragraph, after a blank line.\n\nThird paragraph stays last.";

function project(notes: Record<string, { text: string; sourceId?: string; locator?: string }>) {
  const p = newProject("Multi-paragraph notes");
  p.research = {
    sources: [
      { id: "s", kind: "book", title: "A Book", authors: ["Jane Smith"], publisher: "Press", year: "2026" },
    ],
    notes: [],
    footnotes: Object.entries(notes).map(([id, n]) => ({ id, ...n })),
  };
  p.entries[0].content = {
    type: "doc",
    content: [para(text("Body text"), ...Object.keys(notes).map(note))],
  };
  return p;
}

async function noteXml(p: ReturnType<typeof project>) {
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  return zip.file("word/footnotes.xml")!.async("string");
}
// The user-defined footnote element for number n (separator footnotes have negative-ish ids 0/1).
const footnoteBody = (xml: string, id: number) =>
  xml.match(new RegExp(`<w:footnote w:id="${id}">([\\s\\S]*?)</w:footnote>`))![1];
const paragraphs = (xml: string) => xml.match(/<w:p>[\s\S]*?<\/w:p>|<w:p [\s\S]*?<\/w:p>/g) ?? [];

// Records what exportPdf draws so the test can read the text back in order.
const drawn: { text: string; x: number; y: number; size: number }[] = [];
const realDrawText = PDFPage.prototype.drawText;
function spyDrawText() {
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, t, o) {
    drawn.push({ text: t, x: o!.x!, y: o!.y!, size: o!.size! });
    return realDrawText.call(this, t, o);
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  drawn.length = 0;
});
// Footnote-area text (size 10) regrouped into drawn lines: one entry per distinct baseline.
const noteDraws = () => {
  const lines: { text: string; x: number; y: number }[] = [];
  for (const d of drawn.filter((d) => d.size === 10 && d.text !== "1")) {
    const line = lines.find((l) => l.y === d.y);
    if (line) line.text += d.text;
    else lines.push({ text: d.text, x: d.x, y: d.y });
  }
  return lines;
};

it("DOCX writes one w:p per note paragraph, with the reference mark in the first only", async () => {
  const xml = footnoteBody(await noteXml(project({ n: { text: THREE } })), 1);
  const ps = paragraphs(xml);
  expect(ps).toHaveLength(3);
  expect(ps[0]).toContain("<w:footnoteRef/>");
  expect(ps[1]).not.toContain("footnoteRef");
  expect(ps[2]).not.toContain("footnoteRef");
  expect(ps[0]).toContain("First paragraph of the note.");
  expect(ps[1]).toContain("Second paragraph, after a blank line.");
  expect(ps[2]).toContain("Third paragraph stays last.");
  expect(xml).not.toMatch(/<w:t[^>]*>[^<]*[\r\n]/);
});

it("DOCX keeps a citation after a multi-paragraph note text in the last paragraph, italics intact", async () => {
  const xml = footnoteBody(
    await noteXml(project({ n: { text: "One.\n\nTwo.", sourceId: "s", locator: "4" } })),
    1,
  );
  const ps = paragraphs(xml);
  expect(ps).toHaveLength(2);
  expect(ps[0]).toContain("One.");
  expect(ps[1]).toContain("Two.");
  expect(ps[1]).toContain("A Book");
  expect(ps[1]).toContain("<w:i/>");
});

it("a note with only single newlines is one paragraph in DOCX and PDF, joined by spaces", async () => {
  const p = project({ n: { text: "Line one\nline two\r\nline three" } });
  const ps = paragraphs(footnoteBody(await noteXml(p), 1));
  expect(ps).toHaveLength(1);
  expect(ps[0]).toContain("Line one line two line three");
  spyDrawText();
  await exportPdf(p);
  const lines = noteDraws();
  expect(lines.map((d) => d.text)).toEqual(["1. Line one line two line three"]);
});

it("PDF exports a three-paragraph note without the shaping refusal, in order, one block each", async () => {
  spyDrawText();
  const blob = await exportPdf(project({ n: { text: THREE } }));
  expect((await PDFDocument.load(await blob.arrayBuffer())).getPageCount()).toBe(1);
  const lines = noteDraws();
  // Each paragraph is its own line, top to bottom; no newline is ever drawn.
  expect(lines.map((d) => d.text)).toEqual([
    "1. First paragraph of the note.",
    "Second paragraph, after a blank line.",
    "Third paragraph stays last.",
  ]);
  expect(lines[0].y).toBeGreaterThan(lines[1].y);
  expect(lines[1].y).toBeGreaterThan(lines[2].y);
  // Continuation paragraphs are indented 12pt past the first line's left edge.
  expect(lines[1].x - lines[0].x).toBe(12);
  expect(lines[2].x).toBe(lines[1].x);
  expect(drawn.some((d) => /[\r\n]/.test(d.text))).toBe(false);
});

it("PDF keeps the multi-paragraph note on the page it is cited on and counts its height", async () => {
  const p = project({ n: { text: THREE } });
  const withNote = await PDFDocument.load(await (await exportPdf(p)).arrayBuffer());
  expect(withNote.getPageCount()).toBe(1);
  spyDrawText();
  await exportPdf(p);
  const body = drawn.find((d) => d.text === "Body");
  const bottom = Math.min(...noteDraws().map((d) => d.y));
  expect(body).toBeDefined();
  expect(bottom).toBeGreaterThanOrEqual(72 - 1); // never below the bottom margin
});

it("PDF still refuses unsupported scripts and overlong notes, with the same messages", async () => {
  await expect(
    exportPdf(project({ n: { text: "Latin.\n\nالعربية" } })),
  ).rejects.toThrow("needs script shaping");
  await expect(
    exportPdf(project({ n: { text: ("A very long note sentence. ".repeat(300) + "\n\n").repeat(3) } })),
  ).rejects.toThrow(
    "A footnote is too long to fit on one PDF page. Export DOCX for flowing footnotes.",
  );
}, 20_000);

// Unchanged-output guard for notes WITHOUT newlines. The constants below were produced by
// running this exact fixture through the PRE-FIX pdf.ts / docx.ts (copies in
// node_modules/.cache/personal-word-beta/team-t043/prefix/) and hashing the results:
// DOCX word/footnotes.xml and word/document.xml, and the decoded PDF page content streams.
const unchangedProject = () => {
  const p = project({
    a: { text: "A short note." },
    b: { text: "", sourceId: "s", locator: "12" },
    c: { text: "A wrapped note. ".repeat(40), sourceId: "s", locator: "3" },
  });
  // T054: Word and PDF now print the project and section titles. The pre-fix hashes below were
  // taken before that, so this fixture carries no titles and still isolates the note output.
  p.title = "";
  p.entries[0].title = "";
  return p;
};
const UNCHANGED = {
  docxFootnotes: "9ceb1cc2cccb1ad5dd7b810651d7b7338b853e2b7e67a97590c272929f30cc20",
  docxDocument: "3de52ed1ab8ee286534e02a167b53e08c285bb6c82e16069ba285e4156eb4511",
  pdfPages: 2,
  pdfContent: "5d831a1bc5942d4ddce9937c20fa44afeb909528d21c56a6ec7f7b4471984c8c",
};
it("leaves DOCX and PDF output for notes without newlines identical to the pre-fix exporters", async () => {
  const p = unchangedProject();
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const got = {
    docxFootnotes: sha(await zip.file("word/footnotes.xml")!.async("string")),
    docxDocument: sha(await zip.file("word/document.xml")!.async("string")),
  };
  const pdf = await PDFDocument.load(await (await exportPdf(p)).arrayBuffer());
  const streams = pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs.map((r) =>
      new TextDecoder("latin1").decode(
        decodePDFRawStream(pdf.context.lookup(r as PDFRef) as PDFRawStream).decode(),
      ),
    );
  });
  // pdf-lib names font resources with a random suffix; strip it before hashing.
  const content = sha(streams.join("\n").replace(/\/([A-Za-z]+)-[0-9]+ /g, "/$1 "));
  expect({ ...got, pdfPages: pdf.getPageCount(), pdfContent: content }).toEqual(UNCHANGED);
}, 20_000);
