import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { JSONContent } from "@tiptap/react";
import { ReadDocument } from "./ReadDocument";

const ID = "a".repeat(64);

const p = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const cell = (
  type: "tableHeader" | "tableCell",
  text: string,
  attrs = {},
): JSONContent => ({
  type,
  attrs: { colspan: 1, rowspan: 1, ...attrs },
  content: [p(text)],
});

function render(
  doc: JSONContent,
  resolveAsset?: (id: string) => Promise<string | null>,
) {
  return renderToStaticMarkup(
    React.createElement(ReadDocument, {
      content: doc,
      numbers: {},
      resolveAsset,
    }),
  );
}

describe("ReadDocument node rendering", () => {
  it("renders tables with table, tbody, tr, th, td elements", () => {
    const tableDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                cell("tableHeader", "Col A"),
                cell("tableHeader", "Col B"),
              ],
            },
            {
              type: "tableRow",
              content: [cell("tableCell", "Val 1"), cell("tableCell", "Val 2")],
            },
          ],
        },
      ],
    };

    const html = render(tableDoc);
    expect(html).toContain("<table><tbody>");
    expect(html).toContain(
      "<tr><th><p><span>Col A</span></p></th><th><p><span>Col B</span></p></th></tr>",
    );
    expect(html).toContain(
      "<tr><td><p><span>Val 1</span></p></td><td><p><span>Val 2</span></p></td></tr>",
    );
    expect(html).toContain("</tbody></table>");
  });

  it("renders colSpan and rowSpan on table cells when greater than 1", () => {
    const tableDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                cell("tableHeader", "Span Header", {
                  colspan: 2,
                  rowspan: 1,
                }),
              ],
            },
            {
              type: "tableRow",
              content: [
                cell("tableCell", "Span Cell", { colspan: 1, rowspan: 3 }),
              ],
            },
          ],
        },
      ],
    };

    const html = render(tableDoc);
    expect(html.toLowerCase()).toContain('<th colspan="2">');
    expect(html.toLowerCase()).toContain('<td rowspan="3">');
  });

  it("renders image with fallback alt text span when no resolveAsset is provided", () => {
    const imageDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: ID, alt: "A mountain landscape" },
        },
      ],
    };

    const html = render(imageDoc);
    expect(html).toContain(`<figure class="doc-image" data-asset-id="${ID}">`);
    expect(html).toContain(
      '<span class="doc-image-alt">A mountain landscape</span>',
    );
    expect(html).not.toContain("<img");
  });

  it("renders default 'Image' fallback when image has empty alt text", () => {
    const imageDoc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: ID, alt: "" },
        },
      ],
    };

    const html = render(imageDoc);
    expect(html).toContain('<span class="doc-image-alt">Image</span>');
  });
});
