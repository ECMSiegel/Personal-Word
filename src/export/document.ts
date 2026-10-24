import type { JSONContent } from "@tiptap/react";
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Project } from "../model";
import {
  bibliography,
  footnoteText,
  footnoteParts,
} from "../research/citations";
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
export type Block = {
  runs: Inline[];
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
export function documentBlocks(project: ExportProject) {
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
  const visit = (
    node: JSONContent,
    prefix = "",
    list?: ListInfo,
  ) => {
    if (["paragraph", "heading", "codeBlock"].includes(node.type ?? "")) {
      blocks.push({
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
      blocks.push({ kind: "pageBreak", runs: [] });
      return;
    }
    if (node.type === "horizontalRule") {
      blocks.push({ kind: "paragraph", runs: [{ text: "--" }] });
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
          visit(p, "", {
            kind: node.type === "bulletList" ? "bullet" : "ordered",
            level,
            id,
            start,
            number: node.type === "orderedList" ? start + i : undefined,
          }),
        ),
      );
      return;
    }
    (node.content ?? []).forEach((n) => visit(n, prefix, list));
  };
  for (const id of project.order) {
    const e = project.entries.find((e) => e.id === id && e.kind === "section");
    if (e) visit(e.content);
    if (project.templateId === "chicago" && id === project.order[0])
      blocks.push({ kind: "pageBreak", runs: [] });
  }
  return {
    blocks,
    notes,
    settings,
    bibliography: settings.bibliography
      ? bibliography({
          ...data,
          sources: data.sources.filter((source) =>
            notes.some(
              (note) =>
                data.footnotes.find((n) => n.id === note.id)?.sourceId ===
                source.id,
            ),
          ),
        })
      : [],
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
