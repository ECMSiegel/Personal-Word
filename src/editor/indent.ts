import { Extension, type Command, type Editor } from "@tiptap/core";

export const INDENT_STEP = 0.5;
export const MAX_INDENT = 4;

const BLOCKS = ["paragraph", "heading"];

type Attrs = Record<string, string | null>;

export function parseInches(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  if (value.endsWith("pt")) return n / 72;
  if (value.endsWith("px")) return n / 96;
  if (value.endsWith("cm")) return n / 2.54;
  return n;
}

export function stepIndent(
  value: string | null | undefined,
  delta: number,
): string {
  const inches = Math.min(
    MAX_INDENT,
    Math.max(0, parseInches(value) + delta * INDENT_STEP),
  );
  const rounded = Math.round(inches * 100) / 100;
  return rounded === 0 ? "0" : `${rounded}in`;
}

function editBlocks(edit: (attrs: Attrs) => Partial<Attrs> | null): Command {
  return ({ state, tr, dispatch }) => {
    let found = false;
    state.doc.nodesBetween(
      state.selection.from,
      state.selection.to,
      (node, pos) => {
        if (!BLOCKS.includes(node.type.name)) return true;
        found = true;
        const attrs = node.attrs as Attrs;
        const patch = edit(attrs);
        if (patch) tr.setNodeMarkup(pos, undefined, { ...attrs, ...patch });
        return false;
      },
    );
    if (!found) return false;
    if (tr.docChanged) dispatch?.(tr);
    return true;
  };
}

function indentLeftPatch(delta: number) {
  return (attrs: Attrs) => {
    const next = stepIndent(attrs.indentLeft, delta);
    return parseInches(next) === parseInches(attrs.indentLeft)
      ? null
      : { indentLeft: next };
  };
}

function indentParagraphStart(delta: number, documentIndent: number): Command {
  return ({ state, tr, dispatch }) => {
    const { $from } = state.selection;
    if (!BLOCKS.includes($from.parent.type.name)) return false;
    const attrs = $from.parent.attrs as Attrs;
    // Paragraphs without their own value inherit the document first-line indent.
    const firstLine =
      attrs.firstLineIndent === null || attrs.firstLineIndent === undefined
        ? documentIndent
        : parseInches(attrs.firstLineIndent);
    let patch: Partial<Attrs>;
    if (delta > 0) {
      patch =
        firstLine === 0
          ? { firstLineIndent: "0.5in" }
          : { indentLeft: stepIndent(attrs.indentLeft, 1) };
    } else if (parseInches(attrs.indentLeft) > 0) {
      patch = { indentLeft: stepIndent(attrs.indentLeft, -1) };
    } else if (firstLine > 0) {
      patch = { firstLineIndent: "0" };
    } else {
      patch = {};
    }
    const changed = Object.entries(patch).some(
      ([key, value]) => attrs[key] !== value,
    );
    if (changed) {
      tr.setNodeMarkup($from.before(), undefined, { ...attrs, ...patch });
      dispatch?.(tr);
    }
    return true;
  };
}

function handleIndent(
  editor: Editor,
  delta: number,
  documentIndent: number,
): boolean {
  if (editor.isActive("listItem")) {
    if (delta > 0) editor.commands.sinkListItem("listItem");
    else editor.commands.liftListItem("listItem");
    return true;
  }
  const { selection } = editor.state;
  if (
    selection.empty &&
    selection.$from.parentOffset === 0 &&
    BLOCKS.includes(selection.$from.parent.type.name)
  ) {
    editor.commands.command(indentParagraphStart(delta, documentIndent));
    return true;
  }
  editor.commands.command(editBlocks(indentLeftPatch(delta)));
  return true;
}

/** Toolbar Increase/Decrease indent: sinks or lifts list items, otherwise shifts paragraph indentation. */
export function changeIndent(editor: Editor, delta: 1 | -1) {
  if (editor.isActive("listItem")) {
    if (delta > 0) editor.chain().focus().sinkListItem("listItem").run();
    else editor.chain().focus().liftListItem("listItem").run();
    return;
  }
  editor
    .chain()
    .focus()
    .command(editBlocks(indentLeftPatch(delta)))
    .run();
}

/**
 * Word/Docs-style Tab handling. Screenplay (mono) projects keep their own
 * style-cycling handler, so this extension steps aside when `isScreenplay()`.
 */
export function indentKeys(
  isScreenplay: () => boolean,
  documentIndent: () => number = () => 0,
) {
  return Extension.create({
    name: "indentKeys",
    addKeyboardShortcuts() {
      return {
        Tab: () =>
          isScreenplay()
            ? false
            : handleIndent(this.editor, 1, documentIndent()),
        "Shift-Tab": () =>
          isScreenplay()
            ? false
            : handleIndent(this.editor, -1, documentIndent()),
      };
    },
  });
}
