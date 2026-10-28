import { Extension } from "@tiptap/core";

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
        return this.editor
          .chain()
          .focus()
          .insertContent([{ type: "pageBreak" }, { type: "paragraph" }])
          .run();
      },
    };
  },
});
