import { MAX_ASSET_BYTES, isAssetId, sha256Hex } from "./assets";
import type { AssetId } from "./types";

/** A source PDF's stored description; width and height are always 0 (mirrors `inspect` in assets.rs). */
export type PdfMeta = { mime: "application/pdf"; byteLength: number; width: 0; height: 0 };
/** A PDF held in memory before or after storage. */
export type PendingPdf = { id: AssetId; meta: PdfMeta; bytes: Uint8Array };

const HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** Checks the header and the 25 MB cap; throws a message fit to show the writer. */
export function inspectPdf(bytes: Uint8Array): PdfMeta {
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES)
    throw new Error("PDFs must be 25 MB or smaller.");
  if (!HEADER.every((v, i) => bytes[i] === v)) throw new Error("Choose a PDF file.");
  return { mime: "application/pdf", byteLength: bytes.length, width: 0, height: 0 };
}

export async function createPendingPdf(bytes: Uint8Array): Promise<PendingPdf> {
  const meta = inspectPdf(bytes);
  return { id: await sha256Hex(bytes), meta, bytes };
}

/** Throws unless the id, type and size all match the bytes (same order as the Rust check). */
export async function verifyPendingPdf(pdf: PendingPdf): Promise<void> {
  if (!isAssetId(pdf.id)) throw new Error("Invalid image identifier");
  if (!(pdf.bytes instanceof Uint8Array) || pdf.bytes.length === 0 || pdf.bytes.length > MAX_ASSET_BYTES)
    throw new Error("PDFs must be 25 MB or smaller.");
  if ((await sha256Hex(pdf.bytes)) !== pdf.id)
    throw new Error("PDF bytes do not match their identifier");
  const meta = inspectPdf(pdf.bytes);
  const m = pdf.meta;
  if (!m || m.mime !== meta.mime || m.byteLength !== meta.byteLength || m.width !== 0 || m.height !== 0)
    throw new Error("PDF type or size does not match its contents");
}
