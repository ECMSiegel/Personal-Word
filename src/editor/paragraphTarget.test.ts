import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { documentExtensions } from "./extensions";
import { paragraphRange } from "./paragraphTarget";

const schema = getSchema(documentExtensions());

function stateWithText(text: string, from: number, to = from) {
  const paragraph = schema.nodes.paragraph.create(null, text ? schema.text(text) : null);
  const doc = schema.nodes.doc.create(null, [paragraph]);
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, from, to),
  });
}

describe("paragraphRange", () => {
  it("returns the textblock content range at a collapsed cursor", () => {
    expect(paragraphRange(stateWithText("A paragraph", 4))).toEqual({ from: 1, to: 12 });
  });

  it("returns the existing non-empty selection", () => {
    expect(paragraphRange(stateWithText("A paragraph", 3, 7))).toEqual({ from: 3, to: 7 });
  });

  it("returns null for an empty textblock", () => {
    expect(paragraphRange(stateWithText("", 1))).toBeNull();
  });
});
