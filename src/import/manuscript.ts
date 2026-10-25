import MarkdownIt, { type Token } from "markdown-it";
import { newProject, textOf, validateProject, type Project } from "../model";
import { emptyResearch } from "../research/types";
import { parseMarkdownNotes } from "./markdownNotes";
import type { JSONContent } from "@tiptap/react";

export const MAX_MANUSCRIPT_BYTES = 5 * 1024 * 1024;
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).disable("table");
export type ManuscriptPreview = { project: Project; warnings: string[]; format: "Markdown" | "Plain text"; filename: string };
export function manuscriptTitle(filename: string) {
  return filename.replace(/\.(txt|md|markdown)$/i, "").trim() || "Imported writing";
}
/** Last matching index; avoids a runtime dependency on Array.prototype.findLastIndex. */
function lastIndexWhere(items: readonly { type: string }[], match: (type: string) => boolean) {
  for (let at = items.length - 1; at >= 0; at--) if (match(items[at].type)) return at;
  return -1;
}
function markdownDocument(text: string, warnings: Set<string>): JSONContent {
  const marks: Record<string, string> = { strong: "bold", em: "italic", s: "strike" };
  function inline(tokens: Token[]): JSONContent[] {
    const result: JSONContent[] = [];
    const active: { type: string; attrs?: Record<string, unknown> }[] = [];
    const pushText = (value: string, extra?: { type: string }) => {
      if (value) result.push({ type: "text", text: value, marks: [...active, ...(extra ? [extra] : [])] });
    };
    for (const t of tokens) {
      const kind = t.type.replace(/_(open|close)$/, "");
      if (marks[kind] && t.nesting) {
        if (t.nesting === 1) active.push({ type: marks[kind] });
        else { const at = lastIndexWhere(active, (type) => type === marks[kind]); if (at >= 0) active.splice(at, 1); }
      } else if (t.type === "link_open") {
        const href = String(t.attrGet("href") ?? "");
        if (/^(https?:|mailto:)/i.test(href)) active.push({ type: "link", attrs: { href, title: t.attrGet("title") } });
        else { active.push({ type: "unsupportedLink" }); warnings.add("Relative or unsupported links are retained as text."); }
      } else if (t.type === "link_close") {
        const at = lastIndexWhere(active, (type) => type === "link" || type === "unsupportedLink");
        if (at >= 0) active.splice(at, 1);
      } else if (t.type === "image") {
        pushText(`![${t.content}](${t.attrGet("src") ?? ""})`);
        warnings.add("Images are retained as Markdown text; no image is fetched.");
      } else if (t.type === "hardbreak" || t.type === "softbreak") result.push({ type: "hardBreak" });
      else if (t.type === "code_inline") pushText(t.content, { type: "code" });
      else if (t.type === "text" || t.type === "html_inline") pushText(t.content);
      else if (t.content) { pushText(t.content); warnings.add("Unsupported content is retained as text."); }
    }
    return result.map((n) => n.marks ? { ...n, marks: n.marks.filter((m) => m.type !== "unsupportedLink") } : n);
  }
  const doc: JSONContent = { type: "doc", content: [] };
  const stack: JSONContent[] = [doc];
  const add = (node: JSONContent) => stack.at(-1)!.content!.push(node);
  const types: Record<string, string> = { paragraph: "paragraph", heading: "heading", bullet_list: "bulletList", ordered_list: "orderedList", list_item: "listItem", blockquote: "blockquote" };
  for (const token of markdown.parse(text, {})) {
    const kind = token.type.replace(/_(open|close)$/, "");
    if (types[kind] && token.nesting === 1) {
      const node: JSONContent = { type: types[kind], content: [] };
      if (kind === "heading") node.attrs = { level: Number(token.tag.slice(1)) };
      if (kind === "ordered_list") node.attrs = { start: Number(token.attrGet("start") ?? 1) };
      add(node); stack.push(node);
    } else if (types[kind] && token.nesting === -1) stack.pop();
    else if (token.type === "inline") stack.at(-1)!.content!.push(...inline(token.children ?? []));
    else if (token.type === "fence" || token.type === "code_block") add({ type: "codeBlock", attrs: { language: token.info.split(/\s/)[0] || null }, content: token.content ? [{ type: "text", text: token.content }] : [] });
    else if (token.type === "hr") add({ type: "horizontalRule" });
    else if (token.content) { add({ type: "paragraph", content: [{ type: "text", text: token.content }] }); warnings.add("Unsupported content is retained as text."); }
  }
  if (!doc.content?.length) doc.content = [{ type: "paragraph" }];
  if (/<\/?[a-z][^>]*>/i.test(text)) warnings.add("HTML is retained as literal text and is never executed.");
  if (/^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m.test(text)) warnings.add("Tables are retained as literal Markdown text.");
  return doc;
}
function inspectText(text: string, filename: string): ManuscriptPreview {
  const warnings = new Set<string>();
  const project = newProject(manuscriptTitle(filename));
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const isMarkdown = /\.(md|markdown)$/i.test(filename);
  if (isMarkdown) {
    const notes = parseMarkdownNotes(normalized, (md) => markdownDocument(md, warnings));
    project.entries[0].content = notes.document;
    if (notes.footnotes.length > 0) {
      project.research = { ...(project.research ?? emptyResearch()), footnotes: notes.footnotes };
    }
    for (const warning of notes.warnings) warnings.add(warning);
  } else {
    const paragraphs: JSONContent[] = normalized.split(/\n\s*\n/).map((p) => ({
      type: "paragraph", content: p ? p.split("\n").flatMap((line, i) => [...(i ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : [])]) : [],
    }));
    project.entries[0].content = { type: "doc", content: paragraphs };
  }
  project.entries[0].text = textOf(project.entries[0].content);
  validateProject(project);
  return { project, warnings: [...warnings], format: isMarkdown ? "Markdown" : "Plain text", filename };
}
export function parseManuscript(text: string, filename: string): Project { return inspectText(text, filename).project; }
export function previewManuscript(bytes: ArrayBuffer, filename: string): ManuscriptPreview {
  if (bytes.byteLength > MAX_MANUSCRIPT_BYTES) throw new Error("Manuscripts must be 5 MB or smaller.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("This file is not valid UTF-8 text."); }
  return inspectText(text, filename);
}
export function decodeManuscript(bytes: ArrayBuffer, filename: string) { return previewManuscript(bytes, filename).project; }
