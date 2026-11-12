// The font menu's "Recent" section: fonts the user last applied from the menu.
import { sameFont } from "./names";

export const RECENT_FONTS_KEY = "folio.recentFonts";
export const MAX_RECENT_FONTS = 5;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

const defaultStorage = (): Storage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

/** Newest first, each font once (by sameFont), at most five. */
export function pushRecentFont(list: string[], font: string): string[] {
  return [font, ...list.filter((existing) => !sameFont(existing, font))].slice(
    0,
    MAX_RECENT_FONTS,
  );
}

export function loadRecentFonts(storage: Storage | undefined = defaultStorage()): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(RECENT_FONTS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [];
    return pushOrder(parsed);
  } catch {
    return [];
  }
}

function pushOrder(parsed: unknown[]): string[] {
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string" || !item.trim()) continue;
    if (out.some((existing) => sameFont(existing, item))) continue;
    out.push(item);
    if (out.length === MAX_RECENT_FONTS) break;
  }
  return out;
}

export function saveRecentFonts(list: string[], storage: Storage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(RECENT_FONTS_KEY, JSON.stringify(list.slice(0, MAX_RECENT_FONTS)));
  } catch {
    // Storage full or blocked: Recent just will not be remembered.
  }
}

/** The menu's own options for the recent fonts, in recent order; a recent font
 * that is no longer in the menu (an added font that was removed) is skipped. */
export function recentFontOptions<T extends { value: string }>(
  recent: string[],
  options: T[],
): T[] {
  const out: T[] = [];
  for (const font of recent) {
    const match = options.find((option) => sameFont(option.value, font));
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}
