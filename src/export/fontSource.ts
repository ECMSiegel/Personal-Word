// Where export finds font files for a run's font.
import type { Embedding } from "../fonts/fontInfo";
import { readFontInfo } from "../fonts/fontInfo";
import { listUserFonts, userFontBytes } from "../fonts/store";
import { sameFont } from "../fonts/names";
import { systemFontFile } from "../fonts/system";
import type { FontStyle } from "../fonts/types";

export type ResolvedFont = {
  bytes: Uint8Array;
  family: string;
  exact: boolean;
  embedding: Embedding;
};

export type ExportFontSource = {
  resolve(
    family: string,
    bold: boolean,
    italic: boolean,
  ): Promise<ResolvedFont | null>;
};

export function defaultFontSource(): ExportFontSource {
  return {
    async resolve(family, bold, italic) {
      const requestedStyle: FontStyle = bold
        ? italic
          ? "boldItalic"
          : "bold"
        : italic
          ? "italic"
          : "regular";
      try {
        const added = (await listUserFonts()).filter((font) =>
          sameFont(font.family, family),
        );
        if (added.length) {
          const selected =
            added.find((font) => font.style === requestedStyle) ??
            added.find((font) => font.style === "regular") ??
            added[0];
          const bytes = await userFontBytes(selected.id);
          try {
            const info = await readFontInfo(bytes);
            return {
              bytes,
              family: info.family,
              exact:
                selected.style === requestedStyle &&
                info.style === requestedStyle,
              embedding: info.embedding,
            };
          } catch {
            return {
              bytes,
              family: selected.family,
              exact: selected.style === requestedStyle,
              embedding: "restricted",
            };
          }
        }

        const system = await systemFontFile(family, bold, italic);
        if (!system || system.collection) return null;
        try {
          const info = await readFontInfo(system.bytes);
          return {
            bytes: system.bytes,
            family: info.family,
            exact: info.style === requestedStyle,
            embedding: info.embedding,
          };
        } catch {
          return {
            bytes: system.bytes,
            family,
            exact: true,
            embedding: "restricted",
          };
        }
      } catch {
        return null;
      }
    },
  };
}
