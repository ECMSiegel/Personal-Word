import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { documentExtensions } from "./extensions";
import { paperGeometry, defaultPageLayout } from "./formatting";
describe("document formatting schema", () => {
  it("round trips typography, paragraph spacing, explicit page breaks and footnote ids", () => {
    const schema = getSchema(documentExtensions());
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { lineHeight: "2", spaceBefore: "6pt", spaceAfter: "12pt" },
          content: [
            {
              type: "text",
              text: "Text",
              marks: [
                {
                  type: "textFormat",
                  attrs: { fontFamily: "Arial, sans-serif", fontSize: "16pt" },
                },
              ],
            },
            { type: "footnoteReference", attrs: { id: "note-1" } },
          ],
        },
        { type: "pageBreak" },
      ],
    };
    const doc = schema.nodeFromJSON(json);
    expect(doc.firstChild?.attrs.lineHeight).toBe("2");
    expect(doc.firstChild?.firstChild?.marks[0].attrs.fontSize).toBe("16pt");
    expect(doc.firstChild?.lastChild?.attrs.id).toBe("note-1");
    expect(doc.lastChild?.type.name).toBe("pageBreak");
    expect(schema.nodeFromJSON(doc.toJSON()).eq(doc)).toBe(true);
  });
  it("clamps unsafe margins", () => {
    expect(paperGeometry({ ...defaultPageLayout, margin: 500 }).margin).toBe(
      144,
    );
  });
});
