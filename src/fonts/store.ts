// Added fonts: native SQLite in Personal Word and IndexedDB in browser preview.
import { invoke } from "@tauri-apps/api/core";
import { readFontInfo } from "./fontInfo";
import type { UserFont } from "./types";

const DB = "personal-word.fonts";
const STORE = "fonts";
const native = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
type StoredFont = { meta: UserFont; bytes: Uint8Array };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "meta.id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open font storage"));
  });
}

async function allStored(): Promise<StoredFont[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredFont[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read the font list"));
  });
}

export async function listUserFonts(): Promise<UserFont[]> {
  if (native()) return invoke<UserFont[]>("font_list");
  return (await allStored()).map(({ meta }) => meta);
}

export async function addUserFont(file: File): Promise<UserFont> {
  const format = file.name.split(".").at(-1)?.toLowerCase();
  if (format !== "ttf" && format !== "otf") throw new Error("Choose a .ttf or .otf font file");
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Font files must be between 1 byte and 20 MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = await readFontInfo(bytes);
  const existing = await listUserFonts();
  if (existing.some((font) => font.family.toLowerCase() === info.family.toLowerCase() && font.style === info.style)) {
    throw new Error("That font is already added");
  }
  if (native()) return invoke<UserFont>("font_add", { fileName: file.name, family: info.family, style: info.style, data: Array.from(bytes) });
  const meta: UserFont = {
    id: `${info.family.trim().toLowerCase().replaceAll(" ", "-")}-${info.style}`,
    family: info.family,
    style: info.style,
    fileName: file.name,
    format,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ meta, bytes } satisfies StoredFont);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not store the font file"));
    tx.onabort = () => reject(tx.error ?? new Error("Could not store the font file"));
  });
  return meta;
}

export async function removeUserFont(id: string): Promise<void> {
  if (native()) return invoke<void>("font_remove", { id });
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not remove the font file"));
  });
}

export async function userFontBytes(id: string): Promise<Uint8Array> {
  if (native()) return new Uint8Array(await invoke<number[]>("font_read", { id }));
  const font = (await allStored()).find((item) => item.meta.id === id);
  if (!font) throw new Error("That font is not in the font list");
  return font.bytes;
}
