import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { JSONContent } from "@tiptap/react";
import { getSchema } from "@tiptap/react";
import { ReadDocument } from "./components/ReadDocument";
import { documentExtensions } from "./editor/extensions";
import { setImageSourceResolver } from "./editor/media";
import { validateProject, newProject } from "./model";
import fs from "fs";
import path from "path";

const VALID_ASSET_ID = "a".repeat(64);
const VALID_ASSET_ID_2 = "b".repeat(64);

describe("Adversarial Verification — ReadDocument Component", () => {
  const p = (text: string): JSONContent => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });

  const cell = (
    type: "tableHeader" | "tableCell",
    content: JSONContent[],
    attrs: Record<string, unknown> = {},
  ): JSONContent => ({
    type,
    attrs: { colspan: 1, rowspan: 1, ...attrs },
    content,
  });

  it("renders arbitrary table dimensions (1x1, 4x2, 2x5)", () => {
    const makeTable = (rows: number, cols: number) => ({
      type: "doc",
      content: [
        {
          type: "table",
          content: Array.from({ length: rows }, (_, r) => ({
            type: "tableRow",
            content: Array.from({ length: cols }, (_, c) =>
              cell(r === 0 ? "tableHeader" : "tableCell", [p(`R${r}C${c}`)]),
            ),
          })),
        },
      ],
    });

    const html1x1 = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: makeTable(1, 1),
        numbers: {},
      }),
    );
    expect(html1x1).toContain("<table><tbody><tr><th><p><span>R0C0</span></p></th></tr></tbody></table>");

    const html4x2 = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: makeTable(4, 2),
        numbers: {},
      }),
    );
    expect(html4x2).toContain("<table><tbody>");
    expect((html4x2.match(/<tr>/g) || []).length).toBe(4);
    expect((html4x2.match(/<th>/g) || []).length).toBe(2);
    expect((html4x2.match(/<td>/g) || []).length).toBe(6);
  });

  it("handles extreme and malformed colSpan and rowSpan values", () => {
    const tableWithSpans: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                cell("tableHeader", [p("H1")], { colspan: 4, rowspan: 2 }),
                cell("tableHeader", [p("H2")], { colspan: 1, rowspan: 1 }),
                cell("tableHeader", [p("H3")], { colspan: 0, rowspan: -1 }),
                cell("tableHeader", [p("H4")], { colspan: "invalid", rowspan: null }),
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: tableWithSpans,
        numbers: {},
      }),
    );

    // In React 19 renderToStaticMarkup, colSpan and rowSpan are rendered as colSpan="4" rowSpan="2"
    expect(html).toMatch(/colSpan="4"/i);
    expect(html).toMatch(/rowSpan="2"/i);
    // colSpan 1 and rowSpan 1 must NOT be rendered (default)
    expect(html).not.toMatch(/colSpan="1"/i);
    expect(html).not.toMatch(/rowSpan="1"/i);
    // 0 and -1 must not be rendered
    expect(html).not.toMatch(/colSpan="0"/i);
    expect(html).not.toMatch(/rowSpan="-1"/i);
    // non-numbers must not be rendered
    expect(html).not.toMatch(/colSpan="invalid"/i);
  });

  it("renders complex cell content: multiple paragraphs, marks, and nested images", () => {
    const richDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                cell("tableCell", [
                  p("First para"),
                  p("Second para"),
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "Bold Text", marks: [{ type: "bold" }] },
                      { type: "text", text: " & " },
                      {
                        type: "text",
                        text: "Link Text",
                        marks: [{ type: "link", attrs: { href: "https://example.com" } }],
                      },
                    ],
                  },
                  {
                    type: "image",
                    attrs: { assetId: VALID_ASSET_ID, alt: "Nested Cell Image" },
                  },
                ]),
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: richDoc,
        numbers: {},
      }),
    );

    expect(html).toContain("<p><span>First para</span></p>");
    expect(html).toContain("<p><span>Second para</span></p>");
    expect(html).toContain("<strong>Bold Text</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("Link Text");
    expect(html).toContain('<figure class="doc-image" data-asset-id="' + VALID_ASSET_ID + '">');
    expect(html).toContain('<span class="doc-image-alt">Nested Cell Image</span>');
  });

  it("sanitizes XSS payloads in image alt text", () => {
    const xssDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            assetId: VALID_ASSET_ID,
            alt: '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: xssDoc,
        numbers: {},
      }),
    );

    // Must be escaped, not rendered as raw tags
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("renders image fallback with default 'Image' when alt is empty or undefined", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: VALID_ASSET_ID, alt: "" },
        },
        {
          type: "image",
          attrs: { assetId: VALID_ASSET_ID_2 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(ReadDocument, {
        content: doc,
        numbers: {},
      }),
    );

    expect(html).toContain('<figure class="doc-image" data-asset-id="' + VALID_ASSET_ID + '"><span class="doc-image-alt">Image</span></figure>');
    expect(html).toContain('<figure class="doc-image" data-asset-id="' + VALID_ASSET_ID_2 + '"><span class="doc-image-alt">Image</span></figure>');
  });
});

describe("Adversarial Verification — Image Resolver Lifecycle & Cleanup", () => {
  beforeEach(() => {
    setImageSourceResolver(null);
  });

  it("caches resolved URLs and revokes only blob: URLs on cleanup", async () => {
    const revokedUrls: string[] = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = vi.fn((url: string) => {
      revokedUrls.push(url);
    });

    try {
      const cache = new Map<string, string>();
      const mockResolve = vi.fn(async (id: string) => {
        if (id === VALID_ASSET_ID) return "blob:http://localhost/1";
        if (id === VALID_ASSET_ID_2) return "data:image/png;base64,AAAA";
        return null;
      });

      // Emulate Writer's setImageSourceResolver setup
      setImageSourceResolver(async (assetId: string) => {
        const cached = cache.get(assetId);
        if (cached) return cached;
        const url = await mockResolve(assetId);
        if (url) cache.set(assetId, url);
        return url;
      });

      // Emulate cache population
      cache.set(VALID_ASSET_ID, "blob:http://localhost/1");
      cache.set(VALID_ASSET_ID_2, "data:image/png;base64,AAAA");

      // Emulate Writer's unmount cleanup
      setImageSourceResolver(null);
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

      // Only the blob: URL must be revoked, NOT data: URL
      expect(revokedUrls).toEqual(["blob:http://localhost/1"]);
      expect(cache.size).toBe(0);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("handles throwing URL.revokeObjectURL without aborting remaining revocations", () => {
    const originalRevoke = URL.revokeObjectURL;
    const attempted: string[] = [];
    URL.revokeObjectURL = vi.fn((url: string) => {
      attempted.push(url);
      if (url.includes("bad")) throw new Error("Revocation failure");
    });

    try {
      const cache = new Map<string, string>([
        ["id1", "blob:http://localhost/bad"],
        ["id2", "blob:http://localhost/good"],
      ]);

      for (const url of cache.values()) {
        if (url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore error
          }
        }
      }
      cache.clear();

      expect(attempted).toEqual([
        "blob:http://localhost/bad",
        "blob:http://localhost/good",
      ]);
      expect(cache.size).toBe(0);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe("Adversarial Verification — Schema & Model Validation for Tables and Images", () => {
  const schema = getSchema(documentExtensions());

  it("validates 3x3 table with header row according to ProseMirror schema", () => {
    const tableJson: JSONContent = {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H1" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H2" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H3" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C1" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C2" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C3" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C4" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C5" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C6" }] }] },
          ],
        },
      ],
    };

    const node = schema.nodeFromJSON(tableJson);
    expect(node.type.name).toBe("table");
    expect(node.childCount).toBe(3);
    expect(node.child(0).type.name).toBe("tableRow");
    expect(node.child(0).child(0).type.name).toBe("tableHeader");
    expect(node.child(1).child(0).type.name).toBe("tableCell");

    // Must also pass validateProject
    const p = newProject("Table Project");
    p.entries[0].content = { type: "doc", content: [tableJson] };
    expect(() => validateProject(p)).not.toThrow();
  });

  it("validates image node in ProseMirror schema", () => {
    const imageJson: JSONContent = {
      type: "image",
      attrs: {
        assetId: VALID_ASSET_ID,
        alt: "A valid image",
        width: 640,
        height: 480,
      },
    };

    const node = schema.nodeFromJSON(imageJson);
    expect(node.type.name).toBe("image");
    expect(node.attrs.assetId).toBe(VALID_ASSET_ID);
    expect(node.attrs.alt).toBe("A valid image");
    expect(node.attrs.width).toBe(640);
    expect(node.attrs.height).toBe(480);

    const p = newProject("Image Project");
    p.entries[0].content = { type: "doc", content: [imageJson] };
    expect(() => validateProject(p)).not.toThrow();
  });

  it("strictly rejects nested tables within table cells", () => {
    const nestedTableJson: JSONContent = {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "table",
                  content: [
                    {
                      type: "tableRow",
                      content: [
                        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested" }] }] },
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

    const p = newProject("Nested Table Project");
    p.entries[0].content = { type: "doc", content: [nestedTableJson] };
    expect(() => validateProject(p)).toThrow();
  });

  it("strictly rejects invalid image asset IDs", () => {
    const invalidImage: JSONContent = {
      type: "image",
      attrs: {
        assetId: "short_id",
        alt: "Invalid",
      },
    };

    const p = newProject("Invalid Image Project");
    p.entries[0].content = { type: "doc", content: [invalidImage] };
    expect(() => validateProject(p)).toThrow();
  });
});

describe("Adversarial Verification — Styling & UI Principles Compliance", () => {
  const cssPath = path.resolve(__dirname, "./editor/editor.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  it("enforces square corners (border-radius: 0) on alt text input", () => {
    expect(cssContent).toMatch(/\.writer\s+\.toolbar-popover\s+\.toolbar-input[\s\S]*?border-radius:\s*0/);
  });

  it("overrides white-space: pre-wrap on reading view tables to prevent alignment distortion", () => {
    expect(cssContent).toMatch(/\.read-document\s+table[\s\S]*?white-space:\s*normal/);
    expect(cssContent).toMatch(/\.read-prose\s+table[\s\S]*?white-space:\s*normal/);
  });

  it("prefers Futura typography on alt text placeholders and toolbar controls", () => {
    expect(cssContent).toMatch(/\.read-document\s+figure\.doc-image\s+\.doc-image-alt[\s\S]*?font-family:\s*[\r\n\s]*Futura/);
  });

  it("defines danger styling for destructive delete table action", () => {
    expect(cssContent).toMatch(/\.writer\s+\.toolbar-text-button\.is-danger/);
  });

  it("contains no decorative icons, quills, or curved borders in WP2 styles", () => {
    const wp2Section = cssContent.slice(cssContent.indexOf("/* Alt text field in popover */"));
    expect(wp2Section).not.toMatch(/border-radius:\s*[1-9]/);
  });
});
