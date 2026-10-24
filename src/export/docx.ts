import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  ImageRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  LevelFormat,
} from "docx";
import type { AssetId, PendingAsset } from "../assets/types";
import {
  documentBlocks,
  type Block,
  type ExportProject,
  type Inline,
} from "./document";
export async function exportDocx(
  project: ExportProject,
  assets: Map<AssetId, PendingAsset> = new Map(),
): Promise<Blob> {
  const d = documentBlocks(project, assets),
    s = d.settings;
  const font =
    s.font === "mono"
      ? "Courier New"
      : s.font === "sans"
        ? "Arial"
        : "Times New Roman";
  const run = (r: Inline) =>
    r.lineBreak
      ? new TextRun({ break: 1 })
      : r.footnote
        ? new FootnoteReferenceRun(r.footnote)
        : r.link && /^(https?|mailto):/i.test(r.link)
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
                  strike: r.strike,
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
              strike: r.strike,
              superScript: r.superscript,
            });
  const imageRun = (b: Block) => {
    const img = b.image!;
    return new ImageRun({
      type: img.mime === "image/png" ? "png" : "jpg",
      data: img.bytes,
      // docx sizes images in pixels (96 per inch); blocks are in points.
      transformation: {
        width: Math.max(1, Math.round(img.width / 0.75)),
        height: Math.max(1, Math.round(img.height / 0.75)),
      },
      altText: {
        name: img.assetId.slice(0, 12),
        description: img.alt,
        title: img.alt,
      },
    });
  };
  const paragraph = (b: Block, inCell: boolean) =>
              new Paragraph({
                children: b.image ? [imageRun(b)] : b.runs.map(run),
                pageBreakBefore: b.kind === "pageBreak",
                numbering: b.list
                  ? {
                      reference: `personal-word-${b.list.kind}-${b.list.id}`,
                      level: b.list.level,
                      instance: b.list.id,
                    }
                  : undefined,
                alignment:
                  b.align === "center" || b.image
                    ? AlignmentType.CENTER
                    : b.align === "right"
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                indent: {
                  left: (b.indentLeft ?? 0) * 20,
                  right: (b.indentRight ?? 0) * 20,
                  firstLine:
                    (b.firstLineIndent ??
                      (s.firstLineIndent &&
                      !inCell &&
                      b.kind === "paragraph" &&
                      !b.list
                        ? 36
                        : 0)) * 20,
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
              });
  const tableWidthTwips = Math.round(
    ((project.pageLayout?.paper === "a4" ? 595.28 : 612) - s.marginInches * 144) * 20,
  );
  const blockToDocx = (b: Block, inCell: boolean): Paragraph | Table => {
    if (!b.table) return paragraph(b, inCell);
    const columnWidth = Math.floor(tableWidthTwips / b.table.columns);
    return new Table({
      width: { size: tableWidthTwips, type: WidthType.DXA },
      columnWidths: Array.from({ length: b.table.columns }, () => columnWidth),
      rows: b.table.rows.map((row, index) => {
        const header = index === 0 && row.length > 0 && row.every((c) => c.header);
        return new TableRow({
          tableHeader: header,
          cantSplit: true,
          children: row.map(
            (cell) =>
              new TableCell({
                width: { size: columnWidth, type: WidthType.DXA },
                children: cell.blocks.length
                  ? cell.blocks.map((cb) =>
                      cell.header && !cb.image
                        ? paragraph(
                            { ...cb, runs: cb.runs.map((r) => ({ ...r, bold: true })) },
                            true,
                          )
                        : paragraph(cb, true),
                    )
                  : [new Paragraph({})],
              }),
          ),
        });
      }),
    });
  };
  const doc = new Document({
    numbering: {
      config: [
        ...new Map(
          d.blocks.filter((b) => b.list).map((b) => [b.list!.id, b.list!]),
        ).values(),
      ].map((list) => ({
        reference: `personal-word-${list.kind}-${list.id}`,
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format:
            list.kind === "ordered" ? LevelFormat.DECIMAL : LevelFormat.BULLET,
          text:
            list.kind === "ordered"
              ? `%${level + 1}.`
              : ["•", "◦", "▪"][level % 3],
          alignment: AlignmentType.START,
          start:
            level === list.level && list.kind === "ordered" ? list.start : 1,
          style: {
            paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
          },
        })),
      })),
    },
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
          ...d.blocks.map((b) => blockToDocx(b, false)),
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
