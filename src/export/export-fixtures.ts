import { newProject } from "../model";
import { defaultDocumentSettings } from "../research/types";
import type { ExportProject } from "./document";

/** Synthetic export QA document; contains no user writing. */
export function createExportFixture(): ExportProject {
  const project = newProject("Personal Word export fixture");
  project.research = {
    sources: [
      {
        id: "fixture-book",
        kind: "book",
        title: "A Book of Examples",
        authors: ["Jane Smith"],
        publisher: "Example Press",
        year: "2026",
      },
    ],
    notes: [],
    footnotes: [
      {
        id: "fixture-note",
        text: "A native footnote with Latin extended, Greek Ελληνικά, and Cyrillic Кириллица.",
        sourceId: "fixture-book",
        locator: "42",
      },
    ],
  };
  project.documentSettings = {
    ...defaultDocumentSettings,
    bibliography: true,
  };
  project.entries[0].content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Synthetic export QA" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Café — Ελληνικά — Кириллица. " },
          { type: "text", text: "Strikethrough", marks: [{ type: "strike" }] },
          { type: "hardBreak" },
          { type: "text", text: "A line after the hard break." },
          { type: "footnoteReference", attrs: { id: "fixture-note" } },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Outer bullet" }],
              },
              {
                type: "orderedList",
                attrs: { start: 4 },
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          { type: "text", text: "Nested ordered item" },
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
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "A deliberately long token: " + "unbroken-token-".repeat(30),
          },
        ],
      },
    ],
  };
  return project;
}
