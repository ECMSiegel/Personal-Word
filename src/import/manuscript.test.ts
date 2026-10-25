import { describe, expect, it } from "vitest";
import { decodeManuscript, parseManuscript, previewManuscript } from "./manuscript";
import { newProject } from "../model";
import { projectMarkdown } from "../export/textExport";

describe("plain manuscript import", () => {
  it("preserves BOM-free Unicode, paragraphs, and single line breaks", () => {
    const p = parseManuscript("First — café\ncontinued.\r\n\r\nSecond.", "Draft.txt");
    expect(p.title).toBe("Draft");
    expect(p.entries[0].text).toBe("First — café\ncontinued.\nSecond.");
    expect(p.entries[0].content.content).toHaveLength(2);
  });
  it("accepts BOM and empty UTF-8 files", () => {
    const empty = decodeManuscript(new TextEncoder().encode("\uFEFF").buffer, "Empty.txt");
    expect(empty.entries[0].text).toBe("");
  });
  it("rejects invalid UTF-8 and overlarge files", () => {
    expect(() => decodeManuscript(new Uint8Array([0xff]).buffer, "bad.txt")).toThrow("UTF-8");
    expect(() => decodeManuscript(new ArrayBuffer(5 * 1024 * 1024 + 1), "big.txt")).toThrow("5 MB");
  });
  it("imports Markdown headings, marks, lists and quoted code as schema-valid writing", () => {
    const p = parseManuscript("# Heading\n\n**Bold** and *italic* and ~~old~~.\n\n4. One\n   - Child\n\n> Quote\n\n```js\nconst n = 1;\n```", "draft.md");
    const nodes = p.entries[0].content.content!;
    expect(nodes[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(nodes[1].content?.[0]).toMatchObject({ text: "Bold", marks: [{ type: "bold" }] });
    expect(nodes[2]).toMatchObject({ type: "orderedList", attrs: { start: 4 } });
    expect(JSON.stringify(nodes)).toContain('"bulletList"');
    expect(JSON.stringify(nodes)).toContain('"strike"');
    expect(nodes.at(-1)).toMatchObject({ type: "codeBlock" });
    expect(p.entries[0].text).toContain("const n = 1;");
  });
  it("retains unsupported HTML, tables and image text without executing or fetching them", () => {
    const p = parseManuscript('<script>alert(1)</script>\n\n![Diagram](https://example.invalid/image.png)\n\n| A | B |\n|---|---|\n| x | y |', "safe.md");
    expect(p.entries[0].text).toContain("<script>alert(1)</script>");
    expect(p.entries[0].text).toContain("Diagram");
    expect(p.entries[0].text).toContain("https://example.invalid/image.png");
    expect(p.entries[0].text).toContain("| x | y |");
    expect(JSON.stringify(p.entries[0].content)).not.toContain('"image"');
  });
  it("does not create unsafe link marks and preserves literal punctuation", () => {
    const p = parseManuscript('[Bad](javascript:alert(1))\n\n[Good](https://example.com) — café.', "links.md");
    expect(JSON.stringify(p.entries[0].content)).not.toContain('"href":"javascript:');
    expect(JSON.stringify(p.entries[0].content)).toContain('"href":"https://example.com"');
    expect(p.entries[0].text).toContain("— café.");
  });

  it("populates research footnotes and footnoteReference nodes when importing Markdown", () => {
    const md = "Claim[^1] and repeat[^1] with another[^note2].\n\n[^1]: First note.\n\n[^note2]: Second note.\n";
    const project = parseManuscript(md, "test.md");
    expect(project.research?.footnotes).toHaveLength(2);
    expect(project.research?.footnotes[0].text).toBe("First note.");
    expect(project.research?.footnotes[1].text).toBe("Second note.");

    const contentStr = JSON.stringify(project.entries[0].content);
    expect(contentStr).toContain('"footnoteReference"');
    const note1Id = project.research?.footnotes[0].id;
    const note2Id = project.research?.footnotes[1].id;
    expect(contentStr).toContain(`"attrs":{"id":"${note1Id}"}`);
    expect(contentStr).toContain(`"attrs":{"id":"${note2Id}"}`);
  });

  it("imports multi-paragraph footnote definitions into research footnotes", () => {
    const md = "Statement[^1].\n\n[^1]: First paragraph.\n\n    Second paragraph.\n    Continuation line.\n\n    Third paragraph.";
    const project = parseManuscript(md, "multi.md");
    expect(project.research?.footnotes).toHaveLength(1);
    expect(project.research?.footnotes[0].text).toBe(
      "First paragraph.\n\nSecond paragraph. Continuation line.\n\nThird paragraph."
    );
    expect(project.entries[0].text).not.toContain("Second paragraph");
    expect(project.entries[0].text).not.toContain("Third paragraph");
    expect(project.entries[0].text).toContain("Statement");
  });

  it("propagates markdown footnote warnings during manuscript import", () => {
    const md = "Body with [^unresolved] note.\n\n[^unused]: Never cited.";
    const preview = previewManuscript(new TextEncoder().encode(md).buffer, "warnings.md");
    expect(preview.warnings.some((w) => w.includes("[^unresolved]"))).toBe(true);
    expect(preview.warnings.some((w) => w.includes("[^unused]"))).toBe(true);
  });

  it("preserves plain text import without footnote processing", () => {
    const txt = "Claim[^1].\n\n[^1]: Plain text note.";
    const project = parseManuscript(txt, "plain.txt");
    expect(project.research?.footnotes).toHaveLength(0);
    expect(JSON.stringify(project.entries[0].content)).not.toContain('"footnoteReference"');
    expect(project.entries[0].text).toContain("Claim[^1].");
    expect(project.entries[0].text).toContain("[^1]: Plain text note.");
  });

  it("round-trips multi-paragraph notes through export and manuscript import", () => {
    const p = newProject("Round Trip Multi");
    p.entries[0].title = "Opening Section";
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Point A" },
            { type: "footnoteReference", attrs: { id: "fn1" } },
            { type: "text", text: " and Point B" },
            { type: "footnoteReference", attrs: { id: "fn2" } },
          ],
        },
      ],
    };
    p.research = {
      sources: [],
      notes: [],
      footnotes: [
        { id: "fn1", text: "First footnote." },
        { id: "fn2", text: "Second footnote para 1.\n\nSecond footnote para 2." },
      ],
    };

    const exported = projectMarkdown(p);
    const imported = parseManuscript(exported, "roundtrip.md");
    expect(imported.research?.footnotes).toHaveLength(2);
    expect(imported.research?.footnotes[0].text).toBe("First footnote.");
    expect(imported.research?.footnotes[1].text).toBe("Second footnote para 1.\n\nSecond footnote para 2.");
    expect(imported.entries[0].text).not.toContain("Second footnote para 2");
  });

  it("keeps every note reference at its exact inline position after export and re-import", () => {
    const p = newProject("Reference Positions");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before first" },
            { type: "footnoteReference", attrs: { id: "a" } },
            { type: "text", text: ", between" },
            { type: "footnoteReference", attrs: { id: "b" } },
            { type: "text", text: " after both." },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Repeat" },
            { type: "footnoteReference", attrs: { id: "a" } },
          ],
        },
      ],
    };
    p.research = {
      sources: [],
      notes: [],
      footnotes: [
        { id: "a", text: "Note A para 1.\n\nNote A para 2." },
        { id: "b", text: "Note B." },
      ],
    };

    const imported = parseManuscript(projectMarkdown(p), "positions.md");
    const [noteA, noteB] = imported.research!.footnotes;
    expect(noteA.text).toBe("Note A para 1.\n\nNote A para 2.");
    expect(noteB.text).toBe("Note B.");

    // Shape of a paragraph: text strings as-is, references as ref:A / ref:B by resolved note identity.
    const shape = (paragraph: { content?: { type?: string; text?: string; attrs?: Record<string, unknown> }[] }) =>
      (paragraph.content ?? []).map((node) => {
        if (node.type !== "footnoteReference") return node.text;
        return node.attrs?.id === noteA.id ? "ref:A" : node.attrs?.id === noteB.id ? "ref:B" : "ref:?";
      });
    const paragraphs = (imported.entries[0].content.content ?? []).filter((node) => node.type === "paragraph");
    expect(paragraphs).toHaveLength(2);
    expect(shape(paragraphs[0])).toEqual(["Before first", "ref:A", ", between", "ref:B", " after both."]);
    expect(shape(paragraphs[1])).toEqual(["Repeat", "ref:A"]);
  });
});
