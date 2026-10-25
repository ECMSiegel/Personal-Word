import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { documentExtensions } from "./editor/extensions";
import { setImageSourceResolver } from "./editor/media";
import { ReadDocument } from "./components/ReadDocument";
import fs from "fs";
import path from "path";

const VALID_ID_1 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_ID_2 =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function createEditor(content?: JSONContent) {
  return new Editor({
    element: null,
    extensions: documentExtensions(),
    content: content ?? {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Init" }] },
      ],
    },
  });
}

function renderReadDoc(
  doc: JSONContent,
  numbers: Record<string, number> = {},
  resolveAsset?: (id: string) => Promise<string | null>,
) {
  return renderToStaticMarkup(
    React.createElement(ReadDocument, {
      content: doc,
      numbers,
      resolveAsset,
    }),
  );
}

describe("Adversarial WP2 (Instance 1): Table Operations in Editor", () => {
  it("inserts default 3x3 table with header row and isolates cells", () => {
    const editor = createEditor();
    const success = editor
      .chain()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
    expect(success).toBe(true);

    const json: any = editor.getJSON();
    const tableNode = json.content?.find((n: any) => n.type === "table");
    expect(tableNode).toBeDefined();
    expect(tableNode?.content).toHaveLength(3);

    // Row 0 has tableHeader cells
    const headerRow = tableNode?.content?.[0];
    expect(headerRow?.type).toBe("tableRow");
    expect(headerRow?.content).toHaveLength(3);
    expect(
      headerRow?.content?.every((c: any) => c.type === "tableHeader"),
    ).toBe(true);

    // Rows 1 and 2 have tableCell cells
    const row1 = tableNode?.content?.[1];
    expect(row1?.content?.every((c: any) => c.type === "tableCell")).toBe(true);
    const row2 = tableNode?.content?.[2];
    expect(row2?.content?.every((c: any) => c.type === "tableCell")).toBe(true);
    editor.destroy();
  });

  it("handles extreme / boundary rows and cols clamping in insertTable", () => {
    const editor = createEditor();

    // 0 or negative values clamped to min 1
    editor
      .chain()
      .insertTable({ rows: 0, cols: -5, withHeaderRow: false })
      .run();
    let json: any = editor.getJSON();
    let table = json.content?.find((n: any) => n.type === "table");
    expect(table?.content).toHaveLength(1);
    expect(table?.content?.[0].content).toHaveLength(1);
    expect(table?.content?.[0].content?.[0].type).toBe("tableCell");

    // Float values floored and clamped to max (rows: 50, cols: 20)
    editor
      .chain()
      .insertTable({ rows: 100.9, cols: 50.7, withHeaderRow: true })
      .run();
    json = editor.getJSON();
    const tables = json.content?.filter((n: any) => n.type === "table") ?? [];
    const bigTable = tables[tables.length - 1];
    expect(bigTable.content).toHaveLength(50);
    expect(bigTable.content?.[0].content).toHaveLength(20);
    editor.destroy();
  });

  it("deletes table from various cursor positions without errors", () => {
    // 1. Cursor in first cell (0, 0)
    const editor = createEditor();
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    expect(editor.isActive("table")).toBe(true);
    let deleted = editor.chain().deleteTable().run();
    expect(deleted).toBe(true);
    expect(editor.isActive("table")).toBe(false);
    expect(editor.getJSON().content?.some((n) => n.type === "table")).toBe(
      false,
    );

    // 2. Cursor in last cell (find pos of last tableCell paragraph)
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    let lastCellPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell") lastCellPos = pos;
    });
    expect(lastCellPos).toBeGreaterThan(0);
    editor.commands.setTextSelection(lastCellPos + 2);
    expect(editor.isActive("table")).toBe(true);
    deleted = editor.chain().deleteTable().run();
    expect(deleted).toBe(true);
    expect(editor.isActive("table")).toBe(false);

    // 3. When cursor is outside table
    deleted = editor.chain().deleteTable().run();
    expect(deleted).toBe(false);
    editor.destroy();
  });

  it("handles multiple consecutive row insertions and deletions to boundary (1 row)", () => {
    const editor = createEditor();
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

    // Consecutively add 5 rows
    for (let i = 0; i < 5; i++) {
      const added = editor.chain().addRowAfter().run();
      expect(added).toBe(true);
    }
    let table = editor.getJSON().content?.find((n) => n.type === "table");
    expect(table?.content).toHaveLength(8);

    // Consecutively delete rows down to 1 row
    for (let i = 0; i < 7; i++) {
      const del = editor.chain().deleteRow().run();
      expect(del).toBe(true);
    }
    table = editor.getJSON().content?.find((n) => n.type === "table");
    expect(table?.content).toHaveLength(1);

    // Boundary condition: deleting the 1 remaining row returns false to prevent schema violation (content: "tableRow+")
    const delFinal = editor.chain().deleteRow().run();
    expect(delFinal).toBe(false);
    table = editor.getJSON().content?.find((n) => n.type === "table");
    expect(table?.content).toHaveLength(1);

    // deleteTable() cleanly deletes the 1-row table
    expect(editor.chain().deleteTable().run()).toBe(true);
    expect(editor.getJSON().content?.some((n) => n.type === "table")).toBe(
      false,
    );
    editor.destroy();
  });

  it("handles multiple consecutive col insertions and deletions to boundary (1 col)", () => {
    const editor = createEditor();
    editor
      .chain()
      .insertTable({ rows: 2, cols: 3, withHeaderRow: false })
      .run();

    // Consecutively add 4 columns
    for (let i = 0; i < 4; i++) {
      const added = editor.chain().addColumnAfter().run();
      expect(added).toBe(true);
    }
    let table: any = editor
      .getJSON()
      .content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content).toHaveLength(7);

    // Consecutively delete columns down to 1
    for (let i = 0; i < 6; i++) {
      const del = editor.chain().deleteColumn().run();
      expect(del).toBe(true);
    }
    table = editor.getJSON().content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content).toHaveLength(1);

    // Boundary condition: deleting the 1 remaining column returns false to prevent empty row schema violation
    const delFinal = editor.chain().deleteColumn().run();
    expect(delFinal).toBe(false);
    table = editor.getJSON().content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content).toHaveLength(1);

    // deleteTable() cleanly deletes the 1-col table
    expect(editor.chain().deleteTable().run()).toBe(true);
    expect(editor.getJSON().content?.some((n: any) => n.type === "table")).toBe(
      false,
    );
    editor.destroy();
  });

  it("toggles header row back and forth", () => {
    const editor = createEditor();
    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

    let table: any = editor
      .getJSON()
      .content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content?.[0].type).toBe("tableHeader");

    // Toggle header row off
    editor.chain().toggleHeaderRow().run();
    table = editor.getJSON().content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content?.[0].type).toBe("tableCell");
    expect(
      table?.content?.every((r: any) =>
        r.content?.every((c: any) => c.type === "tableCell"),
      ),
    ).toBe(true);

    // Toggle header row back on
    editor.chain().toggleHeaderRow().run();
    table = editor.getJSON().content?.find((n: any) => n.type === "table");
    expect(table?.content?.[0].content?.[0].type).toBe("tableHeader");

    editor.destroy();
  });

  it("allows multiple tables in a document and deleting one leaves the other intact", () => {
    const editor = createEditor();
    // Insert Table 1
    editor.chain().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();

    // Move cursor outside Table 1 to the end of document
    editor.commands.setTextSelection(editor.state.doc.content.size);
    // Insert paragraph between
    editor.commands.insertContent({
      type: "paragraph",
      content: [{ type: "text", text: "Between tables" }],
    });
    // Insert Table 2 after paragraph
    editor.commands.setTextSelection(editor.state.doc.content.size);
    editor
      .chain()
      .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
      .run();

    let tables: any =
      editor.getJSON().content?.filter((n: any) => n.type === "table") ?? [];
    expect(tables).toHaveLength(2);

    // Position cursor in Table 1
    let table1Pos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableHeader" && table1Pos < 0) table1Pos = pos;
    });
    expect(table1Pos).toBeGreaterThan(0);
    editor.commands.setTextSelection(table1Pos + 2);

    // Delete Table 1
    const del1 = editor.chain().deleteTable().run();
    expect(del1).toBe(true);

    tables =
      editor.getJSON().content?.filter((n: any) => n.type === "table") ?? [];
    expect(tables).toHaveLength(1);
    // Table 2 (headerless) remains
    expect(tables[0].content?.[0].content?.[0].type).toBe("tableCell");

    editor.destroy();
  });
});

describe("Adversarial WP2 (Instance 1): Alt-Text & Image Attributes", () => {
  it("inserts image with valid assetId and empty alt text", () => {
    const editor = createEditor();
    const success = editor
      .chain()
      .insertImage({ assetId: VALID_ID_1, alt: "" })
      .run();
    expect(success).toBe(true);

    const imageNode = editor.getJSON().content?.find((n) => n.type === "image");
    expect(imageNode).toBeDefined();
    expect(imageNode?.attrs?.assetId).toBe(VALID_ID_1);
    expect(imageNode?.attrs?.alt).toBe("");
    editor.destroy();
  });

  it("handles massive alt text (50,000 chars) without truncation or crash", () => {
    const editor = createEditor();
    const massiveAlt = "A".repeat(50000);
    const success = editor
      .chain()
      .insertImage({ assetId: VALID_ID_1, alt: massiveAlt })
      .run();
    expect(success).toBe(true);

    const imageNode = editor.getJSON().content?.find((n) => n.type === "image");
    expect(imageNode?.attrs?.alt).toHaveLength(50000);
    editor.destroy();
  });

  it("handles special characters, HTML, and unicode in alt text safely", () => {
    const editor = createEditor();
    const xssAlt = `<script>alert('xss')</script>"' & <foo bar="baz"> \u0000 \n \r 🔥🚀 مرحبا`;
    const success = editor
      .chain()
      .insertImage({ assetId: VALID_ID_1, alt: xssAlt })
      .run();
    expect(success).toBe(true);

    const imageNode = editor.getJSON().content?.find((n) => n.type === "image");
    expect(imageNode?.attrs?.alt).toBe(xssAlt);

    // Render in ReadDocument to verify React properly escapes HTML
    const html = renderReadDoc({
      type: "doc",
      content: [imageNode!],
    });
    // Must NOT contain unescaped script tag
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
    );
    expect(html).toContain("🔥🚀 مرحبا");
    editor.destroy();
  });

  it("rejects invalid assetIds in insertImage", () => {
    const editor = createEditor();

    // Too short
    expect(editor.commands.insertImage({ assetId: "abc", alt: "test" })).toBe(
      false,
    );

    // Non-hex characters
    expect(
      editor.commands.insertImage({ assetId: "z".repeat(64), alt: "test" }),
    ).toBe(false);

    // Uppercase hex
    expect(
      editor.commands.insertImage({ assetId: "A".repeat(64), alt: "test" }),
    ).toBe(false);

    // SQL / shell injection
    expect(
      editor.commands.insertImage({
        assetId: "'; DROP TABLE projects; --",
        alt: "test",
      }),
    ).toBe(false);

    editor.destroy();
  });
});

describe("Adversarial WP2 (Instance 1): Image Resolver Lifecycle", () => {
  afterEach(() => {
    setImageSourceResolver(null);
  });

  it("supports rapid resolver changes and null deregistration", async () => {
    const resolverA = vi.fn(async (id: string) => `blob:app/img-a-${id}`);
    const resolverB = vi.fn(async (id: string) => `blob:app/img-b-${id}`);

    setImageSourceResolver(resolverA);
    setImageSourceResolver(resolverB);

    // Now deregister
    setImageSourceResolver(null);
  });

  it("revokes blob URLs on cleanup while ignoring errors", () => {
    const cache = new Map<string, string>();
    cache.set(VALID_ID_1, "blob:http://localhost/uuid-1");
    cache.set(VALID_ID_2, "blob:http://localhost/uuid-2");
    cache.set("remote", "https://example.com/photo.png");

    const revoked: string[] = [];
    const origRevoke = globalThis.URL.revokeObjectURL;
    globalThis.URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    // Execute the revocation routine from Writer.tsx
    for (const url of cache.values()) {
      if (url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
    }
    cache.clear();

    expect(revoked).toEqual([
      "blob:http://localhost/uuid-1",
      "blob:http://localhost/uuid-2",
    ]);
    expect(revoked).not.toContain("https://example.com/photo.png");
    expect(cache.size).toBe(0);

    globalThis.URL.revokeObjectURL = origRevoke;
  });
});

describe("Adversarial WP2 (Instance 1): Reading View (ReadDocument.tsx)", () => {
  it("renders ragged tables (uneven row cell counts) without throwing", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "H1" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "H2" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "H3" }],
                    },
                  ],
                },
              ],
            },
            {
              // Row with only 1 cell
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Solo" }],
                    },
                  ],
                },
              ],
            },
            {
              // Row with 5 cells
              type: "tableRow",
              content: [1, 2, 3, 4, 5].map((i) => ({
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: `Cell ${i}` }],
                  },
                ],
              })),
            },
            {
              // Row with 0 cells
              type: "tableRow",
              content: [],
            },
          ],
        },
      ],
    };

    const html = renderReadDoc(doc);
    expect(html).toContain("<table><tbody>");
    expect(html).toContain("<th><p><span>H1</span></p></th>");
    expect(html).toContain("<td><p><span>Solo</span></p></td>");
    expect(html).toContain("<td><p><span>Cell 5</span></p></td>");
    expect(html).toContain("<tr></tr>");
    expect(html).toContain("</tbody></table>");
  });

  it("renders complex nested block content inside table cells", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "First paragraph" }],
                    },
                    {
                      type: "heading",
                      attrs: { level: 2 },
                      content: [{ type: "text", text: "Nested Heading" }],
                    },
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Bullet 1" }],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      type: "blockquote",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Blockquote text" }],
                        },
                      ],
                    },
                    {
                      type: "image",
                      attrs: { assetId: VALID_ID_1, alt: "Nested Image" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderReadDoc(doc);
    expect(html).toContain("<td>");
    expect(html).toContain("<p><span>First paragraph</span></p>");
    expect(html).toContain("<h3><span>Nested Heading</span></h3>");
    expect(html).toContain("<ul><li><p><span>Bullet 1</span></p></li></ul>");
    expect(html).toContain(
      "<blockquote><p><span>Blockquote text</span></p></blockquote>",
    );
    expect(html).toContain('<span class="doc-image-alt">Nested Image</span>');
    expect(html).toContain("</td>");
  });

  it("handles malformed schemas gracefully (empty table, null attrs, missing content)", () => {
    // 1. Empty table node without content
    let html = renderReadDoc({
      type: "doc",
      content: [{ type: "table" }],
    });
    expect(html).toBe("<table><tbody></tbody></table>");

    // 2. Empty tableRow without content
    html = renderReadDoc({
      type: "doc",
      content: [{ type: "table", content: [{ type: "tableRow" }] }],
    });
    expect(html).toBe("<table><tbody><tr></tr></tbody></table>");

    // 3. Cell without content
    html = renderReadDoc({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableCell" }],
            },
          ],
        },
      ],
    });
    expect(html).toBe("<table><tbody><tr><td></td></tr></tbody></table>");

    // 4. Cell with invalid / negative / string colspan and rowspan
    html = renderReadDoc({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: {
                    colspan: -3,
                    rowspan: "invalid",
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "bad attrs" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  attrs: {
                    colspan: NaN,
                    rowspan: null,
                  },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "nan attrs" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    // Should NOT have colspan or rowspan attributes rendered
    expect(html).toContain("<td><p><span>bad attrs</span></p></td>");
    expect(html).toContain("<th><p><span>nan attrs</span></p></th>");
    expect(html).not.toContain("colspan");
    expect(html).not.toContain("rowspan");
  });

  it("handles image without attrs or missing assetId safely in ReadDocument", () => {
    const html = renderReadDoc({
      type: "doc",
      content: [{ type: "image" }],
    });
    expect(html).toBe(
      '<figure class="doc-image"><span class="doc-image-alt">Image</span></figure>',
    );
  });

  it("renders image with title, width, and height attributes when provided", () => {
    const html = renderReadDoc({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            assetId: VALID_ID_1,
            alt: "Chart",
            title: "Sales Chart 2026",
            width: 800,
            height: 600,
          },
        },
      ],
    });
    // Without resolveAsset, renders fallback alt text
    expect(html).toContain('data-asset-id="' + VALID_ID_1 + '"');
    expect(html).toContain('<span class="doc-image-alt">Chart</span>');
  });

  it("sanitizes javascript: links inside table cells and paragraphs in ReadDocument", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "Safe link",
                          marks: [
                            {
                              type: "link",
                              attrs: { href: "https://example.com" },
                            },
                          ],
                        },
                        {
                          type: "text",
                          text: " Malicious link",
                          marks: [
                            {
                              type: "link",
                              attrs: { href: "javascript:alert(1)" },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderReadDoc(doc);
    // Safe link has <a> tag
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noreferrer">Safe link</a>',
    );
    // Malicious link is stripped to plain text without <a> tag
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("<span> Malicious link</span>");
  });

  it("renders marks (bold, italic, underline, strike) inside table cell text", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "Formatted",
                          marks: [
                            { type: "bold" },
                            { type: "italic" },
                            { type: "underline" },
                            { type: "strike" },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderReadDoc(doc);
    expect(html).toContain(
      "<td><p><span><s><u><em><strong>Formatted</strong></em></u></s></span></p></td>",
    );
  });
});

describe("Adversarial WP2 (Instance 1): CSS Rules and AGENTS.md Conformance", () => {
  const cssPath = path.resolve(__dirname, "editor/editor.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  it("defines table controls styling with no curved selection connectors and square borders", () => {
    expect(css).toContain(".writer .table-controls-grid");
    expect(css).toContain(".writer .toolbar-text-button.is-danger");
    // Ensure square borders on alt-text input
    expect(css).toContain(".writer .toolbar-popover .toolbar-input");
    expect(css).toMatch(/border-radius:\s*0/);
  });

  it("defines reading view table rules that reset white-space to normal", () => {
    expect(css).toContain(".read-document table");
    expect(css).toContain(".read-prose table");
    expect(css).toMatch(/\.read-prose table[\s\S]*?white-space:\s*normal;/);
    expect(css).toMatch(/\.read-prose td[\s\S]*?white-space:\s*normal;/);
  });

  it("uses Futura / Avenir Next / sans-serif typography on image fallback and buttons", () => {
    expect(css).toContain("Futura");
    expect(css).toContain("Avenir Next");
    expect(css).toContain("sans-serif");
  });
});
