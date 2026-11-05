import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
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

/** Shared schema for the writer, imported document validation, and export parsing. */
export function documentExtensions() {
  return [
    StarterKit.configure({ link: { openOnClick: false } }),
    PageBreakKeys,
    SelectAllSync,
    Typography,
    TextFormat,
    ParagraphFormat,
    PageBreak,
    FootnoteReference,
    Image,
    ...tableExtensions(),
  ];
}
