import type { JSONContent } from "@tiptap/react";
import {
  defaultDocumentSettings,
  type DocumentSettings,
} from "./research/types";
export type WritingTemplate = {
  id: string;
  name: string;
  description: string;
  sections: { title: string; content: JSONContent }[];
  settings: DocumentSettings;
  custom?: boolean;
  /** Hidden from the create menu and the Settings picker; still openable by id. */
  hidden?: boolean;
};
const doc = (text = ""): JSONContent => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    },
  ],
});
const section = (title: string, text = "") => ({ title, content: doc(text) });
export const writingTemplates: WritingTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "One clean writing section.",
    sections: [section("Opening")],
    settings: {
      ...defaultDocumentSettings,
      font: "sans",
      lineSpacing: 1.5,
      firstLineIndent: false,
    },
  },
  {
    id: "essay",
    name: "Essay",
    description: "Introduction, argument, and conclusion.",
    sections: [
      section("Introduction"),
      section("Argument"),
      section("Conclusion"),
    ],
    settings: { ...defaultDocumentSettings },
    hidden: true,
  },
  {
    id: "chicago",
    name: "Chicago",
    description:
      "12 pt serif, double spacing, one-inch margins, half-inch paragraph indents, notes and bibliography. Instructor requirements take precedence.",
    sections: [
      section("Title page"),
      section("Introduction"),
      section("Main text"),
      section("Conclusion"),
    ],
    settings: { ...defaultDocumentSettings },
  },
  {
    id: "screenplay",
    name: "Screenplay",
    description:
      "12 pt monospace, single spacing, and a scene-heading starter. Includes scene, action, character, dialogue, and parenthetical styles.",
    sections: [section("Scene 1", "INT. LOCATION - DAY")],
    settings: {
      ...defaultDocumentSettings,
      font: "mono",
      lineSpacing: 1,
      firstLineIndent: false,
      bibliography: false,
    },
  },
  {
    id: "story",
    name: "Story",
    description: "A chapter-based manuscript.",
    sections: [section("Chapter 1")],
    settings: { ...defaultDocumentSettings, bibliography: false },
    hidden: true,
  },
];
