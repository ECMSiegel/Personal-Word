import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import {
  TextFormat,
  ParagraphFormat,
  PageBreak,
  FootnoteReference,
} from "./formatting";
import { Image } from "./media";
import { tableExtensions } from "./tables";
import { PageBreakKeys } from "./pageBreakKeys";
/**
 * Select-all must always take effect. When state is already an AllSelection and
 * a click has since moved the DOM caret (its selectionchange not yet read),
 * Mod-a would set a selection equal to state, ProseMirror would skip rewriting
 * the DOM, and the queued selectionchange would then read the caret back in.
 * Reading the DOM selection first makes state match what is on screen, so
 * select-all differs from it and repaints. Only a selection that differs from
 * the last-read DOM one is read; cell, image and all selections are untouched.
 */
const SelectAllSync = Extension.create({
  name: "selectAllSync",
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "a") {
              (view as unknown as { domObserver: { flush(): void } }).domObserver.flush();
            }
            return false;
          },
        },
      }),
    ];
  },
});

/**
 * End and Home must work on a node selection the way they do on a text caret:
 * a node-selected footnote marker (or other inline node) must not keep the
 * selection, because Insert image at a node selection replaces the node —
 * a marker selected this way loses the note from the document and exports.
 * With a text selection the browser itself moves the caret and ProseMirror
 * reads it back; node selections have no caret, so nothing moves. These
 * shortcuts put a text caret at the end / start of the containing text block.
 * Any selection that is not an inline node selection returns false, leaving
 * the browser's visual-line End / Home behavior untouched.
 */
const NodeSelectionCaretKeys = Extension.create({
  name: "nodeSelectionCaretKeys",
  priority: 1000,
  addKeyboardShortcuts() {
    const inlineNodeSelection = () => {
      const { state } = this.editor;
      if (!(state.selection instanceof NodeSelection)) return null;
      if (!state.selection.$from.parent.isTextblock) return null;
      return state.selection;
    };
    return {
      End: () => {
        const selection = inlineNodeSelection();
        if (!selection) return false;
        const { state } = this.editor;
        const $to = selection.$to;
        this.editor.view.dispatch(
          state.tr
            .setSelection(TextSelection.near(state.doc.resolve($to.end($to.depth)), -1))
            .scrollIntoView(),
        );
        return true;
      },
      Home: () => {
        const selection = inlineNodeSelection();
        if (!selection) return false;
        const { state } = this.editor;
        const $from = selection.$from;
        this.editor.view.dispatch(
          state.tr
            .setSelection(TextSelection.near(state.doc.resolve($from.start($from.depth)), 1))
            .scrollIntoView(),
        );
        return true;
      },
    };
  },
});

/** Shared schema for the writer, imported document validation, and export parsing. */
export function documentExtensions() {
  return [
    StarterKit.configure({ link: { openOnClick: false } }),
    PageBreakKeys,
    SelectAllSync,
    NodeSelectionCaretKeys,
    Typography,
    TextFormat,
    ParagraphFormat,
    PageBreak,
    FootnoteReference,
    Image,
    ...tableExtensions(),
  ];
}
