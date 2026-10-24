import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { AssetId, PendingAsset } from "../assets/types";
import {
  documentBlocks,
  type Block,
  type ExportProject,
  type ImageBlockData,
  type Inline,
} from "./document";
import {
  bundledFontDataUrls,
  decodeFontDataUrl,
  type PdfFontFamily,
  type PdfFontKey,
  type PdfFontShard,
  type PdfFontStyle,
} from "./fonts";
type Line = {
  runs: Inline[];
  height: number;
  notes: number[];
  align?: string;
  indent?: number;
  image?: ImageBlockData;
  row?: {
    colWidth: number;
    cells: { items: Line[] }[];
  };
};
export type PdfFontBytes = Partial<Record<PdfFontKey, Uint8Array>>;
export async function exportPdf(
  project: ExportProject,
  injectedFontBytes?: PdfFontBytes,
  assets: Map<AssetId, PendingAsset> = new Map(),
): Promise<Blob> {
  const d = documentBlocks(project, assets),
    s = d.settings,
    pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const family: PdfFontFamily =
    s.font === "mono" ? "mono" : s.font === "sans" ? "sans" : "serif";
  const styleFor = (r: Inline): PdfFontStyle =>
    r.bold
      ? r.italic
        ? "boldItalic"
        : "bold"
      : r.italic
        ? "italic"
        : "regular";
  const fontAssets = new Map<
    PdfFontKey,
    { bytes: Uint8Array; font: ReturnType<typeof fontkit.create> }
  >();
  const shards: PdfFontShard[] = [
    "latin",
    "latin-ext",
    "greek",
    "greek-ext",
    "cyrillic",
    "cyrillic-ext",
  ];
  for (const shard of shards) {
    const key = `${family}:regular:${shard}` as PdfFontKey;
    const bytes =
      injectedFontBytes?.[key] ??
      (bundledFontDataUrls[key]
        ? decodeFontDataUrl(bundledFontDataUrls[key]!)
        : undefined);
    if (bytes) fontAssets.set(key, { bytes, font: fontkit.create(bytes) });
  }
  const shapeError = () =>
    new Error(
      "PDF export currently supports Latin, Greek, and Cyrillic text. This text needs script shaping or a font glyph the bundled fonts do not provide; export it as DOCX instead.",
    );
  const selectShard = (cluster: string): PdfFontShard => {
    if (
      /\p{L}/u.test(cluster) &&
      !/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u.test(cluster)
    )
      throw shapeError();
    const cp = cluster.codePointAt(0)!;
    for (const shard of shards) {
      const entry = fontAssets.get(`${family}:regular:${shard}` as PdfFontKey);
      if (entry && entry.font.characterSet.includes(cp)) return shard;
    }
    throw shapeError();
  };
  const segment = (r: Inline): Inline[] => {
    if (r.lineBreak || !r.text) return [r];
    const chunks: Inline[] = [];
    for (const character of Array.from(r.text)) {
      const shard = selectShard(character);
      const key = `${family}:${styleFor(r)}:${shard}` as PdfFontKey;
      const actualKey =
        bundledFontDataUrls[key] || injectedFontBytes?.[key]
          ? key
          : (`${family}:${r.bold ? "bold" : "regular"}:${shard}` as PdfFontKey);
      const previous = chunks.at(-1);
      if (previous?.fontFamily === actualKey) previous.text += character;
      else chunks.push({ ...r, text: character, fontFamily: actualKey });
    }
    return chunks;
  };
  const mapBlock = (b: Block, bold = false): Block => ({
    ...b,
    runs: b.runs.flatMap((r) =>
      segment({ ...r, bold: r.bold || bold || b.kind === "heading" }),
    ),
    ...(b.table
      ? {
          table: {
            ...b.table,
            rows: b.table.rows.map((row) =>
              row.map((cell) => ({
                ...cell,
                blocks: cell.blocks.map((cb) => mapBlock(cb, cell.header)),
              })),
            ),
          },
        }
      : {}),
  });
  const blocks = d.blocks.map((b) => mapBlock(b));
  const flatRuns = (b: Block): Inline[] => [
    ...b.runs,
    ...(b.table?.rows.flatMap((row) =>
      row.flatMap((cell) => cell.blocks.flatMap(flatRuns)),
    ) ?? []),
  ];
  const allRuns = [
    ...blocks.flatMap(flatRuns),
    ...d.notes.flatMap((n) => n.parts.flatMap(segment)),
    ...d.bibliography.flatMap((b) => b.parts.flatMap(segment)),
    ...segment({ text: "Bibliography", bold: true }),
  ];
  const usedKeys = [
    ...new Set<PdfFontKey>([
      `${family}:regular:latin`,
      ...allRuns
        .map((r) => r.fontFamily)
        .filter((key): key is PdfFontKey => !!key),
    ]),
  ];
  const embeddedFonts = new Map<PdfFontKey, PDFFont>();
  for (const key of usedKeys) {
    const injected = injectedFontBytes?.[key];
    const bytes =
      injected ??
      (bundledFontDataUrls[key]
        ? decodeFontDataUrl(bundledFontDataUrls[key]!)
        : undefined);
    if (!bytes) throw shapeError();
    embeddedFonts.set(key, await pdf.embedFont(bytes, { subset: true }));
  }
  const font = (r: Inline): PDFFont => {
    const key = r.fontFamily as PdfFontKey | undefined;
    const embedded = key ? embeddedFonts.get(key) : undefined;
    if (!embedded) throw shapeError();
    return embedded;
  };
  const paperWidth = project.pageLayout?.paper === "a4" ? 595.28 : 612,
    paperHeight = project.pageLayout?.paper === "a4" ? 841.89 : 792;
  const margin = s.marginInches * 72,
    width = paperWidth - margin * 2,
    height = paperHeight - margin * 2,
    size = s.fontSize;
  const runSize = (r: Inline) =>
    r.superscript ? (r.fontSize ?? size) * 0.7 : (r.fontSize ?? size);
  const measure = (r: Inline) => {
    try {
      return font(r).widthOfTextAtSize(r.text, runSize(r));
    } catch {
      throw shapeError();
    }
  };
  const marker = (block: Block) =>
    block.list?.kind === "bullet"
      ? "• "
      : block.list?.kind === "ordered"
        ? `${block.list.number ?? 1}. `
        : "";
  function wrap(
    runs: Inline[],
    lineSize = size,
    lineSpacing = s.lineSpacing,
    firstIndent = 0,
    hanging = false,
    leftIndent = 0,
    rightIndent = 0,
  ): Line[] {
    const result: Line[] = [];
    const indent = () =>
      leftIndent +
      (hanging ? (result.length ? 36 : 0) : result.length ? 0 : firstIndent);
    let line: Inline[] = [],
      w = 0;
    const push = () => {
      result.push({
        runs: line,
        height:
          Math.max(lineSize, ...line.map((r) => r.fontSize ?? lineSize)) *
          lineSpacing,
        notes: line.flatMap((r) => (r.footnote ? [r.footnote] : [])),
        indent: indent(),
      });
      line = [];
      w = 0;
    };
    for (const r of runs) {
      if (r.lineBreak) {
        push();
        continue;
      }
      for (const token of r.text.split(/(\s+)/)) {
        if (!token) continue;
        if (token.includes("\n")) {
          push();
          continue;
        }
        const item = { ...r, text: token };
        const n = (measure(item) * lineSize) / size;
        if (n > width - indent() - rightIndent && !token.trim()) continue;
        if (w + n > width - indent() - rightIndent && line.length) push();
        if (!line.length && !token.trim()) continue;
        if (n > width - indent() - rightIndent) {
          // Split oversized tokens by Unicode code point so URLs/long words do not vanish.
          let part = "";
          for (const character of token) {
            const candidate = { ...item, text: part + character };
            const candidateWidth = (measure(candidate) * lineSize) / size;
            if (part && w + candidateWidth > width - indent() - rightIndent) {
              line.push({ ...item, text: part });
              push();
              part = character;
            } else part += character;
          }
          if (part) {
            line.push({ ...item, text: part });
            w += (measure({ ...item, text: part }) * lineSize) / size;
            push();
          }
        } else {
          line.push(item);
          w += n;
        }
      }
    }
    if (line.length || !result.length) push();
    return result;
  }
  const cellPad = 4;
  const blockLines = (
    b: Block,
    rightExtra = 0,
    inCell = false,
  ): (Line | "break")[] => {
    if (b.kind === "pageBreak") return inCell ? [] : ["break"];
    if (b.image)
      return [{ runs: [], height: b.image.height + 6, notes: [], image: b.image }];
    if (b.table) {
      if (inCell)
        throw new Error(
          "Tables inside table cells are not supported in PDF export. Export DOCX instead.",
        );
      const table = b.table;
      const colWidth = width / table.columns;
      const inner = colWidth - cellPad * 2;
      if (inner < 24)
        throw new Error(
          "A table has too many columns to fit on a PDF page. Remove columns or export DOCX.",
        );
      const result: Line[] = [{ runs: [], height: 6, notes: [] }];
      for (const row of table.rows) {
        const cells = row.map((cell) => ({
          items: cell.blocks.flatMap((cb) =>
            blockLines(cb, width - inner, true),
          ) as Line[],
        }));
        const content = Math.max(
          size,
          ...cells.map((c) => c.items.reduce((sum, l) => sum + l.height, 0)),
        );
        const rowHeight = content + cellPad * 2;
        if (rowHeight > height)
          throw new Error(
            "A table row is taller than one PDF page. Shorten the row or export DOCX.",
          );
        result.push({
          runs: [],
          height: rowHeight,
          notes: cells.flatMap((c) => c.items.flatMap((l) => l.notes)),
          row: { colWidth, cells },
        });
      }
      result.push({ runs: [], height: 6, notes: [] });
      return result;
    }
    const rows = wrap(
      [...(marker(b) ? segment({ text: marker(b) }) : []), ...b.runs],
      size,
      b.lineHeight ?? s.lineSpacing,
      b.firstLineIndent ??
        (s.firstLineIndent && !inCell && b.kind === "paragraph" ? 36 : 0),
      false,
      (b.indentLeft ?? 0) + (b.list ? 18 + 18 * b.list.level : 0),
      (b.indentRight ?? 0) + rightExtra,
    ).map((l) => ({ ...l, align: b.align }));
    const result: Line[] = [];
    if (b.spaceBefore)
      result.push({ runs: [], height: b.spaceBefore, notes: [] });
    result.push(...rows);
    if (b.spaceAfter)
      result.push({ runs: [], height: b.spaceAfter, notes: [] });
    return result;
  };
  const lines: (Line | "break")[] = blocks.flatMap((b) => blockLines(b));
  if (d.bibliography.length) {
    lines.push("break", ...wrap(segment({ text: "Bibliography", bold: true })));
    for (const b of d.bibliography)
      lines.push(
        ...wrap(
          b.parts.flatMap((p) => segment({ text: p.text, italic: p.italic })),
          size,
          1,
          0,
          true,
        ),
        { runs: [], height: 10, notes: [] },
      );
  }
  const pages: { lines: Line[]; notes: number[] }[] = [];
  let current = { lines: [] as Line[], notes: [] as number[] };
  let used = 0;
  const drawn = new Set<number>();
  const noteLines = (n: number) =>
    wrap(
      [
        ...segment({ text: `${n}. ` }),
        ...(d.notes.find((x) => x.number === n)?.parts.flatMap(segment) ?? []),
      ],
      10,
      1.2,
    );
  const noteHeight = (ids: number[]) =>
    ids.reduce(
      (sum, n) => sum + noteLines(n).length * 12 + 4,
      ids.length ? 16 : 0,
    );
  for (const line of lines) {
    if (line === "break") {
      if (current.lines.length) {
        current.notes.forEach((n) => drawn.add(n));
        pages.push(current);
        current = { lines: [], notes: [] };
        used = 0;
      }
      continue;
    }
    const add = [...new Set(line.notes)].filter(
      (n) => !drawn.has(n) && !current.notes.includes(n),
    );
    let ids = [...current.notes, ...add];
    if (line.height + noteHeight(add) > height)
      throw new Error(
        "A footnote is too long to fit on one PDF page. Export DOCX for flowing footnotes.",
      );
    if (used + line.height + noteHeight(ids) > height && current.lines.length) {
      current.notes.forEach((n) => drawn.add(n));
      pages.push(current);
      current = { lines: [], notes: [] };
      used = 0;
      ids = add;
    }
    current.lines.push(line);
    current.notes = ids;
    used += line.height;
  }
  if (current.lines.length || !pages.length) pages.push(current);
  const embeddedImages = new Map<AssetId, PDFImage>();
  const imageBlocks = (b: Block): ImageBlockData[] => [
    ...(b.image ? [b.image] : []),
    ...(b.table?.rows.flatMap((row) =>
      row.flatMap((cell) => cell.blocks.flatMap(imageBlocks)),
    ) ?? []),
  ];
  for (const img of blocks.flatMap(imageBlocks)) {
    if (embeddedImages.has(img.assetId)) continue;
    embeddedImages.set(
      img.assetId,
      img.mime === "image/png"
        ? await pdf.embedPng(img.bytes)
        : await pdf.embedJpg(img.bytes),
    );
  }
  const drawImage = (page: PDFPage, img: ImageBlockData, x: number, y: number) =>
    page.drawImage(embeddedImages.get(img.assetId)!, {
      x,
      y,
      width: img.width,
      height: img.height,
    });
  const drawTextLine = (
    page: PDFPage,
    line: Line,
    baseX: number,
    y: number,
    available: number,
  ) => {
    const lineWidth = line.runs.reduce((w, r) => w + measure(r), 0);
    let x =
      baseX +
      (line.indent ?? 0) +
      (line.align === "center"
        ? (available - lineWidth) / 2
        : line.align === "right"
          ? available - lineWidth
          : 0);
    for (const r of line.runs) {
      const fs = runSize(r);
      page.drawText(r.text, {
        x,
        y: y + (r.superscript ? 4 : 0),
        size: fs,
        font: font(r),
        color: rgb(0, 0, 0),
      });
      const w = measure(r);
      if (r.underline || r.strike)
        page.drawLine({
          start: { x, y: y + (r.strike ? size * 0.32 : -2) },
          end: { x: x + w, y: y + (r.strike ? size * 0.32 : -2) },
          thickness: 0.5,
        });
      x += w;
    }
  };
  pages.forEach((p, index) => {
    const page = pdf.addPage([paperWidth, paperHeight]);
    let y = paperHeight - margin - size;
    for (const line of p.lines) {
      if (line.image)
        drawImage(
          page,
          line.image,
          margin + (width - line.image.width) / 2,
          y + size - line.image.height,
        );
      else if (line.row) {
        const top = y + size;
        line.row.cells.forEach((cell, column) => {
          const x = margin + column * line.row!.colWidth;
          page.drawRectangle({
            x,
            y: top - line.height,
            width: line.row!.colWidth,
            height: line.height,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });
          let cy = top - cellPad - size;
          for (const item of cell.items) {
            if (item.image)
              drawImage(page, item.image, x + cellPad, cy + size - item.image.height);
            else
              drawTextLine(page, item, x + cellPad, cy, line.row!.colWidth - cellPad * 2);
            cy -= item.height;
          }
        });
      } else drawTextLine(page, line, margin, y, width);
      y -= line.height;
    }
    if (p.notes.length) {
      let ny = margin + noteHeight(p.notes) - 14;
      page.drawLine({
        start: { x: margin, y: ny + 12 },
        end: { x: margin + 100, y: ny + 12 },
        thickness: 0.5,
      });
      for (const n of p.notes) {
        for (const line of noteLines(n)) {
          let nx = margin;
          for (const r of line.runs) {
            page.drawText(r.text, { x: nx, y: ny, size: 10, font: font(r) });
            nx += font(r).widthOfTextAtSize(r.text, 10);
          }
          ny -= 12;
        }
        ny -= 4;
      }
    }
    if (s.pageNumbers && !(project.templateId === "chicago" && index === 0))
      page.drawText(
        String(project.templateId === "chicago" ? index : index + 1),
        {
          x: paperWidth - margin - 10,
          y: margin / 2,
          size: 10,
          font: embeddedFonts.values().next().value!,
        },
      );
  });
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
