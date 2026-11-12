// Reads a font file's family, style and embedding permission.
import type { FontStyle } from "./types";

export type Embedding = "installable" | "editable" | "preview" | "restricted";

export function readFontInfo(
  bytes: Uint8Array,
): Promise<{ family: string; style: FontStyle; embedding: Embedding }> {
  return (async () => {
    try {
      const { default: fontkit } = await import("@pdf-lib/fontkit");
      const font = fontkit.create(bytes) as any;
      const family =
        font.name?.records?.typographicFamily?.en ??
        font.name?.records?.family?.en ??
        font.familyName;
      if (typeof family !== "string" || !family.trim()) throw new Error("invalid font metadata");
      const subfamily = String(font.subfamilyName ?? "").toLowerCase();
      const bold = Boolean(font.head?.macStyle?.bold ?? /bold|black|heavy/.test(subfamily));
      const italic = Boolean(font.head?.macStyle?.italic ?? /italic|oblique/.test(subfamily));
      const style: FontStyle = bold ? (italic ? "boldItalic" : "bold") : italic ? "italic" : "regular";
      const fsType = Number(font["OS/2"]?.fsType ?? 0);
      const embedding: Embedding = fsType & 0x0002
        ? "restricted"
        : fsType & 0x0004
          ? "preview"
          : fsType & 0x0008
            ? "editable"
            : "installable";
      return { family: family.trim(), style, embedding };
    } catch {
      throw new Error("That file is not a font this app can read");
    }
  })();
}
