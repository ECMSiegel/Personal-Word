// Font registry: built-in fonts, the interface font and document font options.
import { useSyncExternalStore } from "react";
import { fontValue, sameFont } from "./names";
import { listUserFonts, userFontBytes } from "./store";
import { listSystemFamilies } from "./system";
import type { UserFont } from "./types";

export const BUILT_IN_FONTS = [
  { label: "Futura", stack: 'Futura, "Avenir Next", -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: "Avenir Next", stack: '"Avenir Next", -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: "Helvetica Neue", stack: '"Helvetica Neue", Helvetica, sans-serif' },
  { label: "System", stack: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { label: "Gill Sans", stack: '"Gill Sans", sans-serif' },
  { label: "Optima", stack: 'Optima, sans-serif' },
  { label: "Verdana", stack: 'Verdana, sans-serif' },
  { label: "Georgia", stack: 'Georgia, serif' },
  { label: "Charter", stack: 'Charter, serif' },
  { label: "Times New Roman", stack: '"Times New Roman", serif' },
];

const PREF_KEY = "folio.workspace.interfaceFont";
const FALLBACK = BUILT_IN_FONTS[0]!.stack;
let fonts: UserFont[] = [];
let systems: string[] = [];
let listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const notify = () => listeners.forEach((listener) => listener());
const getFonts = () => fonts;
const getSystems = () => systems;
const getInterfaceFont = () => localStorage.getItem(PREF_KEY) ?? FALLBACK;

export function setInterfaceFont(stack: string): void {
  localStorage.setItem(PREF_KEY, stack);
  document.documentElement.style.setProperty("--ui-font", stack);
  notify();
}

export function useInterfaceFont(): string {
  return useSyncExternalStore(subscribe, getInterfaceFont, () => FALLBACK);
}

export function useUserFonts(): UserFont[] {
  return useSyncExternalStore(subscribe, getFonts, () => []);
}

export function useSystemFamilies(): string[] {
  return useSyncExternalStore(subscribe, getSystems, () => []);
}

export async function refreshFonts(): Promise<void> {
  fonts = await listUserFonts();
  await loadFaces(fonts);
  notify();
}

async function loadFaces(available: UserFont[]): Promise<void> {
  for (const font of available) {
    const weight = font.style === "bold" || font.style === "boldItalic" ? "700" : "400";
    const style = font.style === "italic" || font.style === "boldItalic" ? "italic" : "normal";
    if (Array.from(document.fonts).some((face) => face.family === font.family && face.weight === weight && face.style === style)) continue;
    try {
      const bytes = await userFontBytes(font.id);
      const face = new FontFace(font.family, new Uint8Array(bytes).buffer, { weight, style });
      await face.load();
      document.fonts.add(face);
    } catch { /* An unavailable or invalid file should not prevent startup. */ }
  }
}

export async function initFonts(): Promise<void> {
  const saved = getInterfaceFont();
  document.documentElement.style.setProperty("--ui-font", saved);
  let addedFailed = false;
  const available = await listUserFonts().catch(() => { addedFailed = true; return []; });
  const installed = await listSystemFamilies().catch(() => []);
  const selected =
    BUILT_IN_FONTS.some((font) => sameFont(font.stack, saved)) ||
    available.some((font) => sameFont(font.family, saved)) ||
    installed.some((family) => sameFont(family, saved))
      ? saved
      : FALLBACK;
  // A failed or empty list proves nothing: keep the saved choice.
  const reset = selected !== saved && installed.length > 0 && !addedFailed;
  if (reset) localStorage.setItem(PREF_KEY, selected);
  document.documentElement.style.setProperty("--ui-font", reset ? selected : saved);
  fonts = available;
  await loadFaces(available);
  systems = installed;
  notify();
}

export type FontOption = {
  value: string;
  label: string;
  style?: { fontFamily: string };
};

const NO_OPTIONS: FontOption[] = [];

export function buildDocumentFontOptions(userFonts: UserFont[], systemFamilies: string[]): FontOption[] {
  const options: FontOption[] = [];
  const seen = new Set<string>();
  for (const font of userFonts) {
    const key = font.family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const value = fontValue(font.family);
    options.push({ value, label: font.family, style: { fontFamily: value } });
  }
  for (const family of systemFamilies) {
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: fontValue(family), label: family });
  }
  return options;
}

/** Added families, then installed families (C3). Empty until then. */
export function useDocumentFontOptions(): FontOption[] {
  const added = useUserFonts();
  const installed = useSystemFamilies();
  return added.length || installed.length ? buildDocumentFontOptions(added, installed) : NO_OPTIONS;
}
