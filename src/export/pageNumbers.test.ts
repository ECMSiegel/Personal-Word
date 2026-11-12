import { it, expect } from "vitest";
import JSZip from "jszip";
import { PDFArray, PDFDocument } from "pdf-lib";
import { decodePDFRawStream, PDFRawStream } from "pdf-lib/cjs/core/index.js";
import { newProject, validateProject } from "../model";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import { projectMarkdown, projectPlainText } from "./textExport";
import type { PageNumberPosition } from "../research/types";
import { defaultDocumentSettings } from "../research/types";

function project(position?: PageNumberPosition, template?: string) {
  const p = newProject("Numbers");
  if (template) p.templateId = template;
  p.entries[0].content = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "First page." }] },
      { type: "pageBreak" },
      { type: "paragraph", content: [{ type: "text", text: "Second page." }] },
    ],
  };
  p.documentSettings = {
    ...defaultDocumentSettings,
    ...(position ? { pageNumberPosition: position } : {}),
  };
  return p;
}

async function docxParts(p: ReturnType<typeof project>) {
  const zip = await JSZip.loadAsync(await (await exportDocx(p)).arrayBuffer());
  const names = Object.keys(zip.files);
  const read = async (re: RegExp) =>
    Promise.all(
      names.filter((n) => re.test(n)).map((n) => zip.file(n)!.async("text")),
    );
  return {
    headers: await read(/^word\/header\d*\.xml$/),
    footers: await read(/^word\/footer\d*\.xml$/),
    document: await zip.file("word/document.xml")!.async("text"),
  };
}

// Pull the "1 0 0 1 x y Tm" matrix of the last small (size 10) text draw on a page.
async function pdfNumberDraw(p: ReturnType<typeof project>, pageIndex: number) {
  const pdf = await PDFDocument.load(await (await exportPdf(p)).arrayBuffer());
  const page = pdf.getPage(pageIndex);
  const contents = page.node.Contents();
  const streams = (
    contents instanceof PDFArray
      ? contents.asArray().map((r) => pdf.context.lookup(r))
      : [contents]
  ) as PDFRawStream[];
  const text = streams
    .map((st) => new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()))
    .join("\n");
  const draws = [...text.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]) }),
  );
  return { draws, width: page.getWidth(), height: page.getHeight(), text };
}

it("top-center: PDF number sits in the top margin, centred", async () => {
  const { draws, width, height } = await pdfNumberDraw(
    project("top-center"),
    0,
  );
  const last = draws[draws.length - 1];
  expect(last.y).toBeGreaterThan(height - 72); // inside the 1 inch top margin
  expect(Math.abs(last.x - width / 2)).toBeLessThan(10); // centred (digit ~5pt wide)
});

it("absent position draws exactly as bottom-right (old projects unchanged)", async () => {
  const a = await pdfNumberDraw(project(), 0);
  const b = await pdfNumberDraw(project("bottom-right"), 0);
  expect(a.text).toBe(b.text);
  const last = a.draws[a.draws.length - 1];
  expect(last.y).toBe(36);
  expect(last.x).toBe(a.width - 72 - 10);
});

it("corner positions place the PDF number against the text-block margins", async () => {
  const tl = await pdfNumberDraw(project("top-left"), 0);
  expect(tl.draws[tl.draws.length - 1].x).toBe(72);
  const tr = await pdfNumberDraw(project("top-right"), 0);
  const last = tr.draws[tr.draws.length - 1];
  expect(last.x).toBe(tr.width - 72 - 10);
  expect(last.y).toBeGreaterThan(tr.height - 72);
  const bl = await pdfNumberDraw(project("bottom-left"), 0);
  expect(bl.draws[bl.draws.length - 1].y).toBe(36);
}, 30000);

it("Chicago skips the title page and numbers the next page 1 at the chosen spot", async () => {
  const withNumbers = project("top-center", "chicago");
  const without = project("top-center", "chicago");
  without.documentSettings = { ...without.documentSettings!, pageNumbers: false };
  const title = await pdfNumberDraw(withNumbers, 0);
  expect(title.draws.length).toBe((await pdfNumberDraw(without, 0)).draws.length);
  const next = await pdfNumberDraw(withNumbers, 1);
  const base = await pdfNumberDraw(without, 1);
  expect(next.draws.length).toBe(base.draws.length + 1);
  expect(next.draws[next.draws.length - 1].y).toBeGreaterThan(next.height - 72);
}, 30000);


it("top-center: Word has a centred PAGE header and no page-number footer", async () => {
  const { headers, footers } = await docxParts(project("top-center"));
  expect(headers.length).toBeGreaterThan(0);
  expect(headers.join("")).toMatch(/w:jc w:val="center"/);
  expect(headers.join("")).toMatch(/PAGE/);
  expect(footers.join("")).not.toMatch(/PAGE/);
});

it("bottom positions keep the footer; absent equals bottom-right", async () => {
  const absent = await docxParts(project());
  const br = await docxParts(project("bottom-right"));
  expect(absent.footers).toEqual(br.footers);
  expect(absent.footers.join("")).toMatch(/PAGE/);
  expect(absent.footers.join("")).toMatch(/w:jc w:val="right"/);
  expect(absent.headers.join("")).not.toMatch(/PAGE/);
  const bl = await docxParts(project("bottom-left"));
  expect(bl.footers.join("")).toMatch(/w:jc w:val="left"/);
});

it("Chicago keeps its title page and start at 0 in every Word position", async () => {
  for (const pos of ["top-right", "bottom-center"] as const) {
    const { document } = await docxParts(project(pos, "chicago"));
    expect(document).toMatch(/<w:titlePg\b/);
    expect(document).toMatch(/w:pgNumType[^>]*w:start="0"/);
  }
});

it("Markdown and plain text ignore the position", () => {
  const a = project("top-center");
  const b = project();
  expect(projectMarkdown(a)).toBe(projectMarkdown(b));
  expect(projectPlainText(a)).toBe(projectPlainText(b));
});

it("pageNumberPosition round-trips through project validation and JSON", () => {
  const p = project("top-left");
  validateProject(p);
  const copy = JSON.parse(JSON.stringify(p));
  validateProject(copy);
  expect(copy.documentSettings?.pageNumberPosition).toBe("top-left");
  const old = JSON.parse(JSON.stringify(project()));
  expect("pageNumberPosition" in old.documentSettings).toBe(false);
});
