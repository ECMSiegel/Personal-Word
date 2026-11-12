import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import { documentExtensions } from "./extensions";
import { insertPageBreak } from "./pageBreakKeys";

const FONT = "Georgia, serif";
const SIZE = "20px";

function makeEditor() {
  return new Editor({
    element: null,
    extensions: documentExtensions(),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center", lineHeight: "2" },
          content: [
            {
              type: "text",
              text: "Hello world",
              marks: [
                {
                  type: "textFormat",
                  attrs: { fontFamily: FONT, fontSize: SIZE },
                },
                { type: "bold" },
              ],
            },
          ],
        },
      ],
    },
  });
}

/** Types like the browser does: insertText applies the stored marks. */
function type(editor: Editor, text: string) {
  editor.view.dispatch(editor.state.tr.insertText(text));
}

function textAfterBreak(editor: Editor) {
  const doc = editor.state.doc;
  let found: { text: string; marks: readonly any[]; attrs: any } | null = null;
  let seenBreak = false;
  doc.forEach((node) => {
    if (node.type.name === "pageBreak") seenBreak = true;
    else if (seenBreak && node.isTextblock && node.textContent && !found) {
      found = {
        text: node.textContent,
        marks: node.firstChild!.marks,
        attrs: node.attrs,
      };
    }
  });
  return found as { text: string; marks: readonly any[]; attrs: any } | null;
}

function checkMarks(marks: readonly any[]) {
  const tf = marks.find((m) => m.type.name === "textFormat");
  expect(tf?.attrs.fontFamily).toBe(FONT);
  expect(tf?.attrs.fontSize).toBe(SIZE);
  expect(marks.some((m) => m.type.name === "bold")).toBe(true);
}

describe("insertPageBreak", () => {
  it("keeps font, size and bold for text typed after a break at the end", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(insertPageBreak(editor)).toBe(true);
    type(editor, "after");
    const after = textAfterBreak(editor)!;
    expect(after.text).toBe("after");
    checkMarks(after.marks);
    expect(after.attrs.textAlign).toBe("center");
    expect(after.attrs.lineHeight).toBe("2");
  });

  it("keeps the format mid-paragraph", () => {
    const editor = makeEditor();
    editor.commands.setTextSelection(6);
    expect(insertPageBreak(editor)).toBe(true);
    type(editor, "X");
    const after = textAfterBreak(editor)!;
    expect(after.text).toContain("X");
    checkMarks(after.marks);
    expect(editor.state.doc.textContent).toContain("Hello");
    expect(editor.state.doc.textContent).toContain("world");
  });

  it("is one document change, and reversing it removes the break cleanly", () => {
    // The undo history plugin does not run in a headless editor, so check what
    // one undo would do: the insert must be a single doc-changing transaction,
    // and inverting its steps must give back the original document.
    const editor = makeEditor();
    const original = editor.state.doc;
    const docChanges: Transaction[] = [];
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) docChanges.push(transaction);
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertPageBreak(editor);
    expect(docChanges).toHaveLength(1);
    const tr = docChanges[0];
    const back = new Transform(tr.doc);
    for (let i = tr.steps.length - 1; i >= 0; i--) {
      back.step(tr.steps[i].invert(tr.docs[i]));
    }
    expect(back.doc.toJSON()).toEqual(original.toJSON());
  });
  it("does not carry a link past the break, but keeps the font", () => {
    const editor = new Editor({
      element: null,
      extensions: documentExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Linked",
                marks: [
                  { type: "textFormat", attrs: { fontFamily: FONT, fontSize: SIZE } },
                  { type: "link", attrs: { href: "https://example.com" } },
                ],
              },
            ],
          },
        ],
      },
    });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(insertPageBreak(editor)).toBe(true);
    type(editor, "Y");
    const after = textAfterBreak(editor)!;
    expect(after.text).toBe("Y");
    expect(after.marks.some((m) => m.type.name === "link")).toBe(false);
    const tf = after.marks.find((m) => m.type.name === "textFormat");
    expect(tf?.attrs.fontFamily).toBe(FONT);
    expect(tf?.attrs.fontSize).toBe(SIZE);
  });
});
