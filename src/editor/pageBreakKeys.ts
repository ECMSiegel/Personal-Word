import { Extension, type Editor } from "@tiptap/core";

/**
 * Inserts a page break plus an empty paragraph after it, and carries the
 * formatting at the cursor into that paragraph the way Enter does: the active
 * marks (font, size, bold, italic...) become stored marks so the next typed
 * character matches, and a body paragraph's alignment, line spacing, indents
 * and spacing are copied onto the new paragraph. Both the Shift+Enter binding
 * and the Page setup "Insert page break" button use this. It does not focus
 * the editor (focus needs a mounted view); the button focuses first.
 */
export function insertPageBreak(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  // Carry only what Enter would carry: a link or comment anchor must not
  // continue past the break.
  const { splittableMarks } = editor.extensionManager;
  const marks = (editor.state.storedMarks ?? $from.marks()).filter((m) =>
    splittableMarks.includes(m.type.name),
  );
  const attrs =
    $from.parent.type.name === "paragraph" ? { ...$from.parent.attrs } : {};
  return editor
    .chain()
    .insertContent([{ type: "pageBreak" }, { type: "paragraph", attrs }])
    .command(({ tr }) => {
      tr.setStoredMarks(marks);
      return true;
    })
    .run();
}

/**
 * Shift+Enter starts a new page; the soft line break stays on Mod-Enter.
 *
 * Priority 1000 puts this binding ahead of the HardBreak extension that
 * StarterKit installs, which also claims Shift-Enter. Inside a table cell the
 * binding declines, so a cell keeps its ordinary soft break: a page break has
 * no visible meaning inside a cell. It declines the same way inside a list item
 * or block quote: page view and the exports only honour top-level breaks, so a
 * nested one would split them apart.
 */
export const PageBreakKeys: Extension = Extension.create({
  name: "pageBreakKeys",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": () => {
        if (
          this.editor.isActive("tableCell") ||
          this.editor.isActive("tableHeader") ||
          this.editor.isActive("listItem") ||
          this.editor.isActive("blockquote")
        ) {
          return false;
        }
        return insertPageBreak(this.editor);
      },
    };
  },
});
