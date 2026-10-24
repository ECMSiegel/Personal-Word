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
/** Shared schema for the writer, imported document validation, and export parsing. */
export function documentExtensions() {
  return [
    StarterKit.configure({ link: { openOnClick: false } }),
    Typography,
    TextFormat,
    ParagraphFormat,
    PageBreak,
    FootnoteReference,
    Image,
    ...tableExtensions(),
  ];
}
