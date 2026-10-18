import { describe, expect, it } from "vitest";
import { newProject } from "../model";
import { parseManuscript } from "../import/manuscript";
import type { ExportProject } from "./document";
import { projectMarkdown, projectPlainText } from "./textExport";

function fixture(): ExportProject {
  const p = newProject("Research draft");
  const first = p.entries[0];
  first.title = "Introduction";
  first.content = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Opening" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "A claim" },
          { type: "footnoteReference", attrs: { id: "note" } },
        ],
      },
    ],
  };
  p.research = {
    sources: [{ id: "source", kind: "book", title: "A Useful Book", authors: ["Ada Writer"], publisher: "Press", year: "2024" }],
    notes: [{ id: "quote", kind: "quote", text: "A captured passage", sourceId: "source", locator: "12" }],
    footnotes: [{ id: "note", text: "A note." }],
  };
  return p;
}

describe("whole-project text exports", () => {
  it("exports sections in order with titles and numbered notes", () => {
    const p = fixture();
    const second = { ...p.entries[0], id: "second", title: "Conclusion", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Closing" }] }] } };
    p.entries.push(second);
    p.order.push(second.id);
    const output = projectMarkdown(p);
    expect(output.indexOf("## Introduction")).toBeLessThan(output.indexOf("## Conclusion"));
    expect(output).toContain("[^1]");
    expect(output).toContain("[^1]: A note.");
    expect(output).toContain("## Opening");
  });

  it("uses automatic short notes with the same first-appearance numbering as document export", () => {
    const p = fixture();
    p.research!.sources[0].title = "Research and Writing: A Practical Guide";
    p.research!.footnotes = [
      { id: "first", text: "See", sourceId: "source", locator: "4" },
      { id: "second", text: "Compare", sourceId: "source", locator: "9" },
    ];
    p.research!.autoShortNotes = true;
    p.entries[0].content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "first" } }] },
        { type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "second" } }] },
      ],
    };
    const output = projectMarkdown(p);
    expect(output).toContain("[^1]");
    expect(output).toContain("[^2]");
    expect(output).toContain("[^1]: See Ada Writer, Research and Writing: A Practical Guide (Press, 2024), 4");
    expect(output).toContain("[^2]: Compare Writer, Research and Writing, 9.");
  });

  it("escapes Markdown characters in section titles so one heading survives re-import", () => {
    const p = fixture();
    p.entries[0].title = "#1 [draft] *notes*";
    const output = projectMarkdown(p);
    const imported = parseManuscript(output, "draft.md");
    const headings = imported.entries[0].content.content?.filter((node) => node.type === "heading") ?? [];
    const matching = headings.filter((node) => node.content?.map((child) => child.text ?? "").join("") === "#1 [draft] *notes*");
    expect(matching).toHaveLength(1);
  });

  it("includes bibliography, fragments, and research notes", () => {
    const p = fixture();
    p.research!.footnotes[0].sourceId = "source";
    p.entries.push({ ...p.entries[0], id: "frag", kind: "fragment", title: "Loose thought", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Fragment prose" }] }] } });
    const output = projectMarkdown(p);
    expect(output).toContain("## Bibliography");
    expect(output).toContain("Writer, Ada");
    expect(output).toContain("## Fragments");
    expect(output).toContain("Fragment prose");
    expect(output).toContain("## Research notes");
    expect(output).toContain("> A captured passage");
    expect(output).toContain("p. 12");
  });

  it("serializes rich text, list nesting, code blocks, block quotes, and page breaks", () => {
    const p = fixture();
    p.entries[0].content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "text", text: " italic", marks: [{ type: "italic" }] },
          { type: "text", text: " struck", marks: [{ type: "strike" }] },
          { type: "text", text: " code", marks: [{ type: "code" }] },
          { type: "text", text: " dangerous ```", marks: [{ type: "code" }] },
          { type: "text", text: " link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        ] },
        { type: "orderedList", attrs: { start: 4 }, content: [{ type: "listItem", content: [
          { type: "paragraph", content: [{ type: "text", text: "item" }] },
          { type: "paragraph", content: [{ type: "text", text: "second paragraph" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }] }] },
        ] }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quoted" }] }] },
        { type: "codeBlock", content: [{ type: "text", text: "literal *code* ```" }] },
        { type: "pageBreak" },
      ],
    };
    const output = projectMarkdown(p);
    const plain = projectPlainText(p);
    expect(output).toContain("**bold** *italic* ~~struck~~ `code` ```` dangerous ``` ```` [link](https://example.com)");
    expect(output).toMatch(/4\. item\n\n  second paragraph\n\n  - nested/);
    expect(output).toContain("second paragraph");
    expect(plain).toContain("second paragraph");
    expect(output).toContain("> quoted");
    expect(output).toContain("````\nliteral *code* ```\n````");
    expect(output).toContain("```` dangerous ``` ````");
    expect(output).toContain("---");
  });

  it("plain text has no Markdown syntax", () => {
    const output = projectPlainText(fixture());
    expect(output).toContain("Research draft");
    expect(output).toContain(`Introduction\n${"-".repeat("Introduction".length)}`);
    expect(output).toContain("[1]");
    expect(output).not.toMatch(/^#{1,6} /m);
    expect(output).not.toContain("**");
    expect(output).not.toContain("[^1]");
    expect(output).not.toMatch(/^> /m);
  });

  it("preserves a fragment-only note reference without renumbering manuscript notes", () => {
    const p = fixture();
    p.research!.footnotes.push({ id: "fragment-note", text: "A fragment-only note." });
    p.entries.push({
      ...p.entries[0], id: "fragment", kind: "fragment", title: "Fragment",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Loose thought" }, { type: "footnoteReference", attrs: { id: "fragment-note" } }] }] },
    });
    const markdown = projectMarkdown(p);
    const plain = projectPlainText(p);
    expect(markdown).toContain("Loose thought[Note: A fragment-only note.]");
    expect(plain).toContain("Loose thought[Note: A fragment-only note.]");
    expect(markdown).toContain("[^1]: A note.");
  });

  it("rejects a dangling note reference inside a fragment", () => {
    const p = fixture();
    p.entries.push({
      ...p.entries[0], id: "fragment", kind: "fragment", title: "Fragment",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "missing" } }] }] },
    });
    expect(() => projectMarkdown(p)).toThrow("matching note");
    expect(() => projectPlainText(p)).toThrow("matching note");
  });

  it("preserves a research note locator when its source record is missing", () => {
    const p = fixture();
    p.research!.notes = [{ id: "orphan-quote", kind: "quote", text: "Quoted words", locator: "23" }];
    expect(projectMarkdown(p)).toContain("> Quoted words\n\n— p. 23");
    expect(projectPlainText(p)).toContain("Quoted words\n— p. 23");
  });
});
