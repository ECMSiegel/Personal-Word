import MarkdownIt from "markdown-it";
import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";
import { newProject } from "../model";
import type { ExportProject } from "../export/document";
import { projectMarkdown } from "../export/textExport";
import { parseMarkdownNotes, prepareMarkdownNotes, type MarkdownNotesResult } from "./markdownNotes";

// Small stand-in for the importer's Markdown conversion: blocks of text, code spans and code blocks.
function toDocument(markdown: string): JSONContent {
  const content: JSONContent[] = [];
  let block: JSONContent | null = null;
  for (const token of new MarkdownIt({ html: false }).parse(markdown, {})) {
    if (token.type === "paragraph_open" || token.type === "heading_open") {
      block = { type: token.type === "heading_open" ? "heading" : "paragraph", attrs: token.type === "heading_open" ? { level: Number(token.tag.slice(1)) } : undefined, content: [] };
      content.push(block);
    } else if (token.type === "inline" && block) {
      for (const child of token.children ?? []) {
        if (child.type === "text") block.content!.push({ type: "text", text: child.content });
        else if (child.type === "code_inline") block.content!.push({ type: "text", text: child.content, marks: [{ type: "code" }] });
        else if (child.type === "softbreak") block.content!.push({ type: "hardBreak" });
      }
    } else if (token.type === "fence" || token.type === "code_block") content.push({ type: "codeBlock", content: [{ type: "text", text: token.content }] });
  }
  return { type: "doc", content };
}

/** One string per block; a note reference prints as <n>, n being its 1-based place in footnotes. */
function flat(result: MarkdownNotesResult): string[] {
  return (result.document.content ?? []).map((block) => (block.content ?? []).map((n) => {
    if (n.type === "footnoteReference") return `<${result.footnotes.findIndex((f) => f.id === n.attrs?.id) + 1}>`;
    return n.type === "text" ? n.text : "\n";
  }).join(""));
}
const parse = (markdown: string) => parseMarkdownNotes(markdown, toDocument);
const texts = (result: MarkdownNotesResult) => result.footnotes.map((f) => f.text);
const refIds = (result: MarkdownNotesResult) => JSON.stringify(result.document).match(/"footnoteReference","attrs":\{"id":"[^"]+"/g) ?? [];

describe("markdown footnote import", () => {
  it("turns references and definitions into unique internal notes", () => {
    const result = parse("Claim[^1] and more[^note-2].\n\n[^1]: First.\n[^note-2]: Second.\n");
    expect(flat(result)).toEqual(["Claim<1> and more<2>."]);
    expect(texts(result)).toEqual(["First.", "Second."]);
    expect(new Set(result.footnotes.map((f) => f.id)).size).toBe(2);
    expect(result.footnotes.every((f) => f.id !== "1" && f.id !== "note-2" && f.sourceId === undefined)).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("finds definitions anywhere and numbers notes by first reference", () => {
    const result = parse("[^b]: Bee.\n\nFirst[^a]\n\n[^a]: Ay.\n\nSecond[^b]\n\nEnd");
    expect(flat(result)).toEqual(["First<1>", "Second<2>", "End"]);
    expect(texts(result)).toEqual(["Ay.", "Bee."]);
  });

  it("reuses one internal note for repeated references", () => {
    const result = parse("One[^x] two[^x]\n\n[^x]: Shared.");
    expect(result.footnotes).toHaveLength(1);
    expect(flat(result)).toEqual(["One<1> two<1>"]);
    expect(refIds(result)).toHaveLength(2);
    expect(new Set(refIds(result)).size).toBe(1);
  });

  it("keeps indented continuation paragraphs, separated by a blank line", () => {
    const result = parse("A[^1]\n\n[^1]: Line one\n    wraps here.\n\n    Second paragraph.\n\n\tThird paragraph.\n\nAfter.");
    expect(texts(result)).toEqual(["Line one wraps here.\n\nSecond paragraph.\n\nThird paragraph."]);
    expect(flat(result)).toEqual(["A<1>", "After."]);
  });

  it("accepts a lazy wrapped line but stops at the next definition", () => {
    const result = parse("A[^1] B[^2]\n\n[^1]: Wrapped\nonto the next line.\n[^2]: Other.");
    expect(texts(result)).toEqual(["Wrapped onto the next line.", "Other."]);
  });

  it("unescapes Markdown escapes in note text", () => {
    expect(texts(parse("A[^1]\n\n[^1]: a \\* b \\[c\\] d\\_e \\\\ f"))).toEqual(["a * b [c] d_e \\ f"]);
  });

  it("leaves references and definitions in code blocks and code spans literal", () => {
    const result = parse("Real[^1] and `code[^1]` here.\n\n```\nfenced[^1]\n[^1]: not a note\n```\n\n~~~\n[^1]: tilde\n~~~\n\n    indented[^1]\n    [^1]: nope\n\n[^1]: Real note.");
    expect(texts(result)).toEqual(["Real note."]);
    expect(flat(result)[0]).toBe("Real<1> and code[^1] here.");
    const code = (result.document.content ?? []).filter((b) => b.type === "codeBlock").map((b) => b.content![0].text);
    expect(code.join("")).toContain("fenced[^1]\n[^1]: not a note");
    expect(code.join("")).toContain("[^1]: tilde");
    expect(code.join("")).toContain("indented[^1]\n[^1]: nope");
    expect(refIds(result)).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat escaped references as notes", () => {
    const result = parse("Literal \\[^1] and real[^1].\n\n[^1]: Note.");
    expect(flat(result)).toEqual(["Literal [^1] and real<1>."]);
    expect(result.footnotes).toHaveLength(1);
  });

  it("keeps undefined references as text and warns", () => {
    const result = parse("Missing[^ghost] note.");
    expect(flat(result)).toEqual(["Missing[^ghost] note."]);
    expect(result.footnotes).toEqual([]);
    expect(result.warnings.join(" ")).toContain("[^ghost]");
  });

  it("keeps unreferenced definitions as visible text and warns", () => {
    const result = parse("Body.\n\n[^lonely]: Nobody cites me.\n    Second line paragraph.");
    expect(result.footnotes).toEqual([]);
    expect(flat(result)).toEqual(["Body.", "[^lonely]: Nobody cites me. Second line paragraph."]);
    expect(result.warnings.join(" ")).toContain("[^lonely]");
  });

  it("makes duplicate definitions explicit: first wins, second stays as text", () => {
    const result = parse("Cite[^d]\n\n[^d]: First wins.\n\n[^d]: Second loses.");
    expect(texts(result)).toEqual(["First wins."]);
    expect(flat(result)).toEqual(["Cite<1>", "[^d]: Second loses."]);
    expect(result.warnings.join(" ")).toMatch(/more than once/);
  });

  it("drops a Notes heading left empty by definitions, but not one with other content", () => {
    expect(flat(parse("Body[^1]\n\n## Notes\n\n[^1]: N."))).toEqual(["Body<1>"]);
    expect(flat(parse("Body[^1]\n\n## Notes\n\nMy own words.\n\n[^1]: N."))).toEqual(["Body<1>", "Notes", "My own words."]);
  });

  it("is not confused by private-use characters already in the text", () => {
    const result = parse(" odd[^1]\n\n[^1]: N.");
    expect(flat(result)).toEqual([" odd<1>"]);
    expect(prepareMarkdownNotes("\uE000[^1]\n\n[^1]: N.").markdown.split("\uE000")).toHaveLength(2);
  });

  it("round-trips notes exported by projectMarkdown", () => {
    const p: ExportProject = newProject("Round trip");
    const ref = (id: string): JSONContent => ({ type: "footnoteReference", attrs: { id } });
    const text = (value: string): JSONContent => ({ type: "text", text: value });
    p.entries[0].title = "One";
    p.entries[0].content = { type: "doc", content: [
      { type: "paragraph", content: [text("First claim"), ref("b"), text(" then more"), ref("a"), text(".")] },
      { type: "paragraph", content: [text("Repeat"), ref("b")] },
    ] };
    p.entries.push({ ...p.entries[0], id: "two", title: "Two", content: { type: "doc", content: [{ type: "paragraph", content: [ref("c"), text(" opens the second section.")] }] } });
    p.order.push("two");
    const notes = [{ id: "a", text: "Alpha with *stars* and [brackets]." }, { id: "b", text: "Bravo_note, 1. numbered?" }, { id: "c", text: "Charlie." }];
    p.research = { sources: [], notes: [], footnotes: notes };

    const exported = projectMarkdown(p);
    expect(exported).toContain("[^1]: ");
    const result = parse(exported);
    expect(result.warnings).toEqual([]);
    // First-appearance order is b, a, c in the export; the import recovers exactly that order.
    expect(texts(result)).toEqual([notes[1].text, notes[0].text, notes[2].text]);
    const paragraphs = flat(result);
    expect(paragraphs).toContain("First claim<1> then more<2>.");
    expect(paragraphs).toContain("Repeat<1>");
    expect(paragraphs).toContain("<3> opens the second section.");
    expect(paragraphs).not.toContain("Notes");
    expect(paragraphs.some((line) => line.startsWith("[^"))).toBe(false);
    expect(result.footnotes).toHaveLength(3);
  });
});
