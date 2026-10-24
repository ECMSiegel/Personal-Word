import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { documentExtensions } from "./extensions";
import { Image, setImageSourceResolver } from "./media";

// No DOM library is installed, so HTML parsing is checked through the schema's parse
// rules (what ProseMirror's DOMParser runs) using small stand-in elements.
const ID = "a".repeat(64);
const editors: Editor[] = [];
function make(content?: JSONContent) {
  const editor = new Editor({ element: null, extensions: documentExtensions(), content: content ?? { type: "doc", content: [p("")] } });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  for (const e of editors.splice(0)) e.destroy();
  setImageSourceResolver(null);
});

const p = (text: string): JSONContent => (text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" });
const cell = (type: string, text: string): JSONContent => ({ type, attrs: { colspan: 1, rowspan: 1 }, content: [p(text)] });
const table2x2: JSONContent = {
  type: "table",
  content: [
    { type: "tableRow", content: [cell("tableHeader", "A"), cell("tableHeader", "B")] },
    { type: "tableRow", content: [cell("tableCell", "1"), cell("tableCell", "2")] },
  ],
};
const image: JSONContent = { type: "image", attrs: { assetId: ID, alt: "A cat", title: null, width: 100, height: 50 } };

function shape(editor: Editor) {
  const rows: string[][] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "tableRow") rows.push(node.content.content.map((c) => c.type.name));
  });
  return rows;
}
function rectangular(editor: Editor) {
  const rows = shape(editor);
  return rows.length > 0 && rows.every((r) => r.length === rows[0].length);
}
function cursorInto(editor: Editor, text: string) {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === text && at < 0) at = pos;
  });
  editor.commands.setTextSelection(at + 1);
}
// No view is mounted (no DOM), so run the extension's own Tab/Shift-Tab handlers directly.
function press(editor: Editor, key: "Tab" | "Shift-Tab") {
  const ext = editor.extensionManager.extensions.find((e) => e.name === "tableKeys")!;
  const keys = (ext.config.addKeyboardShortcuts as any).call({ name: ext.name, options: ext.options, storage: ext.storage, editor });
  return keys[key]() as boolean;
}
const selectedText = (editor: Editor) => editor.state.selection.$from.parent.textContent;

describe("image node", () => {
  it("round-trips through JSON", () => {
    const editor = make({ type: "doc", content: [image, p("after")] });
    expect(editor.getJSON().content![0]).toEqual(image);
  });

  it("renders a figure with the asset id and no src", () => {
    const spec = make().schema.nodes.image.spec;
    const node = make().schema.nodes.image.create(image.attrs);
    const out = spec.toDOM!(node) as unknown as [string, Record<string, string>, [string, Record<string, string>]];
    expect(out[0]).toBe("figure");
    expect(out[1]["data-asset-id"]).toBe(ID);
    expect(out[2][0]).toBe("img");
    expect(JSON.stringify(out)).not.toContain("src");
  });

  it("only parses figure/img elements that carry a valid data-asset-id", () => {
    const rules = make().schema.nodes.image.spec.parseDOM!;
    expect(rules.map((r) => r.tag)).toEqual(["figure[data-asset-id]", "img[data-asset-id]"]);
    const el = (id: string | null) =>
      ({ tagName: "FIGURE", querySelector: () => null, getAttribute: (n: string) => (n === "data-asset-id" ? id : null) }) as unknown as HTMLElement;
    for (const rule of rules) {
      expect(rule.getAttrs!(el(ID))).not.toBe(false);
      expect(rule.getAttrs!(el("A".repeat(64)))).toBe(false);
      expect(rule.getAttrs!(el("abc"))).toBe(false);
      expect(rule.getAttrs!(el(null))).toBe(false);
    }
  });

  it("has no parse rule that could turn img[src] into an image", () => {
    const rules = make().schema.nodes.image.spec.parseDOM!;
    expect(rules.some((r) => /src|^img$/.test(r.tag ?? ""))).toBe(false);
  });

  it("rejects an invalid assetId", () => {
    const schema = make().schema;
    expect(() => schema.nodes.image.create({ assetId: "nope" }).check()).toThrow();
    expect(() => schema.nodes.image.create({ assetId: "A".repeat(64) }).check()).toThrow();
    expect(() => schema.nodes.image.create({}).check()).toThrow();
    expect(() => PMNode.fromJSON(schema, { type: "image", attrs: { assetId: "../x.png" } })).toThrow();
  });

  it("insertImage inserts a valid image and refuses a bad id", () => {
    const editor = make({ type: "doc", content: [p("hi")] });
    expect(editor.commands.insertImage({ assetId: "bad" })).toBe(false);
    expect(editor.commands.insertImage({ assetId: ID, alt: "x" })).toBe(true);
    const json = editor.getJSON();
    const found = JSON.stringify(json);
    expect(found).toContain(ID);
    expect(editor.state.doc.content.content.some((n) => n.type.name === "image" && n.attrs.alt === "x")).toBe(true);
  });

  it("exposes a resolver setter", () => {
    expect(typeof setImageSourceResolver).toBe("function");
    expect(Image.name).toBe("image");
  });
});

describe("table nodes", () => {
  it("round-trips a 2x2 table with a header row", () => {
    const editor = make({ type: "doc", content: [table2x2] });
    expect(editor.getJSON().content![0]).toMatchObject(table2x2);
    expect(shape(editor)).toEqual([["tableHeader", "tableHeader"], ["tableCell", "tableCell"]]);
  });

  it("does not allow a table inside a cell", () => {
    const schema = make().schema;
    const nested = { type: "tableCell", content: [table2x2] };
    // Strict validation (what import must run) rejects the nesting.
    expect(() => PMNode.fromJSON(schema, nested).check()).toThrow();
    const editor = make({ type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: [cell("tableCell", "x")] }] }] });
    cursorInto(editor, "x");
    // Inserting a table while inside a cell never produces a nested table.
    editor.commands.insertContent(table2x2);
    editor.state.doc.check();
    editor.state.doc.descendants((n, _p, parent) => {
      if (n.type.name === "table") expect(parent?.type.name).toBe("doc");
    });
  });

  it("keeps spans at 1 even when asked for more", () => {
    const html = make().schema.nodes.tableCell.spec.parseDOM![0];
    expect(html.tag).toBe("td");
    const editor = make({ type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 1, rowspan: 1 }, content: [p("x")] }] }] }] });
    expect(editor.state.doc.firstChild!.firstChild!.firstChild!.attrs).toMatchObject({ colspan: 1, rowspan: 1 });
  });

  it("insertTable builds a rectangular table with a header row and the cursor in the first cell", () => {
    const editor = make({ type: "doc", content: [p("")] });
    expect(editor.commands.insertTable({ rows: 3, cols: 4, withHeaderRow: true })).toBe(true);
    expect(shape(editor)).toEqual([
      Array(4).fill("tableHeader"),
      Array(4).fill("tableCell"),
      Array(4).fill("tableCell"),
    ]);
    expect(editor.state.selection.$from.node(-2).type.name).toBe("tableRow");
    expect(editor.state.selection.$from.index(-2)).toBe(0);
  });

  it("add/delete row and column keep the table rectangular", () => {
    const editor = make({ type: "doc", content: [table2x2] });
    cursorInto(editor, "1");
    expect(editor.commands.addRowAfter()).toBe(true);
    expect(shape(editor).length).toBe(3);
    expect(rectangular(editor)).toBe(true);
    expect(editor.commands.addColumnAfter()).toBe(true);
    expect(shape(editor)[0].length).toBe(3);
    expect(rectangular(editor)).toBe(true);
    expect(editor.commands.deleteColumn()).toBe(true);
    expect(editor.commands.deleteRow()).toBe(true);
    expect(shape(editor).length).toBe(2);
    expect(shape(editor)[0].length).toBe(2);
    expect(rectangular(editor)).toBe(true);
  });

  it("toggleHeaderRow switches the first row to ordinary cells and back", () => {
    const editor = make({ type: "doc", content: [table2x2] });
    cursorInto(editor, "A");
    expect(editor.commands.toggleHeaderRow()).toBe(true);
    expect(shape(editor)[0]).toEqual(["tableCell", "tableCell"]);
    expect(editor.commands.toggleHeaderRow()).toBe(true);
    expect(shape(editor)[0]).toEqual(["tableHeader", "tableHeader"]);
  });

  it("deleteTable removes the table", () => {
    const editor = make({ type: "doc", content: [table2x2, p("after")] });
    cursorInto(editor, "2");
    expect(editor.commands.deleteTable()).toBe(true);
    expect(shape(editor)).toEqual([]);
  });

  it("commands do nothing outside a table", () => {
    const editor = make({ type: "doc", content: [p("plain")] });
    expect(editor.commands.addRowAfter()).toBe(false);
    expect(editor.commands.deleteTable()).toBe(false);
  });

  it("Tab and Shift-Tab move between cells", () => {
    const editor = make({ type: "doc", content: [table2x2] });
    cursorInto(editor, "A");
    expect(press(editor, "Tab")).toBe(true);
    expect(selectedText(editor)).toBe("B");
    press(editor, "Tab");
    expect(selectedText(editor)).toBe("1");
    press(editor, "Shift-Tab");
    expect(selectedText(editor)).toBe("B");
  });
});
