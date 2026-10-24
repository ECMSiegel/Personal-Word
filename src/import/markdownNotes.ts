import type { JSONContent } from "@tiptap/react";
import type { Footnote } from "../research/types";

/**
 * Markdown footnote import.
 *
 * Usage from the Markdown importer:
 *   const notes = parseMarkdownNotes(text, (md) => markdownDocument(md, warnings));
 * `notes.document` has footnoteReference nodes, `notes.footnotes` are the matching records.
 *
 * Two steps are exposed so the importer controls its own Markdown conversion:
 * prepareMarkdownNotes() removes definitions and swaps each reference for an invisible
 * placeholder, then finish(document) turns placeholders into footnoteReference nodes.
 */
export type MarkdownNotesResult = { document: JSONContent; footnotes: Footnote[]; warnings: string[] };
export type PreparedMarkdownNotes = { markdown: string; finish: (document: JSONContent) => MarkdownNotesResult };

const DEFINITION = /^ {0,3}\[\^([A-Za-z0-9_-]+)\]:[ \t]*(.*)$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const NOTES_HEADING = /^ {0,3}#{1,6}[ \t]+Notes[ \t]*#*[ \t]*$/i;
const INDENT = /^(?: {4}|\t)/;
const REFERENCE = /\[\^([A-Za-z0-9_-]+)\]/g;

type BodyLine = { text: string; code: boolean; removed: boolean };
type Definition = { label: string; line: number; text: string; raw: string[]; referenced: boolean };

const unescapeMarkdown = (value: string) => value.replace(/\\([!-/:-@[-`{-~])/g, "$1");

function oddBackslashesBefore(text: string, at: number) {
  let count = 0;
  while (at - count - 1 >= 0 && text[at - count - 1] === "\\") count++;
  return count % 2 === 1;
}

/** Character ranges of inline code spans inside one paragraph. */
function inlineCodeSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  const runs = [...text.matchAll(/`+/g)].map((m) => ({ at: m.index!, len: m[0].length }));
  for (let i = 0; i < runs.length; i++) {
    const open = runs[i];
    if (oddBackslashesBefore(text, open.at)) continue;
    const closeAt = runs.findIndex((run, j) => j > i && run.len === open.len);
    if (closeAt < 0) continue;
    spans.push([open.at, runs[closeAt].at + runs[closeAt].len]);
    i = closeAt;
  }
  return spans;
}

function pickSentinel(text: string) {
  for (let code = 0xe000; code <= 0xf8ff; code++) {
    const char = String.fromCharCode(code);
    if (!text.includes(char)) return char;
  }
  throw new Error("This Markdown uses every private character; footnotes cannot be imported.");
}

export function prepareMarkdownNotes(source: string): PreparedMarkdownNotes {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const warnings: string[] = [];
  const body: BodyLine[] = [];
  const definitions = new Map<string, Definition>();
  const duplicates: Definition[] = [];

  // Pass 1: split into code lines, definitions (removed) and ordinary lines.
  let fence: { char: string; length: number } | null = null;
  let previous: "start" | "blank" | "text" | "indentedCode" = "start";
  let listContext = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      body.push({ text: line, code: true, removed: false });
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = line.match(FENCE_OPEN);
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      fence = { char: open[1][0], length: open[1].length };
      body.push({ text: line, code: true, removed: false });
      previous = "text";
      continue;
    }
    if (!line.trim()) {
      body.push({ text: line, code: false, removed: false });
      if (previous !== "indentedCode") previous = "blank";
      continue;
    }
    if (INDENT.test(line) && (previous === "blank" || previous === "start" || previous === "indentedCode") && !listContext) {
      body.push({ text: line, code: true, removed: false });
      previous = "indentedCode";
      continue;
    }
    const def = DEFINITION.exec(line);
    if (def) {
      const raw: string[] = [];
      let paragraph: string[] = def[2].trim() ? [def[2].trim()] : [];
      let afterBlank = false;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const next = lines[j];
        if (!next.trim()) {
          let k = j + 1;
          while (k < lines.length && !lines[k].trim()) k++;
          if (k < lines.length && INDENT.test(lines[k])) { afterBlank = true; j = k - 1; continue; }
          break;
        }
        if (INDENT.test(next)) {
          const content = next.replace(INDENT, "").trim();
          if (afterBlank) { if (paragraph.length) raw.push(paragraph.join(" ")); paragraph = []; afterBlank = false; }
          paragraph.push(content);
        } else if (!afterBlank && !DEFINITION.test(next) && !FENCE_OPEN.test(next) && !HEADING.test(next) && !LIST_ITEM.test(next) && !/^ {0,3}>/.test(next)) {
          paragraph.push(next.trim());
        } else break;
      }
      if (paragraph.length) raw.push(paragraph.join(" "));
      const entry: Definition = { label: def[1], line: i, raw, text: raw.map(unescapeMarkdown).join("\n\n"), referenced: false };
      if (definitions.has(entry.label)) {
        duplicates.push(entry);
        warnings.push(`Note [^${entry.label}] is defined more than once; the first definition was used and the later one was kept as text.`);
      } else definitions.set(entry.label, entry);
      for (let r = i; r < j; r++) body.push({ text: "", code: false, removed: true });
      i = j - 1;
      previous = "blank";
      continue;
    }
    body.push({ text: line, code: false, removed: false });
    previous = "text";
    if (!INDENT.test(line)) listContext = LIST_ITEM.test(line);
  }

  // Pass 2: replace references in ordinary paragraphs, skipping inline code and escapes.
  const sentinel = pickSentinel(source);
  const placeholder = new RegExp(`${sentinel}(\\d+)${sentinel}`, "g");
  const footnotes: Footnote[] = [];
  const noteLabels: string[] = [];
  const undefinedLabels = new Set<string>();
  let start = 0;
  const flush = (end: number) => {
    if (end > start) {
      const text = body.slice(start, end).map((l) => l.text).join("\n");
      const spans = inlineCodeSpans(text);
      const replaced = text.replace(REFERENCE, (match, label: string, at: number) => {
        if (oddBackslashesBefore(text, at) || spans.some(([from, to]) => at >= from && at < to)) return match;
        const definition = definitions.get(label);
        if (!definition) { undefinedLabels.add(label); return match; }
        definition.referenced = true;
        let index = noteLabels.indexOf(label);
        if (index < 0) { index = noteLabels.length; noteLabels.push(label); footnotes.push({ id: crypto.randomUUID(), text: definition.text }); }
        return `${sentinel}${index}${sentinel}`;
      });
      replaced.split("\n").forEach((text, i) => { body[start + i].text = text; });
    }
    start = end + 1;
  };
  body.forEach((line, i) => { if (line.code || line.removed || !line.text.trim()) flush(i); });
  flush(body.length);
  for (const label of undefinedLabels) warnings.push(`Note reference [^${label}] has no definition and was kept as text.`);

  // An exported "Notes" heading that held only definitions would be left empty.
  body.forEach((line, i) => {
    if (line.code || line.removed || !NOTES_HEADING.test(line.text)) return;
    let removedAny = false;
    for (let j = i + 1; j < body.length; j++) {
      const next = body[j];
      if (!next.code && !next.removed && HEADING.test(next.text)) break;
      if (next.removed) removedAny = true;
      else if (next.code || next.text.trim()) return;
    }
    if (removedAny) { line.removed = true; line.text = ""; }
  });

  // Unused and repeated definitions are never dropped: they come back as visible text.
  const leftovers = [...definitions.values()].filter((d) => !d.referenced);
  for (const d of leftovers) warnings.push(`Note [^${d.label}] is defined but never referenced; it was kept as text.`);
  const literals = [...leftovers, ...duplicates].sort((a, b) => a.line - b.line);
  const output = body.filter((l) => !l.removed).map((l) => l.text);
  for (const d of literals) output.push("", `[^${d.label}]: ${d.raw[0] ?? ""}`, ...d.raw.slice(1).flatMap((p) => ["", p]));

  const finish = (document: JSONContent): MarkdownNotesResult => {
    const used = new Set<number>();
    const restore = (node: JSONContent, inCode: boolean): JSONContent[] => {
      if (node.type === "text" && node.text) {
        const literal = inCode || Boolean(node.marks?.some((m) => m.type === "code"));
        const pieces: JSONContent[] = [];
        let last = 0;
        const push = (text: string) => { if (text) pieces.push({ ...node, text }); };
        for (const m of node.text.matchAll(placeholder)) {
          const index = Number(m[1]);
          push(node.text.slice(last, m.index));
          if (literal) push(`[^${noteLabels[index]}]`);
          else { used.add(index); pieces.push({ type: "footnoteReference", attrs: { id: footnotes[index].id } }); }
          last = m.index! + m[0].length;
        }
        push(node.text.slice(last));
        return pieces;
      }
      if (!node.content) return [node];
      const code = inCode || node.type === "codeBlock";
      return [{ ...node, content: node.content.flatMap((child) => restore(child, code)) }];
    };
    const result = restore(document, false)[0];
    const kept = footnotes.filter((_, i) => used.has(i));
    const finalWarnings = [...warnings];
    if (kept.length < footnotes.length) finalWarnings.push("A note reference could not be placed in the imported text and was dropped.");
    return { document: result, footnotes: kept, warnings: finalWarnings };
  };
  return { markdown: output.join("\n"), finish };
}

export function parseMarkdownNotes(markdown: string, toDocument: (markdown: string) => JSONContent): MarkdownNotesResult {
  const prepared = prepareMarkdownNotes(markdown);
  return prepared.finish(toDocument(prepared.markdown));
}
