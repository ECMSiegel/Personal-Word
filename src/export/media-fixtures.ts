import type { AssetId, PendingAsset } from "../assets/types";
import type { JSONContent } from "@tiptap/react";

/** A real 1x1 red PNG (valid IDAT, so pdf-lib embedPng accepts it). */
export const tinyPng = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  ),
  (c) => c.charCodeAt(0),
);
/** Header-only JPEG (SOI, SOF0 1x1 with 3 components, EOI): enough for pdf-lib/docx, not a decodable picture. */
export const tinyJpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01,
  0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
]);

export const PNG_ID: AssetId = "a".repeat(64);
export const JPG_ID: AssetId = "b".repeat(64);

export function imageAssets(
  width = 2000,
  height = 1000,
): Map<AssetId, PendingAsset> {
  return new Map<AssetId, PendingAsset>([
    [
      PNG_ID,
      {
        id: PNG_ID,
        bytes: tinyPng,
        meta: { mime: "image/png", byteLength: tinyPng.length, width, height },
      },
    ],
    [
      JPG_ID,
      {
        id: JPG_ID,
        bytes: tinyJpeg,
        meta: { mime: "image/jpeg", byteLength: tinyJpeg.length, width, height },
      },
    ],
  ]);
}

export const text = (t: string): JSONContent => ({ type: "text", text: t });
export const para = (...content: JSONContent[]): JSONContent => ({
  type: "paragraph",
  content,
});
export const note = (id: string): JSONContent => ({
  type: "footnoteReference",
  attrs: { id },
});
export const image = (
  assetId: AssetId,
  extra: Record<string, unknown> = {},
): JSONContent => ({
  type: "image",
  attrs: { assetId, alt: "A red pixel", title: null, width: null, height: null, ...extra },
});
export const cell = (
  type: "tableHeader" | "tableCell",
  ...content: JSONContent[]
): JSONContent => ({ type, content });
export const table = (...rows: JSONContent[][]): JSONContent => ({
  type: "table",
  content: rows.map((cells) => ({ type: "tableRow", content: cells })),
});
