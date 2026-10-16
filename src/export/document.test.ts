import { it, expect } from "vitest";
import { newProject } from "../model";
import { documentBlocks } from "./document";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import { PDFDocument } from "pdf-lib";
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
it("refuses dangling footnote references", () => {
  const p = fixture();
  p.research!.footnotes = [];
  expect(() => documentBlocks(p)).toThrow("matching note");
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
