// Installed (system) fonts. The native app lists them with Core Text
// (src-tauri/src/sysfonts.rs); outside the native app or on any error the
// list is empty and file lookups return null, so callers fall back to
// bundled and added fonts.
import { invoke } from "@tauri-apps/api/core";
import type { FontFile } from "./types";

const native = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function listSystemFamilies(): Promise<string[]> {
  if (!native()) return [];
  try {
    return await invoke<string[]>("system_font_families");
  } catch {
    return [];
  }
}

export async function systemFontFile(
  family: string,
  bold: boolean,
  italic: boolean,
): Promise<FontFile | null> {
  if (!native()) return null;
  try {
    const file = await invoke<{
      data: number[];
      postscriptName: string;
      collection: boolean;
    } | null>("system_font_file", { family, bold, italic });
    if (!file || file.collection) return null;
    return {
      bytes: Uint8Array.from(file.data),
      postscriptName: file.postscriptName,
      collection: file.collection,
    };
  } catch {
    return null;
  }
}
