import type { JSONContent } from "@tiptap/react";
import type { Project } from "../model";
import type { AssetId, AssetMeta, PendingAsset } from "./types";
import { type PendingPdf, verifyPendingPdf } from "./pdf";

/** Mirrors MAX_ASSET_BYTES and MAX_DIMENSION in src-tauri/src/assets.rs. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_DIMENSION = 20_000;

const ASSET_ID = /^[0-9a-f]{64}$/;
export const isAssetId = (id: unknown): id is AssetId =>
  typeof id === "string" && ASSET_ID.test(id);

export async function sha256Hex(bytes: Uint8Array): Promise<AssetId> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  let out = "";
  for (const b of digest) out += b.toString(16).padStart(2, "0");
  return out;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(b: Uint8Array): [number, number] {
  if (b.length < 24 || String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR")
    throw new Error("PNG header is incomplete");
  const read = (at: number) =>
    ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
  return [read(16), read(20)];
}

function jpegSize(b: Uint8Array): [number, number] {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error("JPEG structure is invalid");
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (b[i + 2] << 8) | b[i + 3];
    if (length < 2) throw new Error("JPEG structure is invalid");
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 9 > b.length) throw new Error("JPEG frame header is incomplete");
      return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    }
    i += 2 + length;
  }
  throw new Error("JPEG has no frame size");
}

/** Reads type and pixel size from the file header; only PNG and JPEG are accepted. */
export function inspectImage(bytes: Uint8Array): AssetMeta {
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES)
    throw new Error("Image is empty or larger than 25 MB");
  let mime: AssetMeta["mime"];
  let size: [number, number];
  if (PNG_SIGNATURE.every((v, i) => bytes[i] === v)) {
    mime = "image/png";
    size = pngSize(bytes);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = "image/jpeg";
    size = jpegSize(bytes);
  } else throw new Error("Only PNG and JPEG images are supported");
  const [width, height] = size;
  if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION)
    throw new Error("Image dimensions are outside the supported range");
  return { mime, byteLength: bytes.length, width, height };
}

export async function createPendingAsset(bytes: Uint8Array): Promise<PendingAsset> {
  const meta = inspectImage(bytes);
  return { id: await sha256Hex(bytes), meta, bytes };
}

/** Throws unless the id, type and size all match the bytes (same order as the Rust check). */
export async function verifyPendingAsset(asset: PendingAsset): Promise<void> {
  if (!isAssetId(asset.id)) throw new Error("Invalid image identifier");
  if (!(asset.bytes instanceof Uint8Array) || asset.bytes.length === 0 || asset.bytes.length > MAX_ASSET_BYTES)
    throw new Error("Image is empty or larger than 25 MB");
  if ((await sha256Hex(asset.bytes)) !== asset.id)
    throw new Error("Image bytes do not match their identifier");
  const meta = inspectImage(asset.bytes);
  const m = asset.meta;
  if (!m || m.mime !== meta.mime || m.byteLength !== meta.byteLength || m.width !== meta.width || m.height !== meta.height)
    throw new Error("Image type or size does not match its contents");
}

const CHUNK = 0x6000; // multiple of 3 so chunk boundaries never need padding

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    let bin = "";
    for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
    parts.push(btoa(bin));
  }
  return parts.join("");
}

/** Strict standard base64 (padded, no whitespace or other characters). */
export function fromBase64(text: string): Uint8Array {
  if (typeof text !== "string" || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error("Image data is not valid base64");
  const out = new Uint8Array((text.length / 4) * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0));
  let at = 0;
  const step = 4 * 8192;
  for (let i = 0; i < text.length; i += step) {
    const bin = atob(text.slice(i, i + step));
    for (let j = 0; j < bin.length; j++) out[at++] = bin.charCodeAt(j);
  }
  return out;
}

function walk(node: unknown, ids: Set<AssetId>): void {
  if (!node || typeof node !== "object") return;
  const n = node as JSONContent;
  if (n.type === "image") {
    const id = (n.attrs as { assetId?: unknown } | undefined)?.assetId;
    if (typeof id === "string") ids.add(id);
  }
  if (Array.isArray(n.content)) for (const child of n.content) walk(child, ids);
}

/** Every image asset id referenced by one document, or by all entries of a project. */
export function collectAssetIds(content: JSONContent | Project): Set<AssetId> {
  const ids = new Set<AssetId>();
  const maybe = content as Partial<Project>;
  if (Array.isArray(maybe.entries)) for (const e of maybe.entries) walk(e?.content, ids);
  else walk(content, ids);
  return ids;
}

type IdbLike = Pick<IDBFactory, "open">;
const DB_NAME = "personal-word-browser-assets";
const STORE = "assets";

const request = <T,>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });

export function createBrowserAssetStore(factory?: () => IdbLike | undefined) {
  const getFactory = factory ?? (() => globalThis.indexedDB);
  let opened: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (!opened) {
      const f = getFactory();
      if (!f) return Promise.reject(new Error("Browser image storage is unavailable"));
      const req = f.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      opened = request(req).catch((e) => {
        opened = null;
        throw e;
      });
    }
    return opened;
  };
  const key = (projectId: string, id: AssetId) => `${projectId}\u0000${id}`;
  return {
    async put(projectId: string, asset: PendingAsset): Promise<void> {
      await verifyPendingAsset(asset);
      const db = await open();
      const tx = db.transaction(STORE, "readwrite");
      const done = new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error ?? new Error("IndexedDB write failed"));
        tx.onabort = () => rej(tx.error ?? new Error("IndexedDB write aborted"));
      });
      tx.objectStore(STORE).put({ meta: asset.meta, bytes: asset.bytes }, key(projectId, asset.id));
      await done;
    },
    async get(projectId: string, id: AssetId): Promise<PendingAsset | null> {
      const db = await open();
      const row = (await request(db.transaction(STORE, "readonly").objectStore(STORE).get(key(projectId, id)))) as
        | { meta: AssetMeta; bytes: Uint8Array }
        | undefined;
      if (!row) return null;
      const asset = { id, meta: row.meta, bytes: row.bytes };
      await verifyPendingAsset(asset);
      return asset;
    },
    /** Source PDFs share the database, store and key scheme with images. */
    async putPdf(projectId: string, pdf: PendingPdf): Promise<void> {
      await verifyPendingPdf(pdf);
      const db = await open();
      const tx = db.transaction(STORE, "readwrite");
      const done = new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error ?? new Error("IndexedDB write failed"));
        tx.onabort = () => rej(tx.error ?? new Error("IndexedDB write aborted"));
      });
      tx.objectStore(STORE).put({ meta: pdf.meta, bytes: pdf.bytes }, key(projectId, pdf.id));
      await done;
    },
    async getPdf(projectId: string, id: AssetId): Promise<PendingPdf | null> {
      const db = await open();
      const row = (await request(db.transaction(STORE, "readonly").objectStore(STORE).get(key(projectId, id)))) as
        | { meta: PendingPdf["meta"]; bytes: Uint8Array }
        | undefined;
      if (!row) return null;
      const pdf = { id, meta: row.meta, bytes: row.bytes };
      await verifyPendingPdf(pdf);
      return pdf;
    },
  };
}

/**
 * Image storage for the browser preview ONLY (IndexedDB, keyed by project id + asset id).
 * It is never proof of native durability: the desktop app stores images through Rust/SQLite.
 */
export const browserAssetStore = createBrowserAssetStore();
