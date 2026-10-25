import { describe, expect, it } from "vitest";
import { newProject } from "../model";
import { parseManuscript } from "../import/manuscript";
import { documentBlocks, type ExportProject } from "./document";
import { projectMarkdown, projectPlainText } from "./textExport";
import { JPG_ID, PNG_ID, cell, image, imageAssets, note, para, table, text } from "./media-fixtures";

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

  it("uses the same opt-in Ibid. context as document export", () => {
    const p = fixture();
    p.research!.footnotes = ["4", "4", "9"].map((locator, i) => ({ id: `n${i}`, text: "", sourceId: "source", locator }));
    p.research!.citationPolicy = { scope: "manuscript", repeats: "ibid" };
    p.entries[0].content = {
      type: "doc",
      content: ["n0", "n1", "n2"].map((id) => ({ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id } }] })),
    };
    const output = projectMarkdown(p);
    expect(output).toContain("[^2]: Ibid.\n");
    expect(output).toContain("[^3]: Ibid., 9.");
    expect(projectPlainText(p)).toContain("Ibid., 9.");
  });
  it("restarts full Markdown citations per section only under section scope", () => {
    const p = fixture();
    p.research!.footnotes = [{ id: "note", text: "", sourceId: "source", locator: "4" }, { id: "later", text: "", sourceId: "source", locator: "9" }];
    p.entries.push({ ...p.entries[0], id: "later-section", title: "Later", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "footnoteReference", attrs: { id: "later" } }] }] } });
    p.order.push("later-section");
    p.research!.citationPolicy = { scope: "manuscript", repeats: "ibid" };
    expect(projectMarkdown(p)).toContain("[^2]: Ibid., 9.");
    p.research!.citationPolicy = { scope: "section", repeats: "ibid" };
    expect(projectMarkdown(p)).toContain("[^2]: Ada Writer, A Useful Book (Press, 2024), 9.");
    expect(projectPlainText(p)).toContain("Ada Writer, A Useful Book (Press, 2024), 9.");
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
    expect(output).toMatch(/4\. item\n\n   second paragraph\n\n   - nested/);
    expect(output).toContain("second paragraph");
    expect(plain).toContain("second paragraph");
    expect(output).toContain("> quoted");
    expect(output).toContain("````\nliteral *code* ```\n````");
    expect(output).toContain("```` dangerous ``` ````");
    expect(output).toContain("---");
  });

  it("indents nested Markdown lists by the parent marker width", () => {
    const p = fixture();
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "orderedList", attrs: { start: 10 }, content: [{
            type: "listItem", content: [
              { type: "paragraph", content: [{ type: "text", text: "parent" }] },
              { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "child" }] }] }] },
            ],
          }],
        },
        {
          type: "orderedList", attrs: { start: 1 }, content: [{
            type: "listItem", content: [
              { type: "paragraph", content: [{ type: "text", text: "first" }] },
              { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "nested first" }] }] }] },
            ],
          }],
        },
      ],
    };

    expect(projectMarkdown(p)).toContain("10. parent\n\n    - child");
    expect(projectMarkdown(p)).toContain("1. first\n\n   - nested first");
  });

  it("escapes literal line-leading Markdown list and quote markers in prose", () => {
    const p = fixture();
    p.entries[0].content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "- literal bullet\n+ literal plus\n> literal quote\n>literal quote without a space\n>\n12. literal number" }] }],
    };

    const output = projectMarkdown(p);
    expect(output).toContain("\\- literal bullet\n\\+ literal plus\n\\> literal quote\n\\>literal quote without a space\n\\>\n12\\. literal number");
    const imported = parseManuscript(output, "literal-markers.md");
    const nodeTypes = (node: { type?: string; content?: Array<{ type?: string; content?: unknown[] }> }): string[] => [
      ...(node.type ? [node.type] : []),
      ...(node.content ?? []).flatMap((child) => nodeTypes(child as { type?: string; content?: Array<{ type?: string; content?: unknown[] }> })),
    ];
    expect(nodeTypes(imported.entries[0].content)).not.toEqual(expect.arrayContaining(["bulletList", "orderedList", "blockquote"]));
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

  it("does not add a page prefix to already prefixed research locators", () => {
    const p = fixture();
    p.research!.notes = [
      { id: "page", kind: "quote", text: "Page", sourceId: "source", locator: "p. 12" },
      { id: "pages", kind: "quote", text: "Pages", sourceId: "source", locator: "pp. 12–14" },
      { id: "chapter", kind: "quote", text: "Chapter", sourceId: "source", locator: "ch. 3" },
    ];

    for (const output of [projectMarkdown(p), projectPlainText(p)]) {
      expect(output).toContain("— A Useful Book, p. 12");
      expect(output).toContain("— A Useful Book, pp. 12–14");
      expect(output).toContain("— A Useful Book, ch. 3");
      expect(output).not.toMatch(/(?:p\. p\.|p\. ch\.)/);
    }
  });

  it("indents continuation paragraphs of multi-paragraph footnote definitions by 4 spaces", () => {
    const p = fixture();
    p.research!.footnotes = [
      { id: "note", text: "First paragraph.\n\nSecond paragraph.\nLine 2 of second paragraph.\n\nThird paragraph." },
    ];
    const output = projectMarkdown(p);
    expect(output).toContain(
      "[^1]: First paragraph.\n\n    Second paragraph.\n    Line 2 of second paragraph.\n\n    Third paragraph."
    );
  });

  it("escapes special markdown characters across continuation lines in multi-paragraph footnotes", () => {
    const p = fixture();
    p.research!.footnotes = [
      { id: "note", text: "Para 1.\n\n*italic* and [link]\n> quote line\n- list item" },
    ];
    const output = projectMarkdown(p);
    expect(output).toContain(
      "[^1]: Para 1.\n\n    \\*italic\\* and \\[link\\]\n    \\> quote line\n    \\- list item"
    );
  });

  it("round-trips multi-paragraph footnotes through export and manuscript re-import", () => {
    const p = fixture();
    const second = {
      ...p.entries[0],
      id: "second",
      title: "Section Two",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Second section claim" },
              { type: "footnoteReference", attrs: { id: "note2" } },
            ],
          },
        ],
      },
    };
    p.entries.push(second);
    p.order.push(second.id);
    p.research!.footnotes = [
      { id: "note", text: "Note one para 1.\n\nNote one para 2 continuation." },
      { id: "note2", text: "Note two single paragraph." },
    ];
    const output = projectMarkdown(p);
    const imported = parseManuscript(output, "draft.md");
    expect(imported.research?.footnotes).toHaveLength(2);
    expect(imported.research?.footnotes[0].text).toBe("Note one para 1.\n\nNote one para 2 continuation.");
    expect(imported.research?.footnotes[1].text).toBe("Note two single paragraph.");
    expect(imported.entries[0].text).not.toContain("Note one para 2 continuation.");
  });
});

describe("images and tables in text exports", () => {
  function media(): ExportProject {
    const p = fixture();
    p.research!.footnotes = [
      { id: "a", text: "Note A." },
      { id: "b", text: "Note B." },
    ];
    p.entries[0].content = {
      type: "doc",
      content: [
        para(text("Before"), note("a")),
        image(PNG_ID, { title: 'Say "hi"' }),
        image(JPG_ID, { alt: "Plain [chart]" }),
        table(
          [cell("tableHeader", para(text("Name"))), cell("tableHeader", para(text("A|B")))],
          [
            cell("tableCell", para(text("one"), note("b")), para(text("two"))),
            cell("tableCell", para(text("x"), { type: "hardBreak" }, text("y"))),
          ],
        ),
      ],
    };
    return p;
  }
  it("writes Markdown image links and a GitHub pipe table with escaped pipes and <br> joins", () => {
    const md = projectMarkdown(media(), imageAssets());
    expect(md).toContain(`![A red pixel](assets/${PNG_ID}.png "Say \\"hi\\"")`);
    expect(md).toContain(`![Plain \\[chart\\]](assets/${JPG_ID}.jpg)`);
    expect(md).toContain("| Name | A\\|B |\n| --- | --- |\n| one[^2]<br>two | x<br>y |");
    expect(md).toContain("[^1]: Note A.");
    expect(md).toContain("[^2]: Note B.");
  });
  it("writes plain-text image placeholders and tab-separated rows", () => {
    const txt = projectPlainText(media(), imageAssets());
    expect(txt).toContain("[Image: A red pixel]");
    expect(txt).toContain("Name\tA|B\none[2] two\tx y");
  });
  it("numbers notes in table cells like the document export", () => {
    const p = media();
    const numbers = documentBlocks(p, imageAssets()).notes.map((n) => n.id);
    expect(numbers).toEqual(["a", "b"]);
    expect(projectMarkdown(p, imageAssets()).indexOf("[^2]")).toBeGreaterThan(-1);
  });
  it("throws when an image asset is missing instead of dropping it", () => {
    expect(() => projectMarkdown(media())).toThrow("An image is missing");
    expect(() => projectPlainText(media())).toThrow("An image is missing");
  });
});
