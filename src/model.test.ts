import { expect, it } from "vitest";
import { textOf, newProject, validateProject } from "./model";
it("preserves paragraph boundaries in quoted and list fragment exports", () => {
  const paragraph = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  expect(
    textOf({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [paragraph("First"), paragraph("Second")],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [paragraph("Third"), paragraph("Fourth")],
            },
          ],
        },
      ],
    }),
  ).toBe("First\nSecond\nThird\nFourth");
});
it("rejects unsupported imported editor content before it can be opened", () => {
  const p = newProject("Import");
  p.entries[0].content = { type: "doc", content: [{ type: "unknown" }] };
  expect(() => validateProject(p)).toThrow();
});
