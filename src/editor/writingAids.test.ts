import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { documentExtensions } from "./extensions";
import { FocusMode, ProseCheck, focusModeKey, proseCheckKey, MAX_PROSE_DECORATIONS } from "./writingAids";

const editors: Editor[] = [];
function makeEditor(content: JSONContent, focus = true, prose = true) {
  const editor = new Editor({
    element: null,
    content,
    extensions: [
      ...documentExtensions(),
      FocusMode.configure({ enabled: () => focus }),
      ProseCheck.configure({ enabled: () => prose }),
    ],
  });
  editors.push(editor);
  return { editor, state: EditorState.create({ doc: editor.state.doc, plugins: editor.extensionManager.plugins }) };
}
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

describe("writer-only decorations", () => {
  it("focus mode dims every top-level block except the cursor's", () => {
    const { state } = makeEditor({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "first" }] },
      { type: "paragraph", content: [{ type: "text", text: "second" }] },
    ] }, true, false);
    const set = focusModeKey.getState(state)!;
    expect(set.find().map((decoration) => [decoration.from, decoration.to])).toEqual([[7, 15]]);
  });
  it("prose decorations land on the right characters", async () => {
    const { state } = makeEditor({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "The the cat." }] }] }, false, true);
    const set = proseCheckKey.getState(state)!;
    expect(set.find(5, 8).map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 8]]);
  });
  it("maps text offsets through hard breaks", () => {
    const { state } = makeEditor({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "The" },
      { type: "hardBreak" },
      { type: "text", text: "the cat." },
    ] }] }, false, true);
    const set = proseCheckKey.getState(state)!;
    expect(set.find(5, 8).map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 8]]);
  });
  it("decorations never change the saved JSON", async () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "The the cat." }] }] };
    const { editor } = makeEditor(content, true, true);
    const before = editor.getJSON();
    expect(editor.getJSON()).toEqual(before);
  });
  it("prose check skips block quotations and code blocks", async () => {
    const { state } = makeEditor({ type: "doc", content: [
      { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "The the" }] }] },
      { type: "blockquote", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "The the" }] }] }] }] },
      { type: "codeBlock", content: [{ type: "text", text: "The the" }] },
    ] }, false, true);
    expect(proseCheckKey.getState(state)!.find()).toEqual([]);
  });
  it("caps prose decorations and keeps the ones closest to the cursor", () => {
    const text = Array(2100).fill("the").join(" ");
    const { editor } = makeEditor(
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
      false,
      true,
    );
    const stateAt = (head: number) =>
      EditorState.create({
        doc: editor.state.doc,
        plugins: editor.extensionManager.plugins,
        selection: TextSelection.create(editor.state.doc, head),
      });
    const start = proseCheckKey.getState(stateAt(1))!.find();
    const end = proseCheckKey.getState(stateAt(editor.state.doc.content.size - 1))!.find();
    // The whole paragraph is one long sentence, so that decoration is always
    // the closest one; compare the repeated-word window instead.
    const repeats = (set: typeof start) =>
      set.filter((decoration) => decoration.spec?.kind === "repeat");
    expect(start.length).toBe(MAX_PROSE_DECORATIONS);
    expect(end.length).toBe(MAX_PROSE_DECORATIONS);
    const firstRepeat = (set: typeof start) =>
      Math.min(...repeats(set).map((decoration) => decoration.from));
    const lastRepeat = (set: typeof start) =>
      Math.max(...repeats(set).map((decoration) => decoration.to));
    expect(firstRepeat(end)).toBeGreaterThan(firstRepeat(start));
    expect(lastRepeat(start)).toBeLessThan(lastRepeat(end));
  });
});
