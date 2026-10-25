import type { Project } from "../model";
import type { PendingAsset } from "../assets/types";

export const MAX_TEXT_IMPORT_BYTES = 20 * 1024 * 1024; // 20 MiB
export const MAX_DOCX_COMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MiB compressed DOCX
export const MAX_INFLATED_BYTES = 100 * 1024 * 1024; // 100 MiB total uncompressed
export const MAX_DOCX_PER_ENTRY_BYTES = 20 * 1024 * 1024; // 20 MiB per uncompressed entry
export const MAX_ZIP_ENTRIES = 2000; // Maximum number of ZIP entries
export const MAX_COMPRESSION_RATIO = 100; // Maximum compression ratio (100:1)
export const MAX_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB per image
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapixels per image
export const MAX_STAGED_IMAGES_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MiB staged images per import
export const MAX_DOM_DEPTH = 100; // Maximum AST / DOM nesting depth

export type ImportDraftCounts = {
  paragraphs: number;
  images: number;
  tables: number;
  notes: number;
};

export type ImportDraft = {
  project: Project;
  assets: PendingAsset[];
  warnings: string[];
  counts: ImportDraftCounts;
  format: "DOCX" | "HTML" | "Markdown" | "Markdown bundle" | "Plain text";
  filename: string;
};

export type ZipEntryMeta = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  encrypted: boolean;
};

export type ZipContainerMeta = {
  entryCount: number;
  totalUncompressed: number;
  entries: ZipEntryMeta[];
};

export function checkAbortSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("Import operation aborted");
    error.name = "AbortError";
    throw error;
  }
}

export function assertTreeDepth(depth: number): void {
  if (depth > MAX_DOM_DEPTH) {
    throw new RangeError(
      `Document structure is too deeply nested (maximum depth: ${MAX_DOM_DEPTH})`,
    );
  }
}

export function validateXmlSafe(xmlText: string): void {
  // Check for external entity declarations (XXE defense)
  if (
    /<!DOCTYPE[^>]*\b(SYSTEM|PUBLIC)\b/i.test(xmlText) ||
    /<!ENTITY[^>]*\b(SYSTEM|PUBLIC)\b/i.test(xmlText)
  ) {
    throw new Error(
      "XML contains forbidden external entity declaration (XXE defense).",
    );
  }
}

export function isPathTraversal(fileName: string): boolean {
  if (fileName.includes("\0")) return true;
  if (fileName.startsWith("/") || fileName.startsWith("\\")) return true;
  if (/^[a-zA-Z]:/.test(fileName)) return true;
  // Check path segments
  const segments = fileName.split(/[/\\]/);
  for (const seg of segments) {
    if (seg === "..") return true;
  }
  return false;
}

export function validateZipContainer(
  input: ArrayBuffer | Uint8Array,
  signal?: AbortSignal,
): ZipContainerMeta {
  checkAbortSignal(signal);

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_DOCX_COMPRESSED_BYTES) {
    throw new RangeError(
      `File exceeds maximum compressed size of ${MAX_DOCX_COMPRESSED_BYTES / (1024 * 1024)}MB`,
    );
  }

  if (bytes.byteLength < 22) {
    throw new Error("Invalid ZIP archive: file is too small");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Locate End of Central Directory (EOCD) signature: 0x06054b50
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.byteLength - 65535 - 22);
  for (let i = bytes.byteLength - 22; i >= minOffset; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP archive: End of Central Directory record not found");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new RangeError(
      `ZIP archive exceeds maximum entry count of ${MAX_ZIP_ENTRIES} (found ${totalEntries})`,
    );
  }

  if (cdOffset + cdSize > bytes.byteLength || cdOffset < 0) {
    throw new Error("Invalid ZIP archive: Central directory extends beyond archive boundaries");
  }

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntryMeta[] = [];
  let currentOffset = cdOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < totalEntries; i++) {
    checkAbortSignal(signal);

    if (currentOffset + 46 > bytes.byteLength) {
      throw new Error("Invalid ZIP archive: truncated central directory header");
    }

    const signature = view.getUint32(currentOffset, true);
    if (signature !== 0x02014b50) {
      throw new Error("Invalid ZIP archive: invalid central directory signature");
    }

    const flags = view.getUint16(currentOffset + 8, true);
    const isEncrypted = (flags & 0x0001) !== 0;
    if (isEncrypted) {
      throw new Error("Password-protected or encrypted DOCX files are not supported.");
    }

    const compressedSize = view.getUint32(currentOffset + 20, true);
    const uncompressedSize = view.getUint32(currentOffset + 24, true);
    const fileNameLength = view.getUint16(currentOffset + 28, true);
    const extraFieldLength = view.getUint16(currentOffset + 30, true);
    const fileCommentLength = view.getUint16(currentOffset + 32, true);

    const headerLength = 46 + fileNameLength + extraFieldLength + fileCommentLength;
    if (currentOffset + headerLength > bytes.byteLength) {
      throw new Error("Invalid ZIP archive: entry header exceeds archive boundaries");
    }

    const fileNameBytes = bytes.subarray(
      currentOffset + 46,
      currentOffset + 46 + fileNameLength,
    );
    const fileName = decoder.decode(fileNameBytes);

    if (isPathTraversal(fileName)) {
      throw new Error(
        `ZIP archive contains unsafe path traversal entry: '${fileName}'.`,
      );
    }

    if (uncompressedSize > MAX_DOCX_PER_ENTRY_BYTES) {
      throw new RangeError(
        `ZIP entry '${fileName}' exceeds maximum uncompressed size of ${MAX_DOCX_PER_ENTRY_BYTES / (1024 * 1024)}MB (${uncompressedSize} bytes)`,
      );
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_INFLATED_BYTES) {
      throw new RangeError(
        `ZIP archive total uncompressed size exceeds ${MAX_INFLATED_BYTES / (1024 * 1024)}MB limit`,
      );
    }

    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      throw new RangeError(
        `ZIP entry '${fileName}' compression ratio exceeds ${MAX_COMPRESSION_RATIO}:1 (potential zip bomb)`,
      );
    }

    if (compressedSize === 0 && uncompressedSize > 0) {
      throw new RangeError(
        `ZIP entry '${fileName}' has invalid compression ratio (potential zip bomb)`,
      );
    }

    entries.push({
      name: fileName,
      compressedSize,
      uncompressedSize,
      encrypted: isEncrypted,
    });

    currentOffset += headerLength;
  }

  return {
    entryCount: totalEntries,
    totalUncompressed,
    entries,
  };
}
