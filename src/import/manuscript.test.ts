import { describe, expect, it } from "vitest";
import { decodeManuscript, parseManuscript } from "./manuscript";

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
});
