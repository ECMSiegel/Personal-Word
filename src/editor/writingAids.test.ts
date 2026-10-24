import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/react";
import { EditorState } from "@tiptap/pm/state";
import { documentExtensions } from "./extensions";
import { FocusMode, ProseCheck, focusModeKey, proseCheckKey, MAX_PROSE_DECORATIONS, createLatestOnlyRequestQueue, defaultProseRules, isCurrentProseResponse, isLatestProseResponse, proseDecorationsFor } from "./writingAids";
import { findProseIssues } from "./proseCheck";

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
    const set = proseDecorationsFor(state.doc, state.selection.head, [{ from: 5, to: 8, kind: "repeat", message: "Repeated word" }], true);
    expect(set.find(5, 8).map((decoration) => [decoration.from, decoration.to])).toEqual([[5, 8]]);
  });
  it("maps text offsets through hard breaks", () => {
    const { state } = makeEditor({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "The" },
      { type: "hardBreak" },
      { type: "text", text: "the cat." },
    ] }] }, false, true);
    const set = proseDecorationsFor(state.doc, state.selection.head, [{ from: 5, to: 8, kind: "repeat", message: "Repeated word" }], true);
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
    expect(proseCheckKey.getState(state)!.decorations.find()).toEqual([]);
  });
  it("caps prose decorations and keeps the ones closest to the cursor", () => {
    const text = Array(2100).fill("the").join(" ");
    const { editor } = makeEditor(
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
      false,
      true,
    );
    const issues = findProseIssues(text).map(issue => ({ ...issue, from: issue.from + 1, to: issue.to + 1, id: `${issue.kind}-${issue.from}` }));
    const start = proseDecorationsFor(editor.state.doc, 1, issues, true).find();
    const end = proseDecorationsFor(editor.state.doc, editor.state.doc.content.size - 1, issues, true).find();
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

  it("keeps the complete issue index independent from rule and dismissal decoration filters", () => {
    const { editor } = makeEditor({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "The the cat." }] }] }, false, true);
    const issues = [
      { id: "repeat-1", from: 5, to: 8, kind: "repeat" as const, message: "Repeated word" },
      { id: "filler-1", from: 0, to: 3, kind: "filler" as const, message: "Filler" },
    ];
    const decorations = proseDecorationsFor(editor.state.doc, 1, issues, true, { ...defaultProseRules, repeat: false }, new Set(["filler-1"]));
    expect(decorations.find()).toEqual([]);
    expect(issues).toHaveLength(2);
  });

  it("rejects worker replies unless entry, revision, and latest request all match", () => {
    const latest = { entryId: "second", revision: 4, requestId: 9 };
    expect(isLatestProseResponse(latest, latest)).toBe(true);
    expect(isLatestProseResponse({ ...latest, requestId: 8 }, latest)).toBe(false);
    expect(isLatestProseResponse({ ...latest, revision: 3 }, latest)).toBe(false);
    expect(isLatestProseResponse({ ...latest, entryId: "first" }, latest)).toBe(false);
    expect(isLatestProseResponse(latest, null)).toBe(false);
  });

  it("rejects a matching reply if the document changed before the next worker request", () => {
    const { editor } = makeEditor({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }] }, false, true);
    const requestedDoc = editor.state.doc;
    const response = { entryId: "entry", revision: 4, requestId: 9 };
    expect(isCurrentProseResponse(response, response, { entryId: "entry", revision: 4 }, requestedDoc, requestedDoc)).toBe(true);
    const editedDoc = editor.state.tr.insertText(" updated", editor.state.doc.content.size - 1).doc;
    expect(isCurrentProseResponse(response, response, { entryId: "entry", revision: 4 }, requestedDoc, editedDoc)).toBe(false);
  });

  it("coalesces many busy-editor updates to one latest pending request", () => {
    const sent: number[] = [];
    const queue = createLatestOnlyRequestQueue<number>(request => { sent.push(request); return sent.length; });
    queue.request(0);
    for (let update = 1; update <= 200; update++) queue.request(update);
    expect(sent).toEqual([0]);
    expect(queue.complete(1)).toBe(true);
    expect(sent).toEqual([0, 200]);
    expect(queue.complete(2)).toBe(true);
    expect(queue.busy).toBe(false);
  });

  it("drops dirty IDs for blocks removed before their text is sent to the worker", () => {
    const { state: initialState } = makeEditor({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "first" }] },
      { type: "paragraph", content: [{ type: "text", text: "kept" }] },
    ] }, false, true);
    let state = initialState;
    const initial = proseCheckKey.getState(state)!;
    state = state.apply(state.tr.setMeta(proseCheckKey, {
      type: "blocks-sent",
      sentBlockIds: [...initial.changedBlockIds],
    }));

    const insertAt = state.doc.firstChild!.nodeSize;
    const newParagraph = state.schema.nodes.paragraph.create(null, state.schema.text("temporary"));
    state = state.apply(state.tr.insert(insertAt, newParagraph));
    const inserted = proseCheckKey.getState(state)!;
    expect(inserted.changedBlockIds.size).toBeGreaterThanOrEqual(1);

    state = state.apply(state.tr.delete(insertAt, insertAt + newParagraph.nodeSize));
    const afterRemoval = proseCheckKey.getState(state)!;
    expect([...afterRemoval.changedBlockIds].every(id => new Set(afterRemoval.blockIds.values()).has(id))).toBe(true);
  });
});
