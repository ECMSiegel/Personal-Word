import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Project } from "../model";
import type { AssetId, PendingAsset } from "../assets/types";
import {
  documentBlocks,
  type Block,
  type Inline,
  type ImageBlockData,
  type TableBlockData,
} from "../export/document";

/** Layout L1 native print path. Not wired to any public export route. */

export interface PrintGeometry {
  /** Letter is 612 x 792 pt; A4 is 595.28 x 841.89 pt. */
  paper: "letter" | "a4";
  /** Uniform margin in inches, 0.25 to 2. Native print info owns paper and margins. */
  marginInches: number;
}

export interface PrintRequest {
  /** Validated, immutable project snapshot taken after the save queue flushed. */
  snapshot: Project;
  /** Escaped, schema-generated markup. The native side adds its own CSP before it. */
  pagesHtml: string;
  geometry: PrintGeometry;
  layoutVersion: "native-v2";
}

/** Evidence the native print view reports about readiness and lockdown. */
export interface PrintDiagnostics {
  fontsStatus: string;
  faces: { family: string; status: string }[];
  images: { assetId: string | null; complete: boolean; naturalWidth: number; decoded: boolean }[];
  violations: { blockedURI: string; directive: string }[] | null;
  resources: string[];
  pageScriptRan: boolean;
  blockedNavigations: string[];
  [key: string]: unknown;
}

export interface RenderedPdf {
  bytes: Uint8Array;
  pageCount: number;
  warnings: string[];
  sourceRevision: number;
  diagnostics?: PrintDiagnostics;
}

export interface PrintHtmlOptions {
  geometry: PrintGeometry;
  assets?: Map<AssetId, PendingAsset>;
  headerTitle?: string;
  headerAuthor?: string;
  showRunningHeaders?: boolean;
  fontFamily?: "serif" | "sans" | "mono";
  fontSizePt?: number;
  lineSpacing?: number;
  /** A licensed font embedded as a data: URI and placed first in the body font stack. */
  embeddedFont?: { family: string; woff: Uint8Array };
}

export const PRINT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:";

const PAPER_PT = { letter: [612, 792], a4: [595.28, 841.89] } as const;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function renderInlines(inlines: Inline[]): string {
  return inlines
    .map((run) => {
      if (run.lineBreak) return "<br>";
      let text = escapeHtml(run.text);
      if (!text) return "";
      if (run.bold) text = `<strong>${text}</strong>`;
      if (run.italic) text = `<em>${text}</em>`;
      if (run.underline) text = `<u>${text}</u>`;
      if (run.strike) text = `<s>${text}</s>`;
      if (run.superscript || run.footnote) text = `<sup>${text}</sup>`;
      return text;
    })
    .join("");
}

function renderImageBlock(img: ImageBlockData): string {
  const src = `data:${img.mime};base64,${uint8ArrayToBase64(img.bytes)}`;
  const alt = escapeHtml(img.alt || "");
  return `<figure class="doc-image"><img src="${src}" data-asset-id="${escapeHtml(img.assetId)}" alt="${alt}" width="${Math.round(img.width)}" height="${Math.round(img.height)}">${
    img.alt ? `<figcaption dir="auto">${alt}</figcaption>` : ""
  }</figure>`;
}

function renderTableBlock(tbl: TableBlockData): string {
  const rows = tbl.rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => {
            const tag = cell.header ? "th" : "td";
            return `<${tag} dir="auto">${cell.blocks.map((b) => renderInlines(b.runs)).join("<br>")}</${tag}>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table class="doc-table">${rows}</table>`;
}

function renderBlock(block: Block): string {
  if (block.kind === "image" && block.image) return renderImageBlock(block.image);
  if (block.kind === "table" && block.table) return renderTableBlock(block.table);
  const inlineHtml = renderInlines(block.runs);
  if (block.kind === "heading") {
    const lvl = block.level && block.level >= 1 && block.level <= 6 ? block.level : 2;
    return `<h${lvl} dir="auto">${inlineHtml}</h${lvl}>`;
  }
  if (block.kind === "codeBlock") return `<pre dir="ltr"><code>${inlineHtml}</code></pre>`;
  if (block.kind === "blockquote") return `<blockquote dir="auto">${inlineHtml}</blockquote>`;
  const indent = block.firstLineIndent && block.firstLineIndent > 0 ? " first-line-indent" : "";
  return `<p class="doc-p${indent}" dir="auto">${inlineHtml}</p>`;
}

/**
 * Builds the print document from the shared export blocks. Each explicit page break starts a
 * new sheet sized to the content box, with its own running header and footer. A sheet whose
 * content is taller than one page flows onto further pages (L3 replaces this with measured
 * pagination); its header then appears only on its first page and its footer on its last.
 */
export function buildPrintHtml(project: Project, options: PrintHtmlOptions): string {
  const { blocks, notes, bibliography } = documentBlocks(project, options.assets ?? new Map());
  const [, paperHeight] = PAPER_PT[options.geometry.paper];
  const sheetHeight = paperHeight - options.geometry.marginInches * 72 * 2 - 2;
  const showHeaders = options.showRunningHeaders !== false;
  const title = escapeHtml(options.headerTitle ?? project.title);
  const author = escapeHtml(options.headerAuthor ?? "");

  const sheets: string[][] = [[]];
  for (const block of blocks) {
    if (block.kind === "pageBreak") sheets.push([]);
    else sheets[sheets.length - 1].push(renderBlock(block));
  }
  const last = sheets[sheets.length - 1];
  if (notes.length > 0) {
    last.push(
      `<section class="notes"><hr class="notes-rule"><ol class="notes-list">${notes
        .map(
          (note) =>
            `<li class="note" dir="auto"><span class="note-number">${note.number}.</span> ${
              note.parts && note.parts.length > 0 ? renderInlines(note.parts) : escapeHtml(note.text)
            }</li>`,
        )
        .join("")}</ol></section>`,
    );
  }
  if (bibliography.length > 0) {
    last.push(
      `<section class="bibliography"><h2>Bibliography</h2>${bibliography
        .map((entry) => `<p class="bib-entry" dir="auto">${escapeHtml(entry.text)}</p>`)
        .join("")}</section>`,
    );
  }

  const total = sheets.length;
  const body = sheets
    .map(
      (content, i) =>
        `<section class="sheet">${
          showHeaders
            ? `<header class="running-header"><span>${title}</span><span>${author}</span></header>`
            : ""
        }<div class="sheet-body">${content.join("")}</div>${
          showHeaders
            ? `<footer class="running-footer"><span>Personal Word</span><span>Sheet ${i + 1} of ${total}</span></footer>`
            : ""
        }</section>`,
    )
    .join("");

  const stacks = {
    sans: `"Futura", "Avenir Next", "Avenir", -apple-system, sans-serif`,
    mono: `"SF Mono", "Menlo", monospace`,
    serif: `"New York", "Georgia", "Times New Roman", serif`,
  };
  const embedded = options.embeddedFont;
  const fontFace = embedded
    ? `@font-face { font-family: "${embedded.family.replace(/[^A-Za-z0-9 _-]/g, "")}"; src: url(data:font/woff;base64,${uint8ArrayToBase64(embedded.woff)}) format("woff"); font-weight: 400; font-style: normal; }`
    : "";
  const bodyStack = `${embedded ? `"${embedded.family.replace(/[^A-Za-z0-9 _-]/g, "")}", ` : ""}${stacks[options.fontFamily ?? "serif"]}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">
<title>${escapeHtml(project.title)}</title>
<style>
${fontFace}
*, *::before, *::after { box-sizing: border-box; }
/* WebKit prints 1 CSS px as 0.8 pt (its fixed print shrink factor), not 0.75 pt, so pt and in
   units come out 6.7% large and sheets overflow. 0.9375 = 0.75 / 0.8 restores true size.
   Observed in the L1 native probe; L2/L3 must keep measuring it, not assume it. */
html { zoom: 0.9375; }
html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: ${bodyStack}; font-size: ${options.fontSizePt ?? 11}pt; line-height: ${options.lineSpacing ?? 1.5}; }
.sheet { display: flex; flex-direction: column; min-height: ${sheetHeight}pt; break-after: page; page-break-after: always; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.sheet-body { flex: 1 0 auto; }
.running-header, .running-footer { display: flex; justify-content: space-between; font-family: ${stacks.sans}; font-size: 8.5pt; color: #555; }
.running-header { border-bottom: 0.5pt solid #bbb; padding-bottom: 3pt; margin-bottom: 12pt; }
.running-footer { border-top: 0.5pt solid #bbb; padding-top: 3pt; margin-top: 12pt; }
h1, h2, h3, h4, h5, h6 { font-weight: 600; margin: 0.8em 0 0.4em; break-after: avoid; }
h1 { font-size: 1.6em; margin-top: 0; } h2 { font-size: 1.3em; } h3 { font-size: 1.1em; }
p { margin: 0 0 0.6em; orphans: 2; widows: 2; }
.first-line-indent { text-indent: 0.5in; }
blockquote { margin: 0.8em 1.5em; padding-left: 1em; border-left: 2px solid #ccc; }
pre { font-family: ${stacks.mono}; font-size: 9.5pt; border: 1px solid #ddd; padding: 0.5em 0.7em; white-space: pre-wrap; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 0.8em 0; break-inside: avoid; }
th, td { border: 1px solid #999; padding: 0.3em 0.5em; vertical-align: top; text-align: start; }
th { font-weight: 600; }
figure.doc-image { margin: 0.8em 0; break-inside: avoid; }
figure.doc-image img { max-width: 100%; height: auto; }
figcaption { font-size: 8.5pt; color: #555; }
.notes { margin-top: 1.5em; font-size: 9pt; line-height: 1.35; }
.notes-rule { width: 2in; margin: 0 0 0.6em; border: 0; border-top: 0.5pt solid #777; }
.notes-list { list-style: none; margin: 0; padding: 0; }
.note { margin-bottom: 0.4em; }
.note-number { font-weight: 600; margin-inline-end: 0.3em; }
.bib-entry { padding-left: 0.5in; text-indent: -0.5in; }
</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`;
}

/** Sends a snapshot's print markup to the native WebKit printer. */
export async function renderNativePdf(request: PrintRequest): Promise<RenderedPdf> {
  if (!isTauri()) {
    throw new Error("Native PDF printing requires the macOS desktop app");
  }
  const raw = await invoke<unknown>("render_pdf", { request });
  const r = raw as {
    bytesBase64?: unknown;
    bytes?: unknown;
    pageCount?: unknown;
    warnings?: unknown;
    sourceRevision?: unknown;
    diagnostics?: unknown;
  } | null;
  if (!r || typeof r !== "object" || Array.isArray(r)) {
    throw new Error("Native print returned no structured result");
  }
  let bytes: Uint8Array;
  if (typeof r.bytesBase64 === "string") bytes = base64ToBytes(r.bytesBase64);
  else if (Array.isArray(r.bytes)) bytes = new Uint8Array(r.bytes as number[]);
  else throw new Error("Native print returned no PDF bytes");
  if (!Number.isSafeInteger(r.pageCount) || (r.pageCount as number) < 1) {
    throw new Error("Native print did not report a page count");
  }
  if (r.sourceRevision !== request.snapshot.revision) {
    throw new Error("Native print result does not match the snapshot revision");
  }
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") {
    throw new Error("Native print did not return a PDF");
  }
  const warnings = Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === "string") : [];
  return {
    bytes,
    pageCount: r.pageCount as number,
    warnings,
    sourceRevision: r.sourceRevision as number,
    diagnostics: r.diagnostics as PrintDiagnostics | undefined,
  };
}
