import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { documentBlocks, type ExportProject, type Inline } from "./document";
type Line = {
  runs: Inline[];
  height: number;
  notes: number[];
  align?: string;
  indent?: number;
};
export async function exportPdf(project: ExportProject): Promise<Blob> {
  const d = documentBlocks(project),
    s = d.settings,
    pdf = await PDFDocument.create();
  const family =
    s.font === "mono"
      ? [
          StandardFonts.Courier,
          StandardFonts.CourierBold,
          StandardFonts.CourierOblique,
          StandardFonts.CourierBoldOblique,
        ]
      : s.font === "sans"
        ? [
            StandardFonts.Helvetica,
            StandardFonts.HelveticaBold,
            StandardFonts.HelveticaOblique,
            StandardFonts.HelveticaBoldOblique,
          ]
        : [
            StandardFonts.TimesRoman,
            StandardFonts.TimesRomanBold,
            StandardFonts.TimesRomanItalic,
            StandardFonts.TimesRomanBoldItalic,
          ];
  const fonts = await Promise.all(family.map((f) => pdf.embedFont(f)));
  const font = (r: Inline): PDFFont =>
    fonts[(r.bold ? 1 : 0) + (r.italic ? 2 : 0)];
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
      throw new Error(
        "PDF supports Latin text with the built-in fonts. Use DOCX for this document’s Unicode characters.",
      );
    }
  };
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
      for (const token of r.text.split(/(\s+)/)) {
        if (!token) continue;
        if (token.includes("\n")) {
          push();
          continue;
        }
        const item = { ...r, text: token };
        const n = (measure(item) * lineSize) / size;
        if (n > width - indent() - rightIndent) {
          throw new Error(
            "A word or URL is wider than the PDF page. Add a break or export DOCX.",
          );
        }
        if (w + n > width - indent() - rightIndent && line.length) push();
        if (!line.length && !token.trim()) continue;
        line.push(item);
        w += n;
      }
    }
    if (line.length || !result.length) push();
    return result;
  }
  const lines: (Line | "break")[] = d.blocks.flatMap<Line | "break">((b) => {
    if (b.kind === "pageBreak") return ["break"];
    const rows = wrap(
      b.runs.map((r) => ({ ...r, bold: r.bold || b.kind === "heading" })),
      size,
      b.lineHeight ?? s.lineSpacing,
      b.firstLineIndent ??
        (s.firstLineIndent && b.kind === "paragraph" ? 36 : 0),
      false,
      b.indentLeft ?? 0,
      b.indentRight ?? 0,
    ).map((l) => ({ ...l, align: b.align }));
    const result: Line[] = [];
    if (b.spaceBefore)
      result.push({ runs: [], height: b.spaceBefore, notes: [] });
    result.push(...rows);
    if (b.spaceAfter)
      result.push({ runs: [], height: b.spaceAfter, notes: [] });
    return result;
  });
  if (d.bibliography.length) {
    lines.push("break", ...wrap([{ text: "Bibliography", bold: true }]));
    for (const b of d.bibliography)
      lines.push(
        ...wrap(
          b.parts.map((p) => ({ text: p.text, italic: p.italic })),
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
        { text: `${n}. ` },
        ...(d.notes.find((x) => x.number === n)?.parts ?? []),
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
  pages.forEach((p, index) => {
    const page = pdf.addPage([paperWidth, paperHeight]);
    let y = paperHeight - margin - size;
    for (const line of p.lines) {
      const lineWidth = line.runs.reduce((w, r) => w + measure(r), 0);
      let x =
        margin +
        (line.indent ?? 0) +
        (line.align === "center"
          ? (width - lineWidth) / 2
          : line.align === "right"
            ? width - lineWidth
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
        if (r.underline)
          page.drawLine({
            start: { x, y: y - 2 },
            end: { x: x + w, y: y - 2 },
            thickness: 0.5,
          });
        x += w;
      }
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
          font: fonts[0],
        },
      );
  });
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
