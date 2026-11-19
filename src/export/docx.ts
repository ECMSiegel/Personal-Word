import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  FootnoteReferenceRun,
  Footer,
  Header,
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
import { defaultFontSource, type ExportFontSource } from "./fontSource";
import { pageLabelPosition } from "./pageLabel";

// A run's font as Word is told it (first family, quotes stripped).
const runFont = (fontFamily?: string) =>
  fontFamily?.split(",")[0].replaceAll("'", "").replaceAll('"', "");

// Fonts applied to runs that a Word file can carry: one per family, the
// regular face when several styles resolved. Preview-only and restricted
// fonts are not embedded (a Word file is editable), and only TrueType
// outlines are embedded: the first four bytes must be 00 01 00 00 or "true"
// ("OTTO"/CFF and anything else is skipped). Never throws.
const isTrueType = (bytes: Uint8Array) => {
  const ttf =
    bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00;
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return ttf || tag === "true";
};
async function embeddedFonts(
  blocks: Block[],
  notes: { parts: Inline[] }[],
  source: ExportFontSource,
) {
  const triples = new Map<string, { family: string; bold: boolean; italic: boolean }>();
  const visit = (runs: Inline[]) => {
    for (const r of runs) {
      const family = runFont(r.fontFamily)?.trim();
      if (!family || r.lineBreak || r.footnote) continue;
      const bold = !!r.bold,
        italic = !!r.italic;
      triples.set(`${family}\u0000${bold}\u0000${italic}`, { family, bold, italic });
    }
  };
  const walk = (list: Block[]) => {
    for (const b of list) {
      visit(b.runs);
      b.table?.rows.forEach((row) => row.forEach((cell) => walk(cell.blocks)));
    }
  };
  walk(blocks);
  notes.forEach((n) => visit(n.parts));
  const byFamily = new Map<string, { regular: boolean; bytes: Uint8Array }>();
  for (const { family, bold, italic } of triples.values()) {
    try {
      const got = await source.resolve(family, bold, italic);
      if (!got || (got.embedding !== "installable" && got.embedding !== "editable")) continue;
      if (!isTrueType(got.bytes)) continue;
      const regular = !bold && !italic;
      const have = byFamily.get(family);
      if (!have || (regular && !have.regular)) byFamily.set(family, { regular, bytes: got.bytes });
    } catch {
      // A font that cannot be found is simply not embedded.
    }
  }
  return [...byFamily].map(([name, { bytes }]) => ({
    name,
    data: bytes as unknown as Buffer,
  }));
}

// A footnote's text may hold blank-line paragraph breaks (the model, Markdown and plain
// text keep them). Split into paragraphs on blank lines; a single newline is a soft wrap
// and becomes a space. Text without any newline is returned untouched, as one paragraph.
function noteParagraphs(parts: Inline[]): Inline[][] {
  if (!parts.some((p) => /[\r\n]/.test(p.text))) return [parts];
  const paragraphs: Inline[][] = [[]];
  for (const part of parts) {
    const pieces = part.text
      .replace(/\r\n?/g, "\n")
      .split(/(?:[ \t]*\n){2,}[ \t]*/);
    pieces.forEach((piece, i) => {
      if (i > 0) paragraphs.push([]);
      const current = paragraphs.at(-1)!;
      let text = piece.replace(/[ \t]*\n[ \t]*/g, " ");
      if (!current.length) text = text.trimStart();
      if (text) current.push({ ...part, text });
    });
  }
  const kept = paragraphs.filter((p) => p.some((r) => r.text.trim()));
  return kept.length ? kept : [[]];
}
export async function exportDocx(
  project: ExportProject,
  assets: Map<AssetId, PendingAsset> = new Map(),
  fontSource: ExportFontSource = defaultFontSource(),
): Promise<Blob> {
  const d = documentBlocks(project, assets),
    s = d.settings;
  const fonts = await embeddedFonts(d.blocks, d.notes, fontSource);
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
  const labelPosition = pageLabelPosition(s);
  const numberAtTop = labelPosition.startsWith("top");
  const numberAlignment = labelPosition.endsWith("left")
    ? AlignmentType.LEFT
    : labelPosition.endsWith("center")
      ? AlignmentType.CENTER
      : AlignmentType.RIGHT;
  const headerText = (s.pageHeaderText ?? "").trim();
  const showLabel = s.pageNumbers || !!headerText;
  const numberParagraph = () =>
    new Paragraph({
      alignment: numberAlignment,
      children: [
        ...(headerText
          ? [new TextRun({ text: s.pageNumbers ? headerText + " " : headerText })]
          : []),
        ...(s.pageNumbers ? [new TextRun({ children: [PageNumber.CURRENT] })] : []),
      ],
    });
  const numberFooter = new Footer({ children: [numberParagraph()] });
  const numberHeader = new Header({ children: [numberParagraph()] });
  const buildDoc = (docFonts: typeof fonts) => {
    return new Document({
    ...(docFonts.length ? { fonts: docFonts } : {}),
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
          children: noteParagraphs(n.parts).map(
            (para) =>
              new Paragraph({
                spacing: { line: 240 },
                children: para.map(
                  (p) =>
                    new TextRun({ text: p.text, italics: p.italic, size: 20 }),
                ),
              }),
          ),
        },
      ]),
    ),
    sections: [
      {
        properties: {
          titlePage: project.templateId === "chicago" || !!s.pageFirstDifferent,
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
        footers: showLabel && !numberAtTop ? { default: numberFooter } : undefined,
        headers: showLabel && numberAtTop ? { default: numberHeader } : undefined,
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
                    b.heading
                      ? new Paragraph({
                          children: [new TextRun({ text: b.text, bold: true })],
                          spacing: { before: 240, after: 120 },
                        })
                      : new Paragraph({
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
  };
  try {
    return await Packer.toBlob(buildDoc(fonts));
  } catch (error) {
    // One font the packer rejects must not fail the whole export: rebuild once
    // without fonts, so the file is exactly the no-font export as before.
    if (!fonts.length) throw error;
    return Packer.toBlob(buildDoc([]));
  }
}
