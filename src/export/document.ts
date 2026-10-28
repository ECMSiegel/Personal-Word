import type { JSONContent } from "@tiptap/react";
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Project } from "../model";
import type { AssetId, PendingAsset } from "../assets/types";
import {
  footnoteText,
  footnoteParts,
} from "../research/citations";
import {
  bibliographyItems,
  type BibliographyItem,
} from "../research/bibliography";
import { resolveCitationContext } from "../research/noteForms";
import {
  defaultDocumentSettings,
  emptyResearch,
  type DocumentSettings,
  type ResearchData,
} from "../research/types";
export type ExportProject = Project & {
  research?: ResearchData;
  documentSettings?: DocumentSettings;
};
export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  lineBreak?: boolean;
  superscript?: boolean;
  footnote?: number;
  link?: string;
  fontFamily?: string;
  fontSize?: number;
};
export type ListInfo = {
  kind: "bullet" | "ordered";
  level: number;
  number?: number;
  id: number;
  start: number;
};
export type ImageBlockData = {
  assetId: AssetId;
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  /** Size in points, already fitted to the available width/height. */
  width: number;
  height: number;
  alt: string;
};
export type TableCellData = { header: boolean; blocks: Block[] };
export type TableBlockData = { columns: number; rows: TableCellData[][] };
export type Block = {
  runs: Inline[];
  /** Present when kind is "image". */
  image?: ImageBlockData;
  /** Present when kind is "table". */
  table?: TableBlockData;
  kind: string;
  level?: number;
  align?: string;
  style?: string;
  indentLeft?: number;
  indentRight?: number;
  firstLineIndent?: number;
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  list?: ListInfo;
};
function points(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = parseFloat(String(value));
  if (!Number.isFinite(n)) return undefined;
  return String(value).endsWith("in")
    ? n * 72
    : String(value).endsWith("px")
      ? n * 0.75
      : n;
}
export function documentBlocks(
  project: ExportProject,
  assets: Map<AssetId, PendingAsset> = new Map(),
) {
  const data = project.research ?? emptyResearch();
  const context = resolveCitationContext({ ...project, research: data });
  const settings = { ...defaultDocumentSettings, ...project.documentSettings };
  const notes: { number: number; id: string; text: string; parts: Inline[] }[] =
    [];
  const numberById = new Map<string, number>();
  const inline = (node: JSONContent): Inline[] => {
    if (node.type === "footnoteReference") {
      const id = String(node.attrs?.id ?? "");
      let number = numberById.get(id);
      if (!number) {
        number = numberById.size + 1;
        numberById.set(id, number);
        const n = data.footnotes.find((n) => n.id === id);
        if (!n)
          throw new Error(
            "A footnote reference has no matching note. Restore the note before exporting.",
          );
        notes.push({
          id,
          number,
          text: footnoteText(n, data, context[id]?.form, context[id]?.locator),
          parts: footnoteParts(n, data, context[id]?.form, context[id]?.locator).map((p) => ({
            text: p.text,
            italic: p.italic,
          })),
        });
      }
      return [{ text: String(number), superscript: true, footnote: number }];
    }
    if (node.type === "hardBreak") return [{ text: "", lineBreak: true }];
    if (node.type === "text")
      return [
        {
          text: node.text ?? "",
          bold: node.marks?.some((m) => m.type === "bold"),
          italic: node.marks?.some((m) => m.type === "italic"),
          underline: node.marks?.some((m) => m.type === "underline"),
          strike: node.marks?.some((m) => m.type === "strike"),
          link: node.marks?.find((m) => m.type === "link")?.attrs?.href,
          fontFamily:
            node.marks?.find((m) => m.type === "textFormat")?.attrs
              ?.fontFamily ?? undefined,
          fontSize:
            parseFloat(
              node.marks?.find((m) => m.type === "textFormat")?.attrs?.fontSize,
            ) || undefined,
        },
      ];
    return (node.content ?? []).flatMap(inline);
  };
  const blocks: Block[] = [];
  let nextListId = 0;
  const paperWidth = project.pageLayout?.paper === "a4" ? 595.28 : 612,
    paperHeight = project.pageLayout?.paper === "a4" ? 841.89 : 792;
  const textWidth = paperWidth - settings.marginInches * 144,
    textHeight = paperHeight - settings.marginInches * 144;
  const cellPadding = 6;
  const imageBlock = (node: JSONContent, maxWidth: number): Block => {
    const assetId = String(node.attrs?.assetId ?? "");
    const asset = assets.get(assetId);
    if (!asset)
      throw new Error(
        `An image is missing from this export (asset ${assetId.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
      );
    const positive = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
    const ratio = asset.meta.height / asset.meta.width;
    let w = positive(node.attrs?.width);
    let h = positive(node.attrs?.height);
    if (w && !h) h = w * ratio;
    else if (!w && h) w = h / ratio;
    else if (!w || !h) {
      w = asset.meta.width;
      h = asset.meta.height;
    }
    // Display pixels to points, then shrink (never enlarge) to fit.
    w *= 0.75;
    h *= 0.75;
    const scale = Math.min(1, maxWidth / w, textHeight / h);
    return {
      kind: "image",
      runs: [],
      image: {
        assetId,
        bytes: asset.bytes,
        mime: asset.meta.mime,
        width: w * scale,
        height: h * scale,
        alt: String(node.attrs?.alt ?? ""),
      },
    };
  };
  const visit = (
    node: JSONContent,
    prefix = "",
    list?: ListInfo,
    out: Block[] = blocks,
    maxWidth: number = textWidth,
  ) => {
    if (node.type === "image") {
      out.push(imageBlock(node, maxWidth));
      return;
    }
    if (node.type === "table") {
      const rows = node.content ?? [];
      const columns = Math.max(1, ...rows.map((r) => (r.content ?? []).length));
      const cellWidth = maxWidth / columns - cellPadding * 2;
      out.push({
        kind: "table",
        runs: [],
        table: {
          columns,
          rows: rows.map((row) =>
            (row.content ?? []).map((cell) => {
              const cellBlocks: Block[] = [];
              (cell.content ?? []).forEach((n) =>
                visit(n, "", undefined, cellBlocks, cellWidth),
              );
              return { header: cell.type === "tableHeader", blocks: cellBlocks };
            }),
          ),
        },
      });
      return;
    }
    if (["paragraph", "heading", "codeBlock"].includes(node.type ?? "")) {
      out.push({
        kind: node.type!,
        level: node.attrs?.level,
        align: node.attrs?.textAlign,
        lineHeight: parseFloat(node.attrs?.lineHeight) || undefined,
        spaceBefore: points(node.attrs?.spaceBefore),
        indentLeft: points(node.attrs?.indentLeft),
        indentRight: points(node.attrs?.indentRight),
        firstLineIndent: points(node.attrs?.firstLineIndent),
        spaceAfter: points(node.attrs?.spaceAfter),
        style: node.attrs?.paragraphStyle ?? node.attrs?.screenplayStyle,
        list,
        runs: [...(prefix ? [{ text: prefix }] : []), ...inline(node)],
      });
      return;
    }
    if (node.type === "pageBreak") {
      out.push({ kind: "pageBreak", runs: [] });
      return;
    }
    if (node.type === "horizontalRule") {
      out.push({ kind: "paragraph", runs: [{ text: "--" }] });
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      // One numbering instance per source list, so Word continues 7, 8, 9
      // instead of restarting the start value on every item's paragraph.
      const id = nextListId++;
      const level = (list?.level ?? -1) + 1;
      const start = Number(node.attrs?.start ?? 1);
      (node.content ?? []).forEach((child, i) =>
        (child.content ?? []).forEach((p) =>
          visit(
            p,
            "",
            {
              kind: node.type === "bulletList" ? "bullet" : "ordered",
              level,
              id,
              start,
              number: node.type === "orderedList" ? start + i : undefined,
            },
            out,
            maxWidth,
          ),
        ),
      );
      return;
    }
    (node.content ?? []).forEach((n) => visit(n, prefix, list, out, maxWidth));
  };
  // Same title set as the Markdown export. The Chicago template leaves the
  // project title to the writer's own first page; empty titles add nothing.
  const titleBlock = (title: string, level: number): Block[] =>
    title.trim() ? [{ kind: "heading", level, runs: [{ text: title }] }] : [];
  if (project.templateId !== "chicago")
    blocks.push(...titleBlock(project.title, 1));
  for (const id of project.order) {
    const e = project.entries.find((e) => e.id === id && e.kind === "section");
    if (e) {
      // On Chicago the first section is the title page, so it carries no heading.
      if (!(project.templateId === "chicago" && id === project.order[0]))
        blocks.push(...titleBlock(e.title, 2));
      visit(e.content);
    }
    if (project.templateId === "chicago" && id === project.order[0])
      blocks.push({ kind: "pageBreak", runs: [] });
  }
  return {
    blocks,
    notes,
    settings,
    bibliography: settings.bibliography
      ? bibliographyItems(project, settings)
      : ([] as BibliographyItem[]),
  };
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const safeFilename = (title: string) =>
  title.replace(/[\\/:*?"<>|]/g, "_").trim() || "Document";

export async function saveExport(blob: Blob, name: string) {
  if (isTauri()) {
    const path = await save({
      defaultPath: name,
      filters: [
        {
          name: name.endsWith(".pdf") ? "PDF" : name.endsWith(".md") ? "Markdown" : name.endsWith(".txt") ? "Plain text" : "Word document",
          extensions: [name.split(".").at(-1)!],
        },
      ],
    });
    if (!path) return false;
    await invoke("export_bytes", {
      path,
      data: Array.from(new Uint8Array(await blob.arrayBuffer())),
    });
    return true;
  }
  downloadBlob(blob, name);
  return true;
}
