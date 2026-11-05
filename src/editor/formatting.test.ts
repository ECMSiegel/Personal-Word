import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { documentExtensions } from "./extensions";
import { paperGeometry, defaultPageLayout } from "./formatting";
import { newProject, validateProject } from "../model";
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
  it("clamps unsafe margins to the 0.25in--2in export range", () => {
    expect(paperGeometry({ ...defaultPageLayout, margin: 500 }).margin).toBe(
      192,
    );
    expect(paperGeometry({ ...defaultPageLayout, margin: 192 }).margin).toBe(
      192,
    );
    expect(paperGeometry({ ...defaultPageLayout, margin: 1 }).margin).toBe(24);
  });
  it("keeps page separation fixed and defaults the continuous top gap to 32px", () => {
    expect(paperGeometry(defaultPageLayout).gap).toBe(32);
    expect(paperGeometry(defaultPageLayout).topGap).toBe(32);
    expect(paperGeometry({ ...defaultPageLayout, topGap: 0 }).topGap).toBe(0);
    expect(paperGeometry({ ...defaultPageLayout, topGap: 120 }).topGap).toBe(120);
    expect(paperGeometry({ ...defaultPageLayout, topGap: 120 }).gap).toBe(32);
  });
  it("rejects invalid topGap values in project validation", () => {
    const valid = newProject("Gap");
    expect(() => validateProject(valid)).not.toThrow();
    expect(() =>
      validateProject({ ...valid, pageLayout: { ...defaultPageLayout } }),
    ).not.toThrow();
    for (const topGap of [0, 32, 200])
      expect(() =>
        validateProject({ ...valid, pageLayout: { ...defaultPageLayout, topGap } }),
      ).not.toThrow();
    for (const topGap of [-1, 201, Number.NaN, Infinity, "32"])
      expect(() =>
        validateProject({ ...valid, pageLayout: { ...defaultPageLayout, topGap } }),
      ).toThrow("Invalid page settings.");
  });
});
