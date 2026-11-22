import { describe, it, expect } from "vitest";
import { Editor, getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { documentExtensions } from "./extensions";
import { indentKeys, indentTextSelection, parseInches, stepIndent } from "./indent";

const schema = getSchema(documentExtensions());

function applySelectionIndent(
  position: number,
  delta: 1 | -1,
  documentIndent: number,
  attrs: Record<string, string | null> = {},
) {
  const paragraph = schema.nodes.paragraph.create(
    attrs,
    schema.text("A short paragraph."),
  );
  const doc = schema.nodes.doc.create(null, [paragraph]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, position),
  });
  let transaction: Transaction = state.tr;
  const handled = indentTextSelection(delta, documentIndent)({
    state,
    tr: transaction,
    dispatch: (next) => {
      transaction = next;
    },
  });
  expect(handled).toBe(true);
  return transaction.doc.firstChild!.attrs as Record<string, string | null>;
}

describe("indent values", () => {
  it("parses empty, zero and unit-bearing values", () => {
    expect(parseInches(null)).toBe(0);
    expect(parseInches("")).toBe(0);
    expect(parseInches("0")).toBe(0);
    expect(parseInches("0.5in")).toBe(0.5);
    expect(parseInches("36pt")).toBe(0.5);
    expect(parseInches("48px")).toBe(0.5);
  });

  it("steps by half an inch and returns attribute strings", () => {
    expect(stepIndent(null, 1)).toBe("0.5in");
    expect(stepIndent("0.5in", 1)).toBe("1in");
    expect(stepIndent("1in", -1)).toBe("0.5in");
    expect(stepIndent("0.5in", -1)).toBe("0");
    expect(stepIndent(null, -1)).toBe("0");
    expect(stepIndent("36pt", 0)).toBe("0.5in");
  });

  it("never goes below zero or above four inches", () => {
    expect(stepIndent("0in", -1)).toBe("0");
    expect(stepIndent("4in", 1)).toBe("4in");
    expect(stepIndent("3.8in", 1)).toBe("4in");
  });
});

describe("indent selection behavior", () => {
  it("uses first-line indent for an explicit paragraph-start selection with no inherited indent", () => {
    const attrs = applySelectionIndent(1, 1, 0);
    expect(attrs.firstLineIndent).toBe("0.5in");
    expect(attrs.indentLeft).toBeNull();
  });

  it("uses left indent for an explicit selection inside the paragraph", () => {
    const attrs = applySelectionIndent(2, 1, 0);
    expect(attrs.firstLineIndent).toBeNull();
    expect(attrs.indentLeft).toBe("0.5in");
  });

  it("adds left indent when paragraph start inherits document first-line indent", () => {
    const attrs = applySelectionIndent(1, 1, 0.5);
    expect(attrs.firstLineIndent).toBeNull();
    expect(attrs.indentLeft).toBe("0.5in");
  });

  it("reverses first-line indent with Shift+Tab at paragraph start", () => {
    const increased = applySelectionIndent(1, 1, 0);
    const reversed = applySelectionIndent(1, -1, 0, increased);
    expect(reversed.firstLineIndent).toBe("0");
    expect(reversed.indentLeft).toBeNull();
  });
});

function makeIndentEditor(content: JSONContent, documentIndent = 0) {
  const editor = new Editor({
    element: null,
    extensions: [...documentExtensions(), indentKeys(() => false, () => documentIndent)],
    content,
  });
  const ext = editor.extensionManager.extensions.find((item) => item.name === "indentKeys")!;
  const shortcuts = (ext.config.addKeyboardShortcuts as any).call({
    name: ext.name,
    options: ext.options,
    storage: ext.storage,
    editor,
  });
  return { editor, backspace: () => shortcuts.Backspace?.() };
}

function placeCaretAtTextStart(editor: Editor, text: string) {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === text && position < 0) position = pos;
  });
  if (position < 0) throw new Error(`Could not find text: ${text}`);
  editor.commands.setTextSelection(position);
}

describe("Backspace at the start of an indented block", () => {
  it("removes an explicit first-line indent without changing text or paragraph count", () => {
    const { editor, backspace } = makeIndentEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before" }] },
        { type: "paragraph", attrs: { firstLineIndent: "0.5in" }, content: [{ type: "text", text: "after" }] },
      ],
    });
    placeCaretAtTextStart(editor, "after");

    expect(backspace()).toBe(true);
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.textContent).toBe("beforeafter");
    expect(editor.state.doc.child(1).attrs.firstLineIndent).toBe("0");
    editor.destroy();
  });

  it("steps left indent down, then lets the next Backspace join paragraphs", () => {
    const { editor, backspace } = makeIndentEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before" }] },
        { type: "paragraph", attrs: { indentLeft: "1in" }, content: [{ type: "text", text: "after" }] },
      ],
    });
    placeCaretAtTextStart(editor, "after");

    expect(backspace()).toBe(true);
    expect(editor.state.doc.child(1).attrs.indentLeft).toBe("0.5in");
    expect(editor.state.doc.childCount).toBe(2);
    expect(backspace()).toBe(true);
    expect(editor.state.doc.child(1).attrs.indentLeft).toBe("0");
    expect(editor.state.doc.childCount).toBe(2);
    expect(backspace()).toBe(false);
    expect(editor.state.doc.childCount).toBe(2);
    editor.destroy();
  });

  it("does not remove an inherited document indent", () => {
    const { editor, backspace } = makeIndentEditor(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "before" }] },
          { type: "paragraph", content: [{ type: "text", text: "after" }] },
        ],
      },
      0.5,
    );
    placeCaretAtTextStart(editor, "after");

    expect(backspace()).toBe(false);
    expect(editor.state.doc.childCount).toBe(2);
    editor.destroy();
  });

  it("does not intercept a mid-paragraph Backspace", () => {
    const { editor, backspace } = makeIndentEditor({
      type: "doc",
      content: [{ type: "paragraph", attrs: { indentLeft: "0.5in" }, content: [{ type: "text", text: "after" }] }],
    });
    editor.commands.setTextSelection(3);

    expect(backspace()).toBe(false);
    editor.destroy();
  });

  it("does not intercept Backspace inside a list item", () => {
    const { editor, backspace } = makeIndentEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", attrs: { indentLeft: "0.5in" }, content: [{ type: "text", text: "after" }] }] },
          ],
        },
      ],
    });
    placeCaretAtTextStart(editor, "after");

    expect(backspace()).toBe(false);
    expect(editor.state.doc.textContent).toBe("beforeafter");
    editor.destroy();
  });
});
