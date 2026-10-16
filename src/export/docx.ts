import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { documentBlocks, type ExportProject, type Inline } from "./document";
export async function exportDocx(project: ExportProject): Promise<Blob> {
  const d = documentBlocks(project),
    s = d.settings;
  const font =
    s.font === "mono"
      ? "Courier New"
      : s.font === "sans"
        ? "Arial"
        : "Times New Roman";
  const run = (r: Inline) =>
    r.footnote
      ? new FootnoteReferenceRun(r.footnote)
      : r.link
        ? new ExternalHyperlink({
            link: r.link,
            children: [
              new TextRun({
                text: r.text,
                font: r.fontFamily
                  ?.split(",")[0]
                  .replaceAll("'", "")
                  .replaceAll('"', ""),
                size: r.fontSize ? r.fontSize * 2 : undefined,
                bold: r.bold,
                italics: r.italic,
                underline: r.underline ? {} : undefined,
              }),
            ],
          })
        : new TextRun({
            text: r.text,
            font: r.fontFamily
              ?.split(",")[0]
              .replaceAll("'", "")
              .replaceAll('"', ""),
            size: r.fontSize ? r.fontSize * 2 : undefined,
            bold: r.bold,
            italics: r.italic,
            underline: r.underline ? {} : undefined,
            superScript: r.superscript,
          });
  const doc = new Document({
    styles: {
      paragraphStyles: [1, 2, 3, 4, 5, 6].map((level) => ({
        id: `Heading${level}`,
        name: `Heading ${level}`,
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font, size: s.fontSize * 2, color: "000000", bold: true },
        paragraph: { spacing: { before: 240, after: 120 } },
      })),
      default: {
        document: {
          run: { font, size: s.fontSize * 2 },
          paragraph: {
            spacing: { line: Math.round(s.lineSpacing * 240), after: 0 },
          },
        },
      },
    },
    footnotes: Object.fromEntries(
      d.notes.map((n) => [
        n.number,
        {
          children: [
            new Paragraph({
              spacing: { line: 240 },
              children: n.parts.map(
                (p) =>
                  new TextRun({ text: p.text, italics: p.italic, size: 20 }),
              ),
            }),
          ],
        },
      ]),
    ),
    sections: [
      {
        properties: {
          titlePage: project.templateId === "chicago",
          page: {
            pageNumbers: { start: project.templateId === "chicago" ? 0 : 1 },
            size:
              project.pageLayout?.paper === "a4"
                ? { width: 11906, height: 16838 }
                : { width: 12240, height: 15840 },
            margin: {
              top: s.marginInches * 1440,
              bottom: s.marginInches * 1440,
              left: s.marginInches * 1440,
              right: s.marginInches * 1440,
            },
          },
        },
        footers: s.pageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ children: [PageNumber.CURRENT] })],
                  }),
                ],
              }),
            }
          : undefined,
        children: [
          ...d.blocks.map(
            (b) =>
              new Paragraph({
                children: b.runs.map(run),
                pageBreakBefore: b.kind === "pageBreak",
                alignment:
                  b.align === "center"
                    ? AlignmentType.CENTER
                    : b.align === "right"
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                indent: {
                  left: (b.indentLeft ?? 0) * 20,
                  right: (b.indentRight ?? 0) * 20,
                  firstLine:
                    (b.firstLineIndent ??
                      (s.firstLineIndent && b.kind === "paragraph" ? 36 : 0)) *
                    20,
                },
                spacing: {
                  before:
                    b.spaceBefore !== undefined
                      ? b.spaceBefore * 20
                      : b.kind === "heading"
                        ? 180
                        : 0,
                  after: b.spaceAfter !== undefined ? b.spaceAfter * 20 : 0,
                  line: Math.round((b.lineHeight ?? s.lineSpacing) * 240),
                },
                ...(b.kind === "heading"
                  ? {
                      heading:
                        `Heading${Math.min(b.level ?? 1, 6)}` as "Heading1",
                    }
                  : {}),
              }),
          ),
          ...(d.bibliography.length
            ? [
                new Paragraph({
                  text: "Bibliography",
                  pageBreakBefore: true,
                  alignment: AlignmentType.CENTER,
                }),
                ...d.bibliography.map(
                  (b) =>
                    new Paragraph({
                      indent: { left: 720, hanging: 720 },
                      spacing: { line: 240, after: 240 },
                      children: b.parts.map(
                        (p) => new TextRun({ text: p.text, italics: p.italic }),
                      ),
                    }),
                ),
              ]
            : []),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
